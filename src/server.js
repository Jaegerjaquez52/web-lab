import { createServer } from 'node:http';
import app from './app.js';
import { initSocket } from './socket/index.js';

const PORT = process.env.PORT || 3000;
const httpServer = createServer(app);

// Ініціалізація WebSocket-сервера та збереження інстансу для глобального доступу
app.set('io', initSocket(httpServer));

httpServer.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
  console.log(`Документація API: http://localhost:${PORT}/api-docs`);
});