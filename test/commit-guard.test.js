// test/commit-guard.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkCommitSafety } = require('../scripts/lib/commit-guard');
const { isRuntimeArtifact } = require('../scripts/lib/scope');

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

// coordinator 원장은 실행 상태이지 커밋 대상이 아니다. integration worktree
// 자신의 커밋 범위에서 원장이 스테이징돼도 out-of-scope로 보고하지 않는다.
test('the coordinator ledger is not a scope violation', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', '.bouncer/runtime/coordinator.json'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

// 접두 판정은 `.bouncer/runtime/` 한 갈래에만 적용된다 — 커밋해야 하는
// 컨텍스트 문서와 Distill까지 런타임 산출물이 되면 게이트 증적이 리뷰어에게
// 닿지 않는다. makeAllowed 예외와 무관하게 술어 자체를 고정한다.
test('Distill is not a special commit allow outside affected_paths', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', '.bouncer/Distill.md'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['.bouncer/Distill.md']);
});

test('context docs and Distill are still not runtime artifacts', () => {
  assert.strictEqual(isRuntimeArtifact('.bouncer/runtime/coordinator.json'), true);
  assert.strictEqual(isRuntimeArtifact('.bouncer/context/epics/002-other/index.md'), false);
  assert.strictEqual(isRuntimeArtifact('.bouncer/Distill.md'), false);
  // 목록 항목은 반드시 슬래시로 끝나야 한다. `isUnder`가 슬래시 없는 entry에는
  // 스스로 슬래시를 붙이므로, 상수가 `.bouncer/runtime`으로 넓어져도 하위 경로
  // 판정은 그대로다 — 차이가 드러나는 유일한 입력이 디렉터리 자신이다.
  // 그때만 `f === e`가 걸려 true가 되므로, 이 단언이 그 확장을 잡는다.
  assert.strictEqual(isRuntimeArtifact('.bouncer/runtime'), false);
  // 접두 오탐 방지: 이름이 `runtime`으로 시작할 뿐인 형제 파일은 소스다.
  assert.strictEqual(isRuntimeArtifact('.bouncer/runtime-notes.md'), false);
});
