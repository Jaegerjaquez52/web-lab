const prisma = require('../utils/prisma');

// Модель для роботи з базою даних сутності Task
class TaskModel {
  // Створення нового завдання
  static async createTask(data) {
    return await prisma.task.create({
      data: data
    });
  }

  // Отримання списку всіх завдань із пов'язаними сутностями
  static async getAllTasks() {
    return await prisma.task.findMany({
      include: { assignee: true, project: true }
    });
  }

  // Пошук завдання за унікальним ідентифікатором
  static async getTaskById(id) {
    return await prisma.task.findUnique({
      where: { id: Number(id) },
      include: { assignee: true, project: true }
    });
  }

  // Оновлення існуючого завдання
  static async updateTask(id, data) {
    return await prisma.task.update({
      where: { id: Number(id) },
      data: data
    });
  }

  // Видалення завдання з бази даних
  static async deleteTask(id) {
    return await prisma.task.delete({
      where: { id: Number(id) }
    });
  }
}

module.exports = TaskModel;