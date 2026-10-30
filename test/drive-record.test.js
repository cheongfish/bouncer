'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  summarizeDriveRecord, reviewRecordFrom, isDriveRecord,
} = require('../packages/cli/dist/drive-record');

const ZERO = {
  tasks: 0, decision_kinds: {}, scope_revisions: 0, unexpected_paths: 0, overlaps: 0,
  conflicts: { fanin: 0 }, repair_waves: { ci: 0, review: 0 },
  reviewer: { dispatches: 0, perspectives: [], models: [] }, baseline: null, review: null,
  mode: 'full', promotion: null,
};

test('같은 wave의 repair 둘과 리뷰 finding이 있는 wave → ci 1, review 1로 센다', () => {
  const ledger = {
    tasks: [],
    decisions: [
      { kind: 'repair', wave: 1, failure: { findings: [] } },
      { kind: 'repair', wave: 1, failure: { findings: [] } },
      { kind: 'repair', wave: 2, failure: { findings: ['F1'] } },
    ],
  };
  assert.deepStrictEqual(summarizeDriveRecord(ledger, null).repair_waves, { ci: 1, review: 1 });
});

test('원장이 null → 모든 수가 0이고 baseline은 null이다', () => {
  assert.deepStrictEqual(summarizeDriveRecord(null, null), ZERO);
});

test('decisions가 배열이 아님 → 모든 수가 0이다', () => {
  assert.deepStrictEqual(summarizeDriveRecord({ tasks: [], decisions: 'x' }, null), ZERO);
});

test('verification task가 섞인 원장 → verification이 아닌 task만 센다', () => {
  const ledger = { tasks: [
    { id: 'a', execution_kind: 'commit' }, { id: 'b', execution_kind: 'verification' }, { id: 'c' },
  ], decisions: [] };
  assert.strictEqual(summarizeDriveRecord(ledger, null).tasks, 2);
});

test('kind가 다양한 결정 → decision_kinds가 kind별 수이고 kind 없음은 unknown이다', () => {
  const ledger = { tasks: [], decisions: [
    { kind: 'scope' }, { kind: 'scope' }, { task: 'a', decision: 'x' }, { kind: 'report' },
  ] };
  const record = summarizeDriveRecord(ledger, null);
  assert.deepStrictEqual(record.decision_kinds, { scope: 2, unknown: 1, report: 1 });
  assert.strictEqual(record.scope_revisions, 2);
});

test('report와 repair의 unexpected_paths·report의 overlaps → 길이를 합산한다', () => {
  const ledger = { tasks: [], decisions: [
    { kind: 'report', unexpected_paths: ['a', 'b'], overlaps: [{}, {}, {}] },
    { kind: 'report', unexpected_paths: ['c'], overlaps: [] },
    { kind: 'repair', wave: 1, unexpected_paths: ['d', 'e'], failure: {} },
    { kind: 'scope', unexpected_paths: ['zzz'] },
  ] };
  const record = summarizeDriveRecord(ledger, null);
  assert.strictEqual(record.unexpected_paths, 5);
  assert.strictEqual(record.overlaps, 3);
});

test('fanin-conflict revoke와 다른 사유 revoke → fanin-conflict만 센다', () => {
  const ledger = { tasks: [], decisions: [
    { kind: 'revoke', reason: 'fanin-conflict' }, { kind: 'revoke', reason: 'other' },
    { kind: 'revoke', reason: 'fanin-conflict' },
  ] };
  assert.deepStrictEqual(summarizeDriveRecord(ledger, null).conflicts, { fanin: 2 });
});

test('reviewer worker-model 결정 → 횟수와 고유 perspective·model을 사전순으로 낸다', () => {
  const ledger = { tasks: [], decisions: [
    { kind: 'worker-model', role: 'reviewer', perspective: 'scope', model: 'sonnet' },
    { kind: 'worker-model', role: 'reviewer', perspective: 'correctness', model: 'opus' },
    { kind: 'worker-model', role: 'reviewer', perspective: 'scope', model: 'opus' },
    { kind: 'worker-model', role: 'implementer', perspective: 'x', model: 'haiku' },
  ] };
  assert.deepStrictEqual(summarizeDriveRecord(ledger, null).reviewer, {
    dispatches: 3, perspectives: ['correctness', 'scope'], models: ['opus', 'sonnet'],
  });
});

test('baseline 결정이 여럿 → 순서상 마지막을 낸다', () => {
  const ledger = { tasks: [], decisions: [
    { kind: 'baseline', command: 'a', exit: 1, accepted: false },
    { kind: 'baseline', command: 'b', exit: 0, accepted: true },
  ] };
  assert.deepStrictEqual(summarizeDriveRecord(ledger, null).baseline,
    { command: 'b', exit: 0, accepted: true });
});

test('입력 원장 → 변경되지 않는다', () => {
  const ledger = { tasks: [{ id: 'a' }], decisions: [{ kind: 'repair', wave: 1, failure: {} }] };
  const before = JSON.stringify(ledger);
  summarizeDriveRecord(ledger, null);
  assert.strictEqual(JSON.stringify(ledger), before);
});

test('review 인자 → 그대로 review 키에 싣는다', () => {
  const review = { contract: 'brief', must_fix: { total: 1, resolved: 1, accepted: 0, deferred: 0, open: 0 } };
  assert.deepStrictEqual(summarizeDriveRecord(null, review).review, review);
});

test('id 중복과 should_fix가 섞인 finding → must_fix를 처음 등장한 id로만 센다', () => {
  const findings = [
    { id: 'F1', actionability: 'must_fix', status: 'deferred' },
    { id: 'F1', actionability: 'must_fix', status: 'open' },
    { id: 'F2', actionability: 'must_fix', status: 'resolved' },
    { id: 'F3', status: 'open' },
  ];
  assert.deepStrictEqual(reviewRecordFrom(findings, 'brief'), {
    contract: 'brief', must_fix: { total: 2, resolved: 1, accepted: 0, deferred: 1, open: 0 },
  });
});

test('findings가 null → null을 낸다', () => {
  assert.strictEqual(reviewRecordFrom(null, 'brief'), null);
});

test('표식이 문자열이 아님 → contract가 null이고 어휘 밖 status는 total에만 든다', () => {
  const findings = [
    { id: 'F1', actionability: 'must_fix', status: 'weird' },
    { id: 'F2', actionability: 'must_fix', status: 'accepted' },
  ];
  assert.deepStrictEqual(reviewRecordFrom(findings, undefined), {
    contract: null, must_fix: { total: 2, resolved: 0, accepted: 1, deferred: 0, open: 0 },
  });
});

test('유효한 DriveRecord → isDriveRecord가 true이다', () => {
  assert.strictEqual(isDriveRecord(ZERO), true);
  assert.strictEqual(isDriveRecord({
    ...ZERO, baseline: { command: 'c', exit: 0, accepted: true },
    review: { contract: null, must_fix: { total: 0, resolved: 0, accepted: 0, deferred: 0, open: 0 } },
  }), true);
});

test('키 하나가 빠졌거나 타입이 틀린 객체 → isDriveRecord가 false이다', () => {
  for (const key of Object.keys(ZERO)) {
    const copy = { ...ZERO };
    delete copy[key];
    assert.strictEqual(isDriveRecord(copy), false, `missing ${key}`);
  }
  assert.strictEqual(isDriveRecord({ ...ZERO, tasks: 'x' }), false);
  assert.strictEqual(isDriveRecord({ ...ZERO, repair_waves: { ci: 1 } }), false);
  assert.strictEqual(isDriveRecord({ ...ZERO, reviewer: { dispatches: 0, perspectives: [1], models: [] } }), false);
  assert.strictEqual(isDriveRecord({ ...ZERO, decision_kinds: { a: 'x' } }), false);
  assert.strictEqual(isDriveRecord(null), false);
});

test('light 원장과 promotion 객체 → mode light와 reason·task만 남긴 promotion을 낸다', () => {
  const ledger = {
    mode: 'light',
    promotion: { reason: 'out-of-scope', task: '001', summary: 's', diff_sha: 'x' },
    tasks: [], decisions: [],
  };
  const record = summarizeDriveRecord(ledger, null);
  assert.strictEqual(record.mode, 'light');
  assert.deepStrictEqual(record.promotion, { reason: 'out-of-scope', task: '001' });
});

test('promoted_from만 있는 full 원장 → 그 reason·task를 promotion으로 낸다', () => {
  const ledger = {
    tasks: [], decisions: [],
    promoted_from: {
      archive: 'a', patch: null, diff_sha: 'd', reason: 'out-of-scope', task: '002',
    },
  };
  const record = summarizeDriveRecord(ledger, null);
  assert.strictEqual(record.mode, 'full');
  assert.deepStrictEqual(record.promotion, { reason: 'out-of-scope', task: '002' });
});

test('mode가 light|full 밖인 DriveRecord → isDriveRecord가 false이다', () => {
  assert.strictEqual(isDriveRecord({ ...ZERO, mode: 'x' }), false);
});

test('mode·promotion 키가 없는 옛 DriveRecord → isDriveRecord가 true이다', () => {
  const legacy = { ...ZERO };
  delete legacy.mode;
  delete legacy.promotion;
  assert.strictEqual(isDriveRecord(legacy), true);
});
