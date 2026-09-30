#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');
const path = require('node:path');
const { benchmarkRoot, checkoutWithPatch, cliRunner, exact, execute, normal, rejected, runVerifier, score } = require('./lib.cjs');

const baseCommit = '934cb3433f649447372f46051d703a5388384b72';
const bundle = path.join(benchmarkRoot, 'fixtures', 'ledger-cli-v2.bundle');
const evalEntries = path.join(benchmarkRoot, 'rubrics', 'ledger-004', 'entries.json');

const EVAL_LIST = [
  '2026-01-03\trent\t50000\te1',
  '2026-01-15\tfood\t1234\te2',
  '2026-02-02\tfood\t566\te3',
  '2026-01-28\tbooks\t999\te4',
];
const BASE_LIST = '2026-01-02\tfood\t1200\ta1\n2026-01-03\ttravel\t800\ta2\n2026-02-01\tfood\t350\ta3';

// `-f` as an option word in prose or a usage line, not inside another word such as `--file-x`.
function mentionsShortFile(text) {
  return /(^|[\s`[(|])-f([\s`\])|,]|$)/m.test(text);
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function grade(workDir) {
  const commands = [];
  const run = cliRunner(workDir, commands);

  const list = run('list-short', ['list', '-f', evalEntries]);
  const total = run('total-short', ['total', '-f', evalEntries]);
  const summary = run('summary-short', ['summary', '-f', evalEntries, '--month', '2026-01']);
  const summaryLast = run('summary-short-last', ['summary', '--month', '2026-02', '-f', evalEntries]);
  const category = run('list-category-short-last', ['list', '--category', 'food', '-f', evalEntries]);
  const missingValue = run('short-missing-value', ['list', '-f']);
  const duplicate = run('short-and-long', ['list', '-f', evalEntries, '--file', evalEntries]);
  const missingAtEnd = run('short-missing-value-last', ['summary', '--month', '2026-01', '-f']);
  const longList = run('long-list', ['list', '--file', 'data/entries.json']);
  const longTotal = run('long-total', ['total', '--file', 'data/entries.json']);
  const longSummary = run('long-summary', ['summary', '--file', 'data/entries.json', '--month', '2026-01']);
  const npmTest = execute('npm', ['test'], workDir, 120000);
  commands.push({ id: 'npm-test', ...npmTest });
  const docs = [path.join(workDir, 'README.md'), path.join(workDir, 'docs', 'commands.md')].map(readText);

  // Error criteria count only when `-f` works at all; the base parser already rejects `-f` as unknown.
  const hasShort = exact(list, EVAL_LIST.join('\n'));
  return {
    commands,
    ...score([
      ['S1', 15, hasShort],
      ['S2', 10, exact(total, '52799')],
      ['S3', 15, exact(summary, 'books\t1\t999\nfood\t1\t1234\nrent\t1\t50000\nTOTAL\t3\t52233')],
      ['S4', 10, exact(summaryLast, 'food\t1\t566\nTOTAL\t1\t566')],
      ['S5', 10, exact(category, `${EVAL_LIST[1]}\n${EVAL_LIST[2]}`)],
      ['E1', 10, hasShort && rejected(missingValue)],
      ['E2', 10, hasShort && rejected(duplicate)],
      ['E3', 5, hasShort && rejected(missingAtEnd)],
      ['R1', 5, exact(longList, BASE_LIST) && exact(longTotal, '2350')
        && exact(longSummary, 'food\t1\t1200\ntravel\t1\t800\nTOTAL\t2\t2000')],
      ['R2', 5, normal(npmTest)],
      ['D1', 5, docs.every(mentionsShortFile)],
    ]),
  };
}

runVerifier({
  taskId: 'ledger-004',
  rubricVersion: 'v1',
  baseCommit,
  usage: 'usage: node verifiers/ledger-004.cjs --patch <file> --work-dir <new-dir> [--output <file>]',
  flags: ['--patch', '--work-dir', '--output'],
  required: ['--patch', '--work-dir'],
  prepare(options, result) {
    result.patch_sha256 = checkoutWithPatch(bundle, baseCommit, options['--work-dir'], options['--patch']);
    return options['--work-dir'];
  },
  grade,
});
