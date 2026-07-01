// scripts/lib/finalize.js
'use strict';
const { epicDirOf, toPosix } = require('./paths');

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
    if (f === 'context/index.md') return true;
    return paths.some((p) => isUnder(f, p));
  };
}

function line(list, value) {
  list.push(value);
}

function buildCommitMessage(docs) {
  const bp = docs.blueprintIndex.data;
  const sdd = bp.sdd || {};
  const type = sdd.commit_type || 'feat';
  const bpId = sdd.id;
  const epicId = sdd.epic_id;
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

module.exports = { isUnder, makeAllowed, buildCommitMessage };
