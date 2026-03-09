const db = require('../../db');

function sanitizeUserRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinic_id: row.clinic_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    must_reset_password: row.must_reset_password,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function verifyUserCredentials(email, password) {
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
      last_login_at,
      created_at,
      updated_at
    FROM users
    WHERE lower(email::text) = lower($1)
      AND password_hash = crypt($2, password_hash)
    LIMIT 1
  `;

  const result = await db.query(query, [email, password]);
  return sanitizeUserRow(result.rows[0] || null);
}

async function findUserSessionById(userId) {
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
      last_login_at,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [userId]);
  return sanitizeUserRow(result.rows[0] || null);
}

async function touchLastLogin(userId, client = null) {
  const query = `
    UPDATE users
    SET last_login_at = NOW()
    WHERE id = $1
  `;

  return db.query(query, [userId], client);
}

async function findInviteByTokenHash(tokenHash, client = null) {
  const query = `
    SELECT
      ui.id,
      ui.clinic_id,
      ui.user_id,
      ui.email::text AS email,
      ui.role,
      ui.invite_status,
      ui.expires_at,
      ui.sent_at,
      ui.used_at,
      ui.created_by_user_id,
      u.full_name,
      u.status AS user_status,
      u.must_reset_password,
      c.name AS clinic_name,
      c.slug AS clinic_slug
    FROM user_invites ui
    INNER JOIN users u
      ON u.id = ui.user_id
    LEFT JOIN clinics c
      ON c.id = ui.clinic_id
    WHERE ui.token_hash = $1
    LIMIT 1
  `;

  const result = await db.query(query, [tokenHash], client);
  return result.rows[0] || null;
}

async function activateInvitedUser(userId, password, client) {
  const query = `
    UPDATE users
    SET
      password_hash = crypt($2, gen_salt('bf')),
      status = 'active',
      must_reset_password = FALSE,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      clinic_id,
      full_name,
      email::text AS email,
      phone,
      role,
      status,
      must_reset_password,
      last_login_at,
      created_at,
      updated_at
  `;

  const result = await db.query(query, [userId, password], client);
  return sanitizeUserRow(result.rows[0] || null);
}

async function markInviteAccepted(inviteId, client) {
  const query = `
    UPDATE user_invites
    SET
      invite_status = 'accepted',
      used_at = NOW()
    WHERE id = $1
  `;

  return db.query(query, [inviteId], client);
}

module.exports = {
  verifyUserCredentials,
  findUserSessionById,
  touchLastLogin,
  findInviteByTokenHash,
  activateInvitedUser,
  markInviteAccepted,
};