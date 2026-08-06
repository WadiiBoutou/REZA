import express from 'express';
import { reviewController } from './review.controller';

const router = express.Router();

/**
 * GET /api/reviews
 * Get all reviews for the tenant
 */
router.get('/', (req, res, next) => reviewController.getReviews(req, res, next));

/**
 * POST /api/reviews
 * Create a new review
 */
router.post('/', (req, res, next) => reviewController.createReview(req, res, next));

/**
 * PUT /api/reviews/:id/status
 * Moderate a review (approve/reject)
 */
router.put('/:id/status', (req, res, next) => reviewController.updateReviewStatus(req, res, next));

/**
 * DELETE /api/reviews/:id
 * Permanently delete a review — RESTRICTED to REJECTED-status reviews (moderation purge)
 */
router.delete('/:id', (req, res, next) => reviewController.deleteReview(req, res, next));

export default router;
