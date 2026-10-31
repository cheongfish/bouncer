'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
import config = require('./config');
const { readVerifyPolicy } = config;
import windowsNpm = require('./windows-npm');
const { resolveSpawn } = windowsNpm;
import commandArgv = require('./command-argv');
const { parseVerifyArgv, isValidVerifyCommand } = commandArgv;
import type { VerifyExec, VerifyExecOpts } from './verification-contracts';
// 통과한 실행은 명령이 0으로 종료되었다는 증거입니다. tail에는 명령이
// 끝에 출력하는 요약만 담으면 됩니다. 실패한 실행은 무엇이 잘못됐는지에 대한
// 증거이므로 훨씬 더 많이 — 그리고 리뷰어가 읽는 문서 본문에, frontmatter에만
// 두지 않고 — 보관합니다.
const OUTPUT_TAIL_LINES = 100;
const PASSING_OUTPUT_TAIL_LINES = 20;
const MAX_VERIFY_OUTPUT_BYTES = 10 * 1024 * 1024;

/**
 * 증적 크기를 제한하면서 실패 원인 또는 성공 요약이 있는 마지막 줄을 보존한다.
 * @param {unknown} stdout - 실행 표준 출력
 * @param {unknown} stderr - 실행 표준 오류
 * @param {number} lines - 보존할 최대 줄 수
 * @returns {string} 앞뒤 공백을 제거한 출력 tail
 */
function outputTail(stdout: unknown, stderr: unknown, lines = OUTPUT_TAIL_LINES): string {
  const combined = [stdout, stderr].filter(Boolean).join('');
  return combined.split('\n').slice(-lines).join('\n').trim();
}

// node:test가 실패한 테스트에 붙이는 줄 머리(`✖ 이름`). 요약 줄(`✖ failing tests:`)은 이름이 아니다.
const FAILED_TEST_LINE = /^\s*✖ (?!failing tests:)(.+?)(?: \(\d+(?:\.\d+)?ms\))?$/;
const MAX_FAILED_TEST_NAMES = 50;

/**
 * 실패한 실행의 증적 tail. `npm run ci`처럼 여러 단계가 이어지면 마지막 100줄이 실패한 테스트와 상관없는
 * 요약으로 채워져 어느 테스트가 실패했는지 사후에 알 수 없다. 그래서 tail에 보이지 않는 실패 테스트 이름을
 * 전체 출력에서 모아 tail 앞에 한 블록으로 붙인다. 이름이 없거나 모두 tail 안에 있으면 tail 그대로다.
 * @param {unknown} stdout - 실행 표준 출력
 * @param {unknown} stderr - 실행 표준 오류
 * @returns {string} 실패 테스트 이름 블록(있으면)과 출력 tail
 */
function failureOutput(stdout: unknown, stderr: unknown): string {
  const tail = outputTail(stdout, stderr);
  const combined = [stdout, stderr].filter(Boolean).join('');
  const names: string[] = [];
  for (const line of combined.split('\n')) {
    const match = FAILED_TEST_LINE.exec(line);
    if (match && !names.includes(match[1]) && !tail.includes(line.trim())) names.push(match[1]);
  }
  if (names.length === 0) return tail;
  const shown = names.slice(0, MAX_FAILED_TEST_NAMES).map((name) => `  ✖ ${name}`);
  const more = names.length > shown.length ? [`  … and ${names.length - shown.length} more`] : [];
  return ['failed tests before the tail:', ...shown, ...more, '---', tail].join('\n');
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
function resolveRuntimeAllowlist(cwd: string):
  | { ok: true; allowlist: readonly string[] }
  | { ok: false; output: string } {
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
function executeVerify(command: string, { cwd, exec, allowlist }: {
  cwd: string;
  exec?: VerifyExec;
  allowlist?: readonly string[];
}): { ok: boolean; exitCode: number; output: string } {
  // 생략과 명시적 전달을 구분한다. 기본 매개변수로 DEFAULT를 붙이면
  // finalize처럼 allowlist 없이 호출해도 저장소 config를 읽지 못한다.
  let resolvedAllowlist: readonly string[];
  if (allowlist !== undefined) {
    resolvedAllowlist = allowlist;
  } else {
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
      // npm/npx는 Windows에서 .cmd shim이라 shell:false로는 실행되지 않는다. node로 CLI를 직접 띄운다.
      const call = resolveSpawn(file, args);
      result = spawnSync(call.command, call.args, { ...runOpts, shell: call.shell });
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
        output: failureOutput(stdout, stderr),
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
      output: failureOutput(stdout, stderr),
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
      output: failureOutput(stdout, stderr),
    };
  }
}


export = { OUTPUT_TAIL_LINES, PASSING_OUTPUT_TAIL_LINES, MAX_VERIFY_OUTPUT_BYTES, executeVerify };
