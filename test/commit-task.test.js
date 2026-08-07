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
const { computeDiffSha } = require('../scripts/lib/comprehension');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');
const { readCurrent, writeCurrent } = require('../scripts/lib/current');

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
  comprehensionOk = true,
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
    tasksStatus: 'verified',
    title: 'Impl login',
  });
  if (extraOpenTask) {
    writeTaskUnit(repo, blueprintDir, '002', {
      tasksStatus: 'ready',
      title: 'Impl logout',
      affectedPaths: ['src/auth/'],
    });
  }

  let comprehension = [];
  let body = EXPLAIN_BODY;
  if (comprehensionOk) {
    const hashed = computeDiffSha({ repoRoot: repo, base: 'develop' });
    assert.strictEqual(hashed.ok, true, 'fixture git must yield a diff sha');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim();
    comprehension = [{
      task: '001',
      range_from: 'develop',
      range_to: head,
      diff_sha: hashed.sha,
      quiz_score: '1/5',
      disposition: 'accepted',
      recorded_at: '2026-07-01T00:00:00+09:00',
    }];
  } else {
    body = `# Explain

## Background
<!-- empty -->

## Intuition
<!-- empty -->

## Code
<!-- empty -->

## Quiz
<!-- empty -->

## 이해 상태
<!-- empty -->
`;
  }

  writeDoc(repo, `${blueprintDir}/explain.md`, {
    type: 'bouncer.explain', title: 'Explain', description: 'd', resource: `${blueprintDir}/explain.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'published',
      comprehension,
    },
  }, body);
}

function trackingGit(changed, untracked) {
  const calls = [];
  return {
    api: {
      changedFiles: () => changed,
      untrackedFiles: () => untracked,
      stage: (files) => { calls.push('stage'); calls._staged = files; },
      commit: (msg) => { calls.push('commit'); calls._msg = msg; },
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
  fullBlueprint(repo, { extraOpenTask: true });
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
  fullBlueprint(repo, { comprehensionOk: false });
  const g = trackingGit(['src/auth/login.ts'], []);
  const res = commitTask({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'validate');
  assert.ok(res.failures.some((f) => f.code === 'G15'));
  assert.deepStrictEqual(g.calls.filter((c) => typeof c === 'string'), []);
});
