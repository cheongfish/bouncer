'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  parsePathIds, epicDirOf, isNumericContextId,
} = require('../packages/cli/dist/paths');

const BP_NEW = '.bouncer/context/epics/014-numeric/blueprints/001-id-contract';

test('new-style paths → numeric ids and kind are parsed', () => {
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

test('parsePathIds with tasks/<NNN>/ unit documents → returns the tasks kind', () => {
  const unit = '.bouncer/context/epics/020-x/blueprints/001-y/tasks/002';
  assert.equal(parsePathIds(`${unit}/tasks.md`).kind, 'tasks');
  assert.equal(parsePathIds(`${unit}/verification.md`).kind, 'verification');
  assert.equal(parsePathIds(`${unit}/review.md`).kind, 'review');
  assert.deepStrictEqual(parsePathIds(`${unit}/tasks.md`), {
    epicId: '020', blueprintId: '001', kind: 'tasks',
  });
});

test('parsePathIds with non-padded tasks-1.md → does not treat it as tasks kind', () => {
  assert.strictEqual(parsePathIds(`${BP_NEW}/tasks-1.md`).kind, null);
});

test('legacy-prefixed path segments → are rejected', () => {
  const legacy = '.bouncer/context/epics/' + 'EPIC-014-numeric/blueprints/' + 'BP-001-id-contract';
  assert.deepStrictEqual(parsePathIds(`${legacy}/tasks.md`),
    { epicId: null, blueprintId: null, kind: 'tasks' });
});

test('epicDirOf with a blueprints segment → strips it', () => {
  assert.strictEqual(epicDirOf(BP_NEW), '.bouncer/context/epics/014-numeric');
});

test('parsePathIds with epics and blueprints segments → remains generic', () => {
  const fixture = 'fixtures/epics/007-x/blueprints/009-y/tasks.md';
  assert.deepStrictEqual(parsePathIds(fixture),
    { epicId: '007', blueprintId: '009', kind: 'tasks' });
});

test('isNumericContextId with ids of various shapes → accepts only zero-padded three digits', () => {
  assert.strictEqual(isNumericContextId('001'), true);
  assert.strictEqual(isNumericContextId('014'), true);
  assert.strictEqual(isNumericContextId('1'), false);
  assert.strictEqual(isNumericContextId('01'), false);
  assert.strictEqual(isNumericContextId('EPIC-001'), false);
  assert.strictEqual(isNumericContextId('BP-001'), false);
});

test('toPosix → 단일 정의이며 백슬래시와 비문자열 입력을 처리한다', () => {
  const { toPosix } = require('../packages/cli/dist/posix-path');
  assert.strictEqual(toPosix('a\\b\\c.md'), 'a/b/c.md');
  assert.strictEqual(toPosix(undefined), 'undefined');
  assert.strictEqual(require('../packages/cli/dist/paths').toPosix, toPosix);
});

test('parsePathIds with slug paths → returns slug keys and kind', () => {
  const unit = '.bouncer/context/epics/consumer-epic-registry/blueprints/registry-gates';
  assert.deepStrictEqual(parsePathIds(`${unit}/tasks/001/tasks.md`),
    { epicId: 'consumer-epic-registry', blueprintId: 'registry-gates', kind: 'tasks' });
  assert.deepStrictEqual(parsePathIds(`${unit}/index.md`),
    { epicId: 'consumer-epic-registry', blueprintId: 'registry-gates', kind: 'blueprint' });
  assert.deepStrictEqual(parsePathIds('.bouncer/context/epics/consumer-epic-registry/index.md'),
    { epicId: 'consumer-epic-registry', blueprintId: null, kind: 'epic' });
});

test('parsePathIds with mixed numeric epic and slug blueprint → ids are null', () => {
  assert.deepStrictEqual(parsePathIds('epics/014-numeric/blueprints/registry-gates/tasks.md'),
    { epicId: null, blueprintId: null, kind: 'tasks' });
});
