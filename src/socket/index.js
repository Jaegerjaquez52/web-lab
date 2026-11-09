import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

// Кеш активних користувачів
const onlineUsers = new Set();

// Ініціалізація WebSocket сервера
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
  });

  // Middleware для аутентифікації з'єднань
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (error) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.userId;
    
    // Додавання користувача до списку активних та глобальна розсилка
    onlineUsers.add(userId);
    io.emit('user:online', { userId });

    // Приєднання до персональної кімнати
    socket.join(`user:${userId}`);

    // Отримання списку активних користувачів
    socket.on('users:get_online', (ack) => {
      if (ack) ack(Array.from(onlineUsers));
    });

    // Приєднання до специфічної кімнати (наприклад, проєкту)
    socket.on('room:join', (room, ack) => {
      socket.join(room);
      if (ack) ack({ ok: true });
    });

    // Вихід з кімнати
    socket.on('room:leave', (room) => socket.leave(room));

    // Обробка відключення клієнта
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('user:offline', { userId });
    });
  });

  return io;
}