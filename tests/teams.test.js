import { randomUUID } from 'node:crypto';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/db.js';

const suffix = randomUUID();
const email = (name) => `${name}-${suffix}@example.com`;
const makeToken = (user) => jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET || 'test-secret',
  { expiresIn: '15m' },
);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

let owner;
let member;
let outsider;
let admin;
let ownerToken;
let memberToken;
let outsiderToken;
let adminToken;
let team;
let secondTeam;
let project;
let task;
let personalProject;

before(async () => {
  [owner, member, outsider, admin] = await Promise.all([
    prisma.user.create({ data: { email: email('owner'), name: 'Team Owner', password: 'test-password' } }),
    prisma.user.create({ data: { email: email('member'), name: 'Team Member', password: 'test-password' } }),
    prisma.user.create({ data: { email: email('outsider'), name: 'Team Outsider', password: 'test-password' } }),
    prisma.user.create({ data: { email: email('admin'), name: 'Team Admin', password: 'test-password', role: 'ADMIN' } }),
  ]);
  ownerToken = makeToken(owner);
  memberToken = makeToken(member);
  outsiderToken = makeToken(outsider);
  adminToken = makeToken(admin);

  const teamResponse = await request(app)
    .post('/api/teams')
    .set(auth(ownerToken))
    .send({ name: 'Private team', memberIds: [member.id] });
  assert.equal(teamResponse.status, 201);
  team = teamResponse.body;

  const projectResponse = await request(app)
    .post('/api/projects')
    .set(auth(ownerToken))
    .send({ name: 'Team project', teamId: team.id });
  assert.equal(projectResponse.status, 201);
  project = projectResponse.body;

  const taskResponse = await request(app)
    .post('/api/tasks')
    .set(auth(ownerToken))
    .send({ title: 'Team task', projectId: project.id });
  assert.equal(taskResponse.status, 201);
  task = taskResponse.body;
});

after(async () => {
  const projectIds = [project?.id, personalProject?.id].filter(Boolean);
  if (projectIds.length) {
    await prisma.realtimeEvent.deleteMany({ where: { room: { in: projectIds.map((id) => `project:${id}`) } } });
    await prisma.task.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  const teamIds = [team?.id, secondTeam?.id].filter(Boolean);
  if (teamIds.length) await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [owner?.id, member?.id, outsider?.id, admin?.id].filter(Boolean) } } });
  await prisma.$disconnect();
});

test('teams support multiple teams and expose only memberships to regular users', async () => {
  const secondTeamResponse = await request(app)
    .post('/api/teams')
    .set(auth(ownerToken))
    .send({ name: 'Another team' });
  assert.equal(secondTeamResponse.status, 201);
  secondTeam = secondTeamResponse.body;
  const ownerTeams = await request(app).get('/api/teams').set(auth(ownerToken));
  assert.equal(ownerTeams.body.data.length, 2);

  const memberTeams = await request(app).get('/api/teams').set(auth(memberToken));
  assert.equal(memberTeams.body.data.length, 1);
  const outsiderTeams = await request(app).get('/api/teams').set(auth(outsiderToken));
  assert.equal(outsiderTeams.body.data.length, 0);

  const forbiddenUpdate = await request(app)
    .patch(`/api/teams/${team.id}`)
    .set(auth(memberToken))
    .send({ memberIds: [] });
  assert.equal(forbiddenUpdate.status, 403);
});

test('projects and tasks are visible only to owners and team members', async () => {
  const ownerProjects = await request(app).get('/api/projects').set(auth(ownerToken));
  assert.ok(ownerProjects.body.data.some((item) => item.id === project.id));
  const memberProjects = await request(app).get('/api/projects').set(auth(memberToken));
  assert.ok(memberProjects.body.data.some((item) => item.id === project.id));
  const outsiderProjects = await request(app).get('/api/projects').set(auth(outsiderToken));
  assert.equal(outsiderProjects.body.data.length, 0);
  assert.equal((await request(app).get(`/api/projects/${project.id}`).set(auth(outsiderToken))).status, 404);
  assert.equal((await request(app).post('/api/projects').set(auth(outsiderToken)).send({
    name: 'Forbidden project',
    teamId: team.id,
  })).status, 403);

  const outsiderTasks = await request(app).get('/api/tasks').set(auth(outsiderToken));
  assert.equal(outsiderTasks.body.data.length, 0);
  assert.equal((await request(app).get(`/api/tasks/${task.id}`).set(auth(outsiderToken))).status, 403);
  const adminProjects = await request(app).get('/api/projects').set(auth(adminToken));
  assert.ok(adminProjects.body.data.some((item) => item.id === project.id));
});

test('project tasks can be claimed by multiple members, but only by their team', async () => {
  for (const token of [ownerToken, memberToken]) {
    const response = await request(app)
      .put(`/api/tasks/${task.id}/claim`)
      .set(auth(token))
      .send({ claimed: true });
    assert.equal(response.status, 200);
  }
  let assignments = await prisma.taskAssignment.findMany({ where: { taskId: task.id } });
  assert.deepEqual(new Set(assignments.map((assignment) => assignment.userId)), new Set([owner.id, member.id]));

  for (const [token, expectedCount] of [[ownerToken, 1], [memberToken, 1], [outsiderToken, 0]]) {
    const assignedTasks = await request(app)
      .get('/api/tasks?assignedToMe=true')
      .set(auth(token));
    assert.equal(assignedTasks.status, 200);
    assert.equal(assignedTasks.body.pagination.total, expectedCount);
    if (expectedCount) assert.ok(assignedTasks.body.data.some((item) => item.id === task.id));
  }

  const invalidAssignedFilter = await request(app)
    .get('/api/tasks?assignedToMe=yes')
    .set(auth(ownerToken));
  assert.equal(invalidAssignedFilter.status, 400);

  const rejected = await request(app)
    .put(`/api/tasks/${task.id}/claim`)
    .set(auth(outsiderToken))
    .send({ claimed: true });
  assert.equal(rejected.status, 403);

  const unclaimed = await request(app)
    .put(`/api/tasks/${task.id}/claim`)
    .set(auth(memberToken))
    .send({ claimed: false });
  assert.equal(unclaimed.status, 200);
  assignments = await prisma.taskAssignment.findMany({ where: { taskId: task.id } });
  assert.deepEqual(assignments.map((assignment) => assignment.userId), [owner.id]);
});

test('team membership removal revokes access and stale task claims', async () => {
  const claimed = await request(app)
    .put(`/api/tasks/${task.id}/claim`)
    .set(auth(memberToken))
    .send({ claimed: true });
  assert.equal(claimed.status, 200);

  const response = await request(app)
    .patch(`/api/teams/${team.id}`)
    .set(auth(ownerToken))
    .send({ memberIds: [] });
  assert.equal(response.status, 200);

  assert.equal((await request(app).get(`/api/projects/${project.id}`).set(auth(memberToken))).status, 404);
  assert.equal((await request(app).get(`/api/tasks/${task.id}`).set(auth(memberToken))).status, 403);
  assert.equal(await prisma.taskAssignment.count({ where: { taskId: task.id, userId: member.id } }), 0);
});

test('projects may be created without a team', async () => {
  const response = await request(app)
    .post('/api/projects')
    .set(auth(outsiderToken))
    .send({ name: 'Personal project' });
  assert.equal(response.status, 201);
  assert.equal(response.body.teamId, null);
  personalProject = response.body;
});
