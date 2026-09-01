#!/usr/bin/env node
'use strict';
// SessionStart hook: when config.graphify.enabled is true, incrementally builds
// source / test / context graphify graphs if stale. graphs[] always reports three
// scopes; skip-unconfigured test (unset/invalid test_dirs) is not a build target
// and does not emit a missing warning. Never fails the session — always exits 0.
// Warning copy lives in session-graph.graphSyncWarnings so tests cover the strings.
const { syncSessionGraphs, graphSyncWarnings } = require('../scripts/lib/session-graph');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { payload = {}; }
  const repoRoot = payload.cwd || process.cwd();
  try {
    const decision = syncSessionGraphs({ repoRoot });
    for (const line of graphSyncWarnings(decision)) process.stderr.write(line);
  } catch (_e) { /* never block the session on graph build failure */ }
  process.exit(0);
});
