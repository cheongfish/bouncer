#!/usr/bin/env node
'use strict';
// PreToolUse hook: guards every `git commit` in the worktree against the
// active blueprint's affected_paths. Blocks by exiting 2 with the reason on
// stderr (Claude Code block semantics); allows by exiting 0.
const { evaluateCommit } = require('../scripts/lib/commit-hook');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { process.exit(0); }
  const command = payload.tool_input && payload.tool_input.command
    ? payload.tool_input.command : '';
  const repoRoot = payload.cwd || process.cwd();
  let result;
  try {
    result = evaluateCommit({ command, repoRoot });
  } catch (e) {
    // Fail closed: at this point evaluateCommit has already returned early
    // for non-commit commands and for "no active blueprint" (both of which
    // cannot throw), so a throw here means a genuine failure while
    // inspecting a commit with an active blueprint — we cannot prove the
    // commit is in-scope, so block it.
    process.stderr.write(`commit-safety: internal error, blocking commit: ${e.message}\n`);
    process.exit(2);
  }
  if (result.block) {
    process.stderr.write(`${result.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
});
