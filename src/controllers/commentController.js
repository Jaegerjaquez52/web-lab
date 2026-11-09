import { prisma } from '../db.js';
import { createNotification } from '../services/notificationService.js';

export async function addComment(req, res) {
  const { taskId, text } = req.body;
  const userId = req.user.userId;

  if (!taskId || !text) {
    return res.status(400).json({ error: 'ID завдання та текст є обов\'язковими' });
  }

  try {
    const comment = await prisma.comment.create({
      data: { text, taskId: Number(taskId), userId },
      include: { user: { select: { id: true, name: true, email: true } } }
    });

    const task = await prisma.task.findUnique({ where: { id: Number(taskId) } });

    // --- WebSocket сповіщення ---
    if (task) {
      const io = req.app.get('io');
      
      // Розсилка події учасникам проєкту
      if (task.projectId) {
        io.to(`project:${task.projectId}`).emit('comment:added', comment);
      }
      
      // Персональне сповіщення виконавцю завдання
      if (task.assigneeId && task.assigneeId !== userId) {
        await createNotification(
          io, 
          task.assigneeId, 
          `Новий коментар до завдання "${task.title}": ${text.substring(0, 30)}...`, 
          'INFO'
        );
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Помилка при створенні коментаря' });
  }
}