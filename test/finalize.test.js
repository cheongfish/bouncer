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

const TASK_DESIGN_BODY = `# Tasks

## Goal & intent
마감은 blueprint 단위로 묶는다.

## Interface
task 설계 맥락을 explain에 남긴다.

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] preserve context
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
  withConfig = true,
} = {}) {
  if (withGit) initGitWithChange(repo);
  if (withConfig) {
    fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
    // 해석 가능한 단일 명령. 테스트는 verifyExec로 실행을 가로채므로
    // 실제 `true` 바이너리가 돌지 않게 스텁을 같이 넣는다.
    fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{"verify":"true"}\n');
  }
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
    },
  }, '# Blueprint\n\n## Intent\n- 마감은 청사진 단위로 묶는다\n- 남은 변경은 설명 문서와 병합 기록이다\n');
  writeDoc(repo, `${blueprintDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl login', description: 'd', resource: `${blueprintDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      affected_paths: ['src/auth/'],
      // task commit_intent는 task 커밋 전용이며 finalize는 blueprint Intent를 본다.
      commit_intent: [
        '마감은 청사진 단위로 묶는다',
        '남은 변경은 설명 문서와 병합 기록이다',
      ],
      commit_sha: 'aabbccdd',
    },
  }, TASK_DESIGN_BODY);
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

  // G16은 BP 단일 엔트리(배열)를 요구한다 — fixture도 같은 형식을 쓴다.
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
    '- 마감은 청사진 단위로 묶는다',
    '- 남은 변경은 설명 문서와 병합 기록이다',
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

function passVerify() {
  return { ok: true, exitCode: 0, output: '' };
}

function countingVerify(result = { ok: true, exitCode: 0, output: '' }) {
  const fn = () => {
    fn.calls += 1;
    return result;
  };
  fn.calls = 0;
  return fn;
}

function writeRegisteredDistillShard(repo, id = 'core') {
  fs.mkdirSync(path.join(repo, '.bouncer/distill'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), [
    '---',
    'distill:',
    '  version: 1',
    '  shards:',
    `    - ${id}`,
    '---',
    '# Project Distill',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, `.bouncer/distill/${id}.md`), [
    '---',
    'distill:',
    `  id: ${id}`,
    '  always: true',
    '  paths: []',
    '  pulls: []',
    '---',
    '## Decisions',
    '',
    'registered shard',
    '',
  ].join('\n'));
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
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/payments/charge.ts']);
  assert.strictEqual(g.calls.staged, null);
  assert.strictEqual(g.calls.committed, null);
});

test('--yes verify failure skips lock, staging, and commit', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repoRoot);
  const blueprintDir = BP_REL;
  const fakeGit = {
    staged: [],
    commits: [],
    changedFiles: () => ['src/auth/login.ts'],
    untrackedFiles: () => [],
    stage: (files) => { fakeGit.staged.push(...files); },
    commit: (msg) => { fakeGit.commits.push(msg); },
  };
  const res = finalize({
    repoRoot, blueprintDir, yes: true, git: fakeGit,
    verifyExec: () => ({ ok: false, exitCode: 1, output: 'boom' }),
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'verify');
  assert.strictEqual(res.code, 'VERIFY_FAILED');
  assert.strictEqual(res.exitCode, 1);
  assert.deepStrictEqual(fakeGit.staged, []);
  assert.deepStrictEqual(fakeGit.commits, []);
  assert.match(
    fs.readFileSync(path.join(repoRoot, BP_REL, 'index.md'), 'utf8'),
    /status: approved/,
  );
  assert.ok(!('violations' in res));
  assert.ok(!('staged' in res));
});

test('finalize without Distill files completes remainder', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/Distill.md')));
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/distill')));
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.committed, true);
  assert.ok(!res.staged.some((rel) => /Distill|distill/.test(rel)));
});

test('finalize rejects Distill paths outside affected_paths', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['.bouncer/Distill.md'], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['.bouncer/Distill.md']);
  assert.strictEqual(g.calls.staged, null);
});

test('finalize rejects a Distill shard outside affected_paths', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeRegisteredDistillShard(repo);
  const shard = '.bouncer/distill/core.md';
  const g = fakeGit([shard], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, [shard]);
  assert.strictEqual(g.calls.committed, null);
});

test('finalize rejects an unregistered Distill shard outside affected_paths', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeRegisteredDistillShard(repo);
  const shard = '.bouncer/distill/unregistered.md';
  fs.writeFileSync(path.join(repo, shard), '## Decisions\n\nunregistered shard\n');
  const g = fakeGit([shard], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.deepStrictEqual(res.violations, [shard]);
  assert.strictEqual(g.calls.committed, null);
});

test('dry-run reports staged files and blueprint message without committing', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts', `${BP_REL}/tasks/001/tasks.md`], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dryRun, true);
  // subject와 body는 blueprint title/Intent에서만 만든다.
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
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.committed, true);
  // blueprint는 approved 상태로 시작하므로 이 실행이 index.md를 closed로 잠그고
  // 그 경로도 함께 stage된다(브리프 인터페이스: lock 경로는 stage 대상에 합류).
  assert.deepStrictEqual(g.calls.staged,
    [
      'src/auth/login.ts',
      `${BP_REL}/explain.md`,
      `${BP_REL}/index.md`,
    ]);
  assert.strictEqual(g.calls.committed, finalizeMessage());
  assert.strictEqual(res.closed, `${BP_REL}/index.md`);
});

test('no changes with --yes clears pointer without empty commit', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  // 아직 approved인 blueprint는 이 --yes 실행이 index.md를 closed로 잠궈
  // "빈 커밋" 전제가 성립하지 않는다(항상 index.md 한 개는 stage된다).
  // 빈-커밋-스킵 분기는 "이미 closed라 잠글 것도 없음" 케이스로 옮겨 고정한다.
  fullBlueprint(repo);
  const lockOnlyVerify = countingVerify();
  const lockOnly = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: fakeGit([], []).api,
    clearPointer: () => true, verifyExec: lockOnlyVerify,
  });
  assert.strictEqual(lockOnly.closed, `${BP_REL}/index.md`, 'precondition: this run performed the lock');
  assert.strictEqual(lockOnlyVerify.calls, 1, 'lock-only commit still runs verify');

  const cleared = [];
  const g = fakeGit([], []);
  const skipVerify = countingVerify();
  const res = finalize({
    repoRoot: repo,
    blueprintDir: BP_REL,
    yes: true,
    git: g.api,
    clearPointer: (args) => { cleared.push(args.repoRoot); return true; },
    verifyExec: skipVerify,
  });
  assert.strictEqual(skipVerify.calls, 0);
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
  const res = finalize({
    repoRoot: repo, blueprintDir: legacyBp, yes: true, git: g.api, verifyExec: passVerify,
  });
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
      'graphify-out/source/graph.json',
      '.worktrees/BP-001/x',
      '.bouncer/.venv/bin/graphify',
    ],
  );
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, true);
  // approved blueprint → 이 실행이 잠금도 함께 stage한다(runtime artifact와
  // 무관하게 lock path는 항상 blueprintDir 밑이라 out-of-scope에 걸리지 않음).
  assert.deepStrictEqual(res.staged, [
    'src/auth/login.ts',
    `${BP_REL}/index.md`,
    `${BP_REL}/explain.md`,
  ]);
  assert.deepStrictEqual(g.calls.staged, [
    'src/auth/login.ts',
    `${BP_REL}/index.md`,
    `${BP_REL}/explain.md`,
  ]);
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
    verifyExec: passVerify,
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
    verifyExec: passVerify,
  });
  assert.ok(!/Epic:|Blueprint:|Distill:|Co-Authored-By:/.test(res.commitMessage), res.commitMessage);
});


test('finalize --yes from a linked checkout rejects Distill remainder outside affected_paths', () => {
  const tmp = fs.realpathSync(os.tmpdir());
  const primary = fs.realpathSync(fs.mkdtempSync(path.join(tmp, 'bouncer-finalize-primary-')));
  fullBlueprint(primary);
  const linked = path.join(tmp, `bouncer-finalize-linked-${Date.now()}-${process.pid}`);
  execFileSync('git', ['worktree', 'add', '--detach', linked, 'HEAD'], {
    cwd: primary,
    stdio: 'ignore',
  });
  const linkedRoot = fs.realpathSync(linked);
  fullBlueprint(linkedRoot, { withGit: false });
  writeRegisteredDistillShard(linkedRoot);
  const g = fakeGit(['.bouncer/Distill.md', '.bouncer/distill/core.md'], []);
  const res = finalize({
    repoRoot: linkedRoot, blueprintDir: BP_REL, yes: true, git: g.api, clearPointer: () => true,
    verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'out-of-scope');
  assert.ok(res.violations.includes('.bouncer/Distill.md'));
  assert.ok(res.violations.includes('.bouncer/distill/core.md'));
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
    verifyExec: passVerify,
  });
  assert.ok('next' in res);
  assert.strictEqual(res.ok, true); // 후보가 없어도 ok는 그대로
  assert.deepStrictEqual(res.next, { next: null, remaining: [], sameEpicPending: [] });
});

test('--yes locks the blueprint index.md to closed and stages it', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit([], []);
  const lockVerify = countingVerify();
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, clearPointer: () => true,
    verifyExec: lockVerify,
  });
  assert.strictEqual(lockVerify.calls, 1);
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
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: fakeGit([], []).api,
    clearPointer: () => true, verifyExec: passVerify,
  });
  assert.strictEqual(firstRun.closed, `${BP_REL}/index.md`);

  const g = fakeGit([], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, clearPointer: () => true,
    verifyExec: passVerify,
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
    verifyExec: passVerify,
  });
  assert.strictEqual(committed.ok, true);
  assert.strictEqual(committed.committed, true);
  assert.deepStrictEqual(committed.next, payload);
});

test('dry-run does not invoke verifyExec', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const verifyExec = countingVerify();
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: false, git: fakeGit(['src/auth/login.ts'], []).api,
    verifyExec,
  });
  assert.strictEqual(res.dryRun, true);
  assert.strictEqual(verifyExec.calls, 0);
});

test('missing config.json yields VERIFY_CONFIG_MISSING without throwing', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo, { withConfig: false });
  let threw = false;
  let res;
  try {
    res = finalize({
      repoRoot: repo, blueprintDir: BP_REL, yes: true, git: fakeGit(['src/auth/login.ts'], []).api,
      verifyExec: passVerify,
    });
  } catch (_e) {
    threw = true;
  }
  assert.strictEqual(threw, false);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'verify');
  assert.strictEqual(res.code, 'VERIFY_CONFIG_MISSING');
  assert.strictEqual(res.command, null);
  assert.strictEqual(res.exitCode, null);
});

function writeContextReview(repo, blueprintDir = BP_REL) {
  writeDoc(repo, `${blueprintDir}/context-review.md`, {
    type: 'bouncer.context_review',
    title: 'Context review',
    description: 'd',
    resource: `${blueprintDir}/context-review.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'accepted',
      context_review: { findings: [] },
    },
  });
}

function writeExtraTaskUnit(repo, number, blueprintDir = BP_REL) {
  const digits = String(number).padStart(3, '0');
  writeDoc(repo, `${blueprintDir}/tasks/${digits}/tasks.md`, {
    type: 'bouncer.tasks',
    title: `Impl ${digits}`,
    description: 'd',
    resource: `${blueprintDir}/tasks/${digits}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${digits}`,
      epic_id: '001',
      blueprint_id: '001',
      status: 'verified',
      affected_paths: ['src/auth/'],
      commit_intent: [
        '추가 task도 같은 마감으로 묶는다',
        '일회성 문서만 정리하고 증적은 남긴다',
      ],
      commit_sha: '11223344',
    },
  });
  writeDoc(repo, `${blueprintDir}/tasks/${digits}/verification.md`, {
    type: 'bouncer.verification',
    title: `Verified ${digits}`,
    description: 'd',
    resource: `${blueprintDir}/tasks/${digits}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `VERIFY-${digits}`,
      epic_id: '001',
      blueprint_id: '001',
      status: 'passed',
    },
  });
  writeDoc(repo, `${blueprintDir}/tasks/${digits}/review.md`, {
    type: 'bouncer.review',
    title: `Review ${digits}`,
    description: 'd',
    resource: `${blueprintDir}/tasks/${digits}/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `REVIEW-${digits}`,
      epic_id: '001',
      blueprint_id: '001',
      status: 'accepted',
      review: { required: false, reason: 'fixture' },
    },
  });
}

function writeVerificationTaskUnit(repo, number, blueprintDir = BP_REL) {
  const digits = String(number).padStart(3, '0');
  writeDoc(repo, `${blueprintDir}/tasks/${digits}/tasks.md`, {
    type: 'bouncer.tasks',
    title: `Terminal verification ${digits}`,
    description: 'd',
    resource: `${blueprintDir}/tasks/${digits}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${digits}`,
      epic_id: '001',
      blueprint_id: '001',
      status: 'integrated',
      execution_kind: 'verification',
      depends_on: ['TASKS-001'],
      parallel_safe: false,
      dependency_gate: 'integrated',
      verify: 'true',
      affected_paths: [],
    },
  });
  writeDoc(repo, `${blueprintDir}/tasks/${digits}/verification.md`, {
    type: 'bouncer.verification',
    title: `Terminal verification evidence ${digits}`,
    description: 'd',
    resource: `${blueprintDir}/tasks/${digits}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `VERIFY-${digits}`,
      epic_id: '001',
      blueprint_id: '001',
      status: 'passed',
    },
  });
}

function transientRels(blueprintDir = BP_REL, numbers = ['001']) {
  const rels = [];
  for (const digits of numbers) {
    rels.push(`${blueprintDir}/tasks/${digits}/tasks.md`);
    rels.push(`${blueprintDir}/tasks/${digits}/verification.md`);
    rels.push(`${blueprintDir}/tasks/${digits}/review.md`);
  }
  return rels;
}

function assertTransientPresent(repo, blueprintDir = BP_REL, numbers = ['001']) {
  for (const rel of transientRels(blueprintDir, numbers)) {
    assert.ok(fs.existsSync(path.join(repo, rel)), `expected present: ${rel}`);
  }
}

function assertDurablePresent(repo, blueprintDir = BP_REL) {
  assert.ok(fs.existsSync(path.join(repo, `${blueprintDir}/explain.md`)));
  assert.ok(fs.existsSync(path.join(repo, `${blueprintDir}/index.md`)));
}

test('G16 failure leaves transient docs and approved status untouched', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo, { comprehensionOk: false });
  writeContextReview(repo);
  const beforeTasks = fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/tasks.md`), 'utf8');
  const beforeVerification = fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/verification.md`), 'utf8');
  const beforeReview = fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/review.md`), 'utf8');
  const beforeCr = fs.readFileSync(path.join(repo, `${BP_REL}/context-review.md`), 'utf8');
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'validate');
  assert.ok(res.failures.some((f) => f.code === 'G16'));
  assert.strictEqual(g.calls.staged, null);
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/tasks.md`), 'utf8'),
    beforeTasks,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/verification.md`), 'utf8'),
    beforeVerification,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/review.md`), 'utf8'),
    beforeReview,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/context-review.md`), 'utf8'),
    beforeCr,
  );
  assert.match(fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8'), /status: approved/);
  assertDurablePresent(repo);
});

test('verify failure leaves transient docs and approved status untouched', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeContextReview(repo);
  assertTransientPresent(repo);
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo,
    blueprintDir: BP_REL,
    yes: true,
    git: g.api,
    verifyExec: () => ({ ok: false, exitCode: 1, output: 'boom' }),
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'verify');
  assert.strictEqual(g.calls.staged, null);
  assertTransientPresent(repo);
  assert.ok(fs.existsSync(path.join(repo, `${BP_REL}/context-review.md`)));
  assert.match(fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8'), /status: approved/);
  assertDurablePresent(repo);
});

test('dry-run reports transient deletions in staged without deleting or locking', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeContextReview(repo);
  const indexBefore = fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8');
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dryRun, true);
  for (const rel of [`${BP_REL}/index.md`, `${BP_REL}/explain.md`]) {
    assert.ok(res.staged.includes(rel), `dry-run staged missing ${rel}: ${JSON.stringify(res.staged)}`);
  }
  assert.ok(res.staged.includes('src/auth/login.ts'));
  assert.strictEqual(g.calls.staged, null);
  assertTransientPresent(repo);
  assert.ok(fs.existsSync(path.join(repo, `${BP_REL}/context-review.md`)));
  assert.strictEqual(fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8'), indexBefore);
});

test('finalize collects a verification node without inventing a review leaf', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeVerificationTaskUnit(repo, 2);
  const g = fakeGit([
    'src/auth/login.ts',
    `${BP_REL}/tasks/002/tasks.md`,
    `${BP_REL}/tasks/002/verification.md`,
  ], []);

  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: g.api });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.dryRun, true);
  assert.ok(res.staged.includes(`${BP_REL}/tasks/002/tasks.md`));
  assert.ok(res.staged.includes(`${BP_REL}/tasks/002/verification.md`));
  assert.ok(!res.staged.includes(`${BP_REL}/tasks/002/review.md`));
  assert.ok(fs.existsSync(path.join(repo, `${BP_REL}/tasks/002/tasks.md`)));
  assert.ok(fs.existsSync(path.join(repo, `${BP_REL}/tasks/002/verification.md`)));
  assert.ok(!fs.existsSync(path.join(repo, `${BP_REL}/tasks/002/review.md`)));
});

test('--yes deletes transient docs, keeps durable evidence, and stages deletions with closed index', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeContextReview(repo);
  writeExtraTaskUnit(repo, 2);
  const numbers = ['001', '002'];
  const g = fakeGit([
    'src/auth/login.ts',
    ...transientRels(BP_REL, numbers),
    `${BP_REL}/context-review.md`,
  ], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.committed, true);
  for (const rel of transientRels(BP_REL, numbers)) {
    assert.ok(!fs.existsSync(path.join(repo, rel)), `should delete ${rel}`);
    assert.ok(g.calls.staged.includes(rel), `staged should include deletion ${rel}`);
  }
  assert.ok(!fs.existsSync(path.join(repo, `${BP_REL}/context-review.md`)));
  assert.ok(g.calls.staged.includes(`${BP_REL}/context-review.md`));
  assert.ok(g.calls.staged.includes(`${BP_REL}/index.md`));
  assert.ok(g.calls.staged.includes(`${BP_REL}/explain.md`));
  assert.ok(g.calls.staged.includes('src/auth/login.ts'));
  // 삭제 → closed 전이 → stage 순: staged 목록에 일회성 경로가 index보다 앞에 온다.
  const firstTransient = g.calls.staged.findIndex((f) => f.includes('/tasks/') || f.endsWith('context-review.md'));
  const indexAt = g.calls.staged.indexOf(`${BP_REL}/index.md`);
  assert.ok(firstTransient >= 0 && firstTransient < indexAt);
  assertDurablePresent(repo, BP_REL, numbers);
  assert.match(fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8'), /status: closed/);
  const explainData = yaml.load(
    fs.readFileSync(path.join(repo, `${BP_REL}/explain.md`), 'utf8').split(/^---$/m)[1],
  );
  assert.deepStrictEqual(explainData.bouncer.task_commits, [
    { id: '001', sha: 'aabbccdd' },
    { id: '002', sha: '11223344' },
  ]);
  const explainBody = fs.readFileSync(path.join(repo, `${BP_REL}/explain.md`), 'utf8');
  assert.match(explainBody, /## Tasks\n\n### Task 001/);
  assert.match(explainBody, /## Goal & intent\n[\s\S]*마감은 blueprint 단위로 묶는다/);
  assert.doesNotMatch(explainBody, /verification evidence|## Checklist/);
  assert.deepStrictEqual(res.taskCommits, [
    { id: '001', sha: 'aabbccdd' },
    { id: '002', sha: '11223344' },
  ]);

  const { validateBlueprint } = require('../scripts/lib/validate');
  const re = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(re.ok, true, JSON.stringify(re.failures, null, 2));
});

test('finalize stages tracked transient deletions but removes untracked ones without staging them', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeContextReview(repo);
  const tracked = [
    `${BP_REL}/tasks/001/tasks.md`,
    `${BP_REL}/tasks/001/verification.md`,
  ];
  const untracked = [
    `${BP_REL}/tasks/001/review.md`,
    `${BP_REL}/context-review.md`,
    `${BP_REL}/tasks/001/not-created.md`,
  ];
  const g = fakeGit(['src/auth/login.ts', ...tracked], untracked);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, true);
  assert.ok(g.calls.staged.includes(tracked[0]));
  assert.ok(g.calls.staged.includes(tracked[1]));
  assert.ok(!g.calls.staged.includes(untracked[0]));
  assert.ok(!g.calls.staged.includes(untracked[1]));
  assert.ok(!g.calls.staged.includes(untracked[2]));
  for (const rel of [...tracked, ...untracked.slice(0, 2)]) {
    assert.ok(!fs.existsSync(path.join(repo, rel)), `should delete ${rel}`);
  }
});

test('finalize stages deletion of a tracked-and-clean transient document', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const cleanTracked = `${BP_REL}/tasks/001/tasks.md`;
  const g = fakeGit(['src/auth/login.ts'], []);
  // A clean tracked path is absent from `git diff --name-only HEAD` but still
  // needs `git add` after finalize unlinks it.
  g.api.trackedFiles = () => [cleanTracked];

  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, true);
  assert.ok(g.calls.staged.includes(cleanTracked));
  assert.ok(!fs.existsSync(path.join(repo, cleanTracked)));
});

test('stage failure restores transient docs and approved status', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeContextReview(repo);
  const before = {
    tasks: fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/tasks.md`), 'utf8'),
    verification: fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/verification.md`), 'utf8'),
    review: fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/review.md`), 'utf8'),
    cr: fs.readFileSync(path.join(repo, `${BP_REL}/context-review.md`), 'utf8'),
    index: fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8'),
  };
  const api = {
    changedFiles: () => ['src/auth/login.ts'],
    untrackedFiles: () => [],
    stage: () => { throw new Error('stage boom'); },
    commit: () => { throw new Error('commit should not run'); },
  };
  assert.throws(
    () => finalize({
      repoRoot: repo, blueprintDir: BP_REL, yes: true, git: api, verifyExec: passVerify,
    }),
    /stage boom/,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/tasks.md`), 'utf8'),
    before.tasks,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/verification.md`), 'utf8'),
    before.verification,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/review.md`), 'utf8'),
    before.review,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/context-review.md`), 'utf8'),
    before.cr,
  );
  assert.strictEqual(fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8'), before.index);
  assert.match(before.index, /status: approved/);
});

test('commit failure restores transient docs and approved status', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeContextReview(repo);
  const before = {
    tasks: fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/tasks.md`), 'utf8'),
    verification: fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/verification.md`), 'utf8'),
    review: fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/review.md`), 'utf8'),
    cr: fs.readFileSync(path.join(repo, `${BP_REL}/context-review.md`), 'utf8'),
    index: fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8'),
  };
  const staged = [];
  const api = {
    changedFiles: () => ['src/auth/login.ts'],
    untrackedFiles: () => [],
    stage: (files) => { staged.push(...files); },
    commit: () => { throw new Error('commit boom'); },
  };
  assert.throws(
    () => finalize({
      repoRoot: repo, blueprintDir: BP_REL, yes: true, git: api, verifyExec: passVerify,
    }),
    /commit boom/,
  );
  assert.ok(staged.length > 0, 'stage ran before commit failed');
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/tasks.md`), 'utf8'),
    before.tasks,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/verification.md`), 'utf8'),
    before.verification,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/tasks/001/review.md`), 'utf8'),
    before.review,
  );
  assert.strictEqual(
    fs.readFileSync(path.join(repo, `${BP_REL}/context-review.md`), 'utf8'),
    before.cr,
  );
  assert.strictEqual(fs.readFileSync(path.join(repo, `${BP_REL}/index.md`), 'utf8'), before.index);
});

test('light blueprint finalize does not invent a missing context-review deletion', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const indexAbs = path.join(repo, `${BP_REL}/index.md`);
  const raw = fs.readFileSync(indexAbs, 'utf8').replace(
    'status: approved',
    'status: approved\n  scale: light',
  );
  // scale는 approved와 같은 bouncer 맵에 둬야 한다 — 문자열 치환이 깨지면 fixture를 고친다.
  if (!/scale: light/.test(raw)) {
    const yaml = require('js-yaml');
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    const { data, body } = parseFrontmatter(fs.readFileSync(indexAbs, 'utf8'));
    data.bouncer.scale = 'light';
    fs.writeFileSync(indexAbs, `---\n${yaml.dump(data)}---\n${body}`);
  } else {
    fs.writeFileSync(indexAbs, raw);
  }
  assert.ok(!fs.existsSync(path.join(repo, `${BP_REL}/context-review.md`)));
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, true);
  assert.ok(!g.calls.staged.includes(`${BP_REL}/context-review.md`));
  assert.ok(!fs.existsSync(path.join(repo, `${BP_REL}/context-review.md`)));
});

// --- coordinator ledger projection ------------------------------------------

const { coordinate } = require('../scripts/lib/coordinator');
const { parseFrontmatter: readFm } = require('../scripts/lib/frontmatter');

function drivenBlueprint(repo) {
  fullBlueprint(repo);
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['add', '-A']);
  run(['commit', '-m', 'plan']);
  // 계획 문서를 커밋하면 HEAD가 움직여 fixture의 diff_sha가 G16에서 어긋난다.
  // worktree를 열기 전에 새 HEAD 기준으로 이해 기록을 다시 맞춘다.
  const explainAbs = path.join(repo, `${BP_REL}/explain.md`);
  const { data, body } = readFm(fs.readFileSync(explainAbs, 'utf8'));
  const hashed = computeDiffSha({ repoRoot: repo, base: 'develop' });
  data.bouncer.comprehension[0].diff_sha = hashed.sha;
  data.bouncer.comprehension[0].range_to = run(['rev-parse', 'HEAD']).trim();
  fs.writeFileSync(explainAbs, `---\n${yaml.dump(data)}---\n${body}`);
  run(['add', '-A']);
  run(['commit', '-m', 'explain']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: BP_REL });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: BP_REL, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  return { integration: boot.integrationPath, worker: prepared.tasks[0].workerPath };
}

test('finalize dry-run projects the coordinator ledger and its worktree inventory', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const drive = drivenBlueprint(repo);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.ok(res.coordinator, 'finalize payload must carry coordinator provenance');
  assert.strictEqual(res.coordinator.tasks[0].id, '001');
  assert.strictEqual(res.coordinator.tasks[0].status, 'prepared');
  assert.strictEqual(res.coordinator.tasks[0].worktree, drive.worker);
  assert.strictEqual(res.branch, res.coordinator.integrationBranch);
  assert.strictEqual(res.coordinator.tasks[0].branch, 'bouncer/001-001-001');
  assert.strictEqual(typeof res.coordinator.integrationHead, 'string');
  // 성공 경로도 원장 경로를 실어야 한다. unreadable 분기에만 채우면 이 필드가
  // 정상 드라이브에서는 항상 null이라 아무것도 알려주지 못한다.
  assert.strictEqual(
    res.coordinator.ledgerFile,
    path.join(drive.integration, '.bouncer/runtime/coordinator.json'),
  );
  // cleanup은 이 목록으로 정리 대상을 센다 — integration과 worker가 모두 있어야 한다.
  assert.deepStrictEqual(res.worktrees, [drive.integration, drive.worker]);
});

test('finalize without a coordinator ledger reports no provenance and no worktrees', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.strictEqual(res.coordinator, null);
  assert.strictEqual(res.branch, 'work');
  assert.deepStrictEqual(res.worktrees, []);
});

test('finalize resolves legacy ledger branch fields from worktrees and leaves verification branch null', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const drive = drivenBlueprint(repo);
  const ledgerFile = path.join(drive.integration, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  delete ledger.integrationBranch;
  delete ledger.tasks[0].branch;
  ledger.tasks.push({ id: '002', status: 'integrated', execution_kind: 'verification' });
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger)}\n`);

  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });

  assert.strictEqual(res.coordinator.integrationBranch, 'feat/001-001-login');
  assert.strictEqual(res.coordinator.tasks[0].branch, 'bouncer/001-001-001');
  assert.strictEqual(res.coordinator.tasks[1].branch, null);
  assert.strictEqual(res.branch, res.coordinator.integrationBranch);
});

function writeCoordinatorLedger(repo, tasks) {
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL });
  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(paths.ledgerFile, `${JSON.stringify({
    version: 1,
    blueprint: BP_REL,
    base: 'work',
    tasks,
    decisions: [],
  }, null, 2)}\n`);
  return paths;
}

const ABSENT_INTEGRATION = {
  ledger: 'absent',
  required: false,
  complete: true,
  openTasks: [],
  headVerified: null,
};

test('finalize reports absent integration when there is no coordinator ledger', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const dry = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.deepStrictEqual(dry.integration, ABSENT_INTEGRATION);

  const committed = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: fakeGit(['src/auth/login.ts'], []).api,
    verifyExec: passVerify,
  });
  assert.strictEqual(committed.ok, true);
  assert.deepStrictEqual(committed.integration, ABSENT_INTEGRATION);
});

test('finalize integration lists non-integrated tasks and is incomplete until they close', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  writeCoordinatorLedger(repo, [
    { id: '001', status: 'integrated', execution_kind: 'commit' },
    { id: '002', status: 'recorded', execution_kind: 'commit' },
  ]);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.integration, {
    ledger: 'ok',
    required: true,
    complete: false,
    openTasks: ['002'],
    headVerified: null,
  });
});

test('finalize integration headVerified follows verification-task integration', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const verifying = [
    { id: '001', status: 'integrated', execution_kind: 'commit' },
    { id: '002', status: 'integrated', execution_kind: 'commit' },
    { id: '003', status: 'verifying', execution_kind: 'verification' },
  ];
  writeCoordinatorLedger(repo, verifying);
  const open = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.strictEqual(open.integration.complete, false);
  assert.deepStrictEqual(open.integration.openTasks, ['003']);
  assert.strictEqual(open.integration.headVerified, false);

  writeCoordinatorLedger(repo, verifying.map((task) => (
    task.id === '003' ? { ...task, status: 'integrated' } : task
  )));
  const closed = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.strictEqual(closed.integration.complete, true);
  assert.deepStrictEqual(closed.integration.openTasks, []);
  assert.strictEqual(closed.integration.headVerified, true);
});

test('finalize preserves a partial-closed drive and refuses ordinary cleanup', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const index = path.join(repo, `${BP_REL}/index.md`);
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('status: approved', 'status: partial_closed'));
  fs.writeFileSync(path.join(repo, 'NEXT_PLAN.md'), '# Next plan\n');
  const g = fakeGit([], []);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'partial-closed');
  assert.strictEqual(res.preserved, true);
  assert.strictEqual(res.nextPlan, path.join(repo, 'NEXT_PLAN.md'));
  assert.match(res.message, /NEXT_PLAN\.md를 확인하고/);
  assert.deepStrictEqual(g.calls, { staged: null, committed: null });
});

// 읽히지 않는 원장을 null로 접으면 비-drive finalize와 구분되지 않는다.
// 그 상태로 마감하면 통합되지 않은 fan-in이 완료로 기록되고, 복구에 필요한
// worktree 목록도 비어 버린다.
test('finalize refuses an unreadable coordinator ledger instead of closing as a non-drive', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const drive = drivenBlueprint(repo);
  const ledgerFile = path.join(drive.integration, '.bouncer/runtime/coordinator.json');
  fs.writeFileSync(ledgerFile, '{ "tasks": [');
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'coordinator-ledger');
  assert.strictEqual(res.coordinator.status, 'unreadable');
  // 고칠 파일을 이름으로 돌려줘야 운영자가 어느 원장인지 찾을 수 있다.
  assert.strictEqual(res.coordinator.ledgerFile, ledgerFile);
  assert.strictEqual(res.ledgerFile, ledgerFile);
  assert.strictEqual(res.integrationPath, drive.integration);
  assert.deepStrictEqual(res.integration, {
    ledger: 'unreadable',
    required: true,
    complete: false,
    openTasks: [],
    headVerified: null,
  });

  const yes = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: fakeGit(['src/auth/login.ts'], []).api,
    verifyExec: passVerify,
  });
  assert.strictEqual(yes.ok, false);
  assert.strictEqual(yes.reason, 'coordinator-ledger');
  assert.strictEqual(yes.integration.ledger, 'unreadable');
});

test('finalize --yes copies coordinator provenance into explain frontmatter', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  drivenBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts'], []);
  const res = finalize({
    repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api, verifyExec: passVerify,
  });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const { data } = readFm(fs.readFileSync(path.join(repo, `${BP_REL}/explain.md`), 'utf8'));
  const recorded = data.bouncer.coordinator;
  assert.ok(recorded, 'explain must keep the drive provenance after the documents are deleted');
  assert.strictEqual(recorded.tasks[0].id, '001');
  assert.strictEqual(recorded.integration_head, res.coordinator.integrationHead);
  assert.strictEqual(recorded.integration_branch, res.coordinator.integrationBranch);
  assert.strictEqual(recorded.tasks[0].branch, res.coordinator.tasks[0].branch);
  assert.deepStrictEqual(recorded.worktrees, res.worktrees);
});
