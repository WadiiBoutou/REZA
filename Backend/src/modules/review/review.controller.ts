import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { reviewService } from './review.service';
import { createReviewSchema, updateReviewStatusSchema } from './review.schema';

export class ReviewController {
  async getReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, clientId, page = '1', limit = '50' } = req.query;
      const result = await reviewService.getReviews(
        req.tenantId!,
        status as string,
        clientId as string,
        parseInt(page as string),
        parseInt(limit as string)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createReviewSchema.parse(req.body);
      const result = await reviewService.createReview(req.tenantId!, req.userId!, data);
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }

  async updateReviewStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateReviewStatusSchema.parse(req.body);
      const result = await reviewService.updateReviewStatus(req.tenantId!, req.userId!, req.params.id, data);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }

  async deleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reviewService.deleteReview(req.tenantId!, req.params.id);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }
}

export const reviewController = new ReviewController();
