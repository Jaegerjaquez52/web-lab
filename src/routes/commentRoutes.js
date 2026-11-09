import { Router } from 'express';
import { addComment } from '../controllers/commentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Усі маршрути для коментарів вимагають аутентифікації
router.use(authenticate);

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Додавання коментаря до завдання
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [taskId, text]
 *             properties:
 *               taskId: { type: integer, example: 1 }
 *               text: { type: string, example: "Коментар щодо виконання завдання." }
 *     responses:
 *       201: { description: Коментар успішно створено }
 *       400: { description: Відсутні обов'язкові параметри }
 */
router.post('/', addComment);

export default router;