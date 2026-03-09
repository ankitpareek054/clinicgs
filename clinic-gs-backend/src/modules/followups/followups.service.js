const { withTransaction } = require('../../db/transaction');
const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const followupsRepository = require('./followups.repository');

function mapFollowup(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    leadId: row.lead_id,
    dueAt: row.due_at,
    status: row.status,
    outcome: row.outcome,
    notes: row.notes,
    createdByUserId: row.created_by_user_id,
    completedByUserId: row.completed_by_user_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
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

async function assertFollowupAccess(followupId, currentUser) {
  const row = await followupsRepository.findById(followupId);

  if (!row) {
    throw new ApiError(404, 'Follow-up not found.', { code: 'FOLLOWUP_NOT_FOUND' });
  }

  if (
    currentUser.role !== ROLES.SUPER_ADMIN &&
    Number(currentUser.clinicId) !== Number(row.clinic_id)
  ) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  return row;
}

async function listFollowups(filters, currentUser) {
  const clinicId = resolveClinicId(filters.clinicId, currentUser);
  const rows = await followupsRepository.listFollowups({
    ...filters,
    clinicId,
  });

  return rows.map(mapFollowup);
}

async function createFollowup(input, currentUser) {
  const clinicId = resolveClinicId(input.clinicId, currentUser);
  const lead = await followupsRepository.findLeadById(input.leadId);

  if (!lead) {
    throw new ApiError(404, 'Lead not found.', { code: 'LEAD_NOT_FOUND' });
  }

  if (Number(lead.clinic_id) !== Number(clinicId)) {
    throw new ApiError(400, 'Lead does not belong to the selected clinic.', {
      code: 'LEAD_CLINIC_MISMATCH',
    });
  }

  return withTransaction(async (client) => {
    const created = await followupsRepository.createFollowup(
      {
        clinicId,
        leadId: input.leadId,
        dueAt: input.dueAt,
        notes: input.notes || null,
        outcome: input.outcome || null,
        createdByUserId: currentUser.id,
      },
      client
    );

    await followupsRepository.updateLeadNextFollowup(input.leadId, input.dueAt, client);

    return mapFollowup(created);
  });
}

async function updateFollowup(followupId, updates, currentUser) {
  const existing = await assertFollowupAccess(followupId, currentUser);

  return withTransaction(async (client) => {
    const updated = await followupsRepository.updateFollowup(followupId, updates, client);

    if (Object.prototype.hasOwnProperty.call(updates, 'dueAt') && updated.status === 'pending') {
      await followupsRepository.updateLeadNextFollowup(updated.lead_id, updated.due_at, client);
    }

    return mapFollowup(updated);
  });
}

async function updateFollowupStatus(followupId, input, currentUser) {
  await assertFollowupAccess(followupId, currentUser);

  return withTransaction(async (client) => {
    const updated = await followupsRepository.updateFollowupStatus(
      followupId,
      {
        status: input.status,
        outcome: input.outcome || null,
        notes: input.notes || null,
        completedByUserId: currentUser.id,
      },
      client
    );

    const nextPending = await followupsRepository.findNextPendingFollowupForLead(
      updated.lead_id,
      client
    );

    await followupsRepository.updateLeadNextFollowup(
      updated.lead_id,
      nextPending ? nextPending.due_at : null,
      client
    );

    return mapFollowup(updated);
  });
}

module.exports = {
  listFollowups,
  createFollowup,
  updateFollowup,
  updateFollowupStatus,
};