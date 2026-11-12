import express from 'express';
import * as UserController from '../controllers/userController.js';

const router = express.Router();

// Створення нового користувача
router.post('/', UserController.createUser);

// Отримання списку всіх користувачів
router.get('/', UserController.getUsers);

// Отримання даних користувача за ідентифікатором
router.get('/:id', UserController.getUserById);

// Оновлення даних існуючого користувача
router.put('/:id', UserController.updateUser);

// Видалення користувача з системи
router.delete('/:id', UserController.deleteUser);

export default router;