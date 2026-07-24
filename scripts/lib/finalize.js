// scripts/lib/finalize.js
'use strict';
const { execFileSync } = require('node:child_process');
const { epicDirOf, toPosix } = require('./paths');
const { CONTEXT_ROOT } = require('./scaffold');
const { validateBlueprint, loadBlueprintDocs } = require('./validate');

function isUnder(file, entry) {
  const f = toPosix(file);
  const e = toPosix(entry);
  if (f === e) return true;
  const pref = e.endsWith('/') ? e : `${e}/`;
  return f.startsWith(pref);
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

function line(list, value) {
  list.push(value);
}

function buildCommitMessage(docs) {
  const bp = docs.blueprintIndex.data;
  const bouncer = bp.bouncer || {};
  const type = bouncer.commit_type || 'feat';
  const bpId = bouncer.id;
  const epicId = bouncer.epic_id;
  const summary = bp.title;
  const taskSummary = docs.tasks && docs.tasks.data.title ? docs.tasks.data.title : '';
  const verifySummary = docs.verification && docs.verification.data.title
    ? docs.verification.data.title : '';
  const distillPath = docs.distill && docs.distill.data.resource
    ? docs.distill.data.resource : '';
  const out = [];
  line(out, `${type}(${bpId}): ${summary}`);
  line(out, '');
  line(out, `Epic: ${epicId}`);
  line(out, `Blueprint: ${bpId}`);
  line(out, '');
  line(out, 'Implemented:');
  line(out, `- ${taskSummary}`);
  line(out, '');
  line(out, 'Verified:');
  line(out, `- ${verifySummary}`);
  line(out, '');
  line(out, 'Distilled:');
  line(out, `- ${distillPath}`);
  return out.join('\n');
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

function finalize({ repoRoot, blueprintDir, yes = false, git }) {
  const gitApi = git || realGit(repoRoot);

  const v = validateBlueprint({ repoRoot, blueprintDir, gate: 'finalize' });
  if (!v.ok) return { ok: false, reason: 'validate', failures: v.failures };

  const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const affectedPaths = docs.tasks && docs.tasks.data.bouncer
    ? docs.tasks.data.bouncer.affected_paths : [];
  const allowed = makeAllowed({ affectedPaths, blueprintDir });

  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  const all = [...new Set([...changed, ...untracked])];
  const violations = all.filter((f) => !allowed(f));
  if (violations.length) return { ok: false, reason: 'out-of-scope', violations };

  const commitMessage = buildCommitMessage(docs);
  if (!yes) return { ok: true, dryRun: true, staged: all, commitMessage };

  gitApi.stage(all);
  gitApi.commit(commitMessage);
  return { ok: true, committed: true, staged: all, commitMessage };
}

module.exports = {
  isUnder, makeAllowed, buildCommitMessage, realGit, finalize,
};
