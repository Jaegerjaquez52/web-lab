import { prisma } from '../db.js';

// Створення та розсилка нового сповіщення
export async function createNotification(io, userId, text, type = 'INFO') {
  // Збереження сповіщення у базі даних
  const notification = await prisma.notification.create({
    data: { userId, text, type }
  });

  // Миттєва доставка користувачу через WebSocket у персональну кімнату
  if (io) {
    io.to(`user:${userId}`).emit('notification', notification);
  }

  return notification;
}