'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function realHasSdd(repoRoot) {
  return fs.existsSync(path.join(repoRoot, '.sdd', 'config.json'));
}

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

function realSourceDirs(repoRoot) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, '.sdd', 'config.json'), 'utf8'));
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
    hasSdd: () => realHasSdd(repoRoot),
    hasGraphify: () => realHasGraphify(),
    sourceDirs: () => realSourceDirs(repoRoot),
    existingDirs: (dirs) => realExistingDirs(repoRoot, dirs),
    newestMtime: (dirs) => realNewestMtime(repoRoot, dirs),
    graphMtime: () => realGraphMtime(repoRoot),
    ...(deps || {}),
  };
  if (!d.hasSdd()) return { action: 'skip-no-sdd', reason: 'no .sdd/ in project' };
  if (!d.hasGraphify()) return { action: 'skip-no-graphify', reason: 'graphify not on PATH' };
  const dirs = d.existingDirs(d.sourceDirs());
  const graphMtime = d.graphMtime();
  if (graphMtime === null) return { action: 'build', dirs, reason: 'graph missing' };
  const newest = d.newestMtime(dirs);
  if (newest <= graphMtime) return { action: 'skip-fresh', reason: 'graph is up to date' };
  return { action: 'build', dirs, reason: 'sources changed since last build' };
}

module.exports = { planSessionGraph };
