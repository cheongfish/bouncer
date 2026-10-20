'use strict';

import cliUsage = require('./cli-usage');
import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

const USAGE = `usage: bouncer epic <add-domain|add-area> [--repo <dir>]\n${cliUsage.COMMAND_USAGE.epic}`;

// 하위 명령별 허용 플래그. 목록 밖 플래그는 오타일 가능성이 커서 조용히 무시하지 않고 거절한다.
const ALLOWED: Record<string, string[]> = {
  'add-domain': ['slug', 'reason', 'yes', 'timestamp', 'repo'],
  'add-area': ['name', 'yes', 'repo'],
};
// 값을 받는 필수 플래그.
const REQUIRED: Record<string, string[]> = { 'add-domain': ['slug', 'reason'], 'add-area': ['name'] };

/**
 * 원시 argv에서 `--flag` 토큰 이름을 순서대로 모은다.
 *
 * @param {string[]} tokens - 하위 명령 뒤 argv
 * @returns {string[]} 플래그 이름 목록(중복 포함)
 */
function flagNames(tokens: string[]): string[] {
  return tokens.filter((t) => t.startsWith('--')).map((t) => t.slice(2));
}

/**
 * `epic` 하위 명령 argv를 검사한다. 사용법 오류(exit 2)만 여기서 거르고,
 * `--yes` 누락은 승인 경계이므로 통과시켜 등록부를 읽기 전에 confirmation-required로 거절하게 한다.
 *
 * @param {string} sub - 하위 명령 이름
 * @param {string[]} flags - 하위 명령 뒤 argv
 * @returns {string | null} 사용법 오류 메시지(통과하면 null)
 */
function argvError(sub: string, flags: string[]): string | null {
  const names = flagNames(flags);
  for (const name of names) {
    if (!ALLOWED[sub].includes(name)) return `unknown flag --${name}`;
    if (names.filter((n) => n === name).length > 1) return `--${name} specified more than once`;
  }
  const f = parseFlags(flags);
  for (const name of REQUIRED[sub]) {
    if (typeof f[name] !== 'string') return `--${name} is required`;
  }
  // slug·name은 빈 문자열이면 값이 없는 것과 같다. reason은 공백 거절을 reason 코드로
  // 보이려고 빈 문자열도 통과시킨다.
  for (const name of REQUIRED[sub].filter((n) => n !== 'reason')) {
    if (f[name] === '') return `--${name} is required`;
  }
  if (f.repo !== undefined && (typeof f.repo !== 'string' || f.repo === '')) return '--repo requires a directory';
  if (f.timestamp !== undefined && (typeof f.timestamp !== 'string' || f.timestamp === '')) {
    return '--timestamp requires a value';
  }
  return null;
}

/**
 * 공개 `epic` 핸들러. 등록부에 도메인 epic이나 area를 더한다. `--yes`가 사용자 명시 승인이며
 * 없으면 등록부를 읽기 전에 거절한다. 디렉터리는 만들지 않는다(scaffold는 다음 plan이 한다).
 *
 * @param {string[]} rest - 하위 명령과 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 등록부 거절 1, 사용법 오류 2
 */
function run(rest: string[], io: CliIo): number {
  if (rest.includes('--help') || rest.includes('-h')) {
    io.out(USAGE);
    return 0;
  }
  const [sub, ...flags] = rest;
  if (sub === undefined || !Object.hasOwn(ALLOWED, sub)) {
    io.err(`epic: unknown or missing subcommand${sub === undefined ? '' : `: ${sub}`}\n${USAGE}`);
    return 2;
  }
  const bad = argvError(sub, flags);
  if (bad !== null) {
    io.err(`epic ${sub}: ${bad}\n${USAGE}`);
    return 2;
  }
  const f = parseFlags(flags);
  const emit = (value: unknown, code: number): number => {
    io.out(`${JSON.stringify(value, null, 2)}\n`);
    return code;
  };
  const refuse = (reason: string, cause: string, next: string): number => (
    emit({ ok: false, reason, cause, next }, 1)
  );
  // 승인 확인은 어떤 파일 접근보다 먼저(review accept-risk 선례).
  if (f.yes !== true) {
    return refuse(
      'epic-registry-confirmation-required',
      `epic ${sub} needs explicit user approval`,
      'Ask the user to approve, then rerun with --yes.',
    );
  }
  // 승인 뒤에만 기능 모듈을 적재한다. 사용법·승인 거절이 등록부 I/O 경로를 require.cache에 남기지 않게 한다.
  const registryLib = require('./epic-registry') as typeof import('./epic-registry');
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const repoRoot = (typeof f.repo === 'string' ? f.repo : process.cwd());
  const read = registryLib.readEpicRegistry(repoRoot);
  if (read.status === 'missing') {
    return refuse('epic-registry-missing', `${registryLib.REGISTRY_REL} does not exist`, 'Run `bouncer init` first.');
  }
  if (read.status === 'invalid') {
    return refuse('epic-registry-invalid', read.message, `Fix ${registryLib.REGISTRY_REL} to match the format.`);
  }
  let result;
  if (sub === 'add-domain') {
    const { nowIsoKst } = require('./time') as typeof import('./time');
    // 번호 배정이 디렉터리 번호도 보므로 epics 디렉터리를 읽는다. 디렉터리 없음(ENOENT)만 빈 목록이다.
    let dirs: string[] = [];
    try {
      dirs = fs.readdirSync(path.join(repoRoot, '.bouncer/context/epics'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    result = registryLib.addDomainEpic(read.registry, {
      slug: f.slug as string,
      reason: f.reason as string,
      approvedAt: typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst(),
    }, dirs);
  } else {
    result = registryLib.addArea(read.registry, f.name as string);
  }
  if (!result.ok) return refuse(result.reason, result.cause, 'Adjust the input and rerun; nothing was written.');
  // 검증을 모두 통과한 뒤 한 번만 쓴다.
  registryLib.writeEpicRegistry(repoRoot, result.registry);
  return emit(
    'epic' in result
      ? { ok: true, path: registryLib.REGISTRY_REL, epic: result.epic }
      : { ok: true, path: registryLib.REGISTRY_REL, area: result.area },
    0,
  );
}

export = { run };
