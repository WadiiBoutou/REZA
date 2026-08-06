import { z } from 'zod';

export const createReviewSchema = z.object({
  clientId: z.string(),
  appointmentId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});

export const updateReviewStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PENDING']), // PENDING = unpublish/restore to moderation
  rejectReason: z.string().trim().optional()
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusSchema>;
