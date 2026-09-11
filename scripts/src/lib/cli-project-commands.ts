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
const { resolveGraphifyBin, checkGraphifyCompatibility } = graphify;
import migrateTaskLayoutMod = require('./migrate-task-layout');
const { migrateTaskLayout } = migrateTaskLayoutMod;
import runtimeState = require('./runtime-state');
const { runtimePaths } = runtimeState;
import graphSearch = require('./graph-search');
const { graphSuggest, contextSearch, validateContextSearchInput } = graphSearch;

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
};

/**
 * graph-suggest 전용 인자 파서. --seed는 반복 가능해서 parseFlags(마지막 값만
 * 남김)로 처리하지 않는다. 값 없는 --query/--seed는 사용법 오류(exit 2).
 *
 * @param {string[]} rest - 서브커맨드 뒤 argv
 * @returns {GraphSuggestArgs} 성공 시 query·seeds, 실패 시 error
 */
function parseGraphSuggestArgs(rest: string[]): GraphSuggestArgs {
  let query: string | null = null;
  let querySeen = false;
  const seeds: string[] = [];
  let repo: string | undefined;
  const fail = (message: string): GraphSuggestArgs => ({
    error: `graph-suggest: ${message}\n`,
    query,
    seeds,
    repo,
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
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  if (!querySeen || query === null) {
    return fail('--query <text> is required');
  }
  return { query, seeds, repo };
}

function cmdGraphSuggest(rest: string[], io: CliIo) {
  const parsed = parseGraphSuggestArgs(rest);
  if (parsed.error) {
    io.err(parsed.error);
    return 2;
  }
  const repoRoot = (parsed.repo || process.cwd()) as string;
  // 그래프 부재·손상은 예외 대신 JSON status로 수렴 — stdout은 JSON 하나만.
  const result = graphSuggest({
    repoRoot,
    query: parsed.query as string,
    seeds: parsed.seeds,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

type ContextSearchArgs = {
  error?: string;
  mode: string | null;
  query: string | null;
  seeds: string[];
  maxCandidates: number | null;
  repo?: string;
};

/**
 * context-search 전용 인자 파서. 플래그 모양만 읽고, mode·query·상한 의미는
 * graph-search JSON schema 검증기에 맡긴다. 거절은 전부 exit 2.
 * --seed는 graph-suggest와 같이 반복 가능하다.
 *
 * @param {string[]} rest - 서브커맨드 뒤 argv
 * @returns {ContextSearchArgs} 성공 시 mode·query, 실패 시 error
 */
function parseContextSearchArgs(rest: string[]): ContextSearchArgs {
  let mode: string | null = null;
  let query: string | null = null;
  let querySeen = false;
  const seeds: string[] = [];
  let maxCandidates: number | null = null;
  let repo: string | undefined;
  const fail = (message: string): ContextSearchArgs => ({
    error: `context-search: ${message}\n`,
    mode,
    query,
    seeds,
    maxCandidates,
    repo,
  });

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--mode') {
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.length === 0) {
        return fail('--mode <decision|implementation|history> is required');
      }
      mode = value;
      continue;
    }
    if (token === '--query') {
      const value = rest[++i];
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
    if (token === '--max-candidates') {
      const value = rest[++i];
      if (value === undefined || value.startsWith('--') || value.length === 0) {
        return fail('--max-candidates requires an integer 1..8');
      }
      // 숫자 변환만 한다. 1..8 범위는 validateContextSearchInput이 JSON schema로 거절한다.
      maxCandidates = Number(value);
      continue;
    }
    if (token === '--repo') {
      const value = rest[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    return fail(`unexpected argument: ${token}`);
  }

  const schemaError = validateContextSearchInput({
    mode: mode ?? undefined,
    query: querySeen && query !== null ? query : undefined,
    seeds,
    maxCandidates: maxCandidates === null ? undefined : maxCandidates,
  });
  if (schemaError) return fail(schemaError);
  return { mode, query, seeds, maxCandidates, repo };
}

function cmdContextSearch(rest: string[], io: CliIo) {
  const parsed = parseContextSearchArgs(rest);
  if (parsed.error) {
    io.err(parsed.error);
    return 2;
  }
  const repoRoot = (parsed.repo || process.cwd()) as string;
  const compat = checkGraphifyCompatibility({ repoRoot });
  if (compat.status === 'version-incompatible') {
    // 설치를 고치지 않고 상태만 돌려 준다. 후보를 꾸며 내지 않는다.
    io.out(`${JSON.stringify({
      query_id: `${parsed.mode}:incompatible`,
      terms: [],
      seed: parsed.query,
      raw_node_count: 0,
      eligible_document_count: 0,
      candidates: [],
      status: 'version-incompatible',
      compatibility: { reasons: compat.reasons, warnings: compat.warnings },
    }, null, 2)}\n`);
    return 0;
  }
  const result = contextSearch({
    repoRoot,
    mode: parsed.mode as string,
    query: parsed.query as string,
    seeds: parsed.seeds,
    maxCandidates: parsed.maxCandidates === null ? undefined : parsed.maxCandidates,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
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

function cmdMigrate(rest: string[], io: CliIo) {
  const [kind, ...flagArgs] = rest;
  // kind를 플래그보다 먼저 본다. 알 수 없는 kind에 --dry-run만 있어도
  // task-layout으로 떨어지면 안 된다.
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
    usage: `  graph-sync Rebuild stale graphify source + test + context graphs (SessionStart / plan).
`,
  },
  'graph-suggest': {
    run: cmdGraphSuggest,
    usage: `  graph-suggest --query <text> [--seed <value>]...
             Rank implementation/test/context file candidates from graphify graphs (JSON).
`,
  },
  'context-search': {
    run: cmdContextSearch,
    usage: `  context-search --mode <decision|implementation|history> --query <text>
             [--seed <value>] [--max-candidates <1..8>]
             Rank decision/implementation/history document candidates (JSON).
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
`,
  },
};
