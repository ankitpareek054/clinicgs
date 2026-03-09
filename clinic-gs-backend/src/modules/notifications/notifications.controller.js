const { sendSuccess } = require('../../utils/api-response');
const notificationsService = require('./notifications.service');

async function listNotifications(req, res) {
  const data = await notificationsService.listNotifications(req.query, req.user);

  return sendSuccess(res, {
    message: 'Notifications fetched successfully.',
    data,
  });
}

async function markRead(req, res) {
  const data = await notificationsService.markRead(req.params.notificationId, req.user);

  return sendSuccess(res, {
    message: 'Notification marked as read.',
    data,
  });
}

async function markAllRead(req, res) {
  const data = await notificationsService.markAllRead(req.user);

  return sendSuccess(res, {
    message: 'All notifications marked as read.',
    data,
  });
}

async function getUnreadCount(req, res) {
  const data = await notificationsService.getUnreadCount(req.user);

  return sendSuccess(res, {
    message: 'Unread notification count fetched successfully.',
    data,
  });
}

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
};