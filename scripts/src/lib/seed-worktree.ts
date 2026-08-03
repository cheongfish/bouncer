// scripts/lib/seed-worktree.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { epicDirOf, toPosix } = require('./paths');
const { CONTEXT_ROOT } = require('./layout');
const { isUnder } = require('./finalize');

// The plan workflow has no commit step, so epic/blueprint documents live only in
// the base working tree. `git worktree add` checks out the committed HEAD, so
// the execute worktree starts without the brief it is required to implement
// from. This module moves exactly the plan context documents across and returns
// the base to the state git had recorded.
//
// The moved set is deliberately the same boundary finalize.makeAllowed grants
// by default for context documents — the blueprint tree, the epic index, and
// the context index — minus the project Distill, which is a base-wide file the
// worktree must not carry. Code under affected_paths and unrelated local dirt
// (config, graph output) stay where they are.
function makeIsTarget({ blueprintDir }) {
  const bp = toPosix(blueprintDir);
  const epicIndex = `${epicDirOf(bp)}/index.md`;
  const contextIndex = `${CONTEXT_ROOT}/index.md`;
  return function isTarget(file) {
    const f = toPosix(file);
    if (isUnder(f, `${bp}/`)) return true;
    return f === epicIndex || f === contextIndex;
  };
}

function realGit(repoRoot) {
  const run = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  const lines = (s) => s.split('\n').filter(Boolean);
  return {
    // `diff HEAD` reports staged changes too, so a document the agent ran
    // `git add` on is classified here rather than as untracked.
    changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
    untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
    existsInHead: (file) => {
      try {
        // A missing path is the expected answer for every new plan document, so
        // git's "exists on disk, but not in HEAD" note is not an error here.
        execFileSync('git', ['cat-file', '-e', `HEAD:${file}`], {
          cwd: repoRoot,
          stdio: 'ignore',
        });
        return true;
      } catch {
        return false;
      }
    },
    readHead: (file) => {
      try {
        // `--filters` applies the working-tree filters (autocrlf, .gitattributes
        // text=auto) so the bytes compare equal to what a checkout wrote; a raw
        // `git show` would read every CRLF worktree as a conflict.
        return execFileSync('git', ['cat-file', '--filters', `HEAD:${file}`], {
          cwd: repoRoot,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
      } catch {
        return null;
      }
    },
    // `git checkout -- <path>` restores from the index, which still holds the
    // dirty blob once the agent has staged it; naming HEAD resets index and
    // working tree together so no staged ghost survives.
    restore: (file) => { run(['checkout', 'HEAD', '--', file]); },
    unstage: (file) => { run(['rm', '--cached', '--quiet', '--', file]); },
  };
}

// Removing a file can empty the directory tree the scaffold created. Git does
// not track directories, so an empty leftover is invisible to `git status` but
// visible to the next planning session; prune upward until something remains.
function pruneEmptyDirs(repoRoot, rel) {
  let dir = path.dirname(path.join(repoRoot, rel));
  const stop = path.resolve(repoRoot);
  while (path.resolve(dir) !== stop && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

function seedWorktree({
  repoRoot, blueprintDir, worktreePath, git,
}) {
  const gitApi = git || realGit(repoRoot);
  const isTarget = makeIsTarget({ blueprintDir });

  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  const changedSet = new Set(changed);
  const targets = [...new Set([...changed, ...untracked])].filter(isTarget).sort();
  if (!targets.length) return { ok: true, moved: [], restored: [] };

  if (!fs.existsSync(worktreePath) || !fs.statSync(worktreePath).isDirectory()) {
    return { ok: false, reason: 'missing-worktree', worktreePath };
  }

  // Phase 1 — copy and confirm. `git checkout --` and `git rm --cached` cannot
  // be undone, so the base is not touched until every target is known to exist
  // in the worktree with identical bytes. A differing file there means a
  // half-finished earlier run or hand editing; abort rather than overwrite.
  const conflicts = [];
  const pending = [];
  for (const rel of targets) {
    const src = path.join(repoRoot, rel);
    // `git diff HEAD` also lists deletions. There is nothing to carry over, but
    // the base still owes git a restore, so mark it for phase 2 without a copy.
    if (!fs.existsSync(src)) {
      pending.push({ rel, write: false, absent: true });
      continue;
    }
    const content = fs.readFileSync(src);
    const dst = path.join(worktreePath, rel);
    if (!fs.existsSync(dst)) {
      pending.push({ rel, write: true, dst, content });
    } else if (fs.readFileSync(dst).equals(content)) {
      pending.push({ rel, write: false });
    } else {
      // The worktree was checked out from HEAD, so every tracked target already
      // exists there as its HEAD blob. That is the pristine checkout, not
      // someone else's work: overwriting it is what "move the dirty version
      // across" means. Only content matching neither the base nor HEAD is a
      // real conflict — a half-finished earlier run or a hand edit.
      const head = gitApi.readHead(rel);
      if (head && fs.readFileSync(dst).equals(head)) pending.push({ rel, write: true, dst, content });
      else conflicts.push(rel);
    }
  }
  if (conflicts.length) return { ok: false, reason: 'conflict', conflicts };

  try {
    for (const item of pending) {
      if (!item.write) continue;
      fs.mkdirSync(path.dirname(item.dst), { recursive: true });
      fs.writeFileSync(item.dst, item.content);
    }
  } catch (error) {
    return { ok: false, reason: 'copy-failed', message: error.message };
  }

  // Phase 2 — return the base to what git recorded. HEAD membership, not the
  // staged/unstaged distinction alone, picks the verb: `git checkout --` only
  // works for a path HEAD knows, and a staged new file has no HEAD blob.
  // `moved` lists every target the worktree now holds — including one that was
  // already there byte-identical — because callers use it to confirm the brief
  // is readable, not to count file writes.
  const moved = [];
  const restored = [];
  for (const { rel, absent } of pending) {
    if (gitApi.existsInHead(rel)) {
      gitApi.restore(rel);
      restored.push(rel);
    } else {
      if (changedSet.has(rel)) gitApi.unstage(rel);
      fs.rmSync(path.join(repoRoot, rel), { force: true });
      pruneEmptyDirs(repoRoot, rel);
    }
    // A path deleted in the base was never copied, so it is restored, not moved.
    if (!absent) moved.push(rel);
  }
  return { ok: true, moved, restored };
}

module.exports = { makeIsTarget, realGit, seedWorktree };
