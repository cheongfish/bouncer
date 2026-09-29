#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const baseCommit = 'a75fd4165864f1459221695012894d6333382bf7';
const maxOutputBytes = 1024 * 1024;
const benchmarkRoot = path.resolve(__dirname, '..');
const bundle = path.join(benchmarkRoot, 'fixtures', 'ledger-cli.bundle');
const evalEntries = path.join(benchmarkRoot, 'rubrics', 'ledger-001', 'entries.json');
const boundaries = path.join(benchmarkRoot, 'rubrics', 'ledger-001', 'month-boundary.json');

function usage() {
  return 'usage: node benchmarks/verifiers/ledger-001.cjs --patch <file> --work-dir <new-dir> [--output <file>]';
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--patch', '--work-dir', '--output'].includes(flag) || !value || options[flag]) {
      throw new Error(usage());
    }
    options[flag] = path.resolve(value);
  }
  if (!options['--patch'] || !options['--work-dir']) throw new Error(usage());
  return options;
}

function execute(binary, args, cwd, timeoutMs) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: maxOutputBytes,
    shell: false,
    env: { ...process.env, CI: '1' },
  });
  if (result.error?.code === 'ENOENT') {
    throw new Error(`required executable is unavailable: ${binary}`);
  }
  return {
    argv: [binary, ...args],
    exit_code: result.status,
    signal: result.signal ?? null,
    timed_out: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
  };
}

function requireGit(binary, args, cwd, expected = 0) {
  const result = execute(binary, args, cwd, 30000);
  if (result.exit_code !== expected || result.error) {
    throw new Error(`${binary} ${args.join(' ')} failed: ${result.stderr || result.error || result.stdout}`);
  }
  return result.stdout.trim();
}

function normalize(output) {
  return output.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

function normal(result) {
  return result.exit_code === 0 && result.stderr === '' && !result.error;
}

function exact(result, output) {
  return normal(result) && normalize(result.stdout) === output;
}

function rejected(result) {
  return result.exit_code === 1 && result.stdout === '' && result.stderr.length > 0 && !result.error;
}

function summaryRows(result) {
  if (!normal(result)) return null;
  const lines = normalize(result.stdout).split('\n');
  const rows = new Map();
  for (const line of lines) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 3 || !/^\d+$/.test(fields[1]) || !/^\d+$/.test(fields[2])) return null;
    if (rows.has(fields[0])) return null;
    rows.set(fields[0], [Number(fields[1]), Number(fields[2])]);
  }
  return rows;
}

function rowsEqual(actual, expected) {
  if (!actual || actual.size !== expected.length) return false;
  return expected.every(([name, count, cents]) => {
    const value = actual.get(name);
    return value?.[0] === count && value?.[1] === cents;
  });
}

function grade(workDir) {
  const commands = [];
  const run = (id, args, timeoutMs = 30000) => {
    const result = execute('node', ['src/cli.js', ...args], workDir, timeoutMs);
    commands.push({ id, ...result });
    return result;
  };
  const summary = (id, file, month, reverse = false) => run(id, reverse
    ? ['summary', '--month', month, '--file', file]
    : ['summary', '--file', file, '--month', month]);

  const janBoundary = summary('boundary-jan', boundaries, '2026-01');
  const febBoundary = summary('boundary-feb', boundaries, '2026-02');
  const jan = summary('main-jan', evalEntries, '2026-01');
  const empty = summary('main-empty', evalEntries, '2026-04');
  const reverse = summary('reverse-options', evalEntries, '2026-02', true);
  const invalid00 = summary('invalid-month-00', evalEntries, '2026-00');
  const invalid13 = summary('invalid-month-13', evalEntries, '2026-13');
  const invalidShort = summary('invalid-month-short', evalEntries, '2026-1');
  const missingMonth = run('missing-month', ['summary', '--file', evalEntries]);
  const missingFile = run('missing-file', ['summary', '--month', '2026-01']);
  const extraOption = run('extra-option', ['summary', '--file', evalEntries, '--month', '2026-01', '--extra']);
  const npmTest = execute('npm', ['test'], workDir, 120000);
  commands.push({ id: 'npm-test', ...npmTest });
  const list = run('list-regression', ['list', '--file', 'data/entries.json']);
  const total = run('total-regression', ['total', '--file', 'data/entries.json']);
  const hasSummary = summaryRows(jan) !== null;

  const checks = [
    ['F1', 15, rowsEqual(summaryRows(janBoundary), [['food', 1, 10], ['TOTAL', 1, 10]])
      && rowsEqual(summaryRows(febBoundary), [['travel', 1, 7], ['TOTAL', 1, 7]])],
    ['F2', 20, rowsEqual(summaryRows(jan), [
      ['books', 1, 0], ['food', 2, 1550], ['travel', 1, 800], ['TOTAL', 4, 2350],
    ])],
    ['F3', 10, exact(jan, 'books\t1\t0\nfood\t2\t1550\ntravel\t1\t800\nTOTAL\t4\t2350')],
    ['F4', 10, exact(empty, 'TOTAL\t0\t0')],
    ['F5', 5, exact(reverse, 'food\t1\t900\nTOTAL\t1\t900')],
    ['F6a', 5, hasSummary && rejected(invalid00)],
    ['F6b', 5, hasSummary && rejected(invalid13)],
    ['F6c', 5, hasSummary && rejected(invalidShort)],
    ['F7a', 4, hasSummary && rejected(missingMonth)],
    ['F7b', 3, hasSummary && rejected(missingFile)],
    ['F7c', 3, hasSummary && rejected(extraOption)],
    ['F8a', 5, normal(npmTest)],
    ['F8b', 5, exact(list, '2026-01-02\tfood\t1200\ta1\n2026-01-03\ttravel\t800\ta2\n2026-02-01\tfood\t350\ta3')],
    ['F8c', 5, exact(total, '2350')],
  ].map(([id, points, pass]) => ({ id, points, awarded: pass ? points : 0, pass }));

  return { criteria: checks, commands, score: checks.reduce((sum, check) => sum + check.awarded, 0) };
}

let options;
try {
  options = parseOptions(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const result = {
  task_id: 'ledger-001',
  rubric_version: 'v1',
  base_commit: baseCommit,
  judge_status: 'unjudgeable',
  score: null,
  max_score: 100,
  outcome_success: null,
  criteria: [],
  commands: [],
  error: null,
};

try {
  const patch = readFileSync(options['--patch']);
  result.patch_sha256 = createHash('sha256').update(patch).digest('hex');
  if (existsSync(options['--work-dir'])) throw new Error('work directory already exists');
  requireGit('git', ['clone', bundle, options['--work-dir']], process.cwd());
  const head = requireGit('git', ['-C', options['--work-dir'], 'rev-parse', 'HEAD'], process.cwd());
  if (head !== baseCommit) throw new Error(`unexpected base commit: ${head}`);
  if (patch.length) {
    requireGit('git', ['-C', options['--work-dir'], 'apply', '--check', '--binary', options['--patch']], process.cwd());
    requireGit('git', ['-C', options['--work-dir'], 'apply', '--binary', options['--patch']], process.cwd());
  }
  const graded = grade(options['--work-dir']);
  Object.assign(result, graded, {
    judge_status: 'graded',
    outcome_success: graded.score === 100,
  });
} catch (error) {
  result.error = error.message;
}

if (options['--output']) {
  mkdirSync(path.dirname(options['--output']), { recursive: true });
  writeFileSync(options['--output'], JSON.stringify(result, null, 2) + '\n');
}
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (result.judge_status !== 'graded') process.exitCode = 1;
