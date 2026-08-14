'use strict';
const path = require('node:path');
const {
  OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, detectLegacyFormat,
  KIND_TO_TYPE, SCALE_ENUM,
} = require('./schema');
const {
  parsePathIds, toPosix, isNumericContextId,
} = require('./paths');
const { isValidVerifyCommand } = require('./verification');
const {
  expectedTasksId, expectedTaskDocIds,
  TASK_UNIT_BASENAMES, unitDocKind,
} = require('./tasks-docs');

// 문서 하나(프론트매터)를 보는 S 코드 층. 게이트(G) 판정과 분리해 두면
// 스키마/id 규칙을 고치는 사람이 checkGate 분기를 같이 읽지 않아도 된다.
// graph.basis 헬퍼도 여기 둔다 — S9와 G4가 다른 구현을 가지면 같은 필드가
// 구조 검사와 plan 게이트에서 다른 답을 낸다.
// validate.ts를 require하지 않는다.

// graph.basis는 레거시 문자열과 그래프별 엔트리 배열을 모두 받는다.
// S9(구조)와 G4(plan)가 같은 헬퍼를 써야 두 경로가 다른 답을 내지 않는다.
const GRAPH_BASIS_STATUS = ['updated', 'reused', 'fail-skip', 'skip-disabled', 'missing'];
const GRAPH_BASIS_GRAPH = ['source', 'context'];

function isValidGraphBasis(basis) {
  if (typeof basis === 'string') return basis.trim().length > 0;
  if (!Array.isArray(basis) || basis.length === 0) return false;
  for (const entry of basis) {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (!GRAPH_BASIS_GRAPH.includes(entry.graph)) return false;
    if (!GRAPH_BASIS_STATUS.includes(entry.status)) return false;
    if (typeof entry.query !== 'string' || !entry.query.trim()) return false;
    if (typeof entry.result !== 'string' || !entry.result.trim()) return false;
  }
  return true;
}

/**
 * 경로가 요구하는 bouncer type. 위치 규칙이 없으면 null — S19를 내지 않는다.
 * task 묶음 basename은 TASK_UNIT_BASENAMES만 순회하고 문자열을 여기 두지 않는다.
 */
function expectedTypeForPath(rel) {
  const norm = toPosix(rel);
  const parsed = parsePathIds(norm);
  const base = path.posix.basename(norm);

  // epic/blueprint index는 basename이 같아 blueprintId 유무로만 가른다.
  if (base === 'index.md') {
    if (parsed.blueprintId) return KIND_TO_TYPE.blueprint;
    if (parsed.epicId) return KIND_TO_TYPE.epic;
    return null;
  }

  // 루트 tasks.md·알 수 없는 basename은 규칙 밖. 번호 묶음만 대조한다.
  const unitM = /\/tasks\/(\d{3})\//.exec(norm);
  if (unitM) {
    for (const name of TASK_UNIT_BASENAMES) {
      if (base === name) {
        const kind = unitDocKind(name);
        return kind ? KIND_TO_TYPE[kind] : null;
      }
    }
    return null;
  }

  // explain.md / context-review.md는 FILE_KIND(paths) → parsePathIds.kind.
  // blueprint 아래만 기대. 게이트 판정은 여기 두지 않는다(S19 매핑만).
  if (parsed.blueprintId && parsed.kind === 'explain') {
    return KIND_TO_TYPE.explain;
  }
  if (parsed.blueprintId && parsed.kind === 'context_review') {
    return KIND_TO_TYPE.context_review;
  }

  return null;
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
  // S19: 알려진 type만 위치와 대조. 기대값이 null이면 위치 규칙이 없는 경로.
  const expectedType = expectedTypeForPath(rel);
  if (expectedType && data.type !== expectedType) {
    add('S19', `type ${data.type} does not match expected ${expectedType} for path`);
  }
  if (data.resource !== rel) {
    add('S3', `resource path mismatch: ${data.resource} != ${rel}`);
  }

  const bouncer = data.bouncer || {};
  const prefix = ID_PREFIX[data.type];
  // migration 이후에는 검증기가 구형 접두를 보정하지 않는다. 정본 형태가 아니면
  // S4/S5에서 그대로 거절해 일부만 migrate된 저장소가 통과하지 못하게 한다.
  const id = bouncer.id;
  if (data.type === 'bouncer.epic' || data.type === 'bouncer.blueprint') {
    if (!isNumericContextId(id)) {
      add('S4', `id "${bouncer.id}" must be a zero-padded three-digit id`);
    }
  } else if (
    typeof id !== 'string'
    || !id.startsWith(prefix)
    || !isNumericContextId(id.slice(prefix.length))
  ) {
    add('S4', `id "${bouncer.id}" missing prefix ${prefix} or invalid digits`);
  }

  const parsed = parsePathIds(rel);
  if (parsed.epicId && bouncer.epic_id !== parsed.epicId) {
    add('S5', `epic_id ${bouncer.epic_id} != path ${parsed.epicId}`);
  }
  if (
    data.type !== 'bouncer.epic'
    && parsed.blueprintId
    && bouncer.blueprint_id !== parsed.blueprintId
  ) {
    add('S5', `blueprint_id ${bouncer.blueprint_id} != path ${parsed.blueprintId}`);
  }
  let expectedId = null;
  // tasks/<NNN>/… 새 레이아웃은 디렉터리 번호가 id 숫자. basename만 보면
  // 전부 tasks.md → TASKS-{blueprintId}로 잘못 접혀 002가 S5에 걸린다.
  const dirDigitsMatch = /\/tasks\/(\d{3})\//.exec(toPosix(rel));
  if (dirDigitsMatch) {
    const ids = expectedTaskDocIds(dirDigitsMatch[1]);
    if (data.type === 'bouncer.tasks') expectedId = ids.tasks;
    else if (data.type === 'bouncer.verification') expectedId = ids.verification;
    else if (data.type === 'bouncer.review') expectedId = ids.review;
  } else if (data.type === 'bouncer.epic') expectedId = parsed.epicId;
  else if (data.type === 'bouncer.blueprint') expectedId = parsed.blueprintId;
  else if (data.type === 'bouncer.tasks') {
    // task id는 파일 이름에서 유도 — 레거시는 blueprint id, 번호 문서는 NNN.
    expectedId = expectedTasksId(path.posix.basename(rel), parsed.blueprintId);
  } else if (parsed.blueprintId) expectedId = `${prefix}${parsed.blueprintId}`;
  if (expectedId && bouncer.id !== expectedId) {
    add('S5', `id ${bouncer.id} != expected ${expectedId} from path`);
  }

  if (!(STATUS_ENUM[data.type] || []).includes(bouncer.status)) {
    add('S6', `status "${bouncer.status}" not in enum for ${data.type}`);
  }

  // S20: blueprint만. 부재는 0.7 문서 통과용으로 허용; 잘못된 값만 거절.
  if (
    data.type === 'bouncer.blueprint'
    && bouncer.scale !== undefined
    && !SCALE_ENUM.includes(bouncer.scale)
  ) {
    add('S20', `scale "${bouncer.scale}" not in enum for ${data.type}`);
  }

  if (data.type === 'bouncer.tasks') {
    const ap = bouncer.affected_paths;
    if (!Array.isArray(ap) || ap.length === 0) {
      add('S7', 'tasks.affected_paths missing or empty');
    }
    if (bouncer.graph != null) {
      if (!isValidGraphBasis(bouncer.graph.basis)) {
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

module.exports = {
  expectedTypeForPath,
  checkStructural,
  GRAPH_BASIS_STATUS,
  GRAPH_BASIS_GRAPH,
  isValidGraphBasis,
};
