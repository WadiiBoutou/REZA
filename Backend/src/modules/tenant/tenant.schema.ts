import { z } from 'zod';
import { optionalPhoneSchema } from '../../utils/phone';

export const createTenantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: optionalPhoneSchema,
  address: z.string().optional(),
  subdomain: z.string().optional(),
  domain: z.string().optional(),
  category: z.string().optional(),
  coverImage: z.string().optional(),
  shortDescription: z.string().optional(),
  website: z.string().optional(),
  city: z.string().optional(),
  googleMapsLink: z.string().url().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  tags: z.array(z.string()).optional()
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
