const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const leadsRepository = require('./leads.repository');

function mapLead(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    publicFormId: row.public_form_id,
    patientName: row.patient_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    intakeChannel: row.intake_channel,
    serviceRequested: row.service_requested,
    notes: row.notes,
    preferredAppointmentAt: row.preferred_appointment_at,
    pipelineStatus: row.pipeline_status,
    visibilityStatus: row.visibility_status,
    assignedToUserId: row.assigned_to_user_id,
    createdByUserId: row.created_by_user_id,
    firstContactAt: row.first_contact_at,
    lastContactAt: row.last_contact_at,
    nextFollowupAt: row.next_followup_at,
    archivedAt: row.archived_at,
    archivedByUserId: row.archived_by_user_id,
    archivedReason: row.archived_reason,
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

async function assertLeadAccess(leadId, currentUser) {
  const lead = await leadsRepository.findLeadById(leadId);

  if (!lead) {
    throw new ApiError(404, 'Lead not found.', { code: 'LEAD_NOT_FOUND' });
  }

  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(lead.clinic_id)
  ) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  return lead;
}

async function assertReceptionistArchivePermission(clinicId, currentUser, visibilityStatus = 'active') {
  if (currentUser.role !== ROLES.RECEPTIONIST) return;

  const setting = await leadsRepository.findClinicArchiveSetting(clinicId);

  const allowed = Boolean(setting?.receptionist_can_archive_leads);

  if (!allowed && visibilityStatus === 'archived') {
    throw new ApiError(403, 'Receptionist cannot view archived leads for this clinic.', {
      code: 'FORBIDDEN',
    });
  }
}

async function listLeads(filters, currentUser) {
  const clinicId = resolveClinicId(filters.clinicId, currentUser);
  const visibilityStatus = filters.visibilityStatus || 'active';

  await assertReceptionistArchivePermission(clinicId, currentUser, visibilityStatus);

  const rows = await leadsRepository.listLeads({
    ...filters,
    clinicId,
    visibilityStatus,
  });

  return rows.map(mapLead);
}

async function getLeadById(leadId, currentUser) {
  const lead = await assertLeadAccess(leadId, currentUser);

  await assertReceptionistArchivePermission(
    lead.clinic_id,
    currentUser,
    lead.visibility_status
  );

  return mapLead(lead);
}

async function createLead(input, currentUser) {
  const clinicId = resolveClinicId(input.clinicId, currentUser);

  let assignedToUserId = input.assignedToUserId || null;

  if (assignedToUserId) {
    const assignee = await leadsRepository.findActiveAssignableUser(assignedToUserId, clinicId);

    if (!assignee) {
      throw new ApiError(400, 'Assigned user must be active staff in the same clinic.', {
        code: 'INVALID_ASSIGNEE',
      });
    }

    if (
      currentUser.role === ROLES.RECEPTIONIST &&
      Number(assignedToUserId) !== Number(currentUser.id)
    ) {
      throw new ApiError(403, 'Receptionist can only assign a lead to self.', {
        code: 'FORBIDDEN',
      });
    }
  }

  const created = await leadsRepository.createLead({
    clinicId,
    publicFormId: null,
    patientName: input.patientName,
    phone: input.phone,
    email: input.email,
    source: input.source,
    intakeChannel: input.intakeChannel || 'manual',
    serviceRequested: input.serviceRequested || null,
    notes: input.notes || null,
    preferredAppointmentAt: input.preferredAppointmentAt || null,
    pipelineStatus: input.pipelineStatus || 'new',
    assignedToUserId,
    createdByUserId: currentUser.id,
  });

  return mapLead(created);
}

async function updateLead(leadId, updates, currentUser) {
  const lead = await assertLeadAccess(leadId, currentUser);

  if (
    currentUser.role === ROLES.RECEPTIONIST &&
    lead.visibility_status === 'archived'
  ) {
    const setting = await leadsRepository.findClinicArchiveSetting(lead.clinic_id);

    if (!setting?.receptionist_can_archive_leads) {
      throw new ApiError(403, 'Receptionist cannot edit archived leads for this clinic.', {
        code: 'FORBIDDEN',
      });
    }
  }

  const updated = await leadsRepository.updateLead(leadId, updates);
  return mapLead(updated);
}

async function assignLeadToSelf(leadId, currentUser) {
  const lead = await assertLeadAccess(leadId, currentUser);

  if (![ROLES.RECEPTIONIST, ROLES.OWNER, ROLES.SUPER_ADMIN].includes(currentUser.role)) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  const updated = await leadsRepository.updateLeadAssignment(leadId, currentUser.id);
  return mapLead(updated);
}

async function unassignLeadFromSelf(leadId, currentUser) {
  const lead = await assertLeadAccess(leadId, currentUser);

  if (currentUser.role === ROLES.SUPER_ADMIN) {
    const updated = await leadsRepository.updateLeadAssignment(leadId, null);
    return mapLead(updated);
  }

  if (Number(lead.assigned_to_user_id) !== Number(currentUser.id)) {
    throw new ApiError(403, 'You can only unassign a lead currently assigned to you.', {
      code: 'FORBIDDEN',
    });
  }

  const updated = await leadsRepository.updateLeadAssignment(leadId, null);
  return mapLead(updated);
}

async function reassignLead(leadId, input, currentUser) {
  const lead = await assertLeadAccess(leadId, currentUser);

  if (![ROLES.OWNER, ROLES.SUPER_ADMIN].includes(currentUser.role)) {
    throw new ApiError(403, 'Only owner or super admin can reassign leads.', {
      code: 'FORBIDDEN',
    });
  }

  if (input.assignedToUserId !== null) {
    const assignee = await leadsRepository.findActiveAssignableUser(
      input.assignedToUserId,
      lead.clinic_id
    );

    if (!assignee) {
      throw new ApiError(400, 'Assigned user must be active staff in the same clinic.', {
        code: 'INVALID_ASSIGNEE',
      });
    }
  }

  const updated = await leadsRepository.updateLeadAssignment(leadId, input.assignedToUserId);
  return mapLead(updated);
}

async function archiveLead(leadId, input, currentUser) {
  const lead = await assertLeadAccess(leadId, currentUser);

  if (currentUser.role === ROLES.RECEPTIONIST) {
    const setting = await leadsRepository.findClinicArchiveSetting(lead.clinic_id);

    if (!setting?.receptionist_can_archive_leads) {
      throw new ApiError(403, 'Receptionist cannot archive leads for this clinic.', {
        code: 'FORBIDDEN',
      });
    }
  }

  const updated = await leadsRepository.archiveLead(leadId, currentUser.id, input.reason || null);
  return mapLead(updated);
}

async function unarchiveLead(leadId, currentUser) {
  const lead = await assertLeadAccess(leadId, currentUser);

  if (currentUser.role === ROLES.RECEPTIONIST) {
    const setting = await leadsRepository.findClinicArchiveSetting(lead.clinic_id);

    if (!setting?.receptionist_can_archive_leads) {
      throw new ApiError(403, 'Receptionist cannot unarchive leads for this clinic.', {
        code: 'FORBIDDEN',
      });
    }
  }

  const updated = await leadsRepository.unarchiveLead(leadId);
  return mapLead(updated);
}

async function listDuplicateWarnings(filters, currentUser) {
  if (![ROLES.OWNER, ROLES.SUPER_ADMIN].includes(currentUser.role)) {
    throw new ApiError(403, 'Only owner or super admin can view duplicate warnings.', {
      code: 'FORBIDDEN',
    });
  }

  const clinicId = resolveClinicId(filters.clinicId, currentUser);
  const rows = await leadsRepository.listDuplicateWarnings(clinicId);

  return rows.map((row) => ({
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    normalizedPhone: row.normalized_phone,
    leadCount: row.lead_count,
    activeLeadCount: row.active_lead_count,
    archivedLeadCount: row.archived_lead_count,
    leadIds: row.lead_ids,
  }));
}

module.exports = {
  listLeads,
  getLeadById,
  createLead,
  updateLead,
  assignLeadToSelf,
  unassignLeadFromSelf,
  reassignLead,
  archiveLead,
  unarchiveLead,
  listDuplicateWarnings,
};