#!/usr/bin/env node
'use strict';
// SessionStart hook: incrementally builds the graphify source graph over
// config.source_dirs when .bouncer/ exists and graphify is available. Never fails
// the session — always exits 0.
const { execFileSync } = require('node:child_process');
const { planSessionGraph } = require('../scripts/lib/session-graph');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { payload = {}; }
  const repoRoot = payload.cwd || process.cwd();
  try {
    const decision = planSessionGraph({ repoRoot });
    if (decision.action === 'build' && decision.dirs.length) {
      execFileSync('graphify', [...decision.dirs, '--update', '--no-viz'], {
        cwd: repoRoot, stdio: 'ignore',
      });
    }
  } catch (_e) { /* never block the session on graph build failure */ }
  process.exit(0);
});
