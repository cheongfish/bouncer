'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const guard = path.join(__dirname, 'docker', 'subagent-guard.cjs');

function hook(log, payload) {
  const run = spawnSync(process.execPath, [guard], { input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8', env: { ...process.env, BENCH_SUBAGENT_GUARD_LOG: log } });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

test('subagent guard denies Task in every form and allows other tools', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'subagent-guard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const log = path.join(dir, 'guard.jsonl');
  const direct = hook(log, { hook_event_name: 'preToolUse', tool_name: 'Task', tool_input: { description: 'review' } });
  assert.equal(direct.permission, 'deny');
  assert.match(direct.agent_message, /agent --print/);
  assert.equal(hook(log, { tool_name: 'task', tool_input: {} }).permission, 'deny');
  assert.equal(hook(log, { tool_name: 'CallDynamicTool', tool_input: { toolName: 'Task' } }).permission, 'deny');
  assert.deepEqual(hook(log, { tool_name: 'CallDynamicTool', tool_input: { toolName: 'AskQuestion' } }), { permission: 'allow' });
  assert.deepEqual(hook(log, { tool_name: 'Shell', tool_input: { command: 'npm test' } }), { permission: 'allow' });
  assert.equal(hook(log, { hook_event_name: 'subagentStart', subagent_type: 'generalPurpose' }).permission, 'deny');
  assert.equal(hook(log, 'not json').permission, 'deny');
  const entries = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(entries.map((entry) => [entry.event, entry.permission]), [
    ['preToolUse', 'deny'], ['preToolUse', 'deny'], ['preToolUse', 'deny'], ['preToolUse', 'allow'],
    ['preToolUse', 'allow'], ['subagentStart', 'deny'], ['subagentStart', 'deny'],
  ]);
  assert.equal(entries[0].description, 'review');
});
