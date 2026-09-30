#!/usr/bin/env node
'use strict';

// Cursor preToolUse / subagentStart hook for the bouncer-full image. The benchmark's Bouncer config sets
// subagents.dispatch to "print", and rules/cursor-print-dispatch.md forbids Task subagents there because
// Cursor records no token usage for them. This hook enforces that rule so every agent stays a logged
// session: it denies Task (called directly or through CallDynamicTool) and every subagentStart, allows any
// other tool, and appends each decision to the mounted projects directory as evidence. It always exits 0.
const { appendFileSync } = require('node:fs');

const evidence = process.env.BENCH_SUBAGENT_GUARD_LOG ?? '/home/node/.cursor/projects/benchmark-subagent-guard.jsonl';
const MESSAGE = 'Benchmark policy: Task subagents are disabled because .bouncer/config.json sets subagents.dispatch '
  + 'to "print". Dispatch this Bouncer agent as a fresh `agent --print` process per rules/cursor-print-dispatch.md.';

function isTask(name) {
  return /^task$/i.test(String(name ?? ''));
}

function decide(payload) {
  const event = payload.hook_event_name ?? (payload.tool_name === undefined ? 'subagentStart' : 'preToolUse');
  const dynamic = payload.tool_input?.toolName ?? payload.tool_input?.tool_name;
  const denied = event === 'subagentStart'
    || isTask(payload.tool_name) || (payload.tool_name === 'CallDynamicTool' && isTask(dynamic));
  return { event, dynamic, permission: denied ? 'deny' : 'allow' };
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = JSON.parse(raw) ?? {}; } catch { /* unreadable payload: judged as a subagent start below */ }
  const { event, dynamic, permission } = decide(payload);
  const description = payload.tool_input?.description ?? payload.tool_input?.args?.description ?? payload.subagent_type;
  try {
    appendFileSync(evidence, `${JSON.stringify({ at: new Date().toISOString(), event, permission,
      tool_name: payload.tool_name ?? null, dynamic_tool: dynamic ?? null,
      description: description === undefined ? null : String(description).slice(0, 200) })}\n`);
  } catch { /* evidence is best effort; the decision below still applies */ }
  const out = { permission };
  if (permission === 'deny') Object.assign(out, { user_message: MESSAGE, agent_message: MESSAGE });
  process.stdout.write(JSON.stringify(out));
});
