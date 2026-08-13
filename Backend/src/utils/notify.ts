import { Prisma } from '../../prisma/generated/prisma/client';
import { prisma } from '../lib/prisma';
import { emitNotification } from './realtime';

/**
 * Create a notification row AND push a realtime signal to connected clients.
 * Signature matches `prisma.notification.create` so call sites stay identical.
 */
export async function createNotification(input: {
  data: Prisma.NotificationCreateInput | Prisma.NotificationUncheckedCreateInput;
}) {
  const notification = await prisma.notification.create(input);
  emitNotification({
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt,
  });
  return notification;
}
