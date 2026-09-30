'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const verifier = path.join(__dirname, 'ledger-004.cjs');
const testdata = path.join(__dirname, 'testdata', 'ledger-004');

function grade(dir, patchFile) {
  const output = path.join(dir, `${path.basename(patchFile)}.json`);
  const run = spawnSync(process.execPath, [verifier, '--patch', patchFile, '--work-dir',
    path.join(dir, path.basename(patchFile, '.patch')), '--output', output], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(result.judge_status, 'graded', result.error);
  return { score: result.score, failed: result.criteria.filter((check) => !check.pass).map((check) => check.id) };
}

test('ledger-004 verifier separates the base commit, correct, and wrong implementations', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ledger-004-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const empty = path.join(dir, 'base.patch');
  writeFileSync(empty, '');
  assert.deepEqual(grade(dir, empty).score, 10);
  assert.deepEqual(grade(dir, path.join(testdata, 'correct-parser-alias.patch')), { score: 100, failed: [] });
  assert.deepEqual(grade(dir, path.join(testdata, 'correct-cli-normalize.patch')), { score: 100, failed: [] });
  assert.deepEqual(grade(dir, path.join(testdata, 'wrong-list-only.patch')), { score: 65, failed: ['S2', 'S3', 'S4'] });
  assert.deepEqual(grade(dir, path.join(testdata, 'wrong-duplicate-ignored.patch')), { score: 90, failed: ['E2'] });
});

test('ledger-004 verifier reports a patch that does not apply as unjudgeable', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ledger-004-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const broken = path.join(dir, 'broken.patch');
  writeFileSync(broken, 'diff --git a/nope.js b/nope.js\n--- a/nope.js\n+++ b/nope.js\n@@ -1 +1 @@\n-x\n+y\n');
  const run = spawnSync(process.execPath, [verifier, '--patch', broken, '--work-dir', path.join(dir, 'w')],
    { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.equal(JSON.parse(run.stdout).judge_status, 'unjudgeable');
});
