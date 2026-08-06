'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  parsePathIds, epicDirOf, isNumericContextId, normalizeContextId,
} = require('../scripts/lib/paths');

const BP_NEW = '.bouncer/context/epics/014-numeric/blueprints/001-id-contract';

test('parses numeric ids and kind from new-style paths', () => {
  assert.deepStrictEqual(parsePathIds(`${BP_NEW}/tasks.md`),
    { epicId: '014', blueprintId: '001', kind: 'tasks' });
  assert.deepStrictEqual(parsePathIds(`${BP_NEW}/tasks-002.md`),
    { epicId: '014', blueprintId: '001', kind: 'tasks' });
  assert.deepStrictEqual(parsePathIds(`${BP_NEW}/index.md`),
    { epicId: '014', blueprintId: '001', kind: 'blueprint' });
  assert.deepStrictEqual(parsePathIds('.bouncer/context/epics/014-numeric/index.md'),
    { epicId: '014', blueprintId: null, kind: 'epic' });
  assert.strictEqual(parsePathIds(`${BP_NEW}/verification.md`).kind, 'verification');
  assert.strictEqual(parsePathIds(`${BP_NEW}/explain.md`).kind, 'explain');
});

test('parsePathIds does not treat non-padded tasks-1.md as tasks kind', () => {
  assert.strictEqual(parsePathIds(`${BP_NEW}/tasks-1.md`).kind, null);
});

test('rejects legacy-prefixed path segments', () => {
  const legacy = '.bouncer/context/epics/' + 'EPIC-014-numeric/blueprints/' + 'BP-001-id-contract';
  assert.deepStrictEqual(parsePathIds(`${legacy}/tasks.md`),
    { epicId: null, blueprintId: null, kind: 'tasks' });
});

test('epicDirOf strips the blueprints segment', () => {
  assert.strictEqual(epicDirOf(BP_NEW), '.bouncer/context/epics/014-numeric');
});

test('parsePathIds remains generic for epics and blueprints segments', () => {
  const fixture = 'fixtures/epics/007-x/blueprints/009-y/tasks.md';
  assert.deepStrictEqual(parsePathIds(fixture),
    { epicId: '007', blueprintId: '009', kind: 'tasks' });
});

test('isNumericContextId accepts only zero-padded three digits', () => {
  assert.strictEqual(isNumericContextId('001'), true);
  assert.strictEqual(isNumericContextId('014'), true);
  assert.strictEqual(isNumericContextId('1'), false);
  assert.strictEqual(isNumericContextId('01'), false);
  assert.strictEqual(isNumericContextId('EPIC-001'), false);
  assert.strictEqual(isNumericContextId('BP-001'), false);
});

test('normalizeContextId strips transitional EPIC-/BP- prefixes', () => {
  assert.strictEqual(normalizeContextId('014'), '014');
  assert.strictEqual(normalizeContextId('EPIC-014'), '014');
  assert.strictEqual(normalizeContextId('BP-001'), '001');
  assert.strictEqual(normalizeContextId('TASKS-001'), 'TASKS-001');
  assert.strictEqual(normalizeContextId('TASKS-BP-001'), 'TASKS-001');
  assert.strictEqual(normalizeContextId('VERIFY-BP-001'), 'VERIFY-001');
  assert.strictEqual(normalizeContextId('REVIEW-BP-001'), 'REVIEW-001');
  assert.strictEqual(normalizeContextId('EXPLAIN-BP-001'), 'EXPLAIN-001');
});
