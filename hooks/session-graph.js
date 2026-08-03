#!/usr/bin/env node
'use strict';
// SessionStart hook: when config.graphify.enabled is true, incrementally builds
// source + context graphify graphs if stale. Never fails the session — always exits 0.
const { syncSessionGraphs } = require('../scripts/lib/session-graph');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let payload;
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch (_e) { payload = {}; }
  const repoRoot = payload.cwd || process.cwd();
  try {
    const decision = syncSessionGraphs({ repoRoot });
    if (decision.bootstrap === 'partial') {
      process.stderr.write(
        'Bouncer: partial Bouncer state detected; preserving .bouncer and skipping SessionStart work.\n',
      );
    } else if (decision.bootstrap === 'legacy') {
      process.stderr.write(
        'Bouncer: legacy state detected; remove or migrate legacy files, then run /bouncer-init.\n',
      );
    } else if (decision.action === 'skip-no-graphify') {
      // Only when opted in (enabled) but CLI missing — default-disabled stays silent.
      process.stderr.write(
        'Bouncer: graphify.enabled is true but graphify is not on PATH — path suggestions '
        + 'will fall back to manual affected_paths. '
        + 'Install: pip install graphifyy && graphify install. See docs/install.md.\n',
      );
    } else if (decision.failed && decision.failed.length) {
      process.stderr.write(
        `Bouncer: graphify sync failed for ${decision.failed.map((f) => f.name).join(', ')}. `
        + 'Plan will re-check; confirm affected_paths manually if graphs stay stale.\n',
      );
    }
  } catch (_e) { /* never block the session on graph build failure */ }
  process.exit(0);
});
