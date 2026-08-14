import express from 'express';
import { notificationController } from './notification.controller';

const router = express.Router();

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', (req, res, next) => notificationController.markNotificationAsRead(req, res, next));

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/read-all', (req, res, next) => notificationController.markAllNotificationsAsRead(req, res, next));

/**
 * DELETE /api/notifications
 * Delete all notifications for the current tenant
 */
router.delete('/', (req, res, next) => notificationController.deleteAllNotifications(req, res, next));

export default router;
