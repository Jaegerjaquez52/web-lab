const User = require('../models/User');
const { validateUser } = require('../utils/validation');

class UserController {
  static async createUser(req, res) {
    try {
      const errors = validateUser(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      const newUser = await User.createUser(req.body);
      res.status(201).json(newUser);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Користувач з таким email вже існує' });
      }
      res.status(500).json({ error: 'Помилка сервера при створенні користувача' });
    }
  }

  static async getUsers(req, res) {
    try {
      const users = await User.getAllUsers();
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ error: 'Помилка сервера при отриманні користувачів' });
    }
  }

  static async getUserById(req, res) {
    try {
      const user = await User.getUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'Користувача не знайдено' });
      }
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ error: 'Помилка сервера' });
    }
  }

  static async updateUser(req, res) {
    try {
      const user = await User.updateUser(req.params.id, req.body);
      res.status(200).json(user);
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Користувача не знайдено' });
      }
      res.status(500).json({ error: 'Помилка сервера при оновленні' });
    }
  }

  static async deleteUser(req, res) {
    try {
      await User.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Користувача не знайдено' });
      }
      res.status(500).json({ error: 'Помилка сервера при видаленні' });
    }
  }
}

module.exports = UserController;