'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  applyWorkspaceSetup, bundleFor, checkCard, loadCard, loadRunnableCard, renderArgv, verifierInvocation,
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
  assert.ok(ids.includes('ledger-001') && ids.includes('ledger-003'));
  for (const id of ids) {
    const task = loadCard(id);
    assert.equal(task.card.id, id);
    assert.ok(task.requestText.length > 0);
    assert.ok(existsSync(bundleFor(task.card.base_commit)));
  }
});

test('a card whose request file changed is rejected', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'task-card-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = readFileSync(path.join(tasksDir, 'ledger-002.yaml'), 'utf8');
  writeFileSync(path.join(dir, 'ledger-002.yaml'),
    source.replace(/user_request_sha256: "[0-9a-f]{64}"/, `user_request_sha256: ${'f'.repeat(64)}`));
  assert.throws(() => loadCard('ledger-002', dir), /does not match user_request_sha256/);
});

test('checkCard rejects inline and file requests together and unknown fields', () => {
  const { card } = loadCard('ledger-002');
  assert.throws(() => checkCard({ ...card, user_request: 'x' }, 'ledger-002'), /either user_request/);
  assert.throws(() => checkCard({ ...card, bundle: 'x' }, 'ledger-002'), /unknown card fields bundle/);
  assert.throws(() => checkCard({ ...card, failure_opportunities: [{ id: 'x' }] }, 'ledger-002'),
    /general tasks have no failure_opportunities/);
});

test('renderArgv replaces known placeholders and stops on unknown or missing ones', () => {
  assert.deepEqual(renderArgv(['--output', '{result_json}', 'x={eval_dir}'], { result_json: '/r.json', eval_dir: '/e' }),
    ['--output', '/r.json', 'x=/e']);
  assert.throws(() => renderArgv(['{result}'], {}), /unknown verifier placeholder \{result\}/);
  assert.throws(() => renderArgv(['{final_repo}'], {}), /no value for verifier placeholder/);
});

test('verifierInvocation maps card argv to the verifier container', () => {
  const { card } = loadCard('ledger-003');
  const invocation = verifierInvocation(card);
  assert.deepEqual(invocation.composeArgs, ['--entrypoint', 'node', 'verifier', 'verifiers/ledger-003.cjs',
    '--final-repo', '/workspace', '--work-dir', '/result/verify-work', '--output', '/result/verifier.json']);
  assert.equal(invocation.timeoutMs, 180000);
});

test('loadRunnableCard refuses a task whose verifier is not written', () => {
  const missing = ['ledger-002', 'ledger-003', 'ledger-004']
    .filter((id) => !existsSync(path.join(__dirname, 'verifiers', `${id}.cjs`)));
  for (const id of missing) assert.throws(() => loadRunnableCard(id), /verifier not found/);
  assert.match(loadRunnableCard('ledger-001').bundle, /ledger-cli\.bundle$/);
});

test('applyWorkspaceSetup stages the ledger-003 WIP and copies the stale report', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'task-setup-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { card } = loadCard('ledger-003');
  const work = path.join(dir, 'work');
  git(['clone', '--quiet', bundleFor(card.base_commit), work], dir);
  const record = applyWorkspaceSetup(work, card);
  assert.equal(git(['diff', '--cached', '--name-only'], work), 'src/format.js\ntest/format.test.js');
  assert.equal(git(['status', '--porcelain', '--untracked-files=all'], work),
    'M  src/format.js\nM  test/format.test.js\n?? ci-artifacts/test-report.txt');
  assert.equal(record.steps.length, 2);
  assert.match(record.index_tree, /^[0-9a-f]{40}$/);
});

test('applyWorkspaceSetup rejects targets outside the workspace', () => {
  const card = { id: 'x-001', workspace_setup: [{ copy: 'fixtures/ledger-003.test-report.txt', to: '../escape.txt' }] };
  assert.throws(() => applyWorkspaceSetup(tmpdir(), card), /relative path without \.\./);
});
