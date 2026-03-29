const db = require('../../db');

function sanitizeUserRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinic_id: row.clinic_id,
    clinic_name: row.clinic_name,
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
      u.id,
      u.clinic_id,
      c.name AS clinic_name,
      u.full_name,
      u.email::text AS email,
      u.phone,
      u.role,
      u.status,
      u.must_reset_password,
      u.last_login_at,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN clinics c ON c.id = u.clinic_id
    WHERE lower(u.email::text) = lower($1)
      AND u.password_hash = crypt($2, u.password_hash)
    LIMIT 1
  `;

  const result = await db.query(query, [email, password]);
  return sanitizeUserRow(result.rows[0] || null);
}

async function findUserSessionById(userId, client = null) {
  const query = `
    SELECT
      u.id,
      u.clinic_id,
      c.name AS clinic_name,
      u.full_name,
      u.email::text AS email,
      u.phone,
      u.role,
      u.status,
      u.must_reset_password,
      u.last_login_at,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN clinics c ON c.id = u.clinic_id
    WHERE u.id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [userId], client);
  return sanitizeUserRow(result.rows[0] || null);
}

async function findUserByEmail(email, client = null) {
  const query = `
    SELECT
      u.id,
      u.clinic_id,
      c.name AS clinic_name,
      u.full_name,
      u.email::text AS email,
      u.phone,
      u.role,
      u.status,
      u.must_reset_password,
      u.last_login_at,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN clinics c ON c.id = u.clinic_id
    WHERE lower(u.email::text) = lower($1)
    LIMIT 1
  `;

  const result = await db.query(query, [email], client);
  return sanitizeUserRow(result.rows[0] || null);
}

async function touchLastLogin(userId, client = null) {
  const query = `
    UPDATE users
    SET
      last_login_at = NOW(),
      updated_at = NOW()
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
    INNER JOIN users u ON u.id = ui.user_id
    LEFT JOIN clinics c ON c.id = ui.clinic_id
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

async function updateUserPassword(userId, password, client) {
  const query = `
    UPDATE users
    SET
      password_hash = crypt($2, gen_salt('bf')),
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

async function createPasswordResetToken({ userId, tokenHash, expiresAt }, client) {
  const query = `
    INSERT INTO password_reset_tokens (
      user_id,
      token_hash,
      reset_status,
      expires_at
    )
    VALUES ($1, $2, 'pending', $3)
    RETURNING
      id,
      user_id,
      token_hash,
      reset_status,
      expires_at,
      used_at,
      revoked_at,
      created_at
  `;

  const result = await db.query(query, [userId, tokenHash, expiresAt], client);
  return result.rows[0] || null;
}

async function findPasswordResetTokenByHash(tokenHash, client = null) {
  const query = `
    SELECT
      prt.id,
      prt.user_id,
      prt.token_hash,
      prt.reset_status,
      prt.expires_at,
      prt.used_at,
      prt.revoked_at,
      prt.created_at,
      u.status AS user_status,
      u.email::text AS email,
      u.full_name
    FROM password_reset_tokens prt
    INNER JOIN users u ON u.id = prt.user_id
    WHERE prt.token_hash = $1
    LIMIT 1
  `;

  const result = await db.query(query, [tokenHash], client);
  return result.rows[0] || null;
}

async function revokeActivePasswordResetTokensForUser(userId, client) {
  const query = `
    UPDATE password_reset_tokens
    SET
      reset_status = 'revoked',
      revoked_at = NOW()
    WHERE user_id = $1
      AND reset_status = 'pending'
      AND used_at IS NULL
      AND revoked_at IS NULL
  `;

  return db.query(query, [userId], client);
}

async function revokeOtherActivePasswordResetTokensForUser(userId, keepTokenId, client) {
  const query = `
    UPDATE password_reset_tokens
    SET
      reset_status = 'revoked',
      revoked_at = NOW()
    WHERE user_id = $1
      AND id <> $2
      AND reset_status = 'pending'
      AND used_at IS NULL
      AND revoked_at IS NULL
  `;

  return db.query(query, [userId, keepTokenId], client);
}

async function markPasswordResetTokenUsed(tokenId, client) {
  const query = `
    UPDATE password_reset_tokens
    SET
      reset_status = 'used',
      used_at = NOW()
    WHERE id = $1
  `;

  return db.query(query, [tokenId], client);
}

async function markPasswordResetTokenExpired(tokenId, client) {
  const query = `
    UPDATE password_reset_tokens
    SET
      reset_status = 'expired'
    WHERE id = $1
  `;

  return db.query(query, [tokenId], client);
}

module.exports = {
  verifyUserCredentials,
  findUserSessionById,
  findUserByEmail,
  touchLastLogin,
  findInviteByTokenHash,
  activateInvitedUser,
  updateUserPassword,
  markInviteAccepted,
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  revokeActivePasswordResetTokensForUser,
  revokeOtherActivePasswordResetTokensForUser,
  markPasswordResetTokenUsed,
  markPasswordResetTokenExpired,
};