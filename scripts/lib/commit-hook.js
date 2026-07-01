// scripts/lib/commit-hook.js
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { checkCommitSafety } = require('./commit-guard');
const { readCurrent } = require('./current');
const { readDoc } = require('./frontmatter');

function isGitCommit(command) {
  if (typeof command !== 'string') return false;
  return /\bgit\b(?:\s+-C\s+\S+)?[\s\S]*?\bcommit\b/.test(command);
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

function evaluateCommit({ command, repoRoot, deps }) {
  const d = {
    readCurrent, readAffectedPaths, stagedFiles: realStagedFiles, ...(deps || {}),
  };
  if (!isGitCommit(command)) return { block: false };
  const current = d.readCurrent({ repoRoot });
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

module.exports = { isGitCommit, readAffectedPaths, evaluateCommit, realStagedFiles, fs };
