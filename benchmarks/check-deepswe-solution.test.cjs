'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { solutionVerdict } = require('./check-deepswe-solution.cjs');

const graded = (reward, extra = {}) => ({ judge_status: 'graded', reward, apply_failed: false, ...extra });

test('untouched graded reward 0 and solution graded reward 1 → ok true with no reasons', () => {
  assert.deepEqual(solutionVerdict({ untouched: graded(0), solution: graded(1) }), { ok: true, reasons: [] });
});

test('untouched reward 1 → ok false with a reason', () => {
  const verdict = solutionVerdict({ untouched: graded(1), solution: graded(1) });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasons.length, 1);
});

test('untouched apply_failed true → ok false with a reason', () => {
  const verdict = solutionVerdict({ untouched: graded(0, { apply_failed: true }), solution: graded(1) });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasons.length, 1);
});

test('solution unjudgeable → ok false with a reason', () => {
  const verdict = solutionVerdict({ untouched: graded(0),
    solution: { judge_status: 'unjudgeable', reward: null, apply_failed: null } });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasons.length, 1);
});

test('solution reward 0 → ok false with a reason', () => {
  const verdict = solutionVerdict({ untouched: graded(0), solution: graded(0) });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasons.length, 1);
});

test('untouched unjudgeable → ok false with a reason', () => {
  const verdict = solutionVerdict({ untouched: { judge_status: 'unjudgeable', reward: null, apply_failed: null },
    solution: graded(1) });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reasons.length, 1);
});
