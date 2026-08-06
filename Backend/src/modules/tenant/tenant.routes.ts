import express, { Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, requireRole } from '../../middleware/authenticateRequest';
import { verifyToken } from '../../utils/jwt';
import { prisma } from '../../lib/prisma';
import { tenantController } from './tenant.controller';
import * as log from '../../utils/logger';

const router = express.Router();

// Configure multer
const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'public', 'uploads');
const coverImagesDir = path.join(uploadsDir, 'cover-images');
const headerImagesDir = path.join(uploadsDir, 'header-images');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(coverImagesDir)) {
  fs.mkdirSync(coverImagesDir, { recursive: true });
}
if (!fs.existsSync(headerImagesDir)) {
  fs.mkdirSync(headerImagesDir, { recursive: true });
}

const coverImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, coverImagesDir);
  },
  filename: (req: any, file, cb) => {
    const uniqueSuffix = `${req.tenantId}-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const headerImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, headerImagesDir);
  },
  filename: (req: any, file, cb) => {
    const uniqueSuffix = `${req.tenantId}-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage: coverImageStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadHeaderImage = multer({
  storage: headerImageStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

/**
 * GET /api/tenant/header-image-file (public)
 * Serve the actual header image file
 */
router.get('/header-image-file', async (req, res, next) => {
  try {
    let tenantId: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        if (decoded && decoded.tenantId) {
          tenantId = decoded.tenantId;
        }
      } catch (tokenError) {}
    }

    if (!tenantId && req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'] as string;
    }

    if (!tenantId && req.query.tenantId) {
      tenantId = req.query.tenantId as string;
    }

    if (!tenantId) {
      const host = req.get('host') || '';
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'localhost') {
        try {
          const tenant = await prisma.tenant.findUnique({
            where: { subdomain },
            select: { id: true }
          });
          if (tenant) {
            tenantId = tenant.id;
          }
        } catch (error) {}
      }
    }

    if (!tenantId) {
      return res.status(401).json({
        error: 'Tenant identification required',
        message: 'Unable to determine tenant'
      });
    }

    if (tenantId === 'default') {
      log.error('[Header Image File] SECURITY WARNING: Attempted access with tenantId="default"');
      return res.status(403).json({
        error: 'Invalid tenant',
        message: 'Your account needs to be updated. Please log out and log back in, or contact support.'
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ error: 'Tenant inactive' });
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    let headerImage: string | null = null;

    if (settings) {
      const emailNotifications = settings.emailNotifications as any;

      if (emailNotifications && typeof emailNotifications === 'object') {
        if (emailNotifications.dashboardSettings?.headerImage) {
          headerImage = emailNotifications.dashboardSettings.headerImage;

          if (headerImage && typeof headerImage === 'string' && headerImage.includes('/cover-images/')) {
            headerImage = headerImage.replace('/cover-images/', '/header-images/');
          }
        } else if (emailNotifications.headerImage) {
          headerImage = emailNotifications.headerImage;

          if (headerImage && typeof headerImage === 'string' && headerImage.includes('/cover-images/')) {
            headerImage = headerImage.replace('/cover-images/', '/header-images/');
          }
        }
      }
    }

    if (!headerImage) {
      return res.status(404).json({ error: 'Header image not found' });
    }

    const filename = path.basename(headerImage);
    const imagePath = path.join(headerImagesDir, filename);

    if (!fs.existsSync(imagePath)) {
      if (fs.existsSync(headerImagesDir)) {
        const files = fs.readdirSync(headerImagesDir);
        const matchingFile = files.find(f => f.includes(filename.split('-')[0]));

        if (matchingFile) {
          const alternativePath = path.join(headerImagesDir, matchingFile);
          if (fs.existsSync(alternativePath)) {
            const ext = path.extname(alternativePath).toLowerCase().slice(1);
            const contentTypeMap: { [key: string]: string } = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'webp': 'image/webp'
            };
            const contentType = contentTypeMap[ext] || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.sendFile(alternativePath);
          }
        }
      }

      return res.status(404).json({
        error: 'Image file not found',
        message: `The header image file "${filename}" was not found in the uploads directory.`
      });
    }

    const ext = path.extname(imagePath).toLowerCase().slice(1);
    const contentTypeMap: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    const contentType = contentTypeMap[ext] || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(imagePath);
  } catch (error: any) {
    log.error('[Header Image File] Error:', error);
    next(error);
  }
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
 * GET /api/tenant/settings/client-fields
 * Get client field configuration settings
 */
router.get('/settings/client-fields', (req, res, next) => tenantController.getClientFieldSettings(req, res, next));

/**
 * PUT /api/tenant/settings/client-fields
 * Update client field configuration settings
 */
router.put('/settings/client-fields', requireRole('ADMIN', 'SUPER_ADMIN'), (req, res, next) =>
  tenantController.updateClientFieldSettings(req, res, next)
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
