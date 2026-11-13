import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { canAccessProject, canAccessTask } from '../utils/access.js';
import { eventsSince } from '../services/realtimeService.js';

const onlineUsers = new Map();

async function canJoinRoom(user, room) {
  const projectMatch = /^project:(\d+)$/.exec(room);
  if (projectMatch) return canAccessProject(user, Number(projectMatch[1]));
  const taskMatch = /^task:(\d+)$/.exec(room);
  if (taskMatch) return (await canAccessTask(user, Number(taskMatch[1]))).allowed;
  return false;
}

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
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const userId = user.userId;
    const connections = onlineUsers.get(userId) ?? new Set();
    const wasOffline = connections.size === 0;
    connections.add(socket.id);
    onlineUsers.set(userId, connections);
    if (wasOffline) io.emit('user:online', { userId });

    socket.join(`user:${userId}`);

    socket.on('users:get_online', (ack) => {
      if (ack) ack(Array.from(onlineUsers.keys()));
    });

    socket.on('room:join', async (room, ack) => {
      try {
        if (typeof room !== 'string' || !(await canJoinRoom(user, room))) {
          if (ack) ack({ ok: false, error: 'forbidden' });
          return;
        }
        await socket.join(room);
        if (ack) ack({ ok: true });
      } catch (error) {
        console.error('Socket room join failed:', error);
        if (ack) ack({ ok: false, error: 'internal_error' });
      }
    });

    socket.on('room:leave', async (room, ack) => {
      if (typeof room !== 'string' || !/^(project|task):\d+$/.test(room)) {
        if (ack) ack({ ok: false, error: 'invalid_room' });
        return;
      }
      await socket.leave(room);
      if (ack) ack({ ok: true });
    });

    socket.on('events:recover', async ({ room, afterId } = {}, ack) => {
      try {
        if (typeof room !== 'string' || !(await canJoinRoom(user, room))) {
          if (ack) ack({ ok: false, error: 'forbidden' });
          return;
        }
        const events = await eventsSince(room, afterId);
        if (ack) ack({ ok: true, events });
      } catch (error) {
        console.error('Socket event recovery failed:', error);
        if (ack) ack({ ok: false, error: 'recovery_failed' });
      }
    });

    socket.on('disconnect', () => {
      const activeConnections = onlineUsers.get(userId);
      activeConnections?.delete(socket.id);
      if (activeConnections?.size === 0) {
        onlineUsers.delete(userId);
        io.emit('user:offline', { userId });
      }
    });
  });

  return io;
}