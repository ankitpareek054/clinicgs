const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const validate = require('../../middlewares/validate.middleware');
const authMiddleware = require('../../middlewares/auth.middleware');
const notificationsController = require('./notifications.controller');
const {
  notificationIdParamSchema,
  listNotificationsQuerySchema,
} = require('./notifications.validators');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(notificationsController.listNotifications)
);

router.get(
  '/unread-count',
  asyncHandler(notificationsController.getUnreadCount)
);

router.patch(
  '/:notificationId/read',
  validate({ params: notificationIdParamSchema }),
  asyncHandler(notificationsController.markRead)
);

router.patch(
  '/read-all',
  asyncHandler(notificationsController.markAllRead)
);

module.exports = router;