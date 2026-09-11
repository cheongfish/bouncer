'use strict';
const path = require('node:path');
import schema = require('./schema');
const {
  OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, detectLegacyFormat,
  KIND_TO_TYPE, SCALE_ENUM, isValidSupersedes, DEPENDENCY_GATE_ENUM,
  isValidDependsOn, executionKindOf,
} = schema;
import paths = require('./paths');
const {
  parsePathIds, toPosix, isNumericContextId,
} = paths;
import verification = require('./verification');
const { isValidVerifyCommand } = verification;
import tasksDocs = require('./tasks-docs');
const {
  expectedTasksId, expectedTaskDocIds,
  TASK_UNIT_BASENAMES, unitDocKind,
} = tasksDocs;
import config = require('./config');
const { DEFAULT_VERIFY_ALLOWLIST } = config;

// 문서 하나(프론트매터)를 보는 S 코드 층. 게이트(G) 판정과 분리해 두면
// 스키마/id 규칙을 고치는 사람이 checkGate 분기를 같이 읽지 않아도 된다.
// graph.basis 헬퍼도 여기 둔다 — S9와 G4가 다른 구현을 가지면 같은 필드가
// 구조 검사와 plan 게이트에서 다른 답을 낸다.
// validate.ts를 require하지 않는다.

type FailureEntry = { code: string; message: string; file: string };
// graph.basis는 레거시 문자열과 그래프별 엔트리 배열을 모두 받는다.
// S9(구조)와 G4(plan)가 같은 헬퍼를 써야 두 경로가 다른 답을 내지 않는다.
const GRAPH_BASIS_STATUS = ['updated', 'reused', 'fail-skip', 'skip-disabled', 'missing'];
// test는 구현·연결 테스트 그래프용. 질의 실패해도 runner가 엔트리를 남기므로
// 허용값에 두고, 세 그래프를 강제하지는 않는다(구 source|context 문서 호환).
const GRAPH_BASIS_GRAPH = ['source', 'test', 'context'];

const SCOPE_QUALITY_STATUS = ['ranked', 'low-confidence', 'unavailable'];
const SCOPE_CONFIDENCE = ['high', 'medium', 'low'];
const SCOPE_CANDIDATE_ROLES = ['implementation', 'test', 'context'];

function isValidGraphBasis(basis: unknown): boolean {
  if (typeof basis === 'string') return basis.trim().length > 0;
  if (!Array.isArray(basis) || basis.length === 0) return false;
  for (const entry of basis) {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const rec = entry as Record<string, unknown>;
    if (!(GRAPH_BASIS_GRAPH as unknown[]).includes(rec.graph)) return false;
    if (!(GRAPH_BASIS_STATUS as unknown[]).includes(rec.status)) return false;
    if (typeof rec.query !== 'string' || !rec.query.trim()) return false;
    if (typeof rec.result !== 'string' || !rec.result.trim()) return false;
  }
  return true;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

/**
 * Task 002 graph-suggest 후보와 같은 모양. path는 저장소-상대 **파일**이어야 하고
 * score는 정수, basis는 비어 있지 않은 문자열 배열이다.
 * 디렉터리 롤업(`scripts/src/lib/`, `test`)은 새 quality/candidates write form에서만
 * 거절한다 — quality 없는 legacy evidence의 suggested_paths는 건드리지 않는다.
 */
function isValidScopeCandidate(candidate: unknown): boolean {
  if (candidate == null || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const rec = candidate as Record<string, unknown>;
  if (typeof rec.path !== 'string' || !rec.path.trim()) return false;
  const filePath = rec.path.trim();
  if (filePath.includes('\\') || filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath)) return false;
  if (filePath.split('/').includes('..')) return false;
  // trailing slash → 디렉터리. basename에 '.' 없음 → 롤업 경로(test, scripts/src/lib).
  if (filePath.endsWith('/')) return false;
  const base = filePath.split('/').pop() || '';
  if (!base || base === '.' || base === '..' || !base.includes('.')) return false;
  if (!Number.isInteger(rec.score)) return false;
  if (!(SCOPE_CONFIDENCE as unknown[]).includes(rec.confidence)) return false;
  return isNonEmptyStringArray(rec.basis);
}

function isValidScopeQuality(quality: unknown): boolean {
  if (quality == null || typeof quality !== 'object' || Array.isArray(quality)) return false;
  const rec = quality as Record<string, unknown>;
  if (!(SCOPE_QUALITY_STATUS as unknown[]).includes(rec.status)) return false;
  if (!(SCOPE_CONFIDENCE as unknown[]).includes(rec.confidence)) return false;
  return isNonEmptyStringArray(rec.reasons);
}

function isValidScopeCandidates(candidates: unknown): boolean {
  if (candidates == null || typeof candidates !== 'object' || Array.isArray(candidates)) return false;
  const rec = candidates as Record<string, unknown>;
  for (const role of SCOPE_CANDIDATE_ROLES) {
    const list = rec[role];
    if (!Array.isArray(list)) return false;
    if (!list.every((entry) => isValidScopeCandidate(entry))) return false;
  }
  return true;
}

type ScopeEvidence = {
  producer: 'graphify';
  generated_at: string;
  suggested_paths: unknown[];
  basis: unknown;
  quality?: unknown;
  candidates?: unknown;
};

type ScopeEvidenceResult = { evidence: ScopeEvidence | null; error: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * tasks의 범위 근거를 새 정본과 구형 graph 형식에서 한 번만 읽는다. 새 문서는
 * scope_evidence만 쓰게 하지만, 이미 승인된 graph 문서를 여기서 같은 내부 모양으로
 * 바꿔야 S9와 G4가 migration 시점에 따라 다른 결론을 내리지 않는다. 이 함수는
 * affected_paths를 절대 만지지 않는다. suggested_paths는 graphify의 제안 근거이고,
 * 사람이 확정한 task 범위를 자동 교체하면 계획 승인 경계가 사라지기 때문이다.
 */
function normalizeScopeEvidence(bouncer: unknown): ScopeEvidenceResult {
  if (!isRecord(bouncer)) return { evidence: null, error: 'scope evidence missing' };
  const hasScopeEvidence = bouncer.scope_evidence !== undefined;
  const hasLegacyGraph = bouncer.graph !== undefined;
  if (hasScopeEvidence && hasLegacyGraph) {
    return { evidence: null, error: 'tasks must not contain both scope_evidence and graph' };
  }
  if (!hasScopeEvidence && !hasLegacyGraph) return { evidence: null, error: null };

  const source = hasScopeEvidence ? bouncer.scope_evidence : bouncer.graph;
  if (!isRecord(source)) return { evidence: null, error: 'scope evidence must be an object' };
  // graph는 과거 write form이라 producer/generated_at을 강제하지 않았다. 그 문서는
  // 계속 읽되, 새 scope_evidence에는 graphify producer와 생성 시각을 명시적으로
  // 요구해 앞으로 만들어지는 근거의 출처·시점을 잃지 않게 한다.
  const evidence: ScopeEvidence = {
    producer: hasScopeEvidence ? source.producer as 'graphify' : 'graphify',
    generated_at: hasScopeEvidence ? source.generated_at as string : 'legacy graph',
    suggested_paths: source.suggested_paths as unknown[],
    basis: source.basis,
  };
  if (evidence.producer !== 'graphify') {
    return { evidence: null, error: 'scope_evidence.producer must be graphify' };
  }
  if (typeof evidence.generated_at !== 'string' || !evidence.generated_at.trim()) {
    return { evidence: null, error: 'scope_evidence.generated_at missing or empty' };
  }
  if (!Array.isArray(evidence.suggested_paths)) {
    return { evidence: null, error: 'scope evidence suggested_paths missing' };
  }
  if (!isValidGraphBasis(evidence.basis)) {
    return { evidence: null, error: 'scope evidence basis missing or empty' };
  }

  // quality·candidates는 선택이다. 둘 다 없으면 구 evidence를 그대로 통과시키고,
  // 하나만 있거나 형식이 틀리면 S9/G4가 같은 메시지로 거절한다.
  const hasQuality = source.quality !== undefined;
  const hasCandidates = source.candidates !== undefined;
  if (hasQuality !== hasCandidates) {
    return {
      evidence: null,
      error: 'scope_evidence.quality and candidates must both be present or both absent',
    };
  }
  if (hasQuality && hasCandidates) {
    if (!isValidScopeQuality(source.quality)) {
      return { evidence: null, error: 'scope_evidence.quality missing or invalid' };
    }
    if (!isValidScopeCandidates(source.candidates)) {
      return { evidence: null, error: 'scope_evidence.candidates has invalid candidate shape' };
    }
    const quality = source.quality as { status: string };
    // 저신뢰·불가 상태에서는 파일 추천을 내지 않는다 — 비어 있지 않으면 승인 경계가 흐려진다.
    if (
      (quality.status === 'low-confidence' || quality.status === 'unavailable')
      && evidence.suggested_paths.length > 0
    ) {
      return {
        evidence: null,
        error: 'scope_evidence.suggested_paths must be empty when quality is low-confidence or unavailable',
      };
    }
    evidence.quality = source.quality;
    evidence.candidates = source.candidates;
  }

  return { evidence, error: null };
}

/**
 * 경로가 요구하는 bouncer type. 위치 규칙이 없으면 null — S19를 내지 않는다.
 * task 묶음 basename은 TASK_UNIT_BASENAMES만 순회하고 문자열을 여기 두지 않는다.
 */
function expectedTypeForPath(rel: unknown): string | null {
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

/**
 * 문서 하나(프론트매터)의 구조 코드를 기록한다. S12는 호출자가 넘긴
 * 프로젝트 allowlist로 `tasks.bouncer.verify`를 검사한다. 목록을 생략하면
 * 기본 목록을 쓰는데, 직접 호출 테스트와 정책 부재 폴백을 맞추기 위함이다.
 * 파손된 config의 기본 목록 폴백은 `validateBlueprint`가 막는다.
 *
 * @param {unknown} doc - `{ data, rel }` 문서
 * @param {FailureEntry[]} failures - 실패를 누적할 배열
 * @param {readonly string[]} [verifyAllowlist] - S12 argv0 허용 목록
 * @returns {void}
 */
function checkStructural(
  doc: unknown,
  failures: FailureEntry[],
  verifyAllowlist: readonly string[] = DEFAULT_VERIFY_ALLOWLIST,
): void {
  const { data, rel } = doc as { data: unknown; rel: string };
  const add = (code: string, message: string) => failures.push({ code, message, file: rel });
  const rec = data as Record<string, unknown>;

  const legacy = detectLegacyFormat({ data });
  if (legacy.legacy) {
    add('S2', legacy.reason as string);
    return;
  }

  for (const f of OKF_REQUIRED) {
    const v = rec[f];
    if (v === undefined || v === null || v === '') add('S1', `OKF field missing: ${f}`);
  }
  if (!(TYPES as unknown[]).includes(rec.type)) {
    add('S2', `unknown type: ${rec.type}`);
    return; // type에 의존하는 검사는 진행할 수 없음
  }
  const docType = rec.type as string;
  // S19: 알려진 type만 위치와 대조. 기대값이 null이면 위치 규칙이 없는 경로.
  const expectedType = expectedTypeForPath(rel);
  if (expectedType && rec.type !== expectedType) {
    add('S19', `type ${rec.type} does not match expected ${expectedType} for path`);
  }
  if (rec.resource !== rel) {
    add('S3', `resource path mismatch: ${rec.resource} != ${rel}`);
  }

  const bouncer = (rec.bouncer || {}) as Record<string, unknown>;
  const prefix = Object.prototype.hasOwnProperty.call(ID_PREFIX, docType)
    ? ID_PREFIX[docType as keyof typeof ID_PREFIX]
    : undefined;
  // migration 이후에는 검증기가 구형 접두를 보정하지 않는다. 정본 형태가 아니면
  // S4/S5에서 그대로 거절해 일부만 migrate된 저장소가 통과하지 못하게 한다.
  const id = bouncer.id;
  if (docType === 'bouncer.epic' || docType === 'bouncer.blueprint') {
    if (!isNumericContextId(id)) {
      add('S4', `id "${bouncer.id}" must be a zero-padded three-digit id`);
    }
  } else if (
    typeof prefix !== 'string'
    || typeof id !== 'string'
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
    docType !== 'bouncer.epic'
    && parsed.blueprintId
    && bouncer.blueprint_id !== parsed.blueprintId
  ) {
    add('S5', `blueprint_id ${bouncer.blueprint_id} != path ${parsed.blueprintId}`);
  }
  let expectedId: string | null = null;
  // tasks/<NNN>/… 새 레이아웃은 디렉터리 번호가 id 숫자. basename만 보면
  // 전부 tasks.md → TASKS-{blueprintId}로 잘못 접혀 002가 S5에 걸린다.
  const dirDigitsMatch = /\/tasks\/(\d{3})\//.exec(toPosix(rel));
  if (dirDigitsMatch) {
    const ids = expectedTaskDocIds(dirDigitsMatch[1]);
    if (docType === 'bouncer.tasks') expectedId = ids.tasks;
    else if (docType === 'bouncer.verification') expectedId = ids.verification;
    else if (docType === 'bouncer.review') expectedId = ids.review;
  } else if (docType === 'bouncer.epic') expectedId = parsed.epicId;
  else if (docType === 'bouncer.blueprint') expectedId = parsed.blueprintId;
  else if (docType === 'bouncer.tasks') {
    // task id는 파일 이름에서 유도 — 레거시는 blueprint id, 번호 문서는 NNN.
    expectedId = expectedTasksId(path.posix.basename(rel), parsed.blueprintId);
  } else if (parsed.blueprintId) expectedId = `${prefix}${parsed.blueprintId}`;
  if (expectedId && bouncer.id !== expectedId) {
    add('S5', `id ${bouncer.id} != expected ${expectedId} from path`);
  }

  if (!(
    Object.prototype.hasOwnProperty.call(STATUS_ENUM, docType)
      ? STATUS_ENUM[docType as keyof typeof STATUS_ENUM]
      : []
  ).includes(bouncer.status as string)) {
    add('S6', `status "${bouncer.status}" not in enum for ${docType}`);
  }

  // S20: blueprint만. 부재는 0.7 문서 통과용으로 허용; 잘못된 값만 거절.
  if (
    docType === 'bouncer.blueprint'
    && bouncer.scale !== undefined
    && !(SCALE_ENUM as unknown[]).includes(bouncer.scale)
  ) {
    add('S20', `scale "${bouncer.scale}" not in enum for ${docType}`);
  }

  // S27: epic·blueprint만. 부재는 통과(소급 없음). 형식만 schema.isValidSupersedes —
  // 경로 존재·자기참조·순환·중복은 검사하지 않는다.
  if (
    (docType === 'bouncer.epic' || docType === 'bouncer.blueprint')
    && !isValidSupersedes(bouncer.supersedes)
  ) {
    add('S27', 'supersedes must be an array of non-empty document paths');
  }

  if (docType === 'bouncer.tasks') {
    const ap = bouncer.affected_paths;
    const executionKind = executionKindOf(bouncer);
    if (executionKind !== 'verification' && (!Array.isArray(ap) || ap.length === 0)) {
      add('S7', 'tasks.affected_paths missing or empty');
    }
    const scopeEvidence = normalizeScopeEvidence(bouncer);
    if (executionKind !== 'verification' && scopeEvidence.error) {
      add('S9', scopeEvidence.error);
    }
    // 선택 필드: 없으면 기존 tasks.md가 모두 유효하게 유지됨. S12와
    // VERIFY_COMMAND_INVALID가 같은 allowlist를 써야 두 경로가 어긋나지 않는다.
    if (bouncer.verify !== undefined && !isValidVerifyCommand(bouncer.verify, verifyAllowlist)) {
      add('S12', 'tasks.verify must be a single executable command');
    }
    // S28: DAG 필드 shape·enum만. 부재는 빈 depends_on / false / integrated로
    // 읽히므로 통과. 참조 무결성·cycle은 G19.
    if (!isValidDependsOn(bouncer.depends_on)) {
      add('S28', 'depends_on must be an array of TASKS-NNN ids');
    }
    if (bouncer.parallel_safe !== undefined && typeof bouncer.parallel_safe !== 'boolean') {
      add('S28', 'parallel_safe must be a boolean');
    }
    if (
      bouncer.dependency_gate !== undefined
      && !(DEPENDENCY_GATE_ENUM as unknown[]).includes(bouncer.dependency_gate)
    ) {
      add('S28', `dependency_gate "${bouncer.dependency_gate}" not in enum`);
    }
    // verification node는 구현 범위를 갖지 않고 선행 fan-in 뒤 단일 argv만
    // 실행한다. 이 불변조건을 한 코드로 묶어 부분 선언이 commit task처럼
    // 흘러가는 것을 막는다. graph의 존재·terminal 관계는 plan G20의 몫이다.
    if (executionKind === null) {
      add('S29', 'execution_kind must be commit or verification');
    } else if (executionKind === 'verification') {
      if (!Array.isArray(ap) || ap.length !== 0) {
        add('S29', 'verification task affected_paths must be empty');
      }
      if (!Array.isArray(bouncer.depends_on) || bouncer.depends_on.length === 0) {
        add('S29', 'verification task depends_on must be non-empty');
      }
      if (bouncer.parallel_safe !== false) {
        add('S29', 'verification task parallel_safe must be false');
      }
      if (bouncer.dependency_gate !== 'integrated') {
        add('S29', 'verification task dependency_gate must be integrated');
      }
      if (!isValidVerifyCommand(bouncer.verify, verifyAllowlist)) {
        add('S29', 'verification task verify must be a single executable command');
      }
    } else if (bouncer.status === 'verifying' || bouncer.status === 'integrated') {
      add('S29', `commit task cannot use verification status ${bouncer.status}`);
    }
  }
}

export = {
  expectedTypeForPath,
  checkStructural,
  GRAPH_BASIS_STATUS,
  GRAPH_BASIS_GRAPH,
  isValidGraphBasis,
  normalizeScopeEvidence,
};
