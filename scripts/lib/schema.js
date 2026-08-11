'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const OKF_REQUIRED = ['type', 'title', 'description', 'resource', 'tags', 'timestamp'];
const TYPES = [
    'bouncer.epic',
    'bouncer.blueprint',
    'bouncer.tasks',
    'bouncer.verification',
    'bouncer.review',
    'bouncer.explain',
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
};
const KIND_TO_TYPE = {
    epic: 'bouncer.epic',
    blueprint: 'bouncer.blueprint',
    tasks: 'bouncer.tasks',
    verification: 'bouncer.verification',
    review: 'bouncer.review',
    explain: 'bouncer.explain',
};
const LEGACY_GUIDANCE = 'Legacy SDD format detected. Re-initialize with /bouncer-init (no automatic migration).';
function detectLegacyFormat({ repoRoot, data } = {}) {
    if (repoRoot) {
        const fs = require('node:fs');
        const path = require('node:path');
        if (fs.existsSync(path.join(repoRoot, '.sdd'))) {
            return { legacy: true, reason: LEGACY_GUIDANCE };
        }
    }
    if (data && typeof data === 'object') {
        if (Object.prototype.hasOwnProperty.call(data, 'sdd')) {
            return { legacy: true, reason: LEGACY_GUIDANCE };
        }
        if (typeof data.type === 'string' && data.type.startsWith('sdd.')) {
            return { legacy: true, reason: LEGACY_GUIDANCE };
        }
    }
    return { legacy: false };
}
module.exports = {
    OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, KIND_TO_TYPE,
    LEGACY_GUIDANCE, detectLegacyFormat,
};
