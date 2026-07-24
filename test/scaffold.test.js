'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
const { readDoc } = require('../scripts/lib/frontmatter');

const TS = '2026-07-01T00:00:00+09:00';

test('scaffoldEpic writes a valid epic index', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const legacyIndex = path.join(repo, 'context/epics/EPIC-999-legacy/index.md');
  fs.mkdirSync(path.dirname(legacyIndex), { recursive: true });
  fs.writeFileSync(legacyIndex, 'legacy content\n');
  const created = scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  assert.strictEqual(CONTEXT_ROOT, '.bouncer/context');
  assert.deepStrictEqual(created, ['.bouncer/context/epics/EPIC-001-auth/index.md']);
  const { data } = readDoc(path.join(repo, created[0]));
  assert.strictEqual(data.type, 'bouncer.epic');
  assert.strictEqual(data.bouncer.id, 'EPIC-001');
  assert.strictEqual(data.bouncer.status, 'draft');
  assert.strictEqual(data.resource, created[0]);
  assert.strictEqual(fs.readFileSync(legacyIndex, 'utf8'), 'legacy content\n');
});

test('scaffoldBlueprint writes all five docs with correct ids and statuses', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  const created = scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  });
  assert.strictEqual(created.length, 5);
  const base = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';
  assert.deepStrictEqual(created, [
    `${base}/index.md`,
    `${base}/tasks.md`,
    `${base}/verification.md`,
    `${base}/review.md`,
    `${base}/distill.md`,
  ]);
  const tasks = readDoc(path.join(repo, `${base}/tasks.md`)).data;
  assert.strictEqual(tasks.resource, `${base}/tasks.md`);
  assert.strictEqual(tasks.bouncer.id, 'TASKS-BP-001');
  assert.strictEqual(tasks.bouncer.status, 'draft');
  assert.deepStrictEqual(tasks.bouncer.affected_paths, []);
  assert.ok(typeof tasks.bouncer.graph.basis === 'string');
  const review = readDoc(path.join(repo, `${base}/review.md`)).data;
  assert.strictEqual(review.bouncer.review.required, true);
  const verify = readDoc(path.join(repo, `${base}/verification.md`)).data;
  assert.strictEqual(verify.bouncer.status, 'pending');
});

test('scaffoldBlueprint rejects a root context epic directory', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  assert.throws(() => scaffoldBlueprint({
    repoRoot: repo, epicDir: 'context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  }), /epicDir must be under \.bouncer\/context\/epics/);
  assert.ok(!fs.existsSync(path.join(repo, 'context')));
});
