import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getTasks, getTaskById, createTask, updateTask, deleteTask } from '../controllers/taskController.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Управління завданнями
 */

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Отримання списку завдань (з пагінацією, пошуком та фільтрацією)
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: projectId
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [TODO, IN_PROGRESS, DONE] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Список завдань з пагінацією
 *       401: { description: Потрібна автентифікація }
 *   post:
 *     summary: Створення нового завдання
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, projectId]
 *             properties:
 *               title: { type: string, example: "Розробити WebSocket модуль" }
 *               description: { type: string, example: "Інтегрувати Socket.io та сповіщення" }
 *               status: { type: string, enum: [TODO, IN_PROGRESS, DONE], example: "TODO" }
 *               projectId: { type: integer, example: 1 }
 *     responses:
 *       201: { description: Завдання успішно створено }
 *       400: { description: Некоректні дані }
 *       401: { description: Потрібна автентифікація }
 */

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Отримання завдання за ідентифікатором
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Завдання знайдено }
 *       404: { description: Завдання не знайдено }
 *   patch:
 *     summary: Оновлення завдання (та відправка WebSocket-сповіщення)
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, example: "Оновлена назва задачі" }
 *               status: { type: string, example: "DONE" }
 *               assigneeId: { type: integer, example: 1 }
 *     responses:
 *       200: { description: Завдання оновлено }
 *       400: { description: Некоректні дані }
 *       401: { description: Потрібна автентифікація }
 *   delete:
 *     summary: Видалення завдання
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Завдання видалено }
 *       401: { description: Потрібна автентифікація }
 */

// Отримання списку завдань (підтримує пагінацію, фільтрацію та пошук)
router.get('/', authenticate, getTasks);
router.get('/:id', authenticate, getTaskById);

// Створення нового завдання
router.post('/', authenticate, createTask);

// Часткове оновлення існуючого завдання
router.patch('/:id', authenticate, updateTask);
router.delete('/:id', authenticate, deleteTask);

export default router;