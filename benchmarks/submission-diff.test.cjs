'use strict';

// 이 파일의 두 모드 사례는 임시 git 저장소를 실제로 쓴다. 코딩 표준은 실제 git을 integration 테스트로 한정하지만,
// 검사 대상이 git pathspec `:(exclude)`의 실제 결과라 seam으로 대신하면 제외가 동작하는지 확인할 수 없다.
// env 전달 사례만 `deps.runGit` seam으로 본다.

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { submissionDiff, submissionPathspec } = require('./submission-diff.cjs');

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function put(dir, file, text) {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), text);
}

function repo(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'submission-diff-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, 'init', '--quiet', '-b', 'main');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'user.email', 't@local.invalid');
  put(dir, 'README.md', 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'base');
  return { dir, base: git(dir, 'rev-parse', 'HEAD') };
}

const touched = (patch) => [...patch.matchAll(/^diff --git a\/(\S+) /gm)].map((m) => m[1]).sort();

test('excludes given → pathspec lists . then the managed paths and each exclude', () => {
  assert.deepEqual(submissionPathspec(['vendor/z']),
    ['.', ':(exclude).bouncer', ':(exclude).worktrees', ':(exclude)vendor/z']);
});

test('worktree mode with .bouncer, .worktrees, restored path and a real change → only the real change', (t) => {
  const { dir, base } = repo(t);
  put(dir, '.bouncer/x', 'x\n');
  put(dir, '.worktrees/y', 'y\n');
  put(dir, 'vendor/z', 'z\n');
  put(dir, 'src/a.js', 'a\n');
  const patch = submissionDiff({ mode: 'worktree', cwd: dir, base, excludes: ['vendor/z'] });
  assert.deepEqual(touched(patch), ['src/a.js']);
});

test('ref mode with .bouncer, restored path and a real change committed → only the real change', (t) => {
  const { dir, base } = repo(t);
  git(dir, 'checkout', '--quiet', '-b', 'work');
  put(dir, '.bouncer/x', 'x\n');
  put(dir, 'vendor/z', 'z\n');
  put(dir, 'src/a.js', 'a\n');
  git(dir, 'add', '-f', '.');
  git(dir, 'commit', '--quiet', '-m', 'work');
  const patch = submissionDiff({ mode: 'ref', cwd: dir, base, ref: 'work', excludes: ['vendor/z'] });
  assert.deepEqual(touched(patch), ['src/a.js']);
});

test('ref mode with env → runGit receives env.GIT_DIR in its second argument', () => {
  const calls = [];
  const runGit = (args, options) => {
    calls.push(options);
    return '';
  };
  submissionDiff({ mode: 'ref', cwd: '/w', base: 'abc', ref: 'HEAD', excludes: [], env: { GIT_DIR: '/g' } }, { runGit });
  assert.equal(calls[0].env.GIT_DIR, '/g');
  assert.equal(calls[0].cwd, '/w');
});

test('unknown mode → rejected', () => {
  assert.throws(() => submissionDiff({ mode: 'index', cwd: '/w', base: 'abc', excludes: [] }, { runGit: () => '' }),
    /mode must be worktree or ref/);
});

test('ref mode without ref → rejected', () => {
  assert.throws(() => submissionDiff({ mode: 'ref', cwd: '/w', base: 'abc', excludes: [] }, { runGit: () => '' }),
    /ref mode needs ref/);
});
