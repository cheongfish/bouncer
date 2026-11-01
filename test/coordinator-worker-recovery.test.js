'use strict';
// worker 토큰 기록의 복구 경계를 실제 원장 파일과 실제 git worktree로 재현한다.
// 두 dispatch 중 하나의 worker-model만 남고 unreported가 한 건 있는 원장에서, 두 번째 tokens는 중복으로
// 거절돼야 하고(보존), 호출 귀속이 모호할 때만 `--tokens ambiguous`로 미귀속 행 집합을 고정해 advance가
// 재개해야 한다. 귀속을 추측하거나 기존 행을 바꾸는 경로는 없어야 한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { coordinate } = require('./helpers/coordinator-fence');
const { advance } = require('../packages/cli/dist/coordinate-advance');
const { coordinatorPathsFor } = require('../packages/cli/dist/runtime-state');
const driveMetrics = require('../packages/cli/dist/drive-metrics');

const BLUEPRINT = '.bouncer/context/epics/drive-execution/blueprints/drive-recovery-contracts';
const TASK = '001';
const ROLE = 'implementer';
const CLEANUP = [];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * 실제 저장소와 integration worktree, 빈 원장을 만든다. 원장은 task 하나를 가진 running 상태다.
 *
 * @returns {{ repo: string, integration: string, ledgerFile: string }} fixture 경로
 */
function createDrive() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-worker-recovery-')));
  CLEANUP.push(repo);
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, '.gitignore'), '.bouncer/runtime/\n.worktrees/\n');
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'base']);
  const base = git(repo, ['rev-parse', 'HEAD']);

  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint: BLUEPRINT, task: TASK });
  git(repo, ['worktree', 'add', '-q', '-b', 'integration-branch', paths.integrationPath, base]);

  const ledger = {
    leaseSeq: 0,
    status: 'running',
    integrationHead: base,
    decisions: [],
    tasks: [{ id: TASK, status: 'prepared' }],
  };
  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(paths.ledgerFile, JSON.stringify(ledger, null, 2));
  return { repo, integration: paths.integrationPath, ledgerFile: paths.ledgerFile };
}

/**
 * 제품 `coordinate`를 integration worktree에서 호출한다. fence(ledgerPath·ledgerHash)는 helper가 현재 원장에서 채운다.
 *
 * @param {{ repo: string, integration: string }} drive - fixture
 * @param {object} args - command와 기록 인자
 * @returns {object} 제품 coordinate 결과
 */
function call(drive, args) {
  return coordinate({ repoRoot: drive.repo, blueprint: BLUEPRINT, cwd: drive.integration, ...args });
}

function recordModel(drive) {
  return call(drive, { command: 'worker-model', role: ROLE, model: 'sonnet', task: TASK });
}

function recordTokens(drive, tokens) {
  return call(drive, { command: 'worker-tokens', role: ROLE, tokens, task: TASK });
}

function ledgerBytes(drive) {
  return fs.readFileSync(drive.ledgerFile);
}

function decisionsOf(drive) {
  return JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8')).decisions;
}

// 통계(metrics summary의 worker_tokens)를 제품 summarize로 읽는다. 메트릭 파일은 없어도 되고 원장만 본다.
function workerStats(drive) {
  const summary = driveMetrics.summarize({
    file: path.join(drive.repo, '.bouncer', 'runtime', 'no-metrics.json'),
    blueprint: BLUEPRINT,
    resolveLedger: () => drive.ledgerFile,
  });
  assert.equal(summary.ok, true);
  return summary.worker_tokens;
}

// 토큰 guard 판정을 advance 경로로 본다. 막히면 next를 부르기 전에 거절되고, 통과하면 next의 done으로 끝난다.
function advanceOnce(drive) {
  return advance({ repoRoot: drive.repo, blueprint: BLUEPRINT, task: TASK, deps: {
    next: () => ({ ok: true, action: 'done' }),
    runArgv: () => ({ stdout: '{"ok":true}', status: 0 }),
    status: () => ({ ok: true }),
  } });
}

test.after(() => {
  for (const dir of CLEANUP) fs.rmSync(dir, { recursive: true, force: true });
});

test('model과 unreported가 있는 키에 두 번째 tokens → worker-tokens-duplicate로 거절하고 원장 bytes를 보존한다', () => {
  const drive = createDrive();
  assert.equal(recordModel(drive).ok, true);
  assert.equal(recordTokens(drive, 'unreported').ok, true);
  const before = ledgerBytes(drive);

  const second = recordTokens(drive, '1200');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'worker-tokens-duplicate');
  assert.ok(ledgerBytes(drive).equals(before), 'rejected tokens must leave the ledger bytes unchanged');
});

test('두 번째 호출의 model을 먼저 기록한 뒤 tokens → 새 행만 덧붙고 앞선 행은 그대로 남는다', () => {
  const drive = createDrive();
  assert.equal(recordModel(drive).ok, true);
  assert.equal(recordTokens(drive, 'unreported').ok, true);
  const prior = decisionsOf(drive);

  assert.equal(recordModel(drive).ok, true);
  const tokens = recordTokens(drive, '1200');
  assert.equal(tokens.ok, true);

  const after = decisionsOf(drive);
  assert.equal(after.length, prior.length + 2);
  assert.deepEqual(after.slice(0, prior.length), prior);
  assert.deepEqual(after[prior.length + 1], { kind: 'worker-tokens', role: ROLE, tokens: 1200, task: TASK });
});

test('모호한 model 두 건과 unreported 한 건 → advance가 막힌 뒤 ambiguous 기록으로 기존 행을 보존하고 재개한다', () => {
  const drive = createDrive();
  assert.equal(recordModel(drive).ok, true);
  assert.equal(recordModel(drive).ok, true);
  assert.equal(recordTokens(drive, 'unreported').ok, true);
  const prior = decisionsOf(drive);

  // 두 model 중 하나만 토큰이 채워져 있어 guard가 막아야 한다. 이 상태가 재개 대상이다.
  const blocked = advanceOnce(drive);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'worker-tokens-missing');

  const marked = recordTokens(drive, 'ambiguous');
  assert.equal(marked.ok, true);
  assert.equal(marked.decision.kind, 'worker-tokens-ambiguous');
  assert.equal(marked.decision.tokens, undefined, 'an ambiguous marker never carries a numeric token value');
  assert.equal(marked.decision.unreported, undefined, 'an ambiguous marker never counts as unreported');
  // coordinator 알림: 반환 행이 기록 당시 두 경계(model 2, tokens 1)를 담고 원장에 그대로 남아야 한다.
  assert.deepEqual(marked.decision, {
    kind: 'worker-tokens-ambiguous', role: ROLE, task: TASK, model_rows: 2, token_rows: 1,
  });

  const after = decisionsOf(drive);
  assert.equal(after.length, prior.length + 1);
  assert.deepEqual(after.slice(0, prior.length), prior);
  assert.deepEqual(after[after.length - 1], marked.decision);

  // 표시는 기존 행을 바꾸지 않으므로 통계는 여전히 미측정이다. 두 호출이 모두 누락으로 남아야 한다.
  const stats = workerStats(drive);
  assert.equal(stats.by_role.implementer.missing, 2);
  assert.equal(stats.missing, 2);

  const resumed = advanceOnce(drive);
  assert.equal(resumed.ok, true);
});

test('ambiguous 뒤 같은 키에 model만 새로 추가 → advance가 다시 worker-tokens-missing으로 막는다', () => {
  const drive = createDrive();
  recordModel(drive);
  recordModel(drive);
  recordTokens(drive, 'unreported');
  assert.equal(recordTokens(drive, 'ambiguous').ok, true);
  assert.equal(advanceOnce(drive).ok, true);

  // 예외는 기록 당시 행에만 붙는다. 새 model은 예외 집합 밖이라 토큰이 없으면 여전히 미충족이다.
  assert.equal(recordModel(drive).ok, true);
  const blocked = advanceOnce(drive);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'worker-tokens-missing');
  assert.deepEqual(blocked.pending, [{ task: TASK, role: ROLE, perspective: null }]);
});

test('ambiguous 뒤 새 model과 새 tokens가 모두 채워짐 → advance가 다시 통과한다', () => {
  const drive = createDrive();
  recordModel(drive);
  recordModel(drive);
  recordTokens(drive, 'unreported');
  assert.equal(recordTokens(drive, 'ambiguous').ok, true);

  assert.equal(recordModel(drive).ok, true);
  assert.equal(recordTokens(drive, '900').ok, true);
  assert.equal(advanceOnce(drive).ok, true);
});

test('ambiguous 뒤 늦게 온 tokens는 표시된 호출에 붙어 이후 추가된 미기록 model을 통과시키지 않는다 → advance가 worker-tokens-missing으로 막는다', () => {
  const drive = createDrive();
  recordModel(drive);
  recordModel(drive);
  assert.equal(recordTokens(drive, 'ambiguous').ok, true);

  // 표시 시점에 토큰 행이 없어 두 model이 모두 예외 집합이다. 뒤에 온 tokens는 그중 이미 떠난 호출의 늦은 값이다.
  assert.equal(recordTokens(drive, '900').ok, true);
  // 새 model은 표시 뒤에 생긴 호출이라 예외 밖이다. 토큰 없이 추가됐으니 앞선 tokens가 대신 채우면 안 된다.
  assert.equal(recordModel(drive).ok, true);

  const blocked = advanceOnce(drive);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'worker-tokens-missing');
  assert.deepEqual(blocked.pending, [{ task: TASK, role: ROLE, perspective: null }]);
});

test('같은 당시 집합에 ambiguous를 두 번 기록 → worker-tokens-ambiguous-duplicate로 거절하고 원장 bytes를 보존한다', () => {
  const drive = createDrive();
  recordModel(drive);
  recordModel(drive);
  recordTokens(drive, 'unreported');
  assert.equal(recordTokens(drive, 'ambiguous').ok, true);
  const before = ledgerBytes(drive);

  const again = recordTokens(drive, 'ambiguous');
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'worker-tokens-ambiguous-duplicate');
  assert.ok(ledgerBytes(drive).equals(before), 'a duplicate ambiguous marker must leave the ledger bytes unchanged');
});

test('기록이 없는 키에 ambiguous → worker-tokens-ambiguous-target-missing으로 거절하고 원장 bytes를 보존한다', () => {
  const drive = createDrive();
  recordModel(drive);
  const before = ledgerBytes(drive);

  // 같은 task라도 role이 다르면 다른 키다. 이 키에는 기록이 없으므로 표시할 미귀속 행도 없다.
  const missing = call(drive, { command: 'worker-tokens', role: 'reviewer', tokens: 'ambiguous', task: TASK,
    perspective: 'security' });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'worker-tokens-ambiguous-target-missing');
  assert.ok(ledgerBytes(drive).equals(before), 'a rejected ambiguous marker must leave the ledger bytes unchanged');
});

test('ambiguous와 --replace를 함께 주면 → worker-tokens-ambiguous-replace로 거절하고 원장 bytes를 보존한다', () => {
  const drive = createDrive();
  recordModel(drive);
  recordModel(drive);
  recordTokens(drive, 'unreported');
  const before = ledgerBytes(drive);

  // 교체 대상이 되는 기존 값이 아니라서 교체와 표시를 섞으면 어떤 행이 바뀌었는지 알 수 없다.
  const mixed = call(drive, { command: 'worker-tokens', role: ROLE, tokens: 'ambiguous', task: TASK, replace: true });
  assert.equal(mixed.ok, false);
  assert.equal(mixed.reason, 'worker-tokens-ambiguous-replace');
  assert.ok(ledgerBytes(drive).equals(before), 'a rejected ambiguous marker must leave the ledger bytes unchanged');
});
