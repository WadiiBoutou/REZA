import { z } from 'zod';

export const createClientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(1),
  address: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  avatar: z.string().nullable().optional(),
  dateOfBirth: z.string().datetime().optional(),
  notes: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional()
});

export const updateClientSchema = createClientSchema.partial();
