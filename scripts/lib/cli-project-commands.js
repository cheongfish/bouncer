'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { parseFlags } = require('./cli-flags');
const { init } = require('./init');
const { nowIsoKst } = require('./time');
const { syncSessionGraphs } = require('./session-graph');
const { resolveGraphifyBin } = require('./graphify');
const { migrateIds } = require('./migrate-ids');
const { migrateTaskLayout } = require('./migrate-task-layout');
const { runtimePaths } = require('./runtime-state');
const { readShards, routeShards, renderShards } = require('./distill');
const DISTILL_MODES = new Set(['for', 'all', 'route', 'audit']);
function parseDistillArgs(rest) {
    const targets = [];
    let mode = null;
    let repo;
    let json = false;
    const fail = (message) => ({ error: `distill: ${message}\n`, targets, mode, repo, json });
    for (let i = 0; i < rest.length; i += 1) {
        const token = rest[i];
        if (token === '--json') {
            json = true;
            continue;
        }
        if (token === '--repo') {
            const value = rest[++i];
            if (!value || value.startsWith('--'))
                return fail('--repo requires a directory');
            repo = value;
            continue;
        }
        if (token === '--for' || token === '--route') {
            const nextMode = token.slice(2);
            const value = rest[++i];
            if (!value || value.startsWith('--'))
                return fail(`${token} requires at least one path`);
            if (mode && mode !== nextMode)
                return fail('modes cannot be combined');
            mode = nextMode;
            targets.push(value);
            continue;
        }
        if (token === '--all' || token === '--audit') {
            const nextMode = token.slice(2);
            if (mode && mode !== nextMode)
                return fail('modes cannot be combined');
            mode = nextMode;
            continue;
        }
        if (token.startsWith('--'))
            return fail(`unknown option: ${token}`);
        return fail(`unexpected argument: ${token}`);
    }
    if (!mode || !DISTILL_MODES.has(mode))
        return fail('one of --for, --all, --route, or --audit is required');
    if ((mode === 'all' || mode === 'audit') && targets.length > 0) {
        return fail(`${mode} does not accept a path`);
    }
    return { targets, mode, repo, json };
}
function allDistillSelection(state, reason) {
    const shards = Array.isArray(state.shards) ? state.shards : [];
    return {
        full: true,
        reason,
        ids: Array.isArray(state.ids) ? state.ids : shards.map((shard) => shard.id),
        shards: shards.slice(),
    };
}
function distillPayload(state, selection, mode, targets) {
    const ids = Array.isArray(selection.ids) ? selection.ids : [];
    const shards = Array.isArray(state.shards) ? state.shards : [];
    return {
        mode,
        path: state.path,
        repoRoot: state.repoRoot,
        targetPaths: targets,
        routingEnabled: state.routingEnabled === true,
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
        },
    };
}
function cmdDistill(rest, io) {
    const parsed = parseDistillArgs(rest);
    if (parsed.error) {
        io.err(parsed.error);
        return 2;
    }
    const requestedRoot = parsed.repo || process.cwd();
    const paths = runtimePaths({ repoRoot: requestedRoot });
    if (paths.unavailable || !paths.projectRoot) {
        io.err(`distill: ${paths.reason || 'Bouncer requires a Git repository'}\n`);
        return 1;
    }
    const state = readShards({ repoRoot: paths.projectRoot, runtime: paths });
    const selection = parsed.mode === 'all' || parsed.mode === 'audit'
        ? allDistillSelection(state, 'forced-all')
        : routeShards({
            shards: state.shards,
            affectedPaths: parsed.targets,
            routingEnabled: state.routingEnabled,
            repoRoot: state.repoRoot,
        });
    const payload = distillPayload(state, selection, parsed.mode, parsed.targets);
    // 본문 모드는 기존 consumer가 그대로 pipe할 수 있어야 하므로 content만 쓴다.
    // route/audit은 선택 결과 자체가 목적이라 JSON을 고정해 사람이 읽고 도구도
    // 같은 출력을 파싱하게 한다. fail-open 진단은 본문과 섞지 않고 stderr로 보낸다.
    if ((parsed.mode === 'for' || parsed.mode === 'route') && selection.reason !== 'matched') {
        io.err(`distill: ${selection.reason}; using all shards\n`);
    }
    if (parsed.json || parsed.mode === 'route' || parsed.mode === 'audit') {
        io.out(`${JSON.stringify(payload, null, 2)}\n`);
    }
    else {
        io.out(payload.content);
    }
    return 0;
}
function cmdInit(rest, io) {
    const f = parseFlags(rest);
    const timestamp = typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst();
    // CLI 기본은 설치 on — 라이브러리 init() 기본(install:false)과 의도적으로 다르다.
    // 테스트·프로그래밍 호출이 네트워크 pip을 타지 않게 라이브러리는 opt-in.
    const install = f['no-graphify'] !== true;
    const result = init({
        repoRoot: f.repo || process.cwd(),
        timestamp,
        graphify: { install },
        promote: f['promote-graphify'] === true,
        writeGitignore: f['write-gitignore'] === true,
    });
    io.out(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    // created/skipped와 무관하게 result.ok만 본다. 부분 성공을 0으로 위장하지 않음.
    return result.ok ? 0 : 1;
}
function cmdGraphSync(rest, io) {
    const f = parseFlags(rest);
    const result = syncSessionGraphs({ repoRoot: f.repo || process.cwd() });
    // missing은 상태가 아니라 오류가 아니다(그래프 부재). failed만 종료 코드를 가른다.
    io.out(`${JSON.stringify({ ok: result.failed.length === 0, ...result }, null, 2)}\n`);
    return result.failed.length === 0 ? 0 : 1;
}
function cmdGraphifyBin(rest, io) {
    const f = parseFlags(rest);
    const repoRoot = f.repo || process.cwd();
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
function cmdProjectRoot(rest, io) {
    const f = parseFlags(rest);
    const repoRoot = f.repo || process.cwd();
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
function cmdMigrate(rest, io) {
    const [kind, ...flagArgs] = rest;
    // kind를 플래그보다 먼저 본다. 알 수 없는 kind에 --dry-run만 있어도
    // ids/task-layout 중 하나로 떨어지면 안 된다.
    if (kind !== 'ids' && kind !== 'task-layout') {
        io.err(`unknown migrate kind: ${kind || '(missing)'}\n`);
        return 2;
    }
    const f = parseFlags(flagArgs);
    const result = kind === 'ids'
        ? migrateIds({ repoRoot: f.repo || process.cwd(), dryRun: f['dry-run'] === true })
        : migrateTaskLayout({ repoRoot: f.repo || process.cwd(), dryRun: f['dry-run'] === true });
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
        usage: `  graph-sync Rebuild stale graphify source + context graphs (SessionStart / plan).
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
             --all [--json] | --route <path> | --audit [--json]
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
