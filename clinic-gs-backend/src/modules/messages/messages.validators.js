const { z } = require('zod');

const messageLogIdParamSchema = z.object({
  messageLogId: z.coerce.number().int().positive(),
});

const listMessagesQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive().optional(),
  appointmentId: z.coerce.number().int().positive().optional(),
  channel: z.enum(['whatsapp', 'email', 'sms', 'call', 'system']).optional(),
  status: z.enum(['sent', 'failed', 'manual_needed', 'pending']).optional(),
});

const createMessageLogSchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive().nullable().optional(),
  appointmentId: z.coerce.number().int().positive().nullable().optional(),
  channel: z.enum(['whatsapp', 'email', 'sms', 'call', 'system']),
  templateName: z.string().trim().max(200).nullable().optional(),
  recipient: z.string().trim().max(255).nullable().optional(),
  status: z.enum(['sent', 'failed', 'manual_needed', 'pending']),
  errorMessage: z.string().trim().max(2000).nullable().optional(),
});

module.exports = {
  messageLogIdParamSchema,
  listMessagesQuerySchema,
  createMessageLogSchema,
};