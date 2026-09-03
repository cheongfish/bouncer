'use strict';
const cliFlags = require("./cli-flags");
const { parseFlags } = cliFlags;
const finalizeMod = require("./finalize");
const { finalize } = finalizeMod;
const commit = require("./commit");
const { commitTask } = commit;
const seedWorktreeMod = require("./seed-worktree");
const { seedWorktree } = seedWorktreeMod;
const importHistory = require("./import-history");
const { planImport, applyImport } = importHistory;
function catchMessage(error) {
    // 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
    // TypeError 대신 빈 메시지가 되어 종료 코드 경로가 바뀐다.
    return error.message;
}
function cmdCommit(rest, io) {
    const f = parseFlags(rest);
    // 커밋 대상이 없으면 commit-safety가 빈 범위를 검사하게 되므로 형식(2)으로 거절.
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('commit: --blueprint is required\n');
        return 2;
    }
    const result = commitTask({
        repoRoot: (f.repo || process.cwd()),
        blueprintDir: f.blueprint,
        // === true: parseFlags가 값 없는 --yes만 boolean으로 둔다. `--yes 1` 같은
        // 문자열은 동의로 치지 않아 실수 커밋을 막는다.
        yes: f.yes === true,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    // 스코프 실패·훅 거절은 게이트 결과(1). 플래그는 이미 통과했으므로 2가 아니다.
    return result.ok ? 0 : 1;
}
function cmdFinalize(rest, io) {
    const f = parseFlags(rest);
    // commit과 같은 2: 대상 없이 --yes를 받으면 빈 스코프로 커밋을 시도한다.
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
        io.err('finalize: --blueprint is required\n');
        return 2;
    }
    const result = finalize({
        repoRoot: (f.repo || process.cwd()),
        blueprintDir: f.blueprint,
        // commit과 같은 동의 규칙. truthy 문자열을 통과시키면 dry-run 기본이 깨진다.
        yes: f.yes === true,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    // commit과 같은 0/1. remainder 실패도 사용법이 아니라 실행 결과다.
    return result.ok ? 0 : 1;
}
function cmdSeedWorktree(rest, io) {
    const f = parseFlags(rest);
    // blueprint를 먼저 묻는다. help 나열 순서와 같고, 대상 없이 --to만 있으면
    // 빈 worktree로 문서를 옮기려다 실패 원인을 숨긴다.
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
            repoRoot: (f.repo || process.cwd()),
            blueprintDir: f.blueprint,
            worktreePath: f.to,
        });
        io.out(`${JSON.stringify(result, null, 2)}\n`);
        return result.ok ? 0 : 1;
    }
    catch (error) {
        // git 실패 등 런타임. 플래그는 이미 통과했으므로 사용법(2)이 아니라 1.
        io.err(`seed-worktree: ${catchMessage(error)}\n`);
        return 1;
    }
}
function cmdImport(rest, io) {
    const f = parseFlags(rest);
    // `--repo`(boolean true)를 경로로 쓰지 않는다. 다른 명령의 `f.repo || cwd`와
    // 달리 여기만 문자열을 요구해 온 동작을 유지한다.
    const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
    const yes = f.yes === true;
    let limit;
    if (typeof f.limit === 'string' && f.limit !== '') {
        const n = Number(f.limit);
        // NaN/Infinity를 planImport에 넘기지 않는다. 깨진 --limit은 "무제한"과
        // 같게 두어 거절 대신 기본 계획으로 떨어지게 한다(기존 동작).
        if (Number.isFinite(n))
            limit = n;
    }
    const plan = planImport({
        repoRoot,
        source: typeof f.source === 'string' ? f.source : undefined,
        since: typeof f.since === 'string' ? f.since : undefined,
        limit,
        epicId: typeof f['epic-id'] === 'string' ? f['epic-id'] : undefined,
        epicName: typeof f['epic-name'] === 'string' ? f['epic-name'] : undefined,
    });
    // --yes 없으면 dry-run. --message 만 있어도 무시하고 계획만 낸다.
    if (!yes) {
        io.out(`${JSON.stringify(plan, null, 2)}\n`);
        // 거절·한도 실패는 게이트 실패(1)가 아니라 호출 조건(2). apply도 같다.
        return plan.ok ? 0 : 2;
    }
    const result = applyImport({
        repoRoot,
        plan,
        message: typeof f.message === 'string' ? f.message : undefined,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 2;
}
module.exports = {
    commit: {
        run: cmdCommit,
        usage: `  commit     --blueprint <dir> [--yes]
             Check task commit scope and, with --yes, commit one task.
`,
    },
    finalize: {
        run: cmdFinalize,
        usage: `  finalize   --blueprint <dir> [--yes]
             Check the commit scope and, with --yes, commit the blueprint.
`,
    },
    'seed-worktree': {
        run: cmdSeedWorktree,
        usage: `  seed-worktree --blueprint <dir> --to <worktree>
             Move the plan context documents into a freshly created worktree.
`,
    },
    import: {
        run: cmdImport,
        usage: `  import     [--source merges|commits] [--since <ref>] [--limit <n>]
             [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]
             Transcribe git history into imported epic/blueprint documents.
`,
    },
};
