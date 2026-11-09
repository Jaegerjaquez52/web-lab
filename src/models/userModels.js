const prisma = require('../utils/prisma');

// Модель для роботи з базою даних сутності User
class UserModel {
  // Створення нового користувача
  static async createUser(data) {
    return await prisma.user.create({
      data: data
    });
  }

  // Отримання списку всіх користувачів
  static async getAllUsers() {
    return await prisma.user.findMany();
  }

  // Пошук користувача за унікальним ідентифікатором
  static async getUserById(id) {
    return await prisma.user.findUnique({
      where: { id: Number(id) } 
    });
  }

  // Оновлення даних користувача
  static async updateUser(id, data) {
    return await prisma.user.update({
      where: { id: Number(id) },
      data: data
    });
  }

  // Видалення користувача з бази даних
  static async deleteUser(id) {
    return await prisma.user.delete({
      where: { id: Number(id) }
    });
  }
}

module.exports = UserModel;