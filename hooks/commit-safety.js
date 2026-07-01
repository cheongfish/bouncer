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
  const result = evaluateCommit({ command, repoRoot });
  if (result.block) {
    process.stderr.write(`${result.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
});
