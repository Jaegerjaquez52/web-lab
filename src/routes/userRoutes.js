const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');

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

module.exports = router;