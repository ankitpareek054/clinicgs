const { z } = require('zod');

const clinicIdParamSchema = z.object({
  clinicId: z.coerce.number().int().positive(),
});

const updateClinicSettingsSchema = z.object({
  defaultAppointmentDurationMins: z.coerce.number().int().positive().optional(),
  reminder24hEnabled: z.boolean().optional(),
  reminder2hEnabled: z.boolean().optional(),
  autoFollowupAfterNoShow: z.boolean().optional(),
  noShowFollowupDelayHours: z.coerce.number().int().positive().optional(),
  publicFormAutoFollowupEnabled: z.boolean().optional(),
  publicFormFollowupDelayHours: z.coerce.number().int().positive().optional(),
  recallIntervalDays: z.coerce.number().int().positive().optional(),
  reviewRequestEnabled: z.boolean().optional(),
  reviewRequestDelayHours: z.coerce.number().int().min(0).optional(),
  googleReviewLink: z.string().trim().url().nullable().optional(),
  messageTone: z.enum(['friendly', 'formal']).optional(),
  receptionistCanArchiveLeads: z.boolean().optional(),
  businessHoursJson: z.record(z.string(), z.string()).optional(),
});

module.exports = {
  clinicIdParamSchema,
  updateClinicSettingsSchema,
};