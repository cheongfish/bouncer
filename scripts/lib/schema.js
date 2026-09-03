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
    'bouncer.blueprint': ['draft', 'approved', 'superseded', 'closed', 'imported'],
    'bouncer.tasks': ['draft', 'ready', 'in_progress', 'verified'],
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
const LEGACY_GUIDANCE = 'Legacy SDD format detected. Re-initialize with /bouncer-init (no automatic migration).';
// 번들 루트(.bouncer/context/index.md) 전용. OKF okf_version과 자리를 나누되
// Bouncer 문서 스키마 약속은 여기 한 곳에만 둔다 — 문서마다 올리면 드리프트한다.
// 값은 "0.1". 1.0 승격은 epic 029 소관이며 이 상수를 임의로 올리지 않는다.
const BOUNCER_SCHEMA_VERSION = '0.1';
// blueprint bouncer.scale 허용값. 소비자는 scale === 'light'만 보고,
// 부재·'full'은 모두 일반 경로로 읽힌다(full 분기 금지).
const SCALE_ENUM = ['light', 'full'];
// scaffold가 blueprint에 쓰는 기본값. 경량 선언은 plan이 이 값을 light로 바꾼다.
const DEFAULT_SCALE = 'full';
// finalize가 읽되 scaffold가 비우면 항상 'feat' 폴백으로 떨어지던 구멍 —
// blueprint에 기본 commit_type을 써 둔다. 값 검사는 TASKS-002.
const DEFAULT_COMMIT_TYPE = 'feat';
// config.json autonomy 허용값. 소비자는 autonomy === 'interactive'만 보고,
// 부재·'auto'는 모두 같은 경로로 읽힌다(auto 전용 분기 금지).
const AUTONOMY_ENUM = ['auto', 'interactive'];
// init이 새 저장소 config.json에 쓰는 기본값. 키가 없어도 소비자는 auto로 읽는다.
const DEFAULT_AUTONOMY = 'auto';
/**
 * epic·blueprint `bouncer.supersedes` 형식만 판정한다.
 * 부재(undefined)와 빈 배열은 통과 — 기존 문서 소급 없이 신규부터 자리를 쓰기 위함.
 * 참조 무결성(존재·자기참조·순환·중복)은 검사하지 않는다. S27이 이 헬퍼만 본다.
 *
 * @param {unknown} value - 프론트매터의 supersedes 값. 키가 없으면 undefined
 * @returns {boolean} 허용 형태면 true, 그 외(null·비배열·공백/비문자열 원소)면 false
 */
function isValidSupersedes(value) {
    // 키 부재만 허용. null은 "명시적으로 잘못된 값"이라 거절한다(scale 부재 계약과 구분).
    if (value === undefined)
        return true;
    if (!Array.isArray(value))
        return false;
    return value.every((entry) => typeof entry === 'string' && entry.trim() !== '');
}
function detectLegacyFormat({ repoRoot, data } = {}) {
    if (repoRoot) {
        const fs = require('node:fs');
        const path = require('node:path');
        if (fs.existsSync(path.join(repoRoot, '.sdd'))) {
            return { legacy: true, reason: LEGACY_GUIDANCE };
        }
    }
    if (data && typeof data === 'object') {
        const rec = data;
        if (Object.prototype.hasOwnProperty.call(rec, 'sdd')) {
            return { legacy: true, reason: LEGACY_GUIDANCE };
        }
        if (typeof rec.type === 'string' && rec.type.startsWith('sdd.')) {
            return { legacy: true, reason: LEGACY_GUIDANCE };
        }
    }
    return { legacy: false };
}
module.exports = {
    OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, KIND_TO_TYPE,
    LEGACY_GUIDANCE, detectLegacyFormat,
    BOUNCER_SCHEMA_VERSION, SCALE_ENUM, DEFAULT_SCALE, DEFAULT_COMMIT_TYPE,
    AUTONOMY_ENUM, DEFAULT_AUTONOMY, isValidSupersedes,
};
