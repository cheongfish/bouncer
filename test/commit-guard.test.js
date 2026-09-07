// test/commit-guard.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkCommitSafety } = require('../scripts/lib/commit-guard');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

test('allows in-scope files', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', `${BP}/tasks.md`],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('blocks out-of-scope files', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'README.md'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['README.md']);
});

test('known runtime artifacts are not scope violations', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'node_modules/js-yaml/index.js', 'graphify-out/source/graph.json'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('a source file named like an artifact prefix is still a violation', () => {
  const res = checkCommitSafety({
    files: ['node_modules_notes.md'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['node_modules_notes.md']);
});

// coordinator mode: ledger가 현재 scope와 worktree 경계의 정본이다.
const COORD = {
  active: true,
  reason: null,
  taskId: '001',
  revision: 'r2',
  scope: ['src/auth/', 'src/session/'],
  workerPath: '/w/workers/001',
  integrationPath: '/w/integration',
};

test('coordinator ledger scope authorizes a path the approved affected_paths misses', () => {
  const res = checkCommitSafety({
    files: ['src/session/token.ts'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
    coordinator: COORD,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('coordinator ledger scope still refuses a path it does not name', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'src/payments/charge.ts'],
    affectedPaths: ['src/auth/', 'src/payments/'],
    blueprintDir: BP,
    coordinator: COORD,
  });
  assert.strictEqual(res.allow, false);
  assert.strictEqual(res.code, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/payments/charge.ts']);
});

test('coordinator boundary refusals carry their own code and every staged path', () => {
  for (const reason of [
    'main-worktree-source-write', 'unassigned-worktree', 'stale-revision',
    'missing-coordinator-ledger', 'unreadable-ledger', 'task-outside-blueprint',
  ]) {
    const res = checkCommitSafety({
      files: ['src/auth/login.ts', 'node_modules/x/index.js'],
      affectedPaths: ['src/auth/'],
      blueprintDir: BP,
      coordinator: { ...COORD, reason },
    });
    assert.strictEqual(res.allow, false, reason);
    assert.strictEqual(res.code, reason);
    // runtime artifact는 여기서도 위반이 아니다 — 경계 코드가 사유를 말한다.
    assert.deepStrictEqual(res.violations, ['src/auth/login.ts'], reason);
  }
});

test('an inactive coordinator context leaves the approved-scope judgment unchanged', () => {
  const res = checkCommitSafety({
    files: ['src/session/token.ts'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
    coordinator: { active: false, reason: 'no-ledger', scope: ['src/session/'] },
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['src/session/token.ts']);
});

test('a boundary refusal with nothing staged still names its cause', () => {
  const res = checkCommitSafety({
    files: [],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
    coordinator: { ...COORD, reason: 'main-worktree-source-write' },
  });
  assert.deepStrictEqual(res, {
    allow: false, code: 'main-worktree-source-write', violations: [],
  });
});
