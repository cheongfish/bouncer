#!/usr/bin/env node
'use strict';

const { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { setTimeout, clearTimeout } = require('node:timers');
const { AcpClient } = require('./acp/client.cjs');
const { loadPolicy, answerAskQuestion, answerTextQuestion, answerQuizText,
  looksLikeQuizRequest, answerPermission } = require('./acp/responder.cjs');
const { transcriptFiles, usageFromAcp, usageFromCursorLogs } = require('./usage.cjs');
const { argsOf, stages } = require('./stage-args.cjs');
const { loadCard } = require('./task-card.cjs');

const root = __dirname;
const compose = path.join(root, 'docker', 'compose.cursor.yaml');
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
  mkdirSync(cursorData);
  const cursorLogs = path.join(runDir, 'cursor-logs');
  mkdirSync(cursorLogs);
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
  const containerName = `cursor-bench-acp-${process.pid}`;
  const decisions = [];
  const unanswered = [];
  const notifications = [];
  let messageText = '';
  let turnText = '';
  let usageUpdate = null;
  const client = new AcpClient({
    command: 'docker',
    args: ['compose', '-f', compose, 'run', '--rm', '--no-deps', '-T', '--interactive', '--name', containerName,
      'bouncer', '--acp', args['--model']],
    cwd: root, env,
    authenticate: false,
    transcript: path.join(runDir, 'acp.jsonl'), stderr: path.join(runDir, 'cursor.stderr.log'),
    onUpdate(params) {
      const update = params?.update;
      if (update?.sessionUpdate === 'agent_message_chunk' && typeof update.content?.text === 'string') {
        messageText += update.content.text;
        turnText += update.content.text;
      }
      if (update?.sessionUpdate === 'usage_update') usageUpdate = update;
    },
    onRequest(method, params) {
      if (method === 'cursor/ask_question') {
        const reply = answerAskQuestion(policy, stage, params, args.sessionCwd);
        if (reply) {
          decisions.push({
            at: new Date().toISOString(), method, questions: params.questions, decisions: reply.decisions,
          });
          return { outcome: reply.outcome };
        }
        unanswered.push({ at: new Date().toISOString(), method, params });
        return { outcome: { outcome: 'cancelled' } };
      }
      if (method === 'session/request_permission') {
        const reply = answerPermission(params);
        if (reply) {
          decisions.push({ at: new Date().toISOString(), method, toolCall: params.toolCall, reason: reply.reason });
          return { outcome: reply.outcome };
        }
        unanswered.push({ at: new Date().toISOString(), method, params });
        return { outcome: { outcome: 'cancelled' } };
      }
      if (method === 'cursor/create_plan') {
        unanswered.push({ at: new Date().toISOString(), method, params });
        return { outcome: { outcome: 'cancelled' } };
      }
      // Cursor documents these as fire-and-forget notifications even when they arrive with a JSON-RPC id.
      if (method === 'cursor/task') {
        const { toolCallId, description, subagentType, model, agentId, durationMs } = params ?? {};
        notifications.push({ at: new Date().toISOString(), method,
          params: { toolCallId, description, subagentType, model, agentId, durationMs } });
        return { outcome: { outcome: 'completed', agentId, durationMs } };
      }
      if (method === 'cursor/update_todos' || method === 'cursor/generate_image') {
        notifications.push({ at: new Date().toISOString(), method, params });
        return {};
      }
      unanswered.push({ at: new Date().toISOString(), method, params });
      throw new Error(`unsupported ACP request: ${method}`);
    },
  });
  let sessionId = null;
  let stopReason = null;
  let error = null;
  const timer = setTimeout(() => {
    client.process.kill('SIGTERM');
    spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
  }, args.timeoutMs);
  try {
    await client.initialize();
    sessionId = await client.newSession(args.containerCwd);
    let nextPrompt = readFileSync(promptFile, 'utf8');
    for (let turn = 0; turn < 40; turn++) {
      turnText = '';
      const result = await client.prompt(sessionId, nextPrompt);
      stopReason = result?.stopReason ?? null;
      // Cursor reports a provider outage as agent text followed by a normal end_turn.
      const providerError = turnText.match(/(?:^|\n)\s*Error:\s*(\w*Error: \[[\w-]+\].*)\s*$/)?.[1];
      if (providerError) {
        error = `provider error: ${providerError.trim()}`;
        break;
      }
      if (unanswered.length) break;
      const acq = /\*\*AskUserQuestion[^*]*\*\*/.test(turnText);
      const quiz = stage === 'bouncer-finalize' && !acq && looksLikeQuizRequest(turnText);
      if (!acq && !quiz) break;
      const decision = acq ? answerTextQuestion(policy, stage, turnText, args.sessionCwd)
        : answerQuizText(policy, stage, turnText);
      const method = acq ? 'text/AskUserQuestion' : 'text/Quiz';
      if (!decision) {
        unanswered.push({ at: new Date().toISOString(), method, text: turnText });
        break;
      }
      decisions.push({ at: new Date().toISOString(), method, decision });
      nextPrompt = decision.reply;
      if (turn === 39) unanswered.push({ at: new Date().toISOString(), method: 'turn-limit' });
    }
  } catch (caught) {
    error = caught.message;
  } finally {
    clearTimeout(timer);
    await client.stop();
    // Terminating the Compose client alone can leave its --rm container running.
    spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
  }
  let status = 'stage_returned';
  if (error?.startsWith('provider error:')) status = 'provider_error';
  else if (error) status = 'agent_failed';
  else if (unanswered.length) status = 'awaiting_user_decision';
  const logUsage = usageFromCursorLogs(cursorLogs);
  writeFileSync(path.join(runDir, 'final-answer.txt'), messageText);
  writeFileSync(path.join(runDir, 'decisions.json'), JSON.stringify({ decisions, unanswered, notifications }, null, 2) + '\n');
  writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({
    stage, status, session_id: sessionId, stop_reason: stopReason, error, usage_update: usageUpdate,
    evaluator_policy_version: policy.policy_version, evaluator_policy_sha256: policySha256,
    started_at: startedAt, ended_at: new Date().toISOString(),
    usage: logUsage.status === 'reported' ? logUsage : usageFromAcp(path.join(runDir, 'acp.jsonl')),
    cursor_transcripts: transcriptFiles(cursorData),
  }, null, 2) + '\n');
  process.stdout.write(`${runDir}\n`);
  if (status !== 'stage_returned') process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
