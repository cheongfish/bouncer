'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  COMPOSITE_GATES, compositeGateForCode, compositeGateForReason, compositeGateLabel, summarizeCompositeGates,
} = require('../packages/cli/dist/composite-gates');

test('COMPOSITE_GATES when read → seven gates cover every live G-code and boundary reason once', () => {
  assert.deepStrictEqual(COMPOSITE_GATES.map((g) => g.gate), [
    'plan-activation', 'scope-declaration', 'execution-topology', 'verification-evidence',
    'commit-scope', 'freshness-approval', 'closeout-completeness',
  ]);
  const live = ['G1', 'G2', 'G3', 'G5', 'G6', 'G7', 'G8', 'G13', 'G14', 'G16', 'G17', 'G19', 'G20', 'G21', 'G23', 'G24', 'G32'];
  assert.deepStrictEqual(COMPOSITE_GATES.flatMap((g) => g.codes).sort(), [...live].sort());
  assert.strictEqual(compositeGateForCode('G14'), 'verification-evidence');
  assert.strictEqual(compositeGateForCode('G21'), 'closeout-completeness');
  assert.strictEqual(compositeGateForCode('G32'), 'freshness-approval');
  assert.strictEqual(compositeGateForCode('S10'), null);
  assert.strictEqual(compositeGateForCode('G99'), null);
  assert.strictEqual(compositeGateForCode(undefined), null);
  assert.strictEqual(compositeGateForReason('stale-revision'), 'freshness-approval');
  assert.strictEqual(compositeGateForReason('ledger-locked'), null);
  assert.deepStrictEqual(COMPOSITE_GATES.flatMap((g) => g.reasons).sort(), [
    'cross-drive-conflict', 'cross-drive-ledger-unreadable', 'main-worktree-source-write',
    'out-of-scope', 'stale-revision', 'unassigned-worktree', 'verification-task-no-commit',
  ]);
  assert.ok(Object.isFrozen(COMPOSITE_GATES));
  assert.strictEqual(compositeGateLabel('verification-evidence'), '검증 증적');
  // 소스의 G-code 리터럴이 모두 표에 있다: 새 G-code가 생기면 표 누락으로 실패한다
  const srcDir = path.join(__dirname, '..', 'scripts', 'src', 'lib');
  const sourceCodes = new Set(fs.readdirSync(srcDir)
    .filter((f) => /^validate-gates.*\.ts$/.test(f))
    .flatMap((f) => [...fs.readFileSync(path.join(srcDir, f), 'utf8').matchAll(/'(G\d+)'/g)].map((m) => m[1])));
  assert.deepStrictEqual([...sourceCodes].sort(), COMPOSITE_GATES.flatMap((g) => g.codes).sort());
});

test('summarizeCompositeGates when gates fail → groups in table order with dedup and first next', () => {
  const A = 'tasks/001/verification.md';
  const B = 'tasks/001/tasks.md';
  const out = summarizeCompositeGates([
    { code: 'G13', message: 'm', file: A, next: 'hint-next' },
    { code: 'G7', message: 'm', file: B },
    { code: 'G13', message: 'm2', file: A },
    { code: 'G5', message: 'm', file: '' },
    { code: 'G99', message: 'm', file: 'z.md' },
    { code: 'S10', message: 'm', file: 'y.md' },
  ]);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].gate, 'scope-declaration');
  assert.deepStrictEqual(out[0].codes, ['G5']);
  assert.deepStrictEqual(out[0].targets, []);
  assert.strictEqual(typeof out[0].next, 'string');
  assert.deepStrictEqual(out[1], {
    gate: 'verification-evidence', label: '검증 증적', codes: ['G13', 'G7'], targets: [A, B], next: 'hint-next',
  });
});

test('summarizeCompositeGates when the first failure of a gate has no next → uses the first non-empty next', () => {
  const out = summarizeCompositeGates([
    { code: 'G13', message: 'm', file: 'a.md' },
    { code: 'G13', message: 'm2', file: 'b.md', next: '' },
    { code: 'G7', message: 'm3', file: 'c.md', next: 'second-next' },
  ]);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].next, 'second-next');
});

test('summarizeCompositeGates when no failure of a gate has next → uses the gate default sentence', () => {
  const out = summarizeCompositeGates([
    { code: 'G13', message: 'm', file: 'a.md' },
    { code: 'G7', message: 'm2', file: 'b.md' },
  ]);
  const row = COMPOSITE_GATES.find((g) => g.gate === 'verification-evidence');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].next, row.next);
});

test('summarizeCompositeGates when only S failures or none → empty list', () => {
  assert.deepStrictEqual(summarizeCompositeGates([]), []);
  assert.deepStrictEqual(summarizeCompositeGates([{ code: 'S10', message: 'm', file: 'a.md' }]), []);
});

test('summarizeCompositeGates with G32 → freshness-approval gate keeps the failure next and target', () => {
  const out = summarizeCompositeGates([
    { code: 'G32', message: 'declared prerequisite is not ready: x', file: 'bp/index.md', next: 'fix-prerequisite' },
  ]);
  assert.deepStrictEqual(out, [{
    gate: 'freshness-approval', label: '신선도·승인', codes: ['G32'], targets: ['bp/index.md'], next: 'fix-prerequisite',
  }]);
});
