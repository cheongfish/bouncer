'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parsePathIds, epicDirOf } = require('../scripts/lib/paths');

const BP = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';

test('parses ids and kind for each doc location', () => {
  assert.deepStrictEqual(parsePathIds(`${BP}/tasks.md`),
    { epicId: 'EPIC-001', blueprintId: 'BP-001', kind: 'tasks' });
  assert.deepStrictEqual(parsePathIds(`${BP}/index.md`),
    { epicId: 'EPIC-001', blueprintId: 'BP-001', kind: 'blueprint' });
  assert.deepStrictEqual(parsePathIds('.bouncer/context/epics/EPIC-001-auth/index.md'),
    { epicId: 'EPIC-001', blueprintId: null, kind: 'epic' });
  assert.strictEqual(parsePathIds(`${BP}/verification.md`).kind, 'verification');
});

test('epicDirOf strips the blueprints segment', () => {
  assert.strictEqual(epicDirOf(BP), '.bouncer/context/epics/EPIC-001-auth');
});

test('parsePathIds remains generic for epics and blueprints segments', () => {
  const fixture = 'fixtures/epics/EPIC-007-x/blueprints/BP-009-y/tasks.md';
  assert.deepStrictEqual(parsePathIds(fixture),
    { epicId: 'EPIC-007', blueprintId: 'BP-009', kind: 'tasks' });
});
