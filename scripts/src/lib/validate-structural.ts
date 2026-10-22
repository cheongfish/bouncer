'use strict';
const path = require('node:path');
import schema = require('./schema');
const {
  OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, detectLegacyFormat,
  KIND_TO_TYPE, SCALE_ENUM, isValidSupersedes, DEPENDENCY_GATE_ENUM,
  isValidDependsOn, isValidExclusiveResources, isValidAuthoredLineList,
  executionKindOf, planReviewContractOf,
} = schema;
import paths = require('./paths');
const {
  parsePathIds, toPosix, isNumericContextId,
} = paths;
import contextIds = require('./context-ids');
const { parseContextPath, validateSlug } = contextIds;
import layout = require('./layout');
const { isValidBlueprintOrder, listBlueprintOrders } = layout;
import verification = require('./verification');
const { isValidVerifyCommand } = verification;
import tasksDocs = require('./tasks-docs');
const {
  expectedTasksId, expectedTaskDocIds,
  TASK_UNIT_BASENAMES, unitDocKind,
} = tasksDocs;
import config = require('./config');
const { DEFAULT_VERIFY_ALLOWLIST } = config;

// review-dispatch Execute 경로와 같은 허용 목록(review-policy 정본). 정본이 하나라
// S30과 분류기 거절이 어긋나 malformed 위험이 한쪽에만 통과하는 일이 없다.
import reviewPolicy = require('./review-policy');
const { REVIEW_RISK_ENUM } = reviewPolicy;

// 문서 하나(프론트매터)를 보는 S 코드 층. 게이트(G) 판정과 분리해 두면
// 스키마/id 규칙을 고치는 사람이 checkGate 분기를 같이 읽지 않아도 된다.
// 승인 범위는 plan 게이트의 G5가 판정한다 — 이 파일은 affected_paths
// 존재(S7)만 본다. validate.ts를 require하지 않는다.

type FailureEntry = { code: string; message: string; file: string };

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
  // 루트 review.md는 tasks/<NNN>/ 매핑 밖에 있다. 위치 규칙을 주지 않으면
  // 모드 문서가 S19를 건너뛰고 임의의 type으로 남을 수 있다. unit 경로는
  // 위에서 이미 반환했다.
  if (parsed.blueprintId && parsed.kind === 'review') {
    return KIND_TO_TYPE.review;
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
  // 문서 경로의 형식(번호/slug)이 id 모양을 정한다. slug 경로의 epic·blueprint 문서는 id가 경로 slug이고
  // (값 일치는 아래 S5가 본다), 루트 review·explain·context-review는 접두 뒤가 blueprint slug다.
  // task 묶음 문서(TASKS-NNN 등)는 형식과 무관하게 task 번호라 숫자 판정을 그대로 쓴다.
  const slugPath = parseContextPath(rel)?.format === 'slug';
  if (docType === 'bouncer.epic' || docType === 'bouncer.blueprint') {
    if (slugPath ? validateSlug(id) !== null : !isNumericContextId(id)) {
      add('S4', slugPath
        ? `id "${bouncer.id}" must be a valid slug`
        : `id "${bouncer.id}" must be a zero-padded three-digit id`);
    }
  } else if (
    typeof prefix !== 'string'
    || typeof id !== 'string'
    || !id.startsWith(prefix)
    || !(isNumericContextId(id.slice(prefix.length)) || (slugPath && validateSlug(id.slice(prefix.length)) === null))
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

  // S31: review_scope는 켜져 있으면 값 'blueprint'만 받는다. 부재는 구형
  // task별 리뷰 계약이므로 통과한다. 파일 존재·scale로 모드를 추론하지 않는다.
  if (
    docType === 'bouncer.blueprint'
    && bouncer.review_scope !== undefined
    && bouncer.review_scope !== 'blueprint'
  ) {
    add('S31', 'review_scope must be blueprint');
  }

  // S38: review_contract는 켜져 있으면 값 'brief'만 받는다. 부재는 legacy 계약이므로
  // 통과한다. 잘못된 표식을 legacy로 오인하면 리뷰 관점이 조용히 바뀌므로 값과
  // review_scope 전제를 각각 거절한다. light도 표식을 받는다(plan 리뷰가 verifiability
  // 한 관점으로 돈다). light를 접는 reviewContractOf가 아니라 planReviewContractOf를
  // 써야 light의 잘못된 값도 여기서 거절된다.
  if (docType === 'bouncer.blueprint' && planReviewContractOf(bouncer) !== 'legacy') {
    if (planReviewContractOf(bouncer) === null) {
      add('S38', 'review_contract must be brief');
    } else if (bouncer.review_scope !== 'blueprint') {
      add('S38', 'review_contract requires review_scope blueprint');
    }
  }

  // S36: area·attribution은 선택 키라 부재는 통과하고 있는 값의 모양만 거절한다.
  // 등록부 대조와 필수 판정은 구조 검사가 아니라 gate 소관이다.
  if (docType === 'bouncer.blueprint') {
    const { area, attribution } = bouncer;
    if (area !== undefined && !(typeof area === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(area))) {
      add('S36', 'area must be a lowercase slug string');
    }
    if (attribution !== undefined
      && !(typeof attribution === 'string' && attribution.trim() !== '' && !/[\r\n]/.test(attribution))) {
      add('S36', 'attribution must be a non-empty single-line string');
    }
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
    // 선택 필드: 없으면 기존 tasks.md가 모두 유효하게 유지됨. S12와
    // VERIFY_COMMAND_INVALID가 같은 allowlist를 써야 두 경로가 어긋나지 않는다.
    if (bouncer.verify !== undefined && !isValidVerifyCommand(bouncer.verify, verifyAllowlist)) {
      add('S12', 'tasks.verify must be a single executable command');
    }
    // S28: DAG 필드 shape·enum만. 부재는 빈 depends_on / false / integrated /
    // 빈 exclusive_resources로 읽히므로 통과. 참조 무결성·cycle은 G19.
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
    if (!isValidExclusiveResources(bouncer.exclusive_resources)) {
      add('S28', 'exclusive_resources must be an array of unique resource ids');
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
    // S30: review_risk는 승인 enum의 중복 없는 배열만 받는다. 부재는 legacy []
    // 로 읽히므로 통과 — 새 문서의 malformed 값만 dispatch 전에 막는다.
    // S32: commit_intent·commit_summary는 YAML 리스트만. 스칼라 문자열은
    // `bouncer commit`이 스테이징 전에 같은 이유로 죽던 형태라 plan에서 거절한다.
    // 부재·[]는 통과(작성 전 scaffold). 한국어 종결형은 커밋 정규화가 맡는다.
    for (const field of ['commit_intent', 'commit_summary'] as const) {
      if (!isValidAuthoredLineList(bouncer[field])) {
        add('S32', `${field} must be a YAML list of 0-2 strings`);
      }
    }
    if (bouncer.review_risk !== undefined) {
      if (!Array.isArray(bouncer.review_risk)) {
        add('S30', 'review_risk must be an array');
      } else {
        const seen = new Set<string>();
        for (const entry of bouncer.review_risk) {
          if (typeof entry !== 'string' || !(REVIEW_RISK_ENUM as readonly string[]).includes(entry)) {
            add('S30', `review_risk value invalid: ${String(entry)}`);
            continue;
          }
          if (seen.has(entry)) {
            add('S30', `review_risk duplicate: ${entry}`);
            continue;
          }
          seen.add(entry);
        }
      }
    }
  }
}

/**
 * slug 형식 blueprint의 S37을 판정한다. 대상은 blueprint 디렉터리 경로가 slug 형식으로 읽히는 경우뿐이며
 * 번호 형식은 건드리지 않는다. 보는 것은 `order` 존재·양의 정수·epic 안 유일성, 그리고 같은 epic 안에서
 * 같은 slug를 id로 쓰는 다른 문서(복사된 문서)다. 경로 자체의 형식 혼용·slug 규칙 위반은 경로가 읽히지 않아
 * 이 함수에 오기 전에 validate가 S37로 보고한다. 승인 뒤 slug 불변은 gate가 판정하지 않고(`order`도 닫힌
 * blueprint에서 바꿀 수 있다), 여기서도 값 모양과 유일성만 본다.
 *
 * @param {object} opts - 판정 입력
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - 저장소 상대 blueprint 디렉터리
 * @param {unknown} opts.blueprintIndex - 로드된 blueprint index 문서(`{ data, rel }`). 없으면 판정하지 않는다
 * @returns {FailureEntry[]} S37 실패 목록(없으면 빈 배열). 메시지는 위반 종류로 시작한다
 */
function checkSlugBlueprint({ repoRoot, blueprintDir, blueprintIndex }: {
  repoRoot: string;
  blueprintDir: string;
  blueprintIndex: unknown;
}): FailureEntry[] {
  const ids = parseContextPath(blueprintDir);
  if (!ids || ids.format !== 'slug' || ids.blueprintKey === null || !blueprintIndex) return [];
  const { data, rel } = blueprintIndex as { data: unknown; rel: string };
  const failures: FailureEntry[] = [];
  const add = (kind: string, message: string) => {
    failures.push({ code: 'S37', message: `${kind}: ${message}`, file: rel });
  };
  const bouncer = ((data as { bouncer?: unknown } | null)?.bouncer ?? {}) as Record<string, unknown>;
  const epicDir = toPosix(blueprintDir).split('/blueprints/')[0];
  const siblings = listBlueprintOrders(repoRoot, epicDir).filter((entry) => entry.name !== ids.blueprintKey);
  if (bouncer.order === undefined) {
    add('order-missing', 'a slug blueprint needs a positive integer bouncer.order');
  } else if (!isValidBlueprintOrder(bouncer.order)) {
    add('order-invalid', `bouncer.order must be a positive integer, got ${JSON.stringify(bouncer.order)}`);
  } else {
    const clash = siblings.find((entry) => entry.order === bouncer.order);
    if (clash) add('order-duplicate', `order ${bouncer.order} is also used by ${clash.name}`);
  }
  const copy = siblings.find((entry) => entry.id === ids.blueprintKey);
  if (copy) add('slug-duplicate', `slug ${ids.blueprintKey} is also the id of ${copy.name}`);
  return failures;
}

export = {
  expectedTypeForPath,
  checkStructural,
  checkSlugBlueprint,
};
