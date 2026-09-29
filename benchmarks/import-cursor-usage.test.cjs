'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pagesOf, summarize } = require('./import-cursor-usage.cjs');

test('requires all Admin API pages before attributing usage', () => {
  const first = { pagination: { currentPage: 1, numPages: 2 }, usageEvents: [] };
  assert.throws(() => pagesOf(first), /all Admin API pages/);
  assert.equal(pagesOf([first, { pagination: { currentPage: 2, numPages: 2 }, usageEvents: [] }]).length, 2);
});

test('sums billed token events and does not invent missing counts', () => {
  const event = { tokenUsage: { inputTokens: 2, outputTokens: 3,
    cacheReadTokens: 5, cacheWriteTokens: 7 }, chargedCents: 1.25 };
  assert.deepEqual(summarize([event, event]), {
    status: 'reported', source: 'cursor-admin-api', event_count: 2,
    tokens: { inputTokens: 4, outputTokens: 6, cacheReadTokens: 10,
      cacheWriteTokens: 14, totalTokens: 34 }, charged_cents: 2.5,
  });
  assert.equal(summarize([{ chargedCents: 1 }]).status, 'incomplete');
});

test('imports only events matching the run session ID', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cursor-import-'));
  try {
    writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ session_id: 'target' }));
    const eventsFile = path.join(dir, 'events.json');
    const usage = { inputTokens: 2, outputTokens: 3, cacheReadTokens: 5, cacheWriteTokens: 7 };
    writeFileSync(eventsFile, JSON.stringify({
      pagination: { currentPage: 1, numPages: 1 },
      usageEvents: [
        { conversationId: 'target', tokenUsage: usage, chargedCents: 1.25 },
        { conversationId: 'other', tokenUsage: usage, chargedCents: 99 },
      ],
    }));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'import-cursor-usage.cjs'),
      '--run-dir', dir, '--events', eventsFile], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(readFileSync(path.join(dir, 'run.json'), 'utf8'));
    assert.equal(record.admin_api_usage.event_count, 1);
    assert.equal(record.admin_api_usage.charged_cents, 1.25);
    assert.equal(record.admin_api_usage.entrypoints.single_run.tokens.totalTokens, 17);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('attributes usage and cost to each Bouncer entrypoint, including a stopped stage', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cursor-stages-'));
  try {
    writeFileSync(path.join(dir, 'run.json'), JSON.stringify({
      condition: 'bouncer-full', stages: ['01-init'], status: 'stopped',
    }));
    for (const [name, id, status] of [
      ['01-init', 'init-id', 'stage_returned'], ['02-plan', 'plan-id', 'awaiting_user_decision'],
    ]) {
      mkdirSync(path.join(dir, name));
      writeFileSync(path.join(dir, name, 'run.json'), JSON.stringify({ session_id: id, status,
        started_at: '2026-09-29T00:00:00.000Z', ended_at: '2026-09-29T00:00:01.000Z' }));
    }
    const eventsFile = path.join(dir, 'events.json');
    const tokenUsage = { inputTokens: 10, outputTokens: 2, cacheReadTokens: 5, cacheWriteTokens: 1 };
    writeFileSync(eventsFile, JSON.stringify({ pagination: { currentPage: 1, numPages: 1 },
      usageEvents: [
        { conversationId: 'init-id', tokenUsage, chargedCents: 0.2 },
        { conversationId: 'plan-id', tokenUsage, chargedCents: 0.4 },
        { conversationId: 'unrelated', tokenUsage, chargedCents: 99 },
      ] }));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'import-cursor-usage.cjs'),
      '--run-dir', dir, '--events', eventsFile], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const record = JSON.parse(readFileSync(path.join(dir, 'run.json'), 'utf8'));
    assert.equal(record.admin_api_usage.entrypoints['01-init'].charged_cents, 0.2);
    assert.equal(record.admin_api_usage.entrypoints['02-plan'].charged_cents, 0.4);
    assert.equal(record.admin_api_usage.entrypoints['02-plan'].duration_ms, 1000);
    assert.ok(Math.abs(record.admin_api_usage.charged_cents - 0.6) < 1e-10);
    assert.equal(JSON.parse(readFileSync(path.join(dir, '02-plan', 'run.json'), 'utf8'))
      .admin_api_usage.tokens.totalTokens, 18);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('preserves known billed cost when request-priced events have no token counts', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cursor-billed-'));
  try {
    writeFileSync(path.join(dir, 'run.json'), JSON.stringify({ session_id: 'request-priced' }));
    const eventsFile = path.join(dir, 'events.json');
    writeFileSync(eventsFile, JSON.stringify({ pagination: { currentPage: 1, numPages: 1 },
      usageEvents: [{ conversationId: 'request-priced', chargedCents: 3.5 }] }));
    const result = spawnSync(process.execPath, [path.join(__dirname, 'import-cursor-usage.cjs'),
      '--run-dir', dir, '--events', eventsFile], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const usage = JSON.parse(readFileSync(path.join(dir, 'run.json'), 'utf8')).admin_api_usage;
    assert.equal(usage.status, 'incomplete');
    assert.equal(usage.tokens, null);
    assert.equal(usage.charged_cents, 3.5);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
