const db = require('../../db');

async function listByClinicId(clinicId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      name,
      slug,
      is_default,
      is_active,
      success_message,
      created_at,
      updated_at
    FROM public_forms
    WHERE clinic_id = $1
    ORDER BY is_default DESC, id ASC
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows;
}

async function findById(formId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      name,
      slug,
      is_default,
      is_active,
      success_message,
      created_at,
      updated_at
    FROM public_forms
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [formId], client);
  return result.rows[0] || null;
}

async function findBySlug(slug, client = null) {
  const query = `
    SELECT
      pf.id,
      pf.clinic_id,
      pf.name,
      pf.slug,
      pf.is_default,
      pf.is_active,
      pf.success_message,
      pf.created_at,
      pf.updated_at,
      c.name AS clinic_name
    FROM public_forms pf
    INNER JOIN clinics c ON c.id = pf.clinic_id
    WHERE lower(pf.slug::text) = lower($1)
    LIMIT 1
  `;

  const result = await db.query(query, [slug], client);
  return result.rows[0] || null;
}

async function createForm(input, client = null) {
  const query = `
    INSERT INTO public_forms (
      clinic_id,
      name,
      slug,
      is_default,
      is_active,
      success_message
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      clinic_id,
      name,
      slug,
      is_default,
      is_active,
      success_message,
      created_at,
      updated_at
  `;

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.name,
      input.slug,
      input.isDefault,
      input.isActive,
      input.successMessage,
    ],
    client
  );

  return result.rows[0];
}

async function updateForm(formId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    name: 'name',
    successMessage: 'success_message',
    isActive: 'is_active',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (!fields.length) {
    return findById(formId, client);
  }

  values.push(formId);

  const query = `
    UPDATE public_forms
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING
      id,
      clinic_id,
      name,
      slug,
      is_default,
      is_active,
      success_message,
      created_at,
      updated_at
  `;

  const result = await db.query(query, values, client);
  return result.rows[0] || null;
}

async function findClinicSettings(clinicId, client = null) {
  const query = `
    SELECT
      public_form_auto_followup_enabled,
      public_form_followup_delay_hours
    FROM clinic_settings
    WHERE clinic_id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0] || null;
}

async function createLeadFromPublicForm(input, client = null) {
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
      created_by_user_id,
      next_followup_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      'public_form',
      'public_form',
      $6, $7, $8,
      'new',
      'active',
      NULL,
      NULL,
      $9
    )
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

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.publicFormId,
      input.patientName,
      input.phone,
      input.email,
      input.serviceRequested || null,
      input.notes || null,
      input.preferredAppointmentAt || null,
      input.nextFollowupAt || null,
    ],
    client
  );

  return result.rows[0];
}

async function createFollowupForLead(input, client = null) {
  const query = `
    INSERT INTO followups (
      clinic_id,
      lead_id,
      due_at,
      status,
      outcome,
      notes,
      created_by_user_id
    )
    VALUES ($1, $2, $3, 'pending', NULL, $4, NULL)
    RETURNING
      id,
      clinic_id,
      lead_id,
      due_at,
      status,
      outcome,
      notes,
      created_by_user_id,
      completed_by_user_id,
      created_at,
      completed_at
  `;

  const result = await db.query(
    query,
    [input.clinicId, input.leadId, input.dueAt, input.notes || null],
    client
  );

  return result.rows[0];
}

module.exports = {
  listByClinicId,
  findById,
  findBySlug,
  createForm,
  updateForm,
  findClinicSettings,
  createLeadFromPublicForm,
  createFollowupForLead,
};