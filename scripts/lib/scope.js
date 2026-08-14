// scripts/lib/scope.js
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { epicDirOf, toPosix } = require('./paths');
const { readShards } = require('./distill');
const { CONTEXT_ROOT, PROJECT_DISTILL, DISTILL_SHARD_DIR } = require('./layout');
function isUnder(file, entry) {
    const f = toPosix(file);
    const e = toPosix(entry);
    if (f === e)
        return true;
    const pref = e.endsWith('/') ? e : `${e}/`;
    return f.startsWith(pref);
}
// 빌드 산출물과 runtime state는 Bouncer 관리 scope가 아님: stage하지도
// 위반으로 보고하지도 않아 .gitignore가 없는 repo도 finalize를 막지 않음.
// `bouncer init`은 프로젝트가 무시해야 할 항목을 알려 주며, `--write-gitignore`
// 동의 신호가 있을 때만 마커 블록 안에서 쓴다(기본은 제안만).
// Execute checkout은 `<repo>/.worktrees/<BP-id>` 아래에 있음. 트리 전체를
// ignore하여 finalize가 중첩 worktree 파일을 scope 밖으로 보지 않게 함.
// `.bouncer/.venv/`는 init 설치 산출물 — 범위 위반으로 보고하지 않는다.
const RUNTIME_ARTIFACTS = ['node_modules/', 'graphify-out/', '.worktrees/', '.bouncer/.venv/'];
function isRuntimeArtifact(file) {
    const f = toPosix(file);
    return RUNTIME_ARTIFACTS.some((entry) => isUnder(f, entry));
}
function registeredDistillShardPaths(repoRoot) {
    if (typeof repoRoot !== 'string' || !repoRoot)
        return new Set();
    const state = readShards({ repoRoot });
    if (!state.sharded || !state.valid)
        return new Set();
    return new Set(state.shards
        .map((shard) => shard && shard.path)
        .filter((rel) => (typeof rel === 'string'
        && new RegExp(`^${DISTILL_SHARD_DIR}/[^/]+\\.md$`).test(toPosix(rel)))));
}
function makeAllowed({ affectedPaths, blueprintDir }) {
    const bp = toPosix(blueprintDir);
    const epicDir = epicDirOf(bp);
    const paths = Array.isArray(affectedPaths) ? affectedPaths : [];
    return function allowed(file) {
        const f = toPosix(file);
        if (isUnder(f, `${bp}/`))
            return true;
        if (f === `${epicDir}/index.md`)
            return true;
        if (f === `${CONTEXT_ROOT}/index.md`)
            return true;
        // Finalize는 promotion으로 project Distill을 항상 갱신; 모든 blueprint의
        // affected_paths에 넣을 필요 없음.
        if (f === PROJECT_DISTILL)
            return true;
        return paths.some((p) => isUnder(f, p));
    };
}
// execute/commit 범위는 affected_paths만 권한으로 삼아야 한다. finalize가
// 별도 promotion 단계에서만 이 정책을 확장하도록 함수를 분리해 두면,
// 공용 makeAllowed를 넓혀 일반 task가 샤드를 몰래 커밋하는 회귀를 막는다.
function makeFinalizeAllowed({ repoRoot, affectedPaths, blueprintDir }) {
    const allowed = makeAllowed({ affectedPaths, blueprintDir });
    const registered = registeredDistillShardPaths(repoRoot);
    return function finalizeAllowed(file) {
        const rel = toPosix(file);
        return allowed(rel) || registered.has(rel);
    };
}
module.exports = {
    isUnder,
    isRuntimeArtifact,
    RUNTIME_ARTIFACTS,
    makeAllowed,
    makeFinalizeAllowed,
    registeredDistillShardPaths,
};
