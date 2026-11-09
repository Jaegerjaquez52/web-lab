import { Router } from 'express';
import { getMyNotifications, markAsRead } from '../controllers/notificationController.js';
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

export default router;