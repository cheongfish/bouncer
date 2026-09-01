// test/commit-guard.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkCommitSafety } = require('../scripts/lib/commit-guard');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

test('allows in-scope files', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', `${BP}/tasks.md`],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('blocks out-of-scope files', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'README.md'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['README.md']);
});

test('known runtime artifacts are not scope violations', () => {
  const res = checkCommitSafety({
    files: ['src/auth/login.ts', 'node_modules/js-yaml/index.js', 'graphify-out/source/graph.json'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.deepStrictEqual(res, { allow: true, violations: [] });
});

test('a source file named like an artifact prefix is still a violation', () => {
  const res = checkCommitSafety({
    files: ['node_modules_notes.md'],
    affectedPaths: ['src/auth/'],
    blueprintDir: BP,
  });
  assert.strictEqual(res.allow, false);
  assert.deepStrictEqual(res.violations, ['node_modules_notes.md']);
});
