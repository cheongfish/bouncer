// test/commit-task.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { commitTask } = require('../scripts/lib/commit');
const { checkCommitSafety } = require('../scripts/lib/commit-guard');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');
const { readCurrent, writeCurrent } = require('../scripts/lib/current');
const { recordVerificationResult } = require('../scripts/lib/verification');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

const EXPLAIN_BODY = `# Explain

## Background
Auth validation moved to the edge.

## Intuition
Reject bad input early.

## Code
src/auth/login.ts

## Quiz
Where does validation live?

## 이해 상태
Recorded after review.
`;

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function initGitWithChange(repo) {
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['init', '-b', 'work']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  run(['add', 'README']);
  run(['commit', '-m', 'base']);
  run(['branch', 'develop']);
  fs.mkdirSync(path.join(repo, 'src/auth'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export {}\n');
  run(['add', 'src/auth/login.ts']);
  run(['commit', '-m', 'change']);
}

function writeTaskUnit(repo, blueprintDir, number, {
  tasksStatus = 'verified',
  affectedPaths = ['src/auth/'],
  title = `Impl ${number}`,
} = {}) {
  const dir = `${blueprintDir}/tasks/${number}`;
  writeDoc(repo, `${dir}/tasks.md`, {
    type: 'bouncer.tasks',
    title,
    description: 'd',
    resource: `${dir}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${number}`,
      epic_id: '001',
      blueprint_id: '001',
      status: tasksStatus,
      affected_paths: affectedPaths,
    },
  });
  writeDoc(repo, `${dir}/verification.md`, {
    type: 'bouncer.verification',
    title: 'Verified',
    description: 'd',
    resource: `${dir}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `VERIFY-${number}`, epic_id: '001', blueprint_id: '001', status: 'passed',
    },
  });
  // 포인터 묶음의 G13은 status: passed만으로는 통과하지 않는다. writeTaskUnit이
  // extraOpenTask에도 쓰이므로, Git이 있는 픽스처에서만 하네스 원장을 남긴다.
  recordVerificationResult({
    repoRoot: repo,
    verificationRel: `${dir}/verification.md`,
    command: 'npm test',
    ranAt: '2026-07-27T00:00:00.000Z',
    exitCode: 0,
    output: 'ok',
  });
  writeDoc(repo, `${dir}/review.md`, {
    type: 'bouncer.review',
    title: 'Review',
    description: 'd',
    resource: `${dir}/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `REVIEW-${number}`,
      epic_id: '001',
      blueprint_id: '001',
      status: 'accepted',
      review: { required: false, reason: 'fixture' },
    },
  });
}

function fullBlueprint(repo, {
  tasksStatus = 'verified',
  blueprintDir = BP_REL,
  withGit = true,
  extraOpenTask = false,
} = {}) {
  if (withGit) initGitWithChange(repo);
  const epicDir = blueprintDir.split('/blueprints/')[0];
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  const epicLeaf = epicDir.split('/').pop();
  const epicIdMatch = /^(\d{3})-/.exec(epicLeaf);
  const epicId = epicIdMatch ? epicIdMatch[1] : '001';
  const epicSlug = epicLeaf.slice(epicId.length + 1) || 'auth';
  ensureEpicIndexEntry({
    repoRoot: repo, epicId, name: epicSlug, description: 'd',
  });
  writeDoc(repo, `${blueprintDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${blueprintDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  writeTaskUnit(repo, blueprintDir, '001', {
    tasksStatus,
    title: 'Impl login',
  });
  if (extraOpenTask) {
    writeTaskUnit(repo, blueprintDir, '002', {
      tasksStatus: 'ready',
      title: 'Impl logout',
      affectedPaths: ['src/auth/'],
    });
  }

  // commit 게이트는 explain을 보지 않는다. finalize G16용 문서만 최소로 둔다.
  writeDoc(repo, `${blueprintDir}/explain.md`, {
    type: 'bouncer.explain', title: 'Explain', description: 'd', resource: `${blueprintDir}/explain.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'draft',
      comprehension: [],
    },
  }, EXPLAIN_BODY);
}

function trackingGit(changed, untracked, {
  headSha = 'abcdef0123456789abcdef0123456789abcdef01',
} = {}) {
  const calls = [];
  return {
    api: {
      changedFiles: () => changed,
      untrackedFiles: () => untracked,
      stage: (files) => { calls.push('stage'); calls._staged = files; },
      commit: (msg) => { calls.push('commit'); calls._msg = msg; },
      headSha: () => headSha,
    },
    calls,
  };
}

test('dry-run returns commitMessage without staging', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = trackingGit(['src/auth/login.ts'], []);
  const res = commitTask({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dryRun, true);
  assert.ok(typeof res.commitMessage === 'string' && res.commitMessage.length > 0);
  assert.deepStrictEqual(g.calls, []);
  assert.deepStrictEqual(res.staged, ['src/auth/login.ts']);
});

test('task dry-run builds authored intent and summary in order', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const taskRel = `${BP_REL}/tasks/001/tasks.md`;
  const task = yaml.load(fs.readFileSync(path.join(repo, taskRel), 'utf8').replace(/^---\n|\n---\n[\s\S]*$/g, ''));
  task.bouncer.commit_intent = ['재시도가 서버에 부담을 줌', '안정적인 정책이 필요함'];
  task.bouncer.commit_summary = ['간격을 지수적으로 늘림'];
  writeDoc(repo, taskRel, task, '# Tasks\n');
  const res = commitTask({
    repoRoot: repo,
    blueprintDir: BP_REL,
    git: trackingGit(['src/auth/login.ts'], []).api,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.commitMessage, [
    'feat: Impl login',
    '',
    '- 재시도가 서버에 부담을 줌',
    '- 안정적인 정책이 필요함',
    '- 간격을 지수적으로 늘림',
  ].join('\n'));
});

test('malformed authored task field aborts message generation', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const taskRel = `${BP_REL}/tasks/001/tasks.md`;
  const task = yaml.load(fs.readFileSync(path.join(repo, taskRel), 'utf8').replace(/^---\n|\n---\n[\s\S]*$/g, ''));
  task.bouncer.commit_summary = ['첫 줄임', '둘째 줄임', '셋째 줄임'];
  writeDoc(repo, taskRel, task, '# Tasks\n');
  assert.throws(() => commitTask({
    repoRoot: repo,
    blueprintDir: BP_REL,
    git: trackingGit(['src/auth/login.ts'], []).api,
  }), /commit_summary.*1-2/);
});

test('task commit filters allowed workflow documents but keeps task outputs', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const workflowDocs = [
    `${BP_REL}/tasks/001/tasks.md`,
    `${BP_REL}/tasks/001/verification.md`,
    `${BP_REL}/tasks/001/review.md`,
    `${BP_REL}/index.md`,
    '.bouncer/context/index.md',
  ];
  const g = trackingGit(['src/auth/login.ts', ...workflowDocs], []);
  const res = commitTask({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.staged, ['src/auth/login.ts']);
});

test('task commit does not stage an absent untracked path', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = trackingGit(['src/auth/login.ts'], ['src/auth/never-created.ts']);
  const res = commitTask({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.staged, ['src/auth/login.ts']);
});

test('--yes stages then commits in that order', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = trackingGit(['src/auth/login.ts'], []);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.committed, true);
  assert.deepStrictEqual(g.calls.filter((c) => typeof c === 'string'), ['stage', 'commit']);
  assert.strictEqual(res.commitSha, 'abcdef01');
  const tasksRaw = fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/tasks.md`), 'utf8');
  assert.match(tasksRaw, /commit_sha: abcdef01/);
});

test('out-of-scope file hard-aborts without staging', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = trackingGit(['src/auth/login.ts', 'src/payments/charge.ts'], []);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/payments/charge.ts']);
  assert.deepStrictEqual(g.calls.filter((c) => typeof c === 'string'), []);
});

test('untracked out-of-scope hard-aborts without staging', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  fs.mkdirSync(path.join(repo, 'src/payments'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/payments/charge.ts'), 'export {}\n');
  const g = trackingGit(['src/auth/login.ts'], ['src/payments/charge.ts']);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/payments/charge.ts']);
  assert.deepStrictEqual(g.calls.filter((c) => typeof c === 'string'), []);
});

test('commitTask violations match checkCommitSafety for the same files', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const files = ['src/auth/login.ts', 'src/payments/charge.ts'];
  const guard = checkCommitSafety({
    files,
    affectedPaths: ['src/auth/'],
    blueprintDir: BP_REL,
  });
  assert.strictEqual(guard.allow, false);
  const g = trackingGit(files, []);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, guard.violations);
  assert.deepStrictEqual(g.calls.filter((c) => typeof c === 'string'), []);
});

test('in-scope changed and untracked pass the same guard as checkCommitSafety', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  fs.writeFileSync(path.join(repo, 'src/auth/session.ts'), 'export {}\n');
  const files = ['src/auth/login.ts', 'src/auth/session.ts'];
  const guard = checkCommitSafety({
    files,
    affectedPaths: ['src/auth/'],
    blueprintDir: BP_REL,
  });
  assert.strictEqual(guard.allow, true);
  const g = trackingGit(['src/auth/login.ts'], ['src/auth/session.ts']);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, git: g.api,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dryRun, true);
  assert.deepStrictEqual(res.staged, files);
});

test('no changes with --yes succeeds without calling commit', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = trackingGit([], []);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.committed, false);
  assert.deepStrictEqual(res.staged, []);
  assert.deepStrictEqual(g.calls.filter((c) => typeof c === 'string'), []);
});

test('nextTask is earliest other open task; pointer is untouched', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  // 열린 task가 둘(002 ready, 003 in_progress)일 때 번호가 앞선 002를 고른다.
  fullBlueprint(repo, { extraOpenTask: true });
  writeTaskUnit(repo, BP_REL, '003', {
    tasksStatus: 'in_progress',
    title: 'Impl session',
    affectedPaths: ['src/auth/'],
  });
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  const before = readCurrent({ repoRoot: repo });
  const g = trackingGit(['src/auth/login.ts'], []);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.nextTask, {
    id: 'TASKS-002',
    path: `${BP_REL}/tasks/002/tasks.md`,
    status: 'ready',
  });
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), before);
});

test('nextTask is null when no other open tasks remain', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = trackingGit(['src/auth/login.ts'], []);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, git: g.api,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.nextTask, null);
});

test('gate failure returns validate reason without staging', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  // commit 게이트는 explain이 아니라 포인터 task 상태(G6)를 본다.
  fullBlueprint(repo, { tasksStatus: 'ready' });
  const g = trackingGit(['src/auth/login.ts'], []);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'validate');
  assert.ok(res.failures.some((f) => f.code === 'G6'));
  assert.deepStrictEqual(g.calls.filter((c) => typeof c === 'string'), []);
});

// --- coordinator mode -------------------------------------------------------

const { coordinate } = require('../scripts/lib/coordinator');
const { coordinatorContext, reviseTaskScope, recordActualPaths } = require('../scripts/lib/scope');

/**
 * bootstrap + prepare 로 실제 worktree를 연 뒤, 할당된 worker 안에서 commit
 * 게이트가 열리도록 문서 묶음을 다시 쓴다. seed는 계획 문서만 옮기므로
 * 검증 원장은 worker 경로로 다시 기록한다.
 */
function coordinatorFixture({ blueprint = BP_REL, extraOpenTask = false } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-commit-coord-'));
  fullBlueprint(repo, { blueprintDir: blueprint, extraOpenTask });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  const worker = prepared.tasks[0].workerPath;
  fullBlueprint(worker, { blueprintDir: blueprint, withGit: false, extraOpenTask });
  return { repo, worker, integrationPath: boot.integrationPath, blueprint };
}

test('reviseTaskScope moves ledger and task document to one revision with a recorded reason', () => {
  const { repo, worker, blueprint } = coordinatorFixture();

  const noReason = reviseTaskScope({
    repoRoot: worker, blueprint, task: '001', paths: ['src/auth/', 'src/session/'], reason: '',
  });
  assert.deepStrictEqual(noReason, { ok: false, reason: 'decision-reason-required' });

  const revised = reviseTaskScope({
    repoRoot: worker,
    blueprint,
    task: '001',
    paths: ['src/auth/', 'src/session/'],
    reason: 'session token write discovered while implementing login',
  });
  assert.strictEqual(revised.ok, true);
  assert.strictEqual(revised.revision, 'r1');

  const doc = yaml.load(
    fs.readFileSync(path.join(worker, blueprint, 'tasks/001/tasks.md'), 'utf8')
      .replace(/^---\n|\n---\n[\s\S]*$/g, ''),
  );
  assert.deepStrictEqual(doc.bouncer.affected_paths, ['src/auth/', 'src/session/']);
  assert.strictEqual(doc.bouncer.scope_revision, 'r1');

  const ctx = coordinatorContext({ repoRoot: worker, blueprint, task: '001' });
  assert.strictEqual(ctx.active, true);
  assert.strictEqual(ctx.reason, null);
  assert.strictEqual(ctx.revision, 'r1');
  assert.deepStrictEqual(ctx.scope, ['src/auth/', 'src/session/']);

  const ledgerFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json',
  );
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  const entry = ledger.decisions.find((d) => d.kind === 'scope');
  assert.strictEqual(entry.task, '001');
  assert.strictEqual(entry.revision, 'r1');
  assert.deepStrictEqual(entry.previous, ['src/auth/']);
  assert.deepStrictEqual(entry.next, ['src/auth/', 'src/session/']);
  assert.match(entry.reason, /session token/);

  // append-only: 두 번째 판단이 첫 판단을 덮지 않는다.
  const again = reviseTaskScope({
    repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'session write reverted',
  });
  assert.strictEqual(again.revision, 'r2');
  const after = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.strictEqual(after.decisions.filter((d) => d.kind === 'scope').length, 2);
});

test('reviseTaskScope refuses the main worktree and an unknown task', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  assert.deepStrictEqual(
    reviseTaskScope({ repoRoot: repo, blueprint, task: '001', paths: ['src/'], reason: 'r' }),
    { ok: false, reason: 'main-worktree-source-write' },
  );
  // 009는 이 worker에 할당된 task가 아니다 — 원장을 열기 전에 위치부터 거절한다.
  assert.deepStrictEqual(
    reviseTaskScope({ repoRoot: worker, blueprint, task: '009', paths: ['src/'], reason: 'r' }),
    { ok: false, reason: 'unassigned-worktree' },
  );
  // 권한 없는 호출이 runtime 트리나 잠금 파일을 먼저 만들지 않는다.
  const strayLock = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json.lock',
  );
  assert.strictEqual(fs.existsSync(strayLock), false);
});

test('reviseTaskScope refuses a task the ledger does not carry', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const ledgerFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json',
  );
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks = [];
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger));
  assert.deepStrictEqual(
    reviseTaskScope({ repoRoot: worker, blueprint, task: '001', paths: ['src/'], reason: 'r' }),
    { ok: false, reason: 'task-outside-blueprint' },
  );
});

test('a coordinator commit returns actual paths, provenance SHAs and the next ready wave', () => {
  // 002는 sequential 이라 prepare가 열지 않는다 — 커밋 뒤 ready wave의 다음 항목.
  const { worker, blueprint } = coordinatorFixture({ extraOpenTask: true });
  writeCurrent({
    repoRoot: worker, blueprint, base: 'work', task: `${blueprint}/tasks/001/tasks.md`,
  });
  const g = trackingGit(['src/auth/login.ts'], []);
  const res = commitTask({
    repoRoot: worker, blueprintDir: blueprint, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, true, JSON.stringify(res.failures));
  assert.strictEqual(res.committed, true);
  assert.deepStrictEqual(res.actualPaths, ['src/auth/login.ts']);
  assert.strictEqual(res.taskSha, 'abcdef0123456789abcdef0123456789abcdef01');
  assert.strictEqual(typeof res.integrationHeadBefore, 'string');
  assert.strictEqual(res.ledgerWorkerSha, null);
  assert.deepStrictEqual(res.ledgerRecord, { ok: true });
  assert.deepStrictEqual(res.readyWave, ['002']);
  assert.strictEqual(res.nextTask.id, 'TASKS-002');
  assert.strictEqual(res.scopeRevision, null);
});

test('a coordinator commit refuses a staged path outside the current ledger scope', () => {
  const { worker, blueprint } = coordinatorFixture();
  reviseTaskScope({
    repoRoot: worker, blueprint, task: '001', paths: ['src/session/'], reason: 'scope moved to session',
  });
  const g = trackingGit(['src/auth/login.ts'], []);
  const res = commitTask({
    repoRoot: worker, blueprintDir: blueprint, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/auth/login.ts']);
  assert.deepStrictEqual(g.calls, []);
});

test('a task document out of step with the ledger revision refuses the commit', () => {
  const { worker, blueprint } = coordinatorFixture();
  reviseTaskScope({
    repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'scope confirmed',
  });
  const docAbs = path.join(worker, blueprint, 'tasks/001/tasks.md');
  // worker가 문서만 되돌린 상태 — 어느 쪽이 정본인지 추측하지 않고 막는다.
  fs.writeFileSync(docAbs, fs.readFileSync(docAbs, 'utf8').replace('scope_revision: r1', 'scope_revision: r0'));

  assert.strictEqual(
    coordinatorContext({ repoRoot: worker, blueprint, task: '001' }).reason,
    'stale-revision',
  );
  const res = commitTask({
    repoRoot: worker, blueprintDir: blueprint, yes: true, git: trackingGit(['src/auth/login.ts'], []).api,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'stale-revision');
});

test('a checkout that is neither the integration nor the assigned worktree is unassigned', () => {
  const { repo, blueprint } = coordinatorFixture();
  const stranger = path.join(repo, '.worktrees', '001', '001', 'workers', '002');
  fs.mkdirSync(stranger, { recursive: true });
  const ctx = coordinatorContext({ repoRoot: stranger, blueprint, task: '001' });
  assert.strictEqual(ctx.active, true);
  assert.strictEqual(ctx.reason, 'unassigned-worktree');
});

test('reviseTaskScope refuses a scope outside this repository or over the governance tree', () => {
  const { worker, blueprint } = coordinatorFixture();
  for (const bad of ['/etc', '../elsewhere/src', '.bouncer/context/epics', '.git/hooks', '.']) {
    const res = reviseTaskScope({
      repoRoot: worker, blueprint, task: '001', paths: ['src/auth/', bad], reason: 'widen',
    });
    assert.deepStrictEqual(
      { ok: res.ok, reason: res.reason, paths: res.paths },
      { ok: false, reason: 'scope-path-out-of-bounds', paths: [bad] },
      bad,
    );
  }
  // glob은 리터럴 접두 비교와 맞지 않는다 — 조용히 받아 두고 다음 커밋에서
  // out-of-scope로 되돌아오는 대신, 표기 자체를 이름 붙여 거절한다.
  for (const glob of ['src/**', '*', '**/*.ts']) {
    const res = reviseTaskScope({
      repoRoot: worker, blueprint, task: '001', paths: ['src/auth/', glob], reason: 'widen',
    });
    assert.deepStrictEqual(
      { ok: res.ok, reason: res.reason, paths: res.paths },
      { ok: false, reason: 'scope-path-glob', paths: [glob] },
      glob,
    );
  }
  // 새로 발견한 저장소 안 소스 경로는 그대로 통과한다 — 경계는 확장 능력을 막지 않는다.
  assert.strictEqual(
    reviseTaskScope({
      repoRoot: worker,
      blueprint,
      task: '001',
      paths: ['src/auth/', 'src/session/token.ts'],
      reason: 'session write discovered mid-drive',
    }).ok,
    true,
  );
});

test('an unreadable ledger refuses everywhere, including the main worktree', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const ledgerFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json',
  );
  fs.writeFileSync(ledgerFile, '{ truncated');

  for (const checkout of [repo, worker]) {
    const ctx = coordinatorContext({ repoRoot: checkout, blueprint, task: '001' });
    assert.strictEqual(ctx.active, true, checkout);
    assert.strictEqual(ctx.reason, 'unreadable-ledger', checkout);
  }
  assert.deepStrictEqual(
    reviseTaskScope({ repoRoot: worker, blueprint, task: '001', paths: ['src/'], reason: 'r' }),
    { ok: false, reason: 'unreadable-ledger' },
  );
});

test('a pointer task the ledger does not carry is refused like reviseTaskScope refuses it', () => {
  const { repo, blueprint } = coordinatorFixture();
  const integration = path.join(repo, '.worktrees', '001', '001', 'integration');
  const ctx = coordinatorContext({ repoRoot: integration, blueprint, task: '009' });
  assert.strictEqual(ctx.active, true);
  assert.strictEqual(ctx.reason, 'task-outside-blueprint');
});

test('a live lock is not reclaimed because its file mtime looks old', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const lockFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json.lock',
  );
  // 살아 있는 주인의 잠금. 파일은 생성 뒤 손대지 않으므로 mtime만 보면 늙어 보인다.
  const held = { pid: 424242, token: 'held-token', at: Date.now() };
  fs.writeFileSync(lockFile, JSON.stringify(held));
  const old = new Date(Date.now() - 600000);
  fs.utimesSync(lockFile, old, old);

  const blocked = reviseTaskScope({
    repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'concurrent',
  });

  assert.deepStrictEqual(blocked, { ok: false, reason: 'ledger-locked' });
  // 남의 잠금은 지우지도 덮어쓰지도 않는다.
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(lockFile, 'utf8')), held);
});

test('ledger writes serialize on a lock and reclaim an abandoned one', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const ledgerFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json',
  );
  const lockFile = `${ledgerFile}.lock`;

  // 다른 writer가 쥔 잠금은 기다리다 거절한다 — 읽고-고치고-쓰기가 겹치지 않는다.
  fs.writeFileSync(lockFile, '');
  const blocked = reviseTaskScope({
    repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'concurrent',
  });
  assert.deepStrictEqual(blocked, { ok: false, reason: 'ledger-locked' });

  // 죽은 프로세스가 남긴 오래된 잠금은 회수한다.
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 424242, token: 'dead', at: Date.now() - 600000 }));
  const revised = reviseTaskScope({
    repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'after stale lock',
  });
  assert.strictEqual(revised.ok, true);
  assert.strictEqual(fs.existsSync(lockFile), false);
});

// 회수는 take-then-check다. park한 뒤 복원하기 전에 다른 프로세스가 잠금을 다시
// 잡을 수 있고, 그 창에서 복원이 덮어쓰면 두 writer가 함께 임계 구역에 들어간다.
// fs를 가로채 그 창을 결정적으로 재현한다 — 경합을 기다리면 회귀가 흔들린다.
test('reclaiming a stale lock never overwrites a lock a third acquirer took meanwhile', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const lockFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json.lock',
  );
  // 회수 대상이 될 방치 잠금. 관측되는 토큰은 'dead'다.
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 424242, token: 'dead', at: Date.now() - 600000 }));

  const third = { pid: 424243, token: 'third-owner', at: Date.now() };
  const realRename = fs.renameSync;
  let parkSeen = false;
  let parkPath = null;
  fs.renameSync = (from, to) => {
    realRename(from, to);
    if (parkSeen || from !== lockFile || !String(to).includes('.stale.')) return;
    parkSeen = true;
    parkPath = String(to);
    // park된 내용이 관측 토큰과 달라지도록 바꿔 복원 경로로 들어가게 하고,
    // 그사이 제3의 획득자가 `wx`로 빈자리를 가져간 상태를 만든다.
    fs.writeFileSync(to, JSON.stringify({ pid: 424244, token: 'other-owner', at: Date.now() }));
    fs.writeFileSync(lockFile, JSON.stringify(third), { flag: 'wx' });
  };

  let result;
  try {
    result = reviseTaskScope({
      repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'reclaim race',
    });
  } finally {
    fs.renameSync = realRename;
  }

  assert.strictEqual(parkSeen, true);
  // 복원이 제3자의 잠금을 덮어쓰면 안 된다 — 그 자리는 이미 새 주인의 것이다.
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(lockFile, 'utf8')), third);
  assert.deepStrictEqual(result, { ok: false, reason: 'ledger-locked' });
  // 복원을 포기한 갈래도 park 사본을 치운다. 아무도 읽지 않는 파일이라 남겨 두면
  // 회수 경합마다 runtime 디렉터리에 `.stale.*`가 쌓인다.
  assert.strictEqual(fs.existsSync(parkPath), false);
});

// 잠금을 잃은 writer는 원장도 task 문서도 쓰기 전에 알아차려야 한다. 문서만 고쳐
// 두면 ledger에 없는 revision이 문서에 남아 stale이 된다. 손 복구가 필요한 상태는
// 아니지만(다음 scope revision이 양쪽을 한 번호로 화해시킨다) 저절로 낫지도 않아,
// 그 revision이 나올 때까지 commit safety는 계속 거절한다.
test('a writer that loses the lock mid-section refuses before writing the ledger or the document', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const ledgerFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json',
  );
  const lockFile = `${ledgerFile}.lock`;
  const before = fs.readFileSync(ledgerFile, 'utf8');
  const docRel = path.join(blueprint, 'tasks', '001', 'tasks.md');
  const docAbs = path.join(worker, docRel);
  const docBefore = fs.readFileSync(docAbs, 'utf8');

  const realRead = fs.readFileSync;
  let swapped = false;
  fs.readFileSync = (file, options) => {
    const out = realRead(file, options);
    if (swapped || typeof file !== 'string' || !file.endsWith(docRel)) return out;
    swapped = true;
    // 문서를 읽은 직후, 아직 아무것도 쓰기 전에 잠금을 다른 주인에게 뺏긴 상태로 바꾼다.
    fs.writeFileSync(lockFile, JSON.stringify({ pid: 424245, token: 'stolen', at: Date.now() }));
    return out;
  };

  let result;
  try {
    result = reviseTaskScope({
      repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'lost the lock',
    });
  } finally {
    fs.readFileSync = realRead;
  }

  assert.strictEqual(swapped, true);
  assert.deepStrictEqual(result, { ok: false, reason: 'ledger-lock-lost' });
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), before);
  // 문서도 그대로여야 한다 — ledger에 없는 scope_revision을 문서에 남기면 안 된다.
  assert.strictEqual(fs.readFileSync(docAbs, 'utf8'), docBefore);
});

// 형제 테스트는 문서 쓰기 **앞**의 가드에서 멈춘다. 그 가드만 있으면 문서 쓰기와 원장
// 쓰기 사이에 잠금을 잃는 창은 아무도 막지 못한다 — 그래서 문서 쓰기 직후에 잠금을
// 뺏어 원장 쓰기 직전 가드만을 태운다. governance가 서술하는 유일한 상태(문서는
// 새 revision을 담고 원장은 그대로)를 이 테스트가 고정한다.
test('a writer that loses the lock after writing the document refuses before writing the ledger', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const ledgerFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json',
  );
  const lockFile = `${ledgerFile}.lock`;
  const before = fs.readFileSync(ledgerFile, 'utf8');
  const docRel = path.join(blueprint, 'tasks', '001', 'tasks.md');
  const docAbs = path.join(worker, docRel);
  const docBefore = fs.readFileSync(docAbs, 'utf8');

  const realWrite = fs.writeFileSync;
  let swapped = false;
  fs.writeFileSync = (file, data, options) => {
    realWrite(file, data, options);
    if (swapped || typeof file !== 'string' || !file.endsWith(docRel)) return;
    swapped = true;
    // 문서는 이미 새 revision을 담고 나갔다. 원장을 쓰기 전 바로 이 창에서 잠금을
    // 다른 주인에게 넘긴다 — realWrite로 써야 이 훅이 자신을 다시 타지 않는다.
    realWrite(lockFile, JSON.stringify({ pid: 424247, token: 'stolen', at: Date.now() }));
  };

  let result;
  try {
    result = reviseTaskScope({
      repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'lost the lock late',
    });
  } finally {
    fs.writeFileSync = realWrite;
  }

  assert.strictEqual(swapped, true);
  assert.deepStrictEqual(result, { ok: false, reason: 'ledger-lock-lost' });
  // 원장은 한 바이트도 달라지면 안 된다.
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), before);
  // 문서는 되돌아가지 않는다. 이 비대칭이 governance가 서술하는 상태다 — 문서에는
  // 원장이 모르는 scope_revision이 남고, 다음 scope revision이 양쪽을 화해시킬 때까지
  // commit safety가 거절한다.
  assert.notStrictEqual(fs.readFileSync(docAbs, 'utf8'), docBefore);
  const doc = yaml.load(
    fs.readFileSync(docAbs, 'utf8').replace(/^---\n|\n---\n[\s\S]*$/g, ''),
  );
  assert.strictEqual(doc.bouncer.scope_revision, 'r1');
  assert.deepStrictEqual(doc.bouncer.affected_paths, ['src/auth/']);
  // 원장은 그 revision을 모른다.
  assert.strictEqual(JSON.parse(before).revision, undefined);
});

// 원장에만 쓰는 경로도 같은 확인을 거쳐야 한다. actualPaths 기록은 문서를 건드리지
// 않지만, 잠금을 잃은 채 쓰면 다른 writer가 읽어 간 원장 위에 얹힌다.
test('recordActualPaths that loses the lock mid-section refuses before writing the ledger', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const ledgerFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json',
  );
  const lockFile = `${ledgerFile}.lock`;
  const before = fs.readFileSync(ledgerFile, 'utf8');

  const realRead = fs.readFileSync;
  let swapped = false;
  fs.readFileSync = (file, options) => {
    const out = realRead(file, options);
    // 임계 구역 안의 원장 읽기에서만 바꾼다 — 잠금 파일이 있어야 우리가 이미 주인이다.
    if (swapped || file !== ledgerFile || !fs.existsSync(lockFile)) return out;
    swapped = true;
    // 원장을 읽은 직후, 아직 쓰기 전에 잠금을 다른 주인에게 뺏긴 상태로 바꾼다.
    fs.writeFileSync(lockFile, JSON.stringify({ pid: 424246, token: 'stolen', at: Date.now() }));
    return out;
  };

  let result;
  try {
    result = recordActualPaths({
      repoRoot: worker, blueprint, task: '001', paths: ['src/auth/login.ts'],
    });
  } finally {
    fs.readFileSync = realRead;
  }

  assert.strictEqual(swapped, true);
  assert.deepStrictEqual(result, { ok: false, reason: 'ledger-lock-lost' });
  // 원장은 한 바이트도 달라지면 안 된다.
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), before);
});

// 토큰을 쓰기 전에 죽은 writer는 0바이트 잠금을 남긴다. 그 잠금은 방치되면
// 회수돼야 한다 — 아니면 원장이 영구히 잠긴다.
test('a stale token-less lock is reclaimed', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const lockFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json.lock',
  );
  // 토큰이 없으므로 나이는 파일 mtime으로만 판단된다. LOCK_STALE_MS 이전으로 민다.
  fs.writeFileSync(lockFile, '');
  const old = new Date(Date.now() - 600000);
  fs.utimesSync(lockFile, old, old);

  const revised = reviseTaskScope({
    repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'after stale empty lock',
  });

  assert.strictEqual(revised.ok, true);
  assert.strictEqual(fs.existsSync(lockFile), false);
});

// 복원 경로에서 park 사본이 이미 옮겨진 상태를 만드는 도우미. 회수 대상 잠금을
// park한 직후 그 내용을 관측 토큰과 다르게 바꿔, reclaimStaleLock이 복원 분기로
// 들어가게 한다. 반환값으로 park 여부를 확인한다.
function parkWithForeignToken(lockFile, restore) {
  const realRename = fs.renameSync;
  const state = { parked: false, parkPath: null };
  fs.renameSync = (from, to) => {
    realRename(from, to);
    if (state.parked || from !== lockFile || !String(to).includes('.stale.')) return;
    state.parked = true;
    state.parkPath = String(to);
    fs.writeFileSync(to, JSON.stringify({ pid: 424244, token: 'other-owner', at: Date.now() }));
  };
  restore.push(() => { fs.renameSync = realRename; });
  return state;
}

// 하드링크를 걸 수 없는 환경(미지원 파일시스템, protected_hardlinks 등)에서는
// 복원이 rename으로 물러나야 한다. 물러나지 않으면 park한 원 소유자의 레코드를
// 잃고 잠금 자리가 빈 채로 남는다.
test('restoring a parked lock falls back to rename when a hard link cannot be made', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const lockFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json.lock',
  );
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 424242, token: 'dead', at: Date.now() - 600000 }));

  const restore = [];
  const state = parkWithForeignToken(lockFile, restore);
  const realLink = fs.linkSync;
  let linkSeen = false;
  fs.linkSync = () => {
    linkSeen = true;
    const error = new Error('EPERM: operation not permitted, link');
    error.code = 'EPERM';
    throw error;
  };
  restore.push(() => { fs.linkSync = realLink; });

  let result;
  try {
    result = reviseTaskScope({
      repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'link unavailable',
    });
  } finally {
    for (const undo of restore) undo();
  }

  assert.strictEqual(state.parked, true);
  assert.strictEqual(linkSeen, true);
  // rename 폴백이 park한 레코드를 제자리로 돌려놨어야 한다.
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(lockFile, 'utf8')).token, 'other-owner',
  );
  assert.strictEqual(fs.existsSync(state.parkPath), false);
  assert.deepStrictEqual(result, { ok: false, reason: 'ledger-locked' });
});

// EEXIST도 하드링크 불가도 아닌 실패는 삼키지 않는다. 그리고 그때 park 사본을
// 지우면 원 소유자의 레코드가 영구히 사라지므로, 사본은 남아 있어야 한다.
test('a park copy survives when restoring fails for a reason other than a taken slot', () => {
  const { repo, worker, blueprint } = coordinatorFixture();
  const lockFile = path.join(
    repo, '.worktrees', '001', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json.lock',
  );
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 424242, token: 'dead', at: Date.now() - 600000 }));

  const restore = [];
  const state = parkWithForeignToken(lockFile, restore);
  const realLink = fs.linkSync;
  fs.linkSync = () => {
    const error = new Error('EACCES: permission denied, link');
    error.code = 'EACCES';
    throw error;
  };
  restore.push(() => { fs.linkSync = realLink; });

  try {
    assert.throws(() => reviseTaskScope({
      repoRoot: worker, blueprint, task: '001', paths: ['src/auth/'], reason: 'restore failed',
    }), (error) => error.code === 'EACCES');
  } finally {
    for (const undo of restore) undo();
  }

  assert.strictEqual(state.parked, true);
  // 사람이 복구할 수 있도록 원 소유자의 레코드를 담은 park 사본이 남아야 한다.
  assert.strictEqual(fs.existsSync(state.parkPath), true);
  assert.strictEqual(JSON.parse(fs.readFileSync(state.parkPath, 'utf8')).token, 'other-owner');
});
