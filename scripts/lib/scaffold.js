'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { CONTEXT_ROOT, normalizeRepoPath, isCanonicalEpicDir } = require('./layout');
const { renderDoc } = require('./render');

function writeRel(repoRoot, rel, data, body) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderDoc(data, body));
  return rel;
}

function bouncerDoc(type, title, description, resource, tags, timestamp, bouncer) {
  return { type, title, description, resource, tags, timestamp, bouncer };
}

function scaffoldEpic({ repoRoot, epicId, name, timestamp }) {
  const dir = `${CONTEXT_ROOT}/epics/${epicId}-${name}`;
  const rel = `${dir}/index.md`;
  const data = bouncerDoc('bouncer.epic', `${epicId} ${name}`, `Epic ${epicId}`, rel,
    ['bouncer', 'epic'], timestamp,
    { id: epicId, epic_id: epicId, status: 'draft' });
  return [writeRel(repoRoot, rel, data, `# ${epicId} ${name}\n`)];
}

function scaffoldBlueprint({ repoRoot, epicDir, blueprintId, name, timestamp }) {
  if (!isCanonicalEpicDir(epicDir)) {
    throw new Error(`epicDir must be under ${CONTEXT_ROOT}/epics`);
  }
  const canonicalEpicDir = normalizeRepoPath(epicDir);
  const epicId = /EPIC-\d+/.exec(canonicalEpicDir)[0];
  const dir = `${canonicalEpicDir}/blueprints/${blueprintId}-${name}`;
  const created = [];

  const idx = `${dir}/index.md`;
  created.push(writeRel(repoRoot, idx,
    bouncerDoc('bouncer.blueprint', `${blueprintId} ${name}`, `Blueprint ${blueprintId}`, idx,
      ['bouncer', 'blueprint'], timestamp,
      { id: blueprintId, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }),
    `# ${blueprintId} ${name}\n`));

  const tasks = `${dir}/tasks.md`;
  created.push(writeRel(repoRoot, tasks,
    bouncerDoc('bouncer.tasks', `${blueprintId} tasks`, `Tasks for ${blueprintId}`, tasks,
      ['bouncer', 'tasks'], timestamp,
      {
        id: `TASKS-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        affected_paths: [],
        graph: {
          generated_at: timestamp,
          command: 'mcp:graphify',
          suggested_paths: [],
          basis: 'scaffold-default',
        },
      }),
    '# Tasks\n\n- [ ] TODO\n'));

  const verify = `${dir}/verification.md`;
  created.push(writeRel(repoRoot, verify,
    bouncerDoc('bouncer.verification', `${blueprintId} verification`, `Verification for ${blueprintId}`, verify,
      ['bouncer', 'verification'], timestamp,
      { id: `VERIFY-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending' }),
    '# Verification\n'));

  const review = `${dir}/review.md`;
  created.push(writeRel(repoRoot, review,
    bouncerDoc('bouncer.review', `${blueprintId} review`, `Review for ${blueprintId}`, review,
      ['bouncer', 'review'], timestamp,
      { id: `REVIEW-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending',
        review: { required: true } }),
    '# Review\n'));

  const distill = `${dir}/distill.md`;
  created.push(writeRel(repoRoot, distill,
    bouncerDoc('bouncer.distill', `${blueprintId} distill`, `Distill for ${blueprintId}`, distill,
      ['bouncer', 'distill'], timestamp,
      { id: `DISTILL-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }),
    '# Distill\n'));

  return created;
}

module.exports = { CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint };
