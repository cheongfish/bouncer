#!/usr/bin/env node
'use strict';

const { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { setTimeout, clearTimeout } = require('node:timers');
const { AcpClient } = require('./acp/client.cjs');
const { loadPolicy, answerAskQuestion, answerQuizText, answerPermission, turnQuestionState } = require('./acp/responder.cjs');
const { transcriptFiles, usageFromAcp, usageFromCursorLogs } = require('./usage.cjs');
const { argsOf, stages } = require('./stage-args.cjs');
const { loadCard } = require('./task-card.cjs');
const { assertImagePluginVersion } = require('./plugin-version.cjs');
const { loadPrepared } = require('./prepare-deepswe-task.cjs');
const { agentRuntime } = require('./agent-runtime.cjs');
const { writeUnansweredFixtures } = require('./unanswered-fixtures.cjs');

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
  // DeepSWE 카드면 과제 이미지 기반 서비스와 그 빌드 env를, 아니면 기존 bouncer 서비스를 쓴다.
  const runtime = agentRuntime({ taskId: args.taskId, condition: 'bouncer-full', prepared: loadPrepared(args.taskId) });
  const env = {
    ...process.env,
    ...runtime.env,
    BENCH_WORKSPACE: args['--work-dir'], BENCH_PROMPT: promptFile, BENCH_RESULT_DIR: runDir,
    BENCH_MODEL: args['--model'], BENCH_UID: String(process.getuid()), BENCH_GID: String(process.getgid()),
    CURSOR_API_KEY_FILE: args['--key-file'],
    BENCH_CURSOR_DATA: cursorData,
    BENCH_CURSOR_LOGS: cursorLogs,
  };
  const built = spawnSync('docker', ['compose', '-f', compose, 'build', runtime.service], {
    cwd: root, env, stdio: 'inherit',
  });
  if (built.status !== 0) throw new Error(`Docker build failed: ${built.status}`);
  // 유료 요청 전에 이미지 플러그인 버전이 checkout과 같은지 확인한다.
  const pluginVersion = assertImagePluginVersion({ compose, env, cwd: root,
    checkoutVersion: JSON.parse(readFileSync(path.join(root, '..', 'package.json'), 'utf8')).version,
    service: runtime.service, packageJson: runtime.pluginPackageJson });
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
      runtime.service, '--acp', args['--model']],
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
      // 한 턴의 질문 판독은 응답기의 turnQuestionState 하나가 정한다: 실행기가 문구로 따로 추측하지 않는다.
      const state = turnQuestionState(policy, stage, turnText, args.sessionCwd);
      if (state.kind === 'none') break;
      if (state.kind === 'violation') {
        unanswered.push({ at: new Date().toISOString(), method: 'text/contract-violation', reason: state.reason,
          text: turnText });
        break;
      }
      if (state.kind === 'unanswerable') {
        unanswered.push({ at: new Date().toISOString(), method: 'text/AskUserQuestion', text: turnText });
        break;
      }
      const method = { quiz: 'text/Quiz', open_decisions: 'text/OpenDecisions' }[state.kind] ?? 'text/AskUserQuestion';
      const decision = state.kind === 'quiz' ? answerQuizText(policy, stage, turnText) : state.decision;
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
  writeUnansweredFixtures(runDir, { source: path.relative(path.join(root, '..'), runDir), phase: stage, unanswered });
  writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({
    stage, plugin_version: pluginVersion, status, session_id: sessionId, stop_reason: stopReason, error, usage_update: usageUpdate,
    evaluator_policy_version: policy.policy_version, evaluator_policy_sha256: policySha256,
    started_at: startedAt, ended_at: new Date().toISOString(),
    usage: logUsage.status === 'reported' ? logUsage : usageFromAcp(path.join(runDir, 'acp.jsonl')),
    cursor_transcripts: transcriptFiles(cursorData),
  }, null, 2) + '\n');
  process.stdout.write(`${runDir}\n`);
  if (status !== 'stage_returned') process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
