'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  parsePathIds, epicDirOf, isNumericContextId,
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
  assert.strictEqual(parsePathIds(`${BP_NEW}/context-review.md`).kind, 'context_review');
});

test('parsePathIds kind for tasks/<NNN>/ unit documents', () => {
  const unit = '.bouncer/context/epics/020-x/blueprints/001-y/tasks/002';
  assert.equal(parsePathIds(`${unit}/tasks.md`).kind, 'tasks');
  assert.equal(parsePathIds(`${unit}/verification.md`).kind, 'verification');
  assert.equal(parsePathIds(`${unit}/review.md`).kind, 'review');
  assert.deepStrictEqual(parsePathIds(`${unit}/tasks.md`), {
    epicId: '020', blueprintId: '001', kind: 'tasks',
  });
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
