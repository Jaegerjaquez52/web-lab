// Валідація вхідних даних користувача при реєстрації
const validateUser = (data) => {
  const errors = [];
  
  if (!data.email || !data.email.includes('@')) {
    errors.push('Вкажіть коректний email.');
  }
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Ім\'я має містити мінімум 2 символи.');
  }
  if (!data.password || data.password.length < 6) {
    errors.push('Пароль має містити мінімум 6 символів.');
  }
  
  return errors;
};

module.exports = { validateUser };