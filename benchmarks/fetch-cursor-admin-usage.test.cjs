'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { fetchPages, timeRange } = require('./fetch-cursor-admin-usage.cjs');

test('fetches every Admin API page with a bounded date filter', async () => {
  const calls = [];
  const events = await fetchPages('key_test', { startDate: 1, endDate: 2 }, async (url, options) => {
    assert.equal(url, 'https://api.cursor.com/teams/filtered-usage-events');
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    calls.push(body);
    return { ok: true, json: async () => ({
      pagination: { currentPage: body.page, numPages: 2 },
      usageEvents: [{ conversationId: `session-${body.page}` }],
    }) };
  });
  assert.deepEqual(calls.map((call) => call.page), [1, 2]);
  assert.equal(calls[0].pageSize, 1000);
  assert.equal(events.length, 2);
});

test('derives an hourly padded window from saved run timestamps', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cursor-window-'));
  try {
    writeFileSync(path.join(dir, 'run.json'), JSON.stringify({
      started_at: '2026-09-29T00:00:00.000Z', ended_at: '2026-09-29T00:30:00.000Z',
    }));
    assert.deepEqual(timeRange([dir]), {
      startDate: Date.parse('2026-09-28T23:00:00.000Z'),
      endDate: Date.parse('2026-09-29T01:30:00.000Z'),
    });
  } finally {
    rmSync(dir, { recursive: true });
  }
});
