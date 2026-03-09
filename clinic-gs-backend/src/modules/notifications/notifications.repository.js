const db = require('../../db');

async function listNotifications(filters = {}, client = null) {
  const values = [];
  const conditions = [];
  let index = 1;

  if (filters.clinicId !== undefined && filters.clinicId !== null) {
    conditions.push(`clinic_id = $${index++}`);
    values.push(filters.clinicId);
  }

  if (filters.userId !== undefined && filters.userId !== null) {
    conditions.push(`user_id = $${index++}`);
    values.push(filters.userId);
  }

  if (filters.isRead !== undefined) {
    conditions.push(`is_read = $${index++}`);
    values.push(filters.isRead);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      clinic_id,
      user_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      is_read,
      read_at,
      created_at
    FROM notifications
    ${whereClause}
    ORDER BY created_at DESC, id DESC
  `;

  const result = await db.query(query, values, client);
  return result.rows;
}

async function findById(notificationId, client = null) {
  const query = `
    SELECT
      id,
      clinic_id,
      user_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      is_read,
      read_at,
      created_at
    FROM notifications
    WHERE id = $1
    LIMIT 1
  `;

  const result = await db.query(query, [notificationId], client);
  return result.rows[0] || null;
}

async function markRead(notificationId, client = null) {
  const query = `
    UPDATE notifications
    SET
      is_read = TRUE,
      read_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      clinic_id,
      user_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      is_read,
      read_at,
      created_at
  `;

  const result = await db.query(query, [notificationId], client);
  return result.rows[0] || null;
}

async function markAllReadForUser(userId, client = null) {
  const query = `
    UPDATE notifications
    SET
      is_read = TRUE,
      read_at = NOW()
    WHERE user_id = $1
      AND is_read = FALSE
  `;

  const result = await db.query(query, [userId], client);
  return result.rowCount || 0;
}

async function getUnreadCount(userId, client = null) {
  const query = `
    SELECT COUNT(*)::int AS unread_count
    FROM notifications
    WHERE user_id = $1
      AND is_read = FALSE
  `;

  const result = await db.query(query, [userId], client);
  return result.rows[0]?.unread_count || 0;
}

module.exports = {
  listNotifications,
  findById,
  markRead,
  markAllReadForUser,
  getUnreadCount,
};