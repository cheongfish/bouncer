// scripts/lib/commit-hook.js
'use strict';
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkCommitSafety } = require('./commit-guard');
const { readCurrent } = require('./current');
const { readDoc } = require('./frontmatter');

function segmentIsGitCommit(segment) {
  const tokens = segment.trim().split(/\s+/).filter(Boolean);
  const gitIdx = tokens.indexOf('git');
  if (gitIdx === -1) return false;
  const consumesValue = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
  let i = gitIdx + 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.startsWith('-')) {
      i += consumesValue.has(t) ? 2 : 1;
      continue;
    }
    return t === 'commit';
  }
  return false;
}

function isGitCommit(command) {
  if (typeof command !== 'string') return false;
  return command.split(/&&|\|\||[;|\n]/).some(segmentIsGitCommit);
}

function readAffectedPaths({ repoRoot, blueprintDir }) {
  try {
    const abs = path.join(repoRoot, blueprintDir, 'tasks.md');
    const { data } = readDoc(abs);
    const ap = data && data.sdd ? data.sdd.affected_paths : undefined;
    return Array.isArray(ap) ? ap : [];
  } catch (_e) {
    return [];
  }
}

function realStagedFiles({ repoRoot }) {
  const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repoRoot, encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

// When `repoRoot` is a linked worktree, its `.sdd/current` may be absent
// (the file is gitignored, so a fresh worktree checkout won't carry it over).
// Fall back to the main repo's working tree pointer, resolved via the git
// common dir, so the commit-safety guard still finds the active blueprint.
function realMainRepoCurrent({ repoRoot }) {
  try {
    const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: repoRoot, encoding: 'utf8',
    }).trim();
    const absCommonDir = path.resolve(repoRoot, commonDir);
    const localGitDir = path.resolve(repoRoot, '.git');
    if (absCommonDir === localGitDir) return null;
    const mainRoot = path.dirname(absCommonDir);
    return readCurrent({ repoRoot: mainRoot });
  } catch (_e) {
    return null;
  }
}

function evaluateCommit({ command, repoRoot, deps }) {
  const d = {
    readCurrent,
    readAffectedPaths,
    stagedFiles: realStagedFiles,
    mainRepoCurrent: realMainRepoCurrent,
    ...(deps || {}),
  };
  if (!isGitCommit(command)) return { block: false };
  const current = d.readCurrent({ repoRoot }) || d.mainRepoCurrent({ repoRoot });
  if (!current) return { block: false };
  const affectedPaths = d.readAffectedPaths({ repoRoot, blueprintDir: current.blueprint });
  const files = d.stagedFiles({ repoRoot });
  const { allow, violations } = checkCommitSafety({
    files, affectedPaths, blueprintDir: current.blueprint,
  });
  if (allow) return { block: false };
  return {
    block: true,
    reason: `commit blocked: files outside affected_paths: ${violations.join(', ')}`,
  };
}

module.exports = {
  isGitCommit, readAffectedPaths, evaluateCommit, realStagedFiles, realMainRepoCurrent,
};
