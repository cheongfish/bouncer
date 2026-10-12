'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { setupExcludes } = require('./task-card.cjs');
const { applyVerdict, gitignoreAgainstPolicy, collectFinalEvidence, integrationFromPrepare, pluginVersionFromStages,
  bootstrapCommit, configOf, runtimeFieldsFor } = require('./run-bouncer-full.cjs');

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

test('branch commits .bouncer and a restored path → patch has neither, built without a worktree', () => {
  const { dir, base } = repoWith('closed');
  git(dir, 'checkout', '--quiet', BRANCH);
  mkdirSync(path.join(dir, 'vendor'), { recursive: true });
  writeFileSync(path.join(dir, 'vendor', 'z'), 'z\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'restored');
  git(dir, 'checkout', '--quiet', 'main');
  const excludes = setupExcludes([{ kind: 'restore_untracked', paths: ['vendor/z'] }]);
  const patch = collectFinalEvidence({ workspace: dir, baseCommit: base, branch: BRANCH, blueprint: BLUEPRINT, excludes })
    .patch.toString();
  rmSync(dir, { recursive: true });
  assert.doesNotMatch(patch, /diff --git a\/\.bouncer\//);
  assert.doesNotMatch(patch, /diff --git a\/vendor\/z/);
  assert.match(patch, /diff --git a\/a\.txt/);
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

const suggested = ['node_modules/', '.worktrees/', '.bouncer/runtime/'];

test('상류 .gitignore에 제안 항목만 더함 → ok', () => {
  const baseline = ['node_modules/', '*.log'];
  assert.equal(gitignoreAgainstPolicy({ baseline, current: [...baseline, '.worktrees/', '.bouncer/runtime/'], expected: suggested }).ok, true);
});

test('제안 밖 항목을 더함 → not ok', () => {
  assert.equal(gitignoreAgainstPolicy({ baseline: ['node_modules/'], current: ['node_modules/', '.worktrees/', '.bouncer/runtime/', 'extra/'], expected: suggested }).ok, false);
});

test('기존 항목을 지움 → not ok', () => {
  assert.equal(gitignoreAgainstPolicy({ baseline: ['*.log', 'node_modules/'], current: suggested, expected: suggested }).ok, false);
});

test('제안 항목이 빠짐 → not ok', () => {
  assert.equal(gitignoreAgainstPolicy({ baseline: [], current: ['node_modules/'], expected: suggested }).ok, false);
});

// 커밋하지 않은 .bouncer/config.json만 있는 깨끗한 저장소: bootstrapCommit이 보는 실제 작업 트리 상태다.
function bootstrapRepo(baseBranch) {
  const dir = mkdtempSync(path.join(tmpdir(), 'full-bootstrap-'));
  git(dir, 'init', '--quiet', '-b', 'main');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'user.email', 't@local.invalid');
  writeFileSync(path.join(dir, 'a.txt'), 'base\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '--quiet', '-m', 'base');
  mkdirSync(path.join(dir, '.bouncer'));
  writeFileSync(path.join(dir, '.bouncer', 'config.json'), JSON.stringify({
    base_branch: baseBranch, subagents: { provider: 'cursor', dispatch: 'print' } }));
  return dir;
}

test('정책 기준 브랜치 develop, config develop → bootstrapCommit이 .bouncer를 커밋한다', () => {
  const dir = bootstrapRepo('develop');
  bootstrapCommit(dir, { task_facts: { base_branch: 'develop' } }, []);
  assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), '.bouncer/config.json');
  rmSync(dir, { recursive: true });
});

test('정책 task_facts.base_branch 없음 → bootstrapCommit throw base_branch missing', () => {
  const dir = bootstrapRepo('develop');
  assert.throws(() => bootstrapCommit(dir, { task_facts: {} }, []), /task_facts\.base_branch missing/);
  rmSync(dir, { recursive: true });
});

test('정책 기준 브랜치 develop, config main → bootstrapCommit throw differs from policy', () => {
  const dir = bootstrapRepo('main');
  assert.throws(() => bootstrapCommit(dir, { task_facts: { base_branch: 'develop' } }, []),
    /Bouncer bootstrap configuration differs from policy/);
  rmSync(dir, { recursive: true });
});

function keyFileIn(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'full-key-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'key');
  writeFileSync(file, 'secret');
  return file;
}

test('--timeout-minutes 생략 → configOf timeoutMinutes 180', (t) => {
  assert.equal(configOf(['--task', 'x-001', '--model', 'm', '--key-file', keyFileIn(t)]).timeoutMinutes, 180);
});

test('--timeout-minutes 241 → configOf invalid timeout', (t) => {
  assert.throws(() => configOf(['--task', 'x-001', '--model', 'm', '--key-file', keyFileIn(t),
    '--timeout-minutes', '241']), /invalid timeout/);
});

test('DeepSWE prepared → runtimeFieldsFor가 bouncer 과제 이미지 id와 agent_network를 돌려준다', (t) => {
  const calls = [];
  const config = configOf(['--task', 'deepswe-x-001', '--model', 'm', '--key-file', keyFileIn(t)]);
  const fields = runtimeFieldsFor(config, { docker_image: 'img:1' }, { runDocker: (args) => { calls.push(args); return 'sha256:abc'; } });
  assert.deepEqual(fields, { image_id: 'sha256:abc', deviations: ['agent_network'] });
  assert.equal(calls[0].at(-1), 'bouncer-benchmark-deepswe-deepswe-x-001-bouncer:local');
});

test('prepared null → runtimeFieldsFor가 기존 bouncer 이미지 태그와 빈 deviations', (t) => {
  const calls = [];
  const config = configOf(['--task', 'fastify-001', '--model', 'm', '--key-file', keyFileIn(t)]);
  const fields = runtimeFieldsFor(config, null, { runDocker: (args) => { calls.push(args); return 'sha256:def'; } });
  assert.deepEqual(fields, { image_id: 'sha256:def', deviations: [] });
  assert.equal(calls[0].at(-1), 'bouncer-benchmark-cursor-bouncer:local');
});

const GRADED = { judge_status: 'graded', score: 100, outcome_success: true, reward: 1, f2p_passed: 13, f2p_total: 13,
  p2p_passed: 5, p2p_total: 5, apply_failed: false };

test('unjudgeable verifier.json → recorded without throwing, reward null', () => {
  const record = {};
  applyVerdict(record, { verifierJson: { judge_status: 'unjudgeable', score: null, outcome_success: null, reward: null,
    error: 'verifier timeout' } });
  assert.equal(record.judge_status, 'unjudgeable');
  assert.equal(record.reward, null);
});

test('missing verifier.json → throws external verifier failed', () => {
  assert.throws(() => applyVerdict({}, { verifierJson: null }), /external verifier failed: verifier\.json missing/);
});

test('graded verifier.json → nine verdict fields copied to the record', () => {
  const record = {};
  applyVerdict(record, { verifierJson: { ...GRADED, error: null } });
  assert.deepEqual(record, GRADED);
});
