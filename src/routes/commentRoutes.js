import { Router } from 'express';
import { addComment, deleteComment, getComments } from '../controllers/commentController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Усі маршрути для коментарів вимагають аутентифікації
router.use(authenticate);

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Список коментарів завдання
 *     tags: [Comments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: taskId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 100, default: 10 }
 *     responses:
 *       200: { description: Коментарі з пагінацією }
 */
router.get('/', getComments);

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
/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Видалення коментаря автором, власником проєкту або адміністратором
 *     tags: [Comments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Коментар видалено }
 *       403: { description: Недостатньо прав }
 *       404: { description: Коментар не знайдено }
 */
router.delete('/:id', deleteComment);

export default router;