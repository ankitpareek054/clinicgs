const { z } = require('zod');

const clinicIdParamSchema = z.object({
  clinicId: z.coerce.number().int().positive(),
});

const createClinicSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  ownerFullName: z.string().trim().min(2),
  ownerEmail: z.string().trim().email(),

  clinicType: z.string().trim().min(2).optional().nullable(),
  clinicEmail: z.string().trim().email().optional().nullable(),
  city: z.string().trim().min(2).optional().nullable(),
  state: z.string().trim().min(2).optional().nullable(),
  timezone: z.string().trim().min(2).optional().nullable(),
});

const listClinicsQuerySchema = z.object({
  status: z
    .enum(['onboarding', 'trial', 'active', 'inactive', 'suspended'])
    .optional(),
  search: z.string().trim().optional(),
});

const updateClinicProfileSchema = z.object({
  name: z.string().trim().min(2).optional(),
  clinicType: z.string().trim().min(2).nullable().optional(),
  phone: z.string().trim().min(6).optional(),
  email: z.string().trim().email().nullable().optional(),
  addressLine1: z.string().trim().nullable().optional(),
  addressLine2: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  timezone: z.string().trim().nullable().optional(),
});

const updateClinicStatusSchema = z.object({
  status: z.enum(['onboarding', 'trial', 'active', 'inactive', 'suspended']),
});

module.exports = {
  clinicIdParamSchema,
  createClinicSchema,
  listClinicsQuerySchema,
  updateClinicProfileSchema,
  updateClinicStatusSchema,
};