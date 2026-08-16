/**
 * Shared notification grouping by date bucket (today / yesterday / thisWeek / older).
 * Previously duplicated in notification.service.ts and client-notifications.service.ts.
 */
export function groupNotificationsByDate<T extends { createdAt: Date }>(
  notifications: T[],
): { today: T[]; yesterday: T[]; thisWeek: T[]; older: T[] } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeek = new Date(today);
  thisWeek.setDate(thisWeek.getDate() - 7);

  const groupedByDate: { today: T[]; yesterday: T[]; thisWeek: T[]; older: T[] } = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  notifications.forEach((notification) => {
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

  return groupedByDate;
}
