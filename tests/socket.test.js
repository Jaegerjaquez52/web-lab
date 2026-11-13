import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io as connect } from 'socket.io-client';
import request from 'supertest';
import app from '../src/app.js';
import { initSocket } from '../src/socket/index.js';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/db.js';
import { publish } from '../src/services/realtimeService.js';

const generateAccessToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '15m' });
};

const testEmail = (userId) => `socket-test-${userId}@example.com`;
let alice;
let bob;
let outsider;
let project;
let task;

before(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [testEmail(1), testEmail(2), testEmail(3)] } } });
  alice = await prisma.user.create({
    data: { email: testEmail(1), name: 'Socket Alice', password: 'test-password' },
  });
  bob = await prisma.user.create({
    data: { email: testEmail(2), name: 'Socket Bob', password: 'test-password' },
  });
  outsider = await prisma.user.create({
    data: { email: testEmail(3), name: 'Socket Outsider', password: 'test-password' },
  });
  project = await prisma.project.create({
    data: { name: 'Socket test project', ownerId: alice.id, members: { connect: { id: bob.id } } },
  });
  task = await prisma.task.create({
    data: { title: 'Socket test task', projectId: project.id, assigneeId: bob.id },
  });
});

const httpServer = createServer(app);
const io = initSocket(httpServer);
app.set('io', io);

httpServer.listen(0);
await once(httpServer, 'listening');
const url = `http://localhost:${httpServer.address().port}`;
const clients = [];

after(async () => {
  clients.forEach((c) => c.close());
  await new Promise((resolve) => io.close(resolve));
  if (project) {
    await prisma.realtimeEvent.deleteMany({ where: { room: `project:${project.id}` } });
    await prisma.task.deleteMany({ where: { projectId: project.id } });
    await prisma.project.deleteMany({ where: { id: project.id } });
  }
  if (alice && bob && outsider) {
    await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id, outsider.id] } } });
  }
  await prisma.$disconnect();
});

test('Підключення без токена відхиляється', async () => {
  const client = connect(url, { auth: {}, reconnection: false });
  clients.push(client);
  const [error] = await once(client, 'connect_error');
  assert.equal(error.message, 'unauthorized');
});

test('Завдання, коментарі, онлайн-статус і сповіщення працюють у реальному часі', async () => {
  const aliceClient = connect(url, {
    auth: { token: generateAccessToken(alice.id, 'USER') },
    autoConnect: false,
  });
  clients.push(aliceClient);
  const aliceConnected = once(aliceClient, 'connect');
  aliceClient.connect();
  await aliceConnected;

  const bobOnline = once(aliceClient, 'user:online');
  const bobClient = connect(url, {
    auth: { token: generateAccessToken(bob.id, 'USER') },
    autoConnect: false,
  });
  clients.push(bobClient);
  const bobConnected = once(bobClient, 'connect');
  bobClient.connect();
  const [bobOnlinePayload] = await bobOnline;
  await bobConnected;
  assert.deepEqual(bobOnlinePayload, { userId: bob.id });

  const outsiderClient = connect(url, {
    auth: { token: generateAccessToken(outsider.id, 'USER') },
    autoConnect: false,
  });
  clients.push(outsiderClient);
  const outsiderConnected = once(outsiderClient, 'connect');
  outsiderClient.connect();
  await outsiderConnected;

  const onlineUserIds = await aliceClient.emitWithAck('users:get_online');
  assert.ok(onlineUserIds.includes(alice.id));
  assert.ok(onlineUserIds.includes(bob.id));

  const room = `project:${project.id}`;
  const joined = await aliceClient.emitWithAck('room:join', room);
  assert.deepEqual(joined, { ok: true });
  assert.deepEqual(await bobClient.emitWithAck('room:join', room), { ok: true });
  assert.deepEqual(await outsiderClient.emitWithAck('room:join', room), { ok: false, error: 'forbidden' });

  const got = once(aliceClient, 'task:updated');
  const bobGot = once(bobClient, 'task:updated');
  const event = await publish(io, room, 'task:updated', { id: 5, status: 'DONE' });
  const [[payload], [bobPayload]] = await Promise.all([got, bobGot]);
  assert.deepEqual(payload, { id: 5, status: 'DONE', _eventId: event.id, _room: room });
  assert.deepEqual(bobPayload, payload);
  const recovered = await aliceClient.emitWithAck('events:recover', { room, afterId: 0 });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.events[0].event, 'task:updated');
  assert.equal(recovered.events[0].payload._eventId, event.id);

  const commentEvent = once(bobClient, 'comment:created');
  const personal = once(bobClient, 'notification');
  const commentResponse = await request(app)
    .post('/api/comments')
    .set('Authorization', `Bearer ${generateAccessToken(alice.id, 'USER')}`)
    .send({ taskId: task.id, text: 'Realtime comment' });
  assert.equal(commentResponse.status, 201);
  const [commentPayload] = await commentEvent;
  assert.equal(commentPayload.id, commentResponse.body.id);
  assert.equal(commentPayload.text, 'Realtime comment');
  assert.equal(commentPayload._room, room);
  const [notificationPayload] = await personal;
  assert.equal(notificationPayload.type, 'COMMENT_ADDED');
  assert.equal(notificationPayload._room, `user:${bob.id}`);

  const bobOffline = once(aliceClient, 'user:offline');
  bobClient.disconnect();
  assert.deepEqual((await bobOffline)[0], { userId: bob.id });
});