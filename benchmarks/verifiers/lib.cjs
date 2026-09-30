'use strict';

// Shared pieces for the ledger-v2 verifiers. The verifier container mounts only benchmarks/, so this
// module uses Node built-ins alone. ledger-001.cjs predates it and stays unchanged with its v1 results.

const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const maxOutputBytes = 1024 * 1024;
const benchmarkRoot = path.resolve(__dirname, '..');

// The graded project's own `npm test` must not inherit a parent test runner's context, or it reports
// to that runner instead of exiting on its own result.
function childEnv() {
  const env = { ...process.env, CI: '1' };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function execute(binary, args, cwd, timeoutMs) {
  const result = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: maxOutputBytes,
    shell: false,
    env: childEnv(),
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

function requireGit(args, cwd) {
  const result = execute('git', args, cwd, 30000);
  if (result.exit_code !== 0 || result.error) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.error || result.stdout}`);
  }
  return result.stdout.trim();
}

function normalize(output) {
  return output.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

// A successful command: exit 0, empty stderr.
function normal(result) {
  return result.exit_code === 0 && result.stderr === '' && !result.error;
}

function exact(result, output) {
  return normal(result) && normalize(result.stdout) === output;
}

// A rejected command: exit 1, a message on stderr, nothing on stdout.
function rejected(result) {
  return result.exit_code === 1 && result.stdout === '' && result.stderr.length > 0 && !result.error;
}

function parseOptions(argv, usage, flags, required) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flags.includes(flag) || !value || options[flag]) throw new Error(usage);
    options[flag] = path.resolve(value);
  }
  if (required.some((flag) => !options[flag])) throw new Error(usage);
  return options;
}

// A fresh checkout of the fixture bundle at `baseCommit` with the submission patch applied.
function checkoutWithPatch(bundle, baseCommit, workDir, patchFile) {
  const patch = readFileSync(patchFile);
  if (existsSync(workDir)) throw new Error('work directory already exists');
  requireGit(['clone', '--quiet', bundle, workDir], process.cwd());
  const head = requireGit(['-C', workDir, 'rev-parse', 'HEAD'], process.cwd());
  if (head !== baseCommit) throw new Error(`unexpected base commit: ${head}`);
  if (patch.length) {
    requireGit(['-C', workDir, 'apply', '--check', '--binary', patchFile], process.cwd());
    requireGit(['-C', workDir, 'apply', '--binary', patchFile], process.cwd());
  }
  return createHash('sha256').update(patch).digest('hex');
}

// Turns [id, points, pass] rows into scored criteria; each criterion is all-or-nothing.
function score(rows) {
  const criteria = rows.map(([id, points, pass]) => ({ id, points, awarded: pass ? points : 0, pass: Boolean(pass) }));
  const max = criteria.reduce((sum, check) => sum + check.points, 0);
  if (max !== 100) throw new Error(`rubric points add up to ${max}, not 100`);
  return { criteria, score: criteria.reduce((sum, check) => sum + check.awarded, 0) };
}

// Runs one verifier: parse options, prepare the checkout, grade, and write the result JSON.
// `prepare(options, result)` returns the directory to grade; `grade(dir)` returns { criteria, score, commands }.
function runVerifier({ taskId, rubricVersion, baseCommit, usage, flags, required, prepare, grade }) {
  let options;
  try {
    options = parseOptions(process.argv.slice(2), usage, flags, required);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const result = {
    task_id: taskId,
    rubric_version: rubricVersion,
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
    const graded = grade(prepare(options, result));
    Object.assign(result, graded, { judge_status: 'graded', outcome_success: graded.score === 100 });
  } catch (error) {
    result.error = error.message;
  }
  if (options['--output']) {
    mkdirSync(path.dirname(options['--output']), { recursive: true });
    writeFileSync(options['--output'], `${JSON.stringify(result, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.judge_status !== 'graded') process.exitCode = 1;
}

// Records every CLI call so the result JSON keeps the raw evidence behind each criterion.
function cliRunner(workDir, commands) {
  return (id, args, timeoutMs = 30000) => {
    const result = execute('node', ['src/cli.js', ...args], workDir, timeoutMs);
    commands.push({ id, ...result });
    return result;
  };
}

module.exports = {
  benchmarkRoot, checkoutWithPatch, cliRunner, exact, execute, normal, normalize, rejected, requireGit, runVerifier,
  score,
};
