const { z } = require('zod');

const clinicIdParamSchema = z.object({
  clinicId: z.coerce.number().int().positive(),
});

const updateClinicIntegrationSchema = z.object({
  googleCalendarId: z.string().trim().nullable().optional(),
  calendarSyncEnabled: z.boolean().optional(),
  makeWebhookUrl: z.string().trim().url().nullable().optional(),
  integrationStatus: z.enum(['not_configured', 'active', 'paused', 'error']).optional(),
  ownerReportEmail: z.string().trim().email().nullable().optional(),
  dailyOwnerReportEnabled: z.boolean().optional(),
  lastErrorMessage: z.string().trim().nullable().optional(),
});

module.exports = {
  clinicIdParamSchema,
  updateClinicIntegrationSchema,
};