'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateBlueprint } = require('../scripts/lib/validate');

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-'));
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const yaml = require('js-yaml');
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function goodTasks() {
  return {
    type: 'sdd.tasks',
    title: 'Login tasks',
    description: 'Tasks for BP-001',
    resource: `${BP_REL}/tasks.md`,
    tags: ['sdd', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: {
      id: 'TASKS-BP-001',
      epic_id: 'EPIC-001',
      blueprint_id: 'BP-001',
      status: 'ready',
      affected_paths: ['src/auth/'],
    },
  };
}

test('S1: missing OKF field is reported', () => {
  const repo = mkRepo();
  const t = goodTasks();
  delete t.description;
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S1'));
});

test('S3/S6/S7 detect resource, status, affected_paths problems', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.resource = 'context/wrong/path.md';
  t.sdd.status = 'bogus';
  t.sdd.affected_paths = [];
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  const codes = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL })
    .failures.map((f) => f.code);
  assert.ok(codes.includes('S3'));
  assert.ok(codes.includes('S6'));
  assert.ok(codes.includes('S7'));
});

test('S8: leaf present but blueprint index absent', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S8'));
});

test('a fully valid blueprint passes structural checks', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

function blueprintDoc() {
  return {
    type: 'sdd.blueprint',
    title: 'Login blueprint',
    description: 'BP-001',
    resource: `${BP_REL}/index.md`,
    tags: ['sdd', 'blueprint'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'draft' },
  };
}
function epicDoc() {
  return {
    type: 'sdd.epic',
    title: 'Auth epic',
    description: 'EPIC-001',
    resource: 'context/epics/EPIC-001-auth/index.md',
    tags: ['sdd', 'epic'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'draft' },
  };
}
