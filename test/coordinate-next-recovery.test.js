'use strict';
// 현재 attempt 보고가 있는데 worker가 HEAD·porcelain을 dispatch 때 그대로 둔 채 commit stamp도 없으면,
// next는 commit을 다시 고르면 안 된다. 변경이 없는 commit은 committed:false로 끝나 stamp를 못 고치고,
// advance는 같은 commit을 max-steps까지 되풀이하기 때문이다. 이 파일은 실제 git worktree와 원장
// 파일로 next 판정을 재현한다. git 호출을 흉내 내지 않으므로 판정 로직 전체가 실제로 돈다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { coordinateNext } = require('../packages/cli/dist/coordinate-next');
const { advance } = require('../packages/cli/dist/coordinate-advance');
const { coordinatorPathsFor } = require('../packages/cli/dist/runtime-state');
const { reportPathFor } = require('../packages/cli/dist/coordinator-worker');
const { coordinate } = require('./helpers/coordinator-fence');

const BLUEPRINT = '.bouncer/context/epics/drive-execution/blueprints/drive-recovery-contracts';
const TASK = '001';
const CLEANUP = [];

// blueprint index는 리뷰 모드여야 root review 분기를 건너뛰고 stamp 판정까지 내려간다.
const INDEX_MD = '---\nbouncer:\n  id: drive-recovery-contracts\n  review_scope: blueprint\n---\n# Index\n';
// tasks.md는 verified, verification.md는 passed라 verify 단계를 통과한 상태다. commit_sha는 비어 있다.
const TASKS_MD = '---\nbouncer:\n  id: TASKS-001\n  status: verified\n  commit_sha: ""\n---\n# Tasks\n';
const VERIFICATION_MD = '---\nbouncer:\n  status: passed\n---\n# Verification\n';
// 원장 dispatch의 task_brief_hash는 이 판정에서 읽히지 않으므로 형식만 맞춘 고정값이다.
const BRIEF_HASH = 'a'.repeat(64);

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// initialWorktreeState와 같은 원문 porcelain이다. trim하면 선행 공백 줄이 달라져 비교가 어긋난다.
function porcelain(cwd) {
  return execFileSync('git', ['status', '--porcelain=v1'], { cwd, encoding: 'utf8' });
}

function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  CLEANUP.push(dir);
  return dir;
}

/**
 * 실제 저장소·integration worktree·worker worktree·원장 파일을 만든다. dispatch 기준(base_head,
 * initial_worktree_state)은 worker가 아무 일도 하기 전 상태로 찍는다.
 *
 * @param {{ blockedSummary?: string }} [options] - 있으면 worker가 outcome blocked로 보고한 상태를 만든다.
 *   summary는 `coordinate report`가 원장 decisions에 남기는 보고 요약과 같은 자리에 들어간다
 * @returns {{ repo: string, integration: string, worker: string, base: string,
 *   initial: string, ledgerFile: string, writeReport: (attempt: number) => string }}
 *   fixture 경로와 기준값. writeReport는 worker 보고 파일을 쓰고 경로를 돌려준다
 */
function createDrive(options = {}) {
  const repo = tempDir('bouncer-next-recovery-');
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  // 원장·보고는 실제 저장소에서도 ignore되는 경로라 dispatch 기준 porcelain에 섞이지 않는다.
  fs.writeFileSync(path.join(repo, '.gitignore'), '.bouncer/runtime/\n.worktrees/\n');
  fs.writeFileSync(path.join(repo, 'README.md'), 'base\n');
  fs.mkdirSync(path.join(repo, BLUEPRINT), { recursive: true });
  fs.writeFileSync(path.join(repo, BLUEPRINT, 'index.md'), INDEX_MD);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'base']);
  const base = git(repo, ['rev-parse', 'HEAD']);

  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint: BLUEPRINT, task: TASK });
  git(repo, ['worktree', 'add', '-q', '-b', 'integration-branch', paths.integrationPath, base]);
  git(repo, ['worktree', 'add', '-q', '-b', 'worker-branch', paths.workerPath, base]);

  // tasks·verification 문서는 plan 단계에서 커밋 없이 놓이므로 untracked로 둔다(실제 drive와 같다).
  const taskDir = path.join(paths.workerPath, BLUEPRINT, 'tasks', TASK);
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(path.join(taskDir, 'tasks.md'), TASKS_MD);
  fs.writeFileSync(path.join(taskDir, 'verification.md'), VERIFICATION_MD);
  const initial = porcelain(paths.workerPath);

  // blocked 보고는 dispatch를 reported로 바꾸고, 요약을 task decisions의 report 항목으로 남긴다.
  // 요약 없이 active로 두면 기존 unchanged·commit 판정 fixture와 그대로 같다.
  const dispatch = {
    attempt: 2,
    status: 'active',
    base_head: base,
    initial_worktree_state: initial,
    task_brief_hash: BRIEF_HASH,
  };
  const task = { id: TASK, status: 'prepared', workerPath: paths.workerPath, dispatch };
  if (options.blockedSummary !== undefined) {
    dispatch.status = 'reported';
    dispatch.outcome = 'blocked';
    task.decisions = [{
      kind: 'report', outcome: 'blocked', summary: options.blockedSummary, attempt: 2,
      task_brief_hash: BRIEF_HASH,
    }];
  }
  // note는 active 원장만 받으므로 fixture도 active다. next는 running과 active를 같게 읽는다.
  const ledger = {
    leaseSeq: 0,
    status: 'active',
    integrationHead: base,
    decisions: [],
    tasks: [task],
  };
  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(paths.ledgerFile, JSON.stringify(ledger, null, 2));

  return {
    repo,
    integration: paths.integrationPath,
    worker: paths.workerPath,
    base,
    initial,
    ledgerFile: paths.ledgerFile,
    writeReport(attempt) {
      const file = reportPathFor(paths.workerPath, TASK, attempt);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `attempt: ${attempt}\n\n## Changed files\n- none\n`);
      return file;
    },
  };
}

function nextFor(drive) {
  return coordinateNext({ repoRoot: drive.repo, blueprint: BLUEPRINT, cwd: drive.integration, task: TASK });
}

test.after(() => {
  for (const dir of CLEANUP) fs.rmSync(dir, { recursive: true, force: true });
});

test('unchanged worker with current report and no stamp → next blocks, advance never runs commit', () => {
  const drive = createDrive();
  const reportFile = drive.writeReport(2);

  const next = nextFor(drive);
  assert.equal(next.ok, true);
  assert.equal(next.action, 'blocked');
  assert.equal(next.reason, 'unchanged-worker-report');
  // 판단 근거로 쓸 보고 경로를 구조 필드로 싣는다. 텍스트 안내만으로는 coordinator가 파일을 특정하기 어렵다.
  assert.equal(next.payload.report_path, reportFile);

  // advance는 blocked를 자동 행동으로 보지 않는다. commit argv를 한 번도 실행하지 않고 그 next를 그대로 넘긴다.
  let runs = 0;
  const result = advance({ repoRoot: drive.repo, blueprint: BLUEPRINT, task: TASK, deps: {
    next: (opts) => coordinateNext({ ...opts, cwd: drive.integration }),
    runArgv: () => {
      runs += 1;
      return { stdout: '{"ok":true,"committed":false,"staged":[]}', status: 0 };
    },
    status: () => ({ ok: true }),
  } });
  assert.equal(result.ok, true);
  assert.equal(result.stop.reason, 'blocked');
  assert.equal(result.stop.next.reason, 'unchanged-worker-report');
  assert.equal(result.stop.next.payload.report_path, reportFile);
  assert.equal(runs, 0);
  assert.deepEqual(result.executed, []);
});

test('current report with an uncommitted in-scope change → next still selects commit', () => {
  // 변경이 생기면 blocked가 풀려 기존 commit 경로로 돌아가야 한다. coordinator가 worker를 고쳐 주면
  // 이 경로가 살아 있어야 재개된다.
  const drive = createDrive();
  drive.writeReport(2);
  fs.appendFileSync(path.join(drive.worker, 'README.md'), 'change\n');

  const next = nextFor(drive);
  assert.equal(next.ok, true);
  assert.equal(next.action, 'commit');
  assert.deepEqual(next.argv, ['bouncer', 'commit', '--blueprint', BLUEPRINT, '--yes']);
});

test('current report with a trailerless worker commit → next keeps the untrailered block', () => {
  // HEAD가 기준에서 움직였으므로 unchanged 판정에 걸리지 않고, 기존 무트레일러 거절이 그대로 남아야 한다.
  const drive = createDrive();
  drive.writeReport(2);
  fs.appendFileSync(path.join(drive.worker, 'README.md'), 'direct\n');
  git(drive.worker, ['-c', 'user.email=w@example.com', '-c', 'user.name=w', 'commit', '-q', '-am', 'direct']);

  const next = nextFor(drive);
  assert.equal(next.ok, true);
  assert.equal(next.action, 'blocked');
  assert.equal(next.reason, 'worker-commit-untrailered');
});

test('report from an earlier attempt with unchanged worker → next dispatches implement, not blocked', () => {
  // 보고의 attempt가 원장 현재 attempt(2)와 다르면 이번 attempt의 보고가 아니다. 새 판정을 타면 안 된다.
  const drive = createDrive();
  drive.writeReport(1);

  const next = nextFor(drive);
  assert.equal(next.ok, true);
  assert.equal(next.action, 'implement');
  assert.equal(next.reason, undefined);
});

// worker가 outcome blocked로 보고한 상태의 next. 요약은 원인 판단 자료이며 명령 권한이 아니다.
// 네 원인(승인·제품 결정, 범위 내 환경 장애, gate 실패·제한, 미분류)을 같은 입력으로 준다.
// CLI는 요약에서 원인을 고르지 않으므로, 어떤 원인이든 자동 행동(argv)을 고르면 안 된다.
test('blocked report → next stops at task-reported-blocked with the report path and the summary as data', () => {
  const summary = 'needs a user decision to pick the auth provider';
  const drive = createDrive({ blockedSummary: summary });
  const reportFile = drive.writeReport(2);

  const next = nextFor(drive);
  assert.equal(next.ok, true);
  assert.equal(next.action, 'blocked');
  assert.equal(next.reason, 'task-reported-blocked');
  // 원인을 분류하기 전에는 revoke·prepare·dispatch 어느 것도 argv로 권하지 않는다.
  assert.equal(next.argv, undefined);
  // coordinator가 판단 자료를 특정할 수 있도록 보고 경로와 요약을 구조 필드로 싣는다.
  assert.equal(next.payload.report_path, reportFile);
  assert.equal(next.payload.report.outcome, 'blocked');
  assert.equal(next.payload.report.summary, summary);
  // 원인·결정·해소 증거·주체를 텍스트로 안내하고, 판단은 coordinate note로 남기게 한다.
  assert.match(next.next, /coordinate note/);
});

const BLOCKED_CLASSES = {
  'approval or product decision needed': 'needs a product decision to choose the auth provider',
  'in-scope environment failure': 'the dependency install failed in the worker environment',
  'gate failure or limit reached': 'the verify gate failed twice on the same assertion',
  'unclassified input': 'something unexpected happened without evidence',
};
for (const [cls, summary] of Object.entries(BLOCKED_CLASSES)) {
  test(`blocked report classed as ${cls} → next selects no action and keeps the summary as data`, () => {
    const drive = createDrive({ blockedSummary: summary });
    drive.writeReport(2);

    const next = nextFor(drive);
    assert.equal(next.ok, true);
    assert.equal(next.action, 'blocked');
    assert.equal(next.argv, undefined);
    assert.equal(next.payload.report.summary, summary);
  });
}

test('blocked report, environment failure noted as resolved → revoke clears the block and the task is pending', () => {
  const drive = createDrive({ blockedSummary: 'dependency install failed' });
  drive.writeReport(2);
  // 해소 증거와 판단을 note로 먼저 남긴 뒤에만 revoke로 배정을 회수한다.
  const noted = coordinate({
    command: 'note', repoRoot: drive.repo, blueprint: BLUEPRINT, cwd: drive.integration, task: TASK,
    text: 'dependency install re-run passed; revoking the blocked dispatch',
  });
  assert.equal(noted.ok, true);
  const revoked = coordinate({
    command: 'revoke', repoRoot: drive.repo, blueprint: BLUEPRINT, cwd: drive.integration, task: TASK,
    reason: 'environment failure resolved',
  });
  assert.equal(revoked.ok, true);

  // 회수된 task는 blocked가 아니라 재준비를 기다리는 pending이다.
  const after = nextFor(drive);
  assert.equal(after.action, 'none');
  assert.equal(after.reason, 'pending');
});

test('revoke refused for an empty reason → ledger bytes and worker worktree stay unchanged and blocked remains', () => {
  const drive = createDrive({ blockedSummary: 'dependency install failed' });
  drive.writeReport(2);
  const ledgerBefore = fs.readFileSync(drive.ledgerFile);
  const worktreeBefore = porcelain(drive.worker);

  const refused = coordinate({
    command: 'revoke', repoRoot: drive.repo, blueprint: BLUEPRINT, cwd: drive.integration, task: TASK,
    reason: '   ',
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'decision-reason-required');
  assert.ok(fs.readFileSync(drive.ledgerFile).equals(ledgerBefore), 'refused revoke must not change the ledger');
  assert.equal(porcelain(drive.worker), worktreeBefore, 'refused revoke must not change the worker worktree');
  // 거절 뒤에도 같은 blocked 판정이 남아야 coordinator가 원인을 다시 분류할 수 있다.
  assert.equal(nextFor(drive).reason, 'task-reported-blocked');
});
