import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io as connect } from 'socket.io-client';
import app from '../src/app.js';
import { initSocket } from '../src/socket/index.js';
import jwt from 'jsonwebtoken';

// Генеруємо фейковий токен для тестів (так само як у utils/jwt.js)
const generateAccessToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '15m' });
};

const httpServer = createServer(app);
const io = initSocket(httpServer);
app.set('io', io);

httpServer.listen(0);
await once(httpServer, 'listening');
const url = `http://localhost:${httpServer.address().port}`;
const clients = [];

after(() => {
  clients.forEach((c) => c.close());
  io.close();
});

test('Підключення без токена відхиляється', async () => {
  const client = connect(url, { auth: {}, reconnection: false });
  clients.push(client);
  const [error] = await once(client, 'connect_error');
  assert.equal(error.message, 'unauthorized');
});

test('Кімнати та персональні сповіщення працюють', async () => {
  const alice = connect(url, { auth: { token: generateAccessToken(1, 'USER') } });
  const bob = connect(url, { auth: { token: generateAccessToken(2, 'USER') } });
  clients.push(alice, bob);
  
  await Promise.all([once(alice, 'connect'), once(bob, 'connect')]);

  await alice.emitWithAck('room:join', 'project:7');

  // Подія в кімнату отримує лише той, хто до неї приєднався (Alice)
  const got = once(alice, 'task:updated');
  let bobGot = false;
  bob.on('task:updated', () => (bobGot = true));
  
  io.to('project:7').emit('task:updated', { id: 5, status: 'done' });
  const [payload] = await got;
  assert.deepEqual(payload, { id: 5, status: 'done' });

  // Персональне сповіщення надходить лише власнику (Bob)
  const personal = once(bob, 'notification');
  io.to('user:2').emit('notification', { text: 'привіт' });
  
  assert.deepEqual((await personal)[0], { text: 'привіт' });
  assert.equal(bobGot, false);
});