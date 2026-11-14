import { prisma } from '../db.js';

export async function canAccessTeam(user, teamId, { ownerOnly = false } = {}) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      ownerId: true,
      members: { where: { id: user.userId }, select: { id: true } },
    },
  });
  if (!team) return false;
  if (user.role === 'ADMIN') return true;
  return ownerOnly
    ? team.ownerId === user.userId
    : team.ownerId === user.userId || team.members.length > 0;
}

export async function canAccessProject(user, projectId, { ownerOnly = false } = {}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      team: {
        select: {
          ownerId: true,
          members: { where: { id: user.userId }, select: { id: true } },
        },
      },
    },
  });
  if (!project) return false;
  if (user.role === 'ADMIN') return true;
  if (ownerOnly) {
    return project.ownerId === user.userId || project.team?.ownerId === user.userId;
  }
  return project.ownerId === user.userId
    || project.team?.ownerId === user.userId
    || Boolean(project.team?.members.length);
}

export async function canAccessTask(user, taskId, options) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      projectId: true,
      assignments: { where: { userId: user.userId }, select: { userId: true } },
    },
  });
  if (!task) return { exists: false, allowed: false };
  if (task.projectId) {
    return {
      exists: true,
      allowed: await canAccessProject(user, task.projectId, options),
    };
  }
  return {
    exists: true,
    allowed: user.role === 'ADMIN' || task.assignments.length > 0,
  };
}

export async function canAccessFile(user, file) {
  if (user.role === 'ADMIN') return true;
  if (file.taskId) return (await canAccessTask(user, file.taskId)).allowed;
  return file.uploadedBy === user.userId;
}
