// test/finalize.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { finalize } = require('../scripts/lib/finalize');

const BP_REL = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

function fullBlueprint(repo, { distillStatus = 'published' } = {}) {
  writeDoc(repo, 'context/epics/EPIC-001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: 'context/epics/EPIC-001-auth/index.md',
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl login', description: 'd', resource: `${BP_REL}/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'TASKS-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'verified',
      affected_paths: ['src/auth/'] },
  });
  writeDoc(repo, `${BP_REL}/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd', resource: `${BP_REL}/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'passed' },
  });
  writeDoc(repo, `${BP_REL}/distill.md`, {
    type: 'bouncer.distill', title: 'Distill', description: 'd', resource: `${BP_REL}/distill.md`,
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
  assert.ok(res.commitMessage.startsWith('feat(BP-001): Login'));
  assert.strictEqual(g.calls.committed, null);
});

test('--yes stages and commits', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const g = fakeGit(['src/auth/login.ts'], [`${BP_REL}/distill.md`]);
  const res = finalize({ repoRoot: repo, blueprintDir: BP_REL, yes: true, git: g.api });
  assert.strictEqual(res.committed, true);
  assert.deepStrictEqual(g.calls.staged, ['src/auth/login.ts', `${BP_REL}/distill.md`]);
  assert.ok(g.calls.committed.startsWith('feat(BP-001): Login'));
});
