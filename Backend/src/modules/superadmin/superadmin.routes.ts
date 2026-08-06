import express from 'express';
import { z } from 'zod';
import { superAdminAuthMiddleware } from '../../middleware/authenticateRequest';
import { superAdminService } from './superadmin.service';
import { subscriptionInvoiceService } from '../subscription/subscription-invoice.service';

const router = express.Router();

const handleError = (res: express.Response, error: any, next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
  }
  if (error.status) {
    return res.status(error.status).json({ error: error.error, message: error.message });
  }
  next(error);
};

// All routes require a global SUPER_ADMIN JWT (no bootstrap HTTP endpoint —
// the demo superadmin is created by the seed: npm run seed)
router.use(superAdminAuthMiddleware);

/** GET /api/superadmin/accounts?page=&limit=&q=&planId=&endsAfter=&endsBefore= */
router.get('/accounts', async (req, res, next) => {
  try {
    const querySchema = z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      q: z.string().optional(),
      planId: z.string().optional(),
      endsAfter: z.string().optional(),
      endsBefore: z.string().optional(),
    });
    const params = querySchema.parse(req.query);
    res.json(await superAdminService.listAccounts(params));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** POST /api/superadmin/accounts/:id/generate-invoice — generate a SUBSCRIPTION invoice for the account's active period */
router.post('/accounts/:id/generate-invoice', async (req, res, next) => {
  try {
    const result = await subscriptionInvoiceService.generateForAccount(req.params.id);
    res.status(201).json(result);
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** PATCH /api/superadmin/accounts/:id — activate/deactivate, force sub status + plan/period */
router.patch('/accounts/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      isActive: z.boolean().optional(),
      subscriptionStatus: z.enum(['NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
      planId: z.string().min(1).optional(),
      currentPeriodEnd: z.union([z.string().min(1), z.null()]).optional(),
    });
    const data = schema.parse(req.body);
    res.json(await superAdminService.updateAccount(req.params.id, data));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** GET /api/superadmin/plans */
router.get('/plans', async (req, res, next) => {
  try {
    res.json(await superAdminService.listPlans());
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** POST /api/superadmin/plans */
router.post('/plans', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      priceCents: z.number().int().positive(),
      currency: z.string().optional(),
      interval: z.enum(['month', 'year']).optional(),
      maxSalons: z.number().int().positive(),
      stripePriceId: z.string().optional(),
    });
    const data = schema.parse(req.body) as {
      name: string;
      priceCents: number;
      currency?: string;
      interval?: string;
      maxSalons: number;
      stripePriceId?: string;
    };
    res.status(201).json(await superAdminService.createPlan(data));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** PATCH /api/superadmin/plans/:id */
router.patch('/plans/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      priceCents: z.number().int().positive().optional(),
      currency: z.string().optional(),
      interval: z.enum(['month', 'year']).optional(),
      maxSalons: z.number().int().positive().optional(),
      stripePriceId: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    res.json(await superAdminService.updatePlan(req.params.id, data));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

export default router;
