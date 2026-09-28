'use strict';
// intent 전용 command. projectCommands는 이 모듈을 정적 import하지 않고
// 첫 intent 실행에서만 require한다. 그 안에서도 argv 검증을 통과한 뒤에만
// intent-provenance / intent-bundle을 적재해, 거절·help 경로가 resolver를
// require.cache에 남기지 않는다.
// loadExecutionTask와 같은 canonical layout만 CLI에서 먼저 거절한다.
// 정규식 밖 경로는 resolver를 열지 않고 exit 2로 끝낸다.
const CANONICAL_TASK_RE = /^\.bouncer\/context\/epics\/\d{3}-[^/]+\/blueprints\/\d{3}-[^/]+\/tasks\/\d{3}\/tasks\.md$/;
/**
 * intent argv를 query와 bundle로 분기한다. `bundle` positional만 하위 명령이고,
 * 그 외 positional·잘못된 option은 resolver를 열기 전에 거절한다.
 *
 * @param {string[]} rest - `intent` 뒤 argv
 * @returns {IntentArgs} 성공 시 mode별 필드, 실패 시 error
 */
function parseIntentArgs(rest) {
    if (rest[0] === 'bundle') {
        return parseBundleArgs(rest.slice(1));
    }
    return parseQueryArgs(rest);
}
/**
 * 단일 함수 intent 조회 인자. parseFlags는 마지막 값만 남기고 빈 문자열을
 * 통과시키므로 중복 singleton·빈 --symbol/--candidate·정수 아닌 --limit를
 * 여기서 거절한다. 값 검증만 하고 Git은 치지 않는다.
 *
 * @param {string[]} rest - `intent` 뒤 argv(`bundle` 아님)
 * @returns {QueryArgs} 성공 시 symbol·optional candidate/limit/repo, 실패 시 error
 */
function parseQueryArgs(rest) {
    let symbol = null;
    let symbolSeen = false;
    let candidate = null;
    let candidateSeen = false;
    let limit = null;
    let limitSeen = false;
    let repo;
    let repoSeen = false;
    const fail = (message) => ({
        mode: 'query',
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
    return { mode: 'query', symbol, candidate, limit, repo };
}
/**
 * intent bundle 인자. --symbol은 반복 가능하고 --candidate는 바로 앞
 * --symbol에만 붙는다. --limit은 query 전용이라 bundle에서 거절한다.
 *
 * @param {string[]} rest - `intent bundle` 뒤 argv
 * @returns {BundleArgs} 성공 시 task·functions·optional repo, 실패 시 error
 */
function parseBundleArgs(rest) {
    let task = null;
    let taskSeen = false;
    const functions = [];
    const seenSymbols = new Set();
    let openIndex = -1;
    let repo;
    let repoSeen = false;
    const fail = (message) => ({
        mode: 'bundle',
        error: `intent: ${message}\n`,
        task,
        functions,
        repo,
    });
    for (let i = 0; i < rest.length; i += 1) {
        const token = rest[i];
        if (token === '--task') {
            if (taskSeen)
                return fail('duplicate option: --task');
            taskSeen = true;
            const value = rest[++i];
            if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
                return fail('--task requires a non-empty tasks.md path');
            }
            const trimmed = value.trim();
            // absolute·`..`·비-canonical은 사용법 오류. resolver를 열면 exit 1로
            // 섞이므로 여기서 막아 query와 같은 exit 2 경계를 유지한다.
            if (trimmed.startsWith('/')
                || trimmed.includes('..')
                || !CANONICAL_TASK_RE.test(trimmed)) {
                return fail('--task must be a repo-relative canonical tasks.md path');
            }
            task = trimmed;
            continue;
        }
        if (token === '--symbol') {
            const value = rest[++i];
            if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
                return fail('--symbol requires a non-empty function name');
            }
            const symbol = value.trim();
            if (seenSymbols.has(symbol)) {
                return fail(`duplicate function symbol: ${symbol}`);
            }
            seenSymbols.add(symbol);
            functions.push({ symbol });
            openIndex = functions.length - 1;
            continue;
        }
        if (token === '--candidate') {
            // 바로 앞 --symbol에만 결합. 앞선 symbol이 없거나 이미 candidate가
            // 있으면 한 symbol에 두 ref를 붙인 요청이므로 거절한다.
            if (openIndex < 0) {
                return fail('--candidate requires a preceding --symbol');
            }
            const open = functions[openIndex];
            if (open.candidateRef !== undefined && open.candidateRef !== null) {
                return fail('duplicate option: --candidate for the same --symbol');
            }
            const value = rest[++i];
            if (value === undefined || value.startsWith('--') || value.trim().length === 0) {
                return fail('--candidate requires a non-empty qualified-ref');
            }
            open.candidateRef = value.trim();
            continue;
        }
        if (token === '--limit') {
            // bundle은 전체 함수 집합을 기록한다. query limit를 받으면 예산이
            // 기록 계약처럼 보이므로 알 수 없는 option과 같이 거절한다.
            return fail('unknown option: --limit');
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
    if (!taskSeen || task === null) {
        return fail('--task <tasks.md> is required');
    }
    if (functions.length === 0) {
        return fail('--symbol <function-name> is required');
    }
    return { mode: 'bundle', task, functions, repo };
}
function catchMessage(error) {
    // 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
    // TypeError 대신 빈 메시지가 되어 종료 코드 경로가 바뀐다.
    return error.message;
}
/**
 * 함수 의도 provenance를 조회하거나 task intent bundle을 만든다.
 * query의 resolved가 아닌 상태 JSON도 exit 0이다 — Plan이 코드 탐색을
 * 이어가려면 ambiguous/unresolved/unlinked가 사용법 오류가 아니어야 한다.
 * bundle도 ambiguous면 record를 쓰지 않고 opaque candidate만 돌려 exit 0이다.
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
    if (parsed.mode === 'bundle') {
        return cmdIntentBundle(parsed, io);
    }
    return cmdIntentQuery(parsed, io);
}
/**
 * 단일 함수 intent 조회. argv 검증 뒤에만 provenance를 적재한다.
 *
 * @param {QueryArgs} parsed - 검증된 query 인자
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 상태 JSON 0, 조회 실패 1
 */
function cmdIntentQuery(parsed, io) {
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
/**
 * task intent bundle 생성·재사용. 유효 argv 뒤에만 intent-bundle을 적재한다.
 * ambiguous는 core가 throw하므로 candidate 목록만 돌려 record를 남기지 않는다.
 *
 * @param {BundleArgs} parsed - 검증된 bundle 인자
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} created/reused/ambiguous 0, 조회 실패 1
 */
function cmdIntentBundle(parsed, io) {
    const intentBundle = require('./intent-bundle');
    const { resolveTaskIntentBundle } = intentBundle;
    const repoRoot = (parsed.repo || process.cwd());
    try {
        const result = resolveTaskIntentBundle({
            repoRoot,
            taskFile: parsed.task,
            functions: parsed.functions,
        });
        io.out(`${JSON.stringify(result, null, 2)}\n`);
        return 0;
    }
    catch (error) {
        const message = catchMessage(error);
        if (typeof message !== 'string' || message.length === 0)
            throw error;
        // core는 incomplete selection을 Error로 올린다. CLI는 같은 opaque
        // candidate_ref를 돌려 호출자가 --candidate로 재선택하게 한다.
        const ambiguousMatch = /^ambiguous symbol requires candidate ref: (.+)$/.exec(message);
        if (ambiguousMatch) {
            const intentProvenance = require('./intent-provenance');
            try {
                const selection = intentProvenance.resolveIntentProvenance({
                    repoRoot,
                    symbol: ambiguousMatch[1],
                });
                // provenance의 ambiguous JSON만 쓴다. bundle record·부분 stdout은 없다.
                io.out(`${JSON.stringify(selection, null, 2)}\n`);
                return 0;
            }
            catch (selectionError) {
                // ambiguous recovery용 2차 provenance 조회가 실패해도 바깥 catch로
                // 다시 던지지 않는다. 부분 stdout 없이 다른 조회 실패와 같은 stderr+1.
                const selectionMessage = catchMessage(selectionError);
                if (typeof selectionMessage !== 'string' || selectionMessage.length === 0) {
                    throw selectionError;
                }
                io.err(`intent: ${selectionMessage}\n`);
                return 1;
            }
        }
        io.err(`intent: ${message}\n`);
        return 1;
    }
}
module.exports = {
    run: cmdIntent,
};
