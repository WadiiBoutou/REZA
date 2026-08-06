import { z } from 'zod';

export const serviceItemSchema = z.object({
  serviceId: z.string(),
  employeeId: z.string().optional(),
});

const createAppointmentSchemaBase = z.object({
  clientId: z.string(),
  serviceId: z.string().optional(),
  serviceIds: z.array(z.string()).min(1).optional(),
  services: z.array(serviceItemSchema).min(1).optional(),
  employeeId: z.string().optional(),
  startTime: z.string().datetime(),
  duration: z.number().int().positive().optional(),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  source: z.enum(['ADMIN', 'PUBLIC']).optional(),
});

export const createAppointmentSchema = createAppointmentSchemaBase.refine((data) => data.serviceId || data.serviceIds?.length || data.services?.length, {
  message: 'At least one service is required',
  path: ['serviceIds'],
});

export const updateAppointmentSchema = createAppointmentSchemaBase.partial().extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
});

export const clientDiagnosticsSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  estimatedDuration: z.number().int().positive().optional(),
  tenantId: z.string().optional(),
});

export const planAppointmentSchema = z.object({
  serviceIds: z.array(z.string()).min(1),
  date: z.string(),
  startTime: z.string(),
  clientId: z.string().optional(),
  tenantId: z.string().optional(),
  assignments: z.array(z.object({
    serviceId: z.string(),
    employeeId: z.string().nullable(),
  })).optional(),
});

export const validateMoveSchema = z.object({
  startTime: z.string().datetime(),
  tenantId: z.string().optional(),
});
