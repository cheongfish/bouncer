'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import initMod = require('./init');
const { init } = initMod;
import time = require('./time');
const { nowIsoKst } = time;
import sessionGraph = require('./session-graph');
const { syncSessionGraphs } = sessionGraph;
import graphify = require('./graphify');
const { resolveGraphifyBin } = graphify;
import migrateTaskLayoutMod = require('./migrate-task-layout');
const { migrateTaskLayout } = migrateTaskLayoutMod;
import retentionMigration = require('./retention-migration');
const { auditRetention, migrateRetention } = retentionMigration;
import runtimeState = require('./runtime-state');
const { runtimePaths } = runtimeState;
import graphSearch = require('./graph-search');
const { graphSuggest } = graphSearch;
import runPreflightMod = require('./run-preflight');
const { runPreflight } = runPreflightMod;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

function cmdInit(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  const timestamp = typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst();
  // CLI 기본은 설치 on — 라이브러리 init() 기본(install:false)과 의도적으로 다르다.
  // 테스트·프로그래밍 호출이 네트워크 pip을 타지 않게 라이브러리는 opt-in.
  const install = f['no-graphify'] !== true;
  const repoRoot = (f.repo || process.cwd()) as string;
  const result = init({
    repoRoot,
    timestamp,
    graphify: {
      install,
      // --upgrade-graphify만 이 rebuild를 탄다. 기본 sync는 mtime skip-fresh라
      // 패키지 schema만 바뀐 승격이 옛 graph.json을 stamp하는 것으로 끝난다.
      // force여도 skip-version-incompatible·skip-graph-disabled 등은 failed[]
      // 없이 돌아온다. 그 경우를 성공으로 치면 안 되는 검사는 upgradeGraphify가 한다.
      rebuild: () => syncSessionGraphs({ repoRoot, force: true }),
    },
    promote: f['promote-graphify'] === true,
    upgradeGraphify: f['upgrade-graphify'] === true,
    writeGitignore: f['write-gitignore'] === true,
    seedCodexAgents: f['seed-codex-agents'] === true,
  });
  io.out(`${JSON.stringify(Object.assign({ ok: true }, result), null, 2)}\n`);
  // created/skipped와 무관하게 result.ok만 본다. 부분 성공을 0으로 위장하지 않음.
  return result.ok ? 0 : 1;
}

function cmdGraphSync(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  const result = syncSessionGraphs({ repoRoot: (f.repo || process.cwd()) as string });
  // missing은 상태가 아니라 오류가 아니다(그래프 부재). failed만 종료 코드를 가른다.
  io.out(`${JSON.stringify({ ok: result.failed.length === 0, ...result }, null, 2)}\n`);
  return result.failed.length === 0 ? 0 : 1;
}

type GraphSuggestArgs = {
  error?: string;
  query: string | null;
  seeds: string[];
  repo?: string;
  debug: boolean;
};

/**
 * graph-suggest 전용 인자 파서. --seed는 반복 가능해서 parseFlags(마지막 값만
 * 남김)로 처리하지 않는다. 값 없는 --query/--seed는 사용법 오류(exit 2).
 * --debug는 값 없는 singleton boolean — 중복·값 첨부 모두 거절한다.
 *
 * @param {string[]} rest - 서브커맨드 뒤 argv
 * @returns {GraphSuggestArgs} 성공 시 query·seeds·debug, 실패 시 error
 */
function parseGraphSuggestArgs(rest: string[]): GraphSuggestArgs {
  let query: string | null = null;
  let querySeen = false;
  const seeds: string[] = [];
  let repo: string | undefined;
  let debug = false;
  let debugSeen = false;
  const fail = (message: string): GraphSuggestArgs => ({
    error: `graph-suggest: ${message}\n`,
    query,
    seeds,
    repo,
    debug,
  });

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--query') {
      const value = rest[++i];
      // 빈 문자열도 거절 — parseFlags는 ''를 값으로 받아 통과시키므로 여기서 막는다.
      if (value === undefined || value.startsWith('--') || value.length === 0) {
        return fail('--query requires a non-empty text value');
      }
      query = value;
      querySeen = true;
      continue;
    }
    if (token === '--seed') {
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.length === 0) {
        return fail('--seed requires a value');
      }
      seeds.push(value);
      continue;
    }
    if (token === '--repo') {
      const value = rest[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token === '--debug') {
      // intent --symbol과 같이 singleton. 두 번째 --debug는 덮지 않고 거절한다.
      if (debugSeen) return fail('duplicate option: --debug');
      debugSeen = true;
      const next = rest[i + 1];
      // `--debug yes`처럼 값이 붙으면 boolean flag 계약을 깨므로 거절한다.
      if (next !== undefined && !next.startsWith('--')) {
        return fail('--debug is a boolean flag and does not take a value');
      }
      debug = true;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  if (!querySeen || query === null) {
    return fail('--query <text> is required');
  }
  return { query, seeds, repo, debug };
}

function cmdGraphSuggest(rest: string[], io: CliIo) {
  const parsed = parseGraphSuggestArgs(rest);
  if (parsed.error) {
    io.err(parsed.error);
    return 2;
  }
  const repoRoot = (parsed.repo || process.cwd()) as string;
  // 그래프 부재·손상은 예외 대신 JSON status로 수렴 — stdout은 JSON 하나만.
  // debug는 같은 ranking projection만 추가하고 기본 필드·순위를 바꾸지 않는다.
  const result = graphSuggest({
    repoRoot,
    query: parsed.query as string,
    seeds: parsed.seeds,
    debug: parsed.debug,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

/**
 * 첫 intent 실행에서만 전용 CommonJS command를 적재한다. usage 문자열은 여기
 * 레지스트리에 남겨 help가 projectCommands만으로도 조립되게 하고,
 * parser·resolver는 cli-intent-command 쪽으로 미룬다.
 *
 * @param {string[]} rest - `intent` 뒤 argv
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 전용 handler의 종료 코드
 */
function cmdIntentLazy(rest: string[], io: CliIo): number {
  const intentCommand = require('./cli-intent-command') as {
    run: (rest: string[], io: CliIo) => number;
  };
  return intentCommand.run(rest, io);
}

function cmdGraphifyBin(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  const repoRoot = (f.repo || process.cwd()) as string;
  const { bin } = resolveGraphifyBin({ repoRoot });
  if (!bin) {
    // stdout은 pipe-clean 유지 — 실패 사유는 stderr만.
    io.err('graphify-bin: graphify executable not found (config.bin, venv, or PATH)\n');
    // 환경 문제이지 사용법 오류가 아니므로 2가 아니라 1.
    return 1;
  }
  io.out(`${bin}\n`);
  return 0;
}

function cmdProjectRoot(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  const repoRoot = (f.repo || process.cwd()) as string;
  // 현재 워크플로가 소비하는 정본은 main worktree다. linked cwd나
  // plugin root로 대체하면 도그푸드 기준을 오독하므로 unavailable은
  // 빈 stdout/cwd fallback 없이 stderr+1로 거절한다.
  const paths = runtimePaths({ repoRoot });
  if (paths.unavailable || !paths.projectRoot) {
    io.err(`project-root: ${paths.reason || 'Bouncer requires a Git repository'}\n`);
    return 1;
  }
  io.out(`${paths.projectRoot}\n`);
  return 0;
}

function catchMessage(error: unknown): string {
  // 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
  // TypeError 대신 빈 메시지가 되어 종료 코드 경로가 바뀐다.
  return (error as { message: string }).message;
}

/**
 * `run preflight`만 받는다. 정규화 JSON을 stdout에 내고, 거절은 같은 채널의
 * `{ok:false}`와 종료 코드 1이다. 알 수 없는 서브커맨드는 사용법(2).
 *
 * @param {string[]} rest - 서브커맨드와 플래그
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, 거절 1, 사용법 2
 */
function cmdRun(rest: string[], io: CliIo) {
  const command = rest[0];
  const f = parseFlags(rest.slice(1));
  // preflight만 공개한다. 다른 서브커맨드를 받으면 사용법(2) — 런타임 거절(1)과
  // 구분해, 없는 동사를 drive 쓰기로 착각하지 않게 한다.
  if (command !== 'preflight') {
    io.err('run: command must be preflight\n');
    return 2;
  }
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('run: --blueprint is required\n');
    return 2;
  }
  try {
    const result = runPreflight({
      repoRoot: (f.repo || process.cwd()) as string,
      blueprintDir: f.blueprint,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    io.err(`run preflight: ${catchMessage(error)}\n`);
    return 1;
  }
}

/**
 * migrate retention 전용 argv. parseFlags는 중복·알 수 없는 option을 조용히
 * 삼키므로, --apply/--blueprint 조합을 여기서 닫아 부분 적용을 막는다.
 *
 * @param {string[]} flagArgs - `migrate retention` 뒤 argv
 * @returns {{ error?: string, apply: boolean, blueprint: string | null, repo?: string }}
 */
function parseRetentionMigrateArgs(flagArgs: string[]): {
  error?: string;
  apply: boolean;
  blueprint: string | null;
  repo?: string;
} {
  let apply = false;
  let applySeen = false;
  let blueprint: string | null = null;
  let blueprintSeen = false;
  let repo: string | undefined;
  let repoSeen = false;
  const fail = (message: string) => ({
    error: `migrate retention: ${message}\n`,
    apply,
    blueprint,
    repo,
  });

  for (let i = 0; i < flagArgs.length; i += 1) {
    const token = flagArgs[i];
    if (token === '--apply') {
      if (applySeen) return fail('duplicate option: --apply');
      applySeen = true;
      apply = true;
      continue;
    }
    if (token === '--blueprint') {
      if (blueprintSeen) return fail('duplicate option: --blueprint');
      blueprintSeen = true;
      const value = flagArgs[++i];
      if (value === undefined || value.startsWith('--') || value.trim() === '') {
        return fail('--blueprint requires a directory');
      }
      blueprint = value.trim();
      continue;
    }
    if (token === '--repo') {
      if (repoSeen) return fail('duplicate option: --repo');
      repoSeen = true;
      const value = flagArgs[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  // dry-run이 기본이다. --blueprint만 주면 단일 경로 적용처럼 보이므로 거절한다.
  if (blueprintSeen && !applySeen) {
    return fail('--blueprint requires --apply');
  }
  if (applySeen && !blueprintSeen) {
    return fail('--apply requires --blueprint <dir>');
  }
  return { apply, blueprint, repo };
}

function cmdMigrate(rest: string[], io: CliIo) {
  const [kind, ...flagArgs] = rest;
  // kind를 플래그보다 먼저 본다. 알 수 없는 kind에 --dry-run만 있어도
  // task-layout으로 떨어지면 안 된다.
  if (kind === 'retention') {
    const parsed = parseRetentionMigrateArgs(flagArgs);
    if (parsed.error) {
      io.err(parsed.error);
      return 2;
    }
    const repoRoot = (parsed.repo || process.cwd()) as string;
    if (parsed.apply) {
      const result = migrateRetention({
        repoRoot,
        blueprintDir: parsed.blueprint as string,
      });
      io.out(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    }
    const result = auditRetention({ repoRoot });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  if (kind !== 'task-layout') {
    io.err(`unknown migrate kind: ${kind || '(missing)'}\n`);
    return 2;
  }
  const f = parseFlags(flagArgs);
  const repoRoot = (f.repo || process.cwd()) as string;
  const result = migrateTaskLayout({ repoRoot, dryRun: f['dry-run'] === true });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  // kind는 위에서 이미 걸렀다. 라이브러리 거절(dirty/collision)은 실행 실패(1).
  return result.ok ? 0 : 1;
}

export = {
  init: {
    run: cmdInit,
    usage: `  init       [--upgrade-graphify] Bootstrap .bouncer/ for this project. Never overwrites.
`,
  },
  'graph-sync': {
    run: cmdGraphSync,
    usage: `  graph-sync Rebuild stale graphify source + test graphs (SessionStart / plan).
`,
  },
  'graph-suggest': {
    run: cmdGraphSuggest,
    usage: `  graph-suggest --query <text> [--seed <value>]... [--debug]
             Rank implementation/test file candidates from graphify source/test graphs (JSON).
`,
  },
  intent: {
    run: cmdIntentLazy,
    usage: `  intent     --symbol <function-name> [--candidate <qualified-ref>] [--limit <1..5>]
             Print function intent provenance JSON (read-only).
  intent     bundle --task <tasks.md> --symbol <name> [--candidate <qualified-ref>]...
             Create or reuse a task intent bundle JSON (read/write cache).
`,
  },
  'graphify-bin': {
    run: cmdGraphifyBin,
    usage: `  graphify-bin
             Print the resolved graphify executable path (one line).
`,
  },
  'project-root': {
    run: cmdProjectRoot,
    usage: `  project-root
             Print the consuming project's main worktree absolute path (one line).
`,
  },
  migrate: {
    run: cmdMigrate,
    usage: `  migrate    task-layout [--dry-run]
             Move legacy task files into tasks/<NNN>/ units.
  migrate    retention
             Audit closed blueprints for retention (dry-run, JSON, no writes).
  migrate    retention --apply --blueprint <dir>
             Promote Explain then delete transients for one eligible closed blueprint.
`,
  },
  run: {
    run: cmdRun,
    usage: `  run        preflight --blueprint <dir>
             Print pointer, open tasks, DAG, ready wave, and autonomy as JSON.
`,
  },
};
