import { createHash } from 'node:crypto';
import { prisma } from '../db.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { randomBytes } from 'node:crypto';
import * as otplib from 'otplib';
const { authenticator } = otplib;
import qrcode from 'qrcode';
import { sendPasswordResetEmail } from '../utils/email.js';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Генерація токенів та збереження хешу refresh-токена в БД
async function issueTokens(user) {
  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);
  const { exp } = verifyRefreshToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256(refreshToken),
      userId: user.id,
      expiresAt: new Date(exp * 1000),
    },
  });

  return { accessToken, refreshToken };
}

// --- Базова авторизація ---

export async function register(req, res) {
  const { email, password, name } = req.body ?? {};

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string' || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: "Email, пароль та ім'я є обов'язковими" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль має містити мінімум 8 символів' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    return res.status(409).json({ error: 'Користувач з таким email вже існує' });
  }

  const user = await prisma.user.create({
    data: { email: normalizedEmail, password: await hashPassword(password), name: name.trim() },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  res.status(201).json({
    message: 'Користувача успішно зареєстровано',
    user,
    tokens: await issueTokens(user),
  });
}

export async function login(req, res) {
  const { email, password, twoFactorToken } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: "Email та пароль є обов'язковими" });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  if (!user || !(await comparePassword(password, user.password))) {
    return res.status(401).json({ error: 'Невірний email або пароль' });
  }

  // Перевірка 2FA, якщо її увімкнено для користувача
  if (user.is2FAEnabled) {
    if (!twoFactorToken) {
      return res.status(403).json({ 
        error: 'Потрібна двофакторна аутентифікація',
        require2FA: true 
      });
    }
    
    const isValidToken = typeof twoFactorToken === 'string' && authenticator.verify({ token: twoFactorToken, secret: user.twoFactorSecret });
    if (!isValidToken) {
      return res.status(401).json({ error: 'Невірний код 2FA' });
    }
  }

  const { password: _password, twoFactorSecret, ...userWithoutPassword } = user;

  res.json({
    message: 'Успішний вхід',
    user: userWithoutPassword,
    tokens: await issueTokens(user),
  });
}

export async function refresh(req, res) {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh токен відсутній' });
  }

  try {
    verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: 'Недійсний refresh токен' });
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshToken) },
    include: { user: true },
  });

  // Захист від крадіжки: якщо токен вже відкликано, блокуємо всі токени користувача
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
    if (stored) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return res.status(401).json({ error: 'Недійсний refresh токен' });
  }

  // Ротація токенів
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  res.json({ tokens: await issueTokens(stored.user) });
}

export async function logout(req, res) {
  const { refreshToken } = req.body ?? {};

  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  res.status(204).end();
}

// --- Відновлення паролю ---

export async function forgotPassword(req, res) {
  const { email } = req.body ?? {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Вкажіть коректний email' });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  
  // Завжди повертаємо успіх для захисту від перебору email-адрес
  if (!user) {
    return res.json({ message: 'Якщо email існує, на нього відправлено інструкції' });
  }

  const resetToken = randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 година

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  });

  await sendPasswordResetEmail(user.email, resetToken);

  res.json({ message: 'Якщо email існує, на нього відправлено інструкції' });
}

export async function resetPassword(req, res) {
  const { token, newPassword } = req.body ?? {};
  
  if (!token || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Невірні дані або пароль коротший за 8 символів' });
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    return res.status(400).json({ error: 'Токен недійсний або його термін дії минув' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(newPassword),
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  res.json({ message: 'Пароль успішно змінено' });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Поточний пароль та новий пароль мінімум з 8 символів є обов’язковими' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user || !(await comparePassword(currentPassword, user.password))) {
    return res.status(401).json({ error: 'Поточний пароль неправильний' });
  }
  await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  res.json({ message: 'Пароль змінено. Увійдіть знову.' });
}

// --- Двофакторна аутентифікація (2FA) ---

export async function generate2FA(req, res) {
  const secret = authenticator.generateSecret();
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });

  const otpauthUrl = authenticator.keyuri(user.email, 'Task Manager API', secret);
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

  // Збереження секрету до підтвердження активації
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret },
  });

  res.json({
    secret,
    qrCode: qrCodeDataUrl,
    message: 'Відскануйте QR-код у Google Authenticator та надішліть код підтвердження на /api/auth/2fa/verify'
  });
}

export async function verify2FA(req, res) {
  const { token } = req.body ?? {};
  if (typeof token !== 'string') return res.status(400).json({ error: 'Потрібно надати код' });

  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user?.twoFactorSecret) return res.status(400).json({ error: 'Спочатку згенеруйте секрет 2FA' });
  
  const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
  if (!isValid) {
    return res.status(400).json({ error: 'Невірний код 2FA' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { is2FAEnabled: true },
  });

  res.json({ message: 'Двофакторну аутентифікацію успішно увімкнено' });
}