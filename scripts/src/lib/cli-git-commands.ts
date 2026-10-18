'use strict';

import guards = require('./guards');
const { catchMessage } = guards;
import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
import finalizeMod = require('./finalize');
const { finalize } = finalizeMod;
import finalizeDigestMod = require('./finalize-digest');
const { prepareFinalizeDigest } = finalizeDigestMod;
import finalizePrMod = require('./finalize-pr');
const { resolveExplainLinks } = finalizePrMod;
import commit = require('./commit');
const { commitTask, commitExceptionResult } = commit;
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
import coordinateOutputMod = require('./coordinate-output');
const { compactCoordinateOutput } = coordinateOutputMod;
import releaseMainMod = require('./finalize-release-main');
const { releaseMain } = releaseMainMod;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

function cmdCommit(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  // 커밋 대상이 없으면 commit-safety가 빈 범위를 검사하게 되므로 형식(2)으로 거절.
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    io.err('commit: --blueprint is required\n');
    return 2;
  }
  let result;
  try {
    result = commitTask({
      repoRoot: (f.repo || process.cwd()) as string,
      blueprintDir: f.blueprint,
      // === true: parseFlags가 값 없는 --yes만 boolean으로 둔다. `--yes 1` 같은
      // 문자열은 동의로 치지 않아 실수 커밋을 막는다.
      yes: f.yes === true,
    });
  } catch (error) {
    // git commit hook 거절 등 모든 commitTask 예외를 stdout JSON 실패로 바꾼다.
    // 그렇지 않으면 stdout이 비어 advance가 unclear-result로 원인을 잃는다.
    // 플래그 오류는 위에서 이미 반환했고, 예외 종류와 무관하게 사용자에게
    // 보이는 결과가 같아야 하므로(report-and-stop) 구분 없이 흡수한다.
    // stage된 경로는 건드리지 않는다.
    const failure = commitExceptionResult(error);
    io.err(`commit: ${failure.cause}\n`);
    io.out(`${JSON.stringify(failure, null, 2)}\n`);
    return 1;
  }
  io.out(`${JSON.stringify(result, null, 2)}\n`);
  // 스코프 실패·훅 거절은 게이트 결과(1). 플래그는 이미 통과했으므로 2가 아니다.
  return result.ok ? 0 : 1;
}

/**
 * finalize 서브커맨드를 분기한다. release-main은 메인 정리라 --yes 커밋 경로와
 * 인자를 공유하면 닫힌 사본을 커밋 스코프로 오인하므로 앞 토큰으로만 가른다.
 *
 * @param {string[]} rest - `finalize` 다음 argv
 * @param {CliIo} io - stdout/stderr 콜백
 * @returns {number} 0 성공, 1 실행 거절, 2 사용법(`--blueprint` 누락)
 */
function cmdFinalize(rest: string[], io: CliIo) {
  // prepare는 읽기 전용 digest. 기존 finalize --yes 경로와 인자를 섞지 않는다.
  if (rest[0] === 'prepare') {
    const f = parseFlags(rest.slice(1));
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
      io.err('finalize: --blueprint is required\n');
      return 2;
    }
    // `--repo`(boolean true)를 경로로 쓰지 않는다. cmdImport와 같은 규칙 —
    // truthy 비문자열이 cwd 대신 들어가면 digest가 잘못된 checkout을 읽는다.
    const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
    const result = prepareFinalizeDigest({
      repoRoot,
      blueprintDir: f.blueprint,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  // release-main은 메인 checkout 전용 정리. finalize --yes(integration 커밋)와
  // 섞이면 닫힌 사본을 커밋 대상으로 오인하므로, prepare/links와 같이 앞 토큰으로 가른다.
  if (rest[0] === 'release-main') {
    const f = parseFlags(rest.slice(1));
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
      io.err('finalize: --blueprint is required\n');
      return 2;
    }
    // `--repo`(boolean true)를 경로로 쓰지 않는다. prepare와 같은 규칙 —
    // truthy 비문자열이 cwd 대신 들어가면 메인 판정이 잘못된 checkout을 본다.
    const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
    const result = releaseMain({
      repoRoot,
      cwd: process.cwd(),
      blueprintDir: f.blueprint,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  // links는 push 뒤 Explain URL 후보만 돌려 준다. digest·task 문서를 읽지
  // 않으므로 --yes 뒤에도 동작하고, 실패는 ok:true + reason으로만 알린다.
  if (rest[0] === 'links') {
    const f = parseFlags(rest.slice(1));
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
      io.err('finalize: --blueprint is required\n');
      return 2;
    }
    const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
    const result = resolveExplainLinks({
      repoRoot,
      blueprintDir: f.blueprint,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
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
function collectPathValues(rest: string[], flag = '--paths'): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] !== flag) continue;
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) continue;
    out.push(value);
    i += 1;
  }
  return out;
}

/**
 * `--findings`도 반복 플래그라 parseFlags의 마지막 값 보존을 우회한다.
 *
 * 값이 없는 occurrence도 빈 문자열로 남긴다. 유효한 다른 finding만 모으면 한 번의
 * malformed flag가 성공 요청에 섞여 ledger write까지 통과하므로, coordinator의
 * findings-required 검사가 요청 전체를 원자적으로 거절할 수 있게 한다.
 */
function collectFindingValues(rest: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] !== '--findings') continue;
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) {
      out.push('');
      continue;
    }
    out.push(value);
    i += 1;
  }
  return out;
}

/**
 * 반복 `--review-finding`을 순서대로 모은다.
 * parseFlags는 마지막 값만 남겨 두 번째 finding이 사라지므로 rest를 직접 훑는다.
 * 플래그가 한 번도 없으면 undefined를 돌려 CI 원인 repair와 구분한다. 값이 빈
 * 문자열이거나 빠진 occurrence는 ''로 남겨 coordinator가
 * `failure-evidence-required`로 원자 거절하게 한다.
 *
 * @param {string[]} rest - coordinate 서브커맨드 뒤 argv
 * @returns {string[] | undefined} 등장 순서의 finding id, 없으면 undefined
 */
function collectReviewFindingValues(rest: string[]): string[] | undefined {
  const out: string[] = [];
  let seen = false;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] !== '--review-finding') continue;
    seen = true;
    const value = rest[i + 1];
    if (value === undefined || (value.startsWith('--') && value !== '')) {
      out.push('');
      continue;
    }
    out.push(value);
    i += 1;
  }
  return seen ? out : undefined;
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

const COORDINATE_COMMANDS = [
  'bootstrap', 'prepare', 'ready', 'dispatch', 'report', 'record', 'rerecord', 'integrate',
  'status', 'revise', 'repair', 'partial-close', 'critical-recovery', 'revoke', 'next', 'advance',
  'promote-stop', 'session-open', 'worker-model', 'worker-tokens',
] as const;

type CoordinateCommand = (typeof COORDINATE_COMMANDS)[number];

type CoordinateUsageBlock = {
  // 전역 `bouncer --help`에만 이어 붙인다. bootstrap·prepare·ready·status는
  // 예전 overview 한 덩어리에만 있어서 여기 없으면 전역 바이트가 늘어난다.
  registry?: string;
  help: string;
};

const COORDINATE_USAGE_OVERVIEW = '  coordinate <bootstrap|prepare|ready|dispatch|report|record|rerecord'
  + '|integrate|status|revoke> --blueprint <dir>\n'
  + '             [--task <ddd>] [--sha <sha>] [--lease-id <id>] [--generation <n>]\n'
  + '             Operate the coordinator ledger and isolated integration worktrees.\n';

const COORDINATE_USAGE_MUTATIONS =
  '  Mutations (except bootstrap/status) require --ledger-path and --ledger-hash from\n'
  + '  the latest status checkpoint so stale ledger writes are rejected before mutation.\n';

// fence 값은 status checkpoint.ledger다. usage에 path/hash를 반복해
// coordinator가 plugin 소스를 열어 형식을 역산하지 않게 한다.
const COORDINATE_FENCE = '--ledger-path <path> --ledger-hash <sha256>';
const COORDINATE_FENCE_NOTE = `${COORDINATE_FENCE} (from coordinate status checkpoint.ledger)`;

/**
 * 서브커맨드 → usage 블록 맵. 핸들러 `--help`와 registry `usage`가 같은 맵을
 * 읽어 문구가 갈라지지 않게 한다. registry 문자열은 이어 붙여 예전과 같아야
 * 전역 help 바이트 테스트가 유지된다.
 */
const COORDINATE_USAGE_BLOCKS: Record<CoordinateCommand, CoordinateUsageBlock> = {
  bootstrap: {
    help: `usage: bouncer coordinate bootstrap
  --blueprint <dir> [--repo <dir>] [--promote-light]
  Seed the integration worktree and ledger. Not ledger-fenced.
  --promote-light archives a promotion_stopped light ledger and starts a full ledger.
`,
  },
  prepare: {
    help: `usage: bouncer coordinate prepare
  --blueprint <dir> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Create or reuse assigned worker worktrees and refresh leases.
`,
  },
  ready: {
    help: `usage: bouncer coordinate ready
  --blueprint <dir> [--repo <dir>]
  Alias of coordinate status. Prints the checkpoint; not ledger-fenced.
`,
  },
  dispatch: {
    registry: '  coordinate dispatch --blueprint <dir> --task <ddd> --ledger-path <path> --ledger-hash <sha256>\n'
      + '             [--repo <main>] [--lease-id <id> --generation <n>] [--model <value>]\n'
      + '             Open one dispatch attempt on the assigned worker and return brief/HEAD metadata.\n',
    help: `usage: bouncer coordinate dispatch
  --blueprint <dir> --task <ddd> ${COORDINATE_FENCE_NOTE}
  [--repo <main>] [--lease-id <id>] [--generation <n>] [--model <value>]
  Open one dispatch attempt on the assigned worker and return brief/HEAD metadata.
  --model records the dispatch model argument (\`bouncer subagent-model\` output) on the ledger.
`,
  },
  report: {
    registry: '  coordinate report --blueprint <dir> --task <ddd> --attempt <n>\n'
      + '             --task-brief-hash <sha256> --outcome <accepted|rework|scope_revision|task_change|blocked>\n'
      + '             --summary <text> --ledger-path <path> --ledger-hash <sha256> [--repo <main>]\n'
      + '             [--lease-id <id> --generation <n>]\n'
      + '             Record a worker report against the active attempt, or append stale-report evidence.\n',
    help: `usage: bouncer coordinate report
  --blueprint <dir> --task <ddd> --attempt <n> --task-brief-hash <sha256>
  --outcome <accepted|rework|scope_revision|task_change|blocked> --summary <text>
  ${COORDINATE_FENCE_NOTE} [--repo <main>] [--lease-id <id>] [--generation <n>]
  Record a worker report against the active attempt, or append stale-report evidence.
  \`--outcome accepted\` is refused (ledger unchanged) until the worker task commit exists, its commit_sha
  stamp matches HEAD, and no file inside the approved scope is dirty: worker-commit-missing,
  worker-commit-stamp-mismatch, worker-scope-dirty. Run \`coordinate advance\` to commit first.
`,
  },
  record: {
    help: `usage: bouncer coordinate record
  --blueprint <dir> --task <ddd> ${COORDINATE_FENCE_NOTE}
  [--sha <sha>] [--repo <dir>] [--lease-id <id>] [--generation <n>]
  Record the worker HEAD after an accepted report. Refused with worker-commit-missing,
  worker-commit-stamp-mismatch, or worker-scope-dirty (ledger unchanged) unless the worker task commit
  and its commit_sha stamp match HEAD and the approved scope is clean; run \`coordinate advance\` first.
`,
  },
  rerecord: {
    registry: '  coordinate rerecord --blueprint <dir> --task <ddd> --reason <text>\n'
      + '             --ledger-path <path> --ledger-hash <sha256> [--sha <sha>]\n'
      + '             Replace a recorded worker SHA with its direct-child HEAD and preserve the decision.\n',
    help: `usage: bouncer coordinate rerecord
  --blueprint <dir> --task <ddd> --reason <text> ${COORDINATE_FENCE_NOTE} [--sha <sha>] [--repo <dir>]
  Replace a recorded worker SHA with its direct-child HEAD and preserve the decision.
`,
  },
  integrate: {
    registry: '  coordinate integrate --blueprint <dir> [--task <ddd>]\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Fan-in recorded commit tasks via a candidate worktree (omit --task for the wave).\n',
    help: `usage: bouncer coordinate integrate
  --blueprint <dir> [--task <ddd>] ${COORDINATE_FENCE_NOTE}
  [--sha <sha>] [--repo <dir>] [--lease-id <id>] [--generation <n>]
  Fan-in recorded commit tasks via a candidate worktree (omit --task for the wave).
`,
  },
  status: {
    help: `usage: bouncer coordinate status
  --blueprint <dir> [--repo <dir>] [--write-input <file>]
  Print the checkpoint (including checkpoint.ledger). Not ledger-fenced.
  --write-input writes the coordinator print-dispatch input text to <file>
  (status only; reports input_file) for \`dispatch print --role coordinator --input\`.
`,
  },
  revise: {
    registry: '  coordinate revise --blueprint <dir> --task <ddd> --paths <p> [--paths <p>]... [--new-path <p>]...\n'
      + '             --reason <text> --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Record one scope decision in the task document and ledger.\n'
      + '             --paths replaces the whole scope with exactly the given set.\n'
      + '             --paths must be tracked at integration HEAD; --new-path adds a file to\n'
      + '             create (its parent directory must be tracked).\n'
      + '             Takes no --repo: the write boundary is the current directory, so\n'
      + '             run it from the assigned task worktree, not the main checkout.\n',
    help: `usage: bouncer coordinate revise
  --blueprint <dir> --task <ddd> --paths <p> [--paths <p>]... [--new-path <p>]... --reason <text>
  ${COORDINATE_FENCE_NOTE}
  Record one scope decision in the task document and ledger.
  --paths replaces the whole scope with exactly the given set; pass every path
  the task still needs, not only new ones (dropped paths are reported as warnings).
  --paths entries must be tracked at integration HEAD (scope-path-untracked otherwise).
  --new-path <p> adds a file to be created; its parent directory must be tracked
  (scope-new-path-parent-missing otherwise). Final scope is --paths plus --new-path.
  Takes no --repo: the write boundary is the current directory, so
  run it from the assigned task worktree, not the main checkout.
`,
  },
  repair: {
    registry: '  coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd>\n'
      + '             --summary <text> --paths <p> --decision <reason>\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Add one audited repair task and move the terminal CI dependency.\n'
      + '             [--verify <argv>] [--new-path <p>]...  (--verify is required on scoped_terminal:\n'
      + '             one command that checks only the failing files; --paths must be tracked files)\n'
      + '  coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> --summary <text>\n'
      + '             --paths <p> --decision <reason> --resume-task <ddd>\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Rework an existing integrated task inside its approved scope (no new task).\n'
      + '  coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd> --summary <text>\n'
      + '             --paths <p> --decision <reason> --disposition outside_scope\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Record a proven outside-scope terminal failure; the failure itself stays failed.\n'
      + '  coordinate repair --blueprint <dir> [--task <ddd>] --review-finding <id>\n'
      + '             [--review-finding <id>]... --summary <text> --paths <p> --decision <reason>\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Open a repair task from final-review must_fix findings (omit --task\n'
      + '             when the blueprint has no terminal verification).\n'
      + '  coordinate repair --blueprint <dir> --kind supplement --review-finding <id>\n'
      + '             [--review-finding <id>]... --summary <text> --paths <test-path>\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Accept an in-scope test-evidence gap in place (no new task or wave).\n'
      + '  coordinate repair --blueprint <dir> --kind supplement --done --summary <text>\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Verify the finished supplement; then run the one delta review.\n',
    help: `usage: bouncer coordinate repair
  --blueprint <dir> --task <ddd> --failure-command <cmd> --summary <text>
  --paths <p> --decision <reason> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Add one audited repair task and move the terminal CI dependency.
  [--verify <argv>] [--new-path <p>]...: --verify is the repair task's own single command
  (required on scoped_terminal blueprints; must not be the terminal command or chain shell
  operators). --paths must be tracked at integration HEAD; --new-path adds a file to create
  whose parent directory is tracked. --verify cannot be used with --resume-task.
  --blueprint <dir> --task <ddd> --failure-command <cmd> --summary <text>
  --paths <p> --decision <reason> --resume-task <ddd> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Rework an existing integrated task inside its approved scope: no new task, DAG unchanged.
  --blueprint <dir> --task <ddd> --failure-command <cmd> --summary <text>
  --paths <p> --decision <reason> --disposition outside_scope ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Record a proven outside-scope terminal failure (cause, failing test and needed change judged outside
  every task scope). The failure stays failed; --resume-task and --disposition are mutually exclusive.
  --blueprint <dir> [--task <ddd>] --review-finding <id> [--review-finding <id>]...
  --summary <text> --paths <p> --decision <reason> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Open a repair task from final-review must_fix findings (omit --task
  when the blueprint has no terminal verification).
  --kind <product|supplement> (default product, the forms above)
  --blueprint <dir> --kind supplement --review-finding <id> [--review-finding <id>]...
  --summary <text> --paths <test-path> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Accept an in-scope test-evidence gap in place: no new task, no repair wave.
  --blueprint <dir> --kind supplement --done --summary <text> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Verify the finished supplement; the next final review is the one delta round.
  Product-behavior fixes, new dependencies, and public interfaces are not supplements.
`,
  },
  'partial-close': {
    registry: '  coordinate partial-close --blueprint <dir> --user-confirmed\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Preserve the failed drive and mark it partial_closed after two repair waves.\n',
    help: `usage: bouncer coordinate partial-close
  --blueprint <dir> --user-confirmed ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Preserve the failed drive and mark it partial_closed after two repair waves.
`,
  },
  'critical-recovery': {
    registry: '  coordinate critical-recovery --blueprint <dir> --task <ddd> --findings <id>\n'
      + '             [--findings <id>]... --reason <text>\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Record the one permitted blocker or major recovery for a prepared task.\n'
      + '  coordinate critical-recovery --blueprint <dir> --task <ddd> --outcome <resolved|blocked>\n'
      + '             --reason <text> --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Record the outcome without permitting another recovery.\n',
    help: `usage: bouncer coordinate critical-recovery
  --blueprint <dir> --task <ddd> --findings <id> [--findings <id>]... --reason <text>
  ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Record the one permitted blocker or major recovery for a prepared task.
  --blueprint <dir> --task <ddd> --outcome <resolved|blocked> --reason <text>
  ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Record the outcome without permitting another recovery.
`,
  },
  revoke: {
    registry: '  coordinate revoke --blueprint <dir> --task <ddd> --reason <text>\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Revoke an active lease, clear dispatch/sha, and return the task to pending.\n',
    help: `usage: bouncer coordinate revoke
  --blueprint <dir> --task <ddd> --reason <text> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Revoke an active lease, clear dispatch/sha, and return the task to pending.
`,
  },
  next: {
    registry: '  coordinate next --blueprint <dir> [--task <ddd>] [--repo <dir>]\n'
      + '             Print the next coordinator action and filled argv without mutating the ledger.\n',
    help: `usage: bouncer coordinate next
  --blueprint <dir> [--task <ddd>] [--repo <dir>]
  Read-only. Ignores --ledger-path and --ledger-hash if given (not ledger-fenced).
  Blueprint actions: prepare, yield, drive_tasks, integrate, verification_node, supplement, final_review, done, blocked
  Task actions: dispatch, implement, verify, review, commit, report, record, revise, none, blocked
  Response fields: action, cwd, argv, judge, task_ids, payload, card, checkpoint
  card {id,body} only on: dispatch, implement, verify, review, report, revise, record, supplement, final_review, blocked
`,
  },
  advance: {
    registry: '  coordinate advance --blueprint <dir> [--task <ddd>] [--max-steps <n>] [--repo <dir>]\n'
      + '             Run deterministic next argv actions until judge, worker, terminal, or error.\n',
    help: `usage: bouncer coordinate advance
  --blueprint <dir> [--task <ddd>] [--max-steps <n>] [--repo <dir>]
  Not ledger-fenced. Calls coordinate next and runs argv for prepare, integrate,
  verification_node, verify, and commit until a stop or failure.
  Stop reasons (ok: true): judge, worker, blocked, done, none, max-steps, yield
  Failure reasons (ok: false): repeated-failure, unclear-result, advance-argv-invalid,
  or the automatic action's failure reason.
  Response fields: executed, stop.next (success) or reason, cause, next, executed (failure)
`,
  },
  'session-open': {
    registry: '  coordinate session-open --blueprint <dir> --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Record a coordinator session boundary before dispatching a new coordinator.\n',
    help: `usage: bouncer coordinate session-open
  --blueprint <dir> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Run by the root before dispatching a coordinator session. Appends a session decision
  (opened_at, integration_head, waves_cap) so coordinate next can count this session's waves.
  Refused without changing the ledger on a light, promotion_stopped, partial_closed, or
  awaiting_confirmation ledger.
`,
  },
  'worker-model': {
    registry: '  coordinate worker-model --blueprint <dir> --role <implementer|reviewer|debugger> --model <value>\n'
      + '             --ledger-path <path> --ledger-hash <sha256> [--task <ddd>] [--perspective <name>]\n'
      + '             [--tokens <n>]\n'
      + '             Record the model argument (and host-reported tokens) of a worker dispatch.\n',
    help: `usage: bouncer coordinate worker-model
  --blueprint <dir> --role <implementer|reviewer|debugger> --model <value> ${COORDINATE_FENCE_NOTE}
  [--task <ddd>] [--perspective <name>] [--tokens <n>] [--repo <dir>]
  Run from the integration worktree. Appends a worker-model decision (role, model, task,
  perspective, tokens) to the ledger; --task also appends it to that task. The model is the one-line
  \`bouncer subagent-model --agent <name>\` output (slug or inherit); it records what the
  coordinator passed, not proof of what the host ran. --perspective is reviewer-only.
  --tokens is the host-reported subagent token count (non-negative integer); omit it when the
  completion notice has not arrived, then add it later with coordinate worker-tokens.
  Does not change dispatch, lease, status, or attempt state.
`,
  },
  'worker-tokens': {
    registry: '  coordinate worker-tokens --blueprint <dir> --role <implementer|reviewer|debugger> --tokens <n>\n'
      + '             --ledger-path <path> --ledger-hash <sha256> [--task <ddd>] [--perspective <name>]\n'
      + '             Append host-reported subagent tokens that arrived after the worker-model record.\n',
    help: `usage: bouncer coordinate worker-tokens
  --blueprint <dir> --role <implementer|reviewer|debugger> --tokens <n> ${COORDINATE_FENCE_NOTE}
  [--task <ddd>] [--perspective <name>] [--repo <dir>]
  Run from the integration worktree. Appends a worker-tokens decision (role, tokens, task,
  perspective) to the ledger; --task also appends it to that task. Use it when the host's
  completion notice arrives after the worker-model record. \`metrics summary\` adds it to
  worker_tokens, never to the coordinator-session total. --perspective is reviewer-only.
  Does not change dispatch, lease, status, or attempt state.
`,
  },
  'promote-stop': {
    registry: '  coordinate promote-stop --blueprint <dir> --reason <enum> --summary <text>\n'
      + '             --ledger-path <path> --ledger-hash <sha256>\n'
      + '             Stop a light ledger for promotion; records reason and state (no resume).\n',
    help: `usage: bouncer coordinate promote-stop
  --blueprint <dir> --reason <security-risk|out-of-scope|task-split|interface-semantics|reviewer-wider-scope>
  --summary <text> ${COORDINATE_FENCE_NOTE} [--repo <dir>]
  Record promotion_stopped on a light ledger with the open task's diff and evidence ids.
  Same reason+summary is idempotent; other mutations then fail with promotion-stopped.
`,
  },
};

// 전역 help 조립 순서. 키를 빼거나 재정렬하면 전역 usage 바이트가 바뀐다.
const COORDINATE_REGISTRY_ORDER: CoordinateCommand[] = [
  'integrate', 'dispatch', 'report', 'revoke', 'rerecord', 'repair',
  'partial-close', 'critical-recovery', 'revise', 'next', 'advance', 'promote-stop',
  'session-open', 'worker-model', 'worker-tokens',
];

/**
 * 전역·`coordinate --help`에 쓰는 registry usage. 맵의 registry 조각을
 * 예전 순서로 이어 붙여 바이트를 고정한다.
 *
 * @returns {string} 예전 coordinate.usage와 같은 문자열
 */
function coordinateRegistryUsage(): string {
  return COORDINATE_USAGE_OVERVIEW
    + COORDINATE_REGISTRY_ORDER.map((name) => COORDINATE_USAGE_BLOCKS[name].registry || '').join('')
    + COORDINATE_USAGE_MUTATIONS;
}

/**
 * 서브커맨드 도움말 여부. parseFlags는 `--help` 뒤 값을 먹고 `-h`를 무시하므로
 * 원시 토큰을 본다. `--reason -h`처럼 직전이 `--` 플래그면 `-h`는 값이다.
 *
 * @param {string[]} tokens - `coordinate` 뒤 원시 argv
 * @returns {boolean} 도움말을 내면 true
 */
function argvRequestsHelp(tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok === '--help') return true;
    if (tok === '-h') {
      const prev = i > 0 ? tokens[i - 1] : undefined;
      if (prev === undefined || !prev.startsWith('--')) return true;
    }
  }
  return false;
}

/**
 * usage(2) 한 줄 뒤에 같은 stderr로 블록을 붙인다. 알 수 없는 서브커맨드는
 * 전체 registry usage, 알면 그 서브커맨드 `--help` 블록이다.
 *
 * @param {CliIo} io - stderr 싱크
 * @param {string} message - 첫 줄(개행 포함)
 * @param {string} [command] - 알려진 서브커맨드. 없으면 전체 usage
 * @returns {2} usage 종료 코드
 */
function failCoordinateUsage(io: CliIo, message: string, command?: string): 2 {
  io.err(message);
  if (command && Object.prototype.hasOwnProperty.call(COORDINATE_USAGE_BLOCKS, command)) {
    io.err(COORDINATE_USAGE_BLOCKS[command as CoordinateCommand].help);
  } else {
    io.err(coordinateRegistryUsage());
  }
  return 2;
}

/**
 * status 성공 뒤 coordinator print 입력 파일을 쓴다. 값은 원장(`base`)과
 * main worktree 설정(autonomy)에서 모은다 — lib status는 읽기 전용으로 두려고
 * 파일 쓰기를 CLI 계층에 둔다. 부모 디렉터리가 없으면 만든다.
 *
 * @param {object} args - 쓰기 입력
 * @param {string} args.file - 출력 경로. 상대 경로는 cwd 기준
 * @param {string} args.repoRoot - status에 쓴 저장소 루트
 * @param {string} args.blueprint - blueprint 디렉터리
 * @param {Record<string, unknown>} args.checkpoint - status가 돌려준 checkpoint
 * @returns {string} 쓴 파일의 절대 경로
 */
function writeCoordinatorInput(args: {
  file: string; repoRoot: string; blueprint: string; checkpoint: Record<string, unknown>;
}): string {
  const fs = require('node:fs') as typeof import('node:fs');
  const nodePath = require('node:path') as typeof import('node:path');
  const { coordinatorPathsFor, runtimePaths } = require('./runtime-state');
  const { loadLedgerBytes } = require('./coordinator');
  const { readAutonomy } = require('./run-preflight');
  const { buildCoordinatorInput } = require('./coordinator-input');
  const paths = coordinatorPathsFor({ repoRoot: args.repoRoot, blueprint: args.blueprint });
  const loaded = loadLedgerBytes(paths.ledgerFile);
  if (!loaded) throw new Error('ledger missing while writing coordinator input');
  // autonomy 설정은 gitignore라 main checkout에만 있다. integration cwd가 아니라
  // git common dir 부모(projectRoot)에서 읽는다.
  const { projectRoot } = runtimePaths({ repoRoot: args.repoRoot });
  const text = buildCoordinatorInput({
    integrationPath: paths.integrationPath,
    blueprint: args.blueprint,
    base: loaded.ledger.base,
    checkpoint: args.checkpoint,
    autonomy: readAutonomy(projectRoot).value,
    projectRoot,
  });
  const target = nodePath.resolve(process.cwd(), args.file);
  fs.mkdirSync(nodePath.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  return target;
}

/**
 * coordinate 서브커맨드를 CLI 경계에서 해석한다.
 * `--help`/`-h`는 인자·fence·core보다 먼저 stdout으로 끝내고, 허용 목록 밖
 * 이름은 core에 넘기지 않고 usage(2)로 끝낸다 — JSON 거절은 알려진 명령의
 * 런타임 실패에만 쓴다. `next`의 값 없는 `--task`는 생략이 아니라 usage(2)다.
 *
 * @param {string[]} rest - `coordinate` 뒤 argv
 * @param {CliIo} io - stdout/stderr
 * @returns {number} 성공 0, 런타임 거절 1, usage 오류 2
 */
function cmdCoordinate(rest: string[], io: CliIo) {
  // 1. 도움말은 잘못된 플래그보다 앞. 소스 역산 대신 --help를 보게 한다.
  if (argvRequestsHelp(rest)) {
    const helpTarget = rest[0];
    if (typeof helpTarget === 'string'
      && Object.prototype.hasOwnProperty.call(COORDINATE_USAGE_BLOCKS, helpTarget)) {
      io.out(COORDINATE_USAGE_BLOCKS[helpTarget as CoordinateCommand].help);
    } else {
      io.out(coordinateRegistryUsage());
    }
    return 0;
  }
  const command = rest[0];
  const f = parseFlags(rest.slice(1));
  const commands = COORDINATE_COMMANDS as readonly string[];
  // bootstrap·status(ready 별칭)만 원장 fence 예외. 그 외 mutation은 path/hash 쌍이
  // 있어야 stale checkpoint로 원장·Git이 갈라지는 쓰기를 막는다.
  const fencedCommands = new Set([
    'prepare', 'dispatch', 'report', 'record', 'rerecord', 'integrate', 'revise',
    'repair', 'partial-close', 'critical-recovery', 'revoke', 'promote-stop', 'session-open',
    'worker-model', 'worker-tokens',
  ]);
  if (!commands.includes(command)) {
    return failCoordinateUsage(
      io,
      'coordinate: command must be bootstrap, prepare, ready, dispatch, report, record, rerecord, '
      + 'integrate, status, revise, repair, partial-close, critical-recovery, revoke, next, '
      + 'advance, promote-stop, session-open, worker-model, or worker-tokens\n',
    );
  }
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    return failCoordinateUsage(io, 'coordinate: --blueprint is required\n', command);
  }
  // --write-input은 status 전용이다. 값 없는 플래그(true)와 다른 서브커맨드(ready 별칭
  // 포함)는 파일을 쓰기 전에 usage(2)로 거절해 조용히 무시되지 않게 한다.
  const hasWriteInput = Object.prototype.hasOwnProperty.call(f, 'write-input');
  if (hasWriteInput && (command !== 'status' || typeof f['write-input'] !== 'string'
    || f['write-input'] === '')) {
    return failCoordinateUsage(
      io, 'coordinate: --write-input <file> is accepted by status only and needs a value\n', command,
    );
  }
  const ledgerPath = typeof f['ledger-path'] === 'string' ? f['ledger-path'] : undefined;
  const ledgerHash = typeof f['ledger-hash'] === 'string' ? f['ledger-hash'] : undefined;
  // worker-model은 fence 플래그 누락을 다른 fenced 명령과 달리 usage(2)로 막는다
  // (task 002 Interface: --role·--model·fence 플래그 누락은 core 호출 전 exit 2).
  if ((command === 'worker-model' || command === 'worker-tokens') && (ledgerPath === undefined || ledgerPath === ''
    || ledgerHash === undefined || ledgerHash === '')) {
    return failCoordinateUsage(
      io, `coordinate ${command}: --ledger-path and --ledger-hash are required\n`, command,
    );
  }
  if (fencedCommands.has(command)) {
    // Interface: 누락은 usage(2)가 아니라 다른 coordinate 거절과 같은 JSON reason + exit 1.
    // argv 문법 오류와 stale/invalid fence를 같은 채널로 모아 자동화 클라이언트가 파싱한다.
    if (ledgerPath === undefined || ledgerPath === ''
      || ledgerHash === undefined || ledgerHash === '') {
      // 다른 coordinate 거절과 같이 hint 표를 거쳐 cause·next를 붙인다.
      io.out(`${JSON.stringify(coordinatorMod.withCoordinateFailureHints({ ok: false, reason: 'ledger-checkpoint-invalid' }))}\n`);
      return 1;
    }
  }
  // --generation은 양의 정수만. abc·0은 usage(2) — core의 lease-required와 구분한다.
  let generation: number | undefined;
  if (Object.prototype.hasOwnProperty.call(f, 'generation')) {
    const raw = f.generation;
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) {
      return failCoordinateUsage(io, 'coordinate: --generation must be a positive integer\n', command);
    }
    generation = Number(raw);
  }
  const leaseId = typeof f['lease-id'] === 'string' ? f['lease-id'] : undefined;
  if (command === 'report') {
    // report metadata는 core가 다시 검사하지만, 필수 flag 부재는 usage(2)로
    // 돌려 argv 누락과 stale mismatch(1)를 구분한다.
    if (typeof f.attempt !== 'string' || f.attempt === '') {
      return failCoordinateUsage(io, 'coordinate report: --attempt is required\n', command);
    }
    if (typeof f['task-brief-hash'] !== 'string' || f['task-brief-hash'] === '') {
      return failCoordinateUsage(io, 'coordinate report: --task-brief-hash is required\n', command);
    }
    if (typeof f.outcome !== 'string' || f.outcome === '') {
      return failCoordinateUsage(io, 'coordinate report: --outcome is required\n', command);
    }
    if (typeof f.summary !== 'string' || f.summary === '') {
      return failCoordinateUsage(io, 'coordinate report: --summary is required\n', command);
    }
  }
  // --kind/--done은 repair 전용이다. 값이 잘못되면 core로 넘기지 않고 usage(2)로 끝내
  // 오타가 조용히 기존 wave 소모 경로(product)로 접히지 않게 한다.
  let repairKind: string | undefined;
  let repairDone = false;
  if (command === 'repair') {
    if (Object.prototype.hasOwnProperty.call(f, 'kind')) {
      if (f.kind !== 'product' && f.kind !== 'supplement') {
        return failCoordinateUsage(
          io, 'coordinate repair: --kind must be product or supplement\n', command,
        );
      }
      repairKind = f.kind;
    }
    if (Object.prototype.hasOwnProperty.call(f, 'done')) {
      if (f.done !== true || repairKind !== 'supplement') {
        return failCoordinateUsage(
          io, 'coordinate repair: --done is a flag accepted only with --kind supplement\n', command,
        );
      }
      repairDone = true;
    }
    // --resume-task/--disposition은 값이 필요하다. 값 없는 플래그(true)나 둘의 동시 입력이 조용히
    // 기존 dynamic repair 경로로 접히면 새 task가 생기므로 core에 보내기 전에 usage(2)로 끝낸다.
    for (const name of ['resume-task', 'disposition']) {
      if (Object.prototype.hasOwnProperty.call(f, name)
        && (typeof f[name] !== 'string' || f[name] === '')) {
        return failCoordinateUsage(io, `coordinate repair: --${name} requires a value\n`, command);
      }
    }
    // --verify는 새 repair task 문서에 쓸 단일 argv다. 값 없는 플래그가 조용히
    // 생략으로 접히면 scoped_terminal 거절이 엉뚱한 사유로 보이므로 usage(2)로 끝낸다.
    // --resume-task는 기존 task를 되살릴 뿐 새 verify를 쓰지 않아 함께 쓸 수 없다.
    if (Object.prototype.hasOwnProperty.call(f, 'verify')
      && (typeof f.verify !== 'string' || f.verify.trim() === '')) {
      return failCoordinateUsage(io, 'coordinate repair: --verify requires a value\n', command);
    }
    if (Object.prototype.hasOwnProperty.call(f, 'verify')
      && Object.prototype.hasOwnProperty.call(f, 'resume-task')) {
      return failCoordinateUsage(
        io, 'coordinate repair: --verify cannot be combined with --resume-task\n', command,
      );
    }
    if (Object.prototype.hasOwnProperty.call(f, 'resume-task')
      && Object.prototype.hasOwnProperty.call(f, 'disposition')) {
      return failCoordinateUsage(
        io, 'coordinate repair: --resume-task and --disposition are mutually exclusive\n', command,
      );
    }
  }
  // --new-path는 반복 플래그라 값 없는 occurrence가 유효한 다른 값 뒤에 숨을 수 있다.
  // 발생 횟수와 수집된 값 수가 다르면 조용히 버리지 않고 usage(2)로 끝낸다.
  if ((command === 'repair' || command === 'revise')
    && rest.slice(1).filter((tok) => tok === '--new-path').length
      !== collectPathValues(rest.slice(1), '--new-path').length) {
    return failCoordinateUsage(io, `coordinate ${command}: --new-path requires a value\n`, command);
  }
  if (command === 'worker-model' || command === 'worker-tokens') {
    // 플래그 자체가 없는 경우만 usage(2). 값 없는 --model(true)은 core가 model-invalid(1)로 거절한다.
    if (typeof f.role !== 'string' || f.role === '') {
      return failCoordinateUsage(io, `coordinate ${command}: --role is required\n`, command);
    }
    if (command === 'worker-model' && !Object.prototype.hasOwnProperty.call(f, 'model')) {
      return failCoordinateUsage(io, 'coordinate worker-model: --model is required\n', command);
    }
    // --tokens는 worker-tokens에서 필수, worker-model에서 선택이다. 있는데 값이 없으면
    // 조용히 누락으로 접히지 않게 usage(2)로 막는다. 값 형식은 core가 tokens-invalid(1)로 거절한다.
    if (command === 'worker-tokens' && !Object.prototype.hasOwnProperty.call(f, 'tokens')) {
      return failCoordinateUsage(io, 'coordinate worker-tokens: --tokens is required\n', command);
    }
    // 값 없는 --task·--perspective(true)를 undefined로 접으면 task·관점 없는 decision이
    // 조용히 기록된다. 누락과 달리 "있으나 값 없음"이므로 usage(2)로 막는다.
    for (const name of ['task', 'perspective', 'tokens']) {
      if (Object.prototype.hasOwnProperty.call(f, name)
        && (typeof f[name] !== 'string' || f[name] === '')) {
        return failCoordinateUsage(
          io, `coordinate ${command}: --${name} requires a value\n`, command,
        );
      }
    }
  }
  if (command === 'revoke') {
    if (typeof f.task !== 'string' || f.task === '') {
      return failCoordinateUsage(io, 'coordinate revoke: --task is required\n', command);
    }
    if (typeof f.reason !== 'string' || f.reason === '') {
      return failCoordinateUsage(io, 'coordinate revoke: --reason is required\n', command);
    }
  }
  if (command === 'promote-stop') {
    // 빈 summary·reason은 usage(2). enum 밖 reason은 core가 promote-reason-invalid(1).
    // CT-003: whitespace-only는 core summary-required(1)로 가지 않게 trim 후 검사 —
    // Interface empty-summary와 CLI usage 채널을 맞춘다.
    if (typeof f.reason !== 'string' || f.reason === '') {
      return failCoordinateUsage(io, 'coordinate promote-stop: --reason is required\n', command);
    }
    if (typeof f.summary !== 'string' || f.summary.trim() === '') {
      return failCoordinateUsage(io, 'coordinate promote-stop: --summary is required\n', command);
    }
  }
  if (command === 'revise') {
    // scope 판정은 coordinator의 것이고 본체는 scope.reviseTaskScope 하나뿐이다.
    // 여기서는 인자만 모아 넘기고, 거절 코드는 그대로 옮긴다.
    // reviseTaskScope는 `repoRoot`를 write boundary로 쓴다(main checkout·미할당
    // worktree 거절). 그래서 `--repo`를 받아 넘기면 호출자가 자기 경계를 스스로
    // 고르게 되어 두 거절이 무력화된다 — 실제 cwd만 넘긴다.
    // fence도 같은 cwd 원장에 묶는다. `--repo` 원장을 검사하면 다른 checkout의
    // hash로 통과한 뒤 cwd 원장을 쓰는 불일치가 생긴다.
    const { coordinatorPathsFor } = require('./runtime-state');
    const { assertLedgerFence, projectCheckpoint, loadLedgerBytes } = require('./coordinator');
    const reviseRoot = process.cwd();
    const paths = coordinatorPathsFor({
      repoRoot: reviseRoot,
      blueprint: f.blueprint,
    });
    // load bytes → fence → (이후 revise가 같은 경로를 씀). 디스크를 두 번 읽어
    // hash와 변조 대상이 어긋나지 않게 한 snapshot만 검사한다.
    const loaded = loadLedgerBytes(paths.ledgerFile);
    if (!loaded) {
      io.out(`${JSON.stringify(coordinatorMod.withCoordinateFailureHints({ ok: false, reason: 'ledger-checkpoint-invalid' }))}\n`);
      return 1;
    }
    const fenced = assertLedgerFence({
      ledgerPath, ledgerHash, ledgerBytes: loaded.bytes,
    });
    if (!fenced.ok) {
      io.out(`${JSON.stringify(coordinatorMod.withCoordinateFailureHints(fenced))}\n`);
      return 1;
    }
    const result = reviseTaskScope({
      repoRoot: reviseRoot,
      blueprint: f.blueprint,
      task: typeof f.task === 'string' ? f.task : undefined,
      paths: collectPathValues(rest.slice(1)),
      newPaths: collectPathValues(rest.slice(1), '--new-path'),
      reason: typeof f.reason === 'string' ? f.reason : undefined,
    }) as { ok: boolean; reason?: string; paths?: string[] };
    if (!result.ok) {
      // 거절도 다른 coordinate 명령처럼 hint를 거친 stdout JSON(reason·paths·cause·next)으로
      // 낸다. coordinator가 stderr 문자열을 파싱하지 않고 다음 행동을 고르게 하려는 것이다.
      // stderr의 reason 한 줄은 사람이 읽는 기존 신호라 그대로 둔다.
      io.out(`${JSON.stringify(coordinatorMod.withCoordinateFailureHints(result))}\n`);
      io.err(`coordinate revise: ${result.reason}\n`);
      return 1;
    }
    // 성공 시 다음 fencing token이 될 checkpoint를 돌려 status→revise 루프를 잇는다.
    const after = loadLedgerBytes(paths.ledgerFile);
    const payload = after
      ? { ...result, checkpoint: projectCheckpoint(after.ledger, paths.ledgerFile, after.bytes) }
      : result;
    io.out(`${JSON.stringify(payload)}\n`);
    return 0;
  }
  if (command === 'next') {
    // next는 status처럼 읽기만 한다. fence 플래그가 와도 요구·검증하지 않아
    // mutation 집합과 혼동되지 않게 한다.
    // parseFlags는 값 없는 --task를 boolean true로 둔다. 그걸 undefined로
    // 접으면 blueprint next가 열려 잘못된 task 범위가 된다.
    if (Object.prototype.hasOwnProperty.call(f, 'task')
      && (typeof f.task !== 'string' || f.task === '')) {
      return failCoordinateUsage(
        io, 'coordinate next: --task requires a ddd value\n', command,
      );
    }
    const { coordinateNext } = require('./coordinate-next') as typeof import('./coordinate-next');
    try {
      const result = coordinateNext({
        repoRoot: (f.repo || process.cwd()) as string,
        blueprint: f.blueprint,
        cwd: process.cwd(),
        task: typeof f.task === 'string' ? f.task : undefined,
      }) as { ok: boolean };
      io.out(`${JSON.stringify(compactCoordinateOutput(command, result as Record<string, unknown>))}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      io.err(`coordinate: ${catchMessage(error)}\n`);
      return 1;
    }
  }
  if (command === 'advance') {
    // advance도 fence를 요구하지 않는다. 원장 쓰기는 next가 준 argv 명령이 맡는다.
    if (Object.prototype.hasOwnProperty.call(f, 'task')
      && (typeof f.task !== 'string' || f.task === '')) {
      return failCoordinateUsage(
        io, 'coordinate advance: --task requires a ddd value\n', command,
      );
    }
    let maxSteps: number | undefined;
    if (Object.prototype.hasOwnProperty.call(f, 'max-steps')) {
      const raw = f['max-steps'];
      // generation과 같이 양의 정수만. 0·음수·문자는 usage(2).
      if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) {
        return failCoordinateUsage(
          io, 'coordinate advance: --max-steps must be a positive integer\n', command,
        );
      }
      maxSteps = Number(raw);
    }
    const { advance } = require('./coordinate-advance') as typeof import('./coordinate-advance');
    try {
      const result = advance({
        repoRoot: (f.repo || process.cwd()) as string,
        blueprint: f.blueprint,
        task: typeof f.task === 'string' ? f.task : undefined,
        maxSteps,
      }) as { ok: boolean };
      io.out(`${JSON.stringify(compactCoordinateOutput(command, result as Record<string, unknown>))}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      io.err(`coordinate: ${catchMessage(error)}\n`);
      return 1;
    }
  }
  try {
    // --repo는 main checkout을 가리키고 cwd는 실제 write boundary 검증에 쓴다.
    const attemptRaw = typeof f.attempt === 'string' ? f.attempt : undefined;
    const attemptNum = attemptRaw !== undefined && /^\d+$/.test(attemptRaw)
      ? Number(attemptRaw) : undefined;
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
      newPaths: collectPathValues(rest.slice(1), '--new-path'),
      verify: typeof f.verify === 'string' ? f.verify : undefined,
      findings: collectFindingValues(rest.slice(1)),
      reviewFindings: collectReviewFindingValues(rest.slice(1)),
      kind: repairKind,
      done: repairDone,
      resumeTask: typeof f['resume-task'] === 'string' ? f['resume-task'] : undefined,
      disposition: typeof f.disposition === 'string' ? f.disposition : undefined,
      outcome: typeof f.outcome === 'string' ? f.outcome : undefined,
      reason: typeof f.reason === 'string' ? f.reason : undefined,
      attempt: attemptNum,
      // 값 없는 --model(parseFlags가 true)은 ''로 넘겨 core가 model-invalid로 거절하게 한다.
      // 플래그가 없으면 undefined라 기록하지 않는다.
      model: Object.prototype.hasOwnProperty.call(f, 'model')
        ? (typeof f.model === 'string' ? f.model : '') : undefined,
      role: typeof f.role === 'string' ? f.role : undefined,
      perspective: typeof f.perspective === 'string' ? f.perspective : undefined,
      tokens: typeof f.tokens === 'string' ? f.tokens : undefined,
      taskBriefHash: typeof f['task-brief-hash'] === 'string' ? f['task-brief-hash'] : undefined,
      leaseId,
      generation,
      ledgerPath,
      ledgerHash,
      userConfirmed: f['user-confirmed'] === true,
      promoteLight: f['promote-light'] === true,
    }) as { ok: boolean };
    const compact = compactCoordinateOutput(command, result as Record<string, unknown>) as Record<string, unknown>;
    if (result.ok && hasWriteInput) {
      // status가 모든 검사를 통과한 뒤에만 쓴다. 쓰기 오류는 아래 catch가
      // `coordinate: <msg>` exit 1로 옮기고, 이 시점에는 stdout이 비어 있다.
      compact.input_file = writeCoordinatorInput({
        file: f['write-input'] as string,
        repoRoot: (f.repo || process.cwd()) as string,
        blueprint: f.blueprint,
        checkpoint: (result as unknown as { checkpoint: Record<string, unknown> }).checkpoint,
      });
    }
    io.out(`${JSON.stringify(compact)}\n`);
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
    usage: `  finalize   prepare --blueprint <dir>
             Print a read-only finalize digest JSON for Explain, Quiz, and PR.
  finalize   links --blueprint <dir>
             Print Explain URL candidates for a pushed GitHub head (read-only).
  finalize   release-main --blueprint <dir>
             Run from the main checkout after finalize --yes; removes the closed blueprint's main plan copies.
  finalize   --blueprint <dir> [--yes]
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
    usage: coordinateRegistryUsage(),
  },
  import: {
    run: cmdImport,
    usage: `  import     [--source merges|commits] [--since <ref>] [--limit <n>]
             [--epic-id <ddd>] [--epic-name <slug>] [--yes --message <msg>]
             Transcribe git history into imported epic/blueprint documents.
`,
  },
};
