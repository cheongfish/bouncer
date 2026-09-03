'use strict';
const paths = require("./paths");
const { toPosix } = paths;
const CONTEXT_ROOT = '.bouncer/context';
// 프로젝트 전역 Distill SSOT(blueprint별 distill.md / explain.md 아님).
// 에이전트 런타임 주의사항 — OKF context 트리 밖, config.json과 같은 `.bouncer/`
// 루트. 소비자와 master rules는 이 문자열을 정확히 써야 한다.
const PROJECT_DISTILL = '.bouncer/Distill.md';
// init soft-migrate: 예전 context 경로에만 있으면 새 경로로 옮긴다.
const LEGACY_PROJECT_DISTILL = `${CONTEXT_ROOT}/Distill.md`;
// 샤드 파일은 project Distill과 같은 런타임 영역에 둔다. 이 상수를
// 소비자마다 다시 조합하면 linked checkout에서 기준 경로가 갈라질 수 있다.
const DISTILL_ROOT = '.bouncer/distill';
// 인덱스가 가리키는 정본 샤드의 물리 경계. 소비자는 이 경계 밖의
// 일반 Markdown을 Distill 샤드로 승격하거나 그래프 입력으로 삼지 않는다.
const DISTILL_SHARD_DIR = DISTILL_ROOT;
const DISTILL_INDEX = PROJECT_DISTILL;
// Codex는 플러그인 `agents/*.md`를 named role로 읽지 않는다. 프로젝트
// `.codex/agents/*.toml`만 스캔하므로 init이 여기에 심는다.
const CODEX_AGENTS_DIR = '.codex/agents';
// context 디렉터리는 접두 없는 zero-pad 세 자리 id만 정본으로 인정한다.
const EPIC_DIR = /^\.bouncer\/context\/epics\/\d{3}-[^/]+$/;
const BLUEPRINT_DIR = /^\.bouncer\/context\/epics\/\d{3}-[^/]+\/blueprints\/\d{3}-[^/]+$/;
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
    DISTILL_ROOT,
    DISTILL_SHARD_DIR,
    DISTILL_INDEX,
    CODEX_AGENTS_DIR,
    normalizeRepoPath,
    isCanonicalEpicDir,
    isCanonicalBlueprintDir,
};
