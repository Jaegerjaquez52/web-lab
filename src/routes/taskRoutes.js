import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createTask, deleteTask, getTaskById, getTasks, setTaskClaim, updateTask } from '../controllers/taskController.js';

const router = Router();
router.use(authenticate);

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
 *     summary: Список доступних завдань з пошуком, фільтрацією та пагінацією
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
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
 *       - in: query
 *         name: assignedToMe
 *         description: Повернути лише завдання, де поточний користувач є виконавцем
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Завдання доступних проєктів }
 *       401: { description: Потрібна автентифікація }
 *   post:
 *     summary: Створення завдання у доступному проєкті
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, projectId]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [TODO, IN_PROGRESS, DONE] }
 *               projectId: { type: integer }
 *               dueDate: { type: string, format: date, nullable: true }
 *     responses:
 *       201: { description: Завдання створено }
 *       403: { description: Немає доступу до проєкту }
 */
router.get('/', getTasks);
router.post('/', createTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Отримання завдання за ідентифікатором
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Завдання знайдено }
 *       403: { description: Недостатньо прав }
 *       404: { description: Завдання не знайдено }
 *   patch:
 *     summary: Оновлення назви, опису, статусу чи терміну виконання завдання
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
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
 *               title: { type: string }
 *               description: { type: string, nullable: true }
 *               status: { type: string, enum: [TODO, IN_PROGRESS, DONE] }
 *               dueDate: { type: string, format: date, nullable: true }
 *     responses:
 *       200: { description: Завдання оновлено }
 *       403: { description: Недостатньо прав }
 *   delete:
 *     summary: Видалення завдання
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Завдання видалено }
 *       403: { description: Недостатньо прав }
 */
router.get('/:id', getTaskById);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

/**
 * @swagger
 * /api/tasks/{id}/claim:
 *   put:
 *     summary: Позначити або зняти себе як виконавця завдання
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
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
 *             required: [claimed]
 *             properties:
 *               claimed: { type: boolean }
 *     responses:
 *       200: { description: Виконавців оновлено }
 *       403: { description: Користувач не є учасником команди проєкту }
 */
router.put('/:id/claim', setTaskClaim);

export default router;
