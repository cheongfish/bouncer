'use strict';
const test = require('node:test');
const assert = require('node:assert');
const reviewPolicy = require('../scripts/lib/review-policy');
const reviewDispatch = require('../scripts/lib/review-dispatch');
const { checkStructural } = require('../scripts/lib/validate');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

test('review policy 정본 → 위험도 네 값이 정해진 순서로 노출된다', () => {
  assert.deepStrictEqual(
    [...reviewPolicy.REVIEW_RISK_ENUM],
    ['public_interface', 'authentication', 'authorization', 'credential'],
  );
});

test('review policy 정본 → execute 관점 다섯 값이 정해진 순서로 노출된다', () => {
  assert.deepStrictEqual(
    [...reviewPolicy.REVIEW_PERSPECTIVE],
    ['combined', 'spec_scope', 'correctness_tests', 'minimality_maintainability', 'security'],
  );
});

test('review-dispatch export → 정본과 같은 REVIEW_RISK_ENUM 참조를 다시 내보낸다', () => {
  assert.strictEqual(reviewDispatch.REVIEW_RISK_ENUM, reviewPolicy.REVIEW_RISK_ENUM);
});

test('enum 밖 review_risk → validate-structural이 S30으로 거절한다', () => {
  const rel = `${BP_REL}/tasks/001/tasks.md`;
  const failures = [];
  checkStructural({
    data: {
      type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001', resource: rel,
      tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
        affected_paths: ['src/auth/'], review_risk: ['mystery'],
      },
    },
    rel,
  }, failures);
  assert.ok(failures.some((f) => f.code === 'S30'));
});

// review-repair-state: repair 사용 predicate와 round reader의 strict/tolerant 오류 정책.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const reviewRepairState = require('../scripts/lib/review-repair-state');

function reviewFile(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-repair-state-'));
  const file = path.join(dir, 'review.md');
  if (source !== null) fs.writeFileSync(file, source);
  return file;
}

const ROUNDS_DOC = (modes) => `---\nbouncer:\n  review:\n    rounds:\n${
  modes.map((mode) => `      - mode: ${mode}\n`).join('')}---\n# Review\n`;

test('decisions가 비었거나 없으면 → repair 사용 아님', () => {
  assert.strictEqual(reviewRepairState.hasReviewRepairDecision([]), false);
  assert.strictEqual(reviewRepairState.hasReviewRepairDecision(undefined), false);
});

test('review 원인 repair decision이 있으면 → repair 사용됨', () => {
  const decisions = [{ kind: 'supplement' }, { kind: 'repair', failure: { command: 'review' } }];
  assert.strictEqual(reviewRepairState.hasReviewRepairDecision(decisions), true);
});

test('verify 원인 repair decision만 있으면 → repair 사용 아님', () => {
  const decisions = [{ kind: 'repair', failure: { command: 'npm test' } }];
  assert.strictEqual(reviewRepairState.hasReviewRepairDecision(decisions), false);
});

test('delta 라운드가 있는 문서 → strict·tolerant 모두 delta true, discovery false', () => {
  const file = reviewFile(ROUNDS_DOC(['discovery', 'delta']));
  for (const error_policy of ['strict', 'tolerant']) {
    assert.strictEqual(reviewRepairState.reviewRoundExists({ file, error_policy }, 'delta'), true);
  }
  const only = reviewFile(ROUNDS_DOC(['discovery']));
  for (const error_policy of ['strict', 'tolerant']) {
    assert.strictEqual(reviewRepairState.reviewRoundExists({ file: only, error_policy }, 'delta'), false);
  }
});

test('문서가 없으면(ENOENT) → strict·tolerant 모두 false', () => {
  const file = reviewFile(null);
  for (const error_policy of ['strict', 'tolerant']) {
    assert.strictEqual(reviewRepairState.reviewRoundExists({ file, error_policy }, 'delta'), false);
  }
});

test('깨진 YAML 문서 → strict는 던지고 tolerant는 false', () => {
  const file = reviewFile('---\nbouncer: [unclosed\n---\n# Review\n');
  assert.throws(() => reviewRepairState.reviewRoundExists({ file, error_policy: 'strict' }, 'delta'));
  assert.strictEqual(reviewRepairState.reviewRoundExists({ file, error_policy: 'tolerant' }, 'delta'), false);
});

test('ENOENT 아닌 읽기 오류(경로가 디렉터리) → strict·tolerant 모두 던진다', () => {
  const file = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-repair-state-dir-'));
  for (const error_policy of ['strict', 'tolerant']) {
    assert.throws(() => reviewRepairState.reviewRoundExists({ file, error_policy }, 'delta'));
  }
});
