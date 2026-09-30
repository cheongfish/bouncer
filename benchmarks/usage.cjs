'use strict';

const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const fields = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'totalTokens', 'reasoningTokens'];

function normalizeUsage(value) {
  if (!value || typeof value !== 'object') return null;
  const result = {};
  for (const field of fields) {
    if (Number.isSafeInteger(value[field]) && value[field] >= 0) result[field] = value[field];
  }
  return Object.keys(result).length ? result : null;
}

function usageFromCursorStream(jsonl) {
  let usage = null;
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'result') usage = normalizeUsage(event.usage) ?? usage;
  }
  return usage ? { status: 'reported', source: 'cursor-cli-result', tokens: usage }
    : { status: 'unavailable', source: 'cursor-cli-result', tokens: null };
}

function transcriptFiles(projectsDir) {
  if (!existsSync(projectsDir)) return [];
  const found = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && file.endsWith('.jsonl') && file.includes(`${path.sep}agent-transcripts${path.sep}`)) {
        found.push(path.relative(projectsDir, file));
      }
    }
  }
  visit(projectsDir);
  return found.sort();
}

function usageFromAcp(transcriptFile) {
  if (!existsSync(transcriptFile) || !statSync(transcriptFile).isFile()) {
    return { status: 'unavailable', source: 'acp-prompt-response', tokens: null };
  }
  const turns = [];
  for (const line of readFileSync(transcriptFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.direction !== 'agent' || !entry.message || !Object.hasOwn(entry.message, 'id')) continue;
    const usage = normalizeUsage(entry.message.result?.usage);
    if (usage) turns.push({ response_id: entry.message.id, tokens: usage });
  }
  // ACP usage_update.used is context occupancy, not cumulative billed tokens.
  // Keep per-turn reports without assuming that a provider's usage is additive.
  return turns.length ? { status: 'reported_per_turn', source: 'acp-prompt-response', turns }
    : { status: 'unavailable', source: 'acp-prompt-response', turns: [] };
}

// cursor-agent logs one `agent_cli.turn.outcome` line per turn to its session log in every mode: print, ACP,
// and the nested `agent --print` runs a fallback coordinator starts. ACP responses carry no usage, so the
// mounted log directory is the only per-session source that survives the container.
const turnFields = { inputTokens: 'input_tokens', outputTokens: 'output_tokens',
  cacheReadTokens: 'cache_read_tokens', cacheWriteTokens: 'cache_write_tokens' };

function usageFromCursorLogs(logsDir) {
  const unavailable = { status: 'unavailable', source: 'cursor-session-log', tokens: null };
  if (!existsSync(logsDir) || !statSync(logsDir).isDirectory()) return unavailable;
  const turns = [];
  const seen = new Set();
  // latest.log is a symlink to a container path, so read regular files only.
  const logs = readdirSync(logsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.log')).map((entry) => entry.name).sort();
  for (const name of logs) {
    for (const line of readFileSync(path.join(logsDir, name), 'utf8').split('\n')) {
      if (!line.includes('"agent_cli.turn.outcome"')) continue;
      let entry;
      try { entry = JSON.parse(line.slice(line.indexOf('{'))); } catch { continue; }
      const meta = entry?.metadata;
      if (entry?.message !== 'agent_cli.turn.outcome' || !meta || seen.has(meta.request_id)) continue;
      seen.add(meta.request_id);
      const counts = {};
      for (const [field, key] of Object.entries(turnFields)) {
        if (/^\d+$/.test(String(meta[key] ?? ''))) counts[field] = Number(meta[key]);
      }
      const tokens = normalizeUsage(counts);
      if (tokens) turns.push({ log: name, conversation_id: meta.conversation_id ?? null,
        request_id: meta.request_id ?? null, outcome: meta.outcome ?? null, tokens });
    }
  }
  if (!turns.length) return unavailable;
  const total = {};
  const conversations = new Map();
  for (const turn of turns) {
    const key = turn.conversation_id ?? turn.log;
    const conversation = conversations.get(key) ?? { conversation_id: turn.conversation_id, log: turn.log,
      turns: 0, tokens: {} };
    conversation.turns += 1;
    for (const [field, value] of Object.entries(turn.tokens)) {
      total[field] = (total[field] ?? 0) + value;
      conversation.tokens[field] = (conversation.tokens[field] ?? 0) + value;
    }
    conversations.set(key, conversation);
  }
  return { status: 'reported', source: 'cursor-session-log', tokens: total,
    conversations: [...conversations.values()], turns };
}

// Cursor keeps no usage for Task subagents, but each one still leaves an agent transcript. A transcript whose
// conversation never logged a turn outcome, or any Task tool call, means the stage total undercounts.
function isTaskTool(name) {
  return /^task(?:ToolCall)?$/i.test(String(name ?? ''));
}

function taskCallsInTranscript(file) {
  let count = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    for (const part of entry?.message?.content ?? []) {
      // Newer cursor-agent builds reach Task through CallDynamicTool { toolName: 'Task' }.
      if (part?.type === 'tool_use' && (isTaskTool(part.name)
        || (part.name === 'CallDynamicTool' && isTaskTool(part.input?.toolName)))) count += 1;
    }
  }
  return count;
}

function taskCallsInStream(jsonl) {
  let count = 0;
  for (const line of String(jsonl ?? '').split('\n')) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event?.type === 'tool_call' && event.subtype === 'started'
      && Object.keys(event.tool_call ?? {}).some(isTaskTool)) count += 1;
  }
  return count;
}

// `deniedTaskCalls` counts Task calls the benchmark subagent guard refused: they start no subagent, so
// they leave no unmetered transcript and do not make the stage incomplete.
function usageCoverage(projectsDir, logUsage, streams = [], { deniedTaskCalls = 0 } = {}) {
  const metered = new Set((logUsage?.conversations ?? []).map((entry) => entry.conversation_id).filter(Boolean));
  const transcripts = transcriptFiles(projectsDir).map((file) => ({
    file, conversation_id: path.basename(file, '.jsonl'),
    task_calls: taskCallsInTranscript(path.join(projectsDir, file)),
  }));
  const unmetered = transcripts.filter((entry) => !metered.has(entry.conversation_id))
    .map((entry) => entry.file);
  const taskCalls = Math.max(transcripts.reduce((sum, entry) => sum + entry.task_calls, 0),
    streams.reduce((sum, stream) => sum + taskCallsInStream(stream), 0));
  return { complete: !unmetered.length && taskCalls <= deniedTaskCalls, metered_conversations: metered.size,
    transcripts: transcripts.length, unmetered_transcripts: unmetered, task_calls: taskCalls,
    denied_task_calls: deniedTaskCalls };
}

function sumUsage(usages) {
  const total = {};
  for (const usage of usages) {
    for (const [field, value] of Object.entries(usage?.tokens ?? {})) total[field] = (total[field] ?? 0) + value;
  }
  return Object.keys(total).length ? total : null;
}

// A run total is comparable only when every stage reported all of its agents' tokens.
function usageTotalStatus(stageUsage) {
  const statuses = Object.values(stageUsage ?? {}).map((usage) => usage?.status ?? 'unavailable');
  if (!statuses.length || statuses.every((status) => status === 'unavailable')) return 'unavailable';
  return statuses.every((status) => status === 'reported') ? 'reported' : 'incomplete';
}

module.exports = { normalizeUsage, sumUsage, taskCallsInStream, transcriptFiles, usageCoverage, usageFromAcp,
  usageFromCursorLogs, usageFromCursorStream, usageTotalStatus };
