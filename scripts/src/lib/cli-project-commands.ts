'use strict';

const { parseFlags } = require('./cli-flags') as {
  parseFlags: (rest: string[]) => Record<string, string | boolean>;
};
const { init } = require('./init') as {
  init: (opts: Record<string, unknown>) => { ok: boolean };
};
const { nowIsoKst } = require('./time') as {
  nowIsoKst: () => string;
};
const { syncSessionGraphs } = require('./session-graph') as {
  syncSessionGraphs: (opts: { repoRoot: string }) => { failed: unknown[] };
};
const { resolveGraphifyBin } = require('./graphify') as {
  resolveGraphifyBin: (opts: { repoRoot: string }) => { bin: string | null };
};
const { migrateIds } = require('./migrate-ids') as {
  migrateIds: (opts: { repoRoot: string; dryRun?: boolean }) => { ok: boolean };
};
const { migrateTaskLayout } = require('./migrate-task-layout') as {
  migrateTaskLayout: (opts: { repoRoot: string; dryRun?: boolean }) => { ok: boolean };
};
const { runtimePaths } = require('./runtime-state') as {
  runtimePaths: (opts: { repoRoot: string }) => {
    unavailable?: boolean;
    projectRoot?: string;
    reason?: string;
  };
};
const { readShards, routeShards, renderShards, resolveDistillRoot } = require('./distill') as {
  readShards: (opts: { repoRoot: string; runtime?: unknown }) => DistillState;
  routeShards: (opts: Record<string, unknown>) => DistillSelection;
  renderShards: (state: DistillState, selection: DistillSelection) => string;
  resolveDistillRoot: (opts: { repoRoot: string; runtime?: unknown }) => string;
};
const { readConfig, getDistillConfig } = require('./config') as {
  readConfig: (repoRoot: string) => unknown;
  getDistillConfig: (config?: unknown) => { routing_enabled: boolean; max_bytes: number };
};

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

type DistillShard = {
  id: string;
  path?: string;
  raw?: string;
  always?: boolean;
  pathsKnown?: boolean;
  pullsKnown?: boolean;
  paths?: unknown;
  pulls?: unknown;
};
type DistillState = {
  shards?: DistillShard[];
  ids?: string[];
  sharded?: boolean;
  valid?: boolean;
  path?: string;
  repoRoot?: string;
  routingEnabled?: boolean;
};
type DistillSelection = {
  full?: boolean;
  reason?: string;
  ids?: string[];
  shards?: DistillShard[];
};
type DistillArgs = {
  error?: string;
  targets: string[];
  mode: string | null;
  repo?: string;
  json: boolean;
};

const DISTILL_MODES = new Set(['for', 'all', 'preflight', 'route', 'audit']);

function parseDistillArgs(rest: string[]): DistillArgs {
  const targets: string[] = [];
  let mode: string | null = null;
  let repo: string | undefined;
  let json = false;
  const fail = (message: string) => ({ error: `distill: ${message}\n`, targets, mode, repo, json });

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--json') {
      json = true;
      continue;
    }
    if (token === '--repo') {
      const value = rest[++i];
      if (!value || value.startsWith('--')) return fail('--repo requires a directory');
      repo = value;
      continue;
    }
    if (token === '--for' || token === '--route') {
      const nextMode = token.slice(2);
      const value = rest[++i];
      if (!value || value.startsWith('--')) return fail(`${token} requires at least one path`);
      if (mode && mode !== nextMode) return fail('modes cannot be combined');
      mode = nextMode;
      targets.push(value);
      continue;
    }
    if (token === '--all' || token === '--audit' || token === '--preflight') {
      const nextMode = token.slice(2);
      if (mode && mode !== nextMode) return fail('modes cannot be combined');
      mode = nextMode;
      continue;
    }
    if (token.startsWith('--')) return fail(`unknown option: ${token}`);
    // --for/--route 만 경로를 먹는다. 나머지 모드에 남은 위치 인자는
    // unexpected가 아니라 path 거부로 모아 세 모드의 거절 문구가 갈라지지 않게 한다.
    if (mode === 'all' || mode === 'audit' || mode === 'preflight') {
      targets.push(token);
      continue;
    }
    return fail(`unexpected argument: ${token}`);
  }

  if (!mode || !DISTILL_MODES.has(mode)) {
    return fail('one of --for, --all, --preflight, --route, or --audit is required');
  }
  if ((mode === 'all' || mode === 'audit' || mode === 'preflight') && targets.length > 0) {
    return fail(`${mode} does not accept a path`);
  }
  return { targets, mode, repo, json };
}

function allDistillSelection(state: DistillState, reason: string) {
  const shards = Array.isArray(state.shards) ? state.shards : [];
  return {
    full: true,
    reason,
    ids: Array.isArray(state.ids) ? state.ids : shards.map((shard) => shard.id),
    shards: shards.slice(),
  };
}

/**
 * 경로가 아직 없는 계획 초반용 선택. always 본문만 고르고, 인벤토리는
 * distillPayload가 등록 전체를 따로 투영한다.
 *
 * @param {DistillState} state - readShards 결과
 * @returns {{full: boolean, reason: string, ids: string[], shards: DistillShard[]}}
 *   샤드가 아니면 전량(`not-sharded`). 아니면 `always === true`만 (`preflight-always`).
 */
function alwaysDistillSelection(state: DistillState) {
  // 인덱스 무효·단일 파일에는 always 필터를 걸 샤드 목록이 없다.
  // 빈 선택으로 내면 본문이 사라져 프리플라이트가 침묵하므로 전량 폴백.
  if (state.sharded !== true) {
    return allDistillSelection(state, 'not-sharded');
  }
  const shards = Array.isArray(state.shards) ? state.shards : [];
  const selected = shards.filter((shard) => shard.always === true);
  return {
    full: false,
    reason: 'preflight-always',
    ids: selected.map((shard) => shard.id),
    shards: selected,
  };
}

/**
 * `distill --all` 전용 크기 관측을 stderr로 낸다.
 * stdout 파이프 청결을 유지하고, S26과 같은 raw UTF-8 바이트로 잰다.
 * max_bytes는 경고 표시만 붙이며 본문을 자르거나 샤드를 빼지 않는다.
 *
 * @param {DistillState} state - readShards 결과. sharded가 아니면 단일 파일 폴백.
 * @param {string} content - 렌더된 stdout 본문. 단일 파일 폴백 총량에 쓴다.
 * @param {unknown} config - `.bouncer/config.json` 값. max_bytes 기준에 사용.
 * @param {CliIo} io - 출력 포트. err만 사용한다.
 * @returns {void}
 */
function writeDistillAllSizeSummary(
  state: DistillState,
  content: string,
  config: unknown,
  io: CliIo,
): void {
  const maxBytes = getDistillConfig(config).max_bytes;
  // 인덱스 부재·무효 폴백에는 샤드 목록이 없다. across 0 shards 로 적으면
  // 빈 인덱스로 오해되므로 (single-file) 한 줄만 낸다.
  if (state.sharded !== true) {
    io.err(`distill: total ${Buffer.byteLength(content, 'utf8')} bytes (single-file)\n`);
    return;
  }
  const shards = Array.isArray(state.shards) ? state.shards : [];
  let total = 0;
  for (const shard of shards) {
    const bytes = Buffer.byteLength(typeof shard.raw === 'string' ? shard.raw : '', 'utf8');
    total += bytes;
    // 초과 표시는 같은 줄에 붙여 plan/프리플라이트가 한 패스로 걸러 읽을 수 있게 한다.
    if (bytes > maxBytes) {
      io.err(`distill: ${shard.id} ${bytes} (exceeds ${maxBytes})\n`);
    } else {
      io.err(`distill: ${shard.id} ${bytes}\n`);
    }
  }
  io.err(`distill: total ${total} bytes across ${shards.length} shards\n`);
}

function distillPayload(
  state: DistillState,
  selection: DistillSelection,
  mode: string,
  targets: string[],
  routingEnabled = state.routingEnabled === true,
) {
  const ids = Array.isArray(selection.ids) ? selection.ids : [];
  const shards = Array.isArray(state.shards) ? state.shards : [];
  // 선택 결과와 무관하게 인덱스의 전체 등록 순서를 노출해야 소비자가
  // route/for 결과를 다시 읽지 않고도 배치 근거를 보존할 수 있다. 본문과
  // 원문은 이미 content에 있으므로 메타데이터만 새 객체로 투영한다.
  const auditShards = state.sharded === true
    ? shards.map((shard) => {
      const projected: Record<string, unknown> = {
        id: shard.id,
        path: shard.path,
        always: shard.always,
        pathsKnown: shard.pathsKnown,
        pullsKnown: shard.pullsKnown,
      };
      // undefined를 빈 배열로 바꾸면 미선언과 빈 규칙을 구분할 수 없다.
      // JSON.stringify는 undefined 필드를 생략하므로 선언된 값만 명시적으로
      // 복사해 reader가 계산한 known 신호와 원래 메타데이터를 함께 보존한다.
      if (shard.paths !== undefined) projected.paths = shard.paths;
      if (shard.pulls !== undefined) projected.pulls = shard.pulls;
      return projected;
    })
    : [];
  return {
    mode,
    path: state.path,
    repoRoot: state.repoRoot,
    targetPaths: targets,
    routingEnabled,
    full: selection.full === true,
    reason: selection.reason,
    ids,
    content: renderShards(state, selection),
    audit: {
      valid: state.valid === true,
      sharded: state.sharded === true,
      shardCount: shards.length,
      selectedCount: ids.length,
      ids,
      shards: auditShards,
    },
  };
}

function cmdDistill(rest: string[], io: CliIo) {
  const parsed = parseDistillArgs(rest);
  if (parsed.error) {
    io.err(parsed.error);
    return 2;
  }

  const requestedRoot = (parsed.repo || process.cwd()) as string;
  const paths = runtimePaths({ repoRoot: requestedRoot });
  if (paths.unavailable || !paths.projectRoot) {
    io.err(`distill: ${paths.reason || 'Bouncer requires a Git repository'}\n`);
    return 1;
  }

  // Git 가용성만 runtimePaths로 판정한다. Distill 읽기 기준을 projectRoot로
  // 고정하면 --repo로 고른 linked checkout의 Distill을 무시하게 된다.
  const distillRoot = resolveDistillRoot({ repoRoot: requestedRoot, runtime: paths });
  const state = readShards({ repoRoot: distillRoot, runtime: paths });
  const config = readConfig(distillRoot);
  const configRecord = config
    && typeof config === 'object'
    && !Array.isArray(config)
    ? config as Record<string, unknown>
    : null;
  const configDistill = configRecord
    && configRecord.distill
    && typeof configRecord.distill === 'object'
    && !Array.isArray(configRecord.distill)
    ? configRecord.distill as Record<string, unknown>
    : null;
  // 명시된 config 값은 운영자가 현재 소비 모드를 선택한 신호이므로
  // 인덱스의 과거 메타데이터보다 우선한다. config가 없거나 깨졌을 때는
  // 기존 인덱스 flag를 사용해 단일 파일·구 저장소의 fail-open을 보존한다.
  const routingEnabled = configDistill
    && typeof configDistill.routing_enabled === 'boolean'
    ? configDistill.routing_enabled
    : state.routingEnabled === true;
  const selection = parsed.mode === 'all' || parsed.mode === 'audit'
    ? allDistillSelection(state, 'forced-all')
    : parsed.mode === 'preflight'
      ? alwaysDistillSelection(state)
      : routeShards({
        shards: state.shards,
        affectedPaths: parsed.targets,
        routingEnabled,
        repoRoot: state.repoRoot,
      });
  const payload = distillPayload(state, selection, parsed.mode as string, parsed.targets, routingEnabled);

  // 본문 모드는 기존 consumer가 그대로 pipe할 수 있어야 하므로 content만 쓴다.
  // route/audit은 선택 결과 자체가 목적이라 JSON을 고정해 사람이 읽고 도구도
  // 같은 출력을 파싱하게 한다. fail-open 진단은 본문과 섞지 않고 stderr로 보낸다.
  if ((parsed.mode === 'for' || parsed.mode === 'route') && selection.reason !== 'matched') {
    io.err(`distill: ${selection.reason}; using all shards\n`);
  }
  // always가 0이면 content는 비지만 인벤토리는 나가야 한다. stdout에 섞으면
  // pipe-clean이 깨지므로 선택은 비었고 샤드 인덱스일 때만 stderr로 알린다.
  if (
    parsed.mode === 'preflight'
    && state.sharded === true
    && (!Array.isArray(selection.ids) || selection.ids.length === 0)
  ) {
    io.err('distill: preflight selected no always shard\n');
  }
  // 크기 요약은 --all 전용. --for/--route에 붙이면 선택 결과를 총량으로
  // 오해하고, --audit 은 audit.err === '' 계약을 깨뜨린다.
  if (parsed.mode === 'all') {
    writeDistillAllSizeSummary(state, payload.content, config, io);
  }
  if (parsed.json || parsed.mode === 'route' || parsed.mode === 'audit') {
    io.out(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    io.out(payload.content);
  }
  return 0;
}

function cmdInit(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  const timestamp = typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst();
  // CLI 기본은 설치 on — 라이브러리 init() 기본(install:false)과 의도적으로 다르다.
  // 테스트·프로그래밍 호출이 네트워크 pip을 타지 않게 라이브러리는 opt-in.
  const install = f['no-graphify'] !== true;
  const result = init({
    repoRoot: (f.repo || process.cwd()) as string,
    timestamp,
    graphify: { install },
    promote: f['promote-graphify'] === true,
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
  // Distill·워크플로가 소비하는 정본은 main worktree다. linked cwd나
  // plugin root로 대체하면 도그푸드 Distill을 오독하므로 unavailable은
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
  // ids/task-layout 중 하나로 떨어지면 안 된다.
  if (kind !== 'ids' && kind !== 'task-layout') {
    io.err(`unknown migrate kind: ${kind || '(missing)'}\n`);
    return 2;
  }
  const f = parseFlags(flagArgs);
  const repoRoot = (f.repo || process.cwd()) as string;
  const result = kind === 'ids'
    ? migrateIds({ repoRoot, dryRun: f['dry-run'] === true })
    : migrateTaskLayout({ repoRoot, dryRun: f['dry-run'] === true });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  // kind는 위에서 이미 걸렀다. 라이브러리 거절(dirty/collision)은 실행 실패(1).
  return result.ok ? 0 : 1;
}

module.exports = {
  init: {
    run: cmdInit,
    usage: `  init       Bootstrap .bouncer/ for this project. Never overwrites.
`,
  },
  'graph-sync': {
    run: cmdGraphSync,
    usage: `  graph-sync Rebuild stale graphify source + test + context graphs (SessionStart / plan).
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
  distill: {
    run: cmdDistill,
    usage: `  distill    --for <path> [--json]
             --all [--json] | --preflight [--json] | --route <path> | --audit [--json]
             Render routed Project Distill content or inspect its selection.
`,
  },
  migrate: {
    run: cmdMigrate,
    usage: `  migrate    ids [--dry-run]
             Plan or apply rename of legacy EPIC-/BP- context dirs to numeric ids.
             task-layout [--dry-run]
             Move legacy task files into tasks/<NNN>/ units.
`,
  },
};
