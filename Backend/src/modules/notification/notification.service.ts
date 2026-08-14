import { prisma } from '../../lib/prisma';

export class NotificationService {
  async getNotifications(tenantId: string, userId: string, unreadOnly?: boolean, limit?: number) {
    const where: any = {
      tenantId,
      OR: [
        { userId }, // For this specific user
        { userId: null } // General notifications for all users
      ]
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit || undefined,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const unreadCount = await prisma.notification.count({
      where: {
        ...where,
        isRead: false
      }
    });

    // Group by date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groupedByDate: any = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    notifications.forEach(notification => {
      const notificationDate = new Date(notification.createdAt);
      if (notificationDate >= today) {
        groupedByDate.today.push(notification);
      } else if (notificationDate >= yesterday) {
        groupedByDate.yesterday.push(notification);
      } else if (notificationDate >= thisWeek) {
        groupedByDate.thisWeek.push(notification);
      } else {
        groupedByDate.older.push(notification);
      }
    });

    return {
      notifications,
      grouped: groupedByDate,
      unreadCount
    };
  }

  async markNotificationAsRead(tenantId: string, userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        tenantId,
        OR: [
          { userId },
          { userId: null }
        ]
      }
    });

    if (!notification) {
      throw {
        status: 404,
        error: 'Notification not found'
      };
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return {
      success: true,
      message: 'Notification marked as read'
    };
  }

  async markAllNotificationsAsRead(tenantId: string, userId: string) {
    await prisma.notification.updateMany({
      where: {
        tenantId,
        isRead: false,
        OR: [
          { userId },
          { userId: null }
        ]
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return {
      success: true,
      message: 'All notifications marked as read'
    };
  }

  /**
   * Hard-delete every notification of the tenant ("Tout effacer").
   * Scoped to the tenant — the caller is already authenticated and
   * tenant-scoped via the staff middleware on /api/notifications.
   */
  async deleteAllNotifications(tenantId: string) {
    const deleted = await prisma.notification.deleteMany({
      where: { tenantId },
    });

    return {
      success: true,
      message: 'All notifications deleted',
      deletedCount: deleted.count,
    };
  }
}

export const notificationService = new NotificationService();
