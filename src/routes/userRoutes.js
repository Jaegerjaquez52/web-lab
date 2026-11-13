import express from 'express';
import * as UserController from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Облікові записи користувачів
 */
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Список користувачів
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 100, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Користувачі з пагінацією }
 *   post:
 *     summary: Створення користувача адміністратором
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Користувача створено }
 *       403: { description: Потрібна роль адміністратора }
 */
router.post('/', authorize('ADMIN'), UserController.createUser);

// Отримання списку всіх користувачів
router.get('/', UserController.getUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Отримання облікового запису за ID
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200: { description: Користувача знайдено }
 *       400: { description: Некоректний ID }
 *       404: { description: Користувача не знайдено }
 *   put:
 *     summary: Оновлення облікового запису (сам користувач або адміністратор)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name]
 *             properties:
 *               email: { type: string, format: email }
 *               name: { type: string, minLength: 2 }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [USER, ADMIN, MODERATOR] }
 *     responses:
 *       200: { description: Користувача оновлено }
 *       403: { description: Недостатньо прав }
 *   delete:
 *     summary: Видалення облікового запису адміністратором
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       204: { description: Користувача видалено }
 *       403: { description: Потрібна роль адміністратора }
 *       404: { description: Користувача не знайдено }
 */
// Отримання даних користувача за ідентифікатором
router.get('/:id', UserController.getUserById);

// Оновлення даних існуючого користувача
router.put('/:id', UserController.updateUser);

// Видалення користувача з системи
router.delete('/:id', authorize('ADMIN'), UserController.deleteUser);

export default router;