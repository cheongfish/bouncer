// scripts/lib/finalize.js
'use strict';
const { execFileSync } = require('node:child_process');
const { epicDirOf, toPosix } = require('./paths');
const { CONTEXT_ROOT } = require('./scaffold');
const { validateBlueprint, loadBlueprintDocs } = require('./validate');
const { clearCurrent } = require('./current');

function isUnder(file, entry) {
  const f = toPosix(file);
  const e = toPosix(entry);
  if (f === e) return true;
  const pref = e.endsWith('/') ? e : `${e}/`;
  return f.startsWith(pref);
}

// Build outputs and runtime state are never Bouncer-managed scope: they are
// neither staged nor reported as violations, so a repository without a
// .gitignore does not hard-stop finalize. `bouncer init` reports the entries a
// project should ignore; Bouncer never edits .gitignore itself.
// `.worktrees/` is no longer written — worktrees live outside the repository —
// but it stays here so a repository carrying one from an older layout is
// ignored rather than reported as out of scope.
const RUNTIME_ARTIFACTS = ['node_modules/', 'graphify-out/', '.worktrees/'];

function isRuntimeArtifact(file) {
  const f = toPosix(file);
  return RUNTIME_ARTIFACTS.some((entry) => isUnder(f, entry));
}

function makeAllowed({ affectedPaths, blueprintDir }) {
  const bp = toPosix(blueprintDir);
  const epicDir = epicDirOf(bp);
  const paths = Array.isArray(affectedPaths) ? affectedPaths : [];
  return function allowed(file) {
    const f = toPosix(file);
    if (isUnder(f, `${bp}/`)) return true;
    if (f === `${epicDir}/index.md`) return true;
    if (f === `${CONTEXT_ROOT}/index.md`) return true;
    return paths.some((p) => isUnder(f, p));
  };
}

// Subject and body follow whatever commit convention the project writes into
// its document titles; only the structure is ours. Keep identifiers and paths
// out of the message — they live in the blueprint docs and the PR body.
function buildCommitMessage(docs) {
  const bp = docs.blueprintIndex.data;
  const bouncer = bp.bouncer || {};
  const type = bouncer.commit_type || 'feat';
  const titleOf = (key) => (docs[key] && docs[key].data.title ? docs[key].data.title : '');

  const body = ['tasks', 'verification'].map(titleOf).filter(Boolean).map((t) => `- ${t}`);
  const lines = [`${type}: ${bp.title}`];
  if (body.length) lines.push('', ...body);
  return lines.join('\n');
}

function realGit(repoRoot) {
  const run = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  const lines = (s) => s.split('\n').filter(Boolean);
  return {
    changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
    untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
    stage: (files) => { if (files.length) run(['add', '--', ...files]); },
    commit: (msg) => { run(['commit', '-m', msg]); },
  };
}

function finalize({
  repoRoot, blueprintDir, yes = false, git, clearPointer = clearCurrent,
}) {
  const gitApi = git || realGit(repoRoot);

  const v = validateBlueprint({ repoRoot, blueprintDir, gate: 'finalize' });
  if (!v.ok) return { ok: false, reason: 'validate', failures: v.failures };

  const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const affectedPaths = docs.tasks && docs.tasks.data.bouncer
    ? docs.tasks.data.bouncer.affected_paths : [];
  const allowed = makeAllowed({ affectedPaths, blueprintDir });

  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  const all = [...new Set([...changed, ...untracked])].filter((f) => !isRuntimeArtifact(f));
  const violations = all.filter((f) => !allowed(f));
  if (violations.length) return { ok: false, reason: 'out-of-scope', violations };

  const commitMessage = buildCommitMessage(docs);
  if (!yes) return { ok: true, dryRun: true, staged: all, commitMessage };

  gitApi.stage(all);
  gitApi.commit(commitMessage);
  // The blueprint is done. Leaving the pointer in place would keep the commit
  // guard enforcing this blueprint's affected_paths against every later commit.
  const pointerCleared = clearPointer({ repoRoot });
  return {
    ok: true, committed: true, staged: all, commitMessage, pointerCleared,
  };
}

module.exports = {
  isUnder, isRuntimeArtifact, RUNTIME_ARTIFACTS, makeAllowed, buildCommitMessage, realGit, finalize,
};
