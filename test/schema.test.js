'use strict';
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../scripts/lib/schema');

test('OKF required fields are exact', () => {
  assert.deepStrictEqual(schema.OKF_REQUIRED,
    ['type', 'title', 'description', 'resource', 'tags', 'timestamp']);
});

test('id prefix and status enum per type', () => {
  assert.deepStrictEqual(schema.TYPES, [
    'bouncer.epic', 'bouncer.blueprint', 'bouncer.tasks',
    'bouncer.verification', 'bouncer.review', 'bouncer.distill',
  ]);
  assert.strictEqual(schema.ID_PREFIX['bouncer.tasks'], 'TASKS-');
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.review'],
    ['pending', 'requested', 'addressed', 'accepted']);
  assert.strictEqual(schema.KIND_TO_TYPE.distill, 'bouncer.distill');
  assert.strictEqual(schema.TYPES.length, 6);
});

test('detectLegacyFormat flags .sdd dirs, sdd keys, and sdd.* types', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-legacy-'));
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  const dirHit = schema.detectLegacyFormat({ repoRoot: repo });
  assert.strictEqual(dirHit.legacy, true);
  assert.match(dirHit.reason, /bouncer-init/);

  const keyHit = schema.detectLegacyFormat({ data: { type: 'bouncer.tasks', sdd: { id: 'x' } } });
  assert.strictEqual(keyHit.legacy, true);
  assert.match(keyHit.reason, /bouncer-init/);

  const typeHit = schema.detectLegacyFormat({ data: { type: 'sdd.tasks' } });
  assert.strictEqual(typeHit.legacy, true);
  assert.match(typeHit.reason, /bouncer-init/);

  assert.strictEqual(schema.detectLegacyFormat({ data: { type: 'bouncer.tasks', bouncer: {} } }).legacy, false);
});
