import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';

export async function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не надано' });
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
  const file = await prisma.file.findUnique({ where: { id: Number(req.params.id) } });

  if (!file) {
    return res.status(404).json({ error: 'Файл не знайдено' });
  }

  res.sendFile(path.resolve(file.path));
}

export async function deleteFile(req, res) {
  const file = await prisma.file.findUnique({ where: { id: Number(req.params.id) } });

  if (!file) {
    return res.status(404).json({ error: 'Файл не знайдено' });
  }

  // Видалення дозволено автору файлу або адміністратору
  if (file.uploadedBy !== req.user.userId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Ви не маєте прав для видалення цього файлу' });
  }

  await prisma.file.delete({ where: { id: file.id } });
  await fs.unlink(file.path).catch(() => {});

  res.json({ message: 'Файл успішно видалено' });
}