import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createTeam, deleteTeam, getTeamById, getTeams, updateTeam } from '../controllers/teamController.js';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Teams
 *   description: Команди та їх учасники
 */
/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: Список доступних користувачу команд
 *     tags: [Teams]
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
 *       200: { description: Команди з пагінацією }
 *   post:
 *     summary: Створення команди її власником
 *     tags: [Teams]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2 }
 *               description: { type: string }
 *               memberIds: { type: array, items: { type: integer } }
 *     responses:
 *       201: { description: Команду створено }
 *       400: { description: Некоректні дані }
 */
router.get('/', getTeams);
router.post('/', createTeam);

/**
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Отримання доступної команди
 *     tags: [Teams]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Дані команди }
 *       404: { description: Команду не знайдено }
 *   patch:
 *     summary: Оновлення команди власником або адміністратором
 *     tags: [Teams]
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
 *               name: { type: string, minLength: 2 }
 *               description: { type: string, nullable: true }
 *               memberIds: { type: array, items: { type: integer } }
 *     responses:
 *       200: { description: Команду оновлено }
 *       403: { description: Недостатньо прав }
 *   delete:
 *     summary: Видалення команди власником або адміністратором
 *     tags: [Teams]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Команду видалено }
 *       403: { description: Недостатньо прав }
 */
router.get('/:id', getTeamById);
router.patch('/:id', updateTeam);
router.delete('/:id', deleteTeam);

export default router;
