'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execSync } = require('node:child_process');
const { readDoc } = require('./frontmatter');
const { renderDoc } = require('./render');
const { isCanonicalBlueprintDir } = require('./layout');
const { nowIsoKst } = require('./time');
const { listTasksDocs } = require('./tasks-docs');
// current.ts는 이 모듈군 밖이라 strict include에 넣지 않는다. 상대 require를
// 그대로 두면 tsc가 그 파일을 편입해 다음 커밋 몫의 오류가 여기로 새어 온다.
const { readCurrent } = require('./current');
const { toPosix } = require('./paths');
const { verifyLedgerPathFor } = require('./runtime-state');
const { readConfigResult } = require('./config');
// 통과한 실행은 명령이 0으로 종료되었다는 증거입니다. tail에는 명령이
// 끝에 출력하는 요약만 담으면 됩니다. 실패한 실행은 무엇이 잘못됐는지에 대한
// 증거이므로 훨씬 더 많이 — 그리고 리뷰어가 읽는 문서 본문에, frontmatter에만
// 두지 않고 — 보관합니다.
const OUTPUT_TAIL_LINES = 100;
const PASSING_OUTPUT_TAIL_LINES = 20;
const MAX_VERIFY_OUTPUT_BYTES = 10 * 1024 * 1024;
function verificationError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}
function errorCode(error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
        return error.code;
    }
    return undefined;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
// 실행 가능한 argv 문자열 하나만: 셸 체이닝, 리다이렉션, `cd` 접두사 없음.
// Plan S12와 runtime VERIFY_COMMAND_INVALID가 이 predicate를 공유하므로
// 두 표면이 어긋날 수 없습니다.
const VERIFY_COMMAND_FORBIDDEN = /[&|;`<>\n]|\$\(/;
function isValidVerifyCommand(command) {
    if (typeof command !== 'string')
        return false;
    const trimmed = command.trim();
    if (!trimmed)
        return false;
    if (VERIFY_COMMAND_FORBIDDEN.test(trimmed))
        return false;
    return trimmed.split(/\s+/)[0] !== 'cd';
}
function entriesForVerify(repoRoot, blueprintDir) {
    const listing = listTasksDocs({ repoRoot, blueprintDir });
    if (listing.mixed)
        return [];
    // 포인터 task 가 이 blueprint 를 가리키고 문서가 살아 있으면 그 문서만.
    // 문서가 사라졌을 때만 미지정(전체 walk)으로 폴백 — 다른 task 선언을
    // 조용히 끌어오지 않기 위함.
    const pointer = readCurrent({ repoRoot });
    const bp = toPosix(blueprintDir);
    if (isRecord(pointer) && typeof pointer.task === 'string' && toPosix(pointer.blueprint) === bp) {
        const match = listing.entries.find((e) => e.rel === toPosix(pointer.task));
        if (match)
            return [match];
    }
    return listing.entries;
}
function readVerifyCommand(repoRoot, blueprintDir) {
    // blueprint 선언이 있으면 우선합니다. task 문서가 없거나 필드가 없으면
    // 기존 config.verify 경로를 유지합니다. 있지만 유효하지 않은 필드는
    // 조용히 넘어가면 안 됩니다 — plan-time S12 누락을 숨깁니다.
    if (blueprintDir) {
        for (const entry of entriesForVerify(repoRoot, blueprintDir)) {
            try {
                const { data } = readDoc(path.join(repoRoot, entry.rel));
                // `data && data.bouncer && data.bouncer.verify`와 같다. bouncer가 null이면
                // declared가 null로 남아 VERIFY_COMMAND_INVALID로 간다 — undefined로
                // 접으면 config.verify로 폴백되어 S12 누락을 숨긴다.
                const bouncer = data ? data.bouncer : data;
                const declared = bouncer ? bouncer.verify : bouncer;
                if (declared !== undefined) {
                    if (!isValidVerifyCommand(declared)) {
                        throw verificationError('VERIFY_COMMAND_INVALID', 'verify command must be a single executable command');
                    }
                    // isValidVerifyCommand가 통과한 값만 문자열이다. 여기서 다시 접지 않는다.
                    return declared;
                }
            }
            catch (error) {
                if (errorCode(error) === 'VERIFY_COMMAND_INVALID')
                    throw error;
                if (errorCode(error) !== 'ENOENT')
                    throw error;
            }
        }
    }
    const configPath = path.join(repoRoot, '.bouncer', 'config.json');
    // 파일 없음과 깨진 JSON을 한 오류로 합치면 VERIFY_CONFIG_MISSING이
    // 권한·구문 문제를 가린다. 메시지 문자열은 호출자가 경로를 그대로 보게 유지.
    const parsed = readConfigResult(repoRoot);
    // strict가 꺼진 기본 tsc는 `!parsed.ok`로 유니온을 좁히지 못한다.
    // missing/invalid 분기를 유지하려면 리터럴 false와 비교한다.
    if (parsed.ok === false) {
        if (parsed.reason === 'missing') {
            throw verificationError('VERIFY_CONFIG_MISSING', `verification config missing: ${configPath}`);
        }
        throw verificationError('VERIFY_CONFIG_INVALID', `verification config is invalid: ${configPath}`);
    }
    const config = parsed.value;
    // JSON.parse 결과는 unknown이다. 객체로 좁히면 null config의 TypeError가
    // VERIFY_CONFIG_INVALID로 바뀌므로, 예전처럼 .verify에 바로 접근한다.
    const verify = config.verify;
    if (typeof verify !== 'string' || verify.trim() === '') {
        throw verificationError('VERIFY_CONFIG_INVALID', 'config.verify must be a non-empty string');
    }
    return verify;
}
function outputTail(stdout, stderr, lines = OUTPUT_TAIL_LINES) {
    const combined = [stdout, stderr].filter(Boolean).join('');
    return combined.split('\n').slice(-lines).join('\n').trim();
}
function executeVerify(command, { cwd, exec = execSync }) {
    try {
        const result = exec(command, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: MAX_VERIFY_OUTPUT_BYTES,
        });
        const stdout = result && typeof result === 'object' && 'stdout' in result ? result.stdout : result;
        const stderr = result && typeof result === 'object' && 'stderr' in result ? result.stderr : '';
        return {
            ok: true,
            exitCode: 0,
            output: outputTail(stdout, stderr, PASSING_OUTPUT_TAIL_LINES),
        };
    }
    catch (error) {
        const status = typeof error === 'object' && error !== null && 'status' in error
            ? error.status
            : undefined;
        const stdout = typeof error === 'object' && error !== null && 'stdout' in error
            ? error.stdout
            : undefined;
        const stderr = typeof error === 'object' && error !== null && 'stderr' in error
            ? error.stderr
            : undefined;
        return {
            ok: false,
            exitCode: Number.isInteger(status) ? Number(status) : 1,
            output: outputTail(stdout, stderr),
        };
    }
}
function recordVerificationResult({ repoRoot, verificationRel, blueprintDir, command, ranAt, exitCode, output, deps, }) {
    // verificationRel이 정식 인자. blueprintDir은 구 호출 호환(루트 verification.md).
    const rel = verificationRel
        || (blueprintDir ? `${toPosix(blueprintDir)}/verification.md` : null);
    if (!rel) {
        throw verificationError('VERIFY_DOCUMENT_MISSING', 'verification document path missing');
    }
    const verificationPath = path.join(repoRoot, rel);
    let document;
    try {
        document = readDoc(verificationPath);
    }
    catch (error) {
        if (errorCode(error) === 'ENOENT') {
            throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
        }
        throw error;
    }
    const data = document.data;
    // 증적은 파싱 객체에 in-place로 붙인다. 빈 객체로 바꾸면 스칼라 YAML의
    // TypeError가 사라져 실패 형태가 바뀐다.
    const bouncer = (data.bouncer || {});
    data.bouncer = bouncer;
    bouncer.status = exitCode === 0 ? 'passed' : 'failed';
    bouncer.verification = {
        command,
        ran_at: ranAt,
        exit_code: exitCode,
        output_tail: output,
    };
    const evidence = exitCode === 0
        ? ''
        : `\n\`\`\`\n${output}\n\`\`\`\n`;
    const body = `# Verification

## Command
\`${command}\`

## Evidence
Ran at: ${ranAt}
Exit code: ${exitCode}
${evidence}`;
    fs.writeFileSync(verificationPath, renderDoc(data, body));
    // 게이트는 디스크에서 다시 읽은 output_tail을 해싱한다. js-yaml dump/load가
    // 개행·후행 공백을 정규화해도, 기록 쪽이 같은 왕복을 거치면 해시가 갈라지지 않는다.
    const reread = readDoc(verificationPath);
    const rereadBouncer = reread.data.bouncer;
    const rereadEvidence = rereadBouncer && rereadBouncer.verification
        ? rereadBouncer.verification
        : {};
    const outputTail = typeof rereadEvidence.output_tail === 'string' ? rereadEvidence.output_tail : '';
    const outputSha = createHash('sha256').update(outputTail, 'utf8').digest('hex');
    const ledgerPaths = verifyLedgerPathFor({ repoRoot, verificationRel: rel, deps });
    if (ledgerPaths.unavailable || !ledgerPaths.ledgerFile) {
        // 원장 없이 문서만 남기면 에이전트 Write와 구분이 안 된다. Git을 못 쓰면
        // verify 자체를 실패시켜 복구 경로(저장소에서 재실행)만 남긴다.
        throw new Error(ledgerPaths.reason || 'Bouncer requires a Git repository for an active blueprint');
    }
    fs.mkdirSync(path.dirname(ledgerPaths.ledgerFile), { recursive: true });
    const record = {
        rel: toPosix(rel),
        command,
        ran_at: ranAt,
        exit_code: exitCode,
        output_sha: outputSha,
    };
    fs.writeFileSync(ledgerPaths.ledgerFile, `${JSON.stringify(record, null, 2)}\n`);
}
function resolveVerificationRel(repoRoot, blueprintDir) {
    // readVerifyCommand와 동일 entriesForVerify 폴백: 포인터 매칭 → 그 묶음,
    // 아니면 번호 순 첫 묶음. listing이 비면 레거시 루트 경로.
    const entries = entriesForVerify(repoRoot, blueprintDir);
    if (entries[0] && entries[0].verification && entries[0].verification.rel) {
        return entries[0].verification.rel;
    }
    return `${toPosix(blueprintDir)}/verification.md`;
}
function runVerification({ repoRoot, blueprintDir, exec, now = () => new Date() }) {
    if (!isCanonicalBlueprintDir(blueprintDir)) {
        throw verificationError('VERIFY_BLUEPRINT_INVALID', 'blueprintDir must be under .bouncer/context/epics');
    }
    const command = readVerifyCommand(repoRoot, blueprintDir);
    const verificationRel = resolveVerificationRel(repoRoot, blueprintDir);
    const verificationPath = path.join(repoRoot, verificationRel);
    if (!fs.existsSync(verificationPath)) {
        throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
    }
    const execution = executeVerify(command, { cwd: repoRoot, exec });
    const ranAt = nowIsoKst(now());
    recordVerificationResult({
        repoRoot,
        verificationRel,
        command,
        ranAt,
        exitCode: execution.exitCode,
        output: execution.output,
    });
    return { ok: execution.ok, command, exitCode: execution.exitCode };
}
module.exports = {
    OUTPUT_TAIL_LINES,
    PASSING_OUTPUT_TAIL_LINES,
    MAX_VERIFY_OUTPUT_BYTES,
    isValidVerifyCommand,
    entriesForVerify,
    readVerifyCommand,
    executeVerify,
    recordVerificationResult,
    runVerification,
};
