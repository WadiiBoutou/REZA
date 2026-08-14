import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { unreadOnly, limit } = req.query;
      const result = await notificationService.getNotifications(
        req.tenantId!,
        req.userId!,
        unreadOnly === 'true',
        limit ? parseInt(limit as string) : undefined
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async markNotificationAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationService.markNotificationAsRead(req.tenantId!, req.userId!, req.params.id);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }

  async markAllNotificationsAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationService.markAllNotificationsAsRead(req.tenantId!, req.userId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async deleteAllNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationService.deleteAllNotifications(req.tenantId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
