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
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const created = scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  assert.deepStrictEqual(created, ['context/epics/EPIC-001-auth/index.md']);
  const { data } = readDoc(path.join(repo, created[0]));
  assert.strictEqual(data.type, 'bouncer.epic');
  assert.strictEqual(data.bouncer.id, 'EPIC-001');
  assert.strictEqual(data.bouncer.status, 'draft');
  assert.strictEqual(data.resource, created[0]);
});

test('scaffoldBlueprint writes all five docs with correct ids and statuses', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  const created = scaffoldBlueprint({
    repoRoot: repo, epicDir: 'context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  });
  assert.strictEqual(created.length, 5);
  const base = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';
  const tasks = readDoc(path.join(repo, `${base}/tasks.md`)).data;
  assert.strictEqual(tasks.bouncer.id, 'TASKS-BP-001');
  assert.strictEqual(tasks.bouncer.status, 'draft');
  assert.deepStrictEqual(tasks.bouncer.affected_paths, []);
  assert.ok(typeof tasks.bouncer.graph.basis === 'string');
  const review = readDoc(path.join(repo, `${base}/review.md`)).data;
  assert.strictEqual(review.bouncer.review.required, true);
  const verify = readDoc(path.join(repo, `${base}/verification.md`)).data;
  assert.strictEqual(verify.bouncer.status, 'pending');
});
