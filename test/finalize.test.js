// test/finalize.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { finalize } = require('../scripts/lib/finalize');
const { computeDiffSha } = require('../scripts/lib/comprehension');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');

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

// Real git so fixtures that still hash ranges (commit path) can share this helper.
function initGitWithChange(repo) {
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['init', '-b', 'work']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  run(['add', 'README']);
  run(['commit', '-m', 'base']);
  // develop stays on the first commit; HEAD advances with the change.
  run(['branch', 'develop']);
  fs.mkdirSync(path.join(repo, 'src/auth'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export {}\n');
  run(['add', 'src/auth/login.ts']);
  run(['commit', '-m', 'change']);
}

function fullBlueprint(repo, {
  comprehensionOk = true,
  blueprintDir = BP_REL,
  withGit = true,
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
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      commit_type: 'feat',
      commit_intent: [
        '마감은 blueprint 단위로 묶는다',
        '남은 변경은 Distill 승격분 정도다',
      ],
    },
  });
  writeDoc(repo, `${blueprintDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl login', description: 'd', resource: `${blueprintDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      affected_paths: ['src/auth/'] },
  });
  writeDoc(repo, `${blueprintDir}/tasks/001/verification.md`, {
    type: 'bouncer.verification',
    title: 'Verified',
    description: 'd',
    resource: `${blueprintDir}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'passed' },
  });
  writeDoc(repo, `${blueprintDir}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd', resource: `${blueprintDir}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture' },
    },
  });

  // G16은 task 엔트리 배열을 요구한다 — fixture도 같은 형식을 쓴다.
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
    // Empty sections → G16 without needing a matching hash.
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

function finalizeMessage() {
  return [
    'feat: Login',
    '',
    '- 마감은 blueprint 단위로 묶는다',
    '- 남은 변경은 Distill 승격분 정도다',
  ].join('\n');
}

function fakeGit(changed, untracked) {
  const calls = { staged: null, committed: null };
  return {
    api: {
      changedFiles: () => changed,
      untrackedFiles: () => untracked,
      stage: (files) => { calls.staged = files; },
      commit: (msg) => { calls.committed = msg; },
    },
    calls,
  };
}

test('gate failure short-circuits before touching git', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo, { comprehensionOk: false });
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'validate');
  assert.ok(res.failures.some((f) => f.code === 'G16'));
  assert.ok(!res.failures.some((f) => f.code === 'G15'));
});

test('out-of-scope file causes hard abort, nothing staged', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts', 'src/payments/charge.ts'], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/payments/charge.ts']);
  assert.strictEqual(g.calls.staged, null);
  assert.strictEqual(g.calls.committed, null);
});

test('dry-run reports staged files and blueprint message without committing', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts', `${BP_REL}/tasks/001/tasks.md`], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dryRun, true);
  // subject는 blueprint title; body는 blueprint commit_intent 2줄뿐.
  assert.strictEqual(res.commitMessage, finalizeMessage());
  assert.ok(!res.commitMessage.includes('Impl login'), res.commitMessage);
  assert.ok(!res.commitMessage.includes('Verified'), res.commitMessage);
  assert.ok(!res.commitMessage.includes('Blueprint:'), res.commitMessage);
  assert.strictEqual(g.calls.committed, null);
});

test('--yes stages and commits', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts'], [`${BP_REL}/explain.md`]);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.committed, true);
  // blueprint는 approved 상태로 시작하므로 이 실행이 index.md를 closed로 잠그고
  // 그 경로도 함께 stage된다(브리프 인터페이스: lock 경로는 stage 대상에 합류).
  assert.deepStrictEqual(g.calls.staged,
    ['src/auth/login.ts', `${BP_REL}/explain.md`, `${BP_REL}/index.md`]);
  assert.strictEqual(g.calls.committed, finalizeMessage());
  assert.strictEqual(res.closed, `${BP_REL}/index.md`);
});

test('no changes with --yes clears pointer without empty commit', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  // 아직 approved인 blueprint는 이 --yes 실행이 index.md를 closed로 잠궈
  // "빈 커밋" 전제가 성립하지 않는다(항상 index.md 한 개는 stage된다).
  // 빈-커밋-스킵 분기는 "이미 closed라 잠글 것도 없음" 케이스로 옮겨 고정한다.
  fullBlueprint(repo);
  const lockOnly = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: fakeGit([], []).api, clearPointer: () => true,
  });
  assert.strictEqual(lockOnly.closed, `${BP_REL}/index.md`, 'precondition: this run performed the lock');

  const cleared = [];
  const g = fakeGit([], []);
  const res = finalize({
    repoRoot: repo,
    blueprintDir: BP_REL,
    yes: true,
    git: g.api,
    clearPointer: (args) => { cleared.push(args.repoRoot); return true; },
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.closed, null, 'already closed — this run must not rewrite it');
  assert.strictEqual(res.committed, false);
  assert.deepStrictEqual(res.staged, []);
  assert.strictEqual(g.calls.staged, null);
  assert.strictEqual(g.calls.committed, null);
  assert.strictEqual(res.pointerCleared, true);
  assert.deepStrictEqual(cleared, [repo]);
});

test('legacy root context blueprint is rejected before staging', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const legacyBp = 'context/epics/001-auth/blueprints/001-login';
  fullBlueprint(repo, { blueprintDir: legacyBp, withGit: false, comprehensionOk: false });
  const g = fakeGit([`${legacyBp}/tasks/001/tasks.md`], []);
  const res = finalize({ repoRoot: repo, blueprintDir: legacyBp, yes: true, git: g.api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'validate');
  assert.ok(res.failures.some((f) => /must be under \.bouncer\/context\/epics/.test(f.message)));
  assert.strictEqual(g.calls.staged, null);
  assert.strictEqual(g.calls.committed, null);
});

test('runtime artifacts are neither violations nor staged', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(
    ['src/auth/login.ts'],
    [
      'node_modules/js-yaml/index.js',
      'graphify-out/graph.json',
      '.worktrees/BP-001/x',
      '.bouncer/.venv/bin/graphify',
    ],
  );
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.ok, true);
  // approved blueprint → 이 실행이 잠금도 함께 stage한다(runtime artifact와
  // 무관하게 lock path는 항상 blueprintDir 밑이라 out-of-scope에 걸리지 않음).
  assert.deepStrictEqual(res.staged, ['src/auth/login.ts', `${BP_REL}/index.md`]);
  assert.deepStrictEqual(g.calls.staged, ['src/auth/login.ts', `${BP_REL}/index.md`]);
});

test('a committed finalize clears the active pointer', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const cleared = [];
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo,
    blueprintDir: BP_REL,
    yes: true,
    git: g.api,
    clearPointer: (args) => { cleared.push(args.repoRoot); return true; },
  });
  assert.strictEqual(res.committed, true);
  assert.strictEqual(res.pointerCleared, true);
  assert.deepStrictEqual(cleared, [repo]);
});

test('a dry-run finalize leaves the pointer alone', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const cleared = [];
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo,
    blueprintDir: BP_REL,
    git: g.api,
    clearPointer: (args) => { cleared.push(args.repoRoot); return true; },
  });
  assert.strictEqual(res.dryRun, true);
  assert.strictEqual(res.pointerCleared, undefined);
  assert.deepStrictEqual(cleared, []);
});

test('finalize commit message has no trailers', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, clearPointer: () => true,
  });
  assert.ok(!/Epic:|Blueprint:|Distill:|Co-Authored-By:/.test(res.commitMessage), res.commitMessage);
});


test('allows .bouncer/Distill.md without listing it in affected_paths', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['.bouncer/Distill.md'], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.committed, true);
  assert.deepStrictEqual(g.calls.staged, ['.bouncer/Distill.md', `${BP_REL}/index.md`]);
});

test('finalize return includes next even when no candidates remain', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo,
    blueprintDir: BP_REL,
    yes: true,
    git: g.api,
    clearPointer: () => true,
    next: () => { throw new Error('should be caught'); },
  });
  assert.ok('next' in res);
  assert.strictEqual(res.ok, true); // 후보가 없어도 ok는 그대로
  assert.deepStrictEqual(res.next, { next: null, remaining: [] });
});

test('--yes locks the blueprint index.md to closed and stages it', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit([], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, clearPointer: () => true,
  });
  assert.strictEqual(res.closed, `${BP_REL}/index.md`);
  assert.ok(res.staged.includes(`${BP_REL}/index.md`));
  assert.match(
    fs.readFileSync(path.join(repo, BP_REL, 'index.md'), 'utf8'),
    /status: closed/,
  );
});

test('dry-run reports the would-be lock path without writing index.md', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const indexPath = path.join(repo, BP_REL, 'index.md');
  const before = fs.readFileSync(indexPath, 'utf8');
  const g = fakeGit([], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.dryRun, true);
  assert.strictEqual(res.closed, `${BP_REL}/index.md`);
  assert.match(before, /status: approved/);
  const after = fs.readFileSync(indexPath, 'utf8');
  assert.strictEqual(after, before);
});

test('re-running --yes on an already-closed blueprint does not rewrite status and skips empty commit', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const firstRun = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: fakeGit([], []).api, clearPointer: () => true,
  });
  assert.strictEqual(firstRun.closed, `${BP_REL}/index.md`);

  const g = fakeGit([], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, clearPointer: () => true,
  });
  assert.strictEqual(res.closed, null);
  assert.strictEqual(res.committed, false);
  assert.strictEqual(g.calls.committed, null);
});

test('finalize dry-run and commit both carry injected next payload', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const payload = {
    next: {
      blueprint: '.bouncer/context/epics/001-auth/blueprints/002-x',
      epic: '.bouncer/context/epics/001-auth',
      sameEpic: true,
      sharedPaths: ['src/auth/'],
    },
    remaining: [],
  };
  const g = fakeGit(['src/auth/login.ts'], []);
  const dry = finalize({
    repoRoot: repo, blueprintDir: BP_REL, git: g.api, next: () => payload,
  });
  assert.strictEqual(dry.ok, true);
  assert.strictEqual(dry.dryRun, true);
  assert.deepStrictEqual(dry.next, payload);

  const committed = finalize({
    repoRoot: repo,
    blueprintDir: BP_REL,
    yes: true,
    git: g.api,
    clearPointer: () => true,
    next: () => payload,
  });
  assert.strictEqual(committed.ok, true);
  assert.strictEqual(committed.committed, true);
  assert.deepStrictEqual(committed.next, payload);
});
