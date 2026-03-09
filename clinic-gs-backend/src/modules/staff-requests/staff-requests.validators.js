const { z } = require('zod');

const requestIdParamSchema = z.object({
  requestId: z.coerce.number().int().positive(),
});

const listStaffRequestsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  requestType: z.enum(['add_receptionist', 'add_owner', 'remove_owner']).optional(),
});

const createStaffRequestSchema = z.object({
  requestType: z.enum(['add_receptionist', 'add_owner', 'remove_owner']),
  targetUserId: z.coerce.number().int().positive().nullable().optional(),
  targetName: z.string().trim().min(2),
  targetEmail: z.string().trim().email().nullable().optional(),
  targetPhone: z.string().trim().nullable().optional(),
  targetRole: z.enum(['owner', 'receptionist']).nullable().optional(),
  requestNote: z.string().trim().max(1000).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.requestType === 'remove_owner') {
    if (!data.targetUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetUserId'],
        message: 'targetUserId is required for remove_owner request.',
      });
    }

    if (data.targetRole && data.targetRole !== 'owner') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetRole'],
        message: 'targetRole must be owner for remove_owner request.',
      });
    }
  }

  if (data.requestType === 'add_receptionist') {
    if (data.targetRole && data.targetRole !== 'receptionist') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetRole'],
        message: 'targetRole must be receptionist for add_receptionist request.',
      });
    }

    if (!data.targetEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetEmail'],
        message: 'targetEmail is required for add_receptionist request.',
      });
    }
  }

  if (data.requestType === 'add_owner') {
    if (data.targetRole && data.targetRole !== 'owner') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetRole'],
        message: 'targetRole must be owner for add_owner request.',
      });
    }

    if (!data.targetEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetEmail'],
        message: 'targetEmail is required for add_owner request.',
      });
    }
  }
});

const decideStaffRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  adminNote: z.string().trim().max(1000).nullable().optional(),
});

module.exports = {
  requestIdParamSchema,
  listStaffRequestsQuerySchema,
  createStaffRequestSchema,
  decideStaffRequestSchema,
};