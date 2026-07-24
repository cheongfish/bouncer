'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { init, inspectBootstrap } = require('./init');

function realHasGraphify() {
  try {
    execFileSync('graphify', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (_e) {
    try {
      execFileSync('command', ['-v', 'graphify'], { stdio: 'ignore', shell: true });
      return true;
    } catch (_e2) { return false; }
  }
}

function realGraphifyEnabled(repoRoot) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer', 'config.json'), 'utf8'));
    return cfg.graphify?.enabled === true;
  } catch (_e) { return false; }
}

function realSourceDirs(repoRoot) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer', 'config.json'), 'utf8'));
    return Array.isArray(cfg.source_dirs) ? cfg.source_dirs : [];
  } catch (_e) { return []; }
}

function realExistingDirs(repoRoot, dirs) {
  return dirs.filter((d) => fs.existsSync(path.join(repoRoot, d)));
}

function newestMtimeUnder(repoRoot, dir) {
  const root = path.join(repoRoot, dir);
  let newest = 0;
  const walk = (abs) => {
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entries) {
      const child = path.join(abs, e.name);
      if (e.isDirectory()) { walk(child); continue; }
      const m = fs.statSync(child).mtimeMs;
      if (m > newest) newest = m;
    }
  };
  walk(root);
  return newest;
}

function realNewestMtime(repoRoot, dirs) {
  return dirs.reduce((max, d) => Math.max(max, newestMtimeUnder(repoRoot, d)), 0);
}

function realGraphMtime(repoRoot) {
  const abs = path.join(repoRoot, 'graphify-out', 'graph.json');
  return fs.existsSync(abs) ? fs.statSync(abs).mtimeMs : null;
}

function planSessionGraph({ repoRoot, deps }) {
  const d = {
    inspectBootstrap: () => inspectBootstrap({ repoRoot }),
    init: () => init({ repoRoot, timestamp: new Date().toISOString() }),
    graphifyEnabled: () => realGraphifyEnabled(repoRoot),
    hasGraphify: () => realHasGraphify(),
    sourceDirs: () => realSourceDirs(repoRoot),
    existingDirs: (dirs) => realExistingDirs(repoRoot, dirs),
    newestMtime: (dirs) => realNewestMtime(repoRoot, dirs),
    graphMtime: () => realGraphMtime(repoRoot),
    ...(deps || {}),
  };
  let bootstrap = d.inspectBootstrap();
  if (bootstrap === 'missing') {
    const initialized = d.init();
    if (!initialized.ok) {
      return { bootstrap: 'partial', action: 'skip-partial-bootstrap', reason: initialized.reason };
    }
    bootstrap = initialized.skipped ? 'ready' : 'created';
  }
  if (bootstrap === 'partial') {
    return { bootstrap, action: 'skip-partial-bootstrap', reason: 'partial-bouncer-state' };
  }
  if (bootstrap === 'legacy') {
    return { bootstrap, action: 'skip-legacy-bootstrap', reason: 'legacy-bootstrap-state' };
  }
  if (!d.graphifyEnabled()) {
    return { bootstrap, action: 'skip-graph-disabled', reason: 'graphify auto-build disabled' };
  }
  if (!d.hasGraphify()) {
    return { bootstrap, action: 'skip-no-graphify', reason: 'graphify not on PATH' };
  }
  const dirs = d.existingDirs(d.sourceDirs());
  const graphMtime = d.graphMtime();
  if (graphMtime === null) return { bootstrap, action: 'build', dirs, reason: 'graph missing' };
  const newest = d.newestMtime(dirs);
  if (newest <= graphMtime) {
    return { bootstrap, action: 'skip-fresh', reason: 'graph is up to date' };
  }
  return { bootstrap, action: 'build', dirs, reason: 'sources changed since last build' };
}

module.exports = { planSessionGraph };
