'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const frontmatter = require("./frontmatter");
const { readDoc } = frontmatter;
const render = require("./render");
const { renderDoc } = render;
const layout = require("./layout");
const { isCanonicalBlueprintDir } = layout;
const time = require("./time");
const { nowIsoKst } = time;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
// current.ts는 이 모듈군 밖이라 strict include에 넣지 않는다. 상대 require를
// 그대로 두면 tsc가 그 파일을 편입해 다음 커밋 몫의 오류가 여기로 새어 온다.
const current = require("./current");
const { readCurrent } = current;
const paths = require("./paths");
const { toPosix, parsePathIds } = paths;
const runtimeState = require("./runtime-state");
const { verifyLedgerPathFor } = runtimeState;
const config = require("./config");
const { readConfigResult, readVerifyPolicy, DEFAULT_VERIFY_ALLOWLIST, } = config;
const commitSha = require("./commit-sha");
const { buildStableProvenance } = commitSha;
// 통과한 실행은 명령이 0으로 종료되었다는 증거입니다. tail에는 명령이
// 끝에 출력하는 요약만 담으면 됩니다. 실패한 실행은 무엇이 잘못됐는지에 대한
// 증거이므로 훨씬 더 많이 — 그리고 리뷰어가 읽는 문서 본문에, frontmatter에만
// 두지 않고 — 보관합니다.
const OUTPUT_TAIL_LINES = 100;
const PASSING_OUTPUT_TAIL_LINES = 20;
const MAX_VERIFY_OUTPUT_BYTES = 10 * 1024 * 1024;
// config.json 부재와 빈 파일·파손 파일을 같은 해시로 접지 않기 위한 고정값.
// 환경 해시가 플랫폼만 같아도 “설정 없음”을 구분해야 miss가 된다.
const VERIFY_CONFIG_MISSING_SENTINEL = '__bouncer_verify_config_missing__';
const SCOPE_KINDS = new Set(['task', 'wave', 'terminal']);
const TASK_DIR_RE = /(?:^|\/)tasks\/(\d{3})(?:\/|$)/;
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
// Plan S12와 runtime VERIFY_COMMAND_INVALID가 parseVerifyArgv·allowlist를
// 공유하므로 두 표면이 어긋날 수 없습니다.
/**
 * 검증 명령 문자열을 argv 배열로 파싱한다. 공백으로 나누되 작은따옴표·
 * 큰따옴표 안의 공백은 한 인자로 유지한다. 셸 확장은 하지 않는다 —
 * `shell: false` 실행과 같은 경계를 파싱 단계에서도 맞춘다.
 *
 * 메타문자 검사는 인용 **밖**에서만 한다. `node -e "a; b"`처럼 인자 안의
 * `;`는 데이터이고, 인용 밖 `a; b`만 체이닝으로 거절해야 예전 config.verify
 * 문자열과 실행 의미가 어긋나지 않는다.
 *
 * @param {unknown} command - `tasks.bouncer.verify` 또는 `config.verify` 문자열
 * @returns {string[] | null} 성공 시 argv. 빈 값·메타문자·미종료 인용·`cd` 접두면 null
 */
function parseVerifyArgv(command) {
    if (typeof command !== 'string')
        return null;
    const trimmed = command.trim();
    if (!trimmed)
        return null;
    const argv = [];
    let current = '';
    let quote = null;
    let sawToken = false;
    for (let i = 0; i < trimmed.length; i += 1) {
        const ch = trimmed[i];
        if (quote) {
            if (ch === quote) {
                quote = null;
                sawToken = true;
            }
            else {
                current += ch;
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        // 인용 밖의 셸 메타·개행·$( 만 거절. 인자 값에 든 동일 문자는 허용.
        if (ch === '$' && trimmed[i + 1] === '(')
            return null;
        if (/[&|;`<>\n]/.test(ch))
            return null;
        if (/\s/.test(ch)) {
            if (sawToken || current.length > 0) {
                argv.push(current);
                current = '';
                sawToken = false;
            }
            continue;
        }
        current += ch;
        sawToken = true;
    }
    if (quote)
        return null;
    if (sawToken || current.length > 0) {
        argv.push(current);
    }
    if (argv.length === 0)
        return null;
    // basename이 아니라 원본 argv0가 cd면 거절한다. `cd`는 셸 내장이고
    // shell:false로도 의미가 없으며, 예전 S12 계약(`cd` 접두 금지)을 유지한다.
    if (argv[0] === 'cd')
        return null;
    return argv;
}
/**
 * argv0를 허용 목록 비교용 이름으로 정규화한다. basename만 남기고,
 * Windows는 PATH가 `npm.cmd`·`node.exe`를 고르므로 관용 확장자를 벗긴다 —
 * 목록은 `npm`/`node`처럼 확장자 없는 이름만 둔다.
 *
 * @param {string} argv0 - 파싱된 첫 인자
 * @returns {string} 허용 목록과 비교할 이름
 */
function verifyExecutableName(argv0) {
    const base = path.basename(argv0);
    if (process.platform === 'win32') {
        return base.replace(/\.(cmd|exe|bat)$/i, '');
    }
    return base;
}
/**
 * 활성 포인터·config가 고른 검증 명령이 실행 가능한지 판정한다.
 * 파싱 성공과 허용 목록(argv0 실행 파일명)을 함께 본다. allowlist를 생략하면
 * 기본 목록을 쓴다. 저장소 정책을 이미 읽은 호출자는 그 목록을 넘겨
 * S12와 runtime이 다른 답을 내지 않게 한다.
 *
 * @param {unknown} command - 검증 명령 문자열
 * @param {readonly string[]} [allowlist] - argv0 실행 파일명 허용 목록
 * @returns {boolean} 실행해도 되는 명령이면 true
 */
function isValidVerifyCommand(command, allowlist = DEFAULT_VERIFY_ALLOWLIST) {
    const argv = parseVerifyArgv(command);
    if (!argv)
        return false;
    return allowlist.includes(verifyExecutableName(argv[0]));
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
/**
 * 활성 task 선언 또는 `config.verify`에서 검증 명령을 고른다. task 필드는
 * 저장소 정책 allowlist로 검사한다. 파손된 config는 기본 목록으로 넘어가지
 * 않고 `VERIFY_CONFIG_INVALID`다. 셸 연산자·미종료 인용은 그보다 먼저
 * `VERIFY_COMMAND_INVALID`로 거절한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} [blueprintDir] - 있으면 그 blueprint의 task 선언을 먼저 본다
 * @returns {string} 실행할 단일 argv 문자열
 */
function readVerifyCommand(repoRoot, blueprintDir) {
    const configPath = path.join(repoRoot, '.bouncer', 'config.json');
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
                    // 셸 연산자·미종료 인용은 config가 깨져 있어도 명령 오류다.
                    // 정책을 먼저 보면 VERIFY_CONFIG_INVALID가 그 거절을 가린다.
                    if (!parseVerifyArgv(declared)) {
                        throw verificationError('VERIFY_COMMAND_INVALID', 'verify command must be a single executable command');
                    }
                    const policy = readVerifyPolicy(repoRoot);
                    if (policy.ok === false) {
                        throw verificationError('VERIFY_CONFIG_INVALID', `verification config is invalid: ${configPath}`);
                    }
                    if (!isValidVerifyCommand(declared, policy.allowlist)) {
                        throw verificationError('VERIFY_COMMAND_INVALID', 'verify command must be a single executable command');
                    }
                    // isValidVerifyCommand가 통과한 값만 문자열이다. 여기서 다시 접지 않는다.
                    return declared;
                }
            }
            catch (error) {
                if (errorCode(error) === 'VERIFY_COMMAND_INVALID')
                    throw error;
                if (errorCode(error) === 'VERIFY_CONFIG_INVALID')
                    throw error;
                if (errorCode(error) !== 'ENOENT')
                    throw error;
            }
        }
    }
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
/**
 * cwd의 `.bouncer/config.json`에서 런타임 허용 목록을 읽는다.
 * allowlist 옵션을 생략한 finalize `executeVerify(command, { cwd })`가
 * 저장소 정책을 따르게 한다. 파일이 없을 때만 기본 목록이다. 파손된
 * 설정에 기본 목록을 주면 직접 호출이 plan/read와 다른 답을 낸다.
 *
 * @param {string} cwd - 실행 작업 디렉터리
 * @returns {{ ok: true, allowlist: readonly string[] } | { ok: false, output: string }}
 *   invalid면 프로세스를 시작하지 말라는 오류 출력
 */
function resolveRuntimeAllowlist(cwd) {
    const policy = readVerifyPolicy(cwd);
    if (policy.ok === false) {
        return {
            ok: false,
            output: `verification config is invalid: ${path.join(cwd, '.bouncer', 'config.json')}`,
        };
    }
    return { ok: true, allowlist: policy.allowlist };
}
/**
 * 파싱된 argv를 shell:false로 실행한다. 허용 목록 밖 argv0·파싱 실패는
 * 프로세스를 시작하기 전에 `{ ok: false }`로 돌려 — throw하지 않는다.
 * finalize가 `readVerifyCommand`만 try/catch하고 `executeVerify`는 bare로
 * 호출하므로, 여기 throw는 cmdFinalize를 스택으로 무너뜨린다. 증적에
 * 남는 command 문자열은 호출자가 넘긴 원문을 유지한다.
 *
 * allowlist를 생략하면 cwd의 저장소 정책을 쓴다. 파손된 config는
 * throw하지 않고 `{ ok: false }`로 돌려 finalize JSON 경로를 유지한다.
 * 테스트만 명시적 allowlist로 덮어쓴다.
 *
 * @param {string} command - 원문 검증 명령 문자열
 * @param {{ cwd: string, exec?: VerifyExec, allowlist?: readonly string[] }} opts - 실행 옵션
 * @returns {{ ok: boolean, exitCode: number, output: string }} 종료 코드와 출력 tail
 */
function executeVerify(command, { cwd, exec, allowlist }) {
    // 생략과 명시적 전달을 구분한다. 기본 매개변수로 DEFAULT를 붙이면
    // finalize처럼 allowlist 없이 호출해도 저장소 config를 읽지 못한다.
    let resolvedAllowlist;
    if (allowlist !== undefined) {
        resolvedAllowlist = allowlist;
    }
    else {
        const resolved = resolveRuntimeAllowlist(cwd);
        if (resolved.ok === false) {
            return { ok: false, exitCode: 1, output: resolved.output };
        }
        resolvedAllowlist = resolved.allowlist;
    }
    const argv = parseVerifyArgv(command);
    // throw 대신 ok:false — finalize의 `if (!execution.ok)` JSON 경로로 보낸다.
    if (!argv || !isValidVerifyCommand(command, resolvedAllowlist)) {
        return {
            ok: false,
            exitCode: 1,
            output: 'verify command must be a single executable command',
        };
    }
    const file = argv[0];
    const args = argv.slice(1);
    const runOpts = {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: MAX_VERIFY_OUTPUT_BYTES,
        shell: false,
    };
    try {
        let result;
        if (!exec) {
            result = spawnSync(file, args, { ...runOpts, shell: false });
        }
        else if (exec.length < 3) {
            // execSync 계약: 원문 command 문자열 + opts. argv를 이어 붙이면
            // 인용 인자가 깨지므로 호출자가 넘긴 원문을 그대로 준다.
            result = exec(command, runOpts);
        }
        else {
            result = exec(file, args, runOpts);
        }
        // spawnSync는 비0에서도 throw하지 않는다. 주입 exec가 Error를 던지는
        // 예전 테스트 계약도 아래 catch에서 흡수한다.
        if (result && typeof result === 'object' && 'error' in result && result.error) {
            const err = result.error;
            const stdout = 'stdout' in result ? result.stdout : '';
            const stderr = 'stderr' in result ? result.stderr : (err && typeof err === 'object' && 'message' in err ? String(err.message) : '');
            return {
                ok: false,
                exitCode: 1,
                output: outputTail(stdout, stderr),
            };
        }
        const status = result && typeof result === 'object' && 'status' in result
            ? result.status
            : 0;
        const stdout = result && typeof result === 'object' && 'stdout' in result
            ? result.stdout
            : result;
        const stderr = result && typeof result === 'object' && 'stderr' in result
            ? result.stderr
            : '';
        // spawnSync는 시그널 종료 시 status=null이다. 그걸 0으로 접으면
        // 실패 실행이 passed 증적으로 남는다.
        if (status === 0) {
            return {
                ok: true,
                exitCode: 0,
                output: outputTail(stdout, stderr, PASSING_OUTPUT_TAIL_LINES),
            };
        }
        return {
            ok: false,
            exitCode: Number.isInteger(status) ? Number(status) : 1,
            output: outputTail(stdout, stderr),
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
/**
 * 객체의 키를 재귀적으로 정렬한 뒤 UTF-8 JSON으로 직렬화한다.
 * identity·environment 해시가 키 삽입 순서에 흔들리지 않게 한다.
 *
 * @param {unknown} value - 직렬화할 값
 * @returns {string} canonical JSON 문자열
 */
function canonicalJson(value) {
    const normalize = (input) => {
        if (Array.isArray(input))
            return input.map(normalize);
        if (input && typeof input === 'object') {
            const record = input;
            const sorted = {};
            for (const key of Object.keys(record).sort()) {
                sorted[key] = normalize(record[key]);
            }
            return sorted;
        }
        return input;
    };
    return JSON.stringify(normalize(value));
}
/**
 * canonical JSON의 SHA-256 hex를 돌려준다.
 *
 * @param {unknown} value - 해시할 값
 * @returns {string} 64자 hex digest
 */
function sha256Canonical(value) {
    return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
/**
 * scope shape을 검사한다. kind/key가 잘못되면 process를 시작하기 전에 거절한다.
 *
 * @param {unknown} scope - 호출자 또는 포인터에서 온 범위
 * @returns {VerificationScope} 정규화된 scope
 */
function assertVerificationScope(scope) {
    if (!isRecord(scope)) {
        throw verificationError('VERIFY_IDENTITY_INVALID', 'verification scope must be an object');
    }
    const kind = scope.kind;
    const key = scope.key;
    if (typeof kind !== 'string' || !SCOPE_KINDS.has(kind)) {
        throw verificationError('VERIFY_IDENTITY_INVALID', 'verification scope.kind must be task, wave, or terminal');
    }
    if (typeof key !== 'string' || key.trim() === '') {
        throw verificationError('VERIFY_IDENTITY_INVALID', 'verification scope.key must be a non-empty string');
    }
    return { kind: kind, key };
}
/**
 * 활성 포인터 또는 번호 순 첫 task 묶음에서 task scope를 만든다.
 * frontmatter가 있으면 stable provenance를 쓰고, epic/blueprint 누락·형식
 * 거절·문서 부재는 경로 숫자로 같은 형식의 키를 만든다. numbered entries가
 * 비면 레거시 루트 `blueprintDir/tasks.md`를 본다 — omit-scope 호출자가
 * 예전처럼 executeVerify까지 닿게 한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {VerificationScope} `{ kind: 'task', key: 'EPIC-…/BP-…/TASK-…' }`
 */
function resolveDefaultTaskScope(repoRoot, blueprintDir) {
    const entries = entriesForVerify(repoRoot, blueprintDir);
    const pointer = readCurrent({ repoRoot });
    const bp = toPosix(blueprintDir);
    let tasksRel = null;
    if (isRecord(pointer) && typeof pointer.task === 'string' && toPosix(pointer.blueprint) === bp) {
        tasksRel = toPosix(pointer.task);
    }
    else if (entries[0] && entries[0].tasks && entries[0].tasks.rel) {
        tasksRel = toPosix(entries[0].tasks.rel);
    }
    // resolveVerificationRel과 같은 레거시 폴백. listing이 비어도 루트
    // tasks.md가 있으면 omit-scope 호출이 tasksRel 부재로 막히지 않게 한다.
    if (!tasksRel) {
        const legacyRel = `${bp}/tasks.md`;
        if (fs.existsSync(path.join(repoRoot, legacyRel))) {
            tasksRel = legacyRel;
        }
    }
    if (!tasksRel) {
        throw verificationError('VERIFY_IDENTITY_INVALID', 'verification task scope requires an active pointer task or task unit');
    }
    const abs = path.join(repoRoot, tasksRel);
    try {
        const { data } = readDoc(abs);
        const bouncer = data && isRecord(data) ? data.bouncer : null;
        if (isRecord(bouncer)) {
            const stable = buildStableProvenance({
                epicId: bouncer.epic_id,
                blueprintId: bouncer.blueprint_id,
                taskId: bouncer.id,
            });
            return { kind: 'task', key: stable.task };
        }
    }
    catch {
        // ENOENT·깨진 frontmatter뿐 아니라 epic/blueprint 누락으로 나는
        // three-digit/TASKS-NNN 거절도 경로 폴백으로 넘긴다. coordinator
        // fixture는 id만 두고 epic_id를 생략하므로, 여기서 hard-fail하면
        // omit-scope integrate가 executeVerify에 닿지 못한다. 경로에서도
        // 키를 못 만들 때만 아래에서 identity 오류로 올린다.
    }
    const ids = parsePathIds(tasksRel);
    const taskMatch = TASK_DIR_RE.exec(tasksRel);
    if (!ids.epicId || !ids.blueprintId || !taskMatch) {
        throw verificationError('VERIFY_IDENTITY_INVALID', 'cannot derive stable task scope from pointer or task path');
    }
    return {
        kind: 'task',
        key: `EPIC-${ids.epicId}/BP-${ids.blueprintId}/TASK-${taskMatch[1]}`,
    };
}
/**
 * deps.git 또는 spawnSync로 git argv를 실행한다. 비0·예외는 identity 오류다.
 *
 * @param {string} repoRoot - cwd
 * @param {string[]} args - git 인자(git 자체 제외)
 * @param {VerificationDeps} [deps] - 주입 git
 * @returns {string} stdout
 */
function runGit(repoRoot, args, deps) {
    try {
        if (deps && typeof deps.git === 'function') {
            return String(deps.git(args) ?? '');
        }
        const result = spawnSync('git', args, {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (result.status !== 0) {
            throw verificationError('VERIFY_IDENTITY_INVALID', `git ${args.join(' ')} failed: ${String(result.stderr || result.error || 'non-zero exit')}`);
        }
        return String(result.stdout || '');
    }
    catch (error) {
        if (errorCode(error) === 'VERIFY_IDENTITY_INVALID')
            throw error;
        throw verificationError('VERIFY_IDENTITY_INVALID', `git ${args.join(' ')} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * 파일을 읽어 Buffer로 돌려준다. 주입 readFile이 있으면 그걸 쓴다.
 *
 * @param {string} absPath - 절대 경로
 * @param {VerificationDeps} [deps] - 주입 읽기
 * @returns {Buffer} 파일 바이트
 */
function readBytes(absPath, deps) {
    try {
        if (deps && typeof deps.readFile === 'function') {
            const raw = deps.readFile(absPath);
            return typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
        }
        return fs.readFileSync(absPath);
    }
    catch (error) {
        throw verificationError('VERIFY_IDENTITY_INVALID', `failed to read ${absPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * porcelain -z 한 항목과 대상 path의 type·content digest를 만든다.
 * 절대 worktree 경로는 identity에 넣지 않고 repo-relative POSIX만 쓴다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} xy - status XY 코드
 * @param {string} relPath - dirty 상대경로
 * @param {VerificationDeps} [deps] - 파일 읽기 주입
 * @returns {{ path: string, xy: string, type: string, content_sha256: string }}
 */
function dirtyEntryDigest(repoRoot, xy, relPath, deps) {
    const posixRel = toPosix(relPath);
    const abs = path.resolve(repoRoot, posixRel);
    const rootReal = fs.realpathSync(repoRoot);
    // resolve만으로도 .. 탈출을 막지만, realpath로 symlink 탈출도 거절한다.
    let targetReal = abs;
    try {
        if (fs.existsSync(abs))
            targetReal = fs.realpathSync(abs);
    }
    catch (_error) {
        throw verificationError('VERIFY_IDENTITY_INVALID', `dirty path is not readable: ${posixRel}`);
    }
    const relToRoot = path.relative(rootReal, targetReal);
    // `..foo` 같은 in-repo 이름은 `startsWith('..')`에 걸리면 안 된다.
    // 부모 탈출만 거절: 정확히 `..` 이거나 `../`·`..\` 세그먼트로 시작할 때.
    if (relToRoot === '..'
        || relToRoot.startsWith(`..${path.sep}`)
        || path.isAbsolute(relToRoot)) {
        throw verificationError('VERIFY_IDENTITY_INVALID', `dirty path escapes the repository: ${posixRel}`);
    }
    // missing은 catch 경로에서만 확정 — 초기값 할당은 전 분기에서 덮어써 no-useless-assignment에 걸린다.
    let type;
    let contentSha = createHash('sha256').update('', 'utf8').digest('hex');
    try {
        const st = fs.lstatSync(abs);
        if (st.isSymbolicLink()) {
            type = 'symlink';
            contentSha = createHash('sha256').update(fs.readlinkSync(abs), 'utf8').digest('hex');
        }
        else if (st.isDirectory()) {
            type = 'directory';
            contentSha = createHash('sha256').update('dir', 'utf8').digest('hex');
        }
        else if (st.isFile()) {
            type = 'file';
            contentSha = createHash('sha256').update(readBytes(abs, deps)).digest('hex');
        }
        else {
            type = 'other';
        }
    }
    catch (error) {
        if (errorCode(error) === 'VERIFY_IDENTITY_INVALID')
            throw error;
        // 삭제된 dirty(D) 등은 파일이 없어도 status 항목 자체는 digest에 남긴다.
        type = 'missing';
    }
    return { path: posixRel, xy, type, content_sha256: contentSha };
}
/**
 * `git status --porcelain=v1 -z`와 dirty path 내용을 정렬한 digest를 계산한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {VerificationDeps} [deps] - git/readFile 주입
 * @returns {string} dirty digest SHA-256
 */
function computeDirtyDigest(repoRoot, deps) {
    const raw = runGit(repoRoot, ['status', '--porcelain=v1', '-z'], deps);
    const entries = [];
    const parts = String(raw).split('\0').filter((part) => part.length > 0);
    for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        // porcelain -z: "XY PATH" 또는 rename이면 다음 토큰이 새 경로.
        const xy = part.slice(0, 2);
        const pathPart = part.slice(3);
        const isRename = xy[0] === 'R' || xy[0] === 'C' || xy[1] === 'R' || xy[1] === 'C';
        if (isRename && i + 1 < parts.length) {
            const fromPath = pathPart;
            const toPath = parts[i + 1];
            i += 1;
            entries.push(dirtyEntryDigest(repoRoot, xy, fromPath, deps));
            entries.push(dirtyEntryDigest(repoRoot, xy, toPath, deps));
        }
        else {
            entries.push(dirtyEntryDigest(repoRoot, xy, pathPart, deps));
        }
    }
    entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return sha256Canonical(entries);
}
/**
 * platform/arch/node/verify config의 environment hash를 계산한다.
 * config 부재는 고정 sentinel로 두어 빈 파일 해시와 구분한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {VerificationDeps} [deps] - platform·arch·node·readFile 주입
 * @returns {string} environment SHA-256
 */
function computeEnvironmentHash(repoRoot, deps) {
    const configPath = path.join(repoRoot, '.bouncer', 'config.json');
    let verifyConfigHash = VERIFY_CONFIG_MISSING_SENTINEL;
    const exists = fs.existsSync(configPath);
    if (exists) {
        try {
            const st = fs.statSync(configPath);
            if (!st.isFile()) {
                throw verificationError('VERIFY_IDENTITY_INVALID', `verification config is not a file: ${configPath}`);
            }
            verifyConfigHash = createHash('sha256').update(readBytes(configPath, deps)).digest('hex');
        }
        catch (error) {
            if (errorCode(error) === 'VERIFY_IDENTITY_INVALID')
                throw error;
            throw verificationError('VERIFY_IDENTITY_INVALID', `failed to hash verification config: ${configPath}`);
        }
    }
    return sha256Canonical({
        platform: (deps && deps.platform) || process.platform,
        arch: (deps && deps.arch) || process.arch,
        node_version: (deps && deps.nodeVersion) || process.version,
        verify_config_hash: verifyConfigHash,
    });
}
/**
 * 검증 실행 입력의 content-addressed identity와 evidence_id를 계산한다.
 * Git·dirty·config 조회 실패는 실행으로 우회하지 않고 전용 오류로 중단한다.
 *
 * @param {{ repoRoot: string, command: string, scope: VerificationScope, deps?: VerificationDeps }} opts
 * @returns {{ identity: EvidenceIdentity, evidenceId: string }}
 */
function computeEvidenceIdentity({ repoRoot, command, scope, deps, }) {
    const head = runGit(repoRoot, ['rev-parse', 'HEAD'], deps).trim();
    if (!head) {
        throw verificationError('VERIFY_IDENTITY_INVALID', 'git HEAD is empty');
    }
    const identity = {
        head,
        dirty_digest: computeDirtyDigest(repoRoot, deps),
        command,
        cwd: '.',
        environment_hash: computeEnvironmentHash(repoRoot, deps),
        scope,
    };
    return { identity, evidenceId: sha256Canonical(identity) };
}
/**
 * v2 성공 원장만 reuse hit로 인정한다. v1·실패·필드 누락·identity/scope 불일치는 miss.
 *
 * @param {unknown} record - 디스크 원장
 * @param {EvidenceIdentity} identity - 현재 입력 identity
 * @param {string} evidenceId - 현재 evidence_id
 * @returns {record is VerifyLedgerRecordV2} hit이면 true
 */
function isReuseHit(record, identity, evidenceId) {
    if (!isRecord(record))
        return false;
    // v1은 evidence_id가 없다. 읽을 수는 있어도 hit로 승격하지 않는다.
    if (typeof record.evidence_id !== 'string' || !record.evidence_id)
        return false;
    if (record.evidence_id !== evidenceId)
        return false;
    if (record.exit_code !== 0)
        return false;
    if (typeof record.ran_at !== 'string' || !record.ran_at)
        return false;
    if (typeof record.output_sha !== 'string' || !record.output_sha)
        return false;
    if (typeof record.command !== 'string')
        return false;
    // reused는 성공 hit의 필수 boolean. 누락·문자열·숫자는 손상으로 miss.
    if (typeof record.reused !== 'boolean')
        return false;
    if (!isRecord(record.identity) || !isRecord(record.scope))
        return false;
    if (canonicalJson(record.identity) !== canonicalJson(identity))
        return false;
    if (canonicalJson(record.scope) !== canonicalJson(identity.scope))
        return false;
    return true;
}
/**
 * 원장 파일을 읽어 파싱한다. 부재·파손은 null(정상 miss).
 *
 * @param {string} ledgerFile - 절대 경로
 * @returns {unknown | null}
 */
function readLedgerFile(ledgerFile) {
    if (!fs.existsSync(ledgerFile))
        return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return null;
        return parsed;
    }
    catch (_error) {
        return null;
    }
}
function recordVerificationResult({ repoRoot, verificationRel, blueprintDir, command, ranAt, exitCode, output, evidenceId, identity, scope, reused = false, reusedFrom, deps, }) {
    // verificationRel이 정식 인자. blueprintDir은 구 호출 호환(루트 verification.md).
    const rel = verificationRel
        || (blueprintDir ? `${toPosix(blueprintDir)}/verification.md` : null);
    if (!rel) {
        throw verificationError('VERIFY_DOCUMENT_MISSING', 'verification document path missing');
    }
    // 직접 호출 테스트는 evidence를 생략한다. 그 경우 현재 checkout identity를
    // 채워 v2 원장·G13 계약과 맞춘다 — runVerification 경로와 키 공간을 공유한다.
    let resolvedScope = scope;
    let resolvedIdentity = identity;
    let resolvedEvidenceId = evidenceId;
    if (!resolvedScope || !resolvedIdentity || !resolvedEvidenceId) {
        const blueprintGuess = blueprintDir
            || rel.replace(/\/tasks\/\d{3}\/verification\.md$/, '')
            || rel.replace(/\/verification\.md$/, '');
        resolvedScope = resolvedScope || resolveDefaultTaskScope(repoRoot, blueprintGuess);
        const computed = computeEvidenceIdentity({
            repoRoot,
            command,
            scope: resolvedScope,
            deps,
        });
        resolvedIdentity = resolvedIdentity || computed.identity;
        resolvedEvidenceId = resolvedEvidenceId || computed.evidenceId;
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
    const verificationMeta = {
        command,
        ran_at: ranAt,
        exit_code: exitCode,
        output_tail: output,
        evidence_id: resolvedEvidenceId,
        identity: resolvedIdentity,
        scope: resolvedScope,
        reused,
    };
    // reused_from은 hit일 때만 기록한다. false인데 키가 있으면 G13이 손기록을 통과시킨다.
    if (reused && reusedFrom) {
        verificationMeta.reused_from = reusedFrom;
    }
    bouncer.verification = verificationMeta;
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
    const ledgerPaths = verifyLedgerPathFor({
        repoRoot,
        verificationRel: rel,
        evidenceId: resolvedEvidenceId,
        deps,
    });
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
        evidence_id: resolvedEvidenceId,
        identity: resolvedIdentity,
        scope: resolvedScope,
        reused,
    };
    if (reused && reusedFrom) {
        record.reused_from = reusedFrom;
    }
    // reuse hit가 문서 output_tail을 다시 쓸 수 있게 성공 원장에만 본문을 남긴다.
    if (exitCode === 0) {
        record.output_tail = outputTail;
    }
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
/**
 * 활성 task의 검증 명령을 실행하거나, 같은 identity·scope의 성공 원장이 있으면
 * process spawn 없이 재사용 증적을 기록한다. identity 계산 실패는 실행으로
 * 우회하지 않는다.
 *
 * @param {object} opts - 실행 옵션
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {VerificationScope} [opts.scope] - 생략 시 포인터/첫 task의 stable Task ID
 * @param {VerifyExec} [opts.exec] - 주입 실행기(테스트용)
 * @param {() => Date} [opts.now] - 시각 주입
 * @param {VerificationDeps} [opts.deps] - git/readFile/platform 주입
 * @returns {{
 *   ok: boolean, command: string, exitCode: number, evidenceId: string,
 *   reused: boolean, reusedFrom?: string
 * }}
 */
function runVerification({ repoRoot, blueprintDir, scope: scopeInput, exec, now = () => new Date(), deps, }) {
    // 1. blueprint·명령·문서 존재 — 기존 거절을 identity보다 먼저 유지한다.
    if (!isCanonicalBlueprintDir(blueprintDir)) {
        throw verificationError('VERIFY_BLUEPRINT_INVALID', 'blueprintDir must be under .bouncer/context/epics');
    }
    const command = readVerifyCommand(repoRoot, blueprintDir);
    const verificationRel = resolveVerificationRel(repoRoot, blueprintDir);
    const verificationPath = path.join(repoRoot, verificationRel);
    if (!fs.existsSync(verificationPath)) {
        throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
    }
    // 같은 정책 목록을 executeVerify에 명시한다. 생략하면 cwd를 다시 읽어
    // 두 표면이 어긋날 수 있고, invalid면 기본 목록으로 실행이 이어진다.
    const policy = readVerifyPolicy(repoRoot);
    if (policy.ok === false) {
        throw verificationError('VERIFY_CONFIG_INVALID', `verification config is invalid: ${path.join(repoRoot, '.bouncer', 'config.json')}`);
    }
    // 2. scope·identity는 spawn 전에 확정한다. 실패는 전용 오류.
    const scope = scopeInput
        ? assertVerificationScope(scopeInput)
        : resolveDefaultTaskScope(repoRoot, blueprintDir);
    const { identity, evidenceId } = computeEvidenceIdentity({
        repoRoot, command, scope, deps,
    });
    // 3. 성공 v2 원장 hit면 exec를 건너뛰고 원본 ran_at·output을 재기록한다.
    const ledgerPaths = verifyLedgerPathFor({
        repoRoot,
        verificationRel,
        evidenceId,
    });
    if (!ledgerPaths.unavailable && ledgerPaths.ledgerFile) {
        const existing = readLedgerFile(ledgerPaths.ledgerFile);
        if (isReuseHit(existing, identity, evidenceId)) {
            const output = typeof existing.output_tail === 'string'
                ? existing.output_tail
                : '';
            const outputSha = createHash('sha256').update(output, 'utf8').digest('hex');
            // 원장 output_tail이 비었거나 해시가 깨졌으면 hit를 포기하고 재실행한다.
            if (outputSha === existing.output_sha) {
                recordVerificationResult({
                    repoRoot,
                    verificationRel,
                    command,
                    ranAt: existing.ran_at,
                    exitCode: 0,
                    output,
                    evidenceId,
                    identity,
                    scope,
                    reused: true,
                    reusedFrom: existing.evidence_id,
                });
                return {
                    ok: true,
                    command,
                    exitCode: 0,
                    evidenceId,
                    reused: true,
                    reusedFrom: existing.evidence_id,
                };
            }
        }
    }
    // 4. cache miss — 실제 명령을 한 번 실행하고 v2 증적을 남긴다.
    const execution = executeVerify(command, {
        cwd: repoRoot,
        exec,
        allowlist: policy.allowlist,
    });
    const ranAt = nowIsoKst(now());
    recordVerificationResult({
        repoRoot,
        verificationRel,
        command,
        ranAt,
        exitCode: execution.exitCode,
        output: execution.output,
        evidenceId,
        identity,
        scope,
        reused: false,
    });
    return {
        ok: execution.ok,
        command,
        exitCode: execution.exitCode,
        evidenceId,
        reused: false,
    };
}
module.exports = {
    OUTPUT_TAIL_LINES,
    PASSING_OUTPUT_TAIL_LINES,
    MAX_VERIFY_OUTPUT_BYTES,
    parseVerifyArgv,
    isValidVerifyCommand,
    entriesForVerify,
    readVerifyCommand,
    executeVerify,
    recordVerificationResult,
    runVerification,
};
