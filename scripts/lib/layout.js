'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { toPosix } = require('./paths');
const CONTEXT_ROOT = '.bouncer/context';
// 프로젝트 전역 Distill SSOT(blueprint별 distill.md 아님). 대소문자 구분
// 경로 — 소비자와 master rules는 이 문자열을 정확히 써야 한다.
const PROJECT_DISTILL = `${CONTEXT_ROOT}/Distill.md`;
const EPIC_DIR = /^\.bouncer\/context\/epics\/EPIC-\d+-[^/]+$/;
const BLUEPRINT_DIR = /^\.bouncer\/context\/epics\/EPIC-\d+-[^/]+\/blueprints\/BP-\d+-[^/]+$/;
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
    normalizeRepoPath,
    isCanonicalEpicDir,
    isCanonicalBlueprintDir,
};
