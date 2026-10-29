// test/commit-guard.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkCommitSafety } = require('../packages/cli/dist/commit-guard');
const { isRuntimeArtifact } = require('../packages/cli/dist/scope');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

test('in-scope files → are allowed', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', `${BP}/tasks.md`],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('out-of-scope files → are blocked', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'README.md'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['README.md']);
});

test('known runtime artifacts → are not scope violations', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'node_modules/js-yaml/index.js', 'graphify-out/source/graph.json'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('a source file named like an artifact prefix → is still a violation', () => {
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

test('coordinator ledger scope with a path the approved affected_paths misses → authorizes it', () => {
  const res = checkCommitSafety({
    files: ['src/session/token.ts'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
    coordinator: COORD,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('coordinator ledger scope with a path it does not name → still refuses it', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'src/payments/charge.ts'],
    affectedPaths: ['src/auth/', 'src/payments/'],
    blueprintDir: BP,
    coordinator: { ...COORD, mode: 'light' },
  });
  assert.strictEqual(res.allow, false);
  assert.strictEqual(res.code, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/payments/charge.ts']);
});

test('coordinator boundary refusals → carry their own code and every staged path', () => {
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

test('an inactive coordinator context → leaves the approved-scope judgment unchanged', () => {
  const res = checkCommitSafety({
    files: ['src/session/token.ts'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
    coordinator: { active: false, reason: 'no-ledger', scope: ['src/session/'] },
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['src/session/token.ts']);
});

test('a boundary refusal with nothing staged → still names its cause', () => {
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

test('a detached run context → leaves the approved-scope judgment unchanged', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
    coordinator: { ...COORD, active: false, reason: 'run-detached' },
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('a started task in another drive with overlapping paths → blocks with conflict details', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts'], affectedPaths: ['src/auth/'], blueprintDir: BP,
    coordinator: COORD,
    otherDrives: { ok: true, drives: [{ blueprint: 'other/bp', ledgerFile: '/other/ledger', tasks: [
      { id: '002', status: 'in_progress', affected_paths: ['src/auth/'] },
    ] }] },
  });
  assert.strictEqual(res.allow, false);
  assert.strictEqual(res.code, 'cross-drive-conflict');
  assert.deepStrictEqual(res.conflicts[0].paths, ['src/auth/']);
});

test('a coordinator resource shared by another started task → reports the resource conflict', () => {
  const res = checkCommitSafety({
    files: [], affectedPaths: ['src/auth/'], blueprintDir: BP,
    coordinator: { ...COORD, resources: ['db:migration'] },
    otherDrives: { ok: true, drives: [{ blueprint: 'other/bp', ledgerFile: '/other/ledger', tasks: [
      { id: '002', status: 'ready', affected_paths: ['src/unrelated/'],
        exclusive_resources: ['db:migration'] },
    ] }] },
  });
  assert.strictEqual(res.code, 'cross-drive-conflict');
  assert.deepStrictEqual(res.conflicts[0].resources, ['db:migration']);
});

test('an unreadable other drive ledger → refuses with its path', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts'], affectedPaths: ['src/auth/'], blueprintDir: BP,
    coordinator: COORD,
    otherDrives: { ok: false, reason: 'cross-drive-ledger-unreadable', ledgerFile: '/other/ledger' },
  });
  assert.strictEqual(res.code, 'cross-drive-ledger-unreadable');
  assert.strictEqual(res.ledgerFile, '/other/ledger');
});

test('existing coordinator boundary and scope refusals → precede cross-drive checks', () => {
  const unreadable = { ok: false, reason: 'cross-drive-ledger-unreadable', ledgerFile: '/other' };
  assert.strictEqual(checkCommitSafety({
    files: [], coordinator: { ...COORD, reason: 'stale-revision' }, otherDrives: unreadable,
  }).code, 'stale-revision');
  assert.strictEqual(checkCommitSafety({
    files: ['README.md'], affectedPaths: ['src/auth/'], coordinator: COORD,
    otherDrives: unreadable,
  }).code, 'out-of-scope');
});

// coordinator 원장은 실행 상태이지 커밋 대상이 아니다. integration worktree
// 자신의 커밋 범위에서 원장이 스테이징돼도 out-of-scope로 보고하지 않는다.
test('the coordinator ledger → is not a scope violation', () => {
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
test('Distill outside affected_paths → is not a special commit allow', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', '.bouncer/Distill.md'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['.bouncer/Distill.md']);
});

test('context docs and Distill → are still not runtime artifacts', () => {
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

// full 원장 drive: scope 밖은 기록하고 금지선(Do not touch)만 막는다.
const FULL = { ...COORD, mode: 'full', scope: ['src/a.js'], doNotTouch: ['src/locked/'] };

test('full ledger with a path outside scope and the Do not touch line → allows it and records it as unexpected', () => {
  const res = checkCommitSafety({
    files: ['src/a.js', 'src/extra.js'], affectedPaths: ['src/a.js'], blueprintDir: BP, coordinator: FULL,
  });
  assert.strictEqual(res.allow, true);
  assert.deepStrictEqual(res, { allow: true, violations: [], unexpected: ['src/extra.js'] });
});

test('full ledger with a path under the Do not touch line → refuses with scope-do-not-touch-violation', () => {
  const res = checkCommitSafety({
    files: ['src/extra.js', 'src/locked/x.js'], affectedPaths: ['src/a.js'], blueprintDir: BP, coordinator: FULL,
  });
  assert.strictEqual(res.allow, false);
  assert.strictEqual(res.code, 'scope-do-not-touch-violation');
  assert.deepStrictEqual(res.violations, ['src/locked/x.js']);
});

test('full ledger with unreadable Do not touch and a path outside scope → refuses as scope-do-not-touch-unreadable', () => {
  const res = checkCommitSafety({
    files: ['src/extra.js'], affectedPaths: ['src/a.js'], blueprintDir: BP,
    coordinator: { ...FULL, doNotTouch: null },
  });
  assert.strictEqual(res.allow, false);
  assert.strictEqual(res.code, 'scope-do-not-touch-unreadable');
  assert.deepStrictEqual(res.violations, ['src/extra.js']);
});

test('full ledger with unreadable Do not touch and only in-scope paths → allows without an unexpected key', () => {
  const res = checkCommitSafety({
    files: ['src/a.js'], affectedPaths: ['src/a.js'], blueprintDir: BP,
    coordinator: { ...FULL, doNotTouch: null },
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
  assert.strictEqual('unexpected' in res, false);
});

test('light ledger with a path outside scope → still refuses with out-of-scope', () => {
  const res = checkCommitSafety({
    files: ['src/extra.js'], affectedPaths: ['src/a.js'], blueprintDir: BP,
    coordinator: { ...FULL, mode: 'light', doNotTouch: [] },
  });
  assert.strictEqual(res.code, 'out-of-scope');
  assert.deepStrictEqual(res.violations, ['src/extra.js']);
});

test('boundary refusal with a Do not touch overlap → keeps the boundary code first', () => {
  const res = checkCommitSafety({
    files: ['src/locked/x.js'], affectedPaths: ['src/a.js'], blueprintDir: BP,
    coordinator: { ...FULL, reason: 'stale-revision' },
  });
  assert.strictEqual(res.code, 'stale-revision');
});

test('full ledger with an unexpected path another drive holds → refuses with cross-drive-conflict', () => {
  const otherDrives = { ok: true, drives: [{
    ledgerFile: '/other/coordinator.json', blueprint: 'bp-other',
    tasks: [{ id: '001', status: 'in_progress', affected_paths: ['src/extra.js'] }],
  }] };
  const res = checkCommitSafety({
    files: ['src/extra.js'], affectedPaths: ['src/a.js'], blueprintDir: BP, coordinator: FULL, otherDrives,
  });
  assert.strictEqual(res.code, 'cross-drive-conflict');
});

test('slash-less Do not touch token → matches the directory prefix but not a sibling name', () => {
  const coordinator = { ...FULL, doNotTouch: ['agents'] };
  const hit = checkCommitSafety({
    files: ['agents/bouncer-x.md'], affectedPaths: ['src/a.js'], blueprintDir: BP, coordinator,
  });
  assert.strictEqual(hit.code, 'scope-do-not-touch-violation');
  const miss = checkCommitSafety({
    files: ['agents-extra/a.md'], affectedPaths: ['src/a.js'], blueprintDir: BP, coordinator,
  });
  assert.deepStrictEqual(miss, { allow: true, violations: [], unexpected: ['agents-extra/a.md'] });
});
