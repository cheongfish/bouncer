'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readyWave, transition, coordinate } = require('../scripts/lib/coordinator');
const { validateCoordinatorLedger } = require('../scripts/lib/runtime-state');
const { writeCurrent } = require('../scripts/lib/current');

test('readyWave returns only pending tasks with completed dependencies', () => {
  const tasks = [
    { id: '001', depends_on: [], status: 'integrated' },
    { id: '002', depends_on: ['001'], status: 'pending' },
    { id: '003', depends_on: ['002'], status: 'pending' },
  ];
  assert.deepStrictEqual(readyWave(tasks), ['002']);
});

test('readyWave keeps a sequential task alone and waits for the integrated gate', () => {
  const tasks = [
    { id: '001', status: 'integrated' },
    { id: '002', depends_on: ['001'], parallel_safe: true, status: 'pending' },
    { id: '003', depends_on: ['001'], parallel_safe: false, status: 'pending' },
    // 005는 아직 종단 상태에 닿지 않았다. gate 값이 integrated 하나뿐이어도
    // 004는 선행이 그 상태가 되기 전까지 열리지 않는다.
    { id: '004', depends_on: ['005'], dependency_gate: 'integrated', parallel_safe: true, status: 'pending' },
    { id: '005', depends_on: [], parallel_safe: true, status: 'recorded' },
  ];
  assert.deepStrictEqual(readyWave(tasks), ['003']);
  tasks[2].status = 'prepared';
  assert.deepStrictEqual(readyWave(tasks), ['002']);
  tasks[4].status = 'integrated';
  assert.deepStrictEqual(readyWave(tasks), ['002', '004']);
});

test('transition rejects an illegal coordinator state change', () => {
  assert.throws(() => transition('pending', 'integrated'), /illegal state transition/);
  assert.strictEqual(transition('ready', 'prepared'), 'prepared');
});

test('verification tasks use the ready-verifying-integrated state path', () => {
  assert.strictEqual(transition('ready', 'verifying', 'verification'), 'verifying');
  assert.strictEqual(transition('verifying', 'integrated', 'verification'), 'integrated');
  assert.throws(() => transition('ready', 'prepared', 'verification'), /illegal state transition/);
});

test('critical recovery records one prepared-task recovery and rejects invalid repeats', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-critical-recovery-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, `${blueprint}/index.md`), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(path.join(repo, `${blueprint}/tasks/001/tasks.md`), '---\nbouncer:\n  status: ready\n---\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const started = coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', findings: ['R-1', 'R-2'], reason: 'false acceptance risk' });
  assert.strictEqual(started.ok, true, JSON.stringify(started));
  assert.deepStrictEqual(started.task.criticalRecovery, {
    used: 1, findings: ['R-1', 'R-2'], reason: 'false acceptance risk', outcome: null,
  });
  assert.deepStrictEqual(started.decision, {
    task: '001', kind: 'critical-recovery', used: 1, findings: ['R-1', 'R-2'],
    reason: 'false acceptance risk', outcome: null,
  });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const beforeRepeat = fs.readFileSync(ledgerFile, 'utf8');
  assert.strictEqual(coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', findings: ['R-3'], reason: 'again' }).reason, 'critical-recovery-exhausted');
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), beforeRepeat);
  assert.strictEqual(coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', outcome: 'blocked', reason: 'unresolved' }).task.criticalRecovery.outcome, 'blocked');
  assert.strictEqual(coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', outcome: 'resolved', reason: 'again' }).reason, 'critical-recovery-closed');
  const withoutStart = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  withoutStart.tasks[0].criticalRecovery = undefined;
  withoutStart.tasks[0].status = 'prepared';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(withoutStart, null, 2)}\n`);
  const noStart = coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', outcome: 'blocked', reason: 'x' });
  assert.strictEqual(noStart.reason, 'critical-recovery-not-started');
  withoutStart.tasks[0].status = 'recorded';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(withoutStart, null, 2)}\n`);
  assert.strictEqual(coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', findings: ['R-1'], reason: 'x' }).reason, 'illegal-transition');
  const malformed = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  malformed.status = 'active'; malformed.tasks[0].status = 'prepared';
  malformed.tasks[0].criticalRecovery = { used: 2, findings: ['R-1'], reason: 'x', outcome: null };
  assert.strictEqual(validateCoordinatorLedger(malformed).reason, 'critical-recovery-invalid');
});

test('verification integrate runs CI without a worker or commit and advances only on success', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/011-x/blueprints/012-y';
  for (const [id, metadata] of [
    ['001', 'depends_on: []\n'],
    ['002', 'execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), `---\nbouncer:\n  ${metadata}---\n`);
  }
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.tasks[1].status, 'ready');
  assert.strictEqual(prepared.tasks[1].workerPath, undefined);
  let calls = 0;
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: { runVerification: () => { calls += 1; return { ok: true, command: 'node --test', exitCode: 0 }; } },
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(passed.task.status, 'integrated');

  const afterPass = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  afterPass.tasks[1].status = 'ready';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(afterPass, null, 2)}\n`);
  const failed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: { runVerification: () => ({ ok: false, command: 'node --test', exitCode: 1 }) },
  });
  assert.strictEqual(failed.reason, 'verification-failed');
  assert.strictEqual(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks[1].status, 'verifying');

  const missing = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    paths: ['src/fix.js'], decision: 'CI failure requires repair',
  });
  assert.strictEqual(missing.reason, 'failure-evidence-required');
  const escaped = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['.bouncer/context/'],
    decision: 'invalid scope',
  });
  assert.strictEqual(escaped.reason, 'repair-scope-out-of-bounds');
  for (const badPath of ['src/../.git/config', 'src/..', './', '../outside', '~/.cache', 'src/**', 'src/file?.js',
    'C:\\outside\\file.ts']) {
    const rejected = coordinate({
      command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
      failureCommand: 'node --test', summary: 'one failed', paths: [badPath], decision: 'invalid scope',
    });
    assert.strictEqual(rejected.reason, 'repair-scope-out-of-bounds', badPath);
  }

  const terminalFile = path.join(boot.integrationPath, blueprint, 'tasks/002/tasks.md');
  const terminalBeforeWriteFailure = fs.readFileSync(terminalFile, 'utf8');
  const ledgerBeforeWriteFailure = fs.readFileSync(ledgerFile, 'utf8');
  assert.throws(() => coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'],
    decision: 'injected failure', deps: { writeLedger: () => { throw new Error('ledger write failed'); } },
  }), /ledger write failed/);
  assert.strictEqual(fs.readFileSync(terminalFile, 'utf8'), terminalBeforeWriteFailure);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBeforeWriteFailure);
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, blueprint, 'tasks/003')), false);

  const firstRepair = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'],
    decision: 'repair the failing source path',
  });
  assert.strictEqual(firstRepair.ok, true, JSON.stringify(firstRepair));
  assert.strictEqual(firstRepair.wave, 1);
  assert.deepStrictEqual(firstRepair.terminalTask.depends_on, ['003']);
  assert.deepStrictEqual(firstRepair.decision.previousScope, []);
  assert.deepStrictEqual(firstRepair.decision.nextScope, ['src/fix.js']);
  assert.strictEqual(firstRepair.decision.revision, 'r1');
  assert.strictEqual(firstRepair.repairTask.scope.revision, 'r1');
  assert.match(fs.readFileSync(path.join(
    boot.integrationPath, blueprint, 'tasks/003/tasks.md',
  ), 'utf8'), /scope_revision: r1/);

  let repairedLedger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  repairedLedger.tasks.find((entry) => entry.id === '003').status = 'integrated';
  repairedLedger.tasks.find((entry) => entry.id === '002').status = 'verifying';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(repairedLedger, null, 2)}\n`);
  const secondRepair = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'still failing', paths: ['test/fix.test.js'],
    decision: 'add the missing regression coverage',
  });
  assert.strictEqual(secondRepair.wave, 2);
  assert.deepStrictEqual(secondRepair.terminalTask.depends_on, ['004']);
  const thirdRepair = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'still failing', paths: ['src/third.js'], decision: 'third',
  });
  assert.strictEqual(thirdRepair.reason, 'repair-wave-limit');

  repairedLedger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  repairedLedger.tasks.find((entry) => entry.id === '004').status = 'integrated';
  repairedLedger.tasks.find((entry) => entry.id === '002').status = 'ready';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(repairedLedger, null, 2)}\n`);
  const thirdFailure = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: { runVerification: () => ({ ok: false, command: 'node --test', exitCode: 1 }) },
  });
  assert.strictEqual(thirdFailure.stopped, true);
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, 'NEXT_PLAN.md')), true);
  assert.strictEqual(coordinate({
    command: 'partial-close', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  }).reason, 'partial-close-user-confirmation-required');
  const partial = coordinate({
    command: 'partial-close', repoRoot: repo, blueprint, cwd: boot.integrationPath, userConfirmed: true,
  });
  assert.strictEqual(partial.ok, true, JSON.stringify(partial));
  assert.strictEqual(partial.status, 'partial_closed');
  assert.strictEqual(partial.message, 'NEXT_PLAN.md를 확인하고 후속 계획 진행 여부를 승인해 주세요.');
});

test('verification integrate seeds the terminal bundle and uses the real runner', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-real-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify: 'node --test' }));
  const blueprint = '.bouncer/context/epics/013-x/blueprints/014-y';
  const task = (id, metadata) => {
    const dir = path.join(repo, blueprint, 'tasks', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tasks.md'), `---\nbouncer:\n  id: TASKS-${id}\n  status: ready\n${metadata}---\n`);
  };
  task('001', '  depends_on: []\n');
  task('002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node -e "process.stdout.write(\'ci-ok\')"\n  affected_paths: []\n');
  const verificationRel = `${blueprint}/tasks/002/verification.md`;
  fs.writeFileSync(path.join(repo, verificationRel), `---\ntype: bouncer.verification\ntitle: CI\ndescription: d\nresource: ${verificationRel}\ntags: [bouncer, verification]\ntimestamp: 2026-09-10T00:00:00+09:00\nbouncer:\n  id: VERIFY-002\n  epic_id: '013'\n  blueprint_id: '014'\n  status: pending\n---\n# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n`);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, verificationRel)), true);
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, '.bouncer/config.json')), true);
  writeCurrent({
    repoRoot: boot.integrationPath, blueprint, base: 'master',
    task: `${blueprint}/tasks/002/tasks.md`,
  });

  const result = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.verification.exitCode, 0);
  assert.strictEqual(prepared.tasks[1].workerPath, undefined);
  const taskText = fs.readFileSync(path.join(boot.integrationPath, blueprint, 'tasks/002/tasks.md'), 'utf8');
  assert.match(taskText, /status: integrated/);
  assert.match(fs.readFileSync(path.join(boot.integrationPath, verificationRel), 'utf8'), /exit_code: 0/);
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
