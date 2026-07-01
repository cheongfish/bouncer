'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { renderDoc } = require('./render');

function writeRel(repoRoot, rel, data, body) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderDoc(data, body));
  return rel;
}

function okf(type, title, description, resource, tags, timestamp, sdd) {
  return { type, title, description, resource, tags, timestamp, sdd };
}

function scaffoldEpic({ repoRoot, epicId, name, timestamp }) {
  const dir = `context/epics/${epicId}-${name}`;
  const rel = `${dir}/index.md`;
  const data = okf('sdd.epic', `${epicId} ${name}`, `Epic ${epicId}`, rel,
    ['sdd', 'epic'], timestamp,
    { id: epicId, epic_id: epicId, status: 'draft' });
  return [writeRel(repoRoot, rel, data, `# ${epicId} ${name}\n`)];
}

function scaffoldBlueprint({ repoRoot, epicDir, blueprintId, name, timestamp }) {
  const epicId = /EPIC-\d+/.exec(epicDir)[0];
  const dir = `${epicDir}/blueprints/${blueprintId}-${name}`;
  const created = [];

  const idx = `${dir}/index.md`;
  created.push(writeRel(repoRoot, idx,
    okf('sdd.blueprint', `${blueprintId} ${name}`, `Blueprint ${blueprintId}`, idx,
      ['sdd', 'blueprint'], timestamp,
      { id: blueprintId, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }),
    `# ${blueprintId} ${name}\n`));

  const tasks = `${dir}/tasks.md`;
  created.push(writeRel(repoRoot, tasks,
    okf('sdd.tasks', `${blueprintId} tasks`, `Tasks for ${blueprintId}`, tasks,
      ['sdd', 'tasks'], timestamp,
      {
        id: `TASKS-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        affected_paths: [],
        graph: { generated_at: timestamp, command: 'mcp:graphify', suggested_paths: [] },
      }),
    '# Tasks\n\n- [ ] TODO\n'));

  const verify = `${dir}/verification.md`;
  created.push(writeRel(repoRoot, verify,
    okf('sdd.verification', `${blueprintId} verification`, `Verification for ${blueprintId}`, verify,
      ['sdd', 'verification'], timestamp,
      { id: `VERIFY-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending' }),
    '# Verification\n'));

  const review = `${dir}/review.md`;
  created.push(writeRel(repoRoot, review,
    okf('sdd.review', `${blueprintId} review`, `Review for ${blueprintId}`, review,
      ['sdd', 'review'], timestamp,
      { id: `REVIEW-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'pending',
        review: { required: true } }),
    '# Review\n'));

  const distill = `${dir}/distill.md`;
  created.push(writeRel(repoRoot, distill,
    okf('sdd.distill', `${blueprintId} distill`, `Distill for ${blueprintId}`, distill,
      ['sdd', 'distill'], timestamp,
      { id: `DISTILL-${blueprintId}`, epic_id: epicId, blueprint_id: blueprintId, status: 'draft' }),
    '# Distill\n'));

  return created;
}

module.exports = { scaffoldEpic, scaffoldBlueprint };
