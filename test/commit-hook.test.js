// test/commit-hook.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { isGitCommit, evaluateCommit, realMainRepoCurrent } = require('../scripts/lib/commit-hook');
const { writeCurrent } = require('../scripts/lib/current');

test('isGitCommit detects commit invocations', () => {
  assert.strictEqual(isGitCommit('git commit -m "x"'), true);
  assert.strictEqual(isGitCommit('git add . && git commit -m "x"'), true);
  assert.strictEqual(isGitCommit('git -C repo commit -m x'), true);
  assert.strictEqual(isGitCommit('git status'), false);
  assert.strictEqual(isGitCommit('echo commit'), false);
  assert.strictEqual(isGitCommit('git log --grep commit'), false);
  assert.strictEqual(isGitCommit('git branch commit-fix'), false);
  assert.strictEqual(isGitCommit('git status && docker commit abc'), false);
  assert.strictEqual(isGitCommit('git -c user.name=x commit -m y'), true);
});

const BP = '.bouncer/context/epics/EPIC-001-x/blueprints/BP-001-y';

function deps({
  current, affected, staged, mainCurrent = null,
}) {
  return {
    readCurrent: () => current,
    readAffectedPaths: () => affected,
    stagedFiles: () => staged,
    mainRepoCurrent: () => mainCurrent,
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

test('worktree pointer missing but main-repo pointer present → falls back and blocks out-of-scope commit', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r/.bouncer/worktrees/BP-001-y',
    deps: deps({
      current: null,
      mainCurrent: { blueprint: BP, base: 'develop' },
      affected: ['src/feature'],
      staged: ['src/feature/a.js', 'src/other/b.js'],
    }),
  });
  assert.strictEqual(r.block, true);
  assert.ok(r.reason.includes('src/other/b.js'));
});

test('worktree pointer missing and main-repo pointer also missing → no active blueprint, allowed', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r/.bouncer/worktrees/BP-001-y',
    deps: deps({
      current: null,
      mainCurrent: null,
      affected: [],
      staged: ['src/other/b.js'],
    }),
  });
  assert.deepStrictEqual(r, { block: false });
});

test('worktree pointer present → used directly, main-repo fallback not needed', () => {
  const r = evaluateCommit({
    command: 'git commit -m x', repoRoot: '/r/.bouncer/worktrees/BP-001-y',
    deps: deps({
      current: { blueprint: BP, base: 'develop' },
      mainCurrent: { blueprint: '.bouncer/context/epics/EPIC-999-z/blueprints/BP-999-z', base: 'main' },
      affected: ['src/feature'],
      staged: ['src/feature/a.js'],
    }),
  });
  assert.strictEqual(r.block, false);
});

test('realMainRepoCurrent returns null when git commands fail (not a repo)', () => {
  assert.strictEqual(realMainRepoCurrent({ repoRoot: '/nonexistent/path/xyz' }), null);
});

test('realMainRepoCurrent reads one shared pointer from primary and linked worktrees', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-hook-'));
  const primary = path.join(root, 'primary');
  const linked = path.join(root, 'linked');
  fs.mkdirSync(primary);
  execFileSync('git', ['init', '--quiet'], { cwd: primary });
  fs.writeFileSync(path.join(primary, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: primary });
  execFileSync('git', [
    '-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'fixture',
  ], { cwd: primary });
  execFileSync('git', ['worktree', 'add', '--quiet', '--detach', linked], { cwd: primary });
  const deps = {
    execFileSync,
    env: { ...process.env, XDG_STATE_HOME: path.join(root, 'state') },
    platform: 'linux',
  };
  const current = { blueprint: BP, base: 'develop' };
  writeCurrent({ repoRoot: primary, ...current, deps });

  assert.deepStrictEqual(realMainRepoCurrent({ repoRoot: primary, deps }), current);
  assert.deepStrictEqual(realMainRepoCurrent({ repoRoot: linked, deps }), current);
});
