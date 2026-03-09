const db = require('../../db');

async function findClinicById(clinicId, client = null) {
  const query = `
    SELECT
      id,
      name,
      slug,
      clinic_type,
      phone,
      email::text AS email,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      timezone,
      status,
      deactivated_at,
      created_at,
      updated_at
    FROM clinics
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0] || null;
}

async function listClinics(filters = {}, client = null) {
  const values = [];
  const conditions = [];
  let index = 1;

  if (filters.status) {
    conditions.push(`status = $${index++}`);
    values.push(filters.status);
  }

  if (filters.search) {
    conditions.push(`(
      name ILIKE $${index}
      OR COALESCE(email::text, '') ILIKE $${index}
      OR phone ILIKE $${index}
      OR COALESCE(city, '') ILIKE $${index}
      OR COALESCE(state, '') ILIKE $${index}
    )`);
    values.push(`%${filters.search}%`);
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      name,
      slug,
      clinic_type,
      phone,
      email::text AS email,
      city,
      state,
      country,
      timezone,
      status,
      created_at,
      updated_at
    FROM clinics
    ${whereClause}
    ORDER BY id ASC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findClinicBySlug(slug, client = null) {
  const query = `
    SELECT id, name, slug
    FROM clinics
    WHERE lower(slug::text) = lower($1)
    LIMIT 1
  `;

  const result = await db.query(query, [slug], client);
  return result.rows[0] || null;
}

async function createClinic(input, client) {
  const query = `
    INSERT INTO clinics (
      name,
      slug,
      clinic_type,
      phone,
      email,
      city,
      state,
      timezone,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'onboarding')
    RETURNING
      id,
      name,
      slug,
      clinic_type,
      phone,
      email::text AS email,
      city,
      state,
      country,
      timezone,
      status,
      created_at,
      updated_at
  `;

  const values = [
    input.name,
    input.slug,
    input.clinicType || null,
    input.phone,
    input.clinicEmail || null,
    input.city || null,
    input.state || null,
    input.timezone || 'Asia/Kolkata',
  ];

  const result = await db.query(query, values, client);
  return result.rows[0];
}

async function createOwnerUser(input, client) {
  const query = `
    INSERT INTO users (
      clinic_id,
      full_name,
      email,
      phone,
      role,
      password_hash,
      must_reset_password,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      NULL,
      'owner',
      crypt($4, gen_salt('bf')),
      TRUE,
      'pending_invite'
    )
    RETURNING
      id,
      clinic_id,
      full_name,
      email::text AS email,
      role,
      status,
      must_reset_password,
      created_at
  `;

  const result = await db.query(
    query,
    [input.clinicId, input.ownerFullName, input.ownerEmail, input.temporaryPassword],
    client
  );

  return result.rows[0];
}

async function createUserInvite(input, client) {
  const query = `
    INSERT INTO user_invites (
      clinic_id,
      user_id,
      email,
      role,
      token_hash,
      invite_status,
      expires_at,
      sent_at,
      created_by_user_id
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      'pending',
      $6,
      NOW(),
      $7
    )
    RETURNING
      id,
      clinic_id,
      user_id,
      email::text AS email,
      role,
      invite_status,
      expires_at,
      sent_at,
      created_by_user_id,
      created_at
  `;

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.userId,
      input.email,
      input.role,
      input.tokenHash,
      input.expiresAt,
      input.createdByUserId,
    ],
    client
  );

  return result.rows[0];
}

async function createDefaultClinicSettings(clinicId, client) {
  const query = `
    INSERT INTO clinic_settings (
      clinic_id
    )
    VALUES ($1)
    RETURNING id, clinic_id
  `;

  const result = await db.query(query, [clinicId], client);
  return result.rows[0];
}

async function createDefaultClinicIntegration(clinicId, ownerEmail, client) {
  const query = `
    INSERT INTO clinic_integrations (
      clinic_id,
      owner_report_email,
      integration_status
    )
    VALUES ($1, $2, 'not_configured')
    RETURNING id, clinic_id
  `;

  const result = await db.query(query, [clinicId, ownerEmail], client);
  return result.rows[0];
}

async function createDefaultPublicForm(input, client) {
  const query = `
    INSERT INTO public_forms (
      clinic_id,
      name,
      slug,
      is_default,
      is_active,
      success_message
    )
    VALUES ($1, $2, $3, TRUE, TRUE, $4)
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
    [input.clinicId, input.name, input.slug, input.successMessage],
    client
  );

  return result.rows[0];
}

async function createDefaultMessageTemplates(clinicId, clinicName, client) {
  const query = `
    INSERT INTO message_templates (
      clinic_id,
      template_key,
      channel,
      language_code,
      subject,
      body,
      is_active
    )
    VALUES
      ($1, 'first_contact', 'whatsapp', 'en', NULL, $2, TRUE),
      ($1, 'appointment_confirmation', 'whatsapp', 'en', NULL, $3, TRUE),
      ($1, 'review_request', 'whatsapp', 'en', NULL, $4, TRUE)
  `;

  const firstContact = `Hi {{patient_name}}, this is ${clinicName}. We received your enquiry and will contact you shortly.`;
  const appointmentConfirmation = `Hi {{patient_name}}, your appointment at ${clinicName} is booked for {{appointment_time}}.`;
  const reviewRequest = `Hi {{patient_name}}, thank you for visiting ${clinicName}. Please share your review here: {{review_link}}`;

  await db.query(query, [clinicId, firstContact, appointmentConfirmation, reviewRequest], client);
}

async function updateClinicProfile(clinicId, updates, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  const mapping = {
    name: 'name',
    clinicType: 'clinic_type',
    phone: 'phone',
    email: 'email',
    addressLine1: 'address_line_1',
    addressLine2: 'address_line_2',
    city: 'city',
    state: 'state',
    country: 'country',
    timezone: 'timezone',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${column} = $${index++}`);
      values.push(updates[key]);
    }
  });

  if (!fields.length) {
    return findClinicById(clinicId, client);
  }

  values.push(clinicId);

  const query = `
    UPDATE clinics
    SET
      ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING
      id,
      name,
      slug,
      clinic_type,
      phone,
      email::text AS email,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      timezone,
      status,
      deactivated_at,
      created_at,
      updated_at
  `;

  const result = await db.query(query, values, client);
  return result.rows[0] || null;
}

async function updateClinicStatus(clinicId, status, client = null) {
  const query = `
    UPDATE clinics
    SET
      status = $1,
      deactivated_at = CASE WHEN $1 = 'inactive' THEN NOW() ELSE NULL END
    WHERE id = $2
    RETURNING
      id,
      name,
      slug,
      clinic_type,
      phone,
      email::text AS email,
      city,
      state,
      country,
      timezone,
      status,
      deactivated_at,
      created_at,
      updated_at
  `;

  const result = await db.query(query, [status, clinicId], client);
  return result.rows[0] || null;
}

module.exports = {
  findClinicById,
  listClinics,
  findClinicBySlug,
  createClinic,
  createOwnerUser,
  createUserInvite,
  createDefaultClinicSettings,
  createDefaultClinicIntegration,
  createDefaultPublicForm,
  createDefaultMessageTemplates,
  updateClinicProfile,
  updateClinicStatus,
};