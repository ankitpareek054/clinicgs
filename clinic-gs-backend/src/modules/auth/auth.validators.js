const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const inviteTokenParamsSchema = z.object({
  token: z.string().trim().min(10),
});

const acceptInviteSchema = z
  .object({
    token: z.string().trim().min(10),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password and confirm password must match.',
    path: ['confirmPassword'],
  });

const requestPasswordResetSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(10),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password and confirm password must match.',
    path: ['confirmPassword'],
  });

module.exports = {
  loginSchema,
  inviteTokenParamsSchema,
  acceptInviteSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
};