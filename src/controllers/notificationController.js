import { prisma } from '../db.js';

export async function getMyNotifications(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.userId },
    orderBy: { createdAt: 'desc' },
    take: 20, 
  });
  res.json(notifications);
}

export async function markAsRead(req, res) {
  const { id } = req.params;
  
  const notification = await prisma.notification.update({
    where: { 
      id: Number(id),
      userId: req.user.userId 
    },
    data: { isRead: true },
  });
  
  res.json({ message: 'Сповіщення прочитано', notification });
}