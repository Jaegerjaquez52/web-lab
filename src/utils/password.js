import argon2 from 'argon2';

// Хешування паролю за стандартом Argon2id
export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Перевірка відповідності введеного паролю та хешу з БД
export function comparePassword(password, hash) {
  return argon2.verify(hash, password);
}