'use strict';

const os = require('node:os');
const path = require('node:path');

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import retroSources = require('./retro-sources');
const { listRetroSources, defaultRetroRoots } = retroSources;
import retroRead = require('./retro-read');
const { readTranscript } = retroRead;
import runtimeState = require('./runtime-state');
const { runtimePaths } = runtimeState;

// 핸들러 IO 타입은 각 명령 파일에 복제한다(cli.ts의 ESM 경계 주석 참고).
type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

// 테스트 seam. 실제 home·env·git 조회를 주입으로 대체해 단위 테스트가 프로세스를 만들지 않게 한다.
type RetroDeps = {
  resolveProjectRoot?: (cwd: string) => string;
  homeDir?: string;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
};

const USAGE_BLOCK = '  retro sources [--repo <dir>] [--limit <1..200>] [--claude-root <dir>]\n'
  + '             [--codex-root <dir>] [--cursor-root <dir>]\n'
  + '             List Claude Code, Codex, and Cursor transcript candidates for this project (read-only JSON).\n'
  + '  retro read --path <file> [--max-chars <n>]\n'
  + '             Normalize one transcript into role/text messages with a character cap (read-only JSON).\n';

const USAGE = 'usage: bouncer retro sources [--repo <dir>] [--limit <1..200>] '
  + '[--claude-root <dir>] [--codex-root <dir>] [--cursor-root <dir>]\n'
  + '       bouncer retro read --path <file> [--max-chars <n>]\n';

const KNOWN_FLAGS = ['repo', 'limit', 'claude-root', 'codex-root', 'cursor-root'];
const DEFAULT_LIMIT = 20;
const READ_FLAGS = ['path', 'max-chars'];
const DEFAULT_MAX_CHARS = 200000;
const UNREADABLE_MESSAGE = 'transcript 파일을 읽을 수 없습니다.';
const UNSUPPORTED_MESSAGE = '지원하지 않는 transcript 형식이거나 읽을 메시지가 없습니다.';

/**
 * `retro read` 하위 명령. 한 transcript를 정규화해 JSON으로 내보내며 파일을 쓰지 않는다.
 *
 * @param {string[]} rest - `read` 뒤 원시 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 읽기 실패(unreadable·unsupported-schema) 1, 잘못된 사용 2
 */
function cmdRetroRead(rest: string[], io: CliIo): number {
  const flags = parseFlags(rest);
  // 모르는 플래그나 값 없는 플래그는 오타일 가능성이 높아 읽기 전에 거절한다.
  if (Object.keys(flags).some((k) => !READ_FLAGS.includes(k))
    || READ_FLAGS.some((k) => flags[k] === true)
    || flags.path === undefined) {
    io.err(USAGE);
    return 2;
  }
  let maxChars = DEFAULT_MAX_CHARS;
  if (flags['max-chars'] !== undefined) {
    const raw = flags['max-chars'] as string;
    maxChars = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(maxChars) || maxChars < 1) {
      io.err(USAGE);
      return 2;
    }
  }
  const result = readTranscript(path.resolve(flags.path as string), { maxChars });
  if (!result.ok) {
    io.out(`${JSON.stringify({
      ok: false,
      reason: result.reason,
      error: result.reason === 'unreadable' ? UNREADABLE_MESSAGE : UNSUPPORTED_MESSAGE,
    }, null, 2)}\n`);
    return 1;
  }
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

/**
 * `bouncer project-root`와 같은 resolver로 project root를 구한다. linked
 * worktree에서도 main worktree를 정본으로 삼기 위해 같은 함수를 쓴다.
 *
 * @param {string} cwd - 조회 시작 디렉터리
 * @returns {string} project root 절대 경로. 못 정하면 throw
 */
function defaultResolveProjectRoot(cwd: string): string {
  const paths = runtimePaths({ repoRoot: cwd });
  if (paths.unavailable || !paths.projectRoot) {
    throw new Error(paths.reason || 'Bouncer requires a Git repository');
  }
  return paths.projectRoot;
}

/**
 * `bouncer retro` 핸들러. `sources`는 transcript 본문을 읽지 않고, `read`는
 * transcript 하나를 정규화한다. 잘못된 사용은 throw 없이 stderr에 usage를 쓰고 2를 돌려준다.
 *
 * @param {string[]} rest - `retro` 뒤 원시 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @param {RetroDeps} [deps] - 테스트용 주입(project root resolver, home, platform, env)
 * @returns {number} 성공 0, project root를 못 정한 운영 실패 1, 잘못된 사용 2
 */
function cmdRetro(rest: string[], io: CliIo, deps: RetroDeps = {}): number {
  if (rest[0] === 'read') return cmdRetroRead(rest.slice(1), io);
  if (rest[0] !== 'sources') {
    io.err(USAGE);
    return 2;
  }
  const flags = parseFlags(rest.slice(1));
  // 모르는 플래그를 조용히 무시하면 오타(--clude-root)가 실제 home 탐색으로 번진다.
  if (Object.keys(flags).some((k) => !KNOWN_FLAGS.includes(k))) {
    io.err(USAGE);
    return 2;
  }
  // 값이 필요한 플래그가 값 없이 오면 parseFlags는 true를 돌려준다.
  if (KNOWN_FLAGS.some((k) => flags[k] === true)) {
    io.err(USAGE);
    return 2;
  }
  let limit = DEFAULT_LIMIT;
  if (flags.limit !== undefined) {
    const raw = flags.limit as string;
    limit = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      io.err(USAGE);
      return 2;
    }
  }

  let projectRoot: string;
  try {
    projectRoot = flags.repo
      ? path.resolve(flags.repo as string)
      : (deps.resolveProjectRoot ?? defaultResolveProjectRoot)(process.cwd());
  } catch (err) {
    // resolver 실패는 모두 "project root를 정하지 못함" 한 가지 운영 실패다.
    // 사유 문자열은 resolver가 준 메시지를 그대로 실어 원인을 보존한다.
    io.out(`${JSON.stringify({
      ok: false,
      error: `project root를 정하지 못했습니다: ${(err as Error).message}`,
    }, null, 2)}\n`);
    return 1;
  }

  const defaults = defaultRetroRoots({
    homeDir: deps.homeDir ?? os.homedir(),
    platform: deps.platform ?? process.platform,
    env: deps.env ?? process.env,
  });
  const roots = {
    claude: (flags['claude-root'] as string | undefined) ?? defaults.claude,
    codex: (flags['codex-root'] as string | undefined) ?? defaults.codex,
    cursor: (flags['cursor-root'] as string | undefined) ?? defaults.cursor,
  };
  const result = listRetroSources({ projectRoot, roots, limit });
  io.out(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  return 0;
}

export = { run: cmdRetro, usage: USAGE_BLOCK };
