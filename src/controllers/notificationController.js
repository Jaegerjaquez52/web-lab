import { prisma } from '../db.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';

export async function getMyNotifications(req, res) {
  const { pageNumber, take, skip } = parseListQuery(req.query, ['createdAt']);
  const where = { userId: req.user.userId };
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.notification.count({ where }),
  ]);
  res.json({ data: notifications, pagination: pageMeta(pageNumber, take, total, notifications.length) });
}

export async function markAsRead(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID сповіщення' });
  const result = await prisma.notification.updateMany({
    where: { id, userId: req.user.userId },
    data: { isRead: true },
  });
  if (!result.count) return res.status(404).json({ error: 'Сповіщення не знайдено' });
  const notification = await prisma.notification.findUnique({ where: { id } });
  res.json({ message: 'Сповіщення прочитано', notification });
}

export async function markAllAsRead(req, res) {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.userId, isRead: false },
    data: { isRead: true },
  });
  res.json({ updated: result.count });
}

export async function deleteNotification(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID сповіщення' });
  const result = await prisma.notification.deleteMany({ where: { id, userId: req.user.userId } });
  if (!result.count) return res.status(404).json({ error: 'Сповіщення не знайдено' });
  res.status(204).end();
}