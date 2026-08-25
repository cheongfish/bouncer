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
    'bouncer.verification', 'bouncer.review', 'bouncer.explain',
    'bouncer.context_review',
  ]);
  assert.strictEqual(schema.ID_PREFIX['bouncer.tasks'], 'TASKS-');
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.review'],
    ['pending', 'requested', 'addressed', 'accepted']);
  assert.strictEqual(schema.KIND_TO_TYPE.explain, 'bouncer.explain');
  assert.strictEqual(schema.ID_PREFIX['bouncer.explain'], 'EXPLAIN-');
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.explain'], ['draft', 'published']);
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.blueprint'],
    ['draft', 'approved', 'superseded', 'closed', 'imported']);
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.epic'],
    ['draft', 'approved', 'closed', 'imported']);
  assert.strictEqual(schema.TYPES.length, 7);
});

test('bouncer.context_review is registered on all four schema maps', () => {
  assert.ok(schema.TYPES.includes('bouncer.context_review'));
  assert.strictEqual(schema.ID_PREFIX['bouncer.context_review'], 'CTXREVIEW-');
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.context_review'],
    ['pending', 'requested', 'addressed', 'accepted']);
  assert.strictEqual(schema.KIND_TO_TYPE.context_review, 'bouncer.context_review');
});

test('schema exports bouncer_schema and blueprint scale/commit_type defaults', () => {
  assert.strictEqual(schema.BOUNCER_SCHEMA_VERSION, '0.1');
  assert.deepStrictEqual(schema.SCALE_ENUM, ['light', 'full']);
  assert.strictEqual(schema.DEFAULT_SCALE, 'full');
  assert.strictEqual(schema.DEFAULT_COMMIT_TYPE, 'feat');
  assert.deepStrictEqual(schema.AUTONOMY_ENUM, ['auto', 'interactive']);
  assert.strictEqual(schema.DEFAULT_AUTONOMY, 'auto');
});

test('isValidSupersedes accepts absent or non-empty path arrays', () => {
  assert.strictEqual(schema.isValidSupersedes(undefined), true);
  assert.strictEqual(schema.isValidSupersedes([]), true);
  assert.strictEqual(schema.isValidSupersedes(['.bouncer/context/epics/033-x/index.md']), true);
  assert.strictEqual(schema.isValidSupersedes('033'), false);
  assert.strictEqual(schema.isValidSupersedes([{}]), false);
  assert.strictEqual(schema.isValidSupersedes(['']), false);
  assert.strictEqual(schema.isValidSupersedes(['  ']), false);
  assert.strictEqual(schema.isValidSupersedes(null), false);
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
