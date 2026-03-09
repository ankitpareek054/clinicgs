const db = require('../../db');

async function listRequests(filters = {}, client = null) {
  const values = [];
  const conditions = [];
  let index = 1;

  if (filters.clinicId !== undefined && filters.clinicId !== null) {
    conditions.push(`scr.clinic_id = $${index++}`);
    values.push(filters.clinicId);
  }

  if (filters.status) {
    conditions.push(`scr.status = $${index++}`);
    values.push(filters.status);
  }

  if (filters.requestType) {
    conditions.push(`scr.request_type = $${index++}`);
    values.push(filters.requestType);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      scr.id,
      scr.clinic_id,
      scr.requested_by_user_id,
      scr.request_type,
      scr.target_user_id,
      scr.target_name,
      scr.target_email::text AS target_email,
      scr.target_phone,
      scr.target_role,
      scr.request_note,
      scr.status,
      scr.admin_note,
      scr.approved_by_user_id,
      scr.approved_at,
      scr.created_at,
      c.name AS clinic_name,
      u.full_name AS requested_by_name
    FROM staff_change_requests scr
    INNER JOIN clinics c ON c.id = scr.clinic_id
    INNER JOIN users u ON u.id = scr.requested_by_user_id
    ${whereClause}
    ORDER BY scr.created_at DESC, scr.id DESC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findRequestById(requestId, client = null) {
  const query = `
    SELECT
      scr.id,
      scr.clinic_id,
      scr.requested_by_user_id,
      scr.request_type,
      scr.target_user_id,
      scr.target_name,
      scr.target_email::text AS target_email,
      scr.target_phone,
      scr.target_role,
      scr.request_note,
      scr.status,
      scr.admin_note,
      scr.approved_by_user_id,
      scr.approved_at,
      scr.created_at
    FROM staff_change_requests scr
    WHERE scr.id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [requestId], client);
  return result.rows[0] || null;
}

async function createRequest(input, client = null) {
  const query = `
    INSERT INTO staff_change_requests (
      clinic_id,
      requested_by_user_id,
      request_type,
      target_user_id,
      target_name,
      target_email,
      target_phone,
      target_role,
      request_note,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
    RETURNING
      id,
      clinic_id,
      requested_by_user_id,
      request_type,
      target_user_id,
      target_name,
      target_email::text AS target_email,
      target_phone,
      target_role,
      request_note,
      status,
      admin_note,
      approved_by_user_id,
      approved_at,
      created_at
  `;

  const values = [
    input.clinicId,
    input.requestedByUserId,
    input.requestType,
    input.targetUserId || null,
    input.targetName,
    input.targetEmail || null,
    input.targetPhone || null,
    input.targetRole || null,
    input.requestNote || null,
  ];

  const result = await db.query(query, values, client);
  return result.rows[0];
}

async function updateDecision(requestId, input, client = null) {
  const query = `
    UPDATE staff_change_requests
    SET
      status = $2,
      admin_note = $3,
      approved_by_user_id = $4,
      approved_at = NOW(),
      target_user_id = COALESCE($5, target_user_id)
    WHERE id = $1
    RETURNING
      id,
      clinic_id,
      requested_by_user_id,
      request_type,
      target_user_id,
      target_name,
      target_email::text AS target_email,
      target_phone,
      target_role,
      request_note,
      status,
      admin_note,
      approved_by_user_id,
      approved_at,
      created_at
  `;

  const result = await db.query(
    query,
    [
      requestId,
      input.status,
      input.adminNote || null,
      input.approvedByUserId,
      input.targetUserId || null,
    ],
    client
  );

  return result.rows[0] || null;
}

async function findUserById(userId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      full_name,
      email::text AS email,
      phone,
      role,
      status,
      must_reset_password,
      created_at
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [userId], client);
  return result.rows[0] || null;
}

async function createPendingUser(input, client = null) {
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
      $4,
      $5,
      crypt($6, gen_salt('bf')),
      TRUE,
      'pending_invite'
    )
    RETURNING
      id,
      clinic_id,
      full_name,
      email::text AS email,
      phone,
      role,
      status,
      must_reset_password,
      created_at
  `;

  const result = await db.query(
    query,
    [
      input.clinicId,
      input.fullName,
      input.email,
      input.phone || null,
      input.role,
      input.temporaryPassword,
    ],
    client
  );

  return result.rows[0];
}

async function createInvite(input, client = null) {
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

async function deactivateOwnerAsRemoved(input, client = null) {
  const query = `
    UPDATE users
    SET
      status = 'inactive',
      deactivated_at = NOW(),
      removed_at = NOW(),
      removed_by_user_id = $2,
      removal_reason = $3
    WHERE id = $1
    RETURNING
      id,
      clinic_id,
      full_name,
      email::text AS email,
      phone,
      role,
      status,
      deactivated_at,
      removed_at,
      removed_by_user_id,
      removal_reason,
      created_at,
      updated_at
  `;

  const result = await db.query(
    query,
    [
      input.userId,
      input.removedByUserId,
      input.removalReason || 'Owner removal approved by super admin',
    ],
    client
  );

  return result.rows[0] || null;
}

module.exports = {
  listRequests,
  findRequestById,
  createRequest,
  updateDecision,
  findUserById,
  createPendingUser,
  createInvite,
  deactivateOwnerAsRemoved,
};