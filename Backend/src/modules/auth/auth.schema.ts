import { z } from 'zod';
import { requiredPhoneSchema, optionalPhoneSchema } from '../../utils/phone';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: requiredPhoneSchema,
  avatar: z.string().optional(),
  tenantId: z.string().min(1, 'Tenant ID is required for registration').optional(),
  createTenant: z.boolean().optional(),
  tenantName: z.string().min(1).optional(),
  tenantEmail: z.string().email().optional(),
  tenantPhone: optionalPhoneSchema,
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

export const sendPasswordCodeSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
});

export const changePasswordSchema = z.object({
  code: z.string().min(4, 'Le code de vérification est requis'),
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SendPasswordCodeInput = z.infer<typeof sendPasswordCodeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
