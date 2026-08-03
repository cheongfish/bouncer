// test/finalize.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { finalize } = require('../scripts/lib/finalize');

const BP_REL = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

function fullBlueprint(repo, { distillStatus = 'published', blueprintDir = BP_REL } = {}) {
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
  writeDoc(repo, `${blueprintDir}/distill.md`, {
    type: 'bouncer.distill', title: 'Distill', description: 'd', resource: `${blueprintDir}/distill.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'DISTILL-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: distillStatus },
  });
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
  fullBlueprint(repo, { distillStatus: 'draft' });
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, git: fakeGit([], []).api });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'validate');
  assert.ok(res.failures.some((f) => f.code === 'G9'));
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
  const g = fakeGit(['src/auth/login.ts'], [`${BP_REL}/distill.md`]);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.committed, true);
  assert.deepStrictEqual(g.calls.staged, ['src/auth/login.ts', `${BP_REL}/distill.md`]);
  assert.ok(g.calls.committed.startsWith('feat: Login'), g.calls.committed);
});

test('legacy root context blueprint is rejected before staging', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const legacyBp = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';
  fullBlueprint(repo, { blueprintDir: legacyBp });
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
