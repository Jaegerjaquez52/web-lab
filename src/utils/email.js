import nodemailer from 'nodemailer';

// Відправлення email для відновлення паролю
export async function sendPasswordResetEmail(userEmail, resetToken) {
  // Створення тестового акаунта Ethereal для середовища розробки
  const testAccount = await nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  const mailOptions = {
    from: '"Task Manager API" <noreply@taskmanager.com>',
    to: userEmail,
    subject: "Відновлення паролю",
    text: `Ваш токен для відновлення паролю: ${resetToken}\n\nВін дійсний 1 годину. Якщо ви не надсилали цей запит, проігноруйте цей лист.`,
  };

  const info = await transporter.sendMail(mailOptions);
  
  // Логування посилання на тестовий лист
  console.log("Лист надіслано! Переглянути його можна за посиланням: %s", nodemailer.getTestMessageUrl(info));
}