import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swaggerSpecs } from '../src/config/swagger.js';

test('Swagger includes documented CRUD routes for core entities', () => {
  const paths = swaggerSpecs.paths;
  assert.ok(paths['/api/tasks']?.get);
  assert.ok(paths['/api/tasks/{id}']?.patch);
  assert.ok(paths['/api/tasks/{id}']?.delete);
  assert.ok(paths['/api/projects']?.post);
  assert.ok(paths['/api/files']?.get);
  assert.ok(paths['/api/comments/{id}']?.delete);
  assert.ok(paths['/api/users/{id}']?.put);
});
