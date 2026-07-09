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
  const parseErrors = [];
  for (const [key, rel] of Object.entries(rels)) {
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs)) {
      try {
        const { data, body } = readDoc(abs);
        docs[key] = { data, body, rel };
      } catch (e) {
        parseErrors.push({ code: 'S0', message: e.message, file: rel });
      }
    }
  }
  return { docs, rels, parseErrors };
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
  const { docs, rels, parseErrors } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const failures = [...parseErrors];

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

function statusOf(doc) {
  return doc && doc.data && doc.data.sdd ? doc.data.sdd.status : undefined;
}

const SECTION_DEFS = [
  { key: 'goal', re: /^##\s+(Goal\s*&\s*intent|목적[·・.]?의도)\s*$/i },
  { key: 'interface', re: /^##\s+(Interface|인터페이스)\s*$/i },
  { key: 'touch', re: /^##\s+(Touch|수정할\s*부분)\s*$/i },
  { key: 'doNotTouch', re: /^##\s+(Do\s+not\s+touch|절대\s*수정\s*금지)\s*$/i },
  { key: 'checklist', re: /^##\s+(Checklist|체크리스트)\s*$/i },
];

function parseTasksSections(body) {
  const text = typeof body === 'string' ? body : '';
  const lines = text.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    for (const def of SECTION_DEFS) {
      if (def.re.test(lines[i].trim())) starts.push({ key: def.key, line: i });
    }
  }
  const out = { goal: null, interface: null, touch: null, doNotTouch: null, checklist: null };
  for (let s = 0; s < starts.length; s++) {
    const { key, line } = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].line : lines.length;
    out[key] = lines.slice(line + 1, end).join('\n').trim() || null;
  }
  return out;
}

function extractPathCandidates(text) {
  const raw = typeof text === 'string' ? text : '';
  const found = new Set();
  for (const m of raw.matchAll(/`([^`]+)`/g)) {
    const p = toPosix(m[1].trim()).replace(/^\.\//, '');
    if (p) found.add(p);
  }
  for (const tok of raw.split(/[\s,;]+/)) {
    const p = toPosix(tok.trim()).replace(/^\.\//, '');
    if (!p || p.includes('`')) continue;
    if (!/^[A-Za-z0-9_./-]+$/.test(p)) continue;
    if (!p.includes('/') && !/\.[A-Za-z0-9]+$/.test(p)) continue;
    found.add(p);
  }
  return [...found];
}

function pathsOverlap(a, b) {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

function pathJustifiedByTouch(ap, touchText) {
  if (touchText.includes(ap)) return true;
  return extractPathCandidates(touchText).some(
    (c) => ap === c || ap.startsWith(c.endsWith('/') ? c : `${c}/`),
  );
}

function checkGate(gate, docs, rels, failures) {
  const add = (code, message, fileKey) =>
    failures.push({ code, message, file: rels[fileKey] });

  if (gate === 'plan') {
    if (statusOf(docs.epicIndex) !== 'approved') add('G1', 'epic.status != approved', 'epicIndex');
    if (statusOf(docs.blueprintIndex) !== 'approved') add('G2', 'blueprint.status != approved', 'blueprintIndex');
    if (statusOf(docs.tasks) !== 'ready') add('G3', 'tasks.status != ready', 'tasks');
    const suggested = docs.tasks && docs.tasks.data.sdd && docs.tasks.data.sdd.graph
      ? docs.tasks.data.sdd.graph.suggested_paths : undefined;
    if (!Array.isArray(suggested)) add('G4', 'tasks.graph.suggested_paths missing', 'tasks');
    const ap = docs.tasks && docs.tasks.data.sdd ? docs.tasks.data.sdd.affected_paths : undefined;
    if (!Array.isArray(ap) || ap.length === 0) add('G5', 'tasks.affected_paths missing or empty', 'tasks');
    const tasksBody = docs.tasks && typeof docs.tasks.body === 'string' ? docs.tasks.body : '';
    const sections = parseTasksSections(tasksBody);
    const missing = ['goal', 'interface', 'touch', 'doNotTouch', 'checklist']
      .filter((k) => !sections[k]);
    if (missing.length) {
      add('G10', `tasks missing implementation-ready sections: ${missing.join(', ')}`, 'tasks');
    } else {
      const apList = Array.isArray(ap)
        ? ap.map((p) => toPosix(String(p)).replace(/^\.\//, ''))
        : [];
      const unjustified = apList.filter((p) => !pathJustifiedByTouch(p, sections.touch));
      if (unjustified.length) {
        add('G11', `affected_paths not justified by Touch: ${unjustified.join(', ')}`, 'tasks');
      }
      const forbidden = extractPathCandidates(sections.doNotTouch);
      const overlap = apList.filter((p) => forbidden.some((f) => pathsOverlap(p, f)));
      if (overlap.length) {
        add('G12', `do-not-touch intersects affected_paths: ${overlap.join(', ')}`, 'tasks');
      }
    }
    return;
  }
  if (gate === 'execute') {
    if (statusOf(docs.tasks) !== 'verified') add('G6', 'tasks.status != verified', 'tasks');
    if (statusOf(docs.verification) !== 'passed') add('G7', 'verification.status != passed', 'verification');
    const review = docs.review && docs.review.data.sdd ? docs.review.data.sdd.review : undefined;
    const reviewOk = statusOf(docs.review) === 'accepted' || (review && review.required === false);
    if (!reviewOk) add('G8', 'review not accepted and review.required != false', 'review');
    return;
  }
  if (gate === 'finalize') {
    if (statusOf(docs.distill) !== 'published') add('G9', 'distill.status != published', 'distill');
    return;
  }
  throw new Error(`unknown gate: ${gate}`);
}

module.exports = {
  loadBlueprintDocs, checkStructural, checkGate, validateBlueprint,
  parseTasksSections, extractPathCandidates,
};
