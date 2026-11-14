import { prisma } from '../db.js';
import { removeUsersFromProjectRooms } from '../services/realtimeService.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';

const SORTABLE = ['createdAt', 'name'];
const teamInclude = {
  owner: { select: { id: true, name: true, email: true } },
  members: { select: { id: true, name: true, email: true, role: true } },
  _count: { select: { projects: true } },
};

function teamVisibility(user) {
  if (user.role === 'ADMIN') return {};
  return {
    OR: [
      { ownerId: user.userId },
      { members: { some: { id: user.userId } } },
    ],
  };
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateMemberIds(value) {
  if (!Array.isArray(value) || value.some((id) => !Number.isInteger(Number(id)) || Number(id) < 1)) {
    return null;
  }
  return [...new Set(value.map(Number))];
}

async function removeInvalidTaskAssignments(transaction, projects, memberIds) {
  for (const project of projects) {
    const allowedIds = [...new Set([...memberIds, ...(project.ownerId ? [project.ownerId] : [])])];
    await transaction.taskAssignment.deleteMany({
      where: {
        task: { projectId: project.id },
        ...(allowedIds.length ? { userId: { notIn: allowedIds } } : {}),
      },
    });
  }
}

async function revokeRemovedMembers(io, removedMembers, projects, allowedMemberIds) {
  await Promise.all(removedMembers.map(async (member) => {
    if (member.role === 'ADMIN' || allowedMemberIds.includes(member.id)) return;
    const memberProjectIds = projects
      .filter((project) => project.ownerId !== member.id)
      .map((project) => project.id);
    await removeUsersFromProjectRooms(io, [member.id], memberProjectIds);
  }));
}

export async function getTeams(req, res) {
  const { pageNumber, take, skip, orderField, orderDirection } = parseListQuery(req.query, SORTABLE);
  const filters = [teamVisibility(req.user)];
  if (req.query.search) {
    filters.push({ name: { contains: String(req.query.search), mode: 'insensitive' } });
  }
  const where = { AND: filters };
  const [data, total] = await Promise.all([
    prisma.team.findMany({
      where,
      skip,
      take,
      orderBy: { [orderField]: orderDirection },
      include: teamInclude,
    }),
    prisma.team.count({ where }),
  ]);
  res.json({ data, pagination: pageMeta(pageNumber, take, total, data.length) });
}

export async function getTeamById(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Некоректний ID команди' });
  const team = await prisma.team.findFirst({
    where: { id, ...teamVisibility(req.user) },
    include: { ...teamInclude, projects: { select: { id: true, name: true } } },
  });
  if (!team) return res.status(404).json({ error: 'Команду не знайдено' });
  res.json(team);
}

export async function createTeam(req, res) {
  const { name, description, memberIds = [] } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Назва команди має містити щонайменше 2 символи' });
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'Опис команди має бути текстом' });
  }
  const parsedMemberIds = validateMemberIds(memberIds);
  if (!parsedMemberIds) return res.status(400).json({ error: 'memberIds має бути масивом коректних ID' });
  const members = [...new Set([...parsedMemberIds, req.user.userId])];
  const existingMembers = await prisma.user.count({ where: { id: { in: members } } });
  if (existingMembers !== members.length) return res.status(400).json({ error: 'Один або кілька користувачів не знайдені' });

  const team = await prisma.team.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: req.user.userId,
      members: { connect: members.map((id) => ({ id })) },
    },
    include: teamInclude,
  });
  res.status(201).json(team);
}

export async function updateTeam(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Некоректний ID команди' });
  const existing = await prisma.team.findUnique({
    where: { id },
    include: {
      members: { select: { id: true, role: true } },
      projects: { select: { id: true, ownerId: true } },
    },
  });
  if (!existing) return res.status(404).json({ error: 'Команду не знайдено' });
  if (req.user.role !== 'ADMIN' && existing.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Змінювати склад команди може лише її власник або адміністратор' });
  }

  const { name, description, memberIds } = req.body ?? {};
  const data = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Назва команди має містити щонайменше 2 символи' });
    }
    data.name = name.trim();
  }
  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return res.status(400).json({ error: 'Опис команди має бути текстом' });
    }
    data.description = description?.trim() || null;
  }

  let nextMemberIds = existing.members.map((member) => member.id);
  if (memberIds !== undefined) {
    const parsedMemberIds = validateMemberIds(memberIds);
    if (!parsedMemberIds) return res.status(400).json({ error: 'memberIds має бути масивом коректних ID' });
    nextMemberIds = [...new Set([...parsedMemberIds, ...(existing.ownerId ? [existing.ownerId] : [])])];
    const existingMembers = await prisma.user.count({ where: { id: { in: nextMemberIds } } });
    if (existingMembers !== nextMemberIds.length) return res.status(400).json({ error: 'Один або кілька користувачів не знайдені' });
    data.members = { set: nextMemberIds.map((memberId) => ({ id: memberId })) };
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Не передано полів для оновлення' });

  const team = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.team.update({
      where: { id },
      data,
      include: teamInclude,
    });
    if (memberIds !== undefined) {
      await removeInvalidTaskAssignments(transaction, existing.projects, nextMemberIds);
    }
    return updated;
  });

  if (memberIds !== undefined) {
    const removedMembers = existing.members.filter((member) => !nextMemberIds.includes(member.id));
    await revokeRemovedMembers(req.app.get('io'), removedMembers, existing.projects, nextMemberIds);
  }
  res.json(team);
}

export async function deleteTeam(req, res) {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Некоректний ID команди' });
  const existing = await prisma.team.findUnique({
    where: { id },
    include: {
      members: { select: { id: true, role: true } },
      projects: { select: { id: true, ownerId: true } },
    },
  });
  if (!existing) return res.status(404).json({ error: 'Команду не знайдено' });
  if (req.user.role !== 'ADMIN' && existing.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Видалити команду може лише її власник або адміністратор' });
  }

  await prisma.$transaction(async (transaction) => {
    await removeInvalidTaskAssignments(transaction, existing.projects, []);
    await transaction.team.delete({ where: { id } });
  });
  await revokeRemovedMembers(req.app.get('io'), existing.members, existing.projects, []);
  res.status(204).end();
}
