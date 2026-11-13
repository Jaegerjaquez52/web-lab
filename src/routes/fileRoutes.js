import { Router } from 'express';
import { uploadFile, getFile, deleteFile, listFiles } from '../controllers/fileController.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Список доступних файлів з пагінацією
 *     tags: [Files]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: taskId
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200: { description: Файли з метаданими пагінації }
 *       403: { description: Недостатньо прав для перегляду файлів завдання }
 */
router.get('/', authenticate, listFiles);
/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Завантаження файлу на сервер
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       201: { description: Файл успішно завантажено }
 *       400: { description: Помилка завантаження або непідтримуваний тип файлу }
 *       401: { description: Необхідна аутентифікація }
 */
router.post('/upload', authenticate, upload.single('file'), uploadFile);

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Отримання файлу за його ідентифікатором
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Успішне повернення файлу }
 *       404: { description: Файл не знайдено }
 */
router.get('/:id', authenticate, getFile);

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Видалення існуючого файлу
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Файл успішно видалено }
 *       403: { description: Недостатньо прав для видалення цього файлу }
 *       404: { description: Файл не знайдено }
 */
router.delete('/:id', authenticate, deleteFile);

export default router;