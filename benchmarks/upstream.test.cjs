'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { checkCard } = require('./task-card.cjs');
const { loadUpstreamConfig, regressionFiles, topLevelCases } = require('./verifiers/upstream-lib.cjs');

test('reads only top-level TAP results and marks skips', () => {
  const tap = [
    'TAP version 13',
    '# Subtest: fast handler completes normally with 200',
    '    ok 1 - nested assertion',
    'ok 1 - fast handler completes normally with 200',
    'not ok 2 - slow handler returns 503 with FST_ERR_HANDLER_TIMEOUT',
    'ok 3 - timer is cleaned up after fast response (no leak) # SKIP test name does not match pattern',
    '# tests 3',
  ].join('\n');
  assert.deepEqual(topLevelCases(tap), [
    { name: 'fast handler completes normally with 200', pass: true, skipped: false },
    { name: 'slow handler returns 503 with FST_ERR_HANDLER_TIMEOUT', pass: false, skipped: false },
    { name: 'timer is cleaned up after fast response (no leak)', pass: true, skipped: true },
  ]);
});

test('an upstream config pins its snapshot and spends exactly 100 points', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'upstream-config-'));
  const file = path.join(dir, 'c.json');
  const config = { task_id: 'demo-001', snapshot: { commit: 'a'.repeat(40) }, criteria: [{ points: 60 }, { points: 40 }] };
  writeFileSync(file, JSON.stringify(config));
  assert.equal(loadUpstreamConfig(file).task_id, 'demo-001');
  writeFileSync(file, JSON.stringify({ ...config, criteria: [{ points: 60 }] }));
  assert.throws(() => loadUpstreamConfig(file), /add up to 60/);
  writeFileSync(file, JSON.stringify({ ...config, snapshot: { commit: '' } }));
  assert.throws(() => loadUpstreamConfig(file), /snapshot.commit/);
  rmSync(dir, { recursive: true });
});

test('regression files exclude hidden tests and node_modules', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'upstream-files-'));
  for (const rel of ['test/a.test.js', 'test/internals/b.test.js', 'test/hidden.test.js', 'test/helper.js',
    'test/node_modules/x.test.js', 'test/types/c.test-d.ts']) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), '');
  }
  const config = { hidden_tests: ['test/hidden.test.js'], regression: { roots: ['test'], suffixes: ['.test.js'] } };
  assert.deepEqual(regressionFiles(config, dir), ['test/a.test.js', 'test/internals/b.test.js']);
  rmSync(dir, { recursive: true });
});

test('a card may install an upstream task\'s pinned dependencies', () => {
  const card = {
    id: 'demo-001', set: 'general', benchmark_version: 'upstream-v1', base_commit: 'a'.repeat(40),
    user_request: 'x', allowed_paths: ['lib/**'], forbidden_paths: ['.git/**'], failure_opportunities: [],
    workspace_setup: [{ install_dependencies: 'demo-001' }],
    external_verifiers: [{ id: 'v', argv: ['node', 'verifiers/upstream-tests.cjs'], timeout_ms: 1000 }],
    success_checklist: ['x'], manual_rubric: 'demo-001', evaluator_facts: {},
  };
  assert.doesNotThrow(() => checkCard(card, 'demo-001'));
  assert.throws(() => checkCard({ ...card, workspace_setup: [{ install_dependencies: '../x' }] }, 'demo-001'),
    /install_dependencies names an upstream task/);
});
