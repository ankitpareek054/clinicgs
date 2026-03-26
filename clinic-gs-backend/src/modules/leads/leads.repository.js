const db = require('../../db');

async function listLeads(filters = {}, client = null) {
  const values = [];
  const conditions = [];
  let index = 1;

  if (filters.clinicId !== undefined && filters.clinicId !== null) {
    conditions.push(`clinic_id = $${index++}`);
    values.push(filters.clinicId);
  }

  if (filters.pipelineStatus) {
    conditions.push(`pipeline_status = $${index++}`);
    values.push(filters.pipelineStatus);
  }

  if (filters.visibilityStatus) {
    conditions.push(`visibility_status = $${index++}`);
    values.push(filters.visibilityStatus);
  }

  if (filters.assignedToUserId) {
    conditions.push(`assigned_to_user_id = $${index++}`);
    values.push(filters.assignedToUserId);
  }

  if (filters.source) {
    conditions.push(`source = $${index++}`);
    values.push(filters.source);
  }

  if (filters.intakeChannel) {
    conditions.push(`intake_channel = $${index++}`);
    values.push(filters.intakeChannel);
  }

  if (filters.search) {
    conditions.push(`(
      patient_name ILIKE $${index}
      OR phone ILIKE $${index}
      OR email::text ILIKE $${index}
      OR COALESCE(service_requested, '') ILIKE $${index}
    )`);
    values.push(`%${filters.search}%`);
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email::text AS email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id,
      first_contact_at,
      last_contact_at,
      next_followup_at,
      archived_at,
      archived_by_user_id,
      archived_reason,
      created_at,
      updated_at
    FROM leads
    ${whereClause}
    ORDER BY created_at DESC, id DESC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findLeadById(leadId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email::text AS email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id,
      first_contact_at,
      last_contact_at,
      next_followup_at,
      archived_at,
      archived_by_user_id,
      archived_reason,
      created_at,
      updated_at
    FROM leads
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [leadId], client);
  return result.rows[0] || null;
}

async function findLeadsByIds(leadIds = [], client = null) {
  if (!Array.isArray(leadIds) || !leadIds.length) {
    return [];
  }

  const normalizedLeadIds = [...new Set(leadIds.map((id) => Number(id)).filter(Boolean))];

  if (!normalizedLeadIds.length) {
    return [];
  }

  const query = `
    SELECT
      id,
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email::text AS email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id,
      first_contact_at,
      last_contact_at,
      next_followup_at,
      archived_at,
      archived_by_user_id,
      archived_reason,
      created_at,
      updated_at
    FROM leads
    WHERE id = ANY($1::int[])
    ORDER BY
      CASE WHEN visibility_status = 'active' THEN 0 ELSE 1 END,
      created_at DESC,
      id DESC
  `;

  const result = await db.query(query, [normalizedLeadIds], client);
  return result.rows;
}

async function createLead(input, client = null) {
  const query = `
    INSERT INTO leads (
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13)
    RETURNING
      id,
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email::text AS email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id,
      first_contact_at,
      last_contact_at,
      next_followup_at,
      archived_at,
      archived_by_user_id,
      archived_reason,
      created_at,
      updated_at
  `;

  const values = [
    input.clinicId,
    input.publicFormId || null,
    input.patientName,
    input.phone,
    input.email,
    input.source,
    input.intakeChannel,
    input.serviceRequested || null,
    input.notes || null,
    input.preferredAppointmentAt || null,
    input.pipelineStatus,
    input.assignedToUserId || null,
    input.createdByUserId || null,
  ];

  const result = await db.query(query, values, client);
  return result.rows[0];
}

async function updateLead(leadId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    patientName: 'patient_name',
    phone: 'phone',
    email: 'email',
    source: 'source',
    intakeChannel: 'intake_channel',
    serviceRequested: 'service_requested',
    notes: 'notes',
    preferredAppointmentAt: 'preferred_appointment_at',
    pipelineStatus: 'pipeline_status',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(updates, 'pipelineStatus')) {
    fields.push(`last_contact_at = CASE
      WHEN $${index - 1} = 'contacted' THEN NOW()
      ELSE last_contact_at
    END`);
    fields.push(`first_contact_at = CASE
      WHEN $${index - 1} = 'contacted' AND first_contact_at IS NULL THEN NOW()
      ELSE first_contact_at
    END`);
  }

  if (!fields.length) {
    return findLeadById(leadId, client);
  }

  values.push(leadId);

  const query = `
    UPDATE leads
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING
      id,
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email::text AS email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id,
      first_contact_at,
      last_contact_at,
      next_followup_at,
      archived_at,
      archived_by_user_id,
      archived_reason,
      created_at,
      updated_at
  `;

  const result = await db.query(query, values, client);
  return result.rows[0] || null;
}

async function updateLeadAssignment(leadId, assignedToUserId, client = null) {
  const query = `
    UPDATE leads
    SET assigned_to_user_id = $2
    WHERE id = $1
    RETURNING
      id,
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email::text AS email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id,
      first_contact_at,
      last_contact_at,
      next_followup_at,
      archived_at,
      archived_by_user_id,
      archived_reason,
      created_at,
      updated_at
  `;

  const result = await db.query(query, [leadId, assignedToUserId], client);
  return result.rows[0] || null;
}

async function archiveLead(leadId, archivedByUserId, reason, client = null) {
  const query = `
    UPDATE leads
    SET
      visibility_status = 'archived',
      archived_at = NOW(),
      archived_by_user_id = $2,
      archived_reason = $3
    WHERE id = $1
    RETURNING
      id,
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email::text AS email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id,
      first_contact_at,
      last_contact_at,
      next_followup_at,
      archived_at,
      archived_by_user_id,
      archived_reason,
      created_at,
      updated_at
  `;

  const result = await db.query(query, [leadId, archivedByUserId, reason || null], client);
  return result.rows[0] || null;
}

async function unarchiveLead(leadId, client = null) {
  const query = `
    UPDATE leads
    SET
      visibility_status = 'active',
      archived_at = NULL,
      archived_by_user_id = NULL,
      archived_reason = NULL
    WHERE id = $1
    RETURNING
      id,
      clinic_id,
      public_form_id,
      patient_name,
      phone,
      email::text AS email,
      source,
      intake_channel,
      service_requested,
      notes,
      preferred_appointment_at,
      pipeline_status,
      visibility_status,
      assigned_to_user_id,
      created_by_user_id,
      first_contact_at,
      last_contact_at,
      next_followup_at,
      archived_at,
      archived_by_user_id,
      archived_reason,
      created_at,
      updated_at
  `;

  const result = await db.query(query, [leadId], client);
  return result.rows[0] || null;
}

async function findActiveAssignableUser(userId, clinicId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      full_name,
      role,
      status
    FROM users
    WHERE id = $1
      AND clinic_id = $2
      AND status = 'active'
      AND role IN ('owner', 'receptionist')
    LIMIT 1
  `;

  const result = await db.query(query, [userId, clinicId], client);
  return result.rows[0] || null;
}

async function findClinicArchiveSetting(clinicId, client = null) {
  const query = `
    SELECT receptionist_can_archive_leads
    FROM clinic_settings
    WHERE clinic_id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0] || null;
}

async function listDuplicateWarnings(clinicId, client = null) {
  const query = `
    SELECT
      clinic_id,
      clinic_name,
      normalized_phone,
      lead_count,
      active_lead_count,
      archived_lead_count,
      lead_ids
    FROM v_clinic_duplicate_phone_warnings
    WHERE clinic_id = $1
    ORDER BY lead_count DESC, normalized_phone ASC
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows;
}

module.exports = {
  listLeads,
  findLeadById,
  findLeadsByIds,
  createLead,
  updateLead,
  updateLeadAssignment,
  archiveLead,
  unarchiveLead,
  findActiveAssignableUser,
  findClinicArchiveSetting,
  listDuplicateWarnings,
};