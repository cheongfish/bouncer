#!/usr/bin/env node
'use strict';
// Cursor beforeShellExecution hook: the same guard as hooks/commit-safety.js,
// wearing Cursor's protocol instead of Claude Code's. Cursor decides from a
// JSON object on stdout ({ permission: allow|deny|ask }) rather than from the
// exit code, and its payload names the workspace `workspace_roots` rather than
// `cwd`. Everything that decides *whether* a commit is in scope is delegated to
// the public `bouncer commit-guard --command-stdin` CLI through the shared
// runtime-cli.js, so both adapters cannot drift apart. The runtime's own stdout
// is never forwarded: this hook's stdout must be exactly one JSON object.
const { decideCommit } = require('./runtime-cli');

function respond(permission, message) {
  const out = { permission };
  if (message) {
    out.userMessage = message;
    out.agentMessage = message;
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { respond('allow'); }
  // payload가 JSON `null` 등이면 프로퍼티 접근이 throw한다. JSON 없이 죽으면 Cursor가
  // 판정을 얻지 못하므로 deny JSON으로 바꾼다.
  let command;
  let repoRoot;
  try {
    command = typeof payload.command === 'string' ? payload.command : '';
    const roots = Array.isArray(payload.workspace_roots) ? payload.workspace_roots : [];
    repoRoot = roots[0] || payload.cwd || process.cwd();
  } catch (_e) {
    respond('deny', 'commit-safety: unexpected error (bad payload); commit blocked');
  }
  // Cursor sends the workspace as a list; Claude Code sends a single `cwd`.
  // Accept either, and fall back to the process cwd so a payload shape we do
  // not recognise still resolves a repository to inspect (resolved in the try above).
  const result = decideCommit(command, repoRoot);
  if (result.block) respond('deny', result.reason);
  respond('allow');
});
