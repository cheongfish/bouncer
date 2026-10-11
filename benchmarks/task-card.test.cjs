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
  applyWorkspaceSetup, bundleFor, checkCard, loadCard, missingVerifierScripts, renderArgv, verifierInvocation,
} = require('./task-card.cjs');

const tasksDir = path.join(__dirname, 'tasks');

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('every task card loads and matches its request file hash', () => {
  const ids = readdirSync(tasksDir).filter((name) => /^[a-z][a-z0-9-]*-[0-9]{3}\.yaml$/.test(name))
    .map((name) => name.slice(0, -'.yaml'.length));
  assert.ok(ids.includes('fastify-001'));
  for (const id of ids) {
    const task = loadCard(id);
    assert.equal(task.card.id, id);
    assert.ok(task.requestText.length > 0);
    // 상류 과제 bundle은 build-upstream-task.cjs가 Git 무시 경로에 만들므로 CI checkout에는 없다.
    if (existsSync(path.join(__dirname, 'upstream', `${id}.json`))) continue;
    assert.ok(existsSync(bundleFor(task.card.base_commit)));
  }
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
