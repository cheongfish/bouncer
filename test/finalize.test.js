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

const BP_REL = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';

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

// Real git so G15's computeDiffSha (no deps injection through finalize) can run.
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
    bouncer: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'approved' },
  });
  writeDoc(repo, `${blueprintDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${blueprintDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'approved' },
  });
  writeDoc(repo, `${blueprintDir}/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl login', description: 'd', resource: `${blueprintDir}/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'TASKS-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'verified',
      affected_paths: ['src/auth/'] },
  });
  writeDoc(repo, `${blueprintDir}/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd', resource: `${blueprintDir}/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'passed' },
  });

  let comprehension = {
    diff_sha: '',
    quiz_score: '',
    disposition: '',
    recorded_at: '',
  };
  let body = EXPLAIN_BODY;
  if (comprehensionOk) {
    const hashed = computeDiffSha({ repoRoot: repo, base: 'develop' });
    assert.strictEqual(hashed.ok, true, 'fixture git must yield a diff sha');
    comprehension = {
      diff_sha: hashed.sha,
      quiz_score: '1/5',
      disposition: 'accepted',
      recorded_at: '2026-07-01T00:00:00+09:00',
    };
  } else {
    // Empty sections → G15 without needing a matching hash.
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
      id: 'EXPLAIN-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'published',
      comprehension,
    },
  }, body);
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
  assert.ok(res.failures.some((f) => f.code === 'G15'));
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

test('dry-run reports staged files and message without committing', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts', `${BP_REL}/tasks.md`], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dryRun, true);
  assert.ok(res.commitMessage.startsWith('feat: Login'), res.commitMessage);
  assert.ok(!res.commitMessage.includes('Blueprint:'), res.commitMessage);
  assert.strictEqual(g.calls.committed, null);
});

test('--yes stages and commits', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts'], [`${BP_REL}/explain.md`]);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.committed, true);
  assert.deepStrictEqual(g.calls.staged, ['src/auth/login.ts', `${BP_REL}/explain.md`]);
  assert.ok(g.calls.committed.startsWith('feat: Login'), g.calls.committed);
});

test('legacy root context blueprint is rejected before staging', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const legacyBp = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';
  fullBlueprint(repo, { blueprintDir: legacyBp, withGit: false, comprehensionOk: false });
  const g = fakeGit([`${legacyBp}/tasks.md`], []);
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
    ['node_modules/js-yaml/index.js', 'graphify-out/graph.json', '.worktrees/BP-001/x'],
  );
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.staged, ['src/auth/login.ts']);
  assert.deepStrictEqual(g.calls.staged, ['src/auth/login.ts']);
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


test('allows .bouncer/context/Distill.md without listing it in affected_paths', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['.bouncer/context/Distill.md'], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.committed, true);
  assert.deepStrictEqual(g.calls.staged, ['.bouncer/context/Distill.md']);
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

test('finalize dry-run and commit both carry injected next payload', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const payload = {
    next: {
      blueprint: '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-002-x',
      epic: '.bouncer/context/epics/EPIC-001-auth',
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
