import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/authenticateRequest';
import { authController } from './auth.controller';

const router = express.Router();

// Avatar upload (profile editing) — buffered in memory, stored on Cloudinary.
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
 * POST /api/auth/login
 * Login user
 */
router.post('/login', (req, res, next) => authController.login(req, res, next));

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', (req, res, next) => authController.register(req, res, next));

/**
 * POST /api/auth/forgot-password
 * Request a password reset link (emailed to the user)
 */
router.post('/forgot-password', (req, res, next) => authController.forgotPassword(req, res, next));

/**
 * POST /api/auth/reset-password
 * Set a new password using a one-time reset token
 */
router.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));

/**
 * POST /api/auth/verify-email
 * Confirm a newly registered account with the emailed one-time token
 */
router.post('/verify-email', (req, res, next) => authController.verifyEmail(req, res, next));

/**
 * POST /api/auth/resend-verification
 * Resend the confirmation email for an unverified account
 */
router.post('/resend-verification', (req, res, next) => authController.resendVerificationEmail(req, res, next));

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', authMiddleware, (req, res, next) => authController.getCurrentUser(req, res, next));

/**
 * POST /api/auth/switch-salon
 * Multi-salon: re-issue a token scoped to another salon of the owner's account
 */
router.post('/switch-salon', authMiddleware, (req, res, next) => authController.switchSalon(req, res, next));

/**
 * POST /api/auth/logout
 * Logout
 */
router.post('/logout', authMiddleware, (req, res, next) => authController.logout(req, res, next));

/**
 * POST /api/auth/upload-avatar
 * Upload + set the authenticated user's profile avatar (Cloudinary).
 */
router.post('/upload-avatar', authMiddleware, (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? 'L\'image est trop volumineuse (max 5 Mo)' : err.message)
        : (err.message || 'Erreur lors de l\'upload de l\'image');
      return res.status(400).json({ error: 'Upload error', message });
    }
    next();
  });
}, authController.uploadAvatar);

/**
 * POST /api/auth/send-password-code
 * Step 1 of changing the password: verify the current password and email a
 * one-time 6-digit code to the account owner.
 */
router.post('/send-password-code', authMiddleware, (req, res, next) =>
  authController.sendPasswordCode(req, res, next)
);

/**
 * POST /api/auth/change-password
 * Step 2 of changing the password: validate the emailed code and set the new password.
 */
router.post('/change-password', authMiddleware, (req, res, next) =>
  authController.changePassword(req, res, next)
);

export default router;
