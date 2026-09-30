'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { sumUsage, taskCallsInStream, transcriptFiles, usageCoverage, usageFromAcp, usageFromCursorLogs,
  usageFromCursorStream, usageTotalStatus } = require('./usage.cjs');

test('CLI usage is recorded only when a result actually reports it', () => {
  assert.deepEqual(usageFromCursorStream('{"type":"result","usage":{"inputTokens":12,"outputTokens":3}}\n'), {
    status: 'reported', source: 'cursor-cli-result', tokens: { inputTokens: 12, outputTokens: 3 },
  });
  assert.equal(usageFromCursorStream('{"type":"result","result":"done"}\n').status, 'unavailable');
});

test('ACP prompt usage is kept per response and context updates are ignored', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cursor-usage-'));
  try {
    const file = path.join(dir, 'acp.jsonl');
    writeFileSync(file, [
      { direction: 'agent', message: { method: 'session/update', params: {
        update: { sessionUpdate: 'usage_update', used: 100, size: 1000 },
      } } },
      { direction: 'agent', message: { id: 2, result: { usage: { inputTokens: 7, outputTokens: 2 } } } },
    ].map(JSON.stringify).join('\n'));
    assert.deepEqual(usageFromAcp(file).turns, [{ response_id: 2,
      tokens: { inputTokens: 7, outputTokens: 2 } }]);
    const transcript = path.join(dir, 'project', 'agent-transcripts', 'id');
    mkdirSync(transcript, { recursive: true });
    writeFileSync(path.join(transcript, 'id.jsonl'), '{"role":"assistant"}\n');
    assert.deepEqual(transcriptFiles(dir), ['project/agent-transcripts/id/id.jsonl']);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('session-log usage sums every turn.outcome line once per request across agent processes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cursor-logs-'));
  const line = (conversation, request, input, output) => `[2026-09-29T05:13:43.503Z] structured-log.info ${
    JSON.stringify({ key: 'agent_cli', message: 'agent_cli.turn.outcome', metadata: {
      request_id: request, conversation_id: conversation, outcome: 'success', input_tokens: String(input),
      output_tokens: String(output), cache_read_tokens: '5', cache_write_tokens: '0' } })}`;
  try {
    writeFileSync(path.join(dir, 'session-a-7-1.log'), [
      '[2026-09-29T05:13:07.152Z] startup.first_token {"first_token_ms":18961}',
      line('root', 'r1', 100, 10), line('root', 'r2', 200, 20), line('root', 'r2', 200, 20)].join('\n'));
    writeFileSync(path.join(dir, 'session-b-1655-1.log'), line('nested', 'r3', 50, 5));
    writeFileSync(path.join(dir, 'notes.txt'), line('ignored', 'r4', 999, 9));
    symlinkSync('/tmp/cursor-agent-logs-1000/missing.log', path.join(dir, 'latest.log'));
    const usage = usageFromCursorLogs(dir);
    assert.equal(usage.status, 'reported');
    assert.deepEqual(usage.tokens, { inputTokens: 350, outputTokens: 35, cacheReadTokens: 15, cacheWriteTokens: 0 });
    assert.deepEqual(usage.conversations.map((entry) => [entry.conversation_id, entry.turns]),
      [['root', 2], ['nested', 1]]);
    assert.deepEqual(sumUsage([usage, { tokens: { inputTokens: 1 } }, null]),
      { inputTokens: 351, outputTokens: 35, cacheReadTokens: 15, cacheWriteTokens: 0 });
    assert.equal(usageFromCursorLogs(path.join(dir, 'missing')).status, 'unavailable');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('usage coverage flags Task subagents that leave a transcript but no logged turn', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cursor-coverage-'));
  const transcript = (project, id, tools = []) => {
    const folder = path.join(dir, project, 'agent-transcripts', id);
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, `${id}.jsonl`), [
      { role: 'user', message: { content: [{ type: 'text', text: 'brief' }] } },
      { role: 'assistant', message: { content: tools.map((name) => ({ type: 'tool_use', name, input: {} })) } },
    ].map(JSON.stringify).join('\n'));
  };
  const logs = { conversations: [{ conversation_id: 'root' }, { conversation_id: 'worker' }] };
  try {
    transcript('workspace', 'root', ['Shell', 'Read']);
    transcript('workspace-worktrees-001', 'worker', ['Shell']);
    assert.deepEqual(usageCoverage(dir, logs), { complete: true, metered_conversations: 2, transcripts: 2,
      unmetered_transcripts: [], task_calls: 0, denied_task_calls: 0 });

    transcript('workspace', 'coordinator', ['Shell']);
    const gap = usageCoverage(dir, logs);
    assert.equal(gap.complete, false);
    assert.deepEqual(gap.unmetered_transcripts, ['workspace/agent-transcripts/coordinator/coordinator.jsonl']);

    const started = { type: 'tool_call', subtype: 'started', tool_call: { taskToolCall: { args: {} } } };
    const stream = [started, { ...started, subtype: 'completed' },
      { type: 'tool_call', subtype: 'started', tool_call: { shellToolCall: { args: {} } } }]
      .map(JSON.stringify).join('\n');
    assert.equal(taskCallsInStream(stream), 1);
    rmSync(path.join(dir, 'workspace', 'agent-transcripts', 'coordinator'), { recursive: true });
    assert.equal(usageCoverage(dir, logs, [stream]).task_calls, 1);
    assert.equal(usageCoverage(dir, logs, [stream]).complete, false);
    // A Task call the subagent guard refused starts no subagent, so it leaves the stage complete.
    assert.equal(usageCoverage(dir, logs, [stream], { deniedTaskCalls: 1 }).complete, true);
    transcript('workspace', 'root', ['Task']);
    assert.equal(usageCoverage(dir, logs).task_calls, 1);
    const folder = path.join(dir, 'workspace', 'agent-transcripts', 'root');
    writeFileSync(path.join(folder, 'root.jsonl'), JSON.stringify({ role: 'assistant', message: { content: [
      { type: 'tool_use', name: 'CallDynamicTool', input: { namespace: 'cursor', toolName: 'Task' } },
      { type: 'tool_use', name: 'CallDynamicTool', input: { namespace: 'cursor', toolName: 'AskQuestion' } },
    ] } }));
    assert.equal(usageCoverage(dir, logs).task_calls, 1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('a run total is reported only when every stage reported all agents', () => {
  assert.equal(usageTotalStatus({ a: { status: 'reported' }, b: { status: 'reported' } }), 'reported');
  assert.equal(usageTotalStatus({ a: { status: 'reported' }, b: { status: 'incomplete' } }), 'incomplete');
  assert.equal(usageTotalStatus({ a: { status: 'reported' }, b: undefined }), 'incomplete');
  assert.equal(usageTotalStatus({ a: { status: 'unavailable' } }), 'unavailable');
  assert.equal(usageTotalStatus({}), 'unavailable');
});
