'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readyWave, transition, coordinate } = require('../scripts/lib/coordinator');

test('readyWave returns only pending tasks with completed dependencies', () => {
  const tasks = [
    { id: '001', depends_on: [], status: 'integrated' },
    { id: '002', depends_on: ['001'], status: 'pending' },
    { id: '003', depends_on: ['002'], status: 'pending' },
  ];
  assert.deepStrictEqual(readyWave(tasks), ['002']);
});

test('readyWave keeps a sequential task alone and respects integration-verified gates', () => {
  const tasks = [
    { id: '001', status: 'integrated' },
    { id: '002', depends_on: ['001'], parallel_safe: true, status: 'pending' },
    { id: '003', depends_on: ['001'], parallel_safe: false, status: 'pending' },
    { id: '004', depends_on: ['001'], dependency_gate: 'integration-verified', parallel_safe: true, status: 'pending' },
  ];
  assert.deepStrictEqual(readyWave(tasks), ['003']);
  tasks[2].status = 'prepared';
  assert.deepStrictEqual(readyWave(tasks), ['002']);
  tasks[0].status = 'integration-verified';
  assert.deepStrictEqual(readyWave(tasks), ['004']);
});

test('transition rejects an illegal coordinator state change', () => {
  assert.throws(() => transition('pending', 'integrated'), /illegal state transition/);
  assert.strictEqual(transition('ready', 'prepared'), 'prepared');
});

test('bootstrap creates only an integration worktree and resumes its ledger', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const first = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(first.ok, true);
  assert.deepStrictEqual(first.ready, ['001']);
  const second = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(second.ok, true);
  assert.deepStrictEqual(second.ready, ['001']);
  assert.strictEqual(fs.existsSync(path.join(repo, 'README.md')), true);
});

test('bootstrap rejects a symlink substituted for its registered integration checkout', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-integration-target-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/009-x/blueprints/010-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  fs.rmSync(boot.integrationPath, { recursive: true, force: true });
  fs.symlinkSync(outside, boot.integrationPath, 'dir');

  const result = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });

  assert.deepStrictEqual(result, { ok: false, reason: 'unassigned-integration-worktree', integrationPath: boot.integrationPath });
  assert.strictEqual(fs.existsSync(path.join(outside, '.bouncer', 'runtime', 'coordinator.json')), false);
});

test('prepare seeds each assigned worker and record accepts the worker boundary', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/002-x/blueprints/003-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\nbrief\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true);
  const worker = prepared.tasks[0].workerPath;
  assert.strictEqual(fs.readFileSync(path.join(worker, blueprint, 'tasks', '001', 'tasks.md'), 'utf8').includes('brief'), true);
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });
  assert.strictEqual(recorded.ok, true);
});

test('record refuses a SHA that is not the assigned worker HEAD', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/004-x/blueprints/005-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  const result = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: prepared.tasks[0].workerPath, task: '001', sha: 'deadbeef' });
  assert.deepStrictEqual(result, { ok: false, reason: 'sha-not-worker-head' });
});

test('record rejects a prepared worker path replaced by an external symlink', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-worker-target-'));
  for (const directory of [repo, outside]) {
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    fs.writeFileSync(path.join(directory, 'README.md'), 'fixture\n');
    execFileSync('git', ['add', 'README.md'], { cwd: directory });
    execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: directory });
  }
  const blueprint = '.bouncer/context/epics/005-x/blueprints/006-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  const worker = prepared.tasks[0].workerPath;
  fs.rmSync(worker, { recursive: true, force: true });
  fs.symlinkSync(outside, worker, 'dir');

  const result = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });

  assert.deepStrictEqual(result, { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker });
});

test('integrate rejects a recorded worker path replaced by a symlink to main', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/007-x/blueprints/008-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  const worker = prepared.tasks[0].workerPath;
  assert.strictEqual(coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' }).ok, true);
  fs.rmSync(worker, { recursive: true, force: true });
  fs.symlinkSync(repo, worker, 'dir');

  const result = coordinate({ command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001' });

  assert.deepStrictEqual(result, { ok: false, reason: 'sha-not-owned-by-worker' });
});

test('prepare refuses an ordinary directory at an assigned worker path', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/006-x/blueprints/007-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const worker = path.join(repo, '.worktrees', '006', '007', 'workers', '001');
  fs.mkdirSync(worker, { recursive: true });
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.deepStrictEqual(result, { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker });
  assert.strictEqual(fs.existsSync(path.join(worker, blueprint)), false);
});

test('prepare refuses a symlink at an assigned worker path before seeding', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-worker-target-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/008-x/blueprints/009-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const worker = path.join(repo, '.worktrees', '008', '009', 'workers', '001');
  fs.mkdirSync(path.dirname(worker), { recursive: true });
  fs.symlinkSync(outside, worker, 'dir');
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.deepStrictEqual(result, { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker });
  assert.strictEqual(fs.existsSync(path.join(outside, blueprint)), false);
});
