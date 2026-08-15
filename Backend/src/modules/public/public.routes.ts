import express from 'express';
import multer from 'multer';
import { publicController } from './public.controller';

const router = express.Router();

// Public avatar upload (registration) — buffered in memory, stored on Cloudinary.
const avatarStorage = multer.memoryStorage();
const avatarFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images sont autorisées'));
  }
};
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * POST /api/public/auth/upload-avatar
 * Upload an avatar image during registration (Cloudinary). Returns the URL
 * to send along in the client/user register payload.
 */
router.post('/auth/upload-avatar', (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? 'L\'image est trop volumineuse (max 5 Mo)' : err.message)
        : (err.message || 'Erreur lors de l\'upload de l\'image');
      return res.status(400).json({ error: 'Upload error', message });
    }
    next();
  });
}, publicController.uploadAvatar);

router.get('/tenant/:identifier', (req, res, next) =>
  publicController.getTenantByIdentifier(req, res, next)
);
router.get('/tenant/:tenantId/services', (req, res, next) =>
  publicController.getTenantServices(req, res, next)
);
router.get('/tenant/:tenantId/employees', (req, res, next) =>
  publicController.getTenantEmployees(req, res, next)
);
router.get('/tenant/:tenantId/reviews', (req, res, next) =>
  publicController.getTenantReviews(req, res, next)
);
router.get('/tenant/:tenantId/employees/:employeeId/stats', (req, res, next) =>
  publicController.getEmployeeStats(req, res, next)
);
router.post('/reviews', (req, res, next) => publicController.createReview(req, res, next));
router.get('/tenants', (req, res, next) => publicController.searchTenants(req, res, next));
router.get('/categories', (req, res, next) => publicController.getCategories(req, res, next));
router.get('/services/featured', (req, res, next) =>
  publicController.getFeaturedServices(req, res, next)
);
router.get('/employees/featured', (req, res, next) =>
  publicController.getFeaturedEmployees(req, res, next)
);
router.get('/billing-config', (req, res, next) =>
  publicController.getPublicBillingConfig(req, res, next)
);
router.get('/reviews/featured', (req, res, next) =>
  publicController.getFeaturedReviews(req, res, next)
);
router.post('/bookings', (req, res, next) => publicController.createBooking(req, res, next));
router.get('/tenant/:tenantId/available-slots', (req, res, next) =>
  publicController.getAvailableSlots(req, res, next)
);
router.post('/tenant/:tenantId/available-slots', (req, res, next) =>
  publicController.checkAvailableSlots(req, res, next)
);
router.get('/tenant/:tenantId/employee-availability', (req, res, next) =>
  publicController.getEmployeeAvailability(req, res, next)
);
router.get('/tenant/:tenantId/available-days', (req, res, next) =>
  publicController.getAvailableDays(req, res, next)
);
router.post('/tenant/:tenantId/validate-participant', (req, res, next) =>
  publicController.validateParticipantAddition(req, res, next)
);
router.get('/client/:email/appointments', (req, res, next) =>
  publicController.getClientAppointments(req, res, next)
);
router.put('/appointments/:id/cancel', (req, res, next) =>
  publicController.cancelAppointment(req, res, next)
);
router.get('/client/:email/reviews', (req, res, next) =>
  publicController.getClientReviews(req, res, next)
);
router.put('/reviews/:id', (req, res, next) => publicController.updateReview(req, res, next));
router.delete('/reviews/:id', (req, res, next) => publicController.deleteReview(req, res, next));
router.get('/client/:email/notifications', (req, res, next) =>
  publicController.getClientNotifications(req, res, next)
);
router.patch('/notifications/:id/read', (req, res, next) =>
  publicController.markNotificationRead(req, res, next)
);
router.get('/client/:email/family-members', (req, res, next) =>
  publicController.getFamilyMembers(req, res, next)
);
router.post('/family-members', (req, res, next) =>
  publicController.createFamilyMember(req, res, next)
);
router.put('/family-members/:id', (req, res, next) =>
  publicController.updateFamilyMember(req, res, next)
);
router.delete('/family-members/:id', (req, res, next) =>
  publicController.deleteFamilyMember(req, res, next)
);
router.post('/auth/client-register', (req, res, next) =>
  publicController.registerClient(req, res, next)
);
router.get('/auth/check-email', (req, res, next) =>
  publicController.checkEmail(req, res, next)
);
router.post('/auth/client-login', (req, res, next) =>
  publicController.loginClient(req, res, next)
);
router.post('/auth/client-forgot-password', (req, res, next) =>
  publicController.forgotClientPassword(req, res, next)
);
router.post('/auth/client-reset-password', (req, res, next) =>
  publicController.resetClientPassword(req, res, next)
);
router.post('/auth/client-verify-email', (req, res, next) =>
  publicController.verifyClientEmail(req, res, next)
);
router.post('/auth/client-resend-verification', (req, res, next) =>
  publicController.resendClientVerification(req, res, next)
);
router.get('/client/:email/favorites', (req, res, next) =>
  publicController.getClientFavorites(req, res, next)
);
router.post('/favorites', (req, res, next) => publicController.addFavorite(req, res, next));
router.put('/client/:email', (req, res, next) =>
  publicController.updateClientProfile(req, res, next)
);
router.post('/client/:email/send-password-code', (req, res, next) =>
  publicController.sendClientPasswordCode(req, res, next)
);
router.put('/client/:email/change-password', (req, res, next) =>
  publicController.changeClientPassword(req, res, next)
);
router.delete('/favorites/:id', (req, res, next) =>
  publicController.removeFavorite(req, res, next)
);
router.post('/early-access', (req, res, next) =>
  publicController.signupEarlyAccess(req, res, next)
);

export default router;
