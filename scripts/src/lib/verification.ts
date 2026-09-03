'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import layout = require('./layout');
const { isCanonicalBlueprintDir } = layout;
import time = require('./time');
const { nowIsoKst } = time;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
// current.ts는 이 모듈군 밖이라 strict include에 넣지 않는다. 상대 require를
// 그대로 두면 tsc가 그 파일을 편입해 다음 커밋 몫의 오류가 여기로 새어 온다.
import current = require('./current');
const { readCurrent } = current;
import paths = require('./paths');
const { toPosix } = paths;
import runtimeState = require('./runtime-state');
const { verifyLedgerPathFor } = runtimeState;
import config = require('./config');
const {
  readConfigResult,
  getVerifyAllowlist,
  DEFAULT_VERIFY_ALLOWLIST,
} = config;

// 통과한 실행은 명령이 0으로 종료되었다는 증거입니다. tail에는 명령이
// 끝에 출력하는 요약만 담으면 됩니다. 실패한 실행은 무엇이 잘못됐는지에 대한
// 증거이므로 훨씬 더 많이 — 그리고 리뷰어가 읽는 문서 본문에, frontmatter에만
// 두지 않고 — 보관합니다.
const OUTPUT_TAIL_LINES = 100;
const PASSING_OUTPUT_TAIL_LINES = 20;
const MAX_VERIFY_OUTPUT_BYTES = 10 * 1024 * 1024;

type CodedError = Error & { code?: string };

function verificationError(code: string, message: string): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  return error;
}

function errorCode(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return error.code;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
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
function parseVerifyArgv(command: unknown): string[] | null {
  if (typeof command !== 'string') return null;
  const trimmed = command.trim();
  if (!trimmed) return null;

  const argv: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let sawToken = false;

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
        sawToken = true;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    // 인용 밖의 셸 메타·개행·$( 만 거절. 인자 값에 든 동일 문자는 허용.
    if (ch === '$' && trimmed[i + 1] === '(') return null;
    if (/[&|;`<>\n]/.test(ch)) return null;
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
  if (quote) return null;
  if (sawToken || current.length > 0) {
    argv.push(current);
  }
  if (argv.length === 0) return null;
  // basename이 아니라 원본 argv0가 cd면 거절한다. `cd`는 셸 내장이고
  // shell:false로도 의미가 없으며, 예전 S12 계약(`cd` 접두 금지)을 유지한다.
  if (argv[0] === 'cd') return null;
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
function verifyExecutableName(argv0: string): string {
  const base = path.basename(argv0);
  if (process.platform === 'win32') {
    return base.replace(/\.(cmd|exe|bat)$/i, '');
  }
  return base;
}

/**
 * 활성 포인터·config가 고른 검증 명령이 실행 가능한지 판정한다.
 * 파싱 성공과 허용 목록(argv0 실행 파일명)을 함께 본다. allowlist를 생략하면
 * 기본 목록을 쓴다 — plan/S12(`tasks.bouncer.verify`)는 config.verify_allowlist
 * 없이 기본 목록만으로 검사하고, 런타임 `executeVerify`/`runVerification`은
 * 저장소 config를 따로 읽는다.
 *
 * @param {unknown} command - 검증 명령 문자열
 * @param {readonly string[]} [allowlist] - argv0 실행 파일명 허용 목록
 * @returns {boolean} 실행해도 되는 명령이면 true
 */
function isValidVerifyCommand(
  command: unknown,
  allowlist: readonly string[] = DEFAULT_VERIFY_ALLOWLIST,
): boolean {
  const argv = parseVerifyArgv(command);
  if (!argv) return false;
  return allowlist.includes(verifyExecutableName(argv[0]));
}

function entriesForVerify(repoRoot: string, blueprintDir: string) {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  if (listing.mixed) return [];
  // 포인터 task 가 이 blueprint 를 가리키고 문서가 살아 있으면 그 문서만.
  // 문서가 사라졌을 때만 미지정(전체 walk)으로 폴백 — 다른 task 선언을
  // 조용히 끌어오지 않기 위함.
  const pointer = readCurrent({ repoRoot });
  const bp = toPosix(blueprintDir);
  if (isRecord(pointer) && typeof pointer.task === 'string' && toPosix(pointer.blueprint) === bp) {
    const match = listing.entries.find((e) => e.rel === toPosix(pointer.task));
    if (match) return [match];
  }
  return listing.entries;
}

function readVerifyCommand(repoRoot: string, blueprintDir?: string): string {
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
        const bouncer = data ? (data as Record<string, unknown>).bouncer : data;
        const declared = bouncer ? (bouncer as Record<string, unknown>).verify : bouncer;
        if (declared !== undefined) {
          if (!isValidVerifyCommand(declared)) {
            throw verificationError(
              'VERIFY_COMMAND_INVALID',
              'verify command must be a single executable command',
            );
          }
          // isValidVerifyCommand가 통과한 값만 문자열이다. 여기서 다시 접지 않는다.
          return declared as string;
        }
      } catch (error) {
        if (errorCode(error) === 'VERIFY_COMMAND_INVALID') throw error;
        if (errorCode(error) !== 'ENOENT') throw error;
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
  const verify = (config as Record<string, unknown>).verify;
  if (typeof verify !== 'string' || verify.trim() === '') {
    throw verificationError('VERIFY_CONFIG_INVALID', 'config.verify must be a non-empty string');
  }
  return verify;
}

function outputTail(stdout: unknown, stderr: unknown, lines = OUTPUT_TAIL_LINES): string {
  const combined = [stdout, stderr].filter(Boolean).join('');
  return combined.split('\n').slice(-lines).join('\n').trim();
}

type VerifyExecOpts = {
  cwd?: string;
  encoding?: string;
  stdio?: unknown;
  maxBuffer?: number;
  shell?: boolean;
};

// 기본 경로는 spawnSync 3인자. finalize·구 테스트 주입은 execSync 2인자
// (command, opts)라서, 주입 함수 length로 둘을 가른다.
type VerifyExec = ((
  file: string,
  args: string[],
  opts: VerifyExecOpts,
) => unknown) | ((command: string, opts: VerifyExecOpts) => unknown);

/**
 * cwd의 `.bouncer/config.json`에서 런타임 허용 목록을 읽는다.
 * allowlist 옵션을 생략한 finalize `executeVerify(command, { cwd })`가
 * `config.verify_allowlist`를 따르게 한다. 파일이 없거나 깨져도 기본 목록으로
 * 실행은 이어 가되, 명령 문자열 자체는 호출자가 이미 고른 값이다.
 */
function resolveRuntimeAllowlist(cwd: string): readonly string[] {
  const parsed = readConfigResult(cwd);
  return parsed.ok === true
    ? getVerifyAllowlist(parsed.value)
    : DEFAULT_VERIFY_ALLOWLIST;
}

/**
 * 파싱된 argv를 shell:false로 실행한다. 허용 목록 밖 argv0·파싱 실패는
 * 프로세스를 시작하기 전에 `{ ok: false }`로 돌려 — throw하지 않는다.
 * finalize가 `readVerifyCommand`만 try/catch하고 `executeVerify`는 bare로
 * 호출하므로, 여기 throw는 cmdFinalize를 스택으로 무너뜨린다. 증적에
 * 남는 command 문자열은 호출자가 넘긴 원문을 유지한다.
 *
 * allowlist를 생략하면 cwd config의 `verify_allowlist`(없으면 기본 목록)를
 * 쓴다. 테스트만 명시적 allowlist로 덮어쓴다.
 *
 * @param {string} command - 원문 검증 명령 문자열
 * @param {{ cwd: string, exec?: VerifyExec, allowlist?: readonly string[] }} opts - 실행 옵션
 * @returns {{ ok: boolean, exitCode: number, output: string }} 종료 코드와 출력 tail
 */
function executeVerify(command: string, { cwd, exec, allowlist }: {
  cwd: string;
  exec?: VerifyExec;
  allowlist?: readonly string[];
}): { ok: boolean; exitCode: number; output: string } {
  // 생략과 명시적 전달을 구분한다. 기본 매개변수로 DEFAULT를 붙이면
  // finalize처럼 allowlist 없이 호출해도 저장소 config를 읽지 못한다.
  const resolvedAllowlist = allowlist !== undefined
    ? allowlist
    : resolveRuntimeAllowlist(cwd);
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
  const runOpts: VerifyExecOpts = {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: MAX_VERIFY_OUTPUT_BYTES,
    shell: false,
  };

  try {
    let result: unknown;
    if (!exec) {
      result = spawnSync(file, args, { ...runOpts, shell: false });
    } else if (exec.length < 3) {
      // execSync 계약: 원문 command 문자열 + opts. argv를 이어 붙이면
      // 인용 인자가 깨지므로 호출자가 넘긴 원문을 그대로 준다.
      result = (exec as (command: string, opts: VerifyExecOpts) => unknown)(
        command,
        runOpts,
      );
    } else {
      result = (exec as (
        file: string,
        args: string[],
        opts: VerifyExecOpts,
      ) => unknown)(file, args, runOpts);
    }
    // spawnSync는 비0에서도 throw하지 않는다. 주입 exec가 Error를 던지는
    // 예전 테스트 계약도 아래 catch에서 흡수한다.
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      const err = result.error;
      const stdout = 'stdout' in result ? result.stdout : '';
      const stderr = 'stderr' in result ? result.stderr : (
        err && typeof err === 'object' && 'message' in err ? String(err.message) : ''
      );
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
  } catch (error) {
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

function recordVerificationResult({
  repoRoot, verificationRel, blueprintDir, command, ranAt, exitCode, output, deps,
}: {
  repoRoot: string;
  verificationRel?: string;
  blueprintDir?: string;
  command: string;
  ranAt: string;
  exitCode: number;
  output: string;
  deps?: Parameters<typeof verifyLedgerPathFor>[0]['deps'];
}): void {
  // verificationRel이 정식 인자. blueprintDir은 구 호출 호환(루트 verification.md).
  const rel = verificationRel
    || (blueprintDir ? `${toPosix(blueprintDir)}/verification.md` : null);
  if (!rel) {
    throw verificationError('VERIFY_DOCUMENT_MISSING', 'verification document path missing');
  }
  const verificationPath = path.join(repoRoot, rel);
  let document: { data: unknown; body: string; path: string };
  try {
    document = readDoc(verificationPath);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
    }
    throw error;
  }
  const data = document.data as Record<string, unknown>;
  // 증적은 파싱 객체에 in-place로 붙인다. 빈 객체로 바꾸면 스칼라 YAML의
  // TypeError가 사라져 실패 형태가 바뀐다.
  const bouncer = (data.bouncer || {}) as Record<string, unknown>;
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
  const rereadBouncer = (reread.data as Record<string, unknown>).bouncer as Record<string, unknown>;
  const rereadEvidence = rereadBouncer && rereadBouncer.verification
    ? rereadBouncer.verification as Record<string, unknown>
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

function resolveVerificationRel(repoRoot: string, blueprintDir: string): string {
  // readVerifyCommand와 동일 entriesForVerify 폴백: 포인터 매칭 → 그 묶음,
  // 아니면 번호 순 첫 묶음. listing이 비면 레거시 루트 경로.
  const entries = entriesForVerify(repoRoot, blueprintDir);
  if (entries[0] && entries[0].verification && entries[0].verification.rel) {
    return entries[0].verification.rel;
  }
  return `${toPosix(blueprintDir)}/verification.md`;
}

function runVerification({ repoRoot, blueprintDir, exec, now = () => new Date() }: {
  repoRoot: string;
  blueprintDir: string;
  exec?: VerifyExec;
  now?: () => Date;
}): { ok: boolean; command: string; exitCode: number } {
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    throw verificationError(
      'VERIFY_BLUEPRINT_INVALID',
      'blueprintDir must be under .bouncer/context/epics',
    );
  }
  const command = readVerifyCommand(repoRoot, blueprintDir);
  const verificationRel = resolveVerificationRel(repoRoot, blueprintDir);
  const verificationPath = path.join(repoRoot, verificationRel);
  if (!fs.existsSync(verificationPath)) {
    throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
  }
  // config.verify 경로는 readVerifyCommand가 형식 검사를 건너뛸 수 있으므로
  // 실행 직전에 저장소 allowlist로 한 번 더 막는다. task 선언은 이미
  // 기본 목록으로 S12/read 시점에 걸러졌고, 여기선 운영자 목록이 더 좁으면
  // 그 목록이 이긴다.
  const parsed = readConfigResult(repoRoot);
  const allowlist = parsed.ok === true
    ? getVerifyAllowlist(parsed.value)
    : DEFAULT_VERIFY_ALLOWLIST;
  const execution = executeVerify(command, { cwd: repoRoot, exec, allowlist });
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

export = {
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
