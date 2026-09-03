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
 * @param {unknown[]|null|undefined} [opts.files] - 검사할 경로(변경·untracked·staged).
 *   null/undefined는 빈 목록으로 취급한다.
 * @param {unknown} [opts.affectedPaths] - 활성 task의 `affected_paths`
 * @param {unknown} [opts.blueprintDir] - blueprint 상대 경로(번들 문서 예외용)
 * @returns {{ allow: boolean, violations: unknown[] }}
 *   `allow === true`면 위반 없음(`violations`는 `[]`).
 *   `allow === false`면 `violations`에 범위 밖 경로만 담는다.
 *   runtime artifact(`isRuntimeArtifact`)는 위반으로 치지 않는다 —
 *   `makeAllowed` 예외와 함께 이 모듈이 소유한다.
 */
function checkCommitSafety({ files, affectedPaths, blueprintDir }) {
    const allowed = makeAllowed({ affectedPaths, blueprintDir });
    const violations = (files || [])
        .filter((f) => !isRuntimeArtifact(f))
        .filter((f) => !allowed(f));
    return { allow: violations.length === 0, violations };
}
module.exports = { checkCommitSafety };
