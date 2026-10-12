'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { deepsweVerdict } = require('./deepswe.cjs');

const NULL_FIELDS = { score: null, outcome_success: null, reward: null, f2p_passed: null, f2p_total: null,
  p2p_passed: null, p2p_total: null, apply_failed: null };

// unjudgeable 판정은 점수·성공 여부·세부 수치가 모두 null이어야 인프라 실패가 0점으로 섞이지 않는다.
function assertUnjudgeable(verdict, error) {
  assert.equal(verdict.judge_status, 'unjudgeable');
  assert.equal(verdict.error, error);
  for (const [key, value] of Object.entries(NULL_FIELDS)) assert.equal(verdict[key], value, key);
}

test('reward 1 with f2p 13/13 → graded, score 100, outcome_success true', () => {
  const verdict = deepsweVerdict({ rewardJson: { reward: 1, f2p_total: 13, f2p_passed: 13, p2p_total: 5, p2p_passed: 5 },
    rewardTxt: null, timedOut: false });
  assert.equal(verdict.judge_status, 'graded');
  assert.equal(verdict.score, 100);
  assert.equal(verdict.max_score, 100);
  assert.equal(verdict.outcome_success, true);
  assert.equal(verdict.reward, 1);
  assert.equal(verdict.f2p_passed, 13);
  assert.equal(verdict.f2p_total, 13);
  assert.equal(verdict.p2p_passed, 5);
  assert.equal(verdict.p2p_total, 5);
  assert.equal(verdict.apply_failed, false);
  assert.equal(verdict.error, null);
});

test('reward 0 with f2p 9/13 → graded, score 0, f2p_passed 9', () => {
  const verdict = deepsweVerdict({ rewardJson: { reward: 0, f2p_total: 13, f2p_passed: 9 }, rewardTxt: null, timedOut: false });
  assert.equal(verdict.judge_status, 'graded');
  assert.equal(verdict.score, 0);
  assert.equal(verdict.outcome_success, false);
  assert.equal(verdict.f2p_passed, 9);
});

test('apply_failed 1 → graded, reward 0, apply_failed true', () => {
  const verdict = deepsweVerdict({ rewardJson: { reward: 0, apply_failed: 1 }, rewardTxt: null, timedOut: false });
  assert.equal(verdict.judge_status, 'graded');
  assert.equal(verdict.reward, 0);
  assert.equal(verdict.score, 0);
  assert.equal(verdict.apply_failed, true);
});

test('no reward.json and reward.txt -1 → unjudgeable, verifier infrastructure failure', () => {
  assertUnjudgeable(deepsweVerdict({ rewardJson: null, rewardTxt: '-1', timedOut: false }), 'verifier infrastructure failure');
});

test('timed out → unjudgeable, verifier timeout', () => {
  assertUnjudgeable(deepsweVerdict({ rewardJson: null, rewardTxt: null, timedOut: true }), 'verifier timeout');
});

test('timed out with a reward.json → unjudgeable, verifier timeout (timeout checked first)', () => {
  assertUnjudgeable(deepsweVerdict({ rewardJson: { reward: 1 }, rewardTxt: null, timedOut: true }), 'verifier timeout');
});

test('timed out with reward.txt -1 → unjudgeable, verifier timeout', () => {
  assertUnjudgeable(deepsweVerdict({ rewardJson: null, rewardTxt: '-1', timedOut: true }), 'verifier timeout');
});

test('no reward.json and reward.txt missing → unjudgeable, reward.json missing', () => {
  assertUnjudgeable(deepsweVerdict({ rewardJson: null, rewardTxt: null, timedOut: false }), 'reward.json missing');
});

test('no reward.json and reward.txt 0 → unjudgeable, reward.json missing', () => {
  assertUnjudgeable(deepsweVerdict({ rewardJson: null, rewardTxt: '0', timedOut: false }), 'reward.json missing');
});

test('reward 0.5 → unjudgeable, invalid reward', () => {
  assertUnjudgeable(deepsweVerdict({ rewardJson: { reward: 0.5 }, rewardTxt: null, timedOut: false }), 'invalid reward');
});
