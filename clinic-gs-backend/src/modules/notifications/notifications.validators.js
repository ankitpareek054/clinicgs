const { z } = require('zod');

const notificationIdParamSchema = z.object({
  notificationId: z.coerce.number().int().positive(),
});

const listNotificationsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  isRead: z.coerce.boolean().optional(),
});

module.exports = {
  notificationIdParamSchema,
  listNotificationsQuerySchema,
};