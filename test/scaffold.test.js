'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
const { readDoc } = require('../scripts/lib/frontmatter');

const TS = '2026-07-01T00:00:00+09:00';

test('scaffoldEpic writes a valid epic index', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  const created = scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  assert.deepStrictEqual(created, ['context/epics/EPIC-001-auth/index.md']);
  const { data } = readDoc(path.join(repo, created[0]));
  assert.strictEqual(data.type, 'sdd.epic');
  assert.strictEqual(data.sdd.id, 'EPIC-001');
  assert.strictEqual(data.sdd.status, 'draft');
  assert.strictEqual(data.resource, created[0]);
});

test('scaffoldBlueprint writes all five docs with correct ids and statuses', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  const created = scaffoldBlueprint({
    repoRoot: repo, epicDir: 'context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  });
  assert.strictEqual(created.length, 5);
  const base = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';
  const tasks = readDoc(path.join(repo, `${base}/tasks.md`)).data;
  assert.strictEqual(tasks.sdd.id, 'TASKS-BP-001');
  assert.strictEqual(tasks.sdd.status, 'draft');
  assert.deepStrictEqual(tasks.sdd.affected_paths, []);
  const review = readDoc(path.join(repo, `${base}/review.md`)).data;
  assert.strictEqual(review.sdd.review.required, true);
  const verify = readDoc(path.join(repo, `${base}/verification.md`)).data;
  assert.strictEqual(verify.sdd.status, 'pending');
});
