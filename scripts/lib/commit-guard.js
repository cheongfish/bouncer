// scripts/lib/commit-guard.js
'use strict';
const scope = require("./scope");
const { makeAllowed, isRuntimeArtifact } = scope;
/**
 * 커밋 범위 안전 판정의 단일 구현.
 * `commitTask`(CLI)와 호스트 commit hook(`evaluateCommit`)이 같은
 * `allow`·`violations`를 쓰기 위한 계약이다. 허용·거부 로직을 어댑터에
 * 복제하지 말고 여기만 호출한다.
 *
 * @param {object} opts
 * @param {unknown[]|null|undefined} [opts.files] - 호출자가 선택한 실제 경로.
 *   G17 호출자는 staged 파일만 전달하며, 이 함수는 working tree를 다시 읽지 않는다.
 *   null/undefined는 빈 목록으로 취급한다.
 * @param {unknown} [opts.affectedPaths] - 활성 task의 `affected_paths`
 * @param {unknown} [opts.blueprintDir] - blueprint 상대 경로(번들 문서 예외용)
 * @param {object} [opts.coordinator] - `scope.coordinatorContext` 결과.
 *   `active`면 ledger의 현재 scope가 승인된 `affected_paths`를 대신하고,
 *   `reason`이 있으면 worktree·revision 경계 위반이므로 범위 판정 전에 거절한다.
 * @returns {{ allow: boolean, violations: unknown[], code?: string }}
 *   `allow === true`면 위반 없음(`violations`는 `[]`).
 *   `allow === false`면 `code`가 거절 사유이고, `out-of-scope`일 때만
 *   `violations`가 범위 밖 경로다. 경계 위반은 staged 경로 전체를 담는다.
 *   runtime artifact(`isRuntimeArtifact`)는 위반으로 치지 않는다 —
 *   `makeAllowed` 예외와 함께 이 모듈이 소유한다.
 */
function checkCommitSafety({ files, affectedPaths, blueprintDir, coordinator }) {
    const candidates = (files || []).filter((f) => !isRuntimeArtifact(f));
    const active = Boolean(coordinator && coordinator.active);
    // worktree 경계와 revision 불일치는 범위 계산 이전의 거절이다. 여기서
    // scope로 다시 판정하면 main worktree 커밋이 "범위 안"으로 통과한다.
    if (active && coordinator && coordinator.reason) {
        return { allow: false, code: coordinator.reason, violations: candidates };
    }
    // coordinator 실행에서 승인된 affected_paths는 초기 예상치다 — 현재 정본은
    // ledger scope. ledger가 아직 scope를 기록하지 않았으면 승인값을 그대로 쓴다.
    const scope = active && coordinator && Array.isArray(coordinator.scope)
        ? coordinator.scope
        : affectedPaths;
    const allowed = makeAllowed({ affectedPaths: scope, blueprintDir });
    const violations = candidates.filter((f) => !allowed(f));
    if (violations.length === 0)
        return { allow: true, violations: [] };
    return { allow: false, code: 'out-of-scope', violations };
}
module.exports = { checkCommitSafety };
