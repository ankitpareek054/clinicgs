const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const appointmentsRepository = require('./appointments.repository');

function mapAppointment(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    leadId: row.lead_id,
    createdByUserId: row.created_by_user_id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    calendarEventId: row.calendar_event_id,
    syncStatus: row.sync_status,
    lastSyncAttemptAt: row.last_sync_attempt_at,
    syncErrorMessage: row.sync_error_message,
    reminder24hSentAt: row.reminder_24h_sent_at,
    reminder2hSentAt: row.reminder_2h_sent_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveClinicId(inputClinicId, currentUser) {
  if (currentUser.role === ROLES.SUPER_ADMIN) {
    if (!inputClinicId) {
      throw new ApiError(400, 'clinicId is required for super admin.', {
        code: 'CLINIC_ID_REQUIRED',
      });
    }

    return Number(inputClinicId);
  }

  return Number(currentUser.clinicId);
}

function mapLeadPipelineFromAppointmentStatus(status) {
  switch (status) {
    case 'booked':
      return 'booked';
    case 'rescheduled':
      return 'rescheduled';
    case 'completed':
      return 'completed';
    case 'no_show':
      return 'no_show';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

function computeSyncStatus(calendarSyncEnabled, status) {
  if (!calendarSyncEnabled) return 'not_required';
  if (status === 'completed' || status === 'no_show') return 'not_required';
  return 'pending';
}

async function assertAppointmentAccess(appointmentId, currentUser) {
  const appointment = await appointmentsRepository.findById(appointmentId);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found.', {
      code: 'APPOINTMENT_NOT_FOUND',
    });
  }

  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(appointment.clinic_id)
  ) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  return appointment;
}

async function listAppointments(filters, currentUser) {
  const clinicId = resolveClinicId(filters.clinicId, currentUser);
  const rows = await appointmentsRepository.listAppointments({
    ...filters,
    clinicId,
  });

  return rows.map(mapAppointment);
}

async function createAppointment(input, currentUser) {
  const clinicId = resolveClinicId(input.clinicId, currentUser);
  const lead = await appointmentsRepository.findLeadById(input.leadId);

  if (!lead) {
    throw new ApiError(404, 'Lead not found.', { code: 'LEAD_NOT_FOUND' });
  }

  if (Number(lead.clinic_id) !== Number(clinicId)) {
    throw new ApiError(400, 'Lead does not belong to the selected clinic.', {
      code: 'LEAD_CLINIC_MISMATCH',
    });
  }

  const integration = await appointmentsRepository.findClinicIntegration(clinicId);
  const status = input.status || 'booked';
  const syncStatus = computeSyncStatus(Boolean(integration?.calendar_sync_enabled), status);

  return withTransaction(async (client) => {
    const created = await appointmentsRepository.createAppointment(
      {
        clinicId,
        leadId: input.leadId,
        createdByUserId: currentUser.id,
        startTime: input.startTime,
        endTime: input.endTime,
        status,
        syncStatus,
        lastSyncAttemptAt: syncStatus === 'pending' ? new Date().toISOString() : null,
        syncErrorMessage: null,
        notes: input.notes || null,
      },
      client
    );

    const pipelineStatus = mapLeadPipelineFromAppointmentStatus(status);

    if (pipelineStatus) {
      await appointmentsRepository.updateLeadPipeline(input.leadId, pipelineStatus, client);
    }

    return mapAppointment(created);
  });
}

async function updateAppointment(appointmentId, updates, currentUser) {
  const existing = await assertAppointmentAccess(appointmentId, currentUser);
  const integration = await appointmentsRepository.findClinicIntegration(existing.clinic_id);

  const nextStatus = updates.status || existing.status;
  const nextSyncStatus = computeSyncStatus(Boolean(integration?.calendar_sync_enabled), nextStatus);

  return withTransaction(async (client) => {
    const updated = await appointmentsRepository.updateAppointment(
      appointmentId,
      {
        startTime: updates.startTime,
        endTime: updates.endTime,
        status: updates.status,
        notes: updates.notes,
        syncStatus: nextSyncStatus,
        lastSyncAttemptAt: nextSyncStatus === 'pending' ? new Date().toISOString() : null,
        syncErrorMessage: nextSyncStatus === 'pending' ? null : null,
      },
      client
    );

    const pipelineStatus = mapLeadPipelineFromAppointmentStatus(updated.status);

    if (pipelineStatus) {
      await appointmentsRepository.updateLeadPipeline(updated.lead_id, pipelineStatus, client);
    }

    return mapAppointment(updated);
  });
}

module.exports = {
  listAppointments,
  createAppointment,
  updateAppointment,
};