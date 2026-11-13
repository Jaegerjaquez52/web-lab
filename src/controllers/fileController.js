import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';
import { canAccessFile, canAccessTask } from '../utils/access.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';

export async function listFiles(req, res) {
  const taskId = req.query.taskId == null ? undefined : Number(req.query.taskId);
  if (taskId !== undefined && (!Number.isInteger(taskId) || taskId < 1)) {
    return res.status(400).json({ error: 'Некоректний ID завдання' });
  }
  if (taskId !== undefined) {
    const access = await canAccessTask(req.user, taskId);
    if (!access.exists) return res.status(404).json({ error: 'Завдання не знайдено' });
    if (!access.allowed) return res.status(403).json({ error: 'Недостатньо прав для перегляду файлів' });
  }
  const { pageNumber, take, skip } = parseListQuery(req.query, ['createdAt']);
  const where = {
    ...(taskId === undefined ? {} : { taskId }),
    ...(req.user.role === 'ADMIN' || taskId !== undefined ? {} : { uploadedBy: req.user.userId }),
  };
  const [data, total] = await Promise.all([
    prisma.file.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: { id: true, filename: true, originalName: true, mimetype: true, size: true, uploadedBy: true, taskId: true, createdAt: true },
    }),
    prisma.file.count({ where }),
  ]);
  res.json({ data, pagination: pageMeta(pageNumber, take, total, data.length) });
}

export async function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не надано' });
  }

  const taskId = req.body.taskId == null || req.body.taskId === '' ? null : Number(req.body.taskId);
  if (taskId !== null) {
    if (!Number.isInteger(taskId) || taskId < 1) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Некоректний ID завдання' });
    }
    const access = await canAccessTask(req.user, taskId);
    if (!access.exists || !access.allowed) {
      await fs.unlink(req.file.path);
      return res.status(access.exists ? 403 : 404).json({ error: 'Немає доступу до завдання' });
    }
  }

  try {
    // Збереження метаданих завантаженого файлу в БД
    const file = await prisma.file.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        uploadedBy: req.user.userId,
        taskId,
      },
    });

    res.status(201).json({ message: 'Файл успішно завантажено', file });
  } catch (error) {
    // Видалення фізичного файлу з диска у разі помилки БД
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }
}

export async function getFile(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID файлу' });
  const file = await prisma.file.findUnique({ where: { id } });

  if (!file) {
    return res.status(404).json({ error: 'Файл не знайдено' });
  }
  if (!(await canAccessFile(req.user, file))) return res.status(403).json({ error: 'Недостатньо прав для перегляду файлу' });

  res.sendFile(path.resolve(file.path));
}

export async function deleteFile(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Некоректний ID файлу' });
  const file = await prisma.file.findUnique({ where: { id } });

  if (!file) {
    return res.status(404).json({ error: 'Файл не знайдено' });
  }

  if (req.user.role !== 'ADMIN' && file.uploadedBy !== req.user.userId) {
    return res.status(403).json({ error: 'Ви не маєте прав для видалення цього файлу' });
  }

  await fs.unlink(file.path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await prisma.file.delete({ where: { id: file.id } });

  res.json({ message: 'Файл успішно видалено' });
}