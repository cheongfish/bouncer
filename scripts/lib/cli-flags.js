'use strict';
/**
 * CLI 공통 플래그 파서. 명령 모듈이 cli.ts를 require하지 못하게 여기 둔다
 * (순환: cli.ts → 명령 모듈 → cli.ts).
 */
function parseFlags(rest) {
    const flags = {};
    // 위치 인자(scaffold kind, migrate kind)는 건너뛴다. 전부 플래그로 삼키면
    // 핸들러가 rest[0]을 kind로 읽지 못한다.
    for (let i = 0; i < rest.length; i += 1) {
        const tok = rest[i];
        if (!tok.startsWith('--'))
            continue;
        const key = tok.slice(2);
        const next = rest[i + 1];
        // 다음이 없거나 또 다른 -- 토큰이면 boolean. --yes --repo <dir> 에서
        // '--repo'를 --yes의 값으로 소비하지 않기 위함.
        if (next === undefined || next.startsWith('--')) {
            flags[key] = true;
        }
        else {
            flags[key] = next;
            // 값을 소비했으니 다음 루프가 그 값을 새 플래그로 파싱하지 않는다.
            i += 1;
        }
    }
    return flags;
}
module.exports = { parseFlags };
