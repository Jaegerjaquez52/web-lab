import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { getTasks, createTask, updateTask } from '../controllers/taskController.js'; 

const router = Router();

// Отримання списку завдань (підтримує пагінацію, фільтрацію та пошук)
router.get('/', authenticate, getTasks);

// Створення нового завдання
router.post('/', authenticate, createTask);

// Часткове оновлення існуючого завдання
router.patch('/:id', updateTask);

export default router;