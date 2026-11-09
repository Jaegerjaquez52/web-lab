const { PrismaClient } = require('@prisma/client');

// Ініціалізація клієнта бази даних
const prisma = new PrismaClient();

module.exports = prisma;