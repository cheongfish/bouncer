'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM } = require('./schema');
const { readDoc } = require('./frontmatter');
const { parsePathIds, epicDirOf, toPosix } = require('./paths');

function loadBlueprintDocs({ repoRoot, blueprintDir }) {
  const bp = toPosix(blueprintDir);
  const rels = {
    epicIndex: `${epicDirOf(bp)}/index.md`,
    blueprintIndex: `${bp}/index.md`,
    tasks: `${bp}/tasks.md`,
    verification: `${bp}/verification.md`,
    review: `${bp}/review.md`,
    distill: `${bp}/distill.md`,
  };
  const docs = {};
  for (const [key, rel] of Object.entries(rels)) {
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs)) {
      docs[key] = { data: readDoc(abs).data, rel };
    }
  }
  return { docs, rels };
}

function checkStructural(doc, failures) {
  const { data, rel } = doc;
  const add = (code, message) => failures.push({ code, message, file: rel });

  for (const f of OKF_REQUIRED) {
    const v = data[f];
    if (v === undefined || v === null || v === '') add('S1', `OKF field missing: ${f}`);
  }
  if (!TYPES.includes(data.type)) {
    add('S2', `unknown type: ${data.type}`);
    return; // type-dependent checks cannot proceed
  }
  if (data.resource !== rel) {
    add('S3', `resource path mismatch: ${data.resource} != ${rel}`);
  }

  const sdd = data.sdd || {};
  const prefix = ID_PREFIX[data.type];
  if (typeof sdd.id !== 'string' || !sdd.id.startsWith(prefix)) {
    add('S4', `id "${sdd.id}" missing prefix ${prefix}`);
  }

  const parsed = parsePathIds(rel);
  if (parsed.epicId && sdd.epic_id !== parsed.epicId) {
    add('S5', `epic_id ${sdd.epic_id} != path ${parsed.epicId}`);
  }
  if (data.type !== 'sdd.epic' && parsed.blueprintId && sdd.blueprint_id !== parsed.blueprintId) {
    add('S5', `blueprint_id ${sdd.blueprint_id} != path ${parsed.blueprintId}`);
  }
  let expectedId = null;
  if (data.type === 'sdd.epic') expectedId = parsed.epicId;
  else if (data.type === 'sdd.blueprint') expectedId = parsed.blueprintId;
  else if (parsed.blueprintId) expectedId = `${prefix}${parsed.blueprintId}`;
  if (expectedId && sdd.id !== expectedId) {
    add('S5', `id ${sdd.id} != expected ${expectedId} from path`);
  }

  if (!(STATUS_ENUM[data.type] || []).includes(sdd.status)) {
    add('S6', `status "${sdd.status}" not in enum for ${data.type}`);
  }

  if (data.type === 'sdd.tasks') {
    const ap = sdd.affected_paths;
    if (!Array.isArray(ap) || ap.length === 0) {
      add('S7', 'tasks.affected_paths missing or empty');
    }
  }
}

function validateBlueprint({ repoRoot, blueprintDir, gate }) {
  const failures = [];
  const { docs, rels } = loadBlueprintDocs({ repoRoot, blueprintDir });

  const anyLeaf = ['tasks', 'verification', 'review', 'distill'].some((k) => docs[k]);
  if (anyLeaf && !docs.blueprintIndex) {
    failures.push({ code: 'S8', message: 'blueprint index.md absent', file: rels.blueprintIndex });
  }
  if (docs.blueprintIndex && !docs.epicIndex) {
    failures.push({ code: 'S8', message: 'epic index.md absent', file: rels.epicIndex });
  }

  for (const key of Object.keys(docs)) checkStructural(docs[key], failures);

  if (gate) checkGate(gate, docs, rels, failures); // implemented in Task 6

  return { ok: failures.length === 0, failures };
}

// Placeholder replaced in Task 6.
function checkGate() {}

module.exports = { loadBlueprintDocs, checkStructural, validateBlueprint };
