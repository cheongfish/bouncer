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
    '.bouncer/Distill.md',
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
