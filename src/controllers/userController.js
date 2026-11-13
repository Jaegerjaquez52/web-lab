import { prisma } from '../db.js';
import { hashPassword } from '../utils/password.js';
import { pageMeta, parseListQuery } from '../utils/pagination.js';
import { logAction } from '../services/auditService.js';

const SORTABLE = ['createdAt', 'name', 'email', 'role'];
const ROLES = ['USER', 'ADMIN', 'MODERATOR'];

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
};

function validateIdentity({ email, name, password }, { passwordRequired }) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Вкажіть коректний email';
  if (typeof name !== 'string' || name.trim().length < 2) return "Ім'я має містити мінімум 2 символи";
  if (passwordRequired && (typeof password !== 'string' || password.length < 8)) {
    return 'Пароль має містити мінімум 8 символів';
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
    return 'Пароль має містити мінімум 8 символів';
  }
  return null;
}

function parseUserId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function getUsers(req, res) {
  const { pageNumber, take, skip, orderField, orderDirection } = parseListQuery(req.query, SORTABLE);
  const where = {};

  if (req.query.search) {
    const search = String(req.query.search);
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (req.query.role) {
    if (!ROLES.includes(req.query.role)) return res.status(400).json({ error: 'Невідома роль' });
    where.role = req.query.role;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      skip,
      take,
      orderBy: { [orderField]: orderDirection },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ data: users, pagination: pageMeta(pageNumber, take, total, users.length) });
}

export async function getUserById(req, res) {
  const id = parseUserId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Некоректний ID користувача' });
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });
  res.json(user);
}

export async function createUser(req, res) {
  const { email, name, password, role = 'USER' } = req.body ?? {};
  const error = validateIdentity({ email, name, password }, { passwordRequired: true });
  if (error) return res.status(400).json({ error });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Невідома роль' });
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ error: 'Користувач з таким email вже існує' });

  const user = await prisma.user.create({
    data: { email: normalizedEmail, name: name.trim(), password: await hashPassword(password), role },
    select: userSelect,
  });

  logAction(req.user.userId, 'CREATE', 'User', user.id);
  res.status(201).json(user);
}

export async function updateUser(req, res) {
  const id = parseUserId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Некоректний ID користувача' });
  const isSelf = req.user.userId === id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isSelf && !isAdmin) {
    return res.status(403).json({ error: 'Недостатньо прав для виконання цієї операції' });
  }

  const { email, name, password, role } = req.body ?? {};
  const currentUser = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!currentUser) return res.status(404).json({ error: 'Користувача не знайдено' });
  const error = validateIdentity({ email, name, password }, { passwordRequired: false });
  if (error) return res.status(400).json({ error });
  if (role && !isAdmin) return res.status(403).json({ error: 'Лише адміністратор змінює роль' });
  if (role && !ROLES.includes(role)) return res.status(400).json({ error: 'Невідома роль' });
  const normalizedEmail = email.trim().toLowerCase();
  const data = {
    email: normalizedEmail,
    name: name.trim(),
    ...(role && isAdmin ? { role } : {}),
  };
  if (password) data.password = await hashPassword(password);

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: { id },
        data,
        select: userSelect,
      });
      if (password || (role && isAdmin)) {
        await transaction.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updatedUser;
    });
    logAction(req.user.userId, 'UPDATE', 'User', id);
    res.json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Користувач з таким email вже існує' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Користувача не знайдено' });
    throw err;
  }
}

export async function deleteUser(req, res) {
  const id = parseUserId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Некоректний ID користувача' });
  if (req.user.userId === id) {
    return res.status(400).json({ error: 'Не можна видалити власний обліковий запис' });
  }

  try {
    await prisma.user.delete({ where: { id } });
    logAction(req.user.userId, 'DELETE', 'User', id);
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Користувача не знайдено' });
    throw err;
  }
}
