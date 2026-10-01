'use strict';
const cliFlags = require("./cli-flags");
const { parseFlags } = cliFlags;
const PRINT_ROLES = ['implementer', 'reviewer', 'debugger', 'coordinator'];
const USAGE = `usage: bouncer dispatch print --role <role> --cwd <dir> --input <file> --out <dir> [--repo <dir>]

  dispatch print --role <implementer|reviewer|debugger|coordinator> --cwd <dir> --input <file> --out <dir>
             Run one Cursor print dispatch (JSON).
`;
const REQUIRED_FLAGS = ['role', 'cwd', 'input', 'out'];
/**
 * `--flag` 토큰 횟수. parseFlags는 마지막 값만 남겨 중복 `--role`을 조용히
 * 덮으므로, 덮기 전에 거절해야 잘못된 역할로 실행되지 않는다.
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
 * `dispatch print` argv. print 밖의 동사와 필수 플래그 누락·중복은 resolver를
 * 열기 전에 거절해 exit 2와 운영 실패(exit 1)를 가른다.
 *
 * @param {string[]} rest - `dispatch` 뒤 argv
 * @returns {ParsedPrint} 성공 필드 또는 error
 */
function parseDispatchPrintArgs(rest) {
    const fail = (message) => ({
        error: `dispatch print: ${message}\n${USAGE}`,
        role: null,
        cwd: null,
        input: null,
        out: null,
    });
    if (rest[0] !== 'print') {
        return fail('command must be print');
    }
    const flags = rest.slice(1);
    for (const name of REQUIRED_FLAGS) {
        if (countFlag(flags, name) > 1) {
            return fail(`--${name} specified more than once`);
        }
    }
    if (countFlag(flags, 'repo') > 1) {
        return fail('--repo specified more than once');
    }
    const f = parseFlags(flags);
    for (const name of REQUIRED_FLAGS) {
        const value = f[name];
        if (typeof value !== 'string' || value === '') {
            return fail(`--${name} is required`);
        }
    }
    if (f.repo !== undefined && (typeof f.repo !== 'string' || f.repo === '')) {
        return fail('--repo requires a directory');
    }
    const role = f.role;
    if (!PRINT_ROLES.includes(role)) {
        return fail('--role must be implementer, reviewer, debugger, or coordinator');
    }
    return {
        role,
        cwd: f.cwd,
        input: f.input,
        out: f.out,
        repo: typeof f.repo === 'string' ? f.repo : undefined,
    };
}
/**
 * 공개 `dispatch` 핸들러. argv 검증과 print 실행·JSON·exit만 연결한다.
 *
 * @param {string[]} rest - `print`와 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 운영 거절 1, 사용법 2
 */
function cmdDispatch(rest, io) {
    const parsed = parseDispatchPrintArgs(rest);
    if (parsed.error) {
        io.err(parsed.error);
        return 2;
    }
    // argv를 통과한 뒤에만 print 모듈을 적재한다. 사용법 거절이 agent spawn
    // 경로를 require.cache에 남기지 않게 하기 위함.
    const printDispatch = require('./print-dispatch');
    const result = printDispatch.runPrintDispatch({
        repoRoot: parsed.repo ? parsed.repo : process.cwd(),
        role: parsed.role,
        cwd: parsed.cwd,
        inputFile: parsed.input,
        outDir: parsed.out,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
}
module.exports = {
    run: cmdDispatch,
    usage: `  dispatch print --role <implementer|reviewer|debugger|coordinator> --cwd <dir> --input <file> --out <dir>
             Run one Cursor print dispatch (JSON).
`,
};
