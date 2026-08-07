import express from 'express';
import { z } from 'zod';
import { superAdminAuthMiddleware } from '../../middleware/authenticateRequest';
import { superAdminService } from './superadmin.service';

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

/** GET /api/superadmin/accounts?page=&limit=&q= */
router.get('/accounts', async (req, res, next) => {
  try {
    const querySchema = z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      q: z.string().optional(),
    });
    const params = querySchema.parse(req.query);
    res.json(await superAdminService.listAccounts(params));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** PATCH /api/superadmin/accounts/:id — activate/deactivate, force sub status/period */
router.patch('/accounts/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      isActive: z.boolean().optional(),
      subscriptionStatus: z.enum(['NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
      currentPeriodEnd: z.union([z.string().min(1), z.null()]).optional(),
    });
    const data = schema.parse(req.body);
    res.json(await superAdminService.updateAccount(req.params.id, data));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** GET /api/superadmin/billing-config */
router.get('/billing-config', async (req, res, next) => {
  try {
    res.json(await superAdminService.getBillingConfig());
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** PUT /api/superadmin/billing-config */
router.put('/billing-config', async (req, res, next) => {
  try {
    const schema = z.object({
      pricePerSalon: z.number().min(0).optional(),
      freeEmployeeThreshold: z.number().int().min(0).optional(),
      pricePerEmployee: z.number().min(0).optional(),
      employeeTiers: z
        .array(z.object({
          min: z.number().int().min(1),
          max: z.number().int().min(1).nullable(),
          price: z.number().min(0),
        }))
        .nullish(),
      currency: z.string().min(1).max(8).optional(),
    });
    const data = schema.parse(req.body);
    res.json(await superAdminService.updateBillingConfig(data));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** GET /api/superadmin/payments?status=PENDING|APPROVED|REJECTED */
router.get('/payments', async (req, res, next) => {
  try {
    const querySchema = z.object({
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    });
    const { status } = querySchema.parse(req.query);
    res.json(await superAdminService.listPayments({ status }));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** POST /api/superadmin/payments/:id/approve */
router.post('/payments/:id/approve', async (req, res, next) => {
  try {
    res.json(await superAdminService.approvePayment(req.params.id, req.userId!));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** POST /api/superadmin/payments/:id/reject */
router.post('/payments/:id/reject', async (req, res, next) => {
  try {
    const schema = z.object({ reason: z.string().max(500).optional() });
    const { reason } = schema.parse(req.body ?? {});
    res.json(await superAdminService.rejectPayment(req.params.id, reason));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** GET /api/superadmin/notifications?unreadOnly=true&limit= */
router.get('/notifications', async (req, res, next) => {
  try {
    const querySchema = z.object({
      unreadOnly: z.enum(['true', 'false']).optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    });
    const { unreadOnly, limit } = querySchema.parse(req.query);
    res.json(await superAdminService.listSuperAdminNotifications(req.userId!, unreadOnly === 'true', limit));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** PATCH /api/superadmin/notifications/read-all */
router.patch('/notifications/read-all', async (req, res, next) => {
  try {
    res.json(await superAdminService.markAllSuperAdminNotificationsRead(req.userId!));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

/** PATCH /api/superadmin/notifications/:id/read */
router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    res.json(await superAdminService.markSuperAdminNotificationRead(req.userId!, req.params.id));
  } catch (error: any) {
    handleError(res, error, next);
  }
});

export default router;
