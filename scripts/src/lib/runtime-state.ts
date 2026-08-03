'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const { toPosix } = require('./paths');

const GIT_REQUIRED = 'Bouncer requires a Git repository for an active blueprint';

function runtimePaths({
  repoRoot,
  execFileSync = realExecFileSync,
  // env / platform kept for call-site compatibility; worktrees are in-repo now.
  env: _env = process.env,
  platform = process.platform,
}) {
  const pathApi = platform === 'win32' ? path.win32 : path;
  let commonDir;
  try {
    commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    return { unavailable: true, reason: error.message || 'Git common directory unavailable' };
  }
  if (!commonDir) {
    return { unavailable: true, reason: 'Git common directory unavailable' };
  }

  const commonGitDir = pathApi.resolve(repoRoot, commonDir);
  // dirname(.git) is the main worktree root for a normal repo, so linked
  // checkouts share the same `.worktrees/` instead of nesting under themselves.
  const mainRoot = pathApi.dirname(commonGitDir);
  return {
    commonGitDir,
    currentFile: pathApi.join(commonGitDir, 'bouncer', 'current'),
    worktreeRoot: pathApi.join(mainRoot, '.worktrees'),
  };
}

function resolvedPaths({ repoRoot, deps }) {
  const d = deps || {};
  return runtimePaths({
    repoRoot,
    execFileSync: d.execFileSync,
    env: d.env,
    platform: d.platform,
  });
}

function readRuntimeCurrent({ repoRoot, deps }) {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable || !d.fs.existsSync(paths.currentFile)) return null;
  try {
    const data = JSON.parse(d.fs.readFileSync(paths.currentFile, 'utf8').trim());
    if (!data || typeof data.blueprint !== 'string' || typeof data.base !== 'string') return null;
    return { blueprint: toPosix(data.blueprint), base: data.base };
  } catch (_error) {
    return null;
  }
}

// Returns true when a pointer was removed, false when there was none. Callers
// treat "already absent" as success, so this must not throw on a missing file.
function clearRuntimeCurrent({ repoRoot, deps }) {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable || !d.fs.existsSync(paths.currentFile)) return false;
  d.fs.rmSync(paths.currentFile);
  return true;
}

function writeRuntimeCurrent({
  repoRoot, blueprint, base, deps,
}) {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable) throw new Error(GIT_REQUIRED);
  d.fs.mkdirSync(path.dirname(paths.currentFile), { recursive: true });
  const data = { blueprint: toPosix(blueprint), base };
  d.fs.writeFileSync(paths.currentFile, `${JSON.stringify(data, null, 2)}\n`);
  return paths.currentFile;
}

function ensureWorktreeRoot({ repoRoot, deps }) {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable) throw new Error(GIT_REQUIRED);
  d.fs.mkdirSync(paths.worktreeRoot, { recursive: true });
  return paths.worktreeRoot;
}

module.exports = {
  runtimePaths, readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent, ensureWorktreeRoot,
};
