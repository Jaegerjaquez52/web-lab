import { prisma } from '../db.js';
import { publish } from './realtimeService.js';

export async function createNotification(io, userId, text, type = 'INFO', priority = 'NORMAL') {
  const notification = await prisma.notification.create({
    data: { userId, text, type, priority },
  });

  await publish(io, `user:${userId}`, 'notification', notification);
  return notification;
}

export async function createNotificationBatch(io, items) {
  const created = [];
  for (const item of items) {
    created.push(
      await createNotification(io, item.userId, item.text, item.type ?? 'INFO', item.priority ?? 'NORMAL')
    );
  }
  return created;
}
