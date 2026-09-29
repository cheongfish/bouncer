#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');
const { applyUsage, entrypoints } = require('./import-cursor-usage.cjs');

const endpoint = 'https://api.cursor.com/teams/filtered-usage-events';

function options(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    if (!['--admin-key-file', '--runs-root', '--run-dir', '--email'].includes(name)
      || !argv[index + 1] || result[name]) throw new Error(`invalid option: ${name}`);
    result[name] = argv[index + 1];
  }
  if (!result['--admin-key-file'] || Boolean(result['--runs-root']) === Boolean(result['--run-dir'])) {
    throw new Error('use --admin-key-file FILE with exactly one of --runs-root DIR or --run-dir DIR');
  }
  return result;
}

function runDirectories(config) {
  if (config['--run-dir']) return [path.resolve(config['--run-dir'])];
  const root = path.resolve(config['--runs-root']);
  return readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((dir) => existsSync(path.join(dir, 'run.json')));
}

function timeRange(runDirs) {
  const times = [];
  for (const runDir of runDirs) {
    const record = JSON.parse(readFileSync(path.join(runDir, 'run.json'), 'utf8'));
    const files = [path.join(runDir, 'run.json')];
    for (const name of ['01-init', '02-plan', '03-run', '04-finalize']) {
      const child = path.join(runDir, name, 'run.json');
      if (existsSync(child)) files.push(child);
    }
    for (const file of files) {
      const item = file === files[0] ? record : JSON.parse(readFileSync(file, 'utf8'));
      for (const field of ['started_at', 'ended_at']) {
        if (item[field] && Number.isFinite(Date.parse(item[field]))) times.push(Date.parse(item[field]));
      }
      const transcript = path.join(path.dirname(file), 'acp.jsonl');
      if (existsSync(transcript)) {
        for (const line of readFileSync(transcript, 'utf8').split('\n')) {
          if (!line.trim()) continue;
          let entry;
          try { entry = JSON.parse(line); } catch { continue; }
          if (entry.at && Number.isFinite(Date.parse(entry.at))) times.push(Date.parse(entry.at));
        }
      }
    }
  }
  if (!times.length) throw new Error('selected runs have no recorded start or end time');
  // Cursor groups usage by hour; include the adjacent hour at either end.
  return { startDate: Math.min(...times) - 3_600_000, endDate: Math.max(...times) + 3_600_000 };
}

async function fetchPages(key, query, request = globalThis.fetch) {
  const pages = [];
  let expectedPages = null;
  for (let page = 1; ; page++) {
    const response = await request(endpoint, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
        'Content-Type': 'application/json' },
      body: JSON.stringify({ ...query, page, pageSize: 1000 }),
      signal: globalThis.AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Cursor Admin API returned HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.usageEvents) || body.pagination?.currentPage !== page
      || !Number.isInteger(body.pagination?.numPages) || body.pagination.numPages < 0) {
      throw new Error(`invalid Cursor Admin API response on page ${page}`);
    }
    if (expectedPages === null) expectedPages = body.pagination.numPages;
    else if (body.pagination.numPages !== expectedPages) {
      throw new Error('Cursor Admin API pagination changed during retrieval');
    }
    pages.push(body);
    if (page >= expectedPages) break;
    if (page >= 1000) throw new Error('Cursor Admin API page limit exceeded');
  }
  return pages.flatMap((page) => page.usageEvents);
}

async function main() {
  const config = options(process.argv.slice(2));
  const keyFile = path.resolve(config['--admin-key-file']);
  if (!existsSync(keyFile) || !statSync(keyFile).isFile()) throw new Error('Admin API key file missing');
  const key = readFileSync(keyFile, 'utf8').trim();
  if (!key.startsWith('key_')) throw new Error('expected a Cursor Admin API key (key_...)');
  const dirs = runDirectories(config).filter((dir) => {
    const record = JSON.parse(readFileSync(path.join(dir, 'run.json'), 'utf8'));
    return entrypoints(dir, record).length > 0;
  });
  if (!dirs.length) throw new Error('no benchmark sessions found');
  const query = timeRange(dirs);
  if (config['--email']) query.email = config['--email'];
  const events = await fetchPages(key, query);
  const retrievedAt = new Date().toISOString();
  const results = dirs.map((dir) => {
    const usage = applyUsage(dir, events, retrievedAt);
    return { run_dir: dir, status: usage.status, event_count: usage.event_count,
      charged_cents: usage.charged_cents, entrypoints: usage.entrypoints };
  });
  process.stdout.write(`${JSON.stringify({ query, retrieved_at: retrievedAt, results }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}

module.exports = { fetchPages, options, timeRange };
