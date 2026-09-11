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
const { worktreePathFor, coordinatorPathsFor } = require('../scripts/lib/runtime-state');

const EPIC_REL = '.bouncer/context/epics/001-auth';
const BP_REL = `${EPIC_REL}/blueprints/001-login`;
const BP_OTHER = '.bouncer/context/epics/002-billing/blueprints/001-invoices';
const TASK_REL = `${BP_REL}/tasks/001/tasks.md`;

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

function writePlanTree(repo, { scale = 'full', commitType } = {}) {
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  const bouncer = {
    id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale,
  };
  if (commitType) bouncer.commit_type = commitType;
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer,
  }, '# Login\n');
  writeDoc(repo, TASK_REL, {
    type: 'bouncer.tasks', title: 'Impl login', description: 'd', resource: TASK_REL,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      affected_paths: ['src/auth/'],
    },
  }, '# Tasks\n');
}

function makeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-execute-prepare-')));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  git(repo, ['add', 'README']);
  git(repo, ['commit', '-qm', 'baseline']);
  return repo;
}

function setPointer(repo, { blueprint = BP_REL, base = 'main', task = TASK_REL } = {}) {
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

function prepare(repo, extra = [], blueprint = BP_REL) {
  return capture(['execute', 'prepare', '--blueprint', blueprint, '--repo', repo, ...extra]);
}

function parsePayload(result) {
  assert.ok(result.out.trim(), `expected stdout JSON, stderr=${result.err}`);
  return JSON.parse(result.out);
}

function listedWorktrees(repo) {
  const out = git(repo, ['worktree', 'list', '--porcelain']);
  const paths = [];
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) paths.push(line.slice('worktree '.length));
  }
  return paths;
}

test('execute prepare creates a nested worktree with the helper standalone name and seeds tasks.md', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const expected = worktreePathFor({ repoRoot: repo, blueprint: BP_REL });

  const result = prepare(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.drive, false);
  assert.strictEqual(payload.created, true);
  assert.strictEqual(payload.branch, 'feat/001-001-login');
  assert.strictEqual(payload.worktreePath, expected);
  assert.strictEqual(payload.base, 'main');
  assert.deepStrictEqual(payload.task, { id: 'TASKS-001', path: TASK_REL });
  assert.strictEqual(payload.scale, 'full');
  assert.ok(Array.isArray(payload.seed.moved));
  assert.ok(
    payload.seed.moved.includes(TASK_REL),
    `seed.moved missing tasks.md: ${JSON.stringify(payload.seed.moved)}`,
  );
  assert.ok(fs.existsSync(path.join(payload.worktreePath, TASK_REL)));
  assert.strictEqual(fs.existsSync(path.join(repo, TASK_REL)), false);
});

test('execute prepare reuses a registered worktree and reports its actual branch', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);

  const first = parsePayload(prepare(repo));
  assert.strictEqual(first.created, true);
  const worktreePath = first.worktreePath;
  git(worktreePath, ['branch', '-m', 'kept-existing']);

  writePlanTree(repo);
  const second = parsePayload(prepare(repo));
  assert.strictEqual(second.ok, true);
  assert.strictEqual(second.drive, false);
  assert.strictEqual(second.created, false);
  assert.strictEqual(second.branch, 'kept-existing');
  assert.strictEqual(second.worktreePath, worktreePath);
});

test('execute prepare uses the helper standalone name with the blueprint commit_type', () => {
  const repo = makeRepo();
  writePlanTree(repo, { commitType: 'fix' });
  setPointer(repo);

  const result = prepare(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.created, true);
  assert.strictEqual(payload.branch, 'fix/001-001-login');
});

test('execute prepare rejects a calculated branch already used outside the expected worktree', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  git(repo, ['branch', 'feat/001-001-login']);

  const result = prepare(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 1);
  assert.deepStrictEqual(payload, { ok: false, reason: 'branch-conflict' });
  assert.strictEqual(fs.existsSync(worktreePathFor({ repoRoot: repo, blueprint: BP_REL })), false);
  assert.strictEqual(listedWorktrees(repo).length, 1);
});

test('execute prepare returns invalid-commit-type without creating a worktree', () => {
  const repo = makeRepo();
  writePlanTree(repo, { commitType: 'unsupported' });
  setPointer(repo);

  const result = prepare(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 1);
  assert.deepStrictEqual(payload, { ok: false, reason: 'invalid-commit-type' });
  assert.strictEqual(fs.existsSync(worktreePathFor({ repoRoot: repo, blueprint: BP_REL })), false);
  assert.strictEqual(listedWorktrees(repo).length, 1);
});

test('execute prepare returns invalid-branch-name without creating a worktree', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  const invalidBlueprint = `${EPIC_REL}/blueprints/001-invalid branch`;
  fs.renameSync(path.join(repo, BP_REL), path.join(repo, invalidBlueprint));
  const invalidTask = `${invalidBlueprint}/tasks/001/tasks.md`;
  setPointer(repo, { blueprint: invalidBlueprint, task: invalidTask });

  const result = prepare(repo, [], invalidBlueprint);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 1);
  assert.deepStrictEqual(payload, { ok: false, reason: 'invalid-branch-name' });
  assert.strictEqual(fs.existsSync(worktreePathFor({ repoRoot: repo, blueprint: invalidBlueprint })), false);
  assert.strictEqual(listedWorktrees(repo).length, 1);
});

test('execute prepare reuses a detached HEAD without inventing a branch name', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);

  const first = parsePayload(prepare(repo));
  assert.strictEqual(first.created, true);
  const worktreePath = first.worktreePath;
  git(worktreePath, ['checkout', '--detach', 'HEAD']);

  writePlanTree(repo);
  const second = parsePayload(prepare(repo));
  assert.strictEqual(second.ok, true);
  assert.strictEqual(second.drive, false);
  assert.strictEqual(second.created, false);
  assert.strictEqual(second.branch, null);
  assert.notStrictEqual(second.branch, 'feat/001-001-login');
  assert.strictEqual(second.worktreePath, worktreePath);
});

test('execute prepare returns drive=true without creating a worktree or branch fields', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const coord = coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL, task: '001' });
  fs.mkdirSync(path.dirname(coord.ledgerFile), { recursive: true });
  fs.writeFileSync(coord.ledgerFile, `${JSON.stringify({
    version: 1,
    blueprint: BP_REL,
    tasks: [{ id: '001', status: 'prepared', workerPath: coord.workerPath }],
  })}\n`);
  const before = listedWorktrees(repo);
  const statusBefore = git(repo, ['status', '--porcelain']);

  const result = prepare(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.drive, true);
  assert.strictEqual(payload.created, false);
  assert.strictEqual(payload.worktreePath, coord.workerPath);
  assert.deepStrictEqual(payload.task, { id: 'TASKS-001', path: TASK_REL });
  assert.ok(!Object.hasOwn(payload, 'branch'));
  assert.ok(!Object.hasOwn(payload, 'base'));
  assert.ok(!Object.hasOwn(payload, 'seed'));
  assert.deepStrictEqual(listedWorktrees(repo), before);
  assert.strictEqual(git(repo, ['status', '--porcelain']), statusBefore);
  assert.ok(fs.existsSync(path.join(repo, TASK_REL)), 'drive must not seed the main checkout');
});

test('execute prepare rejects a missing pointer with no-current', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  const result = prepare(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'no-current');
});

test('execute prepare rejects a pointer for a different blueprint', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  writeDoc(repo, `${BP_OTHER}/index.md`, {
    type: 'bouncer.blueprint', title: 'Invoices', description: 'd', resource: `${BP_OTHER}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '002', blueprint_id: '001', status: 'approved' },
  });
  setPointer(repo, { blueprint: BP_OTHER, task: `${BP_OTHER}/tasks/001/tasks.md` });
  const result = prepare(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'blueprint-mismatch');
});

test('execute prepare refuses an unregistered directory at the expected path', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const expected = worktreePathFor({ repoRoot: repo, blueprint: BP_REL });
  fs.mkdirSync(expected, { recursive: true });
  fs.writeFileSync(path.join(expected, 'sentinel'), 'keep\n');

  const result = prepare(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'unregistered-worktree');
  assert.strictEqual(fs.readFileSync(path.join(expected, 'sentinel'), 'utf8'), 'keep\n');
  assert.ok(fs.existsSync(path.join(repo, TASK_REL)), 'unregistered path must not be seeded');
  assert.deepStrictEqual(listedWorktrees(repo).length, 1);
});

test('execute prepare maps CURRENT_AMBIGUOUS from a colliding pointer set', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  setPointer(repo, { blueprint: BP_OTHER, base: 'main', task: null });
  const result = prepare(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'CURRENT_AMBIGUOUS');
});

test('execute prepare reports worktree-add-failed when the base ref is missing', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo, { base: 'no-such-base' });
  const result = prepare(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'worktree-add-failed');
  assert.ok(typeof payload.message === 'string' && payload.message.length > 0);
});

test('execute prepare reports seed-conflict and keeps the created worktree', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const first = parsePayload(prepare(repo));
  assert.strictEqual(first.created, true);
  fs.writeFileSync(path.join(first.worktreePath, TASK_REL), '# worktree edit\n');
  writePlanTree(repo);

  const result = prepare(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'seed-conflict');
  assert.ok(Array.isArray(payload.conflicts));
  assert.ok(payload.conflicts.includes(TASK_REL));
  assert.ok(fs.existsSync(first.worktreePath));
  assert.ok(listedWorktrees(repo).some((entry) => {
    try { return fs.realpathSync(entry) === fs.realpathSync(first.worktreePath); } catch { return false; }
  }));
});

test('execute prepare without a subcommand exits 2', () => {
  const result = capture(['execute']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /prepare/);
});
