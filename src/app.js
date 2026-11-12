import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpecs } from './config/swagger.js';
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import taskRoutes from './routes/taskRoutes.js'; 
import notificationRoutes from './routes/notificationRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

// Налаштування базових заголовків безпеки
app.use(helmet());

// Налаштування CORS для взаємодії з клієнтською частиною
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Обмеження частоти запитів (Rate Limiting)
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT) || 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Забагато запитів з цієї IP-адреси, спробуйте пізніше' },
  })
);

// Парсинг JSON-тіла запитів
app.use(express.json());

// Інтеграція інтерактивної документації Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, { explorer: true }));

// Реєстрація API маршрутів
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);

// Централізована обробка помилок
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    const error = err.code === 'LIMIT_FILE_SIZE' ? 'Файл занадто великий' : 'Помилка завантаження файлу';
    return res.status(400).json({ error });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);

  res.status(status).json({ error: status >= 500 ? 'Внутрішня помилка сервера' : err.message });
});



export default app;