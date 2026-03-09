const { z } = require('zod');

const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const listUsersQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  role: z.enum(['super_admin', 'owner', 'receptionist']).optional(),
  status: z.enum(['active', 'inactive', 'pending_invite']).optional(),
  search: z.string().trim().optional(),
});

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
  reason: z.string().trim().max(500).nullable().optional(),
});

module.exports = {
  userIdParamSchema,
  listUsersQuerySchema,
  updateUserStatusSchema,
};