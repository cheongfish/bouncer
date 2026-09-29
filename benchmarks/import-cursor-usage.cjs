#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { normalizeUsage } = require('./usage.cjs');

function options(argv) {
  if (argv.length !== 4 || argv[0] !== '--run-dir' || argv[2] !== '--events') {
    throw new Error('usage: import-cursor-usage.cjs --run-dir DIR --events ADMIN_API_JSON');
  }
  return { runDir: path.resolve(argv[1]), eventsFile: path.resolve(argv[3]) };
}

function pagesOf(raw) {
  const pages = Array.isArray(raw) ? raw : [raw];
  if (!pages.length || pages.some((page) => !Array.isArray(page?.usageEvents))) {
    throw new Error('expected Cursor Admin API usageEvents response or array of pages');
  }
  const pageNumbers = pages.map((page) => page.pagination?.currentPage);
  const expected = pages[0].pagination?.numPages;
  if (!Number.isInteger(expected) || pages.length !== expected
    || pageNumbers.some((number, index) => number !== index + 1)
    || pages.some((page) => page.pagination?.numPages !== expected)) {
    throw new Error('all Admin API pages are required in page order');
  }
  return pages;
}

function entrypoints(runDir, record) {
  const result = [];
  if (typeof record.session_id === 'string' || typeof record.cursor_session_id === 'string') {
    result.push({ name: record.stage ?? record.condition ?? 'single_run',
      session_id: record.session_id ?? record.cursor_session_id,
      record, file: path.join(runDir, 'run.json') });
  }
  for (const name of ['01-init', '02-plan', '03-run', '04-finalize']) {
    const file = path.join(runDir, name, 'run.json');
    if (!existsSync(file)) continue;
    const child = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof child.session_id === 'string') {
      result.push({ name, session_id: child.session_id, record: child, file });
    }
  }
  const ids = result.map((entry) => entry.session_id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate Cursor session ID across entrypoints');
  return result;
}

function summarize(events) {
  const tokens = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let chargedCents = 0;
  let allTokens = true;
  let allCosts = true;
  for (const event of events) {
    const reported = normalizeUsage(event.tokenUsage);
    if (!reported || ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens']
      .some((field) => !Object.hasOwn(reported, field))) allTokens = false;
    else for (const field of Object.keys(tokens)) tokens[field] += reported[field];
    if (typeof event.chargedCents === 'number' && Number.isFinite(event.chargedCents)) {
      chargedCents += event.chargedCents;
    } else allCosts = false;
  }
  return {
    status: events.length && allTokens ? 'reported' : 'incomplete',
    source: 'cursor-admin-api', event_count: events.length,
    tokens: events.length && allTokens ? { ...tokens,
      totalTokens: Object.values(tokens).reduce((sum, value) => sum + value, 0) } : null,
    charged_cents: events.length && allCosts ? chargedCents : null,
  };
}

function applyUsage(runDir, events, retrievedAt = null) {
  const record = JSON.parse(readFileSync(path.join(runDir, 'run.json'), 'utf8'));
  const entries = entrypoints(runDir, record);
  if (!entries.length) throw new Error('run has no Cursor session ID');
  const byEntrypoint = {};
  for (const entry of entries) {
    const usage = summarize(events.filter((event) => event.conversationId === entry.session_id));
    byEntrypoint[entry.name] = {
      conversation_id: entry.session_id,
      execution_status: entry.record.status ?? null,
      duration_ms: entry.record.started_at && entry.record.ended_at
        ? Date.parse(entry.record.ended_at) - Date.parse(entry.record.started_at) : null,
      ...usage,
    };
    if (entry.record !== record) {
      entry.record.admin_api_usage = byEntrypoint[entry.name];
      writeFileSync(entry.file, `${JSON.stringify(entry.record, null, 2)}\n`);
    }
  }
  const ids = entries.map((entry) => entry.session_id);
  record.admin_api_usage = {
    conversation_ids: ids,
    entrypoints: byEntrypoint,
    retrieved_at: retrievedAt,
    ...summarize(events.filter((event) => ids.includes(event.conversationId))),
  };
  if (Object.values(byEntrypoint).some((entry) => entry.status !== 'reported')) {
    record.admin_api_usage.status = 'incomplete';
    record.admin_api_usage.tokens = null;
  }
  if (Object.values(byEntrypoint).some((entry) => !entry.event_count
    || !Number.isFinite(entry.charged_cents))) {
    record.admin_api_usage.charged_cents = null;
  }
  writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify(record, null, 2)}\n`);
  return record.admin_api_usage;
}

function main() {
  const { runDir, eventsFile } = options(process.argv.slice(2));
  const pages = pagesOf(JSON.parse(readFileSync(eventsFile, 'utf8')));
  const result = applyUsage(runDir, pages.flatMap((page) => page.usageEvents));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { applyUsage, entrypoints, pagesOf, summarize };
