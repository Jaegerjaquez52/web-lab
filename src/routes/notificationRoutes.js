import { Router } from 'express';
import { deleteNotification, getMyNotifications, markAllAsRead, markAsRead } from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Усі маршрути сповіщень вимагають аутентифікації
router.use(authenticate);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Отримання списку сповіщень поточного користувача
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Масив об'єктів сповіщень }
 */
router.get('/', getMyNotifications);
/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Позначити всі сповіщення прочитаними
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Кількість оновлених записів }
 */
router.patch('/read-all', markAllAsRead);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Позначення конкретного сповіщення як прочитаного
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200: { description: Статус сповіщення успішно оновлено }
 */
router.patch('/:id/read', markAsRead);
/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Видалити власне сповіщення
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Сповіщення видалено }
 *       404: { description: Сповіщення не знайдено }
 */
router.delete('/:id', deleteNotification);

export default router;