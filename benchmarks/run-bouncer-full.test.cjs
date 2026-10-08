'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { collectFinalEvidence } = require('./run-bouncer-full.cjs');

const BLUEPRINT = '.bouncer/context/epics/001-e/blueprints/001-x';
const BRANCH = 'feat/001-001-x';

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

// worktree 없는 임시 저장소: base 커밋 뒤 통합 브랜치에 blueprint와 코드 변경을 커밋한 상태를 흉내 낸다.
function repoWith(status) {
  const dir = mkdtempSync(path.join(tmpdir(), 'full-evidence-'));
  git(dir, 'init', '--quiet', '-b', 'main');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'user.email', 't@local.invalid');
  writeFileSync(path.join(dir, 'a.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'base');
  const base = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '--quiet', '-b', BRANCH);
  mkdirSync(path.join(dir, BLUEPRINT), { recursive: true });
  writeFileSync(path.join(dir, BLUEPRINT, 'index.md'), `---\nbouncer:\n  status: ${status}\n---\n`);
  writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'work');
  git(dir, 'checkout', '--quiet', 'main');
  return { dir, base, head: git(dir, 'rev-parse', BRANCH) };
}

test('collects closed blueprint, head and patch from the branch ref without a worktree', () => {
  const { dir, base, head } = repoWith('closed');
  const evidence = collectFinalEvidence({ workspace: dir, baseCommit: base, branch: BRANCH, blueprint: BLUEPRINT });
  rmSync(dir, { recursive: true });
  assert.equal(evidence.integration_head, head);
  assert.equal(evidence.blueprint, BLUEPRINT);
  assert.match(evidence.patch.toString(), /diff --git/);
});

test('rejects a missing integration branch', () => {
  const { dir, base } = repoWith('closed');
  assert.throws(() => collectFinalEvidence({ workspace: dir, baseCommit: base, branch: 'feat/nope', blueprint: BLUEPRINT }),
    /integration branch missing: feat\/nope/);
  rmSync(dir, { recursive: true });
});

test('rejects a blueprint that is not closed on the branch', () => {
  const { dir, base } = repoWith('approved');
  assert.throws(() => collectFinalEvidence({ workspace: dir, baseCommit: base, branch: BRANCH, blueprint: BLUEPRINT }),
    /blueprint not closed/);
  rmSync(dir, { recursive: true });
});
