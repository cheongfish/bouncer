'use strict';

const OKF_REQUIRED = ['type', 'title', 'description', 'resource', 'tags', 'timestamp'];

const TYPES = [
  'bouncer.epic',
  'bouncer.blueprint',
  'bouncer.tasks',
  'bouncer.verification',
  'bouncer.review',
  'bouncer.explain',
  'bouncer.context_review',
];

// epic/blueprint 정본은 접두 없는 \d{3}. 빈 문자열은 S4가 숫자 규칙으로 분기할 힌트.
// 자식 문서만 KIND- 접두 + \d{3}(예: TASKS-001). 구형 EPIC-/BP- 메타는 validate 정규화로 통과.
const ID_PREFIX = {
  'bouncer.epic': '',
  'bouncer.blueprint': '',
  'bouncer.tasks': 'TASKS-',
  'bouncer.verification': 'VERIFY-',
  'bouncer.review': 'REVIEW-',
  'bouncer.explain': 'EXPLAIN-',
  'bouncer.context_review': 'CTXREVIEW-',
};

const STATUS_ENUM = {
  // imported: 히스토리 임포트 문서. 게이트 대상이 아니며 validateBlueprint가 S18로 거절.
  'bouncer.epic': ['draft', 'approved', 'closed', 'imported'],
  // 'closed'는 finalize --yes가 마감한 blueprint에 찍는 잠금 status.
  // draft → approved 만 있던 어휘에 마감 표시를 추가; superseded는 유지.
  // imported는 임포트 전용 — 작업 포인터/게이트 대상에서 제외(S18).
  'bouncer.blueprint': ['draft', 'approved', 'superseded', 'closed', 'partial_closed', 'imported'],
  'bouncer.tasks': ['draft', 'ready', 'in_progress', 'verified', 'verifying', 'integrated'],
  'bouncer.verification': ['pending', 'passed', 'failed'],
  'bouncer.review': ['pending', 'requested', 'addressed', 'accepted'],
  'bouncer.explain': ['draft', 'published'],
  // 계획 문서 정합성 판정. 어휘는 bouncer.review와 같다 — 새 status를 만들지 않는다.
  'bouncer.context_review': ['pending', 'requested', 'addressed', 'accepted'],
};

const KIND_TO_TYPE = {
  epic: 'bouncer.epic',
  blueprint: 'bouncer.blueprint',
  tasks: 'bouncer.tasks',
  verification: 'bouncer.verification',
  review: 'bouncer.review',
  explain: 'bouncer.explain',
  context_review: 'bouncer.context_review',
};

const LEGACY_GUIDANCE =
  'Legacy SDD format detected. Re-initialize with /bouncer-init (no automatic migration).';

// 번들 루트(.bouncer/context/index.md) 전용. OKF okf_version과 자리를 나누되
// Bouncer 문서 스키마 약속은 여기 한 곳에만 둔다 — 문서마다 올리면 드리프트한다.
// 값은 "0.1". 1.0 승격은 epic 029 소관이며 이 상수를 임의로 올리지 않는다.
const BOUNCER_SCHEMA_VERSION = '0.1';

// blueprint bouncer.scale 허용값. 소비자는 scale === 'light'만 보고,
// 부재·'full'은 모두 일반 경로로 읽힌다(full 분기 금지).
const SCALE_ENUM = ['light', 'full'];

// scaffold가 blueprint에 쓰는 기본값. 경량 선언은 plan이 이 값을 light로 바꾼다.
const DEFAULT_SCALE = 'full';

// blueprint `bouncer.verification_policy` 허용값은 하나뿐이다. 구현 task는 자기
// 전용 `bouncer.verify`를 갖고, 전체 검증은 마지막 verification node에서 한 번
// 돈다. 키 부재는 정책 이전 계획(legacy)이며 config.verify 폴백과 기존 topology를
// 그대로 유지한다 — 소급 migration이 없으므로 부재를 새 규칙으로 읽지 않는다.
const VERIFICATION_POLICY_ENUM = ['scoped_terminal'];

/**
 * blueprint `bouncer` 블록의 검증 정책을 해석한다.
 * 소비자(plan gate·verify 명령 선택·coordinator)가 같은 판정을 쓰도록 한 곳에 둔다.
 *
 * @param {unknown} bouncer - blueprint index.md의 bouncer 객체
 * @returns {'scoped_terminal' | 'legacy' | null} 키 부재·비객체는 legacy,
 *   허용값은 그대로, 허용 밖의 값(null 포함)은 null — 호출자가 명시적으로 거절한다
 */
function verificationPolicyOf(bouncer: unknown): 'scoped_terminal' | 'legacy' | null {
  if (bouncer == null || typeof bouncer !== 'object' || Array.isArray(bouncer)) return 'legacy';
  const rec = bouncer as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(rec, 'verification_policy')) return 'legacy';
  const value = rec.verification_policy;
  return (VERIFICATION_POLICY_ENUM as unknown[]).includes(value)
    ? value as 'scoped_terminal'
    : null;
}

// blueprint `bouncer.review_contract` 허용값은 하나뿐이다. `brief`는 최종 리뷰가
// 브리프 이행 판정 관점으로 도는 새 계약이고, 키 부재는 legacy다 — 소급 migration이
// 없으므로 부재를 새 계약으로 읽지 않는다. plan 구조 해시에는 넣지 않는다.
const REVIEW_CONTRACT_ENUM = ['brief'];

// 표식이 허용 밖 값일 때의 거절 상수 정본. 분류기·coordinator·CLI가 같은 reason과 문구를 쓰도록
// 여기 둔다. CLI는 분류기를 적재하기 전에 거절하므로 review-dispatch가 아니라 schema에서 가져와야 한다.
const REVIEW_CONTRACT_INVALID_REASON = 'review-contract-invalid';
const REVIEW_CONTRACT_INVALID_CAUSE = 'review_contract must be brief';
const REVIEW_CONTRACT_INVALID_MESSAGE = `${REVIEW_CONTRACT_INVALID_REASON}: ${REVIEW_CONTRACT_INVALID_CAUSE}`;

// 표식(review_contract: brief) blueprint의 plan 리뷰 관점. review-dispatch plan이 내는 값과
// context-review가 round를 대조하는 기준이 같은 정본을 보도록 여기 둔다. full은 4관점 병렬,
// light는 verifiability 하나다.
const PLAN_FULL_PERSPECTIVES = ['consistency', 'scope_minimality', 'verifiability', 'risk_security'];
const PLAN_LIGHT_PERSPECTIVES = ['verifiability'];

/**
 * 표식 blueprint의 delta round가 가져야 하는 관점 이름을 검증된 scale로 고른다.
 * full은 4관점을 하나로 합친 `combined`, light는 verifiability 하나다. 관점 개수로 light를
 * 추론하지 않고 호출자가 loadDispatch로 검증한 scale만 받는다 — 잘못된 scale은 loadDispatch가
 * 이미 거절하므로 여기서는 다시 검사하지 않는다.
 *
 * @param {'full' | 'light'} scale - loadDispatch가 검증한 blueprint scale
 * @returns {string} delta round의 단일 관점 이름
 */
function planDeltaPerspectiveOf(scale: 'full' | 'light'): string {
  return scale === 'light' ? PLAN_LIGHT_PERSPECTIVES[0] : 'combined';
}

/**
 * blueprint `bouncer` 블록의 plan 리뷰 계약 표식을 해석한다. scale을 보지 않는다 —
 * light도 표식을 가질 수 있고(light는 verifiability 한 관점으로 plan 리뷰를 받는다),
 * 크기·task 수로 표식을 추론하지 않기 위해서다.
 *
 * @param {unknown} bouncer - blueprint index.md의 bouncer 객체
 * @returns {'brief' | 'legacy' | null} 키 부재·비객체는 legacy, 허용값은 그대로,
 *   허용 밖의 값(빈 문자열·null 포함)은 null — 호출자가 legacy로 접지 않고 거절한다
 */
function planReviewContractOf(bouncer: unknown): 'brief' | 'legacy' | null {
  if (bouncer == null || typeof bouncer !== 'object' || Array.isArray(bouncer)) return 'legacy';
  const rec = bouncer as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(rec, 'review_contract')) return 'legacy';
  return (REVIEW_CONTRACT_ENUM as unknown[]).includes(rec.review_contract)
    ? rec.review_contract as 'brief'
    : null;
}

/**
 * blueprint `bouncer` 블록의 run(최종 리뷰) 쪽 리뷰 계약 표식을 해석한다.
 * 구조 검사(S38)와 review-dispatch가 같은 판정을 쓰도록 한 곳에 둔다.
 * light는 키 값과 관계없이 legacy다: 표식 light의 최종 리뷰는 표식 없는 light와
 * 같아야 하고, 잘못된 값의 거절은 S38이 맡는다. run 쪽 소비자를 건드리지 않고
 * light 처리를 해석기 한 곳에서만 바꾸려는 선택이다.
 *
 * @param {unknown} bouncer - blueprint index.md의 bouncer 객체
 * @returns {'brief' | 'legacy' | null} light는 항상 legacy, 그 밖에는 planReviewContractOf와 같다
 */
function reviewContractOf(bouncer: unknown): 'brief' | 'legacy' | null {
  if (bouncer != null && typeof bouncer === 'object' && !Array.isArray(bouncer)
    && (bouncer as Record<string, unknown>).scale === 'light') return 'legacy';
  return planReviewContractOf(bouncer);
}

// finalize가 읽되 scaffold가 비우면 항상 'feat' 폴백으로 떨어지던 구멍 —
// blueprint에 기본 commit_type을 써 둔다. 값 검사는 TASKS-001 branch helper가
// 새 worktree 생성 전에 맡아, coordinator와 다른 소비자가 다른 이름을 만들지 않는다.
const DEFAULT_COMMIT_TYPE = 'feat';

// .gitmessage가 허용하는 Conventional Commit 접두를 branch 이름에도 그대로 쓴다.
// 새 종류를 추가할 때 문서·commit hook·branch helper가 흩어지지 않도록 정본을 둔다.
const COMMIT_TYPE_ENUM = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'];

// config.json autonomy 허용값. 소비자는 autonomy === 'interactive'만 보고,
// 부재·'auto'는 모두 같은 경로로 읽힌다(auto 전용 분기 금지).
const AUTONOMY_ENUM = ['auto', 'interactive'];

// init이 새 저장소 config.json에 쓰는 기본값. 키가 없어도 소비자는 auto로 읽는다.
const DEFAULT_AUTONOMY = 'auto';

// task dependency 해제 시점. 선행 task가 이 상태에 도달해야 후속이 열린다.
// 부재는 scaffold 기본값(integrated)과 같이 읽힌다 — 소급 migration 없음.
const DEPENDENCY_GATE_ENUM = ['integrated'];

// scaffold가 새 tasks.md에 쓰는 DAG 기본값. 기존 문서의 필드 부재는
// 같은 의미(의존 없음·순차·integrated)로 읽히므로 호환이 유지된다.
const DEFAULT_DEPENDS_ON: string[] = [];
const DEFAULT_PARALLEL_SAFE = false;
const DEFAULT_DEPENDENCY_GATE = 'integrated';
// exclusive_resources 부재는 빈 배열과 같다. S28과 coordinator 스냅샷이
// 같은 기본값을 써야 plan 통과 문서가 원장에서 다른 충돌 집합을 갖지 않는다.
const DEFAULT_EXCLUSIVE_RESOURCES: string[] = [];
// 소문자·숫자로 시작, 이후에 ._- 만. 대문자·공백은 자원 id로 쓰지 않는다 —
// 호출처마다 trim·lower를 다르게 적용하면 같은 문자열이 충돌/비충돌로 갈라진다.
const EXCLUSIVE_RESOURCE_ID_RE = /^[a-z0-9][a-z0-9._-]*$/;

// blueprint `bouncer.prerequisites[].merged_commit` 형식. 선행 blueprint가 실제로 병합된 결과 commit이며
// squash/rebase에서도 원래 worker SHA가 아니라 병합 결과를 가리킨다. 전체 40자리 소문자만 받아
// 같은 commit이 약어·대문자로 갈라지지 않게 한다. 키 부재/[]는 선행 없음(기존 계획은 그대로).
const PREREQUISITE_MERGED_COMMIT_RE = /^[0-9a-f]{40}$/;

// 키 부재는 기존 task의 commit 의미를 보존한다. 잘못 쓴 문자열은 null로
// 남겨 구조 검사가 명시적으로 거절하게 한다.
const EXECUTION_KIND_ENUM = ['commit', 'verification'];

/**
 * task 메타데이터의 실행 종류를 하위 호환 기본값과 함께 해석한다.
 *
 * @param {unknown} bouncer - tasks.md의 bouncer 객체
 * @returns {'commit' | 'verification' | null} 유효 종류, 잘못된 객체·enum이면 null
 */
function executionKindOf(bouncer: unknown): 'commit' | 'verification' | null {
  if (bouncer == null || typeof bouncer !== 'object' || Array.isArray(bouncer)) return null;
  const value = (bouncer as Record<string, unknown>).execution_kind;
  if (value === undefined) return 'commit';
  return (EXECUTION_KIND_ENUM as unknown[]).includes(value)
    ? value as 'commit' | 'verification'
    : null;
}

/**
 * task `bouncer.depends_on` 형식만 판정한다.
 * 부재(undefined)는 통과 — 기존 plan을 빈 배열로 읽기 위함.
 * 참조 무결성·자기참조·중복·순환은 검사하지 않는다. G19가 그 판정을 맡는다.
 *
 * @param {unknown} value - 프론트매터의 depends_on 값. 키가 없으면 undefined
 * @returns {boolean} 허용 형태면 true, 그 외(null·비배열·비 TASKS-NNN)면 false
 */
function isValidDependsOn(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) => typeof entry === 'string' && /^TASKS-\d{3}$/.test(entry),
  );
}

/**
 * task `bouncer.exclusive_resources` 형식만 판정한다.
 * 부재(undefined)는 통과 — 기존 plan을 빈 배열로 읽기 위함.
 * 항목 shape·중복만 본다. 자원 의미·교차 문서 충돌은 readyWave가 맡는다.
 *
 * @param {unknown} value - 프론트매터의 exclusive_resources 값. 키가 없으면 undefined
 * @returns {boolean} 허용 형태면 true, 그 외(비배열·빈 문자열·대문자·중복)면 false
 */
function isValidExclusiveResources(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string' || !EXCLUSIVE_RESOURCE_ID_RE.test(entry)) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
  }
  return true;
}

/**
 * epic·blueprint `bouncer.supersedes` 형식만 판정한다.
 * 부재(undefined)와 빈 배열은 통과 — 기존 문서 소급 없이 신규부터 자리를 쓰기 위함.
 * 참조 무결성(존재·자기참조·순환·중복)은 검사하지 않는다. S27이 이 헬퍼만 본다.
 *
 * @param {unknown} value - 프론트매터의 supersedes 값. 키가 없으면 undefined
 * @returns {boolean} 허용 형태면 true, 그 외(null·비배열·공백/비문자열 원소)면 false
 */
/**
 * task `bouncer.commit_intent`·`commit_summary` 형식만 판정한다.
 * 부재는 통과 — 옛 tasks.md를 소급하지 않기 위함. 값은 YAML 리스트여야 한다.
 * 스칼라 문자열은 js-yaml이 `commit_intent: 문장`으로 읽어 커밋 직전에야
 * 거절되던 구멍을 여기서 막는다. 줄 수 0–2·원소가 문자열인지만 본다.
 * 한국어 종결형은 `normalizeAuthoredLines`가 커밋 때 판정한다.
 *
 * @param {unknown} value - 프론트매터 값. 키가 없으면 undefined
 * @returns {boolean} 허용 형태면 true, 스칼라·3개 초과·비문자열 원소면 false
 */
function isValidAuthoredLineList(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 2) return false;
  return value.every((entry) => typeof entry === 'string');
}

function isValidSupersedes(value: unknown): boolean {
  // 키 부재만 허용. null은 "명시적으로 잘못된 값"이라 거절한다(scale 부재 계약과 구분).
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) => typeof entry === 'string' && entry.trim() !== '',
  );
}

// public-name: legacy-input-detector
function detectLegacyFormat({ repoRoot, data }: { repoRoot?: unknown; data?: unknown } = {}) {
  if (repoRoot) {
    const fs = require('node:fs');
    const path = require('node:path');
    if (fs.existsSync(path.join(repoRoot as string, '.sdd'))) {
      return { legacy: true, reason: LEGACY_GUIDANCE };
    }
  }
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(rec, 'sdd')) {
      return { legacy: true, reason: LEGACY_GUIDANCE };
    }
    if (typeof rec.type === 'string' && rec.type.startsWith('sdd.')) {
      return { legacy: true, reason: LEGACY_GUIDANCE };
    }
  }
  return { legacy: false };
}

export = {
  OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, KIND_TO_TYPE,
  LEGACY_GUIDANCE, detectLegacyFormat,
  BOUNCER_SCHEMA_VERSION, SCALE_ENUM, DEFAULT_SCALE, DEFAULT_COMMIT_TYPE, COMMIT_TYPE_ENUM,
  VERIFICATION_POLICY_ENUM, verificationPolicyOf,
  REVIEW_CONTRACT_ENUM, REVIEW_CONTRACT_INVALID_REASON, REVIEW_CONTRACT_INVALID_CAUSE,
  REVIEW_CONTRACT_INVALID_MESSAGE, reviewContractOf, planReviewContractOf,
  PLAN_FULL_PERSPECTIVES, PLAN_LIGHT_PERSPECTIVES, planDeltaPerspectiveOf,
  AUTONOMY_ENUM, DEFAULT_AUTONOMY, isValidSupersedes,
  DEPENDENCY_GATE_ENUM, DEFAULT_DEPENDS_ON, DEFAULT_PARALLEL_SAFE,
  DEFAULT_DEPENDENCY_GATE, DEFAULT_EXCLUSIVE_RESOURCES, isValidDependsOn,
  isValidExclusiveResources, EXCLUSIVE_RESOURCE_ID_RE, isValidAuthoredLineList,
  EXECUTION_KIND_ENUM, executionKindOf, PREREQUISITE_MERGED_COMMIT_RE,
};
