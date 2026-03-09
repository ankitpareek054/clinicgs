const db = require('../../db');

async function listUsers(filters = {}, client = null) {
  const values = [];
  const conditions = [];
  let index = 1;

  if (filters.clinicId !== undefined && filters.clinicId !== null) {
    conditions.push(`clinic_id = $${index++}`);
    values.push(filters.clinicId);
  }

  if (filters.role) {
    conditions.push(`role = $${index++}`);
    values.push(filters.role);
  }

  if (filters.status) {
    conditions.push(`status = $${index++}`);
    values.push(filters.status);
  }

  if (filters.search) {
    conditions.push(`(
      full_name ILIKE $${index}
      OR email::text ILIKE $${index}
      OR COALESCE(phone, '') ILIKE $${index}
    )`);
    values.push(`%${filters.search}%`);
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

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
      deactivated_at,
      removed_at,
      removed_by_user_id,
      removal_reason,
      created_at,
      updated_at
    FROM users
    ${whereClause}
    ORDER BY clinic_id ASC NULLS FIRST, id ASC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
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
      last_login_at,
      deactivated_at,
      removed_at,
      removed_by_user_id,
      removal_reason,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [userId], client);
  return result.rows[0] || null;
}

async function updateUserStatus(userId, input, client = null) {
  const query = `
    UPDATE users
    SET
      status = $2,
      deactivated_at = CASE WHEN $2 = 'inactive' THEN NOW() ELSE NULL END,
      removal_reason = CASE
        WHEN $2 = 'inactive' THEN COALESCE($3, removal_reason)
        ELSE removal_reason
      END
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
      deactivated_at,
      removed_at,
      removed_by_user_id,
      removal_reason,
      created_at,
      updated_at
  `;

  const result = await db.query(query, [userId, input.status, input.reason || null], client);
  return result.rows[0] || null;
}

async function unassignActiveLeadsFromUser(userId, clinicId, client = null) {
  const query = `
    UPDATE leads
    SET assigned_to_user_id = NULL
    WHERE clinic_id = $1
      AND assigned_to_user_id = $2
      AND visibility_status = 'active'
  `;

  const result = await db.query(query, [clinicId, userId], client);
  return result.rowCount || 0;
}

module.exports = {
  listUsers,
  findUserById,
  updateUserStatus,
  unassignActiveLeadsFromUser,
};