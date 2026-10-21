'use strict';

/**
 * CLI 공통 플래그 파서. 명령 모듈이 cli.ts를 require하지 못하게 여기 둔다
 * (순환: cli.ts → 명령 모듈 → cli.ts).
 */
function parseFlags(rest: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  // 위치 인자(scaffold kind, migrate kind)는 건너뛴다. 전부 플래그로 삼키면
  // 핸들러가 rest[0]을 kind로 읽지 못한다.
  for (let i = 0; i < rest.length; i += 1) {
    const tok = rest[i];
    if (!tok.startsWith('--')) continue;
    const key = tok.slice(2);
    const next = rest[i + 1];
    // 다음이 없거나 또 다른 -- 토큰이면 boolean. --yes --repo <dir> 에서
    // '--repo'를 --yes의 값으로 소비하지 않기 위함.
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      // 값을 소비했으니 다음 루프가 그 값을 새 플래그로 파싱하지 않는다.
      i += 1;
    }
  }
  return flags;
}

/**
 * 서브커맨드 도움말 요청 여부. parseFlags는 `--help` 뒤 값을 먹고 `-h`를 무시하므로
 * 원시 토큰을 본다. `--reason -h`처럼 직전 토큰이 `--` 플래그면 `-h`는 그 플래그의 값이다.
 * runCli(handler 적재 전 가로채기)와 자체 help를 가진 handler가 같은 규칙을 쓰도록 한 곳에 둔다.
 *
 * @param {string[]} tokens - 명령 이름 뒤 원시 argv
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

export = { parseFlags, argvRequestsHelp };
