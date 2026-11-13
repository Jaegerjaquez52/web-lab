import { prisma } from '../db.js';
import { createNotification } from '../services/notificationService.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';
import { canAccessTask } from '../utils/access.js';
import { publish } from '../services/realtimeService.js';

export async function getComments(req, res) {
  const taskId = Number(req.query.taskId);
  if (!Number.isInteger(taskId) || taskId < 1) return res.status(400).json({ error: 'Коректний taskId є обов’язковим' });
  const access = await canAccessTask(req.user, taskId);
  if (!access.exists) return res.status(404).json({ error: 'Завдання не знайдено' });
  if (!access.allowed) return res.status(403).json({ error: 'Недостатньо прав для перегляду коментарів' });
  const { pageNumber, take, skip } = parseListQuery(req.query, ['createdAt']);
  const [data, total] = await Promise.all([
    prisma.comment.findMany({
      where: { taskId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.comment.count({ where: { taskId } }),
  ]);
  res.json({ data, pagination: pageMeta(pageNumber, take, total, data.length) });
}

export async function addComment(req, res) {
  const { taskId: rawTaskId, text } = req.body ?? {};
  const taskId = Number(rawTaskId);
  const userId = req.user.userId;

  if (!Number.isInteger(taskId) || taskId < 1 || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'ID завдання та текст є обов\'язковими' });
  }

  const access = await canAccessTask(req.user, taskId);
  if (!access.exists) return res.status(404).json({ error: 'Завдання не знайдено' });
  if (!access.allowed) return res.status(403).json({ error: 'Недостатньо прав для коментування завдання' });

  const comment = await prisma.comment.create({
    data: { text: text.trim(), taskId, userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const task = await prisma.task.findUnique({ where: { id: taskId } });

  if (task?.projectId) {
    await publish(req.app.get('io'), `project:${task.projectId}`, 'comment:created', comment);
  }
  if (task?.assigneeId && task.assigneeId !== userId) {
    await createNotification(req.app.get('io'), task.assigneeId, `Новий коментар до завдання "${task.title}"`, 'COMMENT_ADDED');
  }

  res.status(201).json(comment);
}

export async function deleteComment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID коментаря' });
  const comment = await prisma.comment.findUnique({ where: { id }, include: { task: true } });
  if (!comment) return res.status(404).json({ error: 'Коментар не знайдено' });
  const isAuthor = comment.userId === req.user.userId;
  const isProjectOwner = comment.task.projectId
    ? await canAccessTask(req.user, comment.taskId, { ownerOnly: true })
    : { allowed: false };
  if (!isAuthor && req.user.role !== 'ADMIN' && !isProjectOwner.allowed) {
    return res.status(403).json({ error: 'Недостатньо прав для видалення коментаря' });
  }
  await prisma.comment.delete({ where: { id } });
  if (comment.task.projectId) {
    await publish(req.app.get('io'), `project:${comment.task.projectId}`, 'comment:deleted', { id, taskId: comment.taskId });
  }
  res.status(204).end();
}