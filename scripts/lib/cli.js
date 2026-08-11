'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { validateBlueprint } = require('./validate');
const { scaffoldEpic, scaffoldBlueprint, scaffoldExplain, scaffoldTask } = require('./scaffold');
const { isNumericContextId } = require('./paths');
const { finalize } = require('./finalize');
const { commitTask } = require('./commit');
const { init } = require('./init');
const { runVerification } = require('./verification');
const { seedWorktree } = require('./seed-worktree');
const { nowIsoKst } = require('./time');
const { syncSessionGraphs } = require('./session-graph');
const { resolveGraphifyBin } = require('./graphify');
const { readCurrent, writeCurrent, clearCurrent, listReadyBlueprints, resolvePointerTask, presentCurrent, } = require('./current');
const { migrateIds } = require('./migrate-ids');
const { migrateTaskLayout } = require('./migrate-task-layout');
const fs = require('node:fs');
const path = require('node:path');
// cmdCurrent --set이 base_branch를 읽을 때만 쓴다. 없거나 깨진 config는
// {}로 삼켜 inherit/기본값을 유지한다. subagents에 동형 헬퍼가 있으나
// export되지 않아 여기 로컬로 둔다.
function readConfig(repoRoot) {
    try {
        return JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer/config.json'), 'utf8'));
    }
    catch (_e) {
        return {};
    }
}
function parseFlags(rest) {
    const flags = {};
    for (let i = 0; i < rest.length; i += 1) {
        const tok = rest[i];
        if (!tok.startsWith('--'))
            continue;
        const key = tok.slice(2);
        const next = rest[i + 1];
        if (next === undefined || next.startsWith('--')) {
            flags[key] = true;
        }
        else {
            flags[key] = next;
            i += 1;
        }
    }
    return flags;
}
function cmdValidate(rest, io) {
    const f = parseFlags(rest);
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('validate: --blueprint is required\n');
        return 2;
    }
    const repoRoot = f.repo || process.cwd();
    const gate = typeof f.gate === 'string' ? f.gate : undefined;
    const result = validateBlueprint({
        repoRoot,
        blueprintDir: f.blueprint,
        gate,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
}
function cmdVerify(rest, io) {
    const f = parseFlags(rest);
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('verify: --blueprint is required\n');
        return 2;
    }
    try {
        const result = runVerification({
            repoRoot: f.repo || process.cwd(),
            blueprintDir: f.blueprint,
        });
        io.out(`${JSON.stringify(result, null, 2)}\n`);
        return result.ok ? 0 : 1;
    }
    catch (error) {
        io.err(`verify: ${error.message}\n`);
        return 1;
    }
}
function cmdScaffold(rest, io) {
    const [kind, ...flagArgs] = rest;
    const f = parseFlags(flagArgs);
    const repoRoot = f.repo || process.cwd();
    const timestamp = typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst();
    let created;
    try {
        if (kind === 'epic' || kind === 'blueprint') {
            // EPIC-001 / 1 / 01 거절 — 정본은 zero-pad 세 자리만. 라이브러리 throw와 메시지를 맞춤.
            if (!isNumericContextId(f.id)) {
                io.err(`scaffold: --id must be a zero-padded three-digit id (\\d{3}), got ${JSON.stringify(f.id)}\n`);
                return 2;
            }
            if (typeof f.name !== 'string' || f.name === '') {
                io.err(`scaffold ${kind}: --name is required\n`);
                return 2;
            }
        }
        if (kind === 'epic') {
            created = scaffoldEpic({ repoRoot, epicId: f.id, name: f.name, timestamp });
        }
        else if (kind === 'blueprint') {
            if (typeof f['epic-dir'] !== 'string' || f['epic-dir'] === '') {
                io.err('scaffold blueprint: --epic-dir is required\n');
                return 2;
            }
            created = scaffoldBlueprint({
                repoRoot, epicDir: f['epic-dir'], blueprintId: f.id, name: f.name, timestamp,
            });
        }
        else if (kind === 'task') {
            // --blueprint / --id 누락은 형식 오류보다 먼저 안내한다.
            if (typeof f.blueprint !== 'string' || f.blueprint === '') {
                io.err('scaffold task: --blueprint is required\n');
                return 2;
            }
            if (typeof f.id !== 'string' || f.id === '') {
                io.err('scaffold task: --id is required\n');
                return 2;
            }
            if (!isNumericContextId(f.id)) {
                io.err(`scaffold: --id must be a zero-padded three-digit id (\\d{3}), got ${JSON.stringify(f.id)}\n`);
                return 2;
            }
            created = scaffoldTask({
                repoRoot, blueprintDir: f.blueprint, taskId: f.id, timestamp,
            });
        }
        else if (kind === 'explain') {
            if (typeof f.blueprint !== 'string' || f.blueprint === '') {
                io.err('scaffold explain: --blueprint is required\n');
                return 2;
            }
            created = scaffoldExplain({ repoRoot, blueprintDir: f.blueprint, timestamp });
        }
        else {
            io.err(`unknown scaffold kind: ${kind}\n`);
            return 2;
        }
    }
    catch (error) {
        io.err(`scaffold: ${error.message}\n`);
        return 2;
    }
    io.out(`${JSON.stringify({ ok: true, created }, null, 2)}\n`);
    return 0;
}
function cmdFinalize(rest, io) {
    const f = parseFlags(rest);
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('finalize: --blueprint is required\n');
        return 2;
    }
    const result = finalize({
        repoRoot: f.repo || process.cwd(),
        blueprintDir: f.blueprint,
        yes: f.yes === true,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
}
function cmdCommit(rest, io) {
    const f = parseFlags(rest);
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('commit: --blueprint is required\n');
        return 2;
    }
    const result = commitTask({
        repoRoot: f.repo || process.cwd(),
        blueprintDir: f.blueprint,
        yes: f.yes === true,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
}
function cmdSeedWorktree(rest, io) {
    const f = parseFlags(rest);
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('seed-worktree: --blueprint is required\n');
        return 2;
    }
    if (typeof f.to !== 'string' || f.to === '') {
        io.err('seed-worktree: --to is required\n');
        return 2;
    }
    try {
        // --repo(기본 cwd)는 plan 문서가 있는 base checkout;
        // --to는 committed HEAD에서 막 만든 worktree.
        const result = seedWorktree({
            repoRoot: f.repo || process.cwd(),
            blueprintDir: f.blueprint,
            worktreePath: f.to,
        });
        io.out(`${JSON.stringify(result, null, 2)}\n`);
        return result.ok ? 0 : 1;
    }
    catch (error) {
        io.err(`seed-worktree: ${error.message}\n`);
        return 1;
    }
}
function cmdInit(rest, io) {
    const f = parseFlags(rest);
    const timestamp = typeof f.timestamp === 'string' ? f.timestamp : nowIsoKst();
    const result = init({ repoRoot: f.repo || process.cwd(), timestamp });
    io.out(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    return result.ok ? 0 : 1;
}
function cmdGraphSync(rest, io) {
    const f = parseFlags(rest);
    const result = syncSessionGraphs({ repoRoot: f.repo || process.cwd() });
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
        return 1;
    }
    io.out(`${bin}\n`);
    return 0;
}
function cmdMigrate(rest, io) {
    const [kind, ...flagArgs] = rest;
    if (kind !== 'ids' && kind !== 'task-layout') {
        io.err(`unknown migrate kind: ${kind || '(missing)'}\n`);
        return 2;
    }
    const f = parseFlags(flagArgs);
    const result = kind === 'ids'
        ? migrateIds({ repoRoot: f.repo || process.cwd(), dryRun: f['dry-run'] === true })
        : migrateTaskLayout({ repoRoot: f.repo || process.cwd(), dryRun: f['dry-run'] === true });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
}
function cmdCurrent(rest, io) {
    const f = parseFlags(rest);
    const wantsSet = Object.prototype.hasOwnProperty.call(f, 'set');
    const wantsClear = f.clear === true;
    const wantsTask = Object.prototype.hasOwnProperty.call(f, 'task');
    if (wantsSet && wantsClear) {
        io.err('current: --set and --clear are mutually exclusive\n');
        return 2;
    }
    if (wantsClear && wantsTask) {
        io.err('current: --clear and --task are mutually exclusive\n');
        return 2;
    }
    if (wantsTask && !wantsSet) {
        io.err('current: --task requires --set\n');
        return 2;
    }
    if (wantsSet && (typeof f.set !== 'string' || f.set === '')) {
        io.err('current: --set requires a blueprint directory\n');
        return 2;
    }
    const repoRoot = f.repo || process.cwd();
    if (wantsClear) {
        clearCurrent({ repoRoot });
        io.out(`${JSON.stringify({ ok: true, current: null }, null, 2)}\n`);
        return 0;
    }
    if (wantsSet) {
        const blueprintDir = f.set;
        const result = validateBlueprint({
            repoRoot,
            blueprintDir,
            gate: 'plan',
        });
        if (!result.ok) {
            // failures를 그대로 전달 — plan gate가 권위; 실패한 brief에는 pointer를
            // 쓰지 않음.
            io.out(`${JSON.stringify({ ok: false, failures: result.failures }, null, 2)}\n`);
            return 1;
        }
        // plan 통과 뒤에만 task 해석·포인터 기록. 해석 실패는 사용법 오류(2).
        const taskSpec = wantsTask ? f.task : undefined;
        if (wantsTask && (typeof taskSpec !== 'string' || taskSpec === '')) {
            io.err('current: --task requires a task id (NNN or TASKS-NNN)\n');
            return 2;
        }
        const resolved = resolvePointerTask({
            repoRoot,
            blueprintDir,
            task: typeof taskSpec === 'string' ? taskSpec : undefined,
        });
        if (!resolved.ok) {
            const ids = (resolved.available || [])
                .map((t) => t.id)
                .filter(Boolean)
                .join(', ');
            io.err(`current: cannot resolve --task ${JSON.stringify(taskSpec)}`
                + (ids ? ` (available: ${ids})` : '')
                + '\n');
            return 2;
        }
        let base = typeof f.base === 'string' ? f.base : undefined;
        if (!base) {
            const config = readConfig(repoRoot);
            base = (config && typeof config.base_branch === 'string' && config.base_branch)
                ? config.base_branch
                : 'develop';
        }
        writeCurrent({
            repoRoot,
            blueprint: blueprintDir,
            base,
            task: resolved.task || undefined,
        });
        // 포인터 파일은 path 문자열; 응답 JSON 은 path+id (presentCurrent).
        const current = presentCurrent(readCurrent({ repoRoot }), { repoRoot });
        io.out(`${JSON.stringify({ ok: true, current }, null, 2)}\n`);
        return 0;
    }
    // 없음도 오류가 아닌 상태: 항상 exit 0. unset이면 ready list를 붙여 execute가
    // "planned but unset"과 "nothing planned"를 구분하게 함.
    const stored = readCurrent({ repoRoot });
    if (stored) {
        const current = presentCurrent(stored, { repoRoot });
        io.out(`${JSON.stringify({ ok: true, current }, null, 2)}\n`);
    }
    else {
        const ready = listReadyBlueprints({ repoRoot });
        io.out(`${JSON.stringify({ ok: true, current: null, ready }, null, 2)}\n`);
    }
    return 0;
}
const USAGE = `usage: bouncer <command> [options]

  validate   --blueprint <dir> --gate <plan|execute|commit|finalize>
             Run the structural checks and one gate. Reports failure codes.
  verify     --blueprint <dir>
             Run the configured verify command and record its evidence.
  scaffold   epic --id <ddd> --name <slug>
             blueprint --epic-dir <dir> --id <ddd> --name <slug>
             task --blueprint <dir> --id <ddd>
             explain --blueprint <dir>
             Create a document set with correct frontmatter.
             (explain is for finalize; epic/blueprint scaffold omit it.)
  commit     --blueprint <dir> [--yes]
             Check task commit scope and, with --yes, commit one task.
  finalize   --blueprint <dir> [--yes]
             Check the commit scope and, with --yes, commit the blueprint.
  seed-worktree --blueprint <dir> --to <worktree>
             Move the plan context documents into a freshly created worktree.
  init       Bootstrap .bouncer/ for this project. Never overwrites.
  graph-sync Rebuild stale graphify source + context graphs (SessionStart / plan).
  graphify-bin
             Print the resolved graphify executable path (one line).
  current    [--set <blueprint dir> [--base <branch>] [--task <NNN|TASKS-NNN>]]
             [--clear]
             Show the active blueprint pointer, or set / clear it.
             --task picks a task doc; without it, first ready/in_progress wins.
  migrate    ids [--dry-run]
             Plan or apply rename of legacy EPIC-/BP- context dirs to numeric ids.
             task-layout [--dry-run]
             Move legacy task files into tasks/<NNN>/ units.

Every command accepts --repo <dir> to run against another repository.
`;
function runCli(argv, io) {
    const out = io && io.out ? io.out : (s) => process.stdout.write(s);
    const err = io && io.err ? io.err : (s) => process.stderr.write(s);
    const sink = { out, err };
    const [cmd, ...rest] = argv;
    if (cmd === undefined || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        out(USAGE);
        return 0;
    }
    switch (cmd) {
        case 'validate':
            return cmdValidate(rest, sink);
        case 'verify':
            return cmdVerify(rest, sink);
        case 'scaffold':
            return cmdScaffold(rest, sink);
        case 'finalize':
            return cmdFinalize(rest, sink);
        case 'commit':
            return cmdCommit(rest, sink);
        case 'seed-worktree':
            return cmdSeedWorktree(rest, sink);
        case 'init':
            return cmdInit(rest, sink);
        case 'graph-sync':
            return cmdGraphSync(rest, sink);
        case 'graphify-bin':
            return cmdGraphifyBin(rest, sink);
        case 'current':
            return cmdCurrent(rest, sink);
        case 'migrate':
            return cmdMigrate(rest, sink);
        default:
            err(`unknown command: ${cmd}\n\n${USAGE}`);
            return 2;
    }
}
module.exports = { runCli, parseFlags };
