const { z } = require('zod');

const clinicIdParamSchema = z.object({
  clinicId: z.coerce.number().int().positive(),
});

const formIdParamSchema = z.object({
  formId: z.coerce.number().int().positive(),
});

const publicSlugParamSchema = z.object({
  slug: z.string().trim().min(2),
});

const createPublicFormSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(2).optional(),
  successMessage: z.string().trim().min(2).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const updatePublicFormSchema = z.object({
  name: z.string().trim().min(2).optional(),
  successMessage: z.string().trim().min(2).optional(),
  isActive: z.boolean().optional(),
});

const submitPublicFormSchema = z.object({
  patientName: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  email: z.string().trim().email(),
  serviceRequested: z.string().trim().nullable().optional(),
  preferredAppointmentAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

module.exports = {
  clinicIdParamSchema,
  formIdParamSchema,
  publicSlugParamSchema,
  createPublicFormSchema,
  updatePublicFormSchema,
  submitPublicFormSchema,
};