'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  applyWorkspaceSetup, bundleFor, checkCard, listCardIds, loadCard, missingVerifierScripts, renderArgv, verifierInvocation,
} = require('./task-card.cjs');
const yaml = require('js-yaml');

const tasksDir = path.join(__dirname, 'tasks');

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('every task card loads and matches its request file hash', () => {
  const { ready, unprepared } = listCardIds(tasksDir);
  assert.ok(ready.includes('fastify-001'));
  for (const id of ready) {
    const task = loadCard(id);
    assert.equal(task.card.id, id);
    assert.ok(task.requestText.length > 0);
    // 상류 과제 bundle은 build-upstream-task.cjs가 Git 무시 경로에 만들므로 CI checkout에는 없다.
    if (existsSync(path.join(__dirname, 'upstream', `${id}.json`))) continue;
    assert.ok(existsSync(bundleFor(task.card.base_commit)));
  }
  // 준비되지 않은 DeepSWE 카드는 지시문이 gitignore돼 loadCard를 못 하므로 카드 구조 검사만 CI에서 받는다.
  for (const id of unprepared) checkCard(yaml.load(readFileSync(path.join(tasksDir, `${id}.yaml`), 'utf8')), id);
});

test('a card whose request file changed is rejected', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'task-card-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = readFileSync(path.join(tasksDir, 'fastify-001.yaml'), 'utf8');
  writeFileSync(path.join(dir, 'fastify-001.yaml'),
    source.replace(/user_request_sha256: "[0-9a-f]{64}"/, `user_request_sha256: ${'f'.repeat(64)}`));
  assert.throws(() => loadCard('fastify-001', dir), /does not match user_request_sha256/);
});

test('checkCard rejects inline and file requests together and unknown fields', () => {
  const { card } = loadCard('fastify-001');
  assert.throws(() => checkCard({ ...card, user_request: 'x' }, 'fastify-001'), /either user_request/);
  assert.throws(() => checkCard({ ...card, bundle: 'x' }, 'fastify-001'), /unknown card fields bundle/);
  assert.throws(() => checkCard({ ...card, failure_opportunities: [{ id: 'x' }] }, 'fastify-001'),
    /general tasks have no failure_opportunities/);
});

test('renderArgv replaces known placeholders and stops on unknown or missing ones', () => {
  assert.deepEqual(renderArgv(['--output', '{result_json}', 'x={eval_dir}'], { result_json: '/r.json', eval_dir: '/e' }),
    ['--output', '/r.json', 'x=/e']);
  assert.throws(() => renderArgv(['{result}'], {}), /unknown verifier placeholder \{result\}/);
  assert.throws(() => renderArgv(['{final_repo}'], {}), /no value for verifier placeholder/);
});

test('fastify-001 card → verifier container argv and 600000 ms timeout', () => {
  const { card } = loadCard('fastify-001');
  const invocation = verifierInvocation(card);
  assert.deepEqual(invocation.composeArgs, ['--entrypoint', 'node', 'verifier', 'verifiers/upstream-tests.cjs',
    '--config', 'upstream/fastify-001.json', '--patch', '/result/diff.patch', '--work-dir', '/result/verify-work',
    '--output', '/result/verifier.json']);
  assert.equal(invocation.timeoutMs, 600000);
});

test('card whose verifier script is not written → missingVerifierScripts lists it; fastify-001 has none missing', () => {
  const { card } = loadCard('fastify-001');
  assert.deepEqual(missingVerifierScripts(card), []);
  const broken = { ...card, external_verifiers: [{ ...card.external_verifiers[0], argv: ['node', 'verifiers/not-written.cjs'] }] };
  assert.deepEqual(missingVerifierScripts(broken), ['verifiers/not-written.cjs']);
});

// 설정 원본은 benchmarks/ 기준 상대 경로로만 읽히므로, 원본 파일만 benchmarks/ 아래 임시 디렉터리에 두고
// 작업 저장소는 시스템 임시 디렉터리에 만든다. 둘 다 t.after에서 지운다.
function setupFixture(t) {
  const repoParent = mkdtempSync(path.join(tmpdir(), 'task-setup-'));
  const sourceDir = mkdtempSync(path.join(__dirname, '.task-setup-src-'));
  t.after(() => {
    rmSync(repoParent, { recursive: true, force: true });
    rmSync(sourceDir, { recursive: true, force: true });
  });
  const work = path.join(repoParent, 'work');
  mkdirSync(work);
  git(['init', '--quiet'], work);
  git(['config', 'user.email', 't@example.com'], work);
  git(['config', 'user.name', 't'], work);
  writeFileSync(path.join(work, 'a.txt'), 'one\n');
  git(['add', 'a.txt'], work);
  git(['commit', '--quiet', '-m', 'base'], work);
  // 작업 트리를 바꿔 patch를 만든 뒤 되돌려, 카드가 적용할 사전 상태를 patch 파일로만 남긴다.
  writeFileSync(path.join(work, 'a.txt'), 'two\n');
  const patch = path.join(sourceDir, 'wip.patch');
  writeFileSync(patch, spawnSync('git', ['diff'], { cwd: work, encoding: 'utf8' }).stdout);
  git(['checkout', '--', 'a.txt'], work);
  writeFileSync(path.join(sourceDir, 'report.txt'), 'stale report\n');
  return { work, rel: (name) => path.relative(__dirname, path.join(sourceDir, name)) };
}

test('apply_index_patch and copy steps → staged patch and copied file, with an index tree record', (t) => {
  const { work, rel } = setupFixture(t);
  const card = {
    id: 'x-001',
    workspace_setup: [{ apply_index_patch: rel('wip.patch') }, { copy: rel('report.txt'), to: 'ci-artifacts/report.txt' }],
  };
  const record = applyWorkspaceSetup(work, card);
  assert.equal(git(['diff', '--cached', '--name-only'], work), 'a.txt');
  assert.equal(git(['status', '--porcelain', '--untracked-files=all'], work), 'M  a.txt\n?? ci-artifacts/report.txt');
  assert.equal(record.steps.length, 2);
  assert.match(record.index_tree, /^[0-9a-f]{40}$/);
});

test('card without workspace_setup → no setup record', (t) => {
  const { work } = setupFixture(t);
  assert.equal(applyWorkspaceSetup(work, { id: 'x-001' }), null);
});

test('copy target outside the workspace → rejected', () => {
  const card = { id: 'x-001', workspace_setup: [{ copy: 'tasks/fastify-001.prd.md', to: '../escape.txt' }] };
  assert.throws(() => applyWorkspaceSetup(tmpdir(), card), /relative path without \.\./);
});

// restore_untracked: 임시 root에 fixtures/deepswe/<id>/{untracked.tar,prepared.json}를 두고 임시 git 저장소에 적용한다.
// tar 항목 목록·브랜치 확인이 계약 자체라 실제 git·tar를 쓴다.
function restoreFixture(t, { branch = 'develop', preparedBranch = branch, tarEntries } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'task-restore-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const work = path.join(base, 'work');
  mkdirSync(work);
  git(['init', '--quiet', '-b', branch], work);
  git(['config', 'user.email', 't@example.com'], work);
  git(['config', 'user.name', 't'], work);
  writeFileSync(path.join(work, 'a.txt'), 'one\n');
  git(['add', 'a.txt'], work);
  git(['commit', '--quiet', '-m', 'base'], work);
  const root = path.join(base, 'root');
  const dir = path.join(root, 'fixtures', 'deepswe', 'x-001');
  mkdirSync(dir, { recursive: true });
  const stage = path.join(base, 'stage');
  mkdirSync(path.join(stage, 'sub'), { recursive: true });
  writeFileSync(path.join(stage, 'sub', 'b.txt'), 'restored\n');
  const entries = tarEntries ?? ['sub/b.txt'];
  const made = spawnSync('tar', ['-cPf', path.join(dir, 'untracked.tar'), '-C', stage, ...entries]);
  assert.equal(made.status, 0, String(made.stderr));
  writeFileSync(path.join(dir, 'prepared.json'),
    JSON.stringify({ base_branch: preparedBranch, untracked_paths: ['sub/b.txt'] }));
  return { work, root, dir };
}

const restoreCard = { id: 'x-001', workspace_setup: [{ restore_untracked: 'x-001' }] };

test('branch develop checked out in a bundle clone → symbolic-ref is develop', (t) => {
  const { work } = restoreFixture(t);
  const bundle = path.join(path.dirname(work), 'b.bundle');
  git(['bundle', 'create', bundle, 'HEAD', 'develop'], work);
  const clone = path.join(path.dirname(work), 'w');
  git(['clone', '--quiet', bundle, clone], path.dirname(work));
  assert.equal(git(['symbolic-ref', '--short', 'HEAD'], clone), 'develop');
});

test('restore_untracked on a clone → untracked files restored, index tree unchanged, record has sha and paths', (t) => {
  const { work, root } = restoreFixture(t);
  const before = git(['write-tree'], work);
  const record = applyWorkspaceSetup(work, restoreCard, root);
  assert.equal(readFileSync(path.join(work, 'sub', 'b.txt'), 'utf8'), 'restored\n');
  assert.equal(record.index_tree, before);
  assert.equal(record.steps[0].kind, 'restore_untracked');
  assert.match(record.steps[0].source_sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(record.steps[0].paths, ['sub/b.txt']);
});

test('archive entry with .. → rejected before extraction', (t) => {
  const { work, root } = restoreFixture(t, { tarEntries: ['../stage/sub/b.txt'] });
  assert.throws(() => applyWorkspaceSetup(work, restoreCard, root), /untracked archive entry must be a relative path without \.\./);
});

test('no untracked archive → rejected with the prepare command', (t) => {
  const { work, root, dir } = restoreFixture(t);
  rmSync(path.join(dir, 'untracked.tar'));
  assert.throws(() => applyWorkspaceSetup(work, restoreCard, root), /untracked archive missing; run node benchmarks\/prepare-deepswe-task\.cjs/);
});

test('restore_untracked value that is not a card id → rejected', () => {
  const card = { id: 'x-001', workspace_setup: [{ restore_untracked: '../x' }] };
  assert.throws(() => applyWorkspaceSetup(tmpdir(), card), /restore_untracked must name a card id/);
});

test('workspace on main but prepared base_branch develop → rejected', (t) => {
  const { work, root } = restoreFixture(t, { branch: 'main', preparedBranch: 'develop' });
  assert.throws(() => applyWorkspaceSetup(work, restoreCard, root), /differs from prepared base_branch/);
});

test('bundle under fixtures/deepswe of the given root → bundleFor finds it', (t) => {
  const { work, root } = restoreFixture(t);
  const bundle = path.join(root, 'fixtures', 'deepswe', 'x-001.bundle');
  git(['bundle', 'create', bundle, 'HEAD', 'develop'], work);
  assert.equal(bundleFor(git(['rev-parse', 'HEAD'], work), root), bundle);
});

test('restore_untracked card without prepared.json → listed as unprepared, others ready', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'task-list-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'plain-001.yaml'), 'id: plain-001\n');
  writeFileSync(path.join(dir, 'x-001.yaml'), 'id: x-001\nworkspace_setup:\n  - restore_untracked: x-001\n');
  const root = path.join(dir, 'root');
  assert.deepEqual(listCardIds(dir, root), { ready: ['plain-001'], unprepared: ['x-001'] });
  mkdirSync(path.join(root, 'fixtures', 'deepswe', 'x-001'), { recursive: true });
  writeFileSync(path.join(root, 'fixtures', 'deepswe', 'x-001', 'prepared.json'), '{}');
  assert.deepEqual(listCardIds(dir, root), { ready: ['plain-001', 'x-001'], unprepared: [] });
});

test('unprepared card with an unknown field → checkCard rejects it through the loop path', () => {
  const { card } = loadCard('fastify-001');
  const unprepared = { ...card, workspace_setup: [{ restore_untracked: 'fastify-001' }], extra: 1 };
  assert.throws(() => checkCard(unprepared, 'fastify-001'), /unknown card fields extra/);
});
