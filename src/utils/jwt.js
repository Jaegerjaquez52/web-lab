import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

// Генерація токена доступу (Access Token)
export function generateAccessToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

// Генерація токена оновлення (Refresh Token) з унікальним ідентифікатором (jti)
export function generateRefreshToken(userId) {
  return jwt.sign({ userId, jti: randomUUID() }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
  });
}

// Верифікація токенів
export const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);