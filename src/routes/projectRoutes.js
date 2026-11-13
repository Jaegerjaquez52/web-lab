import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createProject, deleteProject, getProjectById, getProjects, updateProject } from '../controllers/projectController.js';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Проєкти та їх учасники
 */
/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Список доступних користувачу проєктів
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Проєкти з метаданими пагінації }
 *   post:
 *     summary: Створення проєкту
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               memberIds: { type: array, items: { type: integer } }
 *     responses:
 *       201: { description: Проєкт створено }
 *       400: { description: Некоректні дані }
 */
router.get('/', getProjects);
router.post('/', createProject);
/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Деталі проєкту
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Проєкт знайдено }
 *       404: { description: Проєкт не знайдено }
 *   patch:
 *     summary: Оновлення проєкту
 *     tags: [Projects]
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
 *               name: { type: string }
 *               description: { type: string }
 *               memberIds: { type: array, items: { type: integer } }
 *     responses:
 *       200: { description: Проєкт оновлено }
 *   delete:
 *     summary: Видалення проєкту
 *     tags: [Projects]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Проєкт видалено }
 */
router.get('/:id', getProjectById);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
