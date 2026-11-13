import { prisma } from '../db.js';

export async function canAccessProject(user, projectId, { ownerOnly = false } = {}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { where: { id: user.userId }, select: { id: true } } },
  });
  if (!project) return false;
  if (user.role === 'ADMIN') return true;
  return ownerOnly
    ? project.ownerId === user.userId
    : project.ownerId === user.userId || project.members.length > 0;
}

export async function canAccessTask(user, taskId, options) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, assigneeId: true },
  });
  if (!task) return { exists: false, allowed: false };
  if (task.projectId) {
    const projectAccess = await canAccessProject(user, task.projectId, options);
    return {
      exists: true,
      allowed: projectAccess || (!options?.ownerOnly && task.assigneeId === user.userId),
    };
  }
  return {
    exists: true,
    allowed: user.role === 'ADMIN' || task.assigneeId === user.userId,
  };
}

export async function canAccessFile(user, file) {
  if (user.role === 'ADMIN' || file.uploadedBy === user.userId) return true;
  if (!file.taskId) return false;
  return (await canAccessTask(user, file.taskId)).allowed;
}
