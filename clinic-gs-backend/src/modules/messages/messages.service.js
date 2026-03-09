const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const messagesRepository = require('./messages.repository');

function mapMessageLog(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    leadId: row.lead_id,
    appointmentId: row.appointment_id,
    createdByUserId: row.created_by_user_id,
    channel: row.channel,
    templateName: row.template_name,
    recipient: row.recipient,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
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

async function assertMessageLogAccess(messageLogId, currentUser) {
  const row = await messagesRepository.findMessageLogById(messageLogId);

  if (!row) {
    throw new ApiError(404, 'Message log not found.', {
      code: 'MESSAGE_LOG_NOT_FOUND',
    });
  }

  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(row.clinic_id)
  ) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  return row;
}

async function listMessageLogs(filters, currentUser) {
  const clinicId = resolveClinicId(filters.clinicId, currentUser);

  const rows = await messagesRepository.listMessageLogs({
    ...filters,
    clinicId,
  });

  return rows.map(mapMessageLog);
}

async function getMessageLogById(messageLogId, currentUser) {
  const row = await assertMessageLogAccess(messageLogId, currentUser);
  return mapMessageLog(row);
}

async function createMessageLog(input, currentUser) {
  const clinicId = resolveClinicId(input.clinicId, currentUser);

  if (input.leadId) {
    const lead = await messagesRepository.findLeadById(input.leadId);

    if (!lead) {
      throw new ApiError(404, 'Lead not found.', { code: 'LEAD_NOT_FOUND' });
    }

    if (Number(lead.clinic_id) !== Number(clinicId)) {
      throw new ApiError(400, 'Lead does not belong to the selected clinic.', {
        code: 'LEAD_CLINIC_MISMATCH',
      });
    }
  }

  if (input.appointmentId) {
    const appointment = await messagesRepository.findAppointmentById(input.appointmentId);

    if (!appointment) {
      throw new ApiError(404, 'Appointment not found.', {
        code: 'APPOINTMENT_NOT_FOUND',
      });
    }

    if (Number(appointment.clinic_id) !== Number(clinicId)) {
      throw new ApiError(400, 'Appointment does not belong to the selected clinic.', {
        code: 'APPOINTMENT_CLINIC_MISMATCH',
      });
    }
  }

  const created = await messagesRepository.createMessageLog({
    clinicId,
    leadId: input.leadId || null,
    appointmentId: input.appointmentId || null,
    createdByUserId: currentUser.id,
    channel: input.channel,
    templateName: input.templateName || null,
    recipient: input.recipient || null,
    status: input.status,
    errorMessage: input.errorMessage || null,
  });

  return mapMessageLog(created);
}

module.exports = {
  listMessageLogs,
  getMessageLogById,
  createMessageLog,
};