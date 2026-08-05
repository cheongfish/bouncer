'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, detectLegacyFormat } = require('./schema');
const { readDoc } = require('./frontmatter');
const { CONTEXT_ROOT, isCanonicalBlueprintDir } = require('./layout');
const {
  parsePathIds, epicDirOf, toPosix, isNumericContextId, normalizeContextId,
} = require('./paths');
const { isValidVerifyCommand, runVerification } = require('./verification');
const { computeDiffSha, EXPLAIN_SECTION_DEFS } = require('./comprehension');
const { readCurrent } = require('./current');
const { checkEpicIndexConsistency } = require('./epic-index');

function loadBlueprintDocs({ repoRoot, blueprintDir }) {
  const bp = toPosix(blueprintDir);
  const rels = {
    epicIndex: `${epicDirOf(bp)}/index.md`,
    blueprintIndex: `${bp}/index.md`,
    tasks: `${bp}/tasks.md`,
    verification: `${bp}/verification.md`,
    review: `${bp}/review.md`,
    explain: `${bp}/explain.md`,
  };
  const docs: Record<string, any> = {};
  const parseErrors: Array<{ code: string; message: string; file: string }> = [];
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

// 존재 여부만 확인: 가볍고 파싱하지 않아야 함. execute gate가 verification을
// 다시 실행(verification.md를 다시 씀)하기 전에 호출되기 때문.
function blueprintDocsExist({ repoRoot, blueprintDir }) {
  const bp = toPosix(blueprintDir);
  return ['index.md', 'tasks.md', 'verification.md', 'review.md', 'explain.md']
    .some((name) => fs.existsSync(path.join(repoRoot, bp, name)));
}

function checkStructural(doc, failures) {
  const { data, rel } = doc;
  const add = (code, message) => failures.push({ code, message, file: rel });

  const legacy = detectLegacyFormat({ data });
  if (legacy.legacy) {
    add('S2', legacy.reason);
    return;
  }

  for (const f of OKF_REQUIRED) {
    const v = data[f];
    if (v === undefined || v === null || v === '') add('S1', `OKF field missing: ${f}`);
  }
  if (!TYPES.includes(data.type)) {
    add('S2', `unknown type: ${data.type}`);
    return; // type에 의존하는 검사는 진행할 수 없음
  }
  if (data.resource !== rel) {
    add('S3', `resource path mismatch: ${data.resource} != ${rel}`);
  }

  const bouncer = data.bouncer || {};
  const prefix = ID_PREFIX[data.type];
  // S4는 정규화 후 형태만 본다 — 구형 EPIC-014 / TASKS-BP-001도 전이 기간에 통과.
  // 정본은 epic/bp=\d{3}, 자식=PREFIX+\d{3}. 접두만 떼므로 숫자 자체 오류는 S5.
  const idNorm = normalizeContextId(bouncer.id);
  if (data.type === 'bouncer.epic' || data.type === 'bouncer.blueprint') {
    if (!isNumericContextId(idNorm)) {
      add('S4', `id "${bouncer.id}" must be a zero-padded three-digit id`);
    }
  } else if (
    typeof idNorm !== 'string'
    || !idNorm.startsWith(prefix)
    || !isNumericContextId(idNorm.slice(prefix.length))
  ) {
    add('S4', `id "${bouncer.id}" missing prefix ${prefix} or invalid digits`);
  }

  const parsed = parsePathIds(rel);
  if (parsed.epicId && normalizeContextId(bouncer.epic_id) !== parsed.epicId) {
    add('S5', `epic_id ${bouncer.epic_id} != path ${parsed.epicId}`);
  }
  if (
    data.type !== 'bouncer.epic'
    && parsed.blueprintId
    && normalizeContextId(bouncer.blueprint_id) !== parsed.blueprintId
  ) {
    add('S5', `blueprint_id ${bouncer.blueprint_id} != path ${parsed.blueprintId}`);
  }
  let expectedId = null;
  if (data.type === 'bouncer.epic') expectedId = parsed.epicId;
  else if (data.type === 'bouncer.blueprint') expectedId = parsed.blueprintId;
  else if (parsed.blueprintId) expectedId = `${prefix}${parsed.blueprintId}`;
  if (expectedId && normalizeContextId(bouncer.id) !== expectedId) {
    add('S5', `id ${bouncer.id} != expected ${expectedId} from path`);
  }

  if (!(STATUS_ENUM[data.type] || []).includes(bouncer.status)) {
    add('S6', `status "${bouncer.status}" not in enum for ${data.type}`);
  }

  if (data.type === 'bouncer.tasks') {
    const ap = bouncer.affected_paths;
    if (!Array.isArray(ap) || ap.length === 0) {
      add('S7', 'tasks.affected_paths missing or empty');
    }
    if (bouncer.graph != null) {
      const basis = bouncer.graph.basis;
      if (typeof basis !== 'string' || !basis.trim()) {
        add('S9', 'tasks.graph.basis missing or empty');
      }
    }
    // 선택 필드: 없으면 기존 tasks.md가 모두 유효하게 유지됨. S12와
    // VERIFY_COMMAND_INVALID가 일치하도록 verification.isValidVerifyCommand를 재사용.
    if (bouncer.verify !== undefined && !isValidVerifyCommand(bouncer.verify)) {
      add('S12', 'tasks.verify must be a single executable command');
    }
  }
}

function validateBlueprint({ repoRoot, blueprintDir, gate, deps }) {
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    return {
      ok: false,
      failures: [{
        code: 'S10',
        message: `blueprintDir must be under ${CONTEXT_ROOT}/epics`,
        file: toPosix(blueprintDir),
      }],
    };
  }

  const legacyRepo = detectLegacyFormat({ repoRoot });
  if (legacyRepo.legacy) {
    return {
      ok: false,
      failures: [{ code: 'S2', message: legacyRepo.reason, file: '.sdd' }],
    };
  }

  // blueprint 문서가 하나도 없으면 문서 문제가 아니라 잘못된 경로를 의미함.
  // 이를 먼저 보고하면 빈 문서 집합이 만드는 gate 실패 연쇄를 쫓지 않게 하고,
  // 존재하지 않는 경로에 대해 `execute`가 verify 명령을 실행하는 것을 막음.
  // epic index는 의도적으로 제외: 해당 epic 아래 모든 blueprint에 존재하므로,
  // 오타 난 blueprint 이름이 이 검사를 통과해 버릴 수 있음.
  if (!blueprintDocsExist({ repoRoot, blueprintDir })) {
    return {
      ok: false,
      failures: [{
        code: 'S11',
        message: 'blueprint documents not found — check the blueprint path',
        file: toPosix(blueprintDir),
      }],
    };
  }

  const executionFailures = [];
  if (gate === 'execute') {
    try {
      const verification = runVerification({ repoRoot, blueprintDir });
      if (!verification.ok) {
        executionFailures.push({
          code: 'G13',
          message: `configured verify command failed with exit code ${verification.exitCode}`,
          file: `${toPosix(blueprintDir)}/verification.md`,
        });
      }
    } catch (error) {
      executionFailures.push({
        code: 'G13',
        message: error.message,
        file: `${toPosix(blueprintDir)}/verification.md`,
      });
    }
  }

  // execute gate가 방금 기록한 증적을 읽도록 verification 이후에 로드.
  const { docs, rels, parseErrors } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const failures = [...executionFailures, ...parseErrors];

  const anyLeaf = ['tasks', 'verification', 'review', 'explain'].some((k) => docs[k]);
  if (anyLeaf && !docs.blueprintIndex) {
    failures.push({ code: 'S8', message: 'blueprint index.md absent', file: rels.blueprintIndex });
  }
  if (docs.blueprintIndex && !docs.epicIndex) {
    failures.push({ code: 'S8', message: 'epic index.md absent', file: rels.epicIndex });
  }

  for (const key of Object.keys(docs)) checkStructural(docs[key], failures);

  failures.push(...checkEpicIndexConsistency({ repoRoot }));

  if (gate) {
    checkGate(gate, docs, rels, failures, { repoRoot, blueprintDir, deps });
  }

  return { ok: failures.length === 0, failures };
}

function statusOf(doc) {
  return doc && doc.data && doc.data.bouncer ? doc.data.bouncer.status : undefined;
}

const SECTION_DEFS = [
  { key: 'goal', re: /^##\s+(Goal\s*&\s*intent|목적[·・.]?의도)\s*$/i },
  { key: 'interface', re: /^##\s+(Interface|인터페이스)\s*$/i },
  { key: 'touch', re: /^##\s+(Touch|수정할\s*부분)\s*$/i },
  { key: 'doNotTouch', re: /^##\s+(Do\s+not\s+touch|절대\s*수정\s*금지)\s*$/i },
  // 경계로 파싱하지만 G10 필수 목록에는 없음: 여기에 def가 없으면 해당 본문이
  // Do not touch에 흡수되어 G12 path overlap을 잘못 만들어 냄.
  { key: 'constraints', re: /^##\s+(Constraints|제약)\s*$/i },
  { key: 'checklist', re: /^##\s+(Checklist|체크리스트)\s*$/i },
];

const VERIFY_SECTION_DEFS = [
  { key: 'command', re: /^##\s+(Command|명령(?:어)?)\s*$/i },
  { key: 'evidence', re: /^##\s+(Evidence|증적|증거)\s*$/i },
];

const REVIEW_SECTION_DEFS = [
  { key: 'findings', re: /^##\s+(Findings|발견사항|리뷰\s*결과)\s*$/i },
];
const REVIEW_SEVERITY = ['blocker', 'major', 'minor', 'nit'];
const REVIEW_STATUS = ['resolved', 'accepted'];

// G10과 동일한 비어 있음 계약: 제목은 있고, comment-strip 후 본문이 있어야 함.
// comprehension module이 어떤 section이 있는지 SSOT가 되도록 key는
// EXPLAIN_SECTION_DEFS를 반영; regex는 parseSections 옆에 둠.
const EXPLAIN_SECTION_HEADINGS = [
  { key: 'background', re: /^##\s+Background\s*$/i },
  { key: 'intuition', re: /^##\s+Intuition\s*$/i },
  { key: 'code', re: /^##\s+Code\s*$/i },
  { key: 'quiz', re: /^##\s+Quiz\s*$/i },
  { key: 'understanding', re: /^##\s+이해\s*상태\s*$/i },
];

function readConfigFile(repoRoot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer/config.json'), 'utf8'));
  } catch (_e) {
    return {};
  }
}

// pointer base는 pointer가 이 blueprint를 가리킬 때만 우선; 그 외에는
// config.base_branch, 다음 develop. pointer 없이도 finalize hash를 안정적으로
// 유지하고, 다른 BP의 base로 실수로 hash하지 않게 함.
function resolveFinalizeBase({ repoRoot, blueprintDir, deps }) {
  const rc = (deps && deps.readCurrent) || readCurrent;
  const cfgRead = (deps && deps.readConfig) || readConfigFile;
  const cur = rc({ repoRoot });
  const bp = toPosix(blueprintDir);
  if (
    cur
    && typeof cur.blueprint === 'string'
    && toPosix(cur.blueprint) === bp
    && typeof cur.base === 'string'
    && cur.base.trim()
  ) {
    return cur.base.trim();
  }
  const cfg = cfgRead(repoRoot) || {};
  if (typeof cfg.base_branch === 'string' && cfg.base_branch.trim()) {
    return cfg.base_branch.trim();
  }
  return 'develop';
}

// 작성 가이드는 HTML comment로 제공되므로, 가이드만 있는 section은 미작성으로
// 본다. 비어 있음 검사 전에 comment를 제거하면 "section은 있으나 비어 있음"이
// template에 본문이 실리기 전과 같은 의미를 유지. tasks뿐 아니라 section을
// 파싱하는 모든 문서에 적용.
function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

// template이 쓰는 유일한 placeholder 형식. 실제 본문과 구분되어 걸리지 않음 —
// Interface의 `<T>` generic은 그대로 허용.
const TODO_RE = /<TODO:[^>\n]*>/;

function parseSections(body, defs) {
  const text = typeof body === 'string' ? stripComments(body) : '';
  const lines = text.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    for (const def of defs) {
      if (def.re.test(lines[i].trim())) starts.push({ key: def.key, line: i });
    }
  }
  const out: Record<string, string | null> = {};
  for (const def of defs) out[def.key] = null;
  for (let s = 0; s < starts.length; s++) {
    const { key, line } = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].line : lines.length;
    out[key] = lines.slice(line + 1, end).join('\n').trim() || null;
  }
  return out;
}

function parseTasksSections(body) {
  return parseSections(body, SECTION_DEFS);
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
    (c: string) => ap === c || ap.startsWith(c.endsWith('/') ? c : `${c}/`),
  );
}

function checkGate(gate, docs, rels, failures, ctx) {
  const add = (code, message, fileKey) =>
    failures.push({ code, message, file: rels[fileKey] });
  const repoRoot = ctx && ctx.repoRoot;
  const blueprintDir = ctx && ctx.blueprintDir;
  const deps = ctx && ctx.deps;

  if (gate === 'plan') {
    if (statusOf(docs.epicIndex) !== 'approved') add('G1', 'epic.status != approved', 'epicIndex');
    if (statusOf(docs.blueprintIndex) !== 'approved') add('G2', 'blueprint.status != approved', 'blueprintIndex');
    if (statusOf(docs.tasks) !== 'ready') add('G3', 'tasks.status != ready', 'tasks');
    const graph = docs.tasks && docs.tasks.data.bouncer ? docs.tasks.data.bouncer.graph : undefined;
    const suggested = graph ? graph.suggested_paths : undefined;
    if (!Array.isArray(suggested)) add('G4', 'tasks.graph.suggested_paths missing', 'tasks');
    if (graph && (typeof graph.basis !== 'string' || !graph.basis.trim())) {
      add('G4', 'tasks.graph.basis missing or empty', 'tasks');
    }
    const ap = docs.tasks && docs.tasks.data.bouncer ? docs.tasks.data.bouncer.affected_paths : undefined;
    if (!Array.isArray(ap) || ap.length === 0) add('G5', 'tasks.affected_paths missing or empty', 'tasks');
    const tasksBody = docs.tasks && typeof docs.tasks.body === 'string' ? docs.tasks.body : '';
    const sections = parseTasksSections(tasksBody);
    const sectionKeys = ['goal', 'interface', 'touch', 'doNotTouch', 'checklist'];
    const missing = sectionKeys.filter((k) => !sections[k]);
    const unfilled = sectionKeys.filter((k) => sections[k] && TODO_RE.test(sections[k]));
    if (missing.length) {
      add('G10', `tasks missing implementation-ready sections: ${missing.join(', ')}`, 'tasks');
    } else if (unfilled.length) {
      // 아래 path 검사 대신 보고: 치환되지 않은 placeholder는 G11/G12 finding이
      // scope가 아니라 template 텍스트에 대한 잡음이 되게 함.
      add('G10', `tasks sections still contain <TODO: …> placeholders: ${unfilled.join(', ')}`, 'tasks');
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
    const review = docs.review && docs.review.data.bouncer ? docs.review.data.bouncer.review : undefined;
    const reviewOk = statusOf(docs.review) === 'accepted' || (review && review.required === false);
    if (!reviewOk) add('G8', 'review not accepted and review.required != false', 'review');
    if (docs.verification) {
      const vbody = typeof docs.verification.body === 'string' ? docs.verification.body : '';
      const vs = parseSections(vbody, VERIFY_SECTION_DEFS);
      const missingV = ['command', 'evidence'].filter((k) => !vs[k]);
      if (missingV.length) {
        add('G13', `verification.md missing body sections: ${missingV.join(', ')}`, 'verification');
      }
      const evidence = docs.verification.data.bouncer && docs.verification.data.bouncer.verification;
      const validEvidence = evidence
        && typeof evidence.command === 'string'
        && evidence.command.trim()
        && typeof evidence.ran_at === 'string'
        && evidence.ran_at.trim()
        && evidence.exit_code === 0
        && typeof evidence.output_tail === 'string';
      if (!validEvidence) {
        add('G13', 'verification.md missing successful harness verification metadata', 'verification');
      } else if (
        !vs.command.includes(`\`${evidence.command}\``)
        || !vs.evidence.includes('Exit code: 0')
      ) {
        add('G13', 'verification.md body does not match harness verification metadata', 'verification');
      }
    }
    const reviewMeta = docs.review && docs.review.data.bouncer ? docs.review.data.bouncer.review : undefined;
    const reviewSkipped = reviewMeta && reviewMeta.required === false;
    if (docs.review && !reviewSkipped) {
      const rbody = typeof docs.review.body === 'string' ? docs.review.body : '';
      const rs = parseSections(rbody, REVIEW_SECTION_DEFS);
      if (!rs.findings) add('G14', 'review.md missing ## Findings body section', 'review');
      const findings = Array.isArray(reviewMeta && reviewMeta.findings) ? reviewMeta.findings : [];
      for (const fnd of findings) {
        const id = fnd && fnd.id ? fnd.id : '(no id)';
        if (!REVIEW_SEVERITY.includes(fnd && fnd.severity)) {
          add('G14', `review finding ${id} severity invalid: ${fnd && fnd.severity}`, 'review');
        }
        if (!REVIEW_STATUS.includes(fnd && fnd.status)) {
          add('G14', `review finding ${id} status invalid: ${fnd && fnd.status}`, 'review');
        }
        if (fnd && fnd.status === 'accepted' && (!fnd.note || String(fnd.note).trim() === '')) {
          add('G14', `review finding ${id} accepted without note`, 'review');
        }
      }
    }
    return;
  }
  if (gate === 'finalize') {
    // G9 (distill.status == published)는 폐기됨 — 번호만 비워 둠.
    // G15는 status token만이 아니라 diff에 대한 comprehension을 판단.
    if (!docs.explain) {
      add('G15', 'explain.md missing', 'explain');
      return;
    }
    const explainBody = typeof docs.explain.body === 'string' ? docs.explain.body : '';
    const sections = parseSections(explainBody, EXPLAIN_SECTION_HEADINGS);
    // key는 comprehension module에서 가져와 module 간 drift가 여기의 조용한
    // subset이 아니라 EXPLAIN_SECTION_DEFS를 검증하는 test에서 실패하게 함.
    const missing = EXPLAIN_SECTION_DEFS.filter((k) => !sections[k]);
    if (missing.length) {
      add('G15', `explain missing written sections: ${missing.join(', ')}`, 'explain');
      return;
    }

    const bouncer = docs.explain.data && docs.explain.data.bouncer
      ? docs.explain.data.bouncer
      : {};
    const comp = bouncer.comprehension;
    // 빈 diff_sha는 "hash mismatch"가 아니라 "record missing" — scaffold
    // default가 잘못된 failure branch로 뭉개지면 안 됨.
    const diffSha = comp && typeof comp.diff_sha === 'string' ? comp.diff_sha : '';
    const disposition = comp && typeof comp.disposition === 'string' ? comp.disposition : '';
    if (!comp || typeof comp !== 'object' || !disposition.trim() || !diffSha.trim()) {
      add('G15', 'explain comprehension record missing', 'explain');
      return;
    }

    // quiz_score는 사람/이후 BP용으로 기록; G15는 이를 해석하지 않음.
    const shaFn = (deps && deps.computeDiffSha) || computeDiffSha;
    const base = resolveFinalizeBase({ repoRoot, blueprintDir, deps });
    const computed = shaFn({ repoRoot, base, exec: deps && deps.exec });
    if (!computed || computed.ok !== true) {
      const reason = computed && computed.reason ? computed.reason : 'exec-failed';
      add('G15', `explain diff_sha could not be computed (${reason})`, 'explain');
      return;
    }
    if (computed.sha !== diffSha.trim()) {
      add('G15', 'explain diff_sha does not match base..HEAD', 'explain');
    }
    return;
  }
  throw new Error(`unknown gate: ${gate}`);
}

module.exports = {
  loadBlueprintDocs, checkStructural, checkGate, validateBlueprint,
  parseTasksSections, parseSections, extractPathCandidates,
};
