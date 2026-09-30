#!/usr/bin/env node
'use strict';

// Print-mode stage runner. ACP responses carry no token usage, so each turn runs as
// `cursor-agent -p --output-format stream-json` inside one long-lived stage container, and later turns
// `--resume` the chat. The container keeps ~/.cursor/chats between turns; session logs and projects are
// mounted so usage and transcripts survive it. Shell policy is enforced by the image's beforeShellExecution
// hook because print mode runs with --force.
const { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { acqMarkers, loadPolicy, answerTextQuestion, answerQuizText, looksLikeQuizRequest, unreadQuestion,
} = require('./acp/responder.cjs');
const { normalizeUsage, sumUsage, transcriptFiles, usageCoverage, usageFromCursorLogs } = require('./usage.cjs');
const { argsOf, stages } = require('./stage-args.cjs');
const { loadCard } = require('./task-card.cjs');

const root = __dirname;
const compose = path.join(root, 'docker', 'compose.cursor.yaml');
const maxTurns = 40;

function docker(args, env) {
  const result = spawnSync('docker', args, { cwd: root, env, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`docker ${args[0]} failed: ${result.stderr || result.error?.message}`);
  }
  return result.stdout.trim();
}

// Runs one turn and resolves with its raw stream; a turn past the stage deadline removes the container.
function runTurn({ containerName, containerCwd, model, prompt, resume, deadline, streamFile, stderrFile }) {
  const args = ['exec', '-i', '-w', containerCwd, containerName, '/usr/local/bin/benchmark-agent', '--turn', model];
  if (resume) args.push('--resume', resume);
  return new Promise((resolve) => {
    const child = spawn('docker', args, { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
      child.kill('SIGTERM');
    }, Math.max(deadline - Date.now(), 1));
    child.stdout.on('data', (chunk) => { stdout += chunk; appendFileSync(streamFile, chunk); });
    child.stderr.on('data', (chunk) => appendFileSync(stderrFile, chunk));
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, timedOut }); });
    child.stdin.end(prompt);
  });
}

function parseStream(stdout) {
  let result = null;
  let text = '';
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'result') result = event;
    if (event.type === 'assistant') {
      for (const part of event.message?.content ?? []) if (part?.type === 'text') text += part.text ?? '';
    }
  }
  return { result, text: typeof result?.result === 'string' ? result.result : text };
}

function readJsonLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const policy = loadPolicy(args['--policy']); // Fail before build or any paid request.
  const task = loadCard(args.taskId);
  if (policy.task_id !== task.card.id) throw new Error('policy task id mismatch');
  const policySha256 = createHash('sha256').update(readFileSync(args['--policy'])).digest('hex');
  const stage = args['--stage'];
  const runDir = args['--run-dir'];
  mkdirSync(runDir, { recursive: true });
  const cursorData = path.join(runDir, 'cursor-projects');
  const cursorLogs = path.join(runDir, 'cursor-logs');
  const turnsDir = path.join(runDir, 'cursor-turns');
  for (const dir of [cursorData, cursorLogs, turnsDir]) mkdirSync(dir);
  const promptFile = path.join(runDir, 'prompt.txt');
  writeFileSync(promptFile, `${stages.get(stage)}\n\n${task.requestText}`);
  const env = {
    ...process.env,
    BENCH_WORKSPACE: args['--work-dir'], BENCH_PROMPT: promptFile, BENCH_RESULT_DIR: runDir,
    BENCH_MODEL: args['--model'], BENCH_UID: String(process.getuid()), BENCH_GID: String(process.getgid()),
    CURSOR_API_KEY_FILE: args['--key-file'],
    BENCH_CURSOR_DATA: cursorData,
    BENCH_CURSOR_LOGS: cursorLogs,
  };
  const built = spawnSync('docker', ['compose', '-f', compose, 'build', 'bouncer'], {
    cwd: root, env, stdio: 'inherit',
  });
  if (built.status !== 0) throw new Error(`Docker build failed: ${built.status}`);
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + args.timeoutMs;
  const containerName = `cursor-bench-print-${process.pid}`;
  const stderrFile = path.join(runDir, 'cursor.stderr.log');
  const decisions = [];
  const unanswered = [];
  const turns = [];
  const streams = [];
  let messageText = '';
  let sessionId = null;
  let error = null;
  try {
    docker(['compose', '-f', compose, 'run', '-d', '--rm', '--no-deps', '--name', containerName,
      '--entrypoint', 'sleep', 'bouncer', 'infinity'], env);
    let nextPrompt = readFileSync(promptFile, 'utf8');
    for (let turn = 0; turn < maxTurns; turn++) {
      const streamFile = path.join(turnsDir, `${String(turn + 1).padStart(2, '0')}.jsonl`);
      const outcome = await runTurn({ containerName, containerCwd: args.containerCwd, model: args['--model'],
        prompt: nextPrompt, resume: sessionId, deadline, streamFile, stderrFile });
      streams.push(outcome.stdout);
      const { result, text } = parseStream(outcome.stdout);
      turns.push({ turn: turn + 1, exit_code: outcome.code, request_id: result?.request_id ?? null,
        duration_ms: result?.duration_ms ?? null, usage: normalizeUsage(result?.usage) });
      messageText += text;
      if (outcome.timedOut) { error = 'stage timeout'; break; }
      if (!result || outcome.code !== 0 || result.is_error) {
        const detail = result?.result ?? (readFileSync(stderrFile, 'utf8').trim().split('\n').pop() || '');
        // Provider outages surface as an error result, not a normal turn.
        error = /\[[\w-]+\]/.test(detail) ? `provider error: ${detail}` : `agent failed: ${detail || outcome.code}`;
        break;
      }
      sessionId = result.session_id ?? sessionId;
      const acq = acqMarkers(text).length > 0;
      const quiz = stage === 'bouncer-finalize' && !acq && looksLikeQuizRequest(text);
      if (!acq && !quiz && unreadQuestion(text)) {
        unanswered.push({ at: new Date().toISOString(), method: 'text/unread-question', text: text });
        break;
      }
      if (!acq && !quiz) break;
      const decision = acq ? answerTextQuestion(policy, stage, text, args.sessionCwd)
        : answerQuizText(policy, stage, text);
      const method = acq ? 'text/AskUserQuestion' : 'text/Quiz';
      if (!decision) {
        unanswered.push({ at: new Date().toISOString(), method, text });
        break;
      }
      decisions.push({ at: new Date().toISOString(), method, decision });
      nextPrompt = decision.reply;
      if (turn === maxTurns - 1) unanswered.push({ at: new Date().toISOString(), method: 'turn-limit' });
    }
  } catch (caught) {
    error = caught.message;
  } finally {
    spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
  }
  let status = 'stage_returned';
  if (error?.startsWith('provider error:')) status = 'provider_error';
  else if (error) status = 'agent_failed';
  else if (unanswered.length) status = 'awaiting_user_decision';
  const shellGuard = readJsonLines(path.join(cursorData, 'benchmark-shell-guard.jsonl'));
  // Written only by the bouncer image's preToolUse/subagentStart hook (docker/subagent-guard.cjs).
  const subagentGuard = readJsonLines(path.join(cursorData, 'benchmark-subagent-guard.jsonl'));
  const subagentDenied = subagentGuard.filter((entry) => entry.permission === 'deny');
  const cliTokens = sumUsage(turns.map((turn) => ({ tokens: turn.usage })));
  const cliUsage = cliTokens ? { status: 'reported', source: 'cursor-cli-result', tokens: cliTokens }
    : { status: 'unavailable', source: 'cursor-cli-result', tokens: null };
  // Session logs also cover nested `agent --print` runs; Task subagents appear in neither source, so a stage
  // that used one is recorded as incomplete instead of an undercounted total.
  const logUsage = usageFromCursorLogs(cursorLogs);
  // A denied Task call may be reported by both hooks; count it once, by its preToolUse decision when present.
  const deniedTaskCalls = subagentDenied.filter((entry) => entry.event === 'preToolUse').length
    || subagentDenied.length;
  const coverage = usageCoverage(cursorData, logUsage, streams, { deniedTaskCalls });
  const measured = logUsage.status === 'reported' ? logUsage : cliUsage;
  const usage = coverage.complete || measured.status !== 'reported' ? measured
    : { ...measured, status: 'incomplete', measured_status: measured.status };
  writeFileSync(path.join(runDir, 'final-answer.txt'), messageText);
  writeFileSync(path.join(runDir, 'decisions.json'), JSON.stringify({
    decisions, unanswered, shell_guard: shellGuard, subagent_guard: subagentGuard,
  }, null, 2) + '\n');
  writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({
    stage, mode: 'print', status, session_id: sessionId, error,
    evaluator_policy_version: policy.policy_version, evaluator_policy_sha256: policySha256,
    started_at: startedAt, ended_at: new Date().toISOString(),
    turns,
    shell_denied: shellGuard.filter((entry) => entry.permission === 'deny').length,
    subagent_denied: deniedTaskCalls,
    usage,
    usage_coverage: coverage,
    usage_cli_result: cliUsage,
    cursor_transcripts: transcriptFiles(cursorData),
  }, null, 2) + '\n');
  process.stdout.write(`${runDir}\n`);
  if (status !== 'stage_returned') process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
