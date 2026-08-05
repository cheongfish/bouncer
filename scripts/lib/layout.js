'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { toPosix } = require('./paths');
const CONTEXT_ROOT = '.bouncer/context';
// 프로젝트 전역 Distill SSOT(blueprint별 distill.md / explain.md 아님).
// 에이전트 런타임 주의사항 — OKF context 트리 밖, config.json과 같은 `.bouncer/`
// 루트. 소비자와 master rules는 이 문자열을 정확히 써야 한다.
const PROJECT_DISTILL = '.bouncer/Distill.md';
// init soft-migrate: 예전 context 경로에만 있으면 새 경로로 옮긴다.
const LEGACY_PROJECT_DISTILL = `${CONTEXT_ROOT}/Distill.md`;
// 신형 \d{3}-slug + 전이용 EPIC-\d{3}- / BP-\d{3}-. 신규 scaffold는 신형만 만든다.
const EPIC_DIR = /^\.bouncer\/context\/epics\/(?:EPIC-)?\d{3}-[^/]+$/;
const BLUEPRINT_DIR = /^\.bouncer\/context\/epics\/(?:EPIC-)?\d{3}-[^/]+\/blueprints\/(?:BP-)?\d{3}-[^/]+$/;
function normalizeRepoPath(value) {
    return toPosix(value);
}
function isCanonicalEpicDir(value) {
    return EPIC_DIR.test(normalizeRepoPath(value));
}
function isCanonicalBlueprintDir(value) {
    return BLUEPRINT_DIR.test(normalizeRepoPath(value));
}
module.exports = {
    CONTEXT_ROOT,
    PROJECT_DISTILL,
    LEGACY_PROJECT_DISTILL,
    normalizeRepoPath,
    isCanonicalEpicDir,
    isCanonicalBlueprintDir,
};
