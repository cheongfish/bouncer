'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;

const PRINT_ROLES = ['implementer', 'reviewer', 'debugger', 'coordinator'] as const;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const USAGE_BLOCK = '  dispatch print --role <implementer|reviewer|debugger|coordinator>'
  + ' --cwd <dir> --input <file> --out <dir>\n'
  + '             Run one Cursor print dispatch (JSON).\n';

const USAGE = `usage: bouncer dispatch print --role <role> --cwd <dir> --input <file> --out <dir> [--repo <dir>]

${USAGE_BLOCK}`;

const HELP = `${USAGE}
--input is a UTF-8 text file, not JSON. The command appends those bytes after the role body.
Roles: implementer, reviewer, debugger, coordinator.
--out keeps bouncer-<role>.prompt.md, bouncer-<role>.jsonl, and bouncer-<role>.log.
Payload rules: rules/cursor-print-dispatch.md
`;

/**
 * 서브커맨드 도움말 여부. parseFlags는 `--help` 뒤 값을 먹고 `-h`를 무시하므로
 * 원시 토큰을 본다. `--flag -h`의 `-h`는 값으로 남긴다.
 *
 * @param {string[]} tokens - `dispatch` 뒤 원시 argv
 * @returns {boolean} 도움말을 내면 true
 */
function argvRequestsHelp(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok === '--help') return true;
    if (tok === '-h') {
      const prev = i > 0 ? tokens[i - 1] : undefined;
      if (prev === undefined || !prev.startsWith('--')) return true;
    }
  }
  return false;
}

const REQUIRED_FLAGS = ['role', 'cwd', 'input', 'out'] as const;

type ParsedPrint = {
  error?: string;
  role: string | null;
  cwd: string | null;
  input: string | null;
  out: string | null;
  repo?: string;
};

/**
 * `--flag` 토큰 횟수. parseFlags는 마지막 값만 남겨 중복 `--role`을 조용히
 * 덮으므로, 덮기 전에 거절해야 잘못된 역할로 실행되지 않는다.
 *
 * @param {string[]} rest - 플래그 argv
 * @param {string} name - `--` 없는 플래그 이름
 * @returns {number} 등장 횟수
 */
function countFlag(rest: string[], name: string): number {
  let n = 0;
  for (const tok of rest) {
    if (tok === `--${name}`) n += 1;
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
function parseDispatchPrintArgs(rest: string[]): ParsedPrint {
  const fail = (message: string): ParsedPrint => ({
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
  const role = f.role as string;
  if (!(PRINT_ROLES as readonly string[]).includes(role)) {
    return fail('--role must be implementer, reviewer, debugger, or coordinator');
  }
  return {
    role,
    cwd: f.cwd as string,
    input: f.input as string,
    out: f.out as string,
    repo: typeof f.repo === 'string' ? f.repo : undefined,
  };
}

/**
 * 공개 `dispatch` 핸들러. `--help`는 print 모듈을 열기 전에 stdout으로 끝내고,
 * 그 외는 argv 검증과 print 실행·JSON·exit만 연결한다.
 *
 * @param {string[]} rest - `print`와 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 운영 거절 1, 사용법 2
 */
function cmdDispatch(rest: string[], io: CliIo): number {
  // 도움말은 필수 플래그 검사·lazy require보다 먼저. 입력 형식은 stdout에만 적는다.
  if (argvRequestsHelp(rest)) {
    io.out(HELP);
    return 0;
  }
  const parsed = parseDispatchPrintArgs(rest);
  if (parsed.error) {
    io.err(parsed.error);
    return 2;
  }
  // argv를 통과한 뒤에만 print 모듈을 적재한다. 사용법 거절이 agent spawn
  // 경로를 require.cache에 남기지 않게 하기 위함.
  const printDispatch = require('./print-dispatch') as typeof import('./print-dispatch');
  const result = printDispatch.runPrintDispatch({
    repoRoot: parsed.repo ? parsed.repo : process.cwd(),
    role: parsed.role as string,
    cwd: parsed.cwd as string,
    inputFile: parsed.input as string,
    outDir: parsed.out as string,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

export = {
  run: cmdDispatch,
  usage: USAGE_BLOCK,
};
