'use strict';
// argv 검사 leaf 모듈. verification.ts가 의존 모듈이 많아, 같은 검사를 쓰려는
// seed-worktree가 verification을 가져오면 import 순환 위험이 있다. 그래서 node
// 내장 모듈과 config의 기본 허용 목록만 가져오는 이 모듈로 분리했다.
const path = require('node:path');
import config = require('./config');
const { DEFAULT_VERIFY_ALLOWLIST } = config;


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
 * 기본 목록을 쓴다. 저장소 정책을 이미 읽은 호출자는 그 목록을 넘겨
 * S12와 runtime이 다른 답을 내지 않게 한다.
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

/**
 * verify 명령을 비교용으로 정규화한다. 앞뒤 공백을 자르고 연속 공백을 하나로
 * 접는다. G20(종단 전체 명령 금지)과 `coordinate repair --verify` 검사가 같은
 * 함수를 써야 한 표면이 통과시킨 값을 다른 표면이 종단 명령으로 오인하지 않는다.
 *
 * @param {string} cmd - verify 명령 문자열
 * @returns {string} 정규화된 문자열. 문자열이 아니면 빈 문자열
 */
function normalizeVerifyCommand(cmd: string): string {
  return typeof cmd === 'string' ? cmd.trim().replace(/\s+/g, ' ') : '';
}

export = {
  normalizeVerifyCommand,
  parseVerifyArgv,
  verifyExecutableName,
  isValidVerifyCommand,
};
