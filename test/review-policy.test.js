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
