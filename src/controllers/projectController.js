import { prisma } from '../db.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';
import { publish } from '../services/realtimeService.js';

const SORTABLE = ['createdAt', 'updatedAt', 'name'];

function isAdmin(user) {
  return user.role === 'ADMIN';
}

function projectVisibility(user) {
  if (isAdmin(user)) return {};
  return {
    OR: [
      { ownerId: user.userId },
      { members: { some: { id: user.userId } } },
    ],
  };
}

export async function getProjects(req, res) {
  const { pageNumber, take, skip, orderField, orderDirection } = parseListQuery(req.query, SORTABLE);
  const where = projectVisibility(req.user);
  if (req.query.search) where.name = { contains: String(req.query.search), mode: 'insensitive' };
  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      orderBy: { [orderField]: orderDirection },
      include: { owner: { select: { id: true, name: true, email: true } }, _count: { select: { tasks: true, members: true } } },
    }),
    prisma.project.count({ where }),
  ]);
  res.json({ data, pagination: pageMeta(pageNumber, take, total, data.length) });
}

export async function getProjectById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID проєкту' });
  const project = await prisma.project.findFirst({
    where: { id, ...projectVisibility(req.user) },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { select: { id: true, name: true, email: true } },
      tasks: true,
    },
  });
  if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
  res.json(project);
}

export async function createProject(req, res) {
  const { name, description, memberIds = [] } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Назва проєкту має містити щонайменше 2 символи' });
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'Опис проєкту має бути текстом' });
  }
  if (!Array.isArray(memberIds) || memberIds.some((id) => !Number.isInteger(Number(id)) || Number(id) < 1)) {
    return res.status(400).json({ error: 'memberIds має бути масивом коректних ID' });
  }
  const members = [...new Set(memberIds.map(Number))].filter((id) => id !== req.user.userId);
  const existingMembers = await prisma.user.count({ where: { id: { in: members } } });
  if (existingMembers !== members.length) return res.status(400).json({ error: 'Один або кілька користувачів не знайдені' });
  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: req.user.userId,
      members: { connect: members.map((id) => ({ id })) },
    },
    include: { members: { select: { id: true, name: true, email: true } } },
  });
  await publish(req.app.get('io'), `project:${project.id}`, 'project:created', project);
  res.status(201).json(project);
}

export async function updateProject(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID проєкту' });
  const existing = await prisma.project.findUnique({
    where: { id },
    include: { members: { select: { id: true } } },
  });
  if (!existing) return res.status(404).json({ error: 'Проєкт не знайдено' });
  if (!isAdmin(req.user) && existing.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Редагувати проєкт може лише його власник або адміністратор' });
  }
  const { name, description, memberIds } = req.body ?? {};
  const data = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Назва проєкту має містити щонайменше 2 символи' });
    }
    data.name = name.trim();
  }
  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return res.status(400).json({ error: 'Опис проєкту має бути текстом' });
    }
    data.description = description?.trim() || null;
  }
  if (memberIds !== undefined) {
    if (!Array.isArray(memberIds) || memberIds.some((memberId) => !Number.isInteger(Number(memberId)) || Number(memberId) < 1)) {
      return res.status(400).json({ error: 'memberIds має бути масивом коректних ID' });
    }
    const uniqueMemberIds = [...new Set(memberIds.map(Number))].filter((memberId) => memberId !== existing.ownerId);
    const existingMembers = await prisma.user.count({ where: { id: { in: uniqueMemberIds } } });
    if (existingMembers !== uniqueMemberIds.length) return res.status(400).json({ error: 'Один або кілька користувачів не знайдені' });
    data.members = {
      set: uniqueMemberIds.map((memberId) => ({ id: memberId })),
    };
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Не передано полів для оновлення' });
  const project = await prisma.project.update({
    where: { id },
    data,
    include: { members: { select: { id: true, name: true, email: true } } },
  });
  if (memberIds !== undefined) {
    const io = req.app.get('io');
    const remainingIds = new Set(project.members.map((member) => member.id));
    await Promise.all(existing.members
      .filter((member) => !remainingIds.has(member.id))
      .map(async ({ id: memberId }) => {
        if (io) {
          const sockets = await io.in(`user:${memberId}`).fetchSockets();
          await Promise.all(sockets.map((socket) => socket.leave(`project:${id}`)));
        }
      }));
  }
  await publish(req.app.get('io'), `project:${id}`, 'project:updated', project);
  res.json(project);
}

export async function deleteProject(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID проєкту' });
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
  if (!isAdmin(req.user) && project.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Видалити проєкт може лише його власник або адміністратор' });
  }
  await prisma.project.delete({ where: { id } });
  await publish(req.app.get('io'), `project:${id}`, 'project:deleted', { id });
  res.status(204).end();
}
