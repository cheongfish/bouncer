'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { readDoc } = require('./frontmatter');
const { renderDoc } = require('./render');
const { isCanonicalBlueprintDir } = require('./layout');
const { nowIsoKst } = require('./time');
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
function readVerifyCommand(repoRoot, blueprintDir) {
    // blueprint 선언이 있으면 우선합니다. tasks.md가 없거나 필드가 없으면
    // 기존 config.verify 경로를 유지합니다. 있지만 유효하지 않은 필드는
    // 조용히 넘어가면 안 됩니다 — plan-time S12 누락을 숨깁니다.
    if (blueprintDir) {
        const tasksPath = path.join(repoRoot, blueprintDir, 'tasks.md');
        try {
            const { data } = readDoc(tasksPath);
            const declared = data && data.bouncer && data.bouncer.verify;
            if (declared !== undefined) {
                if (!isValidVerifyCommand(declared)) {
                    throw verificationError('VERIFY_COMMAND_INVALID', 'verify command must be a single executable command');
                }
                return declared;
            }
        }
        catch (error) {
            if (error && error.code === 'VERIFY_COMMAND_INVALID')
                throw error;
            if (!(error && error.code === 'ENOENT'))
                throw error;
        }
    }
    const configPath = path.join(repoRoot, '.bouncer', 'config.json');
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    catch (error) {
        if (error && error.code === 'ENOENT') {
            throw verificationError('VERIFY_CONFIG_MISSING', `verification config missing: ${configPath}`);
        }
        throw verificationError('VERIFY_CONFIG_INVALID', `verification config is invalid: ${configPath}`);
    }
    if (typeof config.verify !== 'string' || config.verify.trim() === '') {
        throw verificationError('VERIFY_CONFIG_INVALID', 'config.verify must be a non-empty string');
    }
    return config.verify;
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
        const stdout = result && typeof result === 'object' ? result.stdout : result;
        const stderr = result && typeof result === 'object' ? result.stderr : '';
        return {
            ok: true,
            exitCode: 0,
            output: outputTail(stdout, stderr, PASSING_OUTPUT_TAIL_LINES),
        };
    }
    catch (error) {
        return {
            ok: false,
            exitCode: Number.isInteger(error && error.status) ? error.status : 1,
            output: outputTail(error && error.stdout, error && error.stderr),
        };
    }
}
function recordVerificationResult({ repoRoot, blueprintDir, command, ranAt, exitCode, output }) {
    const verificationPath = path.join(repoRoot, blueprintDir, 'verification.md');
    let document;
    try {
        document = readDoc(verificationPath);
    }
    catch (error) {
        if (error && error.code === 'ENOENT') {
            throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
        }
        throw error;
    }
    const data = document.data;
    data.bouncer = data.bouncer || {};
    data.bouncer.status = exitCode === 0 ? 'passed' : 'failed';
    data.bouncer.verification = {
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
}
function runVerification({ repoRoot, blueprintDir, exec, now = () => new Date() }) {
    if (!isCanonicalBlueprintDir(blueprintDir)) {
        throw verificationError('VERIFY_BLUEPRINT_INVALID', 'blueprintDir must be under .bouncer/context/epics');
    }
    const command = readVerifyCommand(repoRoot, blueprintDir);
    const verificationPath = path.join(repoRoot, blueprintDir, 'verification.md');
    if (!fs.existsSync(verificationPath)) {
        throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
    }
    const execution = executeVerify(command, { cwd: repoRoot, exec });
    const ranAt = nowIsoKst(now());
    recordVerificationResult({
        repoRoot,
        blueprintDir,
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
    readVerifyCommand,
    executeVerify,
    recordVerificationResult,
    runVerification,
};
