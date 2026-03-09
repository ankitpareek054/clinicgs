const { z } = require('zod');

const reviewIdParamSchema = z.object({
  reviewId: z.coerce.number().int().positive(),
});

const listReviewsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive().optional(),
  appointmentId: z.coerce.number().int().positive().optional(),
  reviewPosted: z.coerce.boolean().optional(),
});

const createReviewSchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive(),
  appointmentId: z.coerce.number().int().positive().nullable().optional(),
  feedbackRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  feedbackText: z.string().trim().max(2000).nullable().optional(),
  reviewLinkSentAt: z.string().datetime().nullable().optional(),
  reviewPosted: z.boolean().nullable().optional(),
});

const updateReviewSchema = z.object({
  feedbackRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  feedbackText: z.string().trim().max(2000).nullable().optional(),
  reviewLinkSentAt: z.string().datetime().nullable().optional(),
  reviewPosted: z.boolean().nullable().optional(),
});

module.exports = {
  reviewIdParamSchema,
  listReviewsQuerySchema,
  createReviewSchema,
  updateReviewSchema,
};