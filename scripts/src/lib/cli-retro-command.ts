'use strict';

const os = require('node:os');
const path = require('node:path');

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import retroSources = require('./retro-sources');
const { listRetroSources, defaultRetroRoots } = retroSources;
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
  + '             List Claude Code, Codex, and Cursor transcript candidates for this project (read-only JSON).\n';

const USAGE = 'usage: bouncer retro sources [--repo <dir>] [--limit <1..200>] '
  + '[--claude-root <dir>] [--codex-root <dir>] [--cursor-root <dir>]\n';

const KNOWN_FLAGS = ['repo', 'limit', 'claude-root', 'codex-root', 'cursor-root'];
const DEFAULT_LIMIT = 20;

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
 * `bouncer retro` 핸들러. 현재는 `sources` 하위 명령만 있으며 transcript 본문은
 * 읽지 않는다. 잘못된 사용은 throw 없이 stderr에 usage를 쓰고 2를 돌려준다.
 *
 * @param {string[]} rest - `retro` 뒤 원시 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @param {RetroDeps} [deps] - 테스트용 주입(project root resolver, home, platform, env)
 * @returns {number} 성공 0, project root를 못 정한 운영 실패 1, 잘못된 사용 2
 */
function cmdRetro(rest: string[], io: CliIo, deps: RetroDeps = {}): number {
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
