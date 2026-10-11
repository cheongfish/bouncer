'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { collectFinalEvidence, integrationFromPrepare, pluginVersionFromStages } = require('./run-bouncer-full.cjs');

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

const readyPrepare = () => ({ ok: true, range: { head: 'abc' }, git: { branch: 'feat/x' },
  drive: { ready: true, tasks: [{ id: 'TASKS-001', status: 'integrated', sha: 'abc' }] } });

test('ready drive prepare → head·branch·tasks', () => {
  assert.deepEqual(integrationFromPrepare(readyPrepare()), { head: 'abc', branch: 'feat/x',
    tasks: [{ id: 'TASKS-001', status: 'integrated', sha: 'abc' }] });
});

test('drive null → throw integration incomplete', () => {
  assert.throws(() => integrationFromPrepare({ ...readyPrepare(), drive: null }), /integration incomplete/);
});

test('drive ready false → throw integration incomplete with open tasks', () => {
  const prepare = { ...readyPrepare(), drive: { ready: false, tasks: [{ id: 'TASKS-002', status: 'verified' }] } };
  assert.throws(() => integrationFromPrepare(prepare), /integration incomplete: open tasks TASKS-002:verified/);
});

test('prepare.ok false → throw integration incomplete', () => {
  assert.throws(() => integrationFromPrepare({ ...readyPrepare(), ok: false }), /integration incomplete/);
});

test('stage run.json plugin_version 1.5.7 → 최상위 record plugin_version 1.5.7', () => {
  assert.equal(pluginVersionFromStages([{ plugin_version: '1.5.7' }, { plugin_version: '1.5.6' }]), '1.5.7');
  assert.equal(pluginVersionFromStages([{}]), null);
  assert.equal(pluginVersionFromStages([]), null);
});
