#!/usr/bin/env node
'use strict';

// Cursor beforeShellExecution hook for print-mode benchmark runs. Print mode runs with --force, so this hook
// is where the evaluator's shell policy is enforced; every decision is appended to the mounted projects
// directory as evidence. It answers Cursor's { permission } protocol and always exits 0.
const { appendFileSync } = require('node:fs');
const { deniedShellReason } = require('/opt/benchmark/shell-policy.cjs');

const evidence = '/home/node/.cursor/projects/benchmark-shell-guard.jsonl';
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let command = '';
  try { command = String(JSON.parse(raw).command ?? ''); } catch { /* unreadable payload: judge the empty command */ }
  const reason = deniedShellReason(command);
  try {
    appendFileSync(evidence, `${JSON.stringify({ at: new Date().toISOString(),
      permission: reason ? 'deny' : 'allow', reason, command: command.slice(0, 2000) })}\n`);
  } catch { /* evidence is best effort; the decision below still applies */ }
  const out = { permission: reason ? 'deny' : 'allow' };
  if (reason) out.userMessage = out.agentMessage = `benchmark policy denies this command (${reason})`;
  process.stdout.write(JSON.stringify(out));
});
