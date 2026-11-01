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
const { ensureEpicIndexEntry } = require('../packages/cli/dist/epic-index');
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

// --- lease salvage ----------------------------------------------------------
// revoke 뒤 prepare가 옛 worker의 변경·커밋·보고를 보존하고 새 generation lease를 주는지, 그리고 옛 lease의 보고가
// 거절되는지를 실제 prepare·dispatch·report 명령으로 확인한다. 이 경로는 coordinator가 지원하는 재배정이다.
const SALVAGE_BP = '.bouncer/context/epics/001-auth/blueprints/001-login';
const SALVAGE_EPIC = '.bouncer/context/epics/001-auth';
const DOC_STAMP = "timestamp: '2026-07-01T00:00:00+09:00'";

function writeText(repo, rel, text) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

/**
 * 실제 저장소에 승인된 epic·blueprint·task 문서를 놓고 bootstrap·prepare로 task 001 worker를 배정한다.
 * worker에는 기준 커밋 이후 아무 변경도 없다. 원장과 worktree는 실제 파일이다.
 *
 * @returns {{ repo: string, integration: string, worker: string, lease: { id: string, generation: number } }}
 *   fixture 경로와 첫 배정의 lease
 */
function createPreparedDrive() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-salvage-')));
  CLEANUP.push(repo);
  git(repo, ['init', '-q', '-b', 'work']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, '.gitignore'), '.bouncer/runtime/\n.worktrees/\n');
  writeText(repo, 'src/auth/login.ts', 'export {}\n');
  writeText(repo, `${SALVAGE_EPIC}/index.md`, [
    '---', 'type: bouncer.epic', 'title: Auth', 'description: d', `resource: ${SALVAGE_EPIC}/index.md`,
    'tags:', '  - bouncer', DOC_STAMP, 'bouncer:', "  id: '001'", "  epic_id: '001'", '  status: approved',
    '---', '# Auth', '',
  ].join('\n'));
  writeText(repo, `${SALVAGE_BP}/index.md`, [
    '---', 'type: bouncer.blueprint', 'title: Login', 'description: d', `resource: ${SALVAGE_BP}/index.md`,
    'tags:', '  - bouncer', DOC_STAMP, 'bouncer:', "  id: '001'", "  epic_id: '001'", "  blueprint_id: '001'",
    '  status: approved', '---', '# Login', '',
  ].join('\n'));
  writeText(repo, `${SALVAGE_BP}/tasks/001/tasks.md`, [
    '---', 'type: bouncer.tasks', 'title: Impl login', 'description: d', `resource: ${SALVAGE_BP}/tasks/001/tasks.md`,
    'tags:', '  - bouncer', DOC_STAMP, 'bouncer:', '  id: TASKS-001', "  epic_id: '001'", "  blueprint_id: '001'",
    '  status: ready', '  affected_paths:', '    - src/auth/', '---', '# Impl login', '',
  ].join('\n'));
  ensureEpicIndexEntry({ repoRoot: repo, epicId: '001', name: 'auth', description: 'd' });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'base']);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: SALVAGE_BP });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint: SALVAGE_BP, cwd: boot.integrationPath });
  assert.equal(prepared.ok, true, 'fixture prepare must succeed');
  const entry = prepared.tasks[0];
  return {
    repo,
    integration: boot.integrationPath,
    worker: entry.workerPath,
    lease: { id: entry.lease.id, generation: entry.lease.generation },
  };
}

/**
 * 첫 배정 lease로 dispatch하고, worker에 커밋 하나와 커밋되지 않은 변경 하나, 보고 파일 하나를 남긴 뒤
 * revoke하고 prepare로 다시 배정한다.
 *
 * @param {ReturnType<typeof createPreparedDrive>} drive - 첫 배정이 끝난 fixture
 * @returns {{ prep: object, lease: { id: string, generation: number }, reportText: string, committedHead: string }}
 *   재배정 결과, 옛 lease, 보고 원문, 옛 worker가 커밋한 HEAD. 원문은 revoke 전에 읽어 둔 값이다
 *   (prepare가 옛 worker worktree를 지우므로 경로로 다시 읽을 수 없다)
 */
function revokeAndReprepare(drive) {
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint: SALVAGE_BP, cwd: drive.worker,
    task: TASK, leaseId: drive.lease.id, generation: drive.lease.generation,
  });
  assert.equal(dispatched.ok, true, 'fixture dispatch must succeed');

  // 커밋은 보존 ref로, 커밋 뒤 변경은 patch로 남아야 한다. 보고 파일은 원문 그대로 복사돼야 한다.
  fs.appendFileSync(path.join(drive.worker, 'src/auth/login.ts'), 'export const committed = 1;\n');
  git(drive.worker, ['-c', 'user.email=w@example.com', '-c', 'user.name=w', 'commit', '-q', '-am', 'worker']);
  const committedHead = git(drive.worker, ['rev-parse', 'HEAD']);
  fs.appendFileSync(path.join(drive.worker, 'src/auth/login.ts'), 'export const uncommitted = 2;\n');
  const reportText = '## Changed files\n- src/auth/login.ts\n';
  writeText(drive.worker, `.bouncer/runtime/reports/${TASK}-1.md`, reportText);

  const revoked = coordinate({
    command: 'revoke', repoRoot: drive.repo, blueprint: SALVAGE_BP, cwd: drive.integration, task: TASK,
    reason: 'environment failure resolved',
  });
  assert.equal(revoked.ok, true, 'fixture revoke must succeed');
  const prep = coordinate({ command: 'prepare', repoRoot: drive.repo, blueprint: SALVAGE_BP, cwd: drive.integration });
  return { prep, lease: drive.lease, reportText, committedHead };
}

test('revoked worker with commit, dirty change and report → prepare keeps all three and issues a new lease', () => {
  const drive = createPreparedDrive();
  const { prep, committedHead, reportText } = revokeAndReprepare(drive);
  assert.equal(prep.ok, true);

  // 보존 항목은 salvage 목록에 task별로 한 번 실린다. 커밋 ref와 patch·보고 경로가 모두 있어야 한다.
  const salvage = prep.salvage.find((entry) => entry.task === TASK);
  assert.ok(salvage, 'salvage must list the revoked task');
  const patchText = fs.readFileSync(salvage.patch, 'utf8');
  assert.match(patchText, /\+export const uncommitted = 2;/, 'the uncommitted change must survive as a patch');
  assert.doesNotMatch(patchText, /\+export const committed = 1;/,
    'a committed change must not be duplicated in the patch');
  assert.equal(git(drive.repo, ['rev-parse', salvage.ref]), committedHead,
    'the salvage ref must keep the worker commit');
  assert.equal(fs.readFileSync(salvage.report, 'utf8'), reportText, 'the report must be kept verbatim');

  // 재배정은 새 generation의 새 lease다. 옛 lease와 id·generation이 모두 달라야 한다.
  const next = prep.tasks.find((entry) => entry.id === TASK).lease;
  assert.equal(next.generation, drive.lease.generation + 1);
  assert.notEqual(next.id, drive.lease.id);
});

test('report under the revoked lease after re-prepare → refused as stale-lease and the new lease is named', () => {
  const drive = createPreparedDrive();
  const { prep, lease } = revokeAndReprepare(drive);
  assert.equal(prep.ok, true);
  const current = prep.tasks.find((entry) => entry.id === TASK).lease;

  const stale = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint: SALVAGE_BP, cwd: drive.worker, task: TASK,
    attempt: 1, taskBriefHash: 'a'.repeat(64), outcome: 'accepted', summary: 'late report from the old lease',
    leaseId: lease.id, generation: lease.generation,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'stale-lease');
  // 거절 응답이 현재 lease를 가리켜야 coordinator가 옛 보고를 새 배정으로 착각하지 않는다.
  assert.equal(stale.expected.lease_id, current.id);
  assert.equal(stale.expected.generation, current.generation);
});
