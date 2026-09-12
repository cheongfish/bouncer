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

test('bootstrap seeds an untracked blueprint once and preserves the integration copy on resume', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/030-x/blueprints/031-y';
  const task = `${blueprint}/tasks/001/tasks.md`;
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, task), '---\nbouncer:\n  depends_on: []\n---\n');
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{"verify":"node --test"}\n');
  const before = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, task)), true);
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, '.bouncer/config.json')), true);
  const ledger = JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8'));
  assert.ok(ledger.seedManifest.some((entry) => entry.path === task && /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.ok(!ledger.seedManifest.some((entry) => entry.path === '.bouncer/config.json'));
  const after = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' })
    .split('\n').filter((line) => !line.slice(3).startsWith('.worktrees/')).join('\n');
  assert.strictEqual(after.trim(), before.trim());
  fs.writeFileSync(path.join(boot.integrationPath, task), 'integration canonical\n');
  const resumed = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  assert.strictEqual(fs.readFileSync(path.join(boot.integrationPath, task), 'utf8'), 'integration canonical\n');
});

test('bootstrap rejects a third integration plan version without creating its ledger', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/032-x/blueprints/033-y';
  const task = `${blueprint}/tasks/001/tasks.md`;
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, task), 'main plan bytes\n');
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint });
  fs.mkdirSync(path.dirname(paths.integrationPath), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-b', 'feat/032-033-y', paths.integrationPath, 'HEAD'], { cwd: repo });
  fs.mkdirSync(path.join(paths.integrationPath, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(paths.integrationPath, task), 'third plan bytes\n');
  const mainBefore = fs.readFileSync(path.join(repo, task));
  const result = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.strictEqual(result.reason, 'seed-conflict');
  assert.deepStrictEqual(result.conflicts, [task]);
  assert.strictEqual(fs.existsSync(paths.ledgerFile), false);
  assert.deepStrictEqual(fs.readFileSync(path.join(repo, task)), mainBefore);
});

test('prepare backfills a legacy prepared worker branch without renaming its checkout', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/015-x/blueprints/016-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'), '---\nbouncer:\n  depends_on: []\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' });
  execFileSync('git', ['worktree', 'add', '-b', 'legacy/015-016-001', paths.workerPath, 'HEAD'], { cwd: boot.integrationPath });
  const ledger = JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8'));
  delete ledger.integrationBranch;
  ledger.tasks[0].status = 'prepared';
  ledger.tasks[0].workerPath = paths.workerPath;
  fs.writeFileSync(paths.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.integrationBranch, undefined);
  assert.strictEqual(result.tasks[0].branch, 'legacy/015-016-001');
  assert.strictEqual(JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8')).integrationBranch, 'feat/015-016-y');
  assert.strictEqual(execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: paths.workerPath, encoding: 'utf8' }).trim(),
    'legacy/015-016-001');
});

test('prepare validates the integration commit type even when the ready wave is verification-only', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/021-x/blueprints/022-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'),
    '---\nbouncer:\n  execution_kind: verification\n  depends_on: []\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  // prepare는 commit_type을 integration 사본에서 읽는다. main에 쓰면 판정에 닿지 않는다.
  fs.writeFileSync(path.join(boot.integrationPath, blueprint, 'index.md'), '---\nbouncer:\n  commit_type: wip\n---\n');
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.reason, 'invalid-commit-type');
  // verification-only wave는 worker branch를 만들지 않지만 commit_type 검증은 그대로 받는다.
  // 거절은 node를 ready로 옮기기 전이라 원장의 task 상태가 bootstrap 그대로 남는다.
  const ledger = JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8'));
  assert.strictEqual(ledger.tasks[0].status || 'pending', 'pending');
});

test('standalone branch and a later ready-wave conflict create no coordinator worktree', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const standaloneBlueprint = '.bouncer/context/epics/017-x/blueprints/018-y';
  fs.mkdirSync(path.join(repo, standaloneBlueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, standaloneBlueprint, 'tasks/001/tasks.md'), '---\nbouncer: {}\n---\n');
  const { worktreePathFor, coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const standalone = worktreePathFor({ repoRoot: repo, blueprint: standaloneBlueprint });
  fs.mkdirSync(path.dirname(standalone), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-b', 'feat/017-018-y', standalone, 'HEAD'], { cwd: repo });
  const conflict = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: standaloneBlueprint });
  assert.strictEqual(conflict.reason, 'branch-conflict');
  assert.strictEqual(fs.existsSync(coordinatorPathsFor({ repoRoot: repo, blueprint: standaloneBlueprint }).integrationPath), false);

  const blueprint = '.bouncer/context/epics/019-x/blueprints/020-y';
  for (const id of ['001', '002']) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), '---\nbouncer:\n  parallel_safe: true\n---\n');
  }
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  execFileSync('git', ['branch', 'bouncer/019-020-002'], { cwd: repo });
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.reason, 'branch-conflict');
  assert.strictEqual(fs.existsSync(coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' }).workerPath), false);
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
  assert.strictEqual(boot.integrationBranch, 'feat/002-003-y');
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true);
  const worker = prepared.tasks[0].workerPath;
  assert.strictEqual(prepared.tasks[0].branch, 'bouncer/002-003-001');
  const ledger = JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8'));
  assert.strictEqual(ledger.integrationBranch, boot.integrationBranch);
  assert.strictEqual(fs.readFileSync(path.join(worker, blueprint, 'tasks', '001', 'tasks.md'), 'utf8').includes('brief'), true);
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });
  assert.strictEqual(recorded.ok, true);
});

// 계획 문서를 커밋하지 않은 fixture. bootstrap이 integration에 seed한 뒤로는
// integration 사본만 정본이므로, main 사본을 지워도 drive가 이어져야 한다.
function uncommittedPlanRepo(prefix, blueprint, tasks) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{"verify":"node --test"}\n');
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  for (const [id, metadata] of tasks) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), `---\nbouncer:\n${metadata}---\nbrief ${id}\n`);
  }
  return repo;
}

test('prepare seeds workers from the integration plan after the main plan is removed', () => {
  const blueprint = '.bouncer/context/epics/040-x/blueprints/041-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-seed-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
    ['002', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  fs.rmSync(path.join(repo, blueprint), { recursive: true, force: true });
  fs.rmSync(path.join(repo, '.bouncer/config.json'), { force: true });
  const edited = Buffer.from('---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n---\nintegration edit\n');
  fs.writeFileSync(path.join(boot.integrationPath, blueprint, 'tasks/001/tasks.md'), edited);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker1 = prepared.tasks.find((t) => t.id === '001').workerPath;
  const worker2 = prepared.tasks.find((t) => t.id === '002').workerPath;
  assert.ok(fs.existsSync(path.join(worker1, blueprint, 'tasks/001/tasks.md')));
  assert.deepStrictEqual(fs.readFileSync(path.join(worker1, blueprint, 'tasks/001/tasks.md')), edited);
  assert.deepStrictEqual(fs.readFileSync(path.join(worker2, blueprint, 'tasks/001/tasks.md')), edited);
  assert.strictEqual(fs.readFileSync(path.join(worker1, '.bouncer/config.json'), 'utf8'), '{"verify":"node --test"}\n');
  // prepare는 main을 다시 채우지 않는다.
  assert.strictEqual(fs.existsSync(path.join(repo, blueprint)), false);

  // 병렬 worker는 각자 독립 사본을 받는다. 한 worker의 수정은 다른 worker와
  // integration 정본에 번지지 않는다.
  const shared = path.join(blueprint, 'tasks/002/tasks.md');
  const before = fs.readFileSync(path.join(boot.integrationPath, shared));
  fs.writeFileSync(path.join(worker1, shared), 'worker 001 local edit\n');
  assert.deepStrictEqual(fs.readFileSync(path.join(worker2, shared)), before);
  assert.deepStrictEqual(fs.readFileSync(path.join(boot.integrationPath, shared)), before);
});

test('prepare rejects a missing integration blueprint before creating any worker', () => {
  const blueprint = '.bouncer/context/epics/042-x/blueprints/043-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-missing-', blueprint, [['001', '  depends_on: []\n']]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  fs.rmSync(path.join(boot.integrationPath, blueprint), { recursive: true, force: true });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');

  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.deepStrictEqual(result, {
    ok: false, reason: 'missing-blueprint', blueprintDir: blueprint, integrationPath: boot.integrationPath,
  });
  const listed = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  assert.doesNotMatch(listed, /workers/);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
});

test('prepare keeps the repaired integration terminal bundle without reading main', () => {
  const blueprint = '.bouncer/context/epics/044-x/blueprints/045-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-verify-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  fs.rmSync(path.join(repo, blueprint), { recursive: true, force: true });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  ledger.tasks[1].status = 'verifying';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const repaired = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'], decision: 'repair source',
  });
  assert.strictEqual(repaired.ok, true, JSON.stringify(repaired));
  const terminalFile = path.join(boot.integrationPath, blueprint, 'tasks/002/tasks.md');
  const terminalAfterRepair = fs.readFileSync(terminalFile);
  const afterRepair = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  afterRepair.tasks.find((entry) => entry.id === '003').status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(afterRepair, null, 2)}\n`);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['002']);
  assert.strictEqual(prepared.tasks.find((entry) => entry.id === '002').status, 'ready');
  assert.deepStrictEqual(fs.readFileSync(terminalFile), terminalAfterRepair);

  // integration에 bundle이 없으면 main에서 되살리지 않고 원장도 그대로 둔다.
  // main에는 tasks/002를 되돌려 두고 integration에서만 지운다. main을 읽는 구현이면
  // 여기서 bundle을 되살려 통과하므로, 이 배치가 main 비의존을 가른다.
  const reset = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  reset.tasks.find((entry) => entry.id === '002').status = 'pending';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(reset, null, 2)}\n`);
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/002'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/002/tasks.md'), terminalAfterRepair);
  const integrationBundle = path.join(boot.integrationPath, blueprint, 'tasks/002');
  fs.rmSync(integrationBundle, { recursive: true, force: true });
  const missing = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(missing.reason, 'missing-verification-bundle');
  assert.strictEqual(fs.existsSync(integrationBundle), false);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
});

// 디렉터리 아래 모든 파일의 상대 경로와 바이트. 실패 전후 사본을 바이트 단위로 대조한다.
function snapshotTree(root) {
  const files = {};
  const visit = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const child = path.join(dir, name);
      if (fs.statSync(child).isDirectory()) visit(child);
      else files[path.relative(root, child)] = fs.readFileSync(child);
    }
  };
  visit(root);
  return files;
}

test('a failed second worker seed leaves main plan, the first worker copy, and the ledger unchanged', () => {
  const blueprint = '.bouncer/context/epics/046-x/blueprints/047-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-seedfail-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
    ['002', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  // 002 worker를 미리 등록해 prepare가 재사용하게 하고, blueprint가 들어갈 자리의 조상을
  // 일반 파일로 막는다. 001 seed가 끝난 뒤 002의 cpSync만 결정적으로 실패한다.
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const worker1 = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' }).workerPath;
  const worker2 = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '002' }).workerPath;
  fs.mkdirSync(path.dirname(worker2), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-b', 'bouncer/046-047-002', worker2, 'HEAD'], { cwd: boot.integrationPath });
  fs.mkdirSync(path.join(worker2, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(worker2, '.bouncer/context'), 'blocks the blueprint copy\n');
  const mainBefore = snapshotTree(path.join(repo, '.bouncer'));
  const integrationPlan = snapshotTree(path.join(boot.integrationPath, blueprint));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');

  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.reason, 'copy-failed', JSON.stringify(result));
  assert.deepStrictEqual(snapshotTree(path.join(repo, '.bouncer')), mainBefore);
  // 001 사본은 002 실패 전에 integration에서 받은 바이트 그대로다.
  assert.deepStrictEqual(snapshotTree(path.join(worker1, blueprint)), integrationPlan);
  assert.deepStrictEqual(snapshotTree(path.join(boot.integrationPath, blueprint)), integrationPlan);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
});

test('a missing verification bundle in a mixed wave is rejected before any worker worktree exists', () => {
  const blueprint = '.bouncer/context/epics/048-x/blueprints/049-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-mixed-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
    ['002', '  depends_on: []\n  parallel_safe: true\n'],
    ['003', '  execution_kind: verification\n  depends_on: []\n  parallel_safe: true\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.deepStrictEqual(boot.ready, ['001', '002', '003']);
  fs.rmSync(path.join(boot.integrationPath, blueprint, 'tasks/003'), { recursive: true, force: true });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');

  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.reason, 'missing-verification-bundle');
  const listed = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  assert.doesNotMatch(listed, /workers/);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
});

// task bundle 세 문서를 지정한 상태로 쓴다. commit_sha는 `bouncer commit`이 찍는
// 8자리 short SHA 자리이고, 따옴표로 감싸 숫자뿐인 SHA도 문자열로 남긴다.
function writeBundle(root, blueprint, id, { tasks, verification, review, commitSha }) {
  const dir = path.join(root, blueprint, 'tasks', id);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = commitSha ? `  commit_sha: '${commitSha}'\n` : '';
  fs.writeFileSync(path.join(dir, 'tasks.md'),
    `---\nbouncer:\n  id: TASKS-${id}\n  status: ${tasks}\n  depends_on: []\n  parallel_safe: true\n${stamp}---\nbrief ${id}\n`);
  fs.writeFileSync(path.join(dir, 'verification.md'),
    `---\nbouncer:\n  id: VERIFY-${id}\n  status: ${verification}\n---\n# Verification\n`);
  fs.writeFileSync(path.join(dir, 'review.md'),
    `---\nbouncer:\n  id: REVIEW-${id}\n  status: ${review}\n---\n# Review\n`);
}

const SCAFFOLD = { tasks: 'ready', verification: 'pending', review: 'pending' };
const TERMINAL = { tasks: 'verified', verification: 'passed', review: 'accepted' };

// 계획을 커밋하지 않은 두 task drive를 001 record까지 진행한다. worker와 integration의
// bundle은 모두 scaffold 상태이고, 001 worker만 source 커밋 하나를 가진다.
function recordedDrive(prefix, blueprint) {
  const repo = uncommittedPlanRepo(prefix, blueprint, []);
  for (const id of ['001', '002']) writeBundle(repo, blueprint, id, SCAFFOLD);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks.find((entry) => entry.id === '001').workerPath;
  fs.mkdirSync(path.join(worker, 'src'), { recursive: true });
  fs.writeFileSync(path.join(worker, 'src/task.js'), 'changed by 001\n');
  execFileSync('git', ['add', 'src/task.js'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'feat: 001'],
    { cwd: worker });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
  return {
    repo, worker, sha, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
    head: () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: boot.integrationPath, encoding: 'utf8' }).trim(),
  };
}

test('commit integrate refuses worker evidence that is not terminal or stamps another SHA', () => {
  const blueprint = '.bouncer/context/epics/050-x/blueprints/051-y';
  const drive = recordedDrive('bouncer-coordinator-evidence-', blueprint);
  const bundle = `${blueprint}/tasks/001`;
  const integrationBundle = snapshotTree(path.join(drive.integrationPath, bundle));
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const headBefore = drive.head();

  // scaffold 상태 그대로 record한 worker는 증적이 없다.
  const scaffold = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
  });
  assert.strictEqual(scaffold.reason, 'worker-evidence-not-terminal', JSON.stringify(scaffold));
  assert.deepStrictEqual(scaffold.files,
    ['tasks.md', 'verification.md', 'review.md'].map((name) => `${bundle}/${name}`));
  assert.strictEqual(drive.head(), headBefore);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
  assert.deepStrictEqual(snapshotTree(path.join(drive.integrationPath, bundle)), integrationBundle);

  // 상태가 terminal이어도 다른 커밋의 SHA가 찍힌 증적은 이 fan-in의 증적이 아니다.
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: 'deadbeef' });
  const mismatch = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
  });
  assert.strictEqual(mismatch.reason, 'worker-evidence-sha-mismatch', JSON.stringify(mismatch));
  assert.deepStrictEqual(mismatch.files, [`${bundle}/tasks.md`]);
  assert.strictEqual(drive.head(), headBefore);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
  assert.deepStrictEqual(snapshotTree(path.join(drive.integrationPath, bundle)), integrationBundle);
});

test('commit integrate copies only the terminal task bundle into the integration worktree', () => {
  const blueprint = '.bouncer/context/epics/052-x/blueprints/053-y';
  const drive = recordedDrive('bouncer-coordinator-copy-', blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  // worker 쪽 다른 bundle과 blueprint index가 바뀌어도 integration으로 번지면 안 된다.
  fs.writeFileSync(path.join(drive.worker, blueprint, 'tasks/002/tasks.md'), 'worker-only edit\n');
  fs.writeFileSync(path.join(drive.worker, blueprint, 'index.md'), 'worker-only index\n');
  const otherBundle = snapshotTree(path.join(drive.integrationPath, blueprint, 'tasks/002'));
  const indexBefore = fs.readFileSync(path.join(drive.integrationPath, blueprint, 'index.md'));

  const result = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.task.status, 'integrated');
  for (const name of ['tasks.md', 'verification.md', 'review.md']) {
    const rel = path.join(blueprint, 'tasks/001', name);
    assert.deepStrictEqual(fs.readFileSync(path.join(drive.integrationPath, rel)),
      fs.readFileSync(path.join(drive.worker, rel)), rel);
  }
  assert.deepStrictEqual(snapshotTree(path.join(drive.integrationPath, blueprint, 'tasks/002')), otherBundle);
  assert.deepStrictEqual(fs.readFileSync(path.join(drive.integrationPath, blueprint, 'index.md')), indexBefore);
  assert.strictEqual(fs.readFileSync(path.join(drive.integrationPath, 'src/task.js'), 'utf8'), 'changed by 001\n');
});

test('a failed cherry-pick restores the copied bundle and keeps the throw path', () => {
  const blueprint = '.bouncer/context/epics/054-x/blueprints/055-y';
  const drive = recordedDrive('bouncer-coordinator-restore-', blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  // review.md가 integration에 없던 경우도 되돌림 대상이다 — 복사로 생긴 파일은 지운다.
  const bundle = path.join(drive.integrationPath, blueprint, 'tasks/001');
  fs.rmSync(path.join(bundle, 'review.md'));
  const bundleBefore = snapshotTree(bundle);
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const headBefore = drive.head();
  const failingCherryPick = (file, args, options) => {
    if (args[0] === 'cherry-pick') throw new Error('injected cherry-pick failure');
    return execFileSync(file, args, options);
  };

  assert.throws(() => coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: { execFileSync: failingCherryPick },
  }), /injected cherry-pick failure/);
  assert.deepStrictEqual(snapshotTree(bundle), bundleBefore);
  assert.strictEqual(fs.existsSync(path.join(bundle, 'review.md')), false);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
  assert.strictEqual(drive.head(), headBefore);

  // bundle 디렉터리 자체가 없던 경우 복사가 만든 `tasks/001/`까지 지워야 복사 전과 같다.
  // 파일만 지우는 되돌림이면 빈 디렉터리가 남아 여기서 갈린다.
  fs.rmSync(bundle, { recursive: true, force: true });
  assert.throws(() => coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: { execFileSync: failingCherryPick },
  }), /injected cherry-pick failure/);
  assert.strictEqual(fs.existsSync(bundle), false);
  assert.strictEqual(fs.existsSync(path.join(drive.integrationPath, blueprint, 'tasks/002/tasks.md')), true);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
  assert.strictEqual(drive.head(), headBefore);
});

test('a dynamic repair task integrates only with terminal worker evidence and copies its bundle', () => {
  const blueprint = '.bouncer/context/epics/056-x/blueprints/057-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-repair-evidence-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const integrationPath = boot.integrationPath;
  const ledgerFile = path.join(integrationPath, '.bouncer/runtime/coordinator.json');
  // 선행 조건만 원장에 둔다: 001은 통합되었고 terminal 검증 002가 실패한 상태다.
  // repair task 003 자체는 아래 `coordinate repair`가 만든다.
  const seeded = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  seeded.tasks[0].status = 'integrated';
  seeded.tasks[1].status = 'verifying';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(seeded, null, 2)}\n`);
  const repaired = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'], decision: 'repair source',
  });
  assert.strictEqual(repaired.ok, true, JSON.stringify(repaired));
  assert.strictEqual(repaired.repairTask.id, '003');
  assert.strictEqual(repaired.repairTask.dynamic, true);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['003']);
  const worker = prepared.tasks.find((entry) => entry.id === '003').workerPath;
  fs.mkdirSync(path.join(worker, 'src'), { recursive: true });
  fs.writeFileSync(path.join(worker, 'src/fix.js'), 'repaired\n');
  execFileSync('git', ['add', 'src/fix.js'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fix: 003'],
    { cwd: worker });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '003' });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));

  // repair가 쓴 scaffold(tasks ready, verification·review pending) 그대로는 증적이 아니다.
  const bundle = `${blueprint}/tasks/003`;
  const integrationBundle = snapshotTree(path.join(integrationPath, bundle));
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');
  const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: integrationPath, encoding: 'utf8' }).trim();
  const scaffold = coordinate({ command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '003' });
  assert.strictEqual(scaffold.reason, 'worker-evidence-not-terminal', JSON.stringify(scaffold));
  assert.deepStrictEqual(scaffold.files,
    ['tasks.md', 'verification.md', 'review.md'].map((name) => `${bundle}/${name}`));
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
  assert.strictEqual(
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: integrationPath, encoding: 'utf8' }).trim(), headBefore);
  assert.deepStrictEqual(snapshotTree(path.join(integrationPath, bundle)), integrationBundle);

  writeBundle(worker, blueprint, '003', { ...TERMINAL, commitSha: sha.slice(0, 8) });
  const integrated = coordinate({ command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '003' });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.strictEqual(integrated.task.status, 'integrated');
  for (const name of ['tasks.md', 'verification.md', 'review.md']) {
    const rel = path.join(bundle, name);
    assert.deepStrictEqual(fs.readFileSync(path.join(integrationPath, rel)), fs.readFileSync(path.join(worker, rel)), rel);
  }
  assert.strictEqual(fs.readFileSync(path.join(integrationPath, 'src/fix.js'), 'utf8'), 'repaired\n');
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

// 계획을 커밋하지 않은 한 task drive를 integrate까지 진행한다. main의 계획 사본은
// bootstrap 때 바이트 그대로 남아 있고, integration blueprint는 아직 approved다.
function integratedDrive(prefix, blueprint) {
  const drive = uncommittedPlanRepo(prefix, blueprint, []);
  writeBundle(drive, blueprint, '001', SCAFFOLD);
  const boot = coordinate({ command: 'bootstrap', repoRoot: drive, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({ command: 'prepare', repoRoot: drive, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  fs.mkdirSync(path.join(worker, 'src'), { recursive: true });
  fs.writeFileSync(path.join(worker, 'src/task.js'), 'changed by 001\n');
  execFileSync('git', ['add', 'src/task.js'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'feat: 001'],
    { cwd: worker });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
  writeBundle(worker, blueprint, '001', { ...TERMINAL, commitSha: sha.slice(0, 8) });
  assert.strictEqual(coordinate({ command: 'record', repoRoot: drive, blueprint, cwd: worker, task: '001' }).ok, true);
  const integrated = coordinate({
    command: 'integrate', repoRoot: drive, blueprint, cwd: boot.integrationPath, task: '001',
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  return {
    repo: drive, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
    close: () => fs.writeFileSync(path.join(boot.integrationPath, blueprint, 'index.md'),
      '---\nbouncer:\n  status: closed\n---\n# Blueprint\n'),
  };
}

function mainState(repo, blueprint) {
  return {
    status: execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repo, encoding: 'utf8' }),
    plan: snapshotTree(path.join(repo, blueprint)),
  };
}

test('release removes main plan copies that still match the seed manifest and converges on rerun', () => {
  const blueprint = '.bouncer/context/epics/058-x/blueprints/059-y';
  const { repo, close } = integratedDrive('bouncer-coordinator-release-', blueprint);
  close();

  const released = coordinate({ command: 'release', repoRoot: repo, blueprint, cwd: repo });
  assert.equal(released.ok, true, JSON.stringify(released));
  assert.equal(released.command, 'release');
  assert.ok(released.released.includes(`${blueprint}/tasks/001/tasks.md`));
  assert.ok(released.released.includes(`${blueprint}/index.md`));
  assert.deepStrictEqual(released.restored, []);
  assert.deepStrictEqual(released.preserved, []);
  assert.ok(!fs.existsSync(path.join(repo, blueprint)));
  // 빈 디렉터리 정리는 blueprint 트리 안에서 멈춘다. 상위 blueprints/와 epic 디렉터리는 남는다.
  assert.ok(fs.existsSync(path.join(repo, path.dirname(blueprint))));
  assert.ok(fs.existsSync(path.join(repo, path.dirname(path.dirname(blueprint)))));
  // manifest 밖 main 파일(config)은 그대로다.
  assert.strictEqual(fs.readFileSync(path.join(repo, '.bouncer/config.json'), 'utf8'), '{"verify":"node --test"}\n');

  const again = coordinate({ command: 'release', repoRoot: repo, blueprint, cwd: repo });
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.deepStrictEqual(again.released, []);
  assert.deepStrictEqual(again.restored, []);
  assert.deepStrictEqual(again.absent.sort(), [...released.released].sort());
});

test('release preserves a main plan copy edited after bootstrap', () => {
  const blueprint = '.bouncer/context/epics/060-x/blueprints/061-y';
  const { repo, close } = integratedDrive('bouncer-coordinator-preserve-', blueprint);
  close();
  const edited = path.join(repo, blueprint, 'tasks/001/tasks.md');
  fs.writeFileSync(edited, 'edited on main during the drive\n');

  const result = coordinate({ command: 'release', repoRoot: repo, blueprint, cwd: repo });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.preserved, [`${blueprint}/tasks/001/tasks.md`]);
  assert.strictEqual(fs.readFileSync(edited, 'utf8'), 'edited on main during the drive\n');
  assert.ok(result.released.includes(`${blueprint}/tasks/001/review.md`));
});

test('release refuses every unfinished or misplaced drive without changing main', () => {
  const blueprint = '.bouncer/context/epics/062-x/blueprints/063-y';
  const { repo, integrationPath, ledgerFile, close } = integratedDrive('bouncer-coordinator-refuse-', blueprint);
  const before = mainState(repo, blueprint);
  const release = (extra = {}) => coordinate({ command: 'release', repoRoot: repo, blueprint, cwd: repo, ...extra });
  const refuse = (reason, extra) => {
    const result = release(extra);
    assert.deepStrictEqual(result, { ok: false, reason }, JSON.stringify(result));
    assert.deepStrictEqual(mainState(repo, blueprint), before, reason);
  };

  // integration blueprint가 아직 approved다.
  refuse('blueprint-not-closed');
  close();

  refuse('release-requires-main-checkout', { cwd: integrationPath });
  refuse('release-requires-main-checkout', { repoRoot: integrationPath, cwd: integrationPath });

  const ledgerBytes = fs.readFileSync(ledgerFile, 'utf8');
  const withLedger = (mutate, reason) => {
    const ledger = JSON.parse(ledgerBytes);
    mutate(ledger);
    fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
    refuse(reason);
    fs.writeFileSync(ledgerFile, ledgerBytes);
  };
  withLedger((ledger) => { delete ledger.seedManifest; }, 'missing-seed-manifest');
  withLedger((ledger) => { ledger.status = 'awaiting_confirmation'; }, 'drive-not-closed');
  withLedger((ledger) => { ledger.tasks[0].status = 'recorded'; }, 'drive-not-closed');
  // 두 원인이 겹치면 Interface 순서대로 앞선 reason이 나온다.
  withLedger((ledger) => {
    delete ledger.seedManifest;
    ledger.status = 'awaiting_confirmation';
  }, 'missing-seed-manifest');

  fs.renameSync(ledgerFile, `${ledgerFile}.bak`);
  refuse('missing-ledger');
  fs.renameSync(`${ledgerFile}.bak`, ledgerFile);

  // 거절이 끝난 뒤의 같은 drive는 정상 release된다.
  assert.equal(release().ok, true);
});
