import { z } from 'zod';

const paymentMethodEnum = z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'ONLINE']);

/** Omit empty/null clientId so walk-in sales never look up "". */
const optionalClientId = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.string().min(1).optional()
);

export const createInvoiceSchema = z.object({
  clientId: optionalClientId,
  appointmentId: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  tax: z.number().min(0).default(0),
  paymentMethod: paymentMethodEnum.optional(),
  notes: z.string().optional()
});

export const createSaleSchema = z.object({
  clientId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string({ required_error: 'Client is required' }).min(1, 'Client is required')
  ),
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        price: z.number().positive().optional(),
        quantity: z.number().int().positive().default(1)
      })
    )
    .min(1, 'At least one service is required'),
  /** Override total; defaults to sum of item prices */
  amount: z.number().positive().optional(),
  tax: z.number().min(0).default(0),
  paymentMethod: paymentMethodEnum,
  notes: z.string().optional(),
  tenantId: z.string().optional(),
  /** Link sale to an appointment (unique on Invoice.appointmentId) */
  appointmentId: z.string().optional()
});

export const updateInvoiceSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'OVERDUE']).optional(),
  paymentMethod: paymentMethodEnum.optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional()
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
