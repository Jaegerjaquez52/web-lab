import { prisma } from '../db.js';
import { canAccessTeam } from '../utils/access.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';
import { publish, removeUsersFromProjectRooms } from '../services/realtimeService.js';

const SORTABLE = ['createdAt', 'updatedAt', 'name'];
const personSelect = { id: true, name: true, email: true, role: true };
const projectInclude = {
  owner: { select: personSelect },
  team: {
    include: {
      owner: { select: personSelect },
      members: { select: personSelect },
      _count: { select: { projects: true } },
    },
  },
  _count: { select: { tasks: true } },
};

function isAdmin(user) {
  return user.role === 'ADMIN';
}

function projectVisibility(user) {
  if (isAdmin(user)) return {};
  return {
    OR: [
      { ownerId: user.userId },
      {
        team: {
          is: {
            OR: [
              { ownerId: user.userId },
              { members: { some: { id: user.userId } } },
            ],
          },
        },
      },
    ],
  };
}

async function findAccessibleTeam(user, value) {
  if (value === undefined || value === null || value === '') return null;
  const teamId = Number(value);
  if (!Number.isInteger(teamId) || teamId < 1) return { error: 'Некоректний ID команди' };
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, ownerId: true, members: { select: { id: true, role: true } } },
  });
  if (!team) return { notFound: true };
  if (!(await canAccessTeam(user, teamId))) return { forbidden: true };
  return team;
}

async function revokeAccessLostByTeamChange(io, existingProject, nextTeam) {
  const nextMemberIds = new Set([
    ...(existingProject.ownerId ? [existingProject.ownerId] : []),
    ...(nextTeam?.ownerId ? [nextTeam.ownerId] : []),
    ...(nextTeam?.members.map((member) => member.id) ?? []),
  ]);
  const previousMembers = [
    ...(existingProject.team?.members ?? []),
    ...(existingProject.team?.owner ? [existingProject.team.owner] : []),
  ];
  await Promise.all(previousMembers.map(async (member) => {
    if (member.role === 'ADMIN' || nextMemberIds.has(member.id) || member.id === existingProject.ownerId) return;
    await removeUsersFromProjectRooms(io, [member.id], [existingProject.id]);
  }));
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
      include: projectInclude,
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
    include: projectInclude,
  });
  if (!project) return res.status(404).json({ error: 'Проєкт не знайдено' });
  res.json(project);
}

export async function createProject(req, res) {
  const { name, description, teamId: rawTeamId } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Назва проєкту має містити щонайменше 2 символи' });
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'Опис проєкту має бути текстом' });
  }
  const team = await findAccessibleTeam(req.user, rawTeamId);
  if (team?.error) return res.status(400).json({ error: team.error });
  if (team?.notFound) return res.status(404).json({ error: 'Команду не знайдено' });
  if (team?.forbidden) return res.status(403).json({ error: 'Недостатньо прав для використання цієї команди' });

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: req.user.userId,
      teamId: team?.id ?? null,
    },
    include: projectInclude,
  });
  await publish(req.app.get('io'), `project:${project.id}`, 'project:created', project);
  res.status(201).json(project);
}

export async function updateProject(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID проєкту' });
  const existing = await prisma.project.findUnique({
    where: { id },
    include: {
      team: {
        include: {
          owner: { select: personSelect },
          members: { select: personSelect },
        },
      },
    },
  });
  if (!existing) return res.status(404).json({ error: 'Проєкт не знайдено' });
  if (!isAdmin(req.user) && existing.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Редагувати проєкт може лише його власник або адміністратор' });
  }

  const { name, description, teamId: rawTeamId } = req.body ?? {};
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

  let nextTeam = existing.team;
  if (rawTeamId !== undefined) {
    nextTeam = await findAccessibleTeam(req.user, rawTeamId);
    if (nextTeam?.error) return res.status(400).json({ error: nextTeam.error });
    if (nextTeam?.notFound) return res.status(404).json({ error: 'Команду не знайдено' });
    if (nextTeam?.forbidden) return res.status(403).json({ error: 'Недостатньо прав для використання цієї команди' });
    data.teamId = nextTeam?.id ?? null;
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Не передано полів для оновлення' });

  const project = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.project.update({
      where: { id },
      data,
      include: projectInclude,
    });
    if (rawTeamId !== undefined) {
      const allowedIds = [...new Set([
        ...(existing.ownerId ? [existing.ownerId] : []),
        ...(nextTeam?.ownerId ? [nextTeam.ownerId] : []),
        ...(nextTeam?.members.map((member) => member.id) ?? []),
      ])];
      await transaction.taskAssignment.deleteMany({
        where: {
          task: { projectId: id },
          ...(allowedIds.length ? { userId: { notIn: allowedIds } } : {}),
        },
      });
    }
    return updated;
  });

  if (rawTeamId !== undefined && existing.teamId !== project.teamId) {
    await revokeAccessLostByTeamChange(req.app.get('io'), existing, nextTeam);
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
