'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createGitTemplate } = require('./helpers/git-fixture');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// 테스트용 저장소 준비: 전역 git 설정에 기대지 않도록 로컬 config를 직접 넣는다.
function initWithCommit(dir) {
  git(dir, ['init', '--quiet']);
  git(dir, ['config', 'user.email', 't@example.com']);
  git(dir, ['config', 'user.name', 'T']);
  fs.writeFileSync(path.join(dir, 'README.md'), 'base\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '--quiet', '-m', 'base']);
}

test('copies of a template → are independent of each other and keep the template history', () => {
  const t = createGitTemplate(initWithCommit);
  const a = t.copy();
  const b = t.copy();
  fs.writeFileSync(path.join(a, 'x'), '1');
  assert.ok(!fs.existsSync(path.join(b, 'x')));
  assert.notStrictEqual(a, b);
  assert.strictEqual(git(b, ['rev-parse', 'HEAD']), git(t.dir, ['rev-parse', 'HEAD']));
  t.dispose();
});

test('a template that contains git worktrees → copy rejects it', () => {
  const w = createGitTemplate((dir) => {
    initWithCommit(dir);
    git(dir, ['worktree', 'add', '--detach', path.join(`${dir}-wt`)]);
  });
  assert.throws(() => w.copy(), /worktrees/);
  fs.rmSync(`${w.dir}-wt`, { recursive: true, force: true });
  w.dispose();
});

test('dispose called → removes the template and every copy', () => {
  const t = createGitTemplate(initWithCommit);
  const a = t.copy();
  t.dispose();
  assert.ok(!fs.existsSync(t.dir));
  assert.ok(!fs.existsSync(a));
});
