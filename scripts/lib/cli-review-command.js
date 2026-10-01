'use strict';
const cliFlags = require("./cli-flags");
const { parseFlags } = cliFlags;
const paths = require("./paths");
const { isNumericContextId } = paths;
const ALLOWED_STATUS = ['requested', 'addressed', 'accepted'];
const USAGE = 'usage: bouncer review record --blueprint <dir> [--task <ddd>] '
    + '--round <json-file> [--status <requested|addressed|accepted>] [--repo <dir>]\n'
    + '\n'
    + '  review record --blueprint <dir> [--task <ddd>] --round <json-file> '
    + '[--status <requested|addressed|accepted>]\n'
    + '             Record one review round and finding updates (JSON).\n';
/**
 * `--flag` 토큰 횟수. parseFlags는 마지막 값만 남겨 중복 --blueprint를 덮으므로
 * 덮기 전에 거절해야 다른 문서에 기록하지 않는다.
 *
 * @param {string[]} rest - 플래그 argv
 * @param {string} name - `--` 없는 플래그 이름
 * @returns {number} 등장 횟수
 */
function countFlag(rest, name) {
    let n = 0;
    for (const tok of rest) {
        if (tok === `--${name}`)
            n += 1;
    }
    return n;
}
/**
 * `review record` argv. record 밖의 동사와 필수 플래그 누락·중복·허용 밖
 * status는 resolver를 열기 전에 거절해 exit 2와 원장 실패(exit 1)를 가른다.
 *
 * @param {string[]} rest - `review` 뒤 argv
 * @returns {ParsedRecord} 성공 필드 또는 error
 */
function parseReviewRecordArgs(rest) {
    const fail = (message) => ({
        error: `review record: ${message}\n${USAGE}`,
        blueprint: null,
        task: null,
        round: null,
        status: null,
    });
    if (rest[0] !== 'record') {
        return fail('command must be record');
    }
    const flags = rest.slice(1);
    for (const name of ['blueprint', 'round', 'task', 'status', 'repo']) {
        if (countFlag(flags, name) > 1) {
            return fail(`--${name} specified more than once`);
        }
    }
    const f = parseFlags(flags);
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        return fail('--blueprint is required');
    }
    if (typeof f.round !== 'string' || f.round === '') {
        return fail('--round <json-file> is required');
    }
    if (Object.prototype.hasOwnProperty.call(f, 'task')) {
        if (typeof f.task !== 'string' || !isNumericContextId(f.task)) {
            return fail('--task must be a three-digit id');
        }
    }
    if (Object.prototype.hasOwnProperty.call(f, 'status')) {
        if (typeof f.status !== 'string' || !ALLOWED_STATUS.includes(f.status)) {
            return fail('--status must be requested, addressed, or accepted');
        }
    }
    if (f.repo !== undefined && (typeof f.repo !== 'string' || f.repo === '')) {
        return fail('--repo requires a directory');
    }
    return {
        blueprint: f.blueprint,
        task: typeof f.task === 'string' ? f.task : null,
        round: f.round,
        status: typeof f.status === 'string' ? f.status : null,
        repo: typeof f.repo === 'string' ? f.repo : undefined,
    };
}
/**
 * 공개 `review` 핸들러. argv 검증과 원장 기록·JSON·exit만 연결한다.
 *
 * @param {string[]} rest - `record`와 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 원장 거절 1, 사용법 2
 */
function cmdReview(rest, io) {
    const parsed = parseReviewRecordArgs(rest);
    if (parsed.error) {
        io.err(parsed.error);
        return 2;
    }
    // argv를 통과한 뒤에만 기록 모듈을 적재한다. 사용법 거절이 review.md I/O
    // 경로를 require.cache에 남기지 않게 하기 위함.
    const reviewRecord = require('./review-record');
    const result = reviewRecord.recordReview({
        repoRoot: parsed.repo ? parsed.repo : process.cwd(),
        blueprintDir: parsed.blueprint,
        task: parsed.task,
        roundFile: parsed.round,
        status: parsed.status,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
}
module.exports = {
    run: cmdReview,
    usage: '  review record --blueprint <dir> [--task <ddd>] --round <json-file> '
        + '[--status <requested|addressed|accepted>]\n'
        + '             Record one review round and finding updates (JSON).\n',
};
