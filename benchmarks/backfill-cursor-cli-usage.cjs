#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { usageFromCursorStream } = require('./usage.cjs');

function backfill(runDir) {
  const recordFile = path.join(runDir, 'run.json');
  const streamFile = path.join(runDir, 'cursor.stdout.jsonl');
  if (!existsSync(recordFile) || !existsSync(streamFile)) return null;
  const record = JSON.parse(readFileSync(recordFile, 'utf8'));
  const usage = usageFromCursorStream(readFileSync(streamFile, 'utf8'));
  if (usage.status !== 'reported') return null;
  if (record.usage?.status === 'reported') return { run_dir: runDir, status: 'already_reported' };
  record.usage = usage;
  writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`);
  return { run_dir: runDir, status: 'backfilled', tokens: usage.tokens };
}

function main(argv) {
  if (argv.length !== 2 || argv[0] !== '--runs-root') {
    throw new Error('usage: backfill-cursor-cli-usage.cjs --runs-root DIR');
  }
  const root = path.resolve(argv[1]);
  const results = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => backfill(path.join(root, entry.name))).filter(Boolean);
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { backfill };
