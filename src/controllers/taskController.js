import fs from 'node:fs/promises';
import { prisma } from '../db.js';
import { createNotification } from '../services/notificationService.js';
import { publish } from '../services/realtimeService.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';
import { canAccessProject, canAccessTask } from '../utils/access.js';

const SORTABLE_FIELDS = ['createdAt', 'title', 'status'];
const personSelect = { id: true, name: true, email: true };
const taskInclude = {
  project: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      teamId: true,
      team: {
        select: {
          ownerId: true,
          members: { select: personSelect },
        },
      },
    },
  },
  assignments: { include: { user: { select: personSelect } }, orderBy: { createdAt: 'asc' } },
};

function taskVisibility(user) {
  if (user.role === 'ADMIN') return {};
  return {
    OR: [
      { project: { is: { ownerId: user.userId } } },
      {
        project: {
          is: {
            team: {
              is: {
                OR: [
                  { ownerId: user.userId },
                  { members: { some: { id: user.userId } } },
                ],
              },
            },
          },
        },
      },
      { projectId: null, assignments: { some: { userId: user.userId } } },
    ],
  };
}

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

  const { pageNumber, take, skip, orderField, orderDirection } = parseListQuery(
    { page, limit, sortBy, order },
    SORTABLE_FIELDS
  );
  const filters = [];
  if (search) {
    filters.push({
      OR: [
        { title: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ],
    });
  }
  if (status) {
    if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(String(status))) {
      return res.status(400).json({ error: 'Невідомий статус завдання' });
    }
    filters.push({ status: String(status) });
  }
  if (projectId) {
    const projectNumber = Number(projectId);
    if (!Number.isInteger(projectNumber) || projectNumber < 1) {
      return res.status(400).json({ error: 'Некоректний ID проєкту' });
    }
    if (!(await canAccessProject(req.user, projectNumber))) {
      return res.status(403).json({ error: 'Недостатньо прав для перегляду проєкту' });
    }
    filters.push({ projectId: projectNumber });
  }
  const visibility = taskVisibility(req.user);
  const where = Object.keys(visibility).length
    ? { AND: [visibility, ...filters] }
    : filters.length ? { AND: filters } : {};

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take,
      orderBy: { [orderField]: orderDirection },
      include: taskInclude,
    }),
    prisma.task.count({ where }),
  ]);
  res.json({ data: tasks, pagination: pageMeta(pageNumber, take, total, tasks.length) });
}

export async function getTaskById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID завдання' });
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      ...taskInclude,
      comments: true,
      files: true,
    },
  });
  if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });
  if (!(await canAccessTask(req.user, id)).allowed) {
    return res.status(403).json({ error: 'Недостатньо прав для перегляду завдання' });
  }
  res.json(task);
}

export async function createTask(req, res) {
  const { title, description, projectId, status = 'TODO' } = req.body ?? {};
  const projectNumber = Number(projectId);
  if (typeof title !== 'string' || !title.trim() || !Number.isInteger(projectNumber) || projectNumber < 1) {
    return res.status(400).json({ error: 'Коректні назва та ID проєкту є обов’язковими' });
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'Опис завдання має бути текстом' });
  }
  if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(status)) {
    return res.status(400).json({ error: 'Невідомий статус завдання' });
  }
  const projectExists = await prisma.project.findUnique({ where: { id: projectNumber }, select: { id: true } });
  if (!projectExists) return res.status(404).json({ error: 'Проєкт не знайдено' });
  if (!(await canAccessProject(req.user, projectNumber))) {
    return res.status(403).json({ error: 'Недостатньо прав для створення завдання у проєкті' });
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      status,
      projectId: projectNumber,
    },
    include: taskInclude,
  });
  await publish(req.app.get('io'), `project:${projectNumber}`, 'task:created', task);
  res.status(201).json(task);
}

export async function updateTask(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID завдання' });
  const current = await prisma.task.findUnique({
    where: { id },
    include: { assignments: { select: { userId: true } } },
  });
  if (!current) return res.status(404).json({ error: 'Завдання не знайдено' });
  if (!(await canAccessTask(req.user, id)).allowed) {
    return res.status(403).json({ error: 'Недостатньо прав для оновлення завдання' });
  }

  const { title, description, status } = req.body ?? {};
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
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Не передано полів для оновлення' });

  const updatedTask = await prisma.task.update({
    where: { id },
    data,
    include: taskInclude,
  });
  if (updatedTask.projectId) {
    await publish(req.app.get('io'), `project:${updatedTask.projectId}`, 'task:updated', updatedTask);
  }
  await Promise.all(current.assignments
    .filter(({ userId }) => userId !== req.user.userId)
    .map(({ userId }) => createNotification(
      req.app.get('io'),
      userId,
      `Завдання "${updatedTask.title}" оновлено`,
      'INFO',
    )));
  res.json(updatedTask);
}

export async function setTaskClaim(req, res) {
  const id = Number(req.params.id);
  const { claimed } = req.body ?? {};
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID завдання' });
  if (typeof claimed !== 'boolean') return res.status(400).json({ error: 'Поле claimed має бути логічним значенням' });

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!task) return res.status(404).json({ error: 'Завдання не знайдено' });
  if (!task.projectId) return res.status(400).json({ error: 'Для позначення виконавців завдання має належати проєкту' });

  const project = await prisma.project.findUnique({
    where: { id: task.projectId },
    select: {
      ownerId: true,
      team: {
        select: {
          ownerId: true,
          members: { where: { id: req.user.userId }, select: { id: true } },
        },
      },
    },
  });
  const canClaim = project?.ownerId === req.user.userId
    || project?.team?.ownerId === req.user.userId
    || Boolean(project?.team?.members.length);
  if (!canClaim) return res.status(403).json({ error: 'Позначити себе виконавцем може лише учасник команди проєкту' });

  if (claimed) {
    await prisma.taskAssignment.upsert({
      where: { taskId_userId: { taskId: id, userId: req.user.userId } },
      create: { taskId: id, userId: req.user.userId },
      update: {},
    });
  } else {
    await prisma.taskAssignment.deleteMany({ where: { taskId: id, userId: req.user.userId } });
  }

  const updatedTask = await prisma.task.findUnique({ where: { id }, include: taskInclude });
  await publish(req.app.get('io'), `project:${task.projectId}`, 'task:updated', updatedTask);
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
