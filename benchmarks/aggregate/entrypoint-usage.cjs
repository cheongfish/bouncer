#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');
const path = require('node:path');

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function report(records) {
  const groups = new Map();
  for (const record of records) {
    for (const [name, entry] of Object.entries(record.admin_api_usage?.entrypoints ?? {})) {
      const key = `${record.condition ?? 'unknown'}:${name}`;
      if (!groups.has(key)) groups.set(key, { condition: record.condition ?? 'unknown',
        entrypoint: name, samples: 0, token_samples: 0, cost_samples: 0,
        duration_samples: 0, total_tokens: [], charged_cents: [], duration_ms: [],
        execution_statuses: {} });
      const group = groups.get(key);
      group.samples++;
      const status = entry.execution_status ?? 'unknown';
      group.execution_statuses[status] = (group.execution_statuses[status] ?? 0) + 1;
      if (entry.status === 'reported' && Number.isFinite(entry.tokens?.totalTokens)) {
        group.token_samples++;
        group.total_tokens.push(entry.tokens.totalTokens);
      }
      if (Number.isFinite(entry.charged_cents)) {
        group.cost_samples++;
        group.charged_cents.push(entry.charged_cents);
      }
      if (Number.isFinite(entry.duration_ms) && entry.duration_ms >= 0) {
        group.duration_samples++;
        group.duration_ms.push(entry.duration_ms);
      }
    }
  }
  return [...groups.values()].sort((a, b) => a.condition.localeCompare(b.condition)
    || a.entrypoint.localeCompare(b.entrypoint)).map((group) => ({
    condition: group.condition, entrypoint: group.entrypoint, samples: group.samples,
    token_samples: group.token_samples, cost_samples: group.cost_samples,
    duration_samples: group.duration_samples, execution_statuses: group.execution_statuses,
    mean_total_tokens: average(group.total_tokens),
    mean_charged_cents: average(group.charged_cents),
    mean_duration_ms: average(group.duration_ms),
  }));
}

if (require.main === module) {
  if (process.argv.length < 3) {
    process.stderr.write('usage: entrypoint-usage.cjs RUN_DIR [RUN_DIR ...]\n');
    process.exitCode = 1;
  } else {
    try {
      const records = process.argv.slice(2).map((dir) => JSON.parse(
        readFileSync(path.join(path.resolve(dir), 'run.json'), 'utf8')));
      process.stdout.write(`${JSON.stringify(report(records), null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  }
}

module.exports = { report };
