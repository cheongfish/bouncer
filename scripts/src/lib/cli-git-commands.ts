'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import finalizeMod = require('./finalize');
const { finalize } = finalizeMod;
import commit = require('./commit');
const { commitTask } = commit;
import seedWorktreeMod = require('./seed-worktree');
const { seedWorktree } = seedWorktreeMod;
import importHistory = require('./import-history');
const { planImport, applyImport } = importHistory;
import coordinatorMod = require('./coordinator');
const { coordinate } = coordinatorMod;
import scopeMod = require('./scope');
const { reviseTaskScope } = scopeMod;
import executePrepareMod = require('./execute-prepare');
const { executePrepare } = executePrepareMod;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

function catchMessage(error: unknown): string {
  // 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
  // TypeError 대신 빈 메시지가 되어 종료 코드 경로가 바뀐다.
  return (error as { message: string }).message;
}

function cmdCommit(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  // 커밋 대상이 없으면 commit-safety가 빈 범위를 검사하게 되므로 형식(2)으로 거절.
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('commit: --blueprint is required\n');
    return 2;
  }
  const result = commitTask({
    repoRoot: (f.repo || process.cwd()) as string,
    blueprintDir: f.blueprint,
    // === true: parseFlags가 값 없는 --yes만 boolean으로 둔다. `--yes 1` 같은
    // 문자열은 동의로 치지 않아 실수 커밋을 막는다.
    yes: f.yes === true,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  // 스코프 실패·훅 거절은 게이트 결과(1). 플래그는 이미 통과했으므로 2가 아니다.
  return result.ok ? 0 : 1;
}

function cmdFinalize(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  // commit과 같은 2: 대상 없이 --yes를 받으면 빈 스코프로 커밋을 시도한다.
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('finalize: --blueprint is required\n');
    return 2;
  }
  const result = finalize({
    repoRoot: (f.repo || process.cwd()) as string,
    blueprintDir: f.blueprint,
    // commit과 같은 동의 규칙. truthy 문자열을 통과시키면 dry-run 기본이 깨진다.
    yes: f.yes === true,
  });
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  // commit과 같은 0/1. remainder 실패도 사용법이 아니라 실행 결과다.
  return result.ok ? 0 : 1;
}

function cmdSeedWorktree(rest: string[], io: CliIo) {
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
      repoRoot: (f.repo || process.cwd()) as string,
      blueprintDir: f.blueprint,
      worktreePath: f.to,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    // git 실패 등 런타임. 플래그는 이미 통과했으므로 사용법(2)이 아니라 1.
    io.err(`seed-worktree: ${catchMessage(error)}\n`);
    return 1;
  }
}

function cmdImport(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  // `--repo`(boolean true)를 경로로 쓰지 않는다. 다른 명령의 `f.repo || cwd`와
  // 달리 여기만 문자열을 요구해 온 동작을 유지한다.
  const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
  const yes = f.yes === true;

  let limit: number | undefined;
  if (typeof f.limit === 'string' && f.limit !== '') {
    const n = Number(f.limit);
    // NaN/Infinity를 planImport에 넘기지 않는다. 깨진 --limit은 "무제한"과
    // 같게 두어 거절 대신 기본 계획으로 떨어지게 한다(기존 동작).
    if (Number.isFinite(n)) limit = n;
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

/**
 * 반복 `--paths`를 순서대로 모은다.
 *
 * parseFlags는 같은 플래그의 마지막 값만 남기므로(cli-flags.ts) 여러 번 준
 * 경로가 하나로 접힌다. cli-project-commands의 `--for`와 같은 방식으로 rest를
 * 직접 훑는다. 값이 없거나 다음 토큰이 또 다른 플래그면 건너뛴다 — 빈 문자열을
 * 경로로 넘기면 reviseTaskScope가 그것을 out-of-bounds로 바꿔 거절 코드가
 * `scope-paths-required`에서 갈라진다.
 */
function collectPathValues(rest: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] !== '--paths') continue;
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) continue;
    out.push(value);
    i += 1;
  }
  return out;
}

function cmdExecute(rest: string[], io: CliIo) {
  const command = rest[0];
  const f = parseFlags(rest.slice(1));
  // prepare만 공개한다. 다른 서브커맨드를 받으면 사용법(2) — 런타임 거절(1)과
  // 구분해, 없는 동사를 worktree 쓰기로 착각하지 않게 한다.
  if (command !== 'prepare') {
    io.err('execute: command must be prepare\n');
    return 2;
  }
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('execute: --blueprint is required\n');
    return 2;
  }
  try {
    const result = executePrepare({
      repoRoot: (f.repo || process.cwd()) as string,
      blueprintDir: f.blueprint,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    io.err(`execute prepare: ${catchMessage(error)}\n`);
    return 1;
  }
}

function cmdCoordinate(rest: string[], io: CliIo) {
  const command = rest[0];
  const f = parseFlags(rest.slice(1));
  const commands = [
    'bootstrap', 'prepare', 'ready', 'record', 'rerecord', 'integrate',
    'status', 'revise', 'repair', 'partial-close',
  ];
  if (!commands.includes(command)) {
    io.err(
      'coordinate: command must be bootstrap, prepare, ready, record, rerecord, '
      + 'integrate, status, revise, repair, or partial-close\n',
    );
    return 2;
  }
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('coordinate: --blueprint is required\n');
    return 2;
  }
  if (command === 'revise') {
    // scope 판정은 coordinator의 것이고 본체는 scope.reviseTaskScope 하나뿐이다.
    // 여기서는 인자만 모아 넘기고, 거절 코드는 그대로 옮긴다.
    // reviseTaskScope는 `repoRoot`를 write boundary로 쓴다(main checkout·미할당
    // worktree 거절). 그래서 `--repo`를 받아 넘기면 호출자가 자기 경계를 스스로
    // 고르게 되어 두 거절이 무력화된다 — 실제 cwd만 넘긴다.
    const result = reviseTaskScope({
      repoRoot: process.cwd(),
      blueprint: f.blueprint,
      task: typeof f.task === 'string' ? f.task : undefined,
      paths: collectPathValues(rest.slice(1)),
      reason: typeof f.reason === 'string' ? f.reason : undefined,
    }) as { ok: boolean; reason?: string; paths?: string[] };
    if (!result.ok) {
      // 거절은 stdout을 pipe-clean으로 두고 reason 코드만 stderr로 낸다.
      io.err(`coordinate revise: ${result.reason}\n`);
      return 1;
    }
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
  try {
    // --repo는 main checkout을 가리키고 cwd는 실제 write boundary 검증에 쓴다.
    const result = coordinate({
      command: command === 'ready' ? 'status' : command,
      repoRoot: (f.repo || process.cwd()) as string,
      blueprint: f.blueprint,
      cwd: process.cwd(),
      task: typeof f.task === 'string' ? f.task : undefined,
      sha: typeof f.sha === 'string' ? f.sha : undefined,
      decision: typeof (command === 'rerecord' ? f.reason : f.decision) === 'string'
        ? (command === 'rerecord' ? f.reason : f.decision) : undefined,
      failureCommand: typeof f['failure-command'] === 'string' ? f['failure-command'] : undefined,
      summary: typeof f.summary === 'string' ? f.summary : undefined,
      paths: collectPathValues(rest.slice(1)),
      userConfirmed: f['user-confirmed'] === true,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) { io.err(`coordinate: ${catchMessage(error)}\n`); return 1; }
}

export = {
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
  execute: {
    run: cmdExecute,
    usage: `  execute    prepare --blueprint <dir>
             Create or reuse the execute worktree, seed plan documents, and print JSON.
`,
  },
  coordinate: {
    run: cmdCoordinate,
    usage: '  coordinate <bootstrap|prepare|ready|record|rerecord|integrate|status> --blueprint <dir>\n'
      + '             [--task <ddd>] [--sha <sha>]\n'
      + '             Operate the coordinator ledger and isolated integration worktrees.\n'
      + '  coordinate rerecord --blueprint <dir> --task <ddd> --reason <text> [--sha <sha>]\n'
      + '             Replace a recorded worker SHA with its direct-child HEAD and preserve the decision.\n'
      + '  coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd>\n'
      + '             --summary <text> --paths <p> --decision <reason>\n'
      + '             Add one audited repair task and move the terminal CI dependency.\n'
      + '  coordinate partial-close --blueprint <dir> --user-confirmed\n'
      + '             Preserve the failed drive and mark it partial_closed after two repair waves.\n'
      + '  coordinate revise --blueprint <dir> --task <ddd> --paths <p> [--paths <p>]...\n'
      + '             --reason <text>\n'
      + '             Record one scope decision in the task document and ledger.\n'
      + '             Takes no --repo: the write boundary is the current directory, so\n'
      + '             run it from the assigned task worktree, not the main checkout.\n',
  },
  import: {
    run: cmdImport,
    usage: `  import     [--source merges|commits] [--since <ref>] [--limit <n>]
             [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]
             Transcribe git history into imported epic/blueprint documents.
`,
  },
};
