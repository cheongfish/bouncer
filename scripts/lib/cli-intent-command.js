'use strict';
// intent 전용 command. projectCommands는 이 모듈을 정적 import하지 않고
// 첫 intent 실행에서만 require한다. 그 안에서도 argv 검증을 통과한 뒤에만
// intent-provenance를 적재해, 거절·help 경로가 symbol-index를 cache에 남기지 않는다.
/**
 * intent 전용 인자 파서. parseFlags는 마지막 값만 남기고 빈 문자열을 통과시키므로
 * 중복 singleton·빈 --symbol/--candidate·정수 아닌 --limit를 여기서 거절한다.
 * 값 검증만 하고 Git은 치지 않는다 — 잘못된 예산을 들고 resolver를 열지 않기 위함.
 *
 * @param {string[]} rest - `intent` 뒤 argv
 * @returns {IntentArgs} 성공 시 symbol·optional candidate/limit/repo, 실패 시 error
 */
function parseIntentArgs(rest) {
    let symbol = null;
    let symbolSeen = false;
    let candidate = null;
    let candidateSeen = false;
    let limit = null;
    let limitSeen = false;
    let repo;
    let repoSeen = false;
    const fail = (message) => ({
        error: `intent: ${message}\n`,
        symbol,
        candidate,
        limit,
        repo,
    });
    for (let i = 0; i < rest.length; i += 1) {
        const token = rest[i];
        if (token === '--symbol') {
            // 1. singleton — 두 번째 --symbol을 마지막 값으로 덮으면 호출자가 고른
            //    함수와 다른 조회가 성공한 것처럼 보인다.
            if (symbolSeen)
                return fail('duplicate option: --symbol');
            symbolSeen = true;
            const value = rest[++i];
            if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
                return fail('--symbol requires a non-empty function name');
            }
            symbol = value.trim();
            continue;
        }
        if (token === '--candidate') {
            if (candidateSeen)
                return fail('duplicate option: --candidate');
            candidateSeen = true;
            const value = rest[++i];
            // opaque ref는 resolver가 발급한 값이다. 빈 문자열을 path로 재해석하지 않는다.
            if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
                return fail('--candidate requires a non-empty qualified-ref');
            }
            candidate = value.trim();
            continue;
        }
        if (token === '--limit') {
            if (limitSeen)
                return fail('duplicate option: --limit');
            limitSeen = true;
            const value = rest[++i];
            if (value === undefined || value.startsWith('--') || value.length === 0) {
                return fail('--limit requires an integer 1..5');
            }
            // 1..5 한 자리만 받는다. Number('3.0')·parseInt('3abc')는 통과하므로 정규식으로 막는다.
            if (!/^[1-5]$/.test(value)) {
                return fail('--limit requires an integer 1..5');
            }
            limit = Number(value);
            continue;
        }
        if (token === '--repo') {
            if (repoSeen)
                return fail('duplicate option: --repo');
            repoSeen = true;
            const value = rest[++i];
            if (!value || value.startsWith('--'))
                return fail('--repo requires a directory');
            repo = value;
            continue;
        }
        if (token.startsWith('--'))
            return fail(`unknown option: ${token}`);
        return fail(`unexpected argument: ${token}`);
    }
    if (!symbolSeen || symbol === null) {
        return fail('--symbol <function-name> is required');
    }
    return { symbol, candidate, limit, repo };
}
function catchMessage(error) {
    // 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
    // TypeError 대신 빈 메시지가 되어 종료 코드 경로가 바뀐다.
    return error.message;
}
/**
 * 함수 의도 provenance를 조회한다. resolved가 아닌 상태 JSON도 exit 0이다 —
 * Plan이 코드 탐색을 이어가려면 ambiguous/unresolved/unlinked가 사용법 오류가
 * 아니어야 한다. 저장소와 `.bouncer/context/**`는 읽기만 한다.
 *
 * @param {string[]} rest - `intent` 뒤 argv
 * @param {CliIo} io - stdout은 JSON 하나만, 진단은 stderr
 * @returns {number} 상태 JSON 0, Git/filesystem 조회 실패 1, 사용법 2
 */
function cmdIntent(rest, io) {
    const parsed = parseIntentArgs(rest);
    if (parsed.error) {
        io.err(parsed.error);
        return 2;
    }
    // argv 검증을 통과한 뒤에만 resolver를 적재한다. 빈·중복 option 거절이
    // intent-provenance·symbol-index를 require.cache에 남기지 않게 하기 위함.
    // export= 모듈이라 import=require 정적 경계를 쓰지 않고 실행 시점 require만 한다.
    const intentProvenance = require('./intent-provenance');
    const { resolveIntentProvenance } = intentProvenance;
    const repoRoot = (parsed.repo || process.cwd());
    try {
        // JSON은 resolver가 돌아온 뒤에만 쓴다. throw 경로에 부분 payload가 남지 않게.
        const result = resolveIntentProvenance({
            repoRoot,
            symbol: parsed.symbol,
            candidateRef: parsed.candidate,
            limit: parsed.limit === null ? undefined : parsed.limit,
        });
        io.out(`${JSON.stringify(result, null, 2)}\n`);
        return 0;
    }
    catch (error) {
        // Git 부재·명령 실패, repo 실경로 조회 실패, 현재 후보에 없는 candidate ref는
        // resolver가 Error로 던진다. 입력 shape는 파서가 이미 exit 2로 거절했으므로
        // 메시지 있는 조회 실패만 stderr+1로 흡수한다. 메시지 없는 예외는 핸들러
        // 버그이므로 다시 던져 숨기지 않는다.
        const message = catchMessage(error);
        if (typeof message !== 'string' || message.length === 0)
            throw error;
        io.err(`intent: ${message}\n`);
        return 1;
    }
}
module.exports = {
    run: cmdIntent,
};
