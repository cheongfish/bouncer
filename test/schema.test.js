'use strict';
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../packages/cli/dist/schema');

test('OKF required fields → are exact', () => {
  assert.deepStrictEqual(schema.OKF_REQUIRED,
    ['type', 'title', 'description', 'resource', 'tags', 'timestamp']);
});

test('id prefix and status enum per type → are validated per type', () => {
  assert.deepStrictEqual(schema.TYPES, [
    'bouncer.epic', 'bouncer.blueprint', 'bouncer.tasks',
    'bouncer.verification', 'bouncer.review', 'bouncer.explain',
    'bouncer.context_review',
  ]);
  assert.strictEqual(schema.ID_PREFIX['bouncer.tasks'], 'TASKS-');
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.review'],
    ['pending', 'requested', 'addressed', 'accepted']);
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.tasks'],
    ['draft', 'ready', 'in_progress', 'verified', 'verifying', 'integrated']);
  assert.strictEqual(schema.KIND_TO_TYPE.explain, 'bouncer.explain');
  assert.strictEqual(schema.ID_PREFIX['bouncer.explain'], 'EXPLAIN-');
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.explain'], ['draft', 'published']);
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.blueprint'],
    ['draft', 'approved', 'superseded', 'closed', 'partial_closed', 'imported']);
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.epic'],
    ['draft', 'approved', 'closed', 'imported']);
  assert.strictEqual(schema.TYPES.length, 7);
});

test('bouncer.context_review → is registered on all four schema maps', () => {
  assert.ok(schema.TYPES.includes('bouncer.context_review'));
  assert.strictEqual(schema.ID_PREFIX['bouncer.context_review'], 'CTXREVIEW-');
  assert.deepStrictEqual(schema.STATUS_ENUM['bouncer.context_review'],
    ['pending', 'requested', 'addressed', 'accepted']);
  assert.strictEqual(schema.KIND_TO_TYPE.context_review, 'bouncer.context_review');
});

test('schema exports → bouncer_schema and blueprint scale/commit_type defaults are present', () => {
  assert.strictEqual(schema.BOUNCER_SCHEMA_VERSION, '0.1');
  assert.deepStrictEqual(schema.SCALE_ENUM, ['light', 'full']);
  assert.strictEqual(schema.DEFAULT_SCALE, 'full');
  assert.strictEqual(schema.DEFAULT_COMMIT_TYPE, 'feat');
  assert.deepStrictEqual(schema.AUTONOMY_ENUM, ['auto', 'interactive']);
  assert.strictEqual(schema.DEFAULT_AUTONOMY, 'auto');
});

test('isValidSupersedes → accepts absent or non-empty path arrays', () => {
  assert.strictEqual(schema.isValidSupersedes(undefined), true);
  assert.strictEqual(schema.isValidSupersedes([]), true);
  assert.strictEqual(schema.isValidSupersedes(['.bouncer/context/epics/033-x/index.md']), true);
  assert.strictEqual(schema.isValidSupersedes('033'), false);
  assert.strictEqual(schema.isValidSupersedes([{}]), false);
  assert.strictEqual(schema.isValidSupersedes(['']), false);
  assert.strictEqual(schema.isValidSupersedes(['  ']), false);
  assert.strictEqual(schema.isValidSupersedes(null), false);
});

test('detectLegacyFormat → flags .sdd dirs, sdd keys, and sdd.* types', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-legacy-'));
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  const dirHit = schema.detectLegacyFormat({ repoRoot: repo });
  assert.strictEqual(dirHit.legacy, true);
  assert.match(dirHit.reason, /bouncer-init/);

  const keyHit = schema.detectLegacyFormat({ data: { type: 'bouncer.tasks', sdd: { id: 'x' } } });
  assert.strictEqual(keyHit.legacy, true);
  assert.match(keyHit.reason, /bouncer-init/);

  const typeHit = schema.detectLegacyFormat({ data: { type: 'sdd.tasks' } });
  assert.strictEqual(typeHit.legacy, true);
  assert.match(typeHit.reason, /bouncer-init/);

  assert.strictEqual(schema.detectLegacyFormat({ data: { type: 'bouncer.tasks', bouncer: {} } }).legacy, false);
});

test('schema exports → dependency_gate enum and DAG scaffold defaults are present', () => {
  assert.deepStrictEqual(schema.DEPENDENCY_GATE_ENUM, ['integrated']);
  assert.deepStrictEqual(schema.DEFAULT_DEPENDS_ON, []);
  assert.strictEqual(schema.DEFAULT_PARALLEL_SAFE, false);
  assert.strictEqual(schema.DEFAULT_DEPENDENCY_GATE, 'integrated');
});

test('execution_kind → accepts commit and verification while absence means commit', () => {
  assert.deepStrictEqual(schema.EXECUTION_KIND_ENUM, ['commit', 'verification']);
  assert.strictEqual(schema.executionKindOf({}), 'commit');
  assert.strictEqual(schema.executionKindOf({ execution_kind: 'commit' }), 'commit');
  assert.strictEqual(schema.executionKindOf({ execution_kind: 'verification' }), 'verification');
  assert.strictEqual(schema.executionKindOf({ execution_kind: 'other' }), null);
});

test('verification_policy → scoped_terminal is accepted, absence is legacy, anything else is rejected', () => {
  assert.deepStrictEqual(schema.VERIFICATION_POLICY_ENUM, ['scoped_terminal']);
  assert.strictEqual(schema.verificationPolicyOf({ verification_policy: 'scoped_terminal' }), 'scoped_terminal');
  // 표식이 없는 기존 계획은 소급하지 않고 legacy로 읽는다.
  assert.strictEqual(schema.verificationPolicyOf({}), 'legacy');
  assert.strictEqual(schema.verificationPolicyOf(undefined), 'legacy');
  // 잘못된 값과 null은 legacy로 접히지 않고 호출자가 거절할 수 있게 null이다.
  assert.strictEqual(schema.verificationPolicyOf({ verification_policy: 'legacy' }), null);
  assert.strictEqual(schema.verificationPolicyOf({ verification_policy: null }), null);
  assert.strictEqual(schema.verificationPolicyOf({ verification_policy: 'scoped' }), null);
});

test('review_contract → brief is accepted, absence is legacy, anything else is null', () => {
  assert.equal(typeof schema.reviewContractOf, 'function');
  assert.deepStrictEqual(schema.REVIEW_CONTRACT_ENUM, ['brief']);
  assert.equal(schema.reviewContractOf(undefined), 'legacy');
  assert.equal(schema.reviewContractOf({}), 'legacy');
  assert.equal(schema.reviewContractOf({ review_contract: 'brief' }), 'brief');
  assert.equal(schema.reviewContractOf({ review_contract: '' }), null);
  assert.equal(schema.reviewContractOf({ review_contract: null }), null);
  assert.equal(schema.reviewContractOf({ review_contract: 'other' }), null);
});

test('review_contract on a light blueprint → reviewContractOf does not fold by scale', () => {
  assert.equal(schema.reviewContractOf({ scale: 'light', review_contract: 'brief' }), 'brief');
  assert.equal(schema.reviewContractOf({ scale: 'light', review_contract: 'other' }), null);
  assert.equal(schema.reviewContractOf({ scale: 'full', review_contract: 'brief' }), 'brief');
  assert.equal(typeof schema.planReviewContractOf, 'function');
  assert.equal(schema.planReviewContractOf({ scale: 'light', review_contract: 'brief' }), 'brief');
  assert.equal(schema.planReviewContractOf({ scale: 'full', review_contract: 'brief' }), 'brief');
  assert.equal(schema.planReviewContractOf({}), 'legacy');
  assert.equal(schema.planReviewContractOf(undefined), 'legacy');
  assert.equal(schema.planReviewContractOf({ review_contract: '' }), null);
  assert.equal(schema.planReviewContractOf({ scale: 'light', review_contract: 'other' }), null);
});

test('complexityOf → 부재·비객체는 standard, 허용값은 그대로, 허용 밖은 null', () => {
  assert.deepStrictEqual(schema.COMPLEXITY_ENUM, ['low', 'standard']);
  assert.strictEqual(schema.DEFAULT_COMPLEXITY, 'standard');
  assert.deepStrictEqual(schema.SCALE_DECLARABLE_ENUM, ['full']);
  assert.strictEqual(schema.complexityOf(undefined), 'standard');
  assert.strictEqual(schema.complexityOf(null), 'standard');
  assert.strictEqual(schema.complexityOf({}), 'standard');
  assert.strictEqual(schema.complexityOf({ complexity: 'low' }), 'low');
  assert.strictEqual(schema.complexityOf({ complexity: 'standard' }), 'standard');
  assert.strictEqual(schema.complexityOf({ complexity: '' }), null);
  assert.strictEqual(schema.complexityOf({ complexity: null }), null);
  assert.strictEqual(schema.complexityOf({ complexity: 'medium' }), null);
});

test('plan 관점 정본 → standard는 4관점·low는 verifiability이고 delta는 complexity로만 정해진다', () => {
  assert.deepEqual(schema.PLAN_FULL_PERSPECTIVES, ['consistency', 'scope_minimality', 'verifiability', 'risk_security']);
  assert.deepEqual(schema.PLAN_LOW_PERSPECTIVES, ['verifiability']);
  assert.equal(schema.PLAN_LIGHT_PERSPECTIVES, undefined);
  assert.deepEqual(schema.planPerspectivesOf('low', false), ['verifiability']);
  assert.deepEqual(schema.planPerspectivesOf('low', true), ['verifiability', 'risk_security']);
  assert.deepEqual(schema.planPerspectivesOf('standard', true), schema.PLAN_FULL_PERSPECTIVES);
  assert.equal(schema.planDeltaPerspectiveOf('standard'), 'combined');
  assert.equal(schema.planDeltaPerspectiveOf('low'), 'verifiability');
});

test('normalizeStructure with complexity low → adds sorted review_risk; standard omits the key', () => {
  const { normalizeStructure, digestPlanContent } = require('../packages/cli/dist/plan-snapshot-contract');
  assert.deepStrictEqual(
    normalizeStructure('task', { review_risk: ['b', 'a'] }, 'low').review_risk,
    ['a', 'b'],
  );
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(normalizeStructure('task', { review_risk: ['b', 'a'] }, 'standard'), 'review_risk'),
    false,
  );
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(normalizeStructure('task', { review_risk: ['b', 'a'] }), 'review_risk'),
    false,
  );
  const bpLow = normalizeStructure('blueprint', { scale: 'full', review_scope: 'blueprint' }, 'low');
  assert.strictEqual(bpLow.complexity, 'low');
  const bpStd = normalizeStructure('blueprint', { scale: 'full', review_scope: 'blueprint' }, 'standard');
  assert.deepStrictEqual(Object.keys(bpStd).sort(), ['review_scope', 'scale']);
  const docs = ['t.md'];
  const lowA = digestPlanContent(docs, {
    't.md': { body: 'x', structure: normalizeStructure('task', { review_risk: ['credential'] }, 'low') },
  });
  const lowB = digestPlanContent(docs, {
    't.md': { body: 'x', structure: normalizeStructure('task', { review_risk: ['public_interface'] }, 'low') },
  });
  const lowOrder = digestPlanContent(docs, {
    't.md': { body: 'x', structure: normalizeStructure('task', { review_risk: ['b', 'a'] }, 'low') },
  });
  const lowOrderFlip = digestPlanContent(docs, {
    't.md': { body: 'x', structure: normalizeStructure('task', { review_risk: ['a', 'b'] }, 'low') },
  });
  assert.notStrictEqual(lowA, lowB);
  assert.strictEqual(lowOrder, lowOrderFlip);
  const stdA = digestPlanContent(docs, {
    't.md': { body: 'x', structure: normalizeStructure('task', { review_risk: ['credential'] }, 'standard') },
  });
  const stdB = digestPlanContent(docs, {
    't.md': { body: 'x', structure: normalizeStructure('task', { review_risk: ['public_interface'] }, 'standard') },
  });
  assert.strictEqual(stdA, stdB);
});

test('prerequisites merged_commit 형식 → 40자리 소문자 SHA만 받는다', () => {
  const re = schema.PREREQUISITE_MERGED_COMMIT_RE;
  assert.equal(re.test('a'.repeat(40)), true);
  assert.equal(re.test('0123456789abcdef'.repeat(2) + '01234567'), true);
  for (const bad of ['', 'a'.repeat(39), 'a'.repeat(41), 'A'.repeat(40), 'g'.repeat(40), ` ${'a'.repeat(40)}`]) {
    assert.equal(re.test(bad), false, JSON.stringify(bad));
  }
});
