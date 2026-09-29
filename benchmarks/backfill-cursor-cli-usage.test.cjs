'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { backfill } = require('./backfill-cursor-cli-usage.cjs');

test('recovers reported CLI usage without changing grading results', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cursor-backfill-'));
  try {
    writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ status: 'completed', score: 100,
      usage: 'unknown' }));
    writeFileSync(path.join(dir, 'cursor.stdout.jsonl'), JSON.stringify({ type: 'result',
      usage: { inputTokens: 7, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 0 } }));
    assert.equal(backfill(dir).status, 'backfilled');
    const record = JSON.parse(readFileSync(path.join(dir, 'run.json'), 'utf8'));
    assert.equal(record.usage.tokens.inputTokens, 7);
    assert.equal(record.score, 100);
    assert.equal(backfill(dir).status, 'already_reported');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
