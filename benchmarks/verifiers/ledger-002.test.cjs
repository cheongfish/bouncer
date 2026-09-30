'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const verifier = path.join(__dirname, 'ledger-002.cjs');
const testdata = path.join(__dirname, 'testdata', 'ledger-002');

function grade(dir, patchFile) {
  const output = path.join(dir, `${path.basename(patchFile)}.json`);
  const run = spawnSync(process.execPath, [verifier, '--patch', patchFile, '--work-dir',
    path.join(dir, path.basename(patchFile, '.patch')), '--output', output], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(result.judge_status, 'graded', result.error);
  return { score: result.score, failed: result.criteria.filter((check) => !check.pass).map((check) => check.id) };
}

test('ledger-002 verifier separates the base commit, correct, and wrong implementations', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ledger-002-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const empty = path.join(dir, 'base.patch');
  writeFileSync(empty, '');
  assert.equal(grade(dir, empty).score, 7);
  const expected = {
    'correct-exit-code-return': { score: 100, failed: [] },
    'correct-process-exit-code': { score: 100, failed: [] },
    'wrong-locale-sort': { score: 90, failed: ['B2'] },
    'wrong-exit-always-zero': { score: 90, failed: ['X1'] },
    'wrong-budget-values-unchecked': { score: 95, failed: ['V3'] },
    'wrong-spent-only': { score: 45, failed: ['B1', 'B2', 'B3', 'B6', 'X1', 'X2'] },
  };
  for (const [name, want] of Object.entries(expected)) {
    assert.deepEqual(grade(dir, path.join(testdata, `${name}.patch`)), want, name);
  }
});
