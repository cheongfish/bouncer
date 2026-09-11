'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { writeCurrent } = require('../scripts/lib/current');

const EPIC_REL = '.bouncer/context/epics/001-auth';
const BP_REL = `${EPIC_REL}/blueprints/001-login`;
const TASK_001 = `${BP_REL}/tasks/001/tasks.md`;
const TASK_002 = `${BP_REL}/tasks/002/tasks.md`;

function gitEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  return env;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() });
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writePlanTree(repo, {
  bpStatus = 'approved',
  task001 = {},
  task002 = {},
} = {}) {
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: bpStatus, scale: 'full',
    },
  }, '# Login\n');
  writeDoc(repo, TASK_001, {
    type: 'bouncer.tasks', title: 'First', description: 'd', resource: TASK_001,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      execution_kind: 'commit', affected_paths: ['a.ts'],
      ...task001,
    },
  }, '# Tasks 001\n');
  writeDoc(repo, TASK_002, {
    type: 'bouncer.tasks', title: 'Second', description: 'd', resource: TASK_002,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-002', epic_id: '001', blueprint_id: '001', status: 'ready',
      execution_kind: 'commit', affected_paths: ['b.ts'], depends_on: ['TASKS-001'],
      ...task002,
    },
  }, '# Tasks 002\n');
}

function makeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-run-preflight-')));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  git(repo, ['add', 'README']);
  git(repo, ['commit', '-qm', 'baseline']);
  return repo;
}

function setPointer(repo, { blueprint = BP_REL, base = 'main', task = TASK_001 } = {}) {
  writeCurrent({ repoRoot: repo, blueprint, base, task });
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

function preflight(repo, extra = []) {
  return capture(['run', 'preflight', '--blueprint', BP_REL, '--repo', repo, ...extra]);
}

function parsePayload(result) {
  assert.ok(result.out.trim(), `expected stdout JSON, stderr=${result.err}`);
  return JSON.parse(result.out);
}

test('run preflight reports readyWave 001 and TASKS-002 when 002 depends on 001', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const before = git(repo, ['status', '--porcelain']);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.deepStrictEqual(payload.readyWave, ['001']);
  assert.strictEqual(payload.openTasks[1].taskId, 'TASKS-002');
  assert.strictEqual(payload.openTasks[1].id, '002');
  assert.deepStrictEqual(payload.openTasks[1].depends_on, ['TASKS-001']);
  assert.strictEqual(payload.openTasks[0].id, '001');
  assert.deepStrictEqual(payload.openTasks[0].depends_on, []);
  assert.strictEqual(payload.openTasks[0].parallel_safe, false);
  assert.strictEqual(payload.openTasks[0].dependency_gate, 'integrated');
  assert.strictEqual(payload.blueprint.dir, BP_REL);
  assert.strictEqual(payload.blueprint.status, 'approved');
  assert.strictEqual(payload.blueprint.scale, 'full');
  assert.strictEqual(payload.base, 'main');
  assert.strictEqual(payload.delegable, true);
  assert.strictEqual(payload.reason, null);
  assert.strictEqual(git(repo, ['status', '--porcelain']), before, 'preflight must not write files');
});

test('run preflight treats missing autonomy as auto with fallback missing', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(payload.autonomy, {
    value: 'auto', fallback: true, reason: 'missing',
  });
});

test('run preflight treats autonomy always as invalid', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer', 'config.json'), `${JSON.stringify({
    autonomy: 'always',
  })}\n`);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.autonomy.value, 'auto');
  assert.strictEqual(payload.autonomy.fallback, true);
  assert.strictEqual(payload.autonomy.reason, 'invalid');
});

test('run preflight marks a closed blueprint as not delegable', () => {
  const repo = makeRepo();
  writePlanTree(repo, { bpStatus: 'closed' });
  setPointer(repo);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.delegable, false);
  assert.strictEqual(payload.reason, 'blueprint-closed');
});

test('run preflight treats declared auto autonomy as no fallback', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer', 'config.json'), `${JSON.stringify({
    autonomy: 'auto',
  })}\n`);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(payload.autonomy, {
    value: 'auto', fallback: false, reason: null,
  });
});

test('run preflight marks no open tasks as not delegable', () => {
  const repo = makeRepo();
  writePlanTree(repo, {
    task001: { status: 'integrated' },
    task002: { status: 'verified' },
  });
  setPointer(repo);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.deepStrictEqual(payload.openTasks, []);
  assert.strictEqual(payload.delegable, false);
  assert.strictEqual(payload.reason, 'no-open-task');
});

test('run preflight maps CURRENT_AMBIGUOUS from a colliding pointer set', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  setPointer(repo, {
    blueprint: '.bouncer/context/epics/002-billing/blueprints/001-invoices',
    task: null,
  });
  const result = preflight(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'CURRENT_AMBIGUOUS');
});

test('run preflight rejects a missing pointer with no-current', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  const result = preflight(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'no-current');
});

test('run without a subcommand exits 2', () => {
  const result = capture(['run']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /preflight/);
});

test('run preflight without --blueprint exits 2', () => {
  const result = capture(['run', 'preflight']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /blueprint/);
});
