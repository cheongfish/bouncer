'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readyWave, transition } = require('../scripts/lib/coordinator');

const __coordinatorMod = require('../scripts/lib/coordinator');
const { coordinatorPathsFor: __coordinatorPathsFor } = require('../scripts/lib/runtime-state');
const __crypto = require('node:crypto');
const __LEDGER_REL = '.bouncer/runtime/coordinator.json';
const __FENCED = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'release', 'revoke',
]);
function __fence(repoRoot, blueprint) {
  const { ledgerFile } = __coordinatorPathsFor({ repoRoot, blueprint });
  return {
    ledgerPath: __LEDGER_REL,
    ledgerHash: __crypto.createHash('sha256').update(fs.readFileSync(ledgerFile)).digest('hex'),
  };
}
function coordinate(opts) {
  if (__FENCED.has(opts.command)
    && opts.ledgerPath === undefined && opts.ledgerHash === undefined) {
    try {
      opts = { ...opts, ...__fence(opts.repoRoot, opts.blueprint) };
    } catch (_error) { /* missing ledger → core rejects */ }
  }
  return __coordinatorMod.coordinate(opts);
}
const coordinateRaw = __coordinatorMod.coordinate;

const { validateCoordinatorLedger } = require('../scripts/lib/runtime-state');
const { writeCurrent } = require('../scripts/lib/current');

function writeCoordinatorConfig(repoRoot, coordinator) {
  const dir = path.join(repoRoot, '.bouncer');
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.existsSync(path.join(dir, 'config.json'))
    ? JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))
    : {};
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    `${JSON.stringify({ ...existing, coordinator }, null, 2)}\n`,
  );
}

/**
 * dispatch → accepted report. record 사전조건을 채운 뒤 호출부가 record를 이어서 부른다.
 */
function acceptDispatchReport(repo, blueprint, worker, task = '001') {
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task,
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const reported = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task,
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: `accepted ${task}`,
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  return dispatched;
}

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
    { id: '001', status: 'integrated', affected_paths: ['a/'] },
    { id: '002', depends_on: ['001'], parallel_safe: true, status: 'pending', affected_paths: ['b/'] },
    { id: '003', depends_on: ['001'], parallel_safe: false, status: 'pending', affected_paths: ['c/'] },
    // 005는 아직 종단 상태에 닿지 않았다. gate 값이 integrated 하나뿐이어도
    // 004는 선행이 그 상태가 되기 전까지 열리지 않는다. 초기 status는 pending —
    // recorded로 두면 in-flight가 비지 않아 순차 후보(003)를 열 수 없다.
    { id: '004', depends_on: ['005'], dependency_gate: 'integrated', parallel_safe: true, status: 'pending', affected_paths: ['d/'] },
    { id: '005', depends_on: [], parallel_safe: true, status: 'pending', affected_paths: ['e/'] },
  ];
  assert.deepStrictEqual(readyWave(tasks), ['003']);
  // sequential in-flight가 있으면 후보를 열지 않는다 — 예전처럼 prepared 옆의
  // parallel 후보를 바로 열면 한도·충돌 정책과 어긋난다.
  tasks[2].status = 'prepared';
  assert.deepStrictEqual(readyWave(tasks), []);
  tasks[2].status = 'integrated';
  tasks[4].status = 'recorded';
  assert.deepStrictEqual(readyWave(tasks), ['002']);
  tasks[4].status = 'integrated';
  assert.deepStrictEqual(readyWave(tasks), ['002', '004']);
});

test('readyWave caps parallel_safe tasks by maxParallel and path/resource conflicts', () => {
  const threeDisjoint = [
    { id: '001', status: 'pending', parallel_safe: true, affected_paths: ['a/'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['b/'] },
    { id: '003', status: 'pending', parallel_safe: true, affected_paths: ['c/'] },
  ];
  // 세 task 모두 parallel_safe·경로 분리 → 기본 한도 2
  assert.deepStrictEqual(readyWave(threeDisjoint), ['001', '002']);
  // in-flight 001(src/) + pending 002(src/a.ts) → 조상 충돌로 제외.
  // Checklist/Goal은 trailing-slash 디렉터리 표기를 쓰므로, pathsOverlap 호출 전에
  // 정규화하지 않으면 충돌을 놓친다(RD-001).
  assert.deepStrictEqual(readyWave([
    { id: '001', status: 'prepared', parallel_safe: true, affected_paths: ['src/'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['src/a.ts'] },
  ]), []);
  // `./` prefix도 같은 경로로 취급해야 한다 — raw pathsOverlap('./src/a.ts','src/a.ts')===false.
  assert.deepStrictEqual(readyWave([
    { id: '001', status: 'prepared', parallel_safe: true, affected_paths: ['./src/a.ts'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['src/a.ts'] },
  ]), []);
  // 같은 exclusive_resources
  const sameResourcePair = [
    { id: '001', status: 'pending', parallel_safe: true, affected_paths: ['a/'], exclusive_resources: ['database-schema'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['b/'], exclusive_resources: ['database-schema'] },
  ];
  assert.deepStrictEqual(readyWave(sameResourcePair), ['001']);
  assert.deepStrictEqual(readyWave(threeDisjoint, { maxParallel: 1 }), ['001']);
  // 경로 필드가 모두 없는 legacy task는 단독
  const legacyPair = [
    { id: '001', status: 'pending', parallel_safe: true },
    { id: '002', status: 'pending', parallel_safe: true },
  ];
  assert.deepStrictEqual(readyWave(legacyPair), ['001']);
});

test('readCoordinatorPolicy accepts integers >= 1 and rejects invalid max_parallel', () => {
  const { readCoordinatorPolicy, DEFAULT_MAX_PARALLEL } = require('../scripts/lib/config');
  assert.strictEqual(DEFAULT_MAX_PARALLEL, 2);
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coord-policy-'));
  assert.deepStrictEqual(readCoordinatorPolicy(repo), { ok: true, maxParallel: 2 });
  writeCoordinatorConfig(repo, {});
  assert.deepStrictEqual(readCoordinatorPolicy(repo), { ok: true, maxParallel: 2 });
  writeCoordinatorConfig(repo, { max_parallel: 3 });
  assert.deepStrictEqual(readCoordinatorPolicy(repo), { ok: true, maxParallel: 3 });
  for (const bad of [0, -1, 1.5, '2', null]) {
    writeCoordinatorConfig(repo, { max_parallel: bad });
    assert.deepStrictEqual(
      readCoordinatorPolicy(repo),
      { ok: false, reason: 'invalid' },
      `max_parallel=${JSON.stringify(bad)}`,
    );
  }
});

test('prepare rejects invalid max_parallel before creating workers and honors max_parallel 1', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coord-prepare-limit-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/078-x/blueprints/001-y';
  for (const [id, leaf] of [['001', 'a'], ['002', 'b'], ['003', 'c']]) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(
      path.join(repo, blueprint, 'tasks', id, 'tasks.md'),
      `---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  affected_paths:\n    - ${leaf}/\n---\n`,
    );
  }
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));

  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 0 });
  const workersRoot = path.join(boot.integrationPath, '..', 'workers');
  const rejected = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'coordinator-config-invalid');
  assert.strictEqual(fs.existsSync(workersRoot), false);

  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 1 });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['001']);
  const preparedCount = prepared.tasks.filter((task) => task.status === 'prepared').length;
  assert.strictEqual(preparedCount, 1);
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
  let seenScope = null;
  const integrationHead = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).integrationHead
    || execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: boot.integrationPath, encoding: 'utf8',
    }).trim();
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: (opts) => {
        calls += 1;
        seenScope = opts.scope;
        return { ok: true, command: 'node --test', exitCode: 0 };
      },
    },
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(passed.task.status, 'integrated');
  // CT-001: terminal CI evidence key는 blueprint 안정 ID + integration HEAD다.
  assert.deepStrictEqual(seenScope, {
    kind: 'terminal',
    key: `EPIC-011/BP-012:${integrationHead}`,
  });

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
  acceptDispatchReport(repo, blueprint, worker, '001');
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
  // 기본 maxParallel 2 안에서 verification이 wave에 들어가도록 commit 하나와
  // 묶는다. 세 개를 넣으면 한도 때문에 verification이 빠져 거절 경로를 못 탄다.
  const repo = uncommittedPlanRepo('bouncer-coordinator-mixed-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
    ['002', '  execution_kind: verification\n  depends_on: []\n  parallel_safe: true\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.deepStrictEqual(boot.ready, ['001', '002']);
  fs.rmSync(path.join(boot.integrationPath, blueprint, 'tasks/002'), { recursive: true, force: true });
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
  acceptDispatchReport(repo, blueprint, worker, '001');
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

test('a cherry-pick CONFLICT returns fanin-conflict without touching canonical HEAD', () => {
  const blueprint = '.bouncer/context/epics/054-x/blueprints/055-y';
  const drive = recordedDrive('bouncer-coordinator-restore-', blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  const bundle = path.join(drive.integrationPath, blueprint, 'tasks/001');
  const bundleBefore = snapshotTree(bundle);
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const headBefore = drive.head();
  // RD-001: fanin-conflict는 git CONFLICT만. stderr에 CONFLICT가 있어야 revoke 경로다.
  const failingCherryPick = (file, args, options) => {
    if (args[0] === 'cherry-pick' && args[1] !== '--abort') {
      const err = new Error('CONFLICT (content): Merge conflict in README.md');
      err.stderr = 'error: could not apply abc\nCONFLICT (content): Merge conflict in README.md\n';
      err.status = 1;
      throw err;
    }
    return execFileSync(file, args, options);
  };

  const conflicted = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: {
      execFileSync: failingCherryPick,
      runVerification: () => ({ ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) }),
    },
  });
  assert.strictEqual(conflicted.reason, 'fanin-conflict');
  assert.strictEqual(conflicted.task, '001');
  assert.deepStrictEqual(snapshotTree(bundle), bundleBefore);
  assert.strictEqual(drive.head(), headBefore);
  const after = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(after.fanin, null);
  assert.strictEqual(after.tasks.find((t) => t.id === '001').status, 'pending');
  const { faninPath } = __coordinatorPathsFor({ repoRoot: drive.repo, blueprint });
  assert.strictEqual(fs.existsSync(faninPath), false);
  // 거절 경로가 원장 decision을 쓰므로 bytes는 달라도 canonical HEAD는 그대로다.
  void ledgerBefore;
});

test('a non-conflict cherry-pick failure aborts candidate without fanin-conflict revoke', () => {
  // RD-001: bad object 등 CONFLICT가 아닌 실패는 revoke하지 않고 candidate만 정리한다.
  const blueprint = '.bouncer/context/epics/054-x/blueprints/056-y';
  const drive = recordedDrive('bouncer-coordinator-pick-fail-', blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  const headBefore = drive.head();
  const failingCherryPick = (file, args, options) => {
    if (args[0] === 'cherry-pick' && args[1] !== '--abort') {
      const err = new Error('bad object deadbeef');
      err.stderr = 'fatal: bad object deadbeef\n';
      err.status = 128;
      throw err;
    }
    return execFileSync(file, args, options);
  };

  const failed = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: {
      execFileSync: failingCherryPick,
      runVerification: () => ({ ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) }),
    },
  });
  assert.strictEqual(failed.reason, 'cherry-pick-failed');
  assert.strictEqual(failed.task, '001');
  assert.notStrictEqual(failed.reason, 'fanin-conflict');
  assert.strictEqual(drive.head(), headBefore);
  const after = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(after.fanin, null);
  assert.strictEqual(after.tasks.find((t) => t.id === '001').status, 'recorded');
  const { faninPath } = __coordinatorPathsFor({ repoRoot: drive.repo, blueprint });
  assert.strictEqual(fs.existsSync(faninPath), false);
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
  acceptDispatchReport(repo, blueprint, prepared.tasks[0].workerPath, '001');
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
  acceptDispatchReport(repo, blueprint, worker, '001');
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


/**
 * prepared commit task fixture. bootstrap·prepare만 끝내 worker를 돌려준다.
 */
function preparedCommitDrive(prefix, blueprint) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'fixture'], { cwd: repo });
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'),
    '---\nbouncer:\n  status: ready\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\nbrief\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  return { repo, blueprint, worker, integrationPath: boot.integrationPath, ledgerFile };
}

function briefHash(worker, blueprint, task) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(worker, blueprint, 'tasks', task, 'tasks.md')))
    .digest('hex');
}

// drive false acceptance 방지: CLI 전략 실패·frozen target 불일치에서는
// review round를 열거나 accepted로 기록하지 않는다. coordinator.ts 전이가 아니라
// Worker dispatch 계약이 막는다 — ledger에 새 상태를 추가하지 않는다.
test('coordinator agent refuses review recording on strategy failure or target mismatch', () => {
  const root = path.join(__dirname, '..');
  const md = fs.readFileSync(path.join(root, 'agents/bouncer-coordinator.md'), 'utf8');
  assert.match(md, /bouncer review-dispatch execute|review-dispatch execute/);
  assert.match(md, /ok:\s*false|`ok`:\s*`false`/);
  assert.match(md, /target[\s\S]{0,100}mismatch|mismatch[\s\S]{0,100}target|frozen[\s\S]{0,80}(?:base|head)/i);
  assert.match(
    md,
    /(?:do not|never|stop|halt|abort)[\s\S]{0,160}(?:accepted|review round|record)|(?:accepted|review round)[\s\S]{0,100}(?:do not|never|stop|halt|abort)/i,
  );
  // risk_flags·perspectives는 CLI 그대로; file/line 재계산으로 전략을 바꾸지 않는다.
  assert.match(md, /risk_flags|perspectives/);
  assert.match(
    md,
    /(?:do not|never|without)[\s\S]{0,140}(?:override|recompute|guess|덮어|재계산|추측)|(?:override|recompute|guess)[\s\S]{0,80}(?:do not|never)/i,
  );
});

test('first dispatch returns attempt 1 metadata without previous_outcome', () => {
  const blueprint = '.bouncer/context/epics/060-x/blueprints/061-y';
  const drive = preparedCommitDrive('bouncer-dispatch-first-', blueprint);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: drive.worker, encoding: 'utf8' }).trim();
  const clean = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(clean.ok, true, JSON.stringify(clean));
  assert.deepStrictEqual(clean.metadata, {
    attempt: 1,
    task_brief_hash: briefHash(drive.worker, blueprint, '001'),
    base_head: head,
    initial_worktree_state: '',
  });
  assert.strictEqual('previous_outcome' in clean.metadata, false);

  // dirty porcelain은 원문 그대로 저장된다. 활성 attempt를 닫고 다시 연다.
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  ledger.tasks[0].dispatch.status = 'reported';
  ledger.tasks[0].dispatch.outcome = 'rework';
  ledger.tasks[0].dispatch.summary = 'retry dirty';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.writeFileSync(path.join(drive.worker, 'dirty.txt'), 'dirty\n');
  const porcelain = execFileSync('git', ['status', '--porcelain=v1'], {
    cwd: drive.worker, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const dirty = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dirty.ok, true, JSON.stringify(dirty));
  assert.strictEqual(dirty.metadata.attempt, 2);
  assert.strictEqual(dirty.metadata.initial_worktree_state, porcelain);
});

test('duplicate dispatch is rejected and accepted report enables redispatch with previous_outcome', () => {
  const blueprint = '.bouncer/context/epics/062-x/blueprints/063-y';
  const drive = preparedCommitDrive('bouncer-dispatch-dup-', blueprint);
  const first = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  const dup = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dup.ok, false);
  assert.strictEqual(dup.reason, 'dispatch-already-active');

  const hash = first.metadata.task_brief_hash;
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 1, taskBriefHash: hash, outcome: 'accepted', summary: 'implementer done',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  assert.strictEqual(reported.attempt, 1);
  assert.strictEqual(reported.decision.kind, 'report');
  assert.strictEqual(reported.decision.outcome, 'accepted');
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'reported');
  assert.strictEqual(ledger.tasks[0].status, 'prepared');

  // accepted 뒤에도 재디스패치는 가능하지만 previous_outcome을 싣는다.
  const again = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.strictEqual(again.metadata.attempt, 2);
  assert.deepStrictEqual(again.metadata.previous_outcome, {
    outcome: 'accepted', summary: 'implementer done',
  });
});

test('stale report appends expected/received and keeps the active attempt open', () => {
  const blueprint = '.bouncer/context/epics/064-x/blueprints/065-y';
  const drive = preparedCommitDrive('bouncer-dispatch-stale-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const expected = {
    attempt: dispatched.metadata.attempt,
    task_brief_hash: dispatched.metadata.task_brief_hash,
  };
  const received = {
    attempt: 9,
    task_brief_hash: 'a'.repeat(64),
  };
  const before = fs.readFileSync(drive.ledgerFile, 'utf8');
  const stale = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: received.attempt, taskBriefHash: received.task_brief_hash,
    outcome: 'accepted', summary: 'late report',
  });
  assert.strictEqual(stale.ok, false);
  assert.strictEqual(stale.reason, 'stale-report');
  assert.deepStrictEqual(stale.expected, expected);
  assert.deepStrictEqual(stale.received, received);
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'active');
  assert.strictEqual(ledger.tasks[0].status, 'prepared');
  assert.strictEqual(ledger.tasks[0].sha, undefined);
  const decision = ledger.decisions.at(-1);
  assert.strictEqual(decision.kind, 'stale-report');
  assert.deepStrictEqual(decision.expected, expected);
  assert.deepStrictEqual(decision.received, received);
  assert.notStrictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), before);
});

test('record rejects after brief bytes change following an accepted report', () => {
  const blueprint = '.bouncer/context/epics/066-x/blueprints/067-y';
  const drive = preparedCommitDrive('bouncer-dispatch-stale-record-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 1, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted', summary: 'ready to record',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  fs.appendFileSync(path.join(drive.worker, blueprint, 'tasks/001/tasks.md'), '\nchanged after accept\n');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const rejected = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'stale-worker-report');
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].status, 'prepared');
  assert.strictEqual(ledger.tasks[0].sha, undefined);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
});

test('record rejects a non-accepted report without storing worker SHA', () => {
  const blueprint = '.bouncer/context/epics/068-x/blueprints/069-y';
  const drive = preparedCommitDrive('bouncer-dispatch-non-accepted-record-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'rework', summary: 'needs another pass',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  assert.strictEqual(reported.decision.outcome, 'rework');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const rejected = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'accepted-report-required');
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].status, 'prepared');
  assert.strictEqual(ledger.tasks[0].sha, undefined);
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'reported');
  assert.strictEqual(ledger.tasks[0].dispatch.outcome, 'rework');
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
});

test('report without an active dispatch attempt is rejected', () => {
  const blueprint = '.bouncer/context/epics/070-x/blueprints/071-y';
  const drive = preparedCommitDrive('bouncer-dispatch-no-active-', blueprint);
  const hash = briefHash(drive.worker, blueprint, '001');
  const beforeDispatch = fs.readFileSync(drive.ledgerFile, 'utf8');
  const neverDispatched = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 1, taskBriefHash: hash, outcome: 'accepted', summary: 'too early',
  });
  assert.strictEqual(neverDispatched.ok, false);
  assert.strictEqual(neverDispatched.reason, 'no-active-dispatch');
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), beforeDispatch);

  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const closed = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'blocked', summary: 'stop here',
  });
  assert.strictEqual(closed.ok, true, JSON.stringify(closed));
  const afterClosed = fs.readFileSync(drive.ledgerFile, 'utf8');
  const again = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted', summary: 'after closed',
  });
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.reason, 'no-active-dispatch');
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), afterClosed);
  const ledger = JSON.parse(afterClosed);
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'reported');
  assert.strictEqual(ledger.tasks[0].dispatch.outcome, 'blocked');
  assert.strictEqual(ledger.tasks[0].sha, undefined);
});

const LEDGER_REL = '.bouncer/runtime/coordinator.json';

/**
 * status checkpoint·hash fence 전용 픽스처. 001을 통합한 뒤 002를 pending ready로 두고
 * unresolved decision·terminalFailure를 원장에만 남겨 projection을 검증한다.
 */
function checkpointFixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-checkpoint-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'fixture'], { cwd: repo });
  const blueprint = '.bouncer/context/epics/076-x/blueprints/001-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/002'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.js'), 'base\n');
  fs.writeFileSync(path.join(repo, `${blueprint}/index.md`),
    '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(path.join(repo, `${blueprint}/tasks/001/tasks.md`),
    '---\nbouncer:\n  status: ready\n  affected_paths:\n    - src/\n---\n');
  fs.writeFileSync(path.join(repo, `${blueprint}/tasks/002/tasks.md`),
    '---\nbouncer:\n  status: ready\n  depends_on: ["001"]\n  affected_paths:\n    - lib/\n---\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  // setup은 구현 전·후에도 통하도록, 있을 때만 fence를 붙인다.
  const prepareOpts = {
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  };
  if (boot.checkpoint && boot.checkpoint.ledger) {
    prepareOpts.ledgerPath = boot.checkpoint.ledger.path;
    prepareOpts.ledgerHash = boot.checkpoint.ledger.sha256;
  }
  const prepared = coordinate(prepareOpts);
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  fs.writeFileSync(path.join(worker, 'src/a.js'), 'ok\n');
  execFileSync('git', ['add', 'src/a.js'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'wip'], { cwd: worker });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
  const ledgerFile = path.join(boot.integrationPath, LEDGER_REL);
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  const openDecision = {
    task: '002', kind: 'critical-recovery', used: 1, findings: ['R-1'],
    reason: 'needs follow-up', outcome: null,
  };
  ledger.tasks[0].status = 'integrated';
  ledger.tasks[0].sha = sha;
  ledger.tasks[0].dispatch = {
    attempt: 1, task_brief_hash: 'a'.repeat(64), base_head: 'abc',
    initial_worktree_state: '', status: 'reported', outcome: 'accepted', summary: 'done',
  };
  ledger.tasks[0].scope = { revision: 'r1', paths: ['src/'] };
  ledger.tasks[0].verify_evidence_id = 'v'.repeat(64);
  ledger.tasks[0].decisions = [{ task: '001', kind: 'dispatch', attempt: 1, task_brief_hash: 'a'.repeat(64),
    base_head: 'abc', initial_worktree_state: '' }];
  ledger.tasks[1].status = 'pending';
  ledger.tasks[1].criticalRecovery = {
    used: 1, findings: ['R-1'], reason: 'needs follow-up', outcome: null,
  };
  ledger.decisions = [openDecision, { task: '001', kind: 'report', attempt: 1,
    task_brief_hash: 'a'.repeat(64), outcome: 'accepted', summary: 'done' }];
  ledger.terminalFailure = {
    task: '002', command: 'npm test', summary: 'wave failed',
    paths: ['lib/'], exitCode: 1, repairWave: 1,
  };
  ledger.revision = 'r2';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  return { repo, blueprint, integration: boot.integrationPath, ledgerFile, sha };
}

test('status checkpoint summarizes completed tasks without dispatch or decision bodies', () => {
  const drive = checkpointFixture();
  const status = coordinate({
    command: 'status', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration,
  });
  assert.strictEqual(status.ok, true, JSON.stringify(status));
  assert.strictEqual(status.tasks, undefined);
  assert.strictEqual(status.decisions, undefined);
  const completed = status.checkpoint.completed_tasks;
  assert.strictEqual(completed.length, 1);
  assert.deepStrictEqual(completed[0], {
    id: '001',
    status: 'integrated',
    attempt: 1,
    commit_sha: drive.sha,
    changed_paths: ['src/'],
    scope_revision: 'r1',
    verify_evidence_id: 'v'.repeat(64),
  });
  assert.strictEqual(Object.prototype.hasOwnProperty.call(completed[0], 'advisory'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(completed[0], 'review_evidence_id'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(completed[0], 'dispatch'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(completed[0], 'decisions'), false);
});

test('status checkpoint keeps ready wave, active tasks, unresolved decisions, and recent failure', () => {
  const drive = checkpointFixture();
  const status = coordinate({
    command: 'status', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration,
  });
  assert.strictEqual(status.ok, true, JSON.stringify(status));
  const cp = status.checkpoint;
  assert.deepStrictEqual(cp.ready, ['002']);
  assert.strictEqual(cp.active_tasks.length, 1);
  assert.strictEqual(cp.active_tasks[0].id, '002');
  assert.strictEqual(cp.active_tasks[0].status, 'pending');
  assert.ok(cp.active_tasks[0].dispatch === undefined || cp.active_tasks[0].dispatch);
  // SS-002: Interface allowlist 밖 필드는 active projection에 실리면 안 된다.
  for (const forbidden of ['execution_kind', 'sha', 'criticalRecovery', 'dynamic']) {
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(cp.active_tasks[0], forbidden),
      false,
      forbidden,
    );
  }
  assert.deepStrictEqual(cp.unresolved_decisions, [{
    task: '002', kind: 'critical-recovery', used: 1, findings: ['R-1'],
    reason: 'needs follow-up', outcome: null,
  }]);
  assert.deepStrictEqual(cp.recent_failure, {
    task: '002', command: 'npm test', summary: 'wave failed',
    paths: ['lib/'], exitCode: 1, repairWave: 1,
  });
  assert.strictEqual(cp.revision, 'r2');
  assert.strictEqual(typeof cp.integration_head, 'string');
  assert.strictEqual(cp.ledger.path, LEDGER_REL);
  assert.match(cp.ledger.sha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(cp.ledger.revision, 'r2');
  const expectedHash = crypto.createHash('sha256')
    .update(fs.readFileSync(drive.ledgerFile)).digest('hex');
  assert.strictEqual(cp.ledger.sha256, expectedHash);
});

test('mutation ledger fence rejects missing, absolute, escaping, wrong path, and stale hash without writes', () => {
  const drive = checkpointFixture();
  const before = fs.readFileSync(drive.ledgerFile);
  const beforeMain = execFileSync('git', ['status', '--porcelain'], {
    cwd: drive.repo, encoding: 'utf8',
  });
  const hash = crypto.createHash('sha256').update(before).digest('hex');
  const cases = [
    { label: 'missing both', opts: {} },
    { label: 'missing hash', opts: { ledgerPath: LEDGER_REL } },
    { label: 'missing path', opts: { ledgerHash: hash } },
    { label: 'absolute', opts: { ledgerPath: path.join(drive.integration, LEDGER_REL), ledgerHash: hash } },
    { label: 'escaping', opts: { ledgerPath: '../runtime/coordinator.json', ledgerHash: hash } },
    { label: 'wrong path', opts: { ledgerPath: '.bouncer/runtime/other.json', ledgerHash: hash } },
    { label: 'bad hash shape', opts: { ledgerPath: LEDGER_REL, ledgerHash: 'zzzz' } },
    { label: 'stale hash', opts: { ledgerPath: LEDGER_REL, ledgerHash: 'b'.repeat(64) } },
  ];
  for (const entry of cases) {
    const rejected = coordinateRaw({
      command: 'prepare', repoRoot: drive.repo, blueprint: drive.blueprint,
      cwd: drive.integration, ...entry.opts,
    });
    assert.strictEqual(rejected.ok, false, entry.label);
    assert.match(rejected.reason, /ledger-checkpoint-invalid|stale-ledger-checkpoint/, entry.label);
    assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), before, entry.label);
  }
  assert.strictEqual(execFileSync('git', ['status', '--porcelain'], {
    cwd: drive.repo, encoding: 'utf8',
  }), beforeMain);
  // stale이 아니면 다음 hash로 prepare가 이어진다.
  const next = coordinateRaw({
    command: 'prepare', repoRoot: drive.repo, blueprint: drive.blueprint,
    cwd: drive.integration, ledgerPath: LEDGER_REL, ledgerHash: hash,
  });
  assert.strictEqual(next.ok, true, JSON.stringify(next));
  assert.ok(next.checkpoint);
  assert.match(next.checkpoint.ledger.sha256, /^[a-f0-9]{64}$/);
  assert.notStrictEqual(next.checkpoint.ledger.sha256, hash);
});

test('prepare issues lease and revoke makes late report/record/dispatch stale-lease', () => {
  const blueprint = '.bouncer/context/epics/080-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-stale-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const fence = __fence(repo, blueprint);
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath, ...fence,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.tasks.find((t) => t.id === '001').lease,
    { id: 'lease-a', generation: 1, seq: 1, status: 'active' });

  const worker = prepared.tasks.find((t) => t.id === '001').workerPath;
  const fence2 = __fence(repo, blueprint);
  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'scope-conflict', ...fence2,
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));
  assert.strictEqual(revoked.task.status, 'pending');

  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const taskBefore = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');

  const fence3 = __fence(repo, blueprint);
  const late = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', generation: 1,
    attempt: 1, taskBriefHash: 'a'.repeat(64), outcome: 'accepted', summary: 'late',
    ...fence3,
  });
  assert.strictEqual(late.reason, 'stale-lease');
  const afterReport = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');
  assert.deepStrictEqual(
    { ...afterReport, decisions: taskBefore.decisions },
    { ...taskBefore, decisions: taskBefore.decisions },
  );
  assert.strictEqual(afterReport.status, taskBefore.status);
  assert.deepStrictEqual(afterReport.dispatch, taskBefore.dispatch);
  assert.deepStrictEqual(afterReport.lease, taskBefore.lease);

  const fence4 = __fence(repo, blueprint);
  const lateRecord = coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', generation: 1, ...fence4,
  });
  assert.strictEqual(lateRecord.reason, 'stale-lease');

  const fence5 = __fence(repo, blueprint);
  const lateDispatch = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', generation: 1, ...fence5,
  });
  assert.strictEqual(lateDispatch.reason, 'stale-lease');
  const afterAll = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');
  assert.strictEqual(afterAll.status, taskBefore.status);
  assert.deepStrictEqual(afterAll.dispatch, taskBefore.dispatch);
  assert.deepStrictEqual(afterAll.lease, taskBefore.lease);
});

test('prepare requeues a revoked task with generation 2 and a fresh integration HEAD', () => {
  const blueprint = '.bouncer/context/epics/081-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-requeue-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks.find((t) => t.id === '001').workerPath;
  const branch = prepared.tasks.find((t) => t.id === '001').branch;
  fs.writeFileSync(path.join(worker, 'README.md'), 'worker commit\n');
  execFileSync('git', ['add', 'README.md'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'worker'], { cwd: worker });
  const oldWorkerHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: worker, encoding: 'utf8',
  }).trim();
  const integrationHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: boot.integrationPath, encoding: 'utf8',
  }).trim();
  assert.notStrictEqual(oldWorkerHead, integrationHead);

  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'requeue',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));

  let leaseN = 0;
  const preparedAgain = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => `lease-${++leaseN}` },
  });
  assert.strictEqual(preparedAgain.ok, true, JSON.stringify(preparedAgain));
  const again = preparedAgain.tasks.find((t) => t.id === '001');
  assert.strictEqual(again.lease.generation, 2);
  assert.strictEqual(again.lease.status, 'active');
  const newHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: again.workerPath, encoding: 'utf8',
  }).trim();
  const integrationNow = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: boot.integrationPath, encoding: 'utf8',
  }).trim();
  assert.strictEqual(newHead, integrationNow);
  // 이전 worker commit이 새 branch ancestry에 없어야 한다.
  let hasOld = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', oldWorkerHead, 'HEAD'], {
      cwd: again.workerPath, stdio: 'ignore',
    });
  } catch (_error) {
    hasOld = false;
  }
  assert.strictEqual(hasOld, false);
  assert.notStrictEqual(again.branch, undefined);
  void branch;
});

test('legacy task revoke leaves lease_id and generation null', () => {
  const blueprint = '.bouncer/context/epics/082-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-legacy-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  // lease 필드 없는 legacy 원장으로 되돌린다.
  delete ledger.tasks[0].lease;
  delete ledger.leaseSeq;
  ledger.tasks[0].status = 'prepared';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'legacy-revoke',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));
  assert.strictEqual(revoked.task.status, 'pending');
  assert.strictEqual(revoked.decision.lease_id, null);
  assert.strictEqual(revoked.decision.generation, null);
  assert.strictEqual(revoked.task.lease, undefined);
});

// RD-001: legacy(lease 없음) revoke 뒤 prepare도 dirty worker를 버리고
// integration HEAD에서 다시 만든다. lease.status === 'revoked'만 보면 놓친다.
test('prepare requeues a legacy revoked task from integration HEAD', () => {
  const blueprint = '.bouncer/context/epics/082-lease-requeue/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-legacy-requeue-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  delete ledger.tasks[0].lease;
  delete ledger.leaseSeq;
  ledger.tasks[0].status = 'prepared';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const worker = ledger.tasks[0].workerPath;
  fs.writeFileSync(path.join(worker, 'README.md'), 'legacy dirty\n');
  execFileSync('git', ['add', 'README.md'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'legacy-dirty'], { cwd: worker });
  const oldWorkerHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: worker, encoding: 'utf8',
  }).trim();

  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'legacy-requeue',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));

  const preparedAgain = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-legacy-2' },
  });
  assert.strictEqual(preparedAgain.ok, true, JSON.stringify(preparedAgain));
  const again = preparedAgain.tasks.find((t) => t.id === '001');
  const newHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: again.workerPath, encoding: 'utf8',
  }).trim();
  const integrationNow = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: boot.integrationPath, encoding: 'utf8',
  }).trim();
  assert.strictEqual(newHead, integrationNow);
  let hasOld = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', oldWorkerHead, 'HEAD'], {
      cwd: again.workerPath, stdio: 'ignore',
    });
  } catch (_error) {
    hasOld = false;
  }
  assert.strictEqual(hasOld, false);
});

// RD-003: --lease-id/--generation 중 하나만 주면 lease-required.
test('dispatch/report/record reject when only one of lease-id or generation is set', () => {
  const blueprint = '.bouncer/context/epics/086-lease-required/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-required-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks.find((t) => t.id === '001').workerPath;
  const briefHash = 'a'.repeat(64);

  const onlyId = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', attempt: 1, taskBriefHash: briefHash,
  });
  assert.strictEqual(onlyId.reason, 'lease-required');

  const onlyGen = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task: '001',
    generation: 1, attempt: 1, taskBriefHash: briefHash,
  });
  assert.strictEqual(onlyGen.reason, 'lease-required');

  const reportOnlyId = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', attempt: 1, taskBriefHash: briefHash,
    outcome: 'accepted', summary: 'x',
  });
  assert.strictEqual(reportOnlyId.reason, 'lease-required');

  const recordOnlyGen = coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001',
    generation: 1,
  });
  assert.strictEqual(recordOnlyGen.reason, 'lease-required');
});

// RD-004: revoke 뒤 이전 lease로 integrate --task → stale-lease.
test('integrate --task with stale lease after revoke returns stale-lease', () => {
  const blueprint = '.bouncer/context/epics/087-lease-integrate/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-integrate-stale-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'stale-integrate',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));

  const late = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', leaseId: 'lease-a', generation: 1,
  });
  assert.strictEqual(late.reason, 'stale-lease');
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const after = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');
  assert.strictEqual(after.status, 'pending');
  assert.strictEqual(after.lease.status, 'revoked');
});

// RD-002: 손상 lease 원장은 bootstrap도 lease-invalid로 거절한다.
test('bootstrap refuses a ledger with malformed lease', () => {
  const blueprint = '.bouncer/context/epics/088-lease-bootstrap/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-bootstrap-invalid-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.leaseSeq = 1;
  ledger.tasks[0].lease = { id: 'bad', generation: 0, seq: 1, status: 'active' };
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const again = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.reason, 'lease-invalid');
});

test('verification integrate releases the ledger lock while runVerification runs', () => {
  const blueprint = '.bouncer/context/epics/083-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-verify-lock-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const lockFile = `${ledgerFile}.lock`;
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });

  let sawLockDuringVerify = true;
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: () => {
        sawLockDuringVerify = fs.existsSync(lockFile);
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'ev-1' };
      },
    },
  });
  assert.strictEqual(passed.ok, true, JSON.stringify(passed));
  assert.strictEqual(sawLockDuringVerify, false);
});

test('verification integrate retries after stale-ledger-checkpoint without consuming repairWaves', () => {
  const blueprint = '.bouncer/context/epics/084-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-verify-retry-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });

  let calls = 0;
  const stale = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: () => {
        calls += 1;
        // 검증 중 원장을 바꿔 두 번째 잠금의 checkpoint가 어긋나게 한다.
        const live = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
        live.decisions = [...(live.decisions || []), { kind: 'noise', task: '002' }];
        fs.writeFileSync(ledgerFile, `${JSON.stringify(live, null, 2)}\n`);
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'ev-stale' };
      },
    },
  });
  assert.strictEqual(stale.reason, 'stale-ledger-checkpoint');
  assert.strictEqual(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks[1].status, 'verifying');
  assert.strictEqual((JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).repairWaves || []).length, 0);

  const again = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: () => {
        calls += 1;
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'ev-ok' };
      },
    },
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.strictEqual(again.task.status, 'integrated');
  assert.strictEqual((JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).repairWaves || []).length, 0);
  assert.ok(calls >= 2);
});

test('overlapping fenced coordinate calls refuse with ledger-locked', () => {
  const blueprint = '.bouncer/context/epics/085-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-locked-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const lockFile = `${ledgerFile}.lock`;
  const before = fs.readFileSync(ledgerFile);
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 1, token: 'held', at: Date.now() }));
  const blocked = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(blocked.reason, 'ledger-locked');
  assert.deepStrictEqual(fs.readFileSync(ledgerFile), before);
});

/**
 * 두 recorded commit task가 있는 wave fixture. 각 worker에 서로 다른 파일을 커밋하고
 * terminal 증적을 남긴다. fan-in 후보·검증 주입 테스트의 공통 바탕이다.
 */
function twoRecordedWave(prefix, blueprint) {
  const repo = uncommittedPlanRepo(prefix, blueprint, []);
  for (const id of ['001', '002']) writeBundle(repo, blueprint, id, SCAFFOLD);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const workers = Object.fromEntries(prepared.tasks
    .filter((entry) => entry.workerPath)
    .map((entry) => [entry.id, entry.workerPath]));
  const shas = {};
  for (const id of ['001', '002']) {
    const worker = workers[id];
    fs.mkdirSync(path.join(worker, 'src'), { recursive: true });
    fs.writeFileSync(path.join(worker, `src/task-${id}.js`), `changed by ${id}\n`);
    execFileSync('git', ['add', `src/task-${id}.js`], { cwd: worker });
    execFileSync('git', [
      '-c', 'user.name=test', '-c', 'user.email=test@example.com',
      'commit', '-m', `feat: ${id}`,
    ], { cwd: worker });
    shas[id] = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
    writeBundle(worker, blueprint, id, { ...TERMINAL, commitSha: shas[id].slice(0, 8) });
    acceptDispatchReport(repo, blueprint, worker, id);
    const recorded = coordinate({
      command: 'record', repoRoot: repo, blueprint, cwd: worker, task: id,
    });
    assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
  }
  const { faninPath } = __coordinatorPathsFor({ repoRoot: repo, blueprint });
  return {
    repo,
    blueprint,
    workers,
    shas,
    integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
    faninPath,
    head: () => execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: boot.integrationPath, encoding: 'utf8',
    }).trim(),
    ledger: () => JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8')),
    ledgerTasks: () => JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8')).tasks,
  };
}

const passVerify = () => ({
  ok: true, command: 'npm test', exitCode: 0, evidenceId: 'a'.repeat(64),
});

test('wave integrate fails verification without advancing canonical HEAD or task status', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/001-wave';
  const drive = twoRecordedWave('bouncer-fanin-verify-fail-', blueprint);
  const baseHead = drive.head();
  const failed = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      runVerification: () => ({ ok: false, command: 'npm test', exitCode: 1, evidenceId: 'b'.repeat(64) }),
    },
  });
  assert.strictEqual(failed.reason, 'wave-verification-failed');
  assert.strictEqual(drive.head(), baseHead);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['recorded', 'recorded']);
  assert.strictEqual(drive.ledger().fanin, null);
  assert.strictEqual(fs.existsSync(drive.faninPath), false);
});

test('wave integrate conflict revokes only the conflicting task and keeps canonical HEAD', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/002-conflict';
  const drive = twoRecordedWave('bouncer-fanin-conflict-', blueprint);
  const baseHead = drive.head();
  let picks = 0;
  const conflicted = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      execFileSync: (file, args, options) => {
        if (args[0] === 'cherry-pick' && args[1] !== '--abort') {
          picks += 1;
          if (picks === 2) {
            // RD-001: CONFLICT 표식이 있어야 fanin-conflict+revoke다.
            const err = new Error('CONFLICT (content): Merge conflict in shared.txt');
            err.stderr = 'CONFLICT (content): Merge conflict in shared.txt\n';
            err.status = 1;
            throw err;
          }
        }
        return execFileSync(file, args, options);
      },
      runVerification: passVerify,
    },
  });
  assert.strictEqual(conflicted.reason, 'fanin-conflict');
  assert.strictEqual(drive.head(), baseHead);
  assert.strictEqual(fs.existsSync(drive.faninPath), false);
  const tasks = drive.ledgerTasks();
  assert.strictEqual(tasks.find((t) => t.id === '002').status, 'pending');
  assert.strictEqual(tasks.find((t) => t.id === '001').status, 'recorded');
});

test('resume after verified fanin finishes without cherry-pick', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/003-resume';
  const drive = twoRecordedWave('bouncer-fanin-resume-', blueprint);
  const first = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  const candidateHead = first.integrationHead;
  const baseHead = first.checkpoint && drive.ledger().base
    ? execFileSync('git', ['rev-parse', `${candidateHead}^`], {
      cwd: drive.integrationPath, encoding: 'utf8',
    }).trim()
    : null;
  // 복구 fixture: HEAD는 이미 candidate, 원장만 verified+recorded로 되감는다.
  // (ff는 끝났지만 둘째 원장 쓰기 전에 중단된 상태)
  void baseHead;
  const ledger = drive.ledger();
  const preFanin = execFileSync('git', ['merge-base', candidateHead, `${candidateHead}~2`], {
    cwd: drive.integrationPath, encoding: 'utf8',
  }).trim();
  for (const task of ledger.tasks) {
    if (task.id === '001' || task.id === '002') task.status = 'recorded';
  }
  ledger.integrationHead = preFanin;
  ledger.fanin = {
    base_head: preFanin,
    candidate_head: candidateHead,
    tasks: ['001', '002'],
    status: 'verified',
  };
  // 결정 로그의 성공 fanin을 제거해 재실행 decision만 남긴다.
  ledger.decisions = (ledger.decisions || []).filter((d) => d.kind !== 'fanin');
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  let cherryPickCalls = 0;
  const resumed = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      execFileSync: (file, args, options) => {
        if (args[0] === 'cherry-pick') cherryPickCalls += 1;
        return execFileSync(file, args, options);
      },
      runVerification: passVerify,
    },
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  assert.strictEqual(cherryPickCalls, 0);
  assert.strictEqual(drive.ledger().integrationHead, candidateHead);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['integrated', 'integrated']);
  assert.strictEqual(drive.ledger().fanin, null);
});


test('legacy recorded task without lease integrates in a wave', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/004-legacy';
  const drive = twoRecordedWave('bouncer-fanin-legacy-', blueprint);
  const ledger = drive.ledger();
  for (const task of ledger.tasks) {
    delete task.lease;
  }
  delete ledger.leaseSeq;
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const result = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.integrated, ['001', '002']);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['integrated', 'integrated']);
});

test('integrate --task with stale generation returns stale-lease and keeps HEAD', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/005-stale-lease';
  const drive = twoRecordedWave('bouncer-fanin-stale-lease-', blueprint);
  const baseHead = drive.head();
  const lease = drive.ledgerTasks().find((t) => t.id === '001').lease;
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    task: '001', leaseId: lease.id, generation: lease.generation + 1,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(rejected.reason, 'stale-lease');
  assert.strictEqual(drive.head(), baseHead);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['recorded', 'recorded']);
});

test('CAS mismatch during fan-in returns stale-integration-head and clears fanin', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/006-cas';
  const drive = twoRecordedWave('bouncer-fanin-cas-', blueprint);
  const baseHead = drive.head();
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      runVerification: () => {
        // 검증 구간(잠금 밖)에서 integration HEAD를 옮겨 CAS를 깨뜨린다.
        fs.writeFileSync(path.join(drive.integrationPath, 'CAS.md'), 'moved\n');
        execFileSync('git', ['add', 'CAS.md'], { cwd: drive.integrationPath });
        execFileSync('git', [
          '-c', 'user.name=test', '-c', 'user.email=test@example.com',
          'commit', '-m', 'cas move',
        ], { cwd: drive.integrationPath });
        return passVerify();
      },
    },
  });
  assert.strictEqual(rejected.reason, 'stale-integration-head');
  assert.strictEqual(drive.ledger().fanin, null);
  assert.notStrictEqual(drive.head(), baseHead);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['recorded', 'recorded']);
});

test('stale ledger checkpoint during verify leaves fanin building and retry integrates', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/007-checkpoint';
  const drive = twoRecordedWave('bouncer-fanin-checkpoint-', blueprint);
  const stale = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      runVerification: () => {
        const ledger = drive.ledger();
        ledger.revision = 'mutated-during-verify';
        fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
        return passVerify();
      },
    },
  });
  assert.strictEqual(stale.reason, 'stale-ledger-checkpoint');
  assert.strictEqual(drive.ledger().fanin.status, 'building');
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['recorded', 'recorded']);

  const again = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.deepStrictEqual(again.integrated, ['001', '002']);
});

test('fanin whose HEAD matches neither base nor candidate returns stale-integration-head', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/008-orphan';
  const drive = twoRecordedWave('bouncer-fanin-orphan-', blueprint);
  const ledger = drive.ledger();
  ledger.fanin = {
    base_head: 'a'.repeat(40),
    candidate_head: 'b'.repeat(40),
    tasks: ['001'],
    status: 'building',
  };
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(rejected.reason, 'stale-integration-head');
  assert.strictEqual(drive.ledger().fanin, null);
});

test('integrate with no recorded tasks returns nothing-to-integrate', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/009-empty';
  const repo = uncommittedPlanRepo('bouncer-fanin-empty-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const empty = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(empty.reason, 'nothing-to-integrate');
});

test('ledger with bogus fanin status returns fanin-invalid', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/010-bogus';
  const drive = twoRecordedWave('bouncer-fanin-bogus-', blueprint);
  const ledger = drive.ledger();
  ledger.fanin = {
    base_head: drive.head(),
    candidate_head: null,
    tasks: ['001'],
    status: 'bogus',
  };
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(rejected.reason, 'fanin-invalid');
});

test('wave integrate with lease flags returns lease-flags-require-task', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/011-lease-flags';
  const drive = twoRecordedWave('bouncer-fanin-lease-flags-', blueprint);
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    leaseId: 'lease-x', generation: 1,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(rejected.reason, 'lease-flags-require-task');
});

test('verification integrate passes its own taskId to runVerification', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/012-taskid';
  const repo = uncommittedPlanRepo('bouncer-fanin-taskid-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  let seenTaskId = null;
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: (opts) => {
        seenTaskId = opts.taskId;
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'c'.repeat(64) };
      },
    },
  });
  assert.strictEqual(passed.ok, true, JSON.stringify(passed));
  assert.strictEqual(seenTaskId, '002');
});
