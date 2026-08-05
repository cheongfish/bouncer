'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { validateBlueprint } = require('./validate');
const { scaffoldEpic, scaffoldBlueprint, scaffoldExplain } = require('./scaffold');
const { finalize } = require('./finalize');
const { init } = require('./init');
const { readConfig, detectPhase, recommendMode } = require('./advisor');
const { runVerification } = require('./verification');
const { seedWorktree } = require('./seed-worktree');
const { nowIsoKst } = require('./time');
const { syncSessionGraphs } = require('./session-graph');
const { readCurrent, writeCurrent, clearCurrent, listReadyBlueprints } = require('./current');
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
    if (kind === 'epic') {
        created = scaffoldEpic({ repoRoot, epicId: f.id, name: f.name, timestamp });
    }
    else if (kind === 'blueprint') {
        created = scaffoldBlueprint({
            repoRoot, epicDir: f['epic-dir'], blueprintId: f.id, name: f.name, timestamp,
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
function cmdAdvise(rest, io) {
    const f = parseFlags(rest);
    const repoRoot = f.repo || process.cwd();
    const config = readConfig(repoRoot);
    const { phase, blueprint } = detectPhase({ repoRoot });
    const rec = recommendMode({ phase, config });
    io.out(`${JSON.stringify({ ok: true, ...rec, blueprint }, null, 2)}\n`);
    return 0;
}
function cmdGraphSync(rest, io) {
    const f = parseFlags(rest);
    const result = syncSessionGraphs({ repoRoot: f.repo || process.cwd() });
    io.out(`${JSON.stringify({ ok: result.failed.length === 0, ...result }, null, 2)}\n`);
    return result.failed.length === 0 ? 0 : 1;
}
function cmdCurrent(rest, io) {
    const f = parseFlags(rest);
    const wantsSet = Object.prototype.hasOwnProperty.call(f, 'set');
    const wantsClear = f.clear === true;
    if (wantsSet && wantsClear) {
        io.err('current: --set and --clear are mutually exclusive\n');
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
        let base = typeof f.base === 'string' ? f.base : undefined;
        if (!base) {
            const config = readConfig(repoRoot);
            base = (config && typeof config.base_branch === 'string' && config.base_branch)
                ? config.base_branch
                : 'develop';
        }
        writeCurrent({ repoRoot, blueprint: blueprintDir, base });
        const current = readCurrent({ repoRoot });
        io.out(`${JSON.stringify({ ok: true, current }, null, 2)}\n`);
        return 0;
    }
    // 없음도 오류가 아닌 상태: 항상 exit 0. unset이면 ready list를 붙여 execute가
    // "planned but unset"과 "nothing planned"를 구분하게 함.
    const current = readCurrent({ repoRoot });
    if (current) {
        io.out(`${JSON.stringify({ ok: true, current }, null, 2)}\n`);
    }
    else {
        const ready = listReadyBlueprints({ repoRoot });
        io.out(`${JSON.stringify({ ok: true, current: null, ready }, null, 2)}\n`);
    }
    return 0;
}
const USAGE = `usage: bouncer <command> [options]

  validate   --blueprint <dir> --gate <plan|execute|finalize>
             Run the structural checks and one gate. Reports failure codes.
  verify     --blueprint <dir>
             Run the configured verify command and record its evidence.
  scaffold   epic --id <EPIC-id> --name <slug>
             blueprint --epic-dir <dir> --id <BP-id> --name <slug>
             explain --blueprint <dir>
             Create a document set with correct frontmatter.
             (explain is for finalize; epic/blueprint scaffold omit it.)
  finalize   --blueprint <dir> [--yes]
             Check the commit scope and, with --yes, commit the blueprint.
  seed-worktree --blueprint <dir> --to <worktree>
             Move the plan context documents into a freshly created worktree.
  init       Bootstrap .bouncer/ for this project. Never overwrites.
  advise     Print the recommended Ponytail mode for the current phase.
  graph-sync Rebuild stale graphify source + context graphs (SessionStart / plan).
  current    [--set <blueprint dir> [--base <branch>]] [--clear]
             Show the active blueprint pointer, or set / clear it.

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
        case 'seed-worktree':
            return cmdSeedWorktree(rest, sink);
        case 'init':
            return cmdInit(rest, sink);
        case 'advise':
            return cmdAdvise(rest, sink);
        case 'graph-sync':
            return cmdGraphSync(rest, sink);
        case 'current':
            return cmdCurrent(rest, sink);
        default:
            err(`unknown command: ${cmd}\n\n${USAGE}`);
            return 2;
    }
}
module.exports = { runCli, parseFlags };
