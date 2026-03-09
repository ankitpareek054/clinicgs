const ApiError = require('../../utils/api-error');
const { ROLES } = require('../../config/constants');
const notificationsRepository = require('./notifications.repository');

function mapNotification(row) {
  if (!row) return null;

  return {
    id: row.id,
    clinicId: row.clinic_id,
    userId: row.user_id,
    notificationType: row.notification_type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function canAccessNotification(currentUser, notification) {
  if (currentUser.role === ROLES.SUPER_ADMIN) return true;
  return Number(currentUser.id) === Number(notification.user_id);
}

async function listNotifications(filters, currentUser) {
  const finalFilters = { ...filters };

  if (currentUser.role === ROLES.SUPER_ADMIN) {
    if (finalFilters.userId !== undefined) {
      finalFilters.userId = Number(finalFilters.userId);
    }
    if (finalFilters.clinicId !== undefined) {
      finalFilters.clinicId = Number(finalFilters.clinicId);
    }
  } else {
    finalFilters.userId = Number(currentUser.id);
    finalFilters.clinicId = Number(currentUser.clinicId);
  }

  const rows = await notificationsRepository.listNotifications(finalFilters);
  return rows.map(mapNotification);
}

async function markRead(notificationId, currentUser) {
  const existing = await notificationsRepository.findById(notificationId);

  if (!existing) {
    throw new ApiError(404, 'Notification not found.', {
      code: 'NOTIFICATION_NOT_FOUND',
    });
  }

  if (!canAccessNotification(currentUser, existing)) {
    throw new ApiError(403, 'Forbidden.', { code: 'FORBIDDEN' });
  }

  const updated = await notificationsRepository.markRead(notificationId);
  return mapNotification(updated);
}

async function markAllRead(currentUser) {
  const updatedCount = await notificationsRepository.markAllReadForUser(currentUser.id);
  return { updatedCount };
}

async function getUnreadCount(currentUser) {
  const unreadCount = await notificationsRepository.getUnreadCount(currentUser.id);
  return { unreadCount };
}

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
};