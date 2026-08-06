import express from 'express';
import { dashboardController } from './dashboard.controller';

const router = express.Router();

/**
 * GET /api/dashboard/clients/mes-avis/avis-moderes
 * Get all approved reviews for the dashboard
 */
router.get('/clients/mes-avis/avis-moderes', (req, res, next) =>
  dashboardController.getApprovedReviews(req, res, next)
);

/**
 * GET /api/dashboard/clients/mes-avis/avis-refuses
 * Get all rejected reviews for the dashboard
 */
router.get('/clients/mes-avis/avis-refuses', (req, res, next) =>
  dashboardController.getRejectedReviews(req, res, next)
);

/**
 * GET /api/dashboard/clients/statistiques/avis
 * Get review statistics for the dashboard
 */
router.get('/clients/statistiques/avis', (req, res, next) =>
  dashboardController.getReviewStatistics(req, res, next)
);

export default router;
