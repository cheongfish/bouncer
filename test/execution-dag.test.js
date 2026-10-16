'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { readyWave, transition, normalizeOverlapPath } = require('../scripts/lib/execution-dag');

test('readyWave with ./src/ and src/ paths in flight and pending → treats them as one path and opens nothing', () => {
  assert.deepStrictEqual(readyWave([
    { id: '001', status: 'prepared', parallel_safe: true, affected_paths: ['./src/'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['src/a.ts'] },
  ]), []);
  assert.deepStrictEqual(readyWave([
    { id: '001', status: 'prepared', parallel_safe: true, affected_paths: ['./src/a.ts'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['src/a.ts'] },
  ]), []);
});

test('readyWave with maxParallel 1 over disjoint parallel tasks → picks only the first', () => {
  const tasks = [
    { id: '001', status: 'pending', parallel_safe: true, affected_paths: ['a/'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['b/'] },
    { id: '003', status: 'pending', parallel_safe: true, affected_paths: ['c/'] },
  ];
  assert.deepStrictEqual(readyWave(tasks), ['001', '002']);
  assert.deepStrictEqual(readyWave(tasks, { maxParallel: 1 }), ['001']);
});

test('readyWave with a shared exclusive resource or no paths → serializes the conflicting tasks', () => {
  assert.deepStrictEqual(readyWave([
    { id: '001', status: 'pending', parallel_safe: true, affected_paths: ['a/'], exclusive_resources: ['database-schema'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['b/'], exclusive_resources: ['database-schema'] },
  ]), ['001']);
  assert.deepStrictEqual(readyWave([
    { id: '001', status: 'pending', parallel_safe: true },
    { id: '002', status: 'pending', parallel_safe: true },
  ]), ['001']);
});

test('transition with a commit-kind allowed pair → returns the next state', () => {
  assert.strictEqual(transition('pending', 'ready'), 'ready');
  assert.strictEqual(transition('recorded', 'integrated'), 'integrated');
  assert.strictEqual(transition('ready', 'verifying', 'verification'), 'verifying');
});

test('transition with a disallowed pair → throws illegal state transition', () => {
  assert.throws(() => transition('pending', 'integrated'), /illegal state transition: pending -> integrated/);
  assert.throws(() => transition('ready', 'verifying'), /illegal state transition: ready -> verifying/);
  assert.throws(
    () => transition('ready', 'prepared', 'verification'),
    /illegal state transition: ready -> prepared/,
  );
});

test('normalizeOverlapPath with ./ prefixes and trailing slash → strips them but keeps a bare root', () => {
  assert.strictEqual(normalizeOverlapPath('./a/'), 'a');
  assert.strictEqual(normalizeOverlapPath('././src/x.ts'), 'src/x.ts');
  assert.strictEqual(normalizeOverlapPath('a'), 'a');
  assert.strictEqual(normalizeOverlapPath('/'), '/');
  assert.strictEqual(normalizeOverlapPath('./'), '');
});
