import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  workingHours: z.any().optional(), // JSON object
  agendaSettings: z.any().optional(), // JSON object for agenda settings
  serviceIds: z.array(z.string()).optional() // Services this employee can provide
});

export const updateEmployeeSchema = createEmployeeSchema.partial();
