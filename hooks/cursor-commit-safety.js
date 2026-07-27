#!/usr/bin/env node
'use strict';
// Cursor beforeShellExecution hook: the same guard as hooks/commit-safety.js,
// wearing Cursor's protocol instead of Claude Code's. Cursor decides from a
// JSON object on stdout ({ permission: allow|deny|ask }) rather than from the
// exit code, and its payload names the workspace `workspace_roots` rather than
// `cwd`. Everything that decides *whether* a commit is in scope stays in
// scripts/lib/commit-hook.js so both adapters cannot drift apart.
const { evaluateCommit } = require('../scripts/lib/commit-hook');

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
  const command = typeof payload.command === 'string' ? payload.command : '';
  // Cursor sends the workspace as a list; Claude Code sends a single `cwd`.
  // Accept either, and fall back to the process cwd so a payload shape we do
  // not recognise still resolves a repository to inspect.
  const roots = Array.isArray(payload.workspace_roots) ? payload.workspace_roots : [];
  const repoRoot = roots[0] || payload.cwd || process.cwd();
  let result;
  try {
    result = evaluateCommit({ command, repoRoot });
  } catch (e) {
    // Fail closed, for the same reason as the Claude Code adapter: by this
    // point evaluateCommit has already returned early for non-commit commands
    // and for "no active blueprint", so a throw means we could not prove an
    // actual commit is in scope.
    respond('deny', `commit-safety: internal error, blocking commit: ${e.message}`);
  }
  if (result.block) respond('deny', result.reason);
  respond('allow');
});
