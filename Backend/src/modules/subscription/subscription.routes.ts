import express from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/authenticateRequest';
import { subscriptionService } from './subscription.service';

const router = express.Router();

/**
 * GET /api/subscription
 * Billing overview: config, live bill, salon coverage, payment history.
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const result = await subscriptionService.getOverview(req.userId!);
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/subscription/declare-payment
 * Declare a virement payment for the current bill (amount defaults to the bill).
 */
router.post('/declare-payment', authMiddleware, async (req, res, next) => {
  try {
    const schema = z.object({
      amount: z.number().positive().optional(),
      reference: z.string().max(200).optional(),
      payerName: z.string().max(200).optional(),
    });
    const { amount, reference, payerName } = schema.parse(req.body ?? {});
    const result = await subscriptionService.declarePayment(req.userId!, { amount, reference, payerName });
    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/subscription/payments
 * Payment history for the account owner.
 */
router.get('/payments', authMiddleware, async (req, res, next) => {
  try {
    const result = await subscriptionService.listPayments(req.userId!);
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }
    next(error);
  }
});

export default router;
