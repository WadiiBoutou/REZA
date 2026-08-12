import { prisma } from '../../../lib/prisma';
import { fail } from '../utils/http';

export class ClientNotificationsService {
  async getClientNotifications(email: string, query: Record<string, unknown>) {
    try {
    const { unreadOnly, limit = '50' } = query;

    if (!email) {
      fail(400, {
        error: 'Email is required'
      });
    }

    // Find all clients with this email (user can have client records in multiple tenants)
    const clients = await prisma.client.findMany({
      where: {
        email: email.trim().toLowerCase()
      },
      select: {
        id: true,
        tenantId: true
      }
    });

    if (!clients || clients.length === 0) {
      return {
        notifications: [],
        unreadCount: 0,
        grouped: {
          today: [],
          yesterday: [],
          thisWeek: [],
          older: []
        }
      };
    }

    // Get all client IDs and tenant IDs (clients may have a null tenantId,
    // e.g. "global" clients with no salon — those can't have tenant notifications)
    const clientIds = clients.map(c => c.id);
    const tenantIds = [...new Set(clients.map(c => c.tenantId).filter((t): t is string => !!t))];

    if (tenantIds.length === 0) {
      return {
        notifications: [],
        unreadCount: 0,
        grouped: {
          today: [],
          yesterday: [],
          thisWeek: [],
          older: []
        }
      };
    }

    // Build where clause to find notifications for these clients
    // Notifications are stored with clientId in metadata and belong to the tenant
    const notifications = await prisma.notification.findMany({
      where: {
        tenantId: { in: tenantIds },
        userId: null, // Client notifications have null userId
        type: 'APPOINTMENT_CONFIRMED', // Only appointment confirmation notifications for now
        ...(unreadOnly === 'true' ? { isRead: false } : {}),
        // Filter by clientId in metadata - this is a workaround since we can't directly query JSON fields efficiently
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        }
      }
    });

    // Filter notifications by clientId in metadata (since Prisma doesn't support efficient JSON queries)
    const filteredNotifications = notifications.filter((notif: any) => {
      const metadata = notif.metadata as any;
      return metadata && metadata.clientId && clientIds.includes(metadata.clientId);
    });

    // Get unread count
    const unreadNotifications = filteredNotifications.filter((n: any) => !n.isRead);
    const unreadCount = unreadNotifications.length;

    // Group notifications by date
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

    filteredNotifications.forEach((notification: any) => {
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
      notifications: filteredNotifications,
      grouped: groupedByDate,
      unreadCount
    };
  } catch (error) {
    throw error;
  }
  }

  async markNotificationRead(id: string) {
    try {
    
    // Verify notification exists
    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: null, // Client notifications have null userId
        type: 'APPOINTMENT_CONFIRMED'
      }
    });

    if (!notification) {
      fail(404, {
        error: 'Notification not found'
      });
    }

    // Mark as read
    await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    return { 
      success: true,
      message: 'Notification marked as read'
    };
  } catch (error) {
    throw error;
  }
  }

}

export const clientNotificationsService = new ClientNotificationsService();
