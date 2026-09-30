#!/usr/bin/env node
'use strict';

const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const {
  benchmarkRoot, checkoutWithPatch, cliRunner, exact, execute, normal, normalize, rejected, runVerifier, score,
} = require('./lib.cjs');

const baseCommit = '934cb3433f649447372f46051d703a5388384b72';
const bundle = path.join(benchmarkRoot, 'fixtures', 'ledger-cli-v2.bundle');
const data = (name) => path.join(benchmarkRoot, 'rubrics', 'ledger-002', name);
const entries = data('entries.json');

// Expected rows as `category spent budget remaining status`, in JavaScript default string order.
const JAN = [
  'Gifts\t300\t-\t-\tNO_BUDGET',
  'books\t0\t500\t500\tOK',
  'food\t1300\t1200\t-100\tOVER',
  'fun\t250\t-\t-\tNO_BUDGET',
  'rent\t90000\t90000\t0\tOK',
  'travel\t500\t1000\t500\tOK',
];
const FEB = [
  'books\t0\t500\t500\tOK',
  'food\t400\t1200\t800\tOK',
  'rent\t0\t90000\t90000\tOK',
  'travel\t0\t1000\t1000\tOK',
];
const ZERO_BUDGET_JAN = [
  'Gifts\t300\t-\t-\tNO_BUDGET',
  'food\t1300\t5000\t3700\tOK',
  'fun\t250\t0\t-250\tOVER',
  'rent\t90000\t-\t-\tNO_BUDGET',
  'travel\t500\t-\t-\tNO_BUDGET',
];
const BASE_LIST = '2026-01-02\tfood\t1200\ta1\n2026-01-03\ttravel\t800\ta2\n2026-02-01\tfood\t350\ta3';

// Rows keyed by category, read with any whitespace between five fields. Null if the output is not a
// budget table. Exit code 0 or 2 both count here; the exit-code criteria judge that separately.
function budgetRows(result) {
  if (![0, 2].includes(result.exit_code) || result.stderr !== '' || result.error) return null;
  const rows = new Map();
  for (const line of normalize(result.stdout).split('\n')) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 5 || rows.has(fields[0])) return null;
    rows.set(fields[0], fields.slice(1).join(' '));
  }
  return rows;
}

function sameRows(result, expected) {
  const rows = budgetRows(result);
  return rows !== null && rows.size === expected.length
    && expected.every((line) => rows.get(line.split('\t')[0]) === line.split('\t').slice(1).join(' '));
}

function exitsWith(result, code, expected) {
  return result.exit_code === code && sameRows(result, expected);
}

function mentionsBudget(dir, pattern) {
  try {
    return readdirSync(dir, { recursive: true }).filter((file) => /\.(c|m)?js$/.test(file))
      .some((file) => pattern.test(readFileSync(path.join(dir, file), 'utf8')));
  } catch {
    return false;
  }
}

function grade(workDir) {
  const commands = [];
  const run = cliRunner(workDir, commands);
  const budget = (id, budgets, month, extra = []) => run(id,
    ['budget', '--file', entries, '--budgets', budgets, '--month', month, ...extra]);

  const jan = budget('jan', data('budgets.json'), '2026-01');
  const feb = budget('feb', data('budgets.json'), '2026-02');
  const zero = budget('zero-budget', data('budgets-zero.json'), '2026-01');
  const empty = budget('empty', data('budgets-empty.json'), '2026-04');
  const reordered = run('reordered', ['budget', '--month', '2026-02', '--budgets', data('budgets.json'), '--file', entries]);
  const invalidMonth = budget('invalid-month', data('budgets.json'), '2026-13');
  const malformed = ['budgets-array.json', 'budgets-not-json.json']
    .map((name) => budget(`malformed-${name}`, data(name), '2026-01'));
  const invalidValues = ['budgets-negative.json', 'budgets-fraction.json', 'budgets-empty-key.json', 'budgets-string.json']
    .map((name) => budget(`invalid-${name}`, data(name), '2026-01'));
  const missing = [
    run('missing-budgets', ['budget', '--file', entries, '--month', '2026-01']),
    run('missing-file', ['budget', '--budgets', data('budgets.json'), '--month', '2026-01']),
    run('missing-month', ['budget', '--file', entries, '--budgets', data('budgets.json')]),
  ];
  const other = [
    budget('unknown-option', data('budgets.json'), '2026-01', ['--extra', 'x']),
    budget('unreadable-budgets', data('does-not-exist.json'), '2026-01'),
  ];
  const list = run('list-regression', ['list', '--file', 'data/entries.json']);
  const total = run('total-regression', ['total', '--file', 'data/entries.json']);
  const summary = run('summary-regression', ['summary', '--file', 'data/entries.json', '--month', '2026-01']);
  const npmTest = execute('npm', ['test'], workDir, 120000);
  commands.push({ id: 'npm-test', ...npmTest });
  let docs = '';
  try { docs = readFileSync(path.join(workDir, 'docs', 'commands.md'), 'utf8'); } catch { /* scored below */ }

  // Error criteria count only when `budget` prints a table; the base CLI rejects `budget` as unknown.
  const hasBudget = budgetRows(jan) !== null;
  const errors = (results) => hasBudget && results.every(rejected);
  return {
    commands,
    ...score([
      ['B1', 15, sameRows(jan, JAN)],
      ['B2', 10, jan.stderr === '' && normalize(jan.stdout) === JAN.join('\n')],
      ['B3', 10, sameRows(feb, FEB)],
      ['B4', 5, sameRows(zero, ZERO_BUDGET_JAN)],
      ['B5', 5, exact(empty, '')],
      ['B6', 5, sameRows(reordered, FEB)],
      ['X1', 10, exitsWith(jan, 2, JAN) && exitsWith(zero, 2, ZERO_BUDGET_JAN)],
      ['X2', 5, exitsWith(feb, 0, FEB)],
      ['V1', 5, errors([invalidMonth])],
      ['V2', 5, errors(malformed)],
      ['V3', 5, errors(invalidValues)],
      ['V4', 5, errors(missing)],
      ['V5', 5, errors(other)],
      ['R1', 4, exact(list, BASE_LIST) && exact(total, '2350')
        && exact(summary, 'food\t1\t1200\ntravel\t1\t800\nTOTAL\t2\t2000')],
      ['R2', 3, normal(npmTest)],
      ['D1', 3, /(^|\n)#+\s*budget\b/.test(docs) && mentionsBudget(path.join(workDir, 'test'), /\bbudget\b/)],
    ]),
  };
}

runVerifier({
  taskId: 'ledger-002',
  rubricVersion: 'v1',
  baseCommit,
  usage: 'usage: node verifiers/ledger-002.cjs --patch <file> --work-dir <new-dir> [--output <file>]',
  flags: ['--patch', '--work-dir', '--output'],
  required: ['--patch', '--work-dir'],
  prepare(options, result) {
    result.patch_sha256 = checkoutWithPatch(bundle, baseCommit, options['--work-dir'], options['--patch']);
    return options['--work-dir'];
  },
  grade,
});
