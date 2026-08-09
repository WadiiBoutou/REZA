import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  tenantId: z.string().min(1, 'Tenant ID is required for registration').optional(),
  createTenant: z.boolean().optional(),
  tenantName: z.string().min(1).optional(),
  tenantEmail: z.string().email().optional(),
  tenantPhone: z.string().optional(),
  tenantAddress: z.string().optional(),
  tenantCity: z.string().optional(),
  tenantPostalCode: z.string().optional(),
  tenantCategory: z.string().optional(),
  businessType: z.string().optional(),
  hasCommercialLocal: z.string().optional()
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
