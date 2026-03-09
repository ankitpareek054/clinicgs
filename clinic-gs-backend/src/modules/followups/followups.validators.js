const { z } = require('zod');

const followupIdParamSchema = z.object({
  followupId: z.coerce.number().int().positive(),
});

const listFollowupsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive().optional(),
  status: z.enum(['pending', 'done', 'skipped']).optional(),
});

const createFollowupSchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive(),
  dueAt: z.string().datetime(),
  notes: z.string().trim().nullable().optional(),
  outcome: z.string().trim().nullable().optional(),
});

const updateFollowupSchema = z.object({
  dueAt: z.string().datetime().optional(),
  notes: z.string().trim().nullable().optional(),
  outcome: z.string().trim().nullable().optional(),
});

const updateFollowupStatusSchema = z.object({
  status: z.enum(['pending', 'done', 'skipped']),
  notes: z.string().trim().nullable().optional(),
  outcome: z.string().trim().nullable().optional(),
});

module.exports = {
  followupIdParamSchema,
  listFollowupsQuerySchema,
  createFollowupSchema,
  updateFollowupSchema,
  updateFollowupStatusSchema,
};