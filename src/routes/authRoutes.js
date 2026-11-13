import { Router } from 'express';
import { 
  register, login, refresh, logout,
  forgotPassword, resetPassword, changePassword,
  generate2FA, verify2FA
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Реєстрація нового користувача
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *               password: { type: string, minLength: 8, example: "securePass123" }
 *               name: { type: string, example: "Іван Франко" }
 *     responses:
 *       201: { description: Користувач успішно зареєстрований }
 *       400: { description: Помилка валідації даних (наприклад, короткий пароль) }
 *       409: { description: Користувач з таким email вже існує }
 */
router.post('/register', register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вхід користувача (з підтримкою 2FA)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *               password: { type: string, example: "securePass123" }
 *               twoFactorToken: { type: string, description: "Код з додатку Authenticator (якщо увімкнено 2FA)", example: "123456" }
 *     responses:
 *       200: { description: Успішний вхід, повертає токени та дані користувача }
 *       400: { description: Не передано email або пароль }
 *       401: { description: Невірний email, пароль або код 2FA }
 *       403: { description: "Вимагається код 2FA (повертає require2FA: true)" }
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Оновлення пари токенів доступу (ротація)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Токени успішно оновлено }
 *       401: { description: Недійсний або відкликаний refresh-токен }
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Завершення сесії (відкликання refresh-токена)
 *     tags: [Authentication]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       204: { description: Токен успішно відкликано (відповідь без тіла) }
 */
router.post('/logout', logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Запит на відновлення паролю 
 *     tags: [Password Reset]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: "user@example.com" }
 *     responses:
 *       200: { description: Запит прийнято, інструкції надіслано на вказаний email }
 *       400: { description: Email не вказано }
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Встановлення нового паролю 
 *     tags: [Password Reset]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string, description: "Токен скидання паролю з email" }
 *               newPassword: { type: string, minLength: 8, example: "newSecurePass123" }
 *     responses:
 *       200: { description: Пароль успішно змінено }
 *       400: { description: Недійсний токен або помилка валідації паролю }
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Зміна паролю поточного користувача
 *     tags: [Authentication]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Пароль змінено }
 *       401: { description: Невірний поточний пароль }
 */
router.post('/change-password', authenticate, changePassword);

/**
 * @swagger
 * /api/auth/2fa/generate:
 *   post:
 *     summary: Генерація секрету 2FA та QR-коду 
 *     tags: [2FA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Повертає секретний ключ та QR-код у форматі Base64 }
 *       401: { description: Необхідна аутентифікація }
 */
router.post('/2fa/generate', authenticate, generate2FA);

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Підтвердження та активація двофакторної аутентифікації 
 *     tags: [2FA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: "Одноразовий код з додатку Authenticator", example: "123456" }
 *     responses:
 *       200: { description: Двофакторну аутентифікацію успішно активовано }
 *       400: { description: Невірний код підтвердження }
 *       401: { description: Необхідна аутентифікація }
 */
router.post('/2fa/verify', authenticate, verify2FA);

export default router;