import { prisma } from '../db.js';
import { createNotification } from '../services/notificationService.js';
import { publish } from '../services/realtimeService.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';
import { canAccessProject, canAccessTask } from '../utils/access.js';
import fs from 'node:fs/promises';

const SORTABLE_FIELDS = ['createdAt', 'title', 'status'];

export async function getTasks(req, res) {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    projectId,
    sortBy = 'createdAt',
    order = 'desc',
  } = req.query;

  // Налаштування пагінації
  const { pageNumber, take, skip, orderField, orderDirection } = parseListQuery(
    { page, limit, sortBy, order },
    SORTABLE_FIELDS
  );

  const visibility = req.user.role === 'ADMIN'
    ? {}
    : {
        OR: [
          { assigneeId: req.user.userId },
          { project: { ownerId: req.user.userId } },
          { project: { members: { some: { id: req.user.userId } } } },
        ],
      };
  const filters = {};

  // Пошук за ключовими словами
  if (search) {
    filters.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Фільтрація
  if (status) {
    if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(String(status))) {
      return res.status(400).json({ error: 'Невідомий статус завдання' });
    }
    filters.status = status;
  }
  if (projectId) {
    const projectNumber = Number(projectId);
    if (!Number.isInteger(projectNumber) || projectNumber < 1) {
      return res.status(400).json({ error: 'Некоректний ID проєкту' });
    }
    if (!(await canAccessProject(req.user, projectNumber))) {
      return res.status(403).json({ error: 'Недостатньо прав для перегляду проєкту' });
    }
    filters.projectId = projectNumber;
  }
  const where = Object.keys(visibility).length ? { AND: [visibility, filters] } : filters;

  // Сортування
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take,
      orderBy: { [orderField]: orderDirection },
      include: { 
        assignee: { 
          select: { id: true, name: true, email: true } 
        } 
      }
    }),
    prisma.task.count({ where }),
  ]);

  res.json({
    data: tasks,
    pagination: pageMeta(pageNumber, take, total, tasks.length),
  });
}

export async function getTaskById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID завдання' });
  const task = await prisma.task.findUnique({
    where: { id },
    include: { assignee: { select: { id: true, name: true, email: true } }, project: true, comments: true, files: true },
  });
  if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });
  if (!(await canAccessTask(req.user, id)).allowed) {
    return res.status(403).json({ error: 'Недостатньо прав для перегляду завдання' });
  }
  res.json(task);
}

export async function createTask(req, res) {
  const { title, description, projectId, status = 'TODO', assigneeId } = req.body ?? {};
  const projectNumber = Number(projectId);
  if (typeof title !== 'string' || !title.trim() || !Number.isInteger(projectNumber) || projectNumber < 1) {
    return res.status(400).json({ error: 'Коректні назва та ID проєкту є обов’язковими' });
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'Опис завдання має бути текстом' });
  }
  if (!(await canAccessProject(req.user, projectNumber))) {
    return res.status(403).json({ error: 'Недостатньо прав для створення завдання у проєкті' });
  }
  if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(status)) {
    return res.status(400).json({ error: 'Невідомий статус завдання' });
  }
  const assigneeNumber = assigneeId == null ? req.user.userId : Number(assigneeId);
  if (!Number.isInteger(assigneeNumber) || assigneeNumber < 1) return res.status(400).json({ error: 'Некоректний виконавець' });
  const project = await prisma.project.findUnique({
    where: { id: projectNumber },
    select: { ownerId: true, members: { select: { id: true } } },
  });
  if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
  if (assigneeNumber !== project.ownerId && !project.members.some((member) => member.id === assigneeNumber)) {
    return res.status(400).json({ error: 'Виконавець має бути власником або учасником проєкту' });
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      status,
      projectId: projectNumber,
      assigneeId: assigneeNumber,
    }
  });

  await publish(req.app.get('io'), `project:${projectNumber}`, 'task:created', task);
  res.status(201).json(task);
}

export async function updateTask(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID завдання' });
  const current = await prisma.task.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: 'Завдання не знайдено' });
  if (!(await canAccessTask(req.user, id)).allowed) {
    return res.status(403).json({ error: 'Недостатньо прав для оновлення завдання' });
  }

  const { title, description, status, assigneeId } = req.body ?? {};
  const data = {};
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Назва не може бути порожньою' });
    data.title = title.trim();
  }
  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return res.status(400).json({ error: 'Опис завдання має бути текстом' });
    }
    data.description = description?.trim() || null;
  }
  if (status !== undefined) {
    if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(status)) return res.status(400).json({ error: 'Невідомий статус завдання' });
    data.status = status;
  }
  if (assigneeId !== undefined) {
    if (assigneeId === null) {
      data.assigneeId = null;
    } else {
      const assignee = Number(assigneeId);
      if (!Number.isInteger(assignee) || assignee < 1) return res.status(400).json({ error: 'Некоректний виконавець' });
      if (current.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: current.projectId },
          select: { ownerId: true, members: { select: { id: true } } },
        });
        if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
        if (assignee !== project.ownerId && !project.members.some((member) => member.id === assignee)) {
          return res.status(400).json({ error: 'Виконавець має бути учасником проєкту' });
        }
      }
      data.assigneeId = assignee;
    }
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Не передано полів для оновлення' });

  const updatedTask = await prisma.task.update({ where: { id }, data });
  if (updatedTask.projectId) {
    await publish(req.app.get('io'), `project:${updatedTask.projectId}`, 'task:updated', updatedTask);
  }
  if (updatedTask.assigneeId && updatedTask.assigneeId !== req.user.userId) {
    await createNotification(req.app.get('io'), updatedTask.assigneeId, `Завдання "${updatedTask.title}" оновлено`, 'INFO');
  }
  res.json(updatedTask);
}

export async function deleteTask(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID завдання' });
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });
  if (!(await canAccessTask(req.user, id)).allowed) {
    return res.status(403).json({ error: 'Недостатньо прав для видалення завдання' });
  }
  const files = await prisma.file.findMany({ where: { taskId: id }, select: { path: true } });
  await Promise.all(files.map(({ path }) => fs.unlink(path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  })));
  await prisma.task.delete({ where: { id } });
  if (task.projectId) await publish(req.app.get('io'), `project:${task.projectId}`, 'task:deleted', { id });
  res.status(204).end();
}