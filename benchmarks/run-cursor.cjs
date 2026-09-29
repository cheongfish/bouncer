#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { transcriptFiles, usageCoverage, usageFromCursorLogs, usageFromCursorStream } = require('./usage.cjs');
const { sampleEligibility, sourceProvenance } = require('./provenance.cjs');
const { clearTimeout, setTimeout } = require('node:timers');

const root = __dirname;
const projectRoot = path.resolve(root, '..');
const composeFile = path.join(root, 'docker', 'compose.cursor.yaml');
const bundle = path.join(root, 'fixtures', 'ledger-cli.bundle');
const prd = path.join(root, 'tasks', 'ledger-001.prd.md');
const baseCommit = 'a75fd4165864f1459221695012894d6333382bf7';

function fail(message) {
  throw new Error(message);
}

function options(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!['--condition', '--model', '--key-file', '--run-id', '--timeout-minutes', '--dry-run'].includes(key)
      || !value || parsed[key]) fail(`unknown or duplicate option: ${key}`);
    parsed[key] = value;
  }
  if (!['vanilla', 'bouncer-full'].includes(parsed['--condition'])) {
    fail('--condition must be vanilla or bouncer-full');
  }
  if (!parsed['--model']) fail('--model is required');
  if (parsed['--model'].startsWith('-')) fail('--model must be a model name');
  if (parsed['--dry-run'] && parsed['--dry-run'] !== 'true') fail('--dry-run accepts true');
  if (!parsed['--dry-run'] && !parsed['--key-file']) fail('--key-file is required');
  const minutes = Number(parsed['--timeout-minutes'] ?? '30');
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) fail('--timeout-minutes must be 1..240');
  parsed.timeoutMs = minutes * 60_000;
  parsed.runId = parsed['--run-id'] ?? `${Date.now()}-${parsed['--condition']}`;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$/.test(parsed.runId)) fail('invalid --run-id');
  if (parsed['--key-file']) {
    parsed.keyFile = path.resolve(parsed['--key-file']);
    if (!existsSync(parsed.keyFile) || !statSync(parsed.keyFile).isFile() || statSync(parsed.keyFile).size === 0) {
      fail('--key-file must point to a nonempty file');
    }
  }
  return parsed;
}

function command(binary, args, opts = {}) {
  const result = spawnSync(binary, args, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...opts });
  if (result.error || result.status !== 0) {
    fail(`${binary} ${args.join(' ')} failed: ${result.stderr || result.error?.message || result.stdout}`);
  }
  return result.stdout;
}

function saveJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function runCompose(args, env) {
  return command('docker', ['compose', '-f', composeFile, ...args], { env });
}

function streamCompose(args, env, stdoutFile, stderrFile, timeoutMs, containerName) {
  return new Promise((resolve) => {
    const stdout = openSync(stdoutFile, 'w');
    const stderr = openSync(stderrFile, 'w');
    const child = spawn('docker', ['compose', '-f', composeFile, ...args], {
      cwd: projectRoot, env, stdio: ['ignore', stdout, stderr],
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
    }, timeoutMs);
    let spawnError = null;
    child.on('error', (error) => {
      spawnError = error.message;
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      closeSync(stdout);
      closeSync(stderr);
      resolve({ exitCode, signal, timedOut, error: spawnError });
    });
  });
}

function parseCursorStream(jsonl) {
  let answer = '';
  let sessionId = null;
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (typeof event.session_id === 'string') sessionId = event.session_id;
    if (event.type === 'assistant' && typeof event.message === 'string') answer = event.message;
    if (event.type === 'result' && typeof event.result === 'string') answer = event.result;
  }
  return { answer, sessionId };
}

async function main() {
  const config = options(process.argv.slice(2));
  const runDir = path.join(root, 'runs', config.runId);
  const workDir = path.join(projectRoot, '.benchmarks', 'work', config.runId);
  if (existsSync(runDir) || existsSync(workDir)) fail(`run already exists: ${config.runId}`);
  mkdirSync(runDir, { recursive: true });
  const cursorData = path.join(runDir, 'cursor-projects');
  mkdirSync(cursorData);
  const cursorLogs = path.join(runDir, 'cursor-logs');
  mkdirSync(cursorLogs);
  command('git', ['clone', '--quiet', bundle, workDir]);
  if (command('git', ['-C', workDir, 'rev-parse', 'HEAD']).trim() !== baseCommit) fail('baseline commit mismatch');
  command('git', ['-C', workDir, 'config', 'user.name', 'Benchmark Agent']);
  command('git', ['-C', workDir, 'config', 'user.email', 'benchmark@local.invalid']);

  const condition = config['--condition'];
  const commonRequest = readFileSync(prd, 'utf8').trim();
  const service = condition === 'bouncer-full' ? 'bouncer' : 'vanilla';
  const prompt = condition === 'bouncer-full'
    ? [
      'Use the installed Bouncer plugin and its full workflow for this task.',
      'Invoke the relevant Bouncer skills, beginning with /bouncer-init.',
      'Set the project Bouncer subagents.provider to cursor after initialization.',
      'If a workflow requires a user decision or approval, request it and stop at that point.',
      'Do not assume approval.',
      '',
      commonRequest,
      '',
    ].join('\n')
    : `${commonRequest}\n`;
  const promptFile = path.join(runDir, 'prompt.txt');
  writeFileSync(promptFile, prompt);

  const env = {
    ...process.env,
    BENCH_WORKSPACE: workDir,
    BENCH_PROMPT: promptFile,
    BENCH_RESULT_DIR: runDir,
    BENCH_MODEL: config['--model'],
    BENCH_UID: String(process.getuid()),
    BENCH_GID: String(process.getgid()),
    CURSOR_API_KEY_FILE: config.keyFile ?? '/dev/null',
    BENCH_CURSOR_DATA: cursorData,
    BENCH_CURSOR_LOGS: cursorLogs,
  };
  const record = {
    run_id: config.runId,
    task_id: 'ledger-001',
    condition,
    plugin_version: condition === 'bouncer-full'
      ? JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version
      : null,
    model: config['--model'],
    base_commit: baseCommit,
    ...sourceProvenance(projectRoot),
    workspace: workDir,
    prepared_at: new Date().toISOString(),
    started_at: null,
    status: config['--dry-run'] ? 'prepared' : 'running',
    activation_confirmed: false,
    usage: { status: 'unavailable', source: 'cursor-cli-result', tokens: null },
    cost: 'unknown',
  };
  saveJson(path.join(runDir, 'run.json'), record);
  if (config['--dry-run']) {
    process.stdout.write(`${runDir}\n`);
    return;
  }

  runCompose(['build', service, 'verifier'], env);
  record.cursor_version = runCompose(
    ['run', '--rm', '--no-deps', '--entrypoint', 'cursor-agent', service, '--version'], env,
  ).trim();
  record.image_id = command('docker', [
    'image', 'inspect', `bouncer-benchmark-cursor-${service}:local`, '--format', '{{.Id}}',
  ]).trim();
  record.started_at = new Date().toISOString();
  saveJson(path.join(runDir, 'run.json'), record);

  const agentResult = await streamCompose(
    ['run', '--rm', '--no-deps', '--name', `cursor-bench-${config.runId}-${service}`, service], env,
    path.join(runDir, 'cursor.stdout.jsonl'), path.join(runDir, 'cursor.stderr.log'), config.timeoutMs,
    `cursor-bench-${config.runId}-${service}`,
  );
  record.agent = agentResult;
  record.ended_at = new Date().toISOString();
  record.duration_ms = Date.parse(record.ended_at) - Date.parse(record.started_at);
  record.status = agentResult.timedOut ? 'timeout' : agentResult.exitCode === 0 ? 'completed' : 'agent_failed';
  const cursorStream = parseCursorStream(readFileSync(path.join(runDir, 'cursor.stdout.jsonl'), 'utf8'));
  record.cursor_session_id = cursorStream.sessionId;
  // Session logs cover every agent process in the container, so both conditions are counted the same way;
  // the CLI result stays as a cross-check for the main session.
  record.usage_cli_result = usageFromCursorStream(readFileSync(path.join(runDir, 'cursor.stdout.jsonl'), 'utf8'));
  const logUsage = usageFromCursorLogs(cursorLogs);
  const measured = logUsage.status === 'reported' ? logUsage : record.usage_cli_result;
  // The same completeness rule as bouncer-full: a Task subagent leaves a transcript but no logged usage.
  record.usage_coverage = usageCoverage(cursorData, logUsage,
    [readFileSync(path.join(runDir, 'cursor.stdout.jsonl'), 'utf8')]);
  record.usage = record.usage_coverage.complete || measured.status !== 'reported' ? measured
    : { ...measured, status: 'incomplete', measured_status: measured.status };
  record.cursor_transcripts = transcriptFiles(cursorData);
  if (record.status === 'completed' && /\*\*AskUserQuestion:\*\*/.test(cursorStream.answer)) {
    record.status = 'awaiting_user_decision';
  }
  if (condition === 'bouncer-full') {
    record.activation_confirmed = /\/bouncer-init/.test(cursorStream.answer)
      && existsSync(path.join(workDir, '.bouncer', 'config.json'));
  }
  writeFileSync(path.join(runDir, 'final-answer.txt'), cursorStream.answer);

  command('git', ['-C', workDir, 'add', '-N', '--all']);
  const patch = command('git', ['-C', workDir, 'diff', '--binary', '--no-ext-diff', baseCommit, '--']);
  writeFileSync(path.join(runDir, 'diff.patch'), patch);
  saveJson(path.join(runDir, 'run.json'), record);

  const verifierResult = await streamCompose(
    ['run', '--rm', '--no-deps', '--name', `cursor-bench-${config.runId}-verify`, 'verifier'], env,
    path.join(runDir, 'verifier.stdout.json'), path.join(runDir, 'verifier.stderr.log'), 180_000,
    `cursor-bench-${config.runId}-verify`,
  );
  record.verifier = verifierResult;
  if (existsSync(path.join(runDir, 'verifier.json'))) {
    const result = JSON.parse(readFileSync(path.join(runDir, 'verifier.json'), 'utf8'));
    record.judge_status = result.judge_status;
    record.score = result.score;
    record.outcome_success = result.outcome_success;
  } else {
    record.judge_status = 'unjudgeable';
  }
  record.sample_eligibility = sampleEligibility(record);
  saveJson(path.join(runDir, 'run.json'), record);
  process.stdout.write(`${runDir}\n`);
  if (agentResult.exitCode !== 0 || verifierResult.exitCode !== 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
