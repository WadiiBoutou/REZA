import express from 'express';
import { authMiddleware } from '../../middleware/authenticateRequest';
import { authController } from './auth.controller';

const router = express.Router();

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

export default router;
