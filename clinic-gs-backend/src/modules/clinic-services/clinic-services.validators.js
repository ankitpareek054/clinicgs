const { z } = require('zod');

const clinicIdParamSchema = z.object({
  clinicId: z.coerce.number().int().positive(),
});

const serviceIdParamSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
});

const createClinicServiceSchema = z.object({
  serviceName: z.string().trim().min(2),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateClinicServiceSchema = z.object({
  serviceName: z.string().trim().min(2).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  clinicIdParamSchema,
  serviceIdParamSchema,
  createClinicServiceSchema,
  updateClinicServiceSchema,
};