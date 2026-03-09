const { z } = require('zod');

const appointmentIdParamSchema = z.object({
  appointmentId: z.coerce.number().int().positive(),
});

const listAppointmentsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive().optional(),
  status: z.enum(['booked', 'rescheduled', 'completed', 'no_show', 'cancelled']).optional(),
});

const createAppointmentSchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  leadId: z.coerce.number().int().positive(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: z.enum(['booked', 'rescheduled', 'completed', 'no_show', 'cancelled']).optional(),
  notes: z.string().trim().nullable().optional(),
});

const updateAppointmentSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  status: z.enum(['booked', 'rescheduled', 'completed', 'no_show', 'cancelled']).optional(),
  notes: z.string().trim().nullable().optional(),
});

module.exports = {
  appointmentIdParamSchema,
  listAppointmentsQuerySchema,
  createAppointmentSchema,
  updateAppointmentSchema,
};