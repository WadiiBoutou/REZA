import express from 'express';
import multer from 'multer';
import { authMiddleware, requireRole } from '../../middleware/authenticateRequest';
import { tenantController } from './tenant.controller';

const router = express.Router();

// Images are uploaded to Cloudinary (secure URL stored in DB). Multer only
// buffers the file in memory — nothing is written to local disk.
const memoryStorage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadHeaderImage = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// All routes below require authentication
router.use(authMiddleware);

/**
 * GET /api/tenant
 * Get current tenant information
 */
router.get('/', (req, res, next) => tenantController.getTenant(req, res, next));

/**
 * PUT /api/tenant
 * Update tenant information
 */
router.put('/', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) => tenantController.updateTenant(req, res, next));

/**
 * GET /api/tenant/settings
 * Get tenant settings
 */
router.get('/settings', (req, res, next) => tenantController.getTenantSettings(req, res, next));

/**
 * PUT /api/tenant/settings
 * Update tenant settings
 */
router.put('/settings', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) => tenantController.updateTenantSettings(req, res, next));

/**
 * GET /api/tenant/settings/appointment-display
 * Get appointment display settings
 */
router.get('/settings/appointment-display', (req, res, next) => tenantController.getAppointmentDisplaySettings(req, res, next));

/**
 * PUT /api/tenant/settings/appointment-display
 * Update appointment display settings
 */
router.put('/settings/appointment-display', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  tenantController.updateAppointmentDisplaySettings(req, res, next)
);

/**
 * GET /api/tenant/notifications/appointment-emails
 * Get appointment notification emails
 */
router.get('/notifications/appointment-emails', (req, res, next) => tenantController.getAppointmentNotificationEmails(req, res, next));

/**
 * PUT /api/tenant/notifications/appointment-emails
 * Update appointment notification emails
 */
router.put('/notifications/appointment-emails', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  tenantController.updateAppointmentNotificationEmails(req, res, next)
);

/**
 * GET /api/tenant/settings/business-hours
 * Get business hours
 */
router.get('/settings/business-hours', (req, res, next) => tenantController.getBusinessHours(req, res, next));

/**
 * PUT /api/tenant/settings/business-hours
 * Update business hours
 */
router.put('/settings/business-hours', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  tenantController.updateBusinessHours(req, res, next)
);

/**
 * GET /api/tenant/subscription-invoices
 * List SUBSCRIPTION invoices for the account owning the current tenant.
 */
router.get('/subscription-invoices', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  tenantController.getSubscriptionInvoices(req, res, next)
);

/**
 * GET /api/tenant/payment-methods
 * Get payment methods for the tenant
 */
router.get('/payment-methods', (req, res, next) => tenantController.getPaymentMethods(req, res, next));

/**
 * POST /api/tenant/payment-methods
 * Add a new payment method
 */
router.post('/payment-methods', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  tenantController.addPaymentMethod(req, res, next)
);

/**
 * PUT /api/tenant/payment-methods/:id
 * Update a payment method
 */
router.put('/payment-methods/:id', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  tenantController.updatePaymentMethod(req, res, next)
);

/**
 * DELETE /api/tenant/payment-methods/:id
 * Delete a payment method
 */
router.delete('/payment-methods/:id', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  tenantController.deletePaymentMethod(req, res, next)
);

/**
 * GET /api/tenant/settings/accepted-payment-methods
 * Get accepted payment methods list
 */
router.get('/settings/accepted-payment-methods', (req, res, next) => tenantController.getAcceptedPaymentMethods(req, res, next));

/**
 * POST /api/tenant/settings/accepted-payment-methods
 * Add an accepted payment method
 */
router.post('/settings/accepted-payment-methods', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) => tenantController.addAcceptedPaymentMethod(req, res, next));

/**
 * DELETE /api/tenant/settings/accepted-payment-methods/:name
 * Delete an accepted payment method
 */
router.delete('/settings/accepted-payment-methods/:name', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) => tenantController.deleteAcceptedPaymentMethod(req, res, next));

/**
 * GET /api/tenant/settings/auto-confirm
 * Get auto-confirm settings
 */
router.get('/settings/auto-confirm', (req, res, next) => tenantController.getAutoConfirmSettings(req, res, next));

/**
 * PUT /api/tenant/settings/auto-confirm
 * Update auto-confirm settings
 */
router.put('/settings/auto-confirm', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) => tenantController.updateAutoConfirmSettings(req, res, next));

/**
 * GET /api/tenant/header-image
 * Get header image URL for the tenant
 */
router.get('/header-image', (req, res, next) => tenantController.getHeaderImage(req, res, next));

/**
 * POST /api/tenant/upload-header-image
 * Upload header image
 */
router.post('/upload-header-image', requireRole('ADMIN', 'SUPER_ADMIN', 'STAFF', 'RECEPTIONIST'), uploadHeaderImage.single('headerImage'), (req, res, next) =>
  tenantController.uploadHeaderImage(req, res, next)
);

/**
 * POST /api/tenant/upload-cover-image
 * Upload cover image
 */
router.post('/upload-cover-image', requireRole('ADMIN', 'SUPER_ADMIN'), upload.single('coverImage'), (req, res, next) =>
  tenantController.uploadCoverImage(req, res, next)
);

export default router;
