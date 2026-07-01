// test/commit-hook.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { isGitCommit, evaluateCommit } = require('../scripts/lib/commit-hook');

test('isGitCommit detects commit invocations', () => {
  assert.strictEqual(isGitCommit('git commit -m "x"'), true);
  assert.strictEqual(isGitCommit('git add . && git commit -m "x"'), true);
  assert.strictEqual(isGitCommit('git -C repo commit -m x'), true);
  assert.strictEqual(isGitCommit('git status'), false);
  assert.strictEqual(isGitCommit('echo commit'), false);
});

const BP = 'context/epics/EPIC-001-x/blueprints/BP-001-y';

function deps({ current, affected, staged }) {
  return {
    readCurrent: () => current,
    readAffectedPaths: () => affected,
    stagedFiles: () => staged,
  };
}

test('non-commit command is always allowed', () => {
  const r = evaluateCommit({ command: 'git status', repoRoot: '/r', deps: deps({}) });
  assert.deepStrictEqual(r, { block: false });
});

test('no active blueprint → do not interfere', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r',
    deps: deps({ current: null, affected: [], staged: ['src/a.js'] }),
  });
  assert.deepStrictEqual(r, { block: false });
});

test('in-scope commit is allowed', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r',
    deps: deps({
      current: { blueprint: BP, base: 'develop' },
      affected: ['src/feature'],
      staged: ['src/feature/a.js', `${BP}/tasks.md`],
    }),
  });
  assert.strictEqual(r.block, false);
});

test('out-of-scope commit is blocked with a reason listing violations', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r',
    deps: deps({
      current: { blueprint: BP, base: 'develop' },
      affected: ['src/feature'],
      staged: ['src/feature/a.js', 'src/other/b.js'],
    }),
  });
  assert.strictEqual(r.block, true);
  assert.ok(r.reason.includes('src/other/b.js'));
  assert.ok(!r.reason.includes('src/feature/a.js'));
});
