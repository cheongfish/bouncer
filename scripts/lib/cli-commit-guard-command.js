'use strict';
const cliFlags = require("./cli-flags");
const { parseFlags } = cliFlags;
const commitHook = require("./commit-hook");
const { evaluateStaged } = commitHook;
const USAGE = `usage: bouncer commit-guard --staged [--repo <dir>]

`;
/**
 * staged 인덱스 범위 검사 CLI. --staged가 없으면 사용법 오류(exit 2)로
 * 끝내 판정 예외(exit 1, 커밋 차단)와 구분한다.
 *
 * @param {object} opts
 * @param {string[]} opts.argv - `commit-guard` 뒤 인자
 * @param {string} opts.cwd - `--repo`가 없을 때 쓸 저장소 루트
 * @param {Function} [opts.evaluate] - 기본 `evaluateStaged`. 테스트 seam
 * @param {Function} [opts.stderr] - 차단 사유·사용법 싱크. 생략 시 stderr
 * @returns {number} 0 허용, 1 차단 또는 내부 오류, 2 사용법
 */
function runCommitGuard({ argv, cwd, evaluate, stderr, }) {
    const err = stderr || ((s) => {
        process.stderr.write(s);
    });
    if (!argv.includes('--staged')) {
        err(USAGE);
        return 2;
    }
    const flags = parseFlags(argv);
    const repoRoot = typeof flags.repo === 'string' && flags.repo ? flags.repo : cwd;
    const judge = evaluate || evaluateStaged;
    let result;
    try {
        result = judge({ repoRoot });
    }
    catch (error) {
        // evaluate가 던지는 모든 예외를 흡수한다. hook 안에서 uncaught로 죽으면
        // git은 막히지만 정해진 진단 문자열이 아니라 스택이 나와 복구 힌트가 없다.
        const message = error instanceof Error ? error.message : String(error);
        err(`commit-guard: internal error, blocking commit: ${message}\n`);
        return 1;
    }
    if (result.block) {
        err(`${result.reason || 'commit blocked'}\n`);
        return 1;
    }
    return 0;
}
function cmdCommitGuard(rest, io) {
    return runCommitGuard({ argv: rest, cwd: process.cwd(), stderr: io.err });
}
module.exports = {
    runCommitGuard,
    run: cmdCommitGuard,
    usage: `  commit-guard --staged [--repo <dir>]
             Allow or block a commit from the current index (git pre-commit).
`,
};
