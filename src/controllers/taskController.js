import { prisma } from '../db.js';
import { createNotification } from '../services/notificationService.js';

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
  const pageNumber = Math.max(Number(page) || 1, 1);
  const take = Math.min(Math.max(Number(limit) || 10, 1), 100);
  const skip = (pageNumber - 1) * take;

  const where = {};

  // Пошук за ключовими словами
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Фільтрація
  if (status) {
    where.status = status;
  }
  if (projectId) {
    where.projectId = Number(projectId);
  }

  // Сортування
  const orderField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
  const orderDirection = order === 'asc' ? 'asc' : 'desc';

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
    pagination: {
      page: pageNumber,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
      hasMore: skip + tasks.length < total,
    },
  });
}

export async function createTask(req, res) {
  const { title, description, projectId, status } = req.body;
  
  if (!title || !projectId) {
    return res.status(400).json({ error: 'Назва та ID проєкту є обов\'язковими' });
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      status,
      projectId: Number(projectId),
      assigneeId: req.user.userId 
    }
  });

  res.status(201).json(task);
}

export async function updateTask(req, res) {
  const { id } = req.params;
  const { title, description, status, assigneeId } = req.body;

  try {
    const updatedTask = await prisma.task.update({
      where: { id: Number(id) },
      data: { 
        title, 
        description, 
        status, 
        assigneeId: assigneeId ? Number(assigneeId) : undefined 
      },
    });

    // --- WebSocket сповіщення ---
    const io = req.app.get('io'); 

    if (updatedTask.projectId) {
      io.to(`project:${updatedTask.projectId}`).emit('task:updated', updatedTask);
    }

    if (updatedTask.assigneeId && updatedTask.assigneeId !== req.user.userId) {
      await createNotification(
        io, 
        updatedTask.assigneeId, 
        `Завдання "${updatedTask.title}" було оновлено!`, 
        'INFO'
      );
    }

    res.json(updatedTask);
  } catch (error) {
    res.status(404).json({ error: 'Завдання не знайдено' });
  }
}