const { z } = require('zod');

const leadIdParamSchema = z.object({
  leadId: z.coerce.number().int().positive(),
});

const listLeadsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  pipelineStatus: z
    .enum([
      'new',
      'contacted',
      'booked',
      'rescheduled',
      'completed',
      'review_pending',
      'no_show',
      'not_interested',
      'cancelled',
    ])
    .optional(),
  visibilityStatus: z.enum(['active', 'archived']).optional(),
  assignedToUserId: z.coerce.number().int().positive().optional(),
  source: z.string().trim().optional(),
  intakeChannel: z.enum(['manual', 'public_form', 'import', 'api']).optional(),
  search: z.string().trim().optional(),
});

const createLeadSchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  patientName: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  email: z.string().trim().email(),
  source: z.string().trim().min(2),
  intakeChannel: z.enum(['manual', 'public_form', 'import', 'api']).optional(),
  serviceRequested: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  preferredAppointmentAt: z.string().datetime().nullable().optional(),
  pipelineStatus: z
    .enum([
      'new',
      'contacted',
      'booked',
      'rescheduled',
      'completed',
      'review_pending',
      'no_show',
      'not_interested',
      'cancelled',
    ])
    .optional(),
  assignedToUserId: z.coerce.number().int().positive().nullable().optional(),
});

const updateLeadSchema = z.object({
  patientName: z.string().trim().min(2).optional(),
  phone: z.string().trim().min(6).optional(),
  email: z.string().trim().email().optional(),
  source: z.string().trim().min(2).optional(),
  intakeChannel: z.enum(['manual', 'public_form', 'import', 'api']).optional(),
  serviceRequested: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  preferredAppointmentAt: z.string().datetime().nullable().optional(),
  pipelineStatus: z.enum([
    'new',
    'contacted',
    'booked',
    'rescheduled',
    'completed',
    'review_pending',
    'no_show',
    'not_interested',
    'cancelled',
  ]).optional(),
});

const reassignLeadSchema = z.object({
  assignedToUserId: z.coerce.number().int().positive().nullable(),
});

const archiveLeadSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
});

const duplicateWarningsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
});

module.exports = {
  leadIdParamSchema,
  listLeadsQuerySchema,
  createLeadSchema,
  updateLeadSchema,
  reassignLeadSchema,
  archiveLeadSchema,
  duplicateWarningsQuerySchema,
};