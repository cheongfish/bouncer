'use strict';

import cliUsage = require('./cli-usage');

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

function cmdCommit(rest: string[], io: CliIo) {
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { commitTask, commitExceptionResult } = require('./commit') as typeof import('./commit');
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
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { finalize } = require('./finalize') as typeof import('./finalize');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { prepareFinalizeDigest } = require('./finalize-digest') as typeof import('./finalize-digest');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { resolveExplainLinks } = require('./finalize-pr') as typeof import('./finalize-pr');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { releaseMain } = require('./finalize-release-main') as typeof import('./finalize-release-main');
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
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { catchMessage } = require('./guards') as typeof import('./guards');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { seedWorktree } = require('./seed-worktree') as typeof import('./seed-worktree');
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
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { planImport, applyImport } = require('./import-history') as typeof import('./import-history');
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
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { catchMessage } = require('./guards') as typeof import('./guards');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { executePrepare } = require('./execute-prepare') as typeof import('./execute-prepare');
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

/**
 * 전역 help는 static usage 표를 이용해 핸들러 선택 전에 출력 가능하게 한다.
 *
 * @returns {string} 전역 coordinate usage
 */
function coordinateRegistryUsage(): string {
  return cliUsage.COMMAND_USAGE.coordinate;
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
  if (command && COORDINATE_COMMANDS.includes(command as CoordinateCommand)) {
    io.err(cliUsage.coordinateUsage(command));
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
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { catchMessage } = require('./guards') as typeof import('./guards');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags } = require('./cli-flags') as typeof import('./cli-flags');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { coordinate } = require('./coordinator') as typeof import('./coordinator');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { reviseTaskScope } = require('./scope') as typeof import('./scope');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { compactCoordinateOutput } = require('./coordinate-output') as typeof import('./coordinate-output');
  // 1. 도움말은 잘못된 플래그보다 앞. 소스 역산 대신 --help를 보게 한다.
  if (argvRequestsHelp(rest)) {
    const helpTarget = rest[0];
    if (typeof helpTarget === 'string'
      && COORDINATE_COMMANDS.includes(helpTarget as CoordinateCommand)) {
      io.out(cliUsage.coordinateUsage(helpTarget));
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
      io.out(`${JSON.stringify({ ok: false, reason: 'ledger-checkpoint-invalid' })}\n`);
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
      io.out(`${JSON.stringify({ ok: false, reason: 'ledger-checkpoint-invalid' })}\n`);
      return 1;
    }
    const fenced = assertLedgerFence({
      ledgerPath, ledgerHash, ledgerBytes: loaded.bytes,
    });
    if (!fenced.ok) {
      io.out(`${JSON.stringify(fenced)}\n`);
      return 1;
    }
    const result = reviseTaskScope({
      repoRoot: reviseRoot,
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
      findings: collectFindingValues(rest.slice(1)),
      reviewFindings: collectReviewFindingValues(rest.slice(1)),
      kind: repairKind,
      done: repairDone,
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
    usage: cliUsage.COMMAND_USAGE["commit"],
  },
  finalize: {
    run: cmdFinalize,
    usage: cliUsage.COMMAND_USAGE["finalize"],
  },
  'seed-worktree': {
    run: cmdSeedWorktree,
    usage: cliUsage.COMMAND_USAGE["seed-worktree"],
  },
  execute: {
    run: cmdExecute,
    usage: cliUsage.COMMAND_USAGE["execute"],
  },
  coordinate: {
    run: cmdCoordinate,
    usage: cliUsage.COMMAND_USAGE["coordinate"],
  },
  import: {
    run: cmdImport,
    usage: cliUsage.COMMAND_USAGE["import"],
  },
};
