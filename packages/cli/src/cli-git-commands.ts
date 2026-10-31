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
  const { resolveExplainLinks, renderPrBody } = require('./finalize-pr') as typeof import('./finalize-pr');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { releaseMain } = require('./finalize-release-main') as typeof import('./finalize-release-main');
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { recordComprehension } = require('./finalize-comprehension') as typeof import('./finalize-comprehension');
  // worktree-path는 문서가 내부 모듈(runtime-state)을 require하지 않도록 두는 읽기 전용 조회다.
  // 파일·pointer·worktree를 만들지 않으며, 앞 토큰으로 가르지 않으면 기존 finalize 경로로 흘러
  // blueprint 문서를 요구한다.
  if (rest[0] === 'worktree-path') {
    const f = parseFlags(rest.slice(1));
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
      io.err('usage: bouncer finalize worktree-path --blueprint <dir> [--repo <dir>]\n');
      return 2;
    }
    // `--repo`(boolean true)를 경로로 쓰지 않는다. 다른 서브커맨드와 같은 규칙.
    const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
    const { worktreePathFor } = require('./runtime-state') as typeof import('./runtime-state');
    try {
      io.out(`${worktreePathFor({ repoRoot, blueprint: f.blueprint })}\n`);
      return 0;
    } catch (error) {
      // worktreePathFor는 blueprint id 파싱 실패·git 부재에서만 던지고 쓰기가 없다.
      // 두 경우 모두 사용자에게 보일 결과가 같은 거절(1)이라 메시지를 그대로 전한다.
      io.err(`finalize worktree-path: ${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
  }
  // diff-sha는 explain.md의 diff_sha를 구할 때 쓰는 읽기 전용 조회다. computeDiffSha는 throw하지
  // 않고 닫힌 reason 집합을 돌려주므로 결과를 그대로 JSON 한 줄로 낸다.
  if (rest[0] === 'diff-sha') {
    const f = parseFlags(rest.slice(1));
    if (typeof f.base !== 'string' || f.base === '') {
      io.err('usage: bouncer finalize diff-sha --base <ref> [--repo <dir>]\n');
      return 2;
    }
    const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
    const { computeDiffSha } = require('./comprehension') as typeof import('./comprehension');
    const result = computeDiffSha({ repoRoot, base: f.base });
    io.out(`${JSON.stringify(result)}\n`);
    return result.ok ? 0 : 1;
  }
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
  // pr-body는 저장한 digest와 요약 파일만 읽어 stdout에 Markdown을 낸다. 원장·Git·task 문서를
  // 읽거나 파일을 쓰지 않아 정리 뒤에도 같은 입력이 같은 출력을 낸다.
  if (rest[0] === 'pr-body') {
    const f = parseFlags(rest.slice(1));
    if (typeof f.digest !== 'string' || f.digest === '') {
      io.err('finalize: --digest is required\n');
      return 2;
    }
    if (typeof f.summary !== 'string' || f.summary === '') {
      io.err('finalize: --summary is required\n');
      return 2;
    }
    // --flow는 선택이지만 값 없이 주어지면 사용법 오류다(조용히 무시하면 흐름이 빠진 채 통과한다).
    if (f.flow !== undefined && (typeof f.flow !== 'string' || f.flow === '')) {
      io.err('finalize: --flow requires a file\n');
      return 2;
    }
    const fs = require('node:fs') as typeof import('node:fs');
    try {
      const digest = JSON.parse(fs.readFileSync(f.digest, 'utf8'));
      const summary = fs.readFileSync(f.summary, 'utf8');
      const flow = typeof f.flow === 'string' ? fs.readFileSync(f.flow, 'utf8') : undefined;
      io.out(renderPrBody({ digest, summary, flow }));
      return 0;
    } catch (error) {
      // 파일 읽기·JSON 파싱·입력 검증 실패는 모두 사용자 입력 문제이며 같은 형식으로 거절한다.
      // 쓰기가 없어 어느 경우든 남는 상태가 없으므로 구분 없이 흡수해도 안전하다.
      io.err(`finalize pr-body: ${(error as { message?: string }).message || String(error)}\n`);
      return 1;
    }
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
      allowPartialMerge: f['allow-partial-merge'] === true,
      confirmPartialMerge: f['confirm-partial-merge'] === true,
    });
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  // comprehension은 사용자 quiz 확인 뒤 explain.md 기록만 쓴다. 앞 토큰으로 가르지 않으면
  // 기존 finalize(--yes 커밋 경로)로 흘러 확인 없는 호출이 엉뚱한 결과를 낸다.
  if (rest[0] === 'comprehension') {
    const f = parseFlags(rest.slice(1));
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
      io.err('finalize: --blueprint is required\n');
      return 2;
    }
    if (typeof f.digest !== 'string' || f.digest === '') {
      io.err('finalize: --digest is required\n');
      return 2;
    }
    // 두 flag는 상호배타: 최초 기록과 갱신은 서로 다른 전제를 가진다.
    if (f['confirm-quiz'] === true && f.refresh === true) {
      io.err('finalize: --confirm-quiz and --refresh are mutually exclusive\n');
      return 2;
    }
    const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
    let digest: unknown;
    try {
      digest = JSON.parse(require('node:fs').readFileSync(f.digest, 'utf8'));
    } catch (_e) {
      // 읽기·JSON 파싱 실패는 digest 없음과 같다. 기록 모듈이 동의 → 입력 순서로 거절한다.
      digest = undefined;
    }
    let result;
    try {
      result = recordComprehension({
        repoRoot,
        blueprintDir: f.blueprint,
        digest,
        // === true: 값이 붙은 `--confirm-quiz 1`은 동의로 치지 않는다.
        confirmed: f['confirm-quiz'] === true,
        refresh: f.refresh === true,
      });
    } catch (error) {
      // 쓰기 실패(디스크·권한)는 거절 reason이 아니라 실행 실패다. 원본은 rename 전이라 온전하다.
      io.err(`finalize: ${error instanceof Error ? error.message : String(error)}\n`);
      return 1;
    }
    io.out(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  if (rest[0] === 'partial-finalize') {
    const f = parseFlags(rest.slice(1));
    if (typeof f.blueprint !== 'string' || f.blueprint === '') {
      io.err('finalize: --blueprint is required\n');
      return 2;
    }
    const repoRoot = typeof f.repo === 'string' && f.repo ? f.repo : process.cwd();
    const result = finalize({
      repoRoot,
      cwd: process.cwd(),
      blueprintDir: f.blueprint,
      yes: f.yes === true,
      partialFinalize: true,
      confirmPartial: f['confirm-partial-finalize'] === true,
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
  'status', 'revise', 'repair', 'reverify', 'partial-close', 'critical-recovery', 'revoke', 'next',
  'advance', 'session-open', 'worker-model', 'worker-tokens',
  'note', 'uncommit',
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
  const { loadLedgerBytes } = require('./coordinator-ledger');
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

type CoordFlags = Record<string, string | boolean>;

const hasFlag = (f: CoordFlags, name: string): boolean => Object.prototype.hasOwnProperty.call(f, name);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v !== '';

/**
 * 단순 문자열 플래그 → `coordinate()` 인자 필드 대응 표. 값이 문자열일 때만 넘기고
 * 아니면 undefined다. 명령에 따라 달라지는 필드(decision·reason·model·kind·done)와
 * 반복 플래그(paths·findings)는 `coordinateCall`에서 따로 채운다.
 */
const COORDINATE_STRING_FLAG_FIELDS: Record<string, string> = {
  task: 'task',
  sha: 'sha',
  failureCommand: 'failure-command',
  summary: 'summary',
  verify: 'verify',
  resumeTask: 'resume-task',
  disposition: 'disposition',
  outcome: 'outcome',
  reason: 'reason',
  role: 'role',
  perspective: 'perspective',
  tokens: 'tokens',
  // worker-model 전용. worker-tokens에는 checkWorkerFlags가 막아 core에 닿지 않는다.
  strategy: 'strategy',
  reviewerTier: 'reviewer-tier',
  taskBriefHash: 'task-brief-hash',
  text: 'text',
};

/** `--write-input`은 status 전용이고 값이 있어야 한다. 아니면 파일을 쓰기 전에 usage(2). */
function checkWriteInput(f: CoordFlags, command: string, io: CliIo): number | undefined {
  if (hasFlag(f, 'write-input') && (command !== 'status' || !nonEmpty(f['write-input']))) {
    return failCoordinateUsage(
      io, 'coordinate: --write-input <file> is accepted by status only and needs a value\n', command,
    );
  }
  return undefined;
}

/**
 * fence 플래그(--ledger-path·--ledger-hash) 누락 처리. worker-model·worker-tokens는
 * usage(2), 나머지 fenced 명령은 다른 coordinate 거절과 같은 JSON reason + exit 1이다.
 * argv 문법 오류와 stale/invalid fence를 같은 채널로 모아 자동화 클라이언트가 파싱한다.
 */
function checkFenceFlags(f: CoordFlags, command: string, io: CliIo): number | undefined {
  // bootstrap·status(ready 별칭)만 원장 fence 예외. 그 외 mutation은 path/hash 쌍이
  // 있어야 stale checkpoint로 원장·Git이 갈라지는 쓰기를 막는다.
  const fenced = [
    'prepare', 'dispatch', 'report', 'record', 'rerecord', 'integrate', 'revise',
    'repair', 'reverify', 'partial-close', 'critical-recovery', 'revoke', 'session-open',
    'worker-model', 'worker-tokens', 'note', 'uncommit',
  ];
  const missing = !nonEmpty(f['ledger-path']) || !nonEmpty(f['ledger-hash']);
  if (!missing) return undefined;
  if (command === 'worker-model' || command === 'worker-tokens') {
    return failCoordinateUsage(
      io, `coordinate ${command}: --ledger-path and --ledger-hash are required\n`, command,
    );
  }
  if (!fenced.includes(command)) return undefined;
  const coordinatorMod = require('./coordinator') as typeof import('./coordinator');
  // 다른 coordinate 거절과 같이 hint 표를 거쳐 cause·next를 붙인다.
  const hinted = coordinatorMod.withCoordinateFailureHints({ ok: false, reason: 'ledger-checkpoint-invalid' });
  io.out(`${JSON.stringify(hinted)}\n`);
  return 1;
}

/** 양의 정수 플래그(--generation·--max-steps)를 검사한다. 잘못되면 usage(2)용 메시지를 돌려준다. */
function positiveIntFlag(f: CoordFlags, name: string): { value?: number; bad?: boolean } {
  if (!hasFlag(f, name)) return {};
  const raw = f[name];
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return { bad: true };
  return { value: Number(raw) };
}

/** report 필수 flag 부재는 usage(2)로 돌려 argv 누락과 stale mismatch(1)를 구분한다. */
function checkReportFlags(f: CoordFlags, io: CliIo): number | undefined {
  const required: Array<[string, string]> = [
    ['attempt', '--attempt'], ['task-brief-hash', '--task-brief-hash'],
    ['outcome', '--outcome'], ['summary', '--summary'],
  ];
  for (const [name, label] of required) {
    if (!nonEmpty(f[name])) {
      return failCoordinateUsage(io, `coordinate report: ${label} is required\n`, 'report');
    }
  }
  return undefined;
}

/**
 * repair 전용 플래그(--kind·--done·--resume-task·--disposition·--verify) 검사.
 * 값이 잘못되면 core로 넘기지 않고 usage(2)로 끝내 오타가 조용히 기존 경로로 접히지 않게 한다.
 */
function checkRepairFlags(f: CoordFlags, io: CliIo): number | undefined {
  const usage = (message: string) => failCoordinateUsage(io, `coordinate repair: ${message}\n`, 'repair');
  if (hasFlag(f, 'kind') && f.kind !== 'product' && f.kind !== 'supplement') {
    return usage('--kind must be product or supplement');
  }
  if (hasFlag(f, 'done') && (f.done !== true || f.kind !== 'supplement')) {
    return usage('--done is a flag accepted only with --kind supplement');
  }
  // --resume-task/--disposition은 값이 필요하다. 값 없는 플래그(true)나 둘의 동시 입력이 조용히
  // 기존 dynamic repair 경로로 접히면 새 task가 생기므로 core에 보내기 전에 usage(2)로 끝낸다.
  for (const name of ['resume-task', 'disposition']) {
    if (hasFlag(f, name) && !nonEmpty(f[name])) return usage(`--${name} requires a value`);
  }
  // --verify는 새 repair task 문서에 쓸 단일 argv다. 값 없는 플래그가 생략으로 접히면
  // scoped_terminal 거절이 엉뚱한 사유로 보이므로 usage(2). --resume-task와는 함께 쓸 수 없다.
  if (hasFlag(f, 'verify') && (typeof f.verify !== 'string' || f.verify.trim() === '')) {
    return usage('--verify requires a value');
  }
  if (hasFlag(f, 'verify') && hasFlag(f, 'resume-task')) {
    return usage('--verify cannot be combined with --resume-task');
  }
  if (hasFlag(f, 'resume-task') && hasFlag(f, 'disposition')) {
    return usage('--resume-task and --disposition are mutually exclusive');
  }
  return undefined;
}

/** worker-model·worker-tokens 전용 플래그 검사. 값 형식은 core가 model-invalid·tokens-invalid(1)로 거절한다. */
function checkWorkerFlags(f: CoordFlags, command: string, io: CliIo): number | undefined {
  const usage = (message: string) => failCoordinateUsage(io, `coordinate ${command}: ${message}\n`, command);
  // 플래그 자체가 없는 경우만 usage(2). 값 없는 --model(true)은 core가 model-invalid(1)로 거절한다.
  if (!nonEmpty(f.role)) return usage('--role is required');
  if (command === 'worker-model' && !hasFlag(f, 'model')) return usage('--model is required');
  // --tokens는 worker-tokens에서 필수, worker-model에서 선택이다.
  if (command === 'worker-tokens' && !hasFlag(f, 'tokens')) return usage('--tokens is required');
  // 리뷰 전략·등급 플래그는 worker-model 전용이다. worker-tokens에 주면 키가 조용히 버려지므로
  // 값 유무보다 먼저 usage(2)로 막아, 잘못 옮긴 호출이 성공한 것처럼 보이지 않게 한다.
  if (command === 'worker-tokens') {
    for (const name of ['strategy', 'reviewer-tier']) {
      if (hasFlag(f, name)) return usage(`--${name} is worker-model only`);
    }
  }
  // 값 없는 --task·--perspective(true)를 undefined로 접으면 task·관점 없는 decision이
  // 조용히 기록된다. 누락과 달리 "있으나 값 없음"이므로 usage(2)로 막는다.
  // --strategy·--reviewer-tier도 같은 이유로 값 없는 형태를 usage(2)로 막는다.
  for (const name of ['task', 'perspective', 'tokens', 'strategy', 'reviewer-tier']) {
    if (hasFlag(f, name) && !nonEmpty(f[name])) return usage(`--${name} requires a value`);
  }
  return undefined;
}

/** 서브커맨드별 필수·형식 플래그 검사. 통과하면 undefined, 아니면 usage(2). */
function checkCommandFlags(f: CoordFlags, command: string, rest: string[], io: CliIo): number | undefined {
  if (command === 'report') {
    const bad = checkReportFlags(f, io);
    if (bad !== undefined) return bad;
  }
  if (command === 'repair') {
    const bad = checkRepairFlags(f, io);
    if (bad !== undefined) return bad;
  }
  // --new-path는 반복 플래그라 값 없는 occurrence가 유효한 다른 값 뒤에 숨을 수 있다.
  // 발생 횟수와 수집된 값 수가 다르면 조용히 버리지 않고 usage(2)로 끝낸다.
  if ((command === 'repair' || command === 'revise')
    && rest.slice(1).filter((tok) => tok === '--new-path').length
      !== collectPathValues(rest.slice(1), '--new-path').length) {
    return failCoordinateUsage(io, `coordinate ${command}: --new-path requires a value\n`, command);
  }
  // --release-do-not-touch도 반복 플래그다. 값 없는 발생은 해제 의도를 알 수 없으므로
  // 조용히 버리면 충돌 거절로 위장되어 원인이 흐려진다. usage(2)로 끝낸다.
  if (command === 'revise'
    && rest.slice(1).filter((tok) => tok === '--release-do-not-touch').length
      !== collectPathValues(rest.slice(1), '--release-do-not-touch').length) {
    return failCoordinateUsage(io, 'coordinate revise: --release-do-not-touch requires a value\n', command);
  }
  // --replace는 값을 받지 않는 boolean이다. parseFlags는 뒤 토큰을 값으로 먹으므로(`--replace x`)
  // 그 값을 교체 의도로 읽으면 `--replace src/`가 조용히 합집합으로 떨어진다. 값이 붙으면 usage(2)로 막고,
  // `--replace=x`처럼 등호로 붙인 형태는 알 수 없는 플래그로 무시된다(교체가 켜지지 않는다).
  if (command === 'revise') {
    const args = rest.slice(1);
    const valued = args.some((tok, i) => {
      const after = args[i + 1];
      return tok === '--replace' && after !== undefined && !after.startsWith('--');
    });
    if (valued) return failCoordinateUsage(io, 'coordinate revise: --replace takes no value\n', command);
  }
  // --accept-broken-baseline은 값을 받지 않는 boolean이다. parseFlags는 뒤 토큰을 값으로 먹으므로 값이
  // 붙은 형태(`--accept-broken-baseline yes`)는 수락 의도를 조용히 잃는다. 사용자 승인이 걸린 플래그라
  // 모호한 입력은 usage(2)로 막는다.
  if (command === 'prepare' && hasFlag(f, 'accept-broken-baseline') && f['accept-broken-baseline'] !== true) {
    return failCoordinateUsage(io, 'coordinate prepare: --accept-broken-baseline takes no value\n', command);
  }
  if (command === 'worker-model' || command === 'worker-tokens') {
    const bad = checkWorkerFlags(f, command, io);
    if (bad !== undefined) return bad;
  }
  if (command === 'note') {
    // 내용 검사(trim·2000자)는 core 몫이라 여기서는 플래그 존재·값 유무만 본다.
    // 값 없는 --task(true)를 undefined로 접으면 task 없는 note가 조용히 기록되므로 usage(2)로 막는다.
    if (!nonEmpty(f.text)) return failCoordinateUsage(io, 'coordinate note: --text is required\n', command);
    if (hasFlag(f, 'task') && !nonEmpty(f.task)) {
      return failCoordinateUsage(io, 'coordinate note: --task requires a value\n', command);
    }
  }
  // reverify는 terminal task id 없이는 core가 대상을 알 수 없다. core 호출 전에 usage(2)로 거절한다.
  if (command === 'reverify' && !nonEmpty(f.task)) {
    return failCoordinateUsage(io, 'coordinate reverify: --task is required\n', command);
  }
  if (command === 'uncommit' && !nonEmpty(f.task)) {
    return failCoordinateUsage(io, 'coordinate uncommit: --task is required\n', command);
  }
  if (command === 'revoke') {
    if (!nonEmpty(f.task)) return failCoordinateUsage(io, 'coordinate revoke: --task is required\n', command);
    if (!nonEmpty(f.reason)) return failCoordinateUsage(io, 'coordinate revoke: --reason is required\n', command);
  }
  return undefined;
}

/**
 * revise 갈래. `revise`는 `coordinate()`가 아니라 scope.reviseTaskScope가 처리하므로 CLI가
 * `process.cwd()` 원장에 대해 fence를 직접 확인한다. scope 판정은 coordinator의 것이고 여기서는
 * 인자만 모아 넘긴다. reviseTaskScope는 `repoRoot`를 write boundary로 쓰므로(main checkout·미할당
 * worktree 거절) `--repo`를 받지 않고 실제 cwd만 넘긴다. fence도 같은 cwd 원장에 묶는다.
 */
function coordinateRevise(rest: string[], f: CoordFlags, io: CliIo): number {
  const coordinatorMod = require('./coordinator') as typeof import('./coordinator');
  const { reviseTaskScope } = require('./scope') as typeof import('./scope');
  const { coordinatorPathsFor } = require('./runtime-state');
  const {
    assertLedgerFence, projectCheckpoint, loadLedgerBytes, isRemovedLightLedger,
  } = require('./coordinator-ledger') as typeof import('./coordinator-ledger');
  const reviseRoot = process.cwd();
  const paths = coordinatorPathsFor({ repoRoot: reviseRoot, blueprint: f.blueprint as string });
  // load bytes → fence → light 거절 → (이후 revise가 같은 경로를 씀). 디스크를 두 번 읽어
  // hash와 변조 대상이 어긋나지 않게 한 snapshot만 검사한다. openLedgerFenced를 쓰지 않는
  // 이유는 fence 통과 직후 light 원장 거절을 reviseTaskScope보다 앞에 두기 위함이다.
  const loaded = loadLedgerBytes(paths.ledgerFile);
  if (!loaded) {
    const hinted = coordinatorMod.withCoordinateFailureHints({ ok: false, reason: 'ledger-checkpoint-invalid' });
    io.out(`${JSON.stringify(hinted)}\n`);
    return 1;
  }
  const fenced = assertLedgerFence({
    ledgerPath: typeof f['ledger-path'] === 'string' ? f['ledger-path'] : undefined,
    ledgerHash: typeof f['ledger-hash'] === 'string' ? f['ledger-hash'] : undefined,
    ledgerBytes: loaded.bytes,
  });
  if (!fenced.ok) {
    io.out(`${JSON.stringify(coordinatorMod.withCoordinateFailureHints(fenced))}\n`);
    return 1;
  }
  if (isRemovedLightLedger(loaded.ledger)) {
    const refused = coordinatorMod.withCoordinateFailureHints({ ok: false, reason: 'light-mode-removed' });
    io.out(`${JSON.stringify(refused)}\n`);
    io.err('coordinate revise: light-mode-removed\n');
    return 1;
  }
  const result = reviseTaskScope({
    repoRoot: reviseRoot,
    blueprint: f.blueprint as string,
    task: typeof f.task === 'string' ? f.task : undefined,
    paths: collectPathValues(rest.slice(1)),
    newPaths: collectPathValues(rest.slice(1), '--new-path'),
    releaseDoNotTouch: collectPathValues(rest.slice(1), '--release-do-not-touch'),
    reason: typeof f.reason === 'string' ? f.reason : undefined,
    // 값 없는 `--replace`만 교체다(값이 붙은 형태는 checkCommandFlags가 usage(2)로 먼저 막는다).
    replace: f.replace === true,
  }) as { ok: boolean; reason?: string; paths?: string[] };
  if (!result.ok) {
    // 거절도 hint를 거친 stdout JSON(reason·paths·cause·next)으로 낸다. coordinator가 stderr
    // 문자열을 파싱하지 않고 다음 행동을 고르게 하려는 것이다. stderr의 reason 한 줄은 기존 신호라 둔다.
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

/**
 * next·advance 갈래 공통 실행. 둘 다 fence를 요구하지 않는 읽기 중심 명령이고, 값 없는
 * `--task`(parseFlags가 true)를 undefined로 접으면 blueprint 전체가 열려 잘못된 범위가 되므로
 * usage(2)로 막는다. `advance`는 `--max-steps`도 양의 정수만 받는다.
 */
function coordinateNextOrAdvance(command: 'next' | 'advance', f: CoordFlags, io: CliIo): number {
  const { catchMessage } = require('./guards') as typeof import('./guards');
  const { compactCoordinateOutput } = require('./coordinate-output') as typeof import('./coordinate-output');
  if (hasFlag(f, 'task') && !nonEmpty(f.task)) {
    return failCoordinateUsage(io, `coordinate ${command}: --task requires a ddd value\n`, command);
  }
  const task = typeof f.task === 'string' ? f.task : undefined;
  const repoRoot = (f.repo || process.cwd()) as string;
  let maxSteps: number | undefined;
  if (command === 'advance') {
    const steps = positiveIntFlag(f, 'max-steps');
    if (steps.bad) {
      return failCoordinateUsage(io, 'coordinate advance: --max-steps must be a positive integer\n', command);
    }
    maxSteps = steps.value;
  }
  try {
    let result: { ok: boolean };
    if (command === 'next') {
      const { coordinateNext } = require('./coordinate-next') as typeof import('./coordinate-next');
      result = coordinateNext({
        repoRoot, blueprint: f.blueprint as string, cwd: process.cwd(), task,
      }) as { ok: boolean };
    } else {
      const { advance } = require('./coordinate-advance') as typeof import('./coordinate-advance');
      result = advance({ repoRoot, blueprint: f.blueprint as string, task, maxSteps }) as { ok: boolean };
    }
    io.out(`${JSON.stringify(compactCoordinateOutput(command, result as Record<string, unknown>))}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    io.err(`coordinate: ${catchMessage(error)}\n`);
    return 1;
  }
}

/** 공통 `coordinate()` 호출 갈래. status의 `--write-input`은 성공 뒤에만 파일을 쓴다. */
function coordinateCall(
  command: string, rest: string[], f: CoordFlags, generation: number | undefined, io: CliIo,
): number {
  const { catchMessage } = require('./guards') as typeof import('./guards');
  const { coordinate } = require('./coordinator') as typeof import('./coordinator');
  const { compactCoordinateOutput } = require('./coordinate-output') as typeof import('./coordinate-output');
  try {
    // --repo는 main checkout을 가리키고 cwd는 실제 write boundary 검증에 쓴다.
    const attemptRaw = typeof f.attempt === 'string' ? f.attempt : undefined;
    const fields: Record<string, string | undefined> = {};
    for (const [field, flag] of Object.entries(COORDINATE_STRING_FLAG_FIELDS)) {
      fields[field] = typeof f[flag] === 'string' ? f[flag] as string : undefined;
    }
    const decisionFlag = command === 'rerecord' ? f.reason : f.decision;
    const result = coordinate({
      ...fields,
      command: command === 'ready' ? 'status' : command,
      repoRoot: (f.repo || process.cwd()) as string,
      blueprint: f.blueprint as string,
      cwd: process.cwd(),
      decision: typeof decisionFlag === 'string' ? decisionFlag : undefined,
      paths: collectPathValues(rest.slice(1)),
      newPaths: collectPathValues(rest.slice(1), '--new-path'),
      findings: collectFindingValues(rest.slice(1)),
      reviewFindings: collectReviewFindingValues(rest.slice(1)),
      kind: typeof f.kind === 'string' && command === 'repair' ? f.kind : undefined,
      done: command === 'repair' && f.done === true,
      attempt: attemptRaw !== undefined && /^\d+$/.test(attemptRaw) ? Number(attemptRaw) : undefined,
      // 값 없는 --model(parseFlags가 true)은 ''로 넘겨 core가 model-invalid로 거절하게 한다.
      // 플래그가 없으면 undefined라 기록하지 않는다.
      model: hasFlag(f, 'model') ? (typeof f.model === 'string' ? f.model : '') : undefined,
      leaseId: typeof f['lease-id'] === 'string' ? f['lease-id'] : undefined,
      generation,
      ledgerPath: typeof f['ledger-path'] === 'string' ? f['ledger-path'] : undefined,
      ledgerHash: typeof f['ledger-hash'] === 'string' ? f['ledger-hash'] : undefined,
      userConfirmed: f['user-confirmed'] === true,
      acceptBrokenBaseline: command === 'prepare' && f['accept-broken-baseline'] === true,
    }) as { ok: boolean };
    const compact = compactCoordinateOutput(command, result as Record<string, unknown>) as Record<string, unknown>;
    if (result.ok && hasFlag(f, 'write-input')) {
      // status가 모든 검사를 통과한 뒤에만 쓴다. 쓰기 오류는 아래 catch가
      // `coordinate: <msg>` exit 1로 옮기고, 이 시점에는 stdout이 비어 있다.
      compact.input_file = writeCoordinatorInput({
        file: f['write-input'] as string,
        repoRoot: (f.repo || process.cwd()) as string,
        blueprint: f.blueprint as string,
        checkpoint: (result as unknown as { checkpoint: Record<string, unknown> }).checkpoint,
      });
    }
    io.out(`${JSON.stringify(compact)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) { io.err(`coordinate: ${catchMessage(error)}\n`); return 1; }
}

/**
 * coordinate 서브커맨드를 CLI 경계에서 해석한다.
 * `--help`/`-h`는 인자·fence·core보다 먼저 stdout으로 끝내고, 허용 목록 밖
 * 이름은 core에 넘기지 않고 usage(2)로 끝낸다 — JSON 거절은 알려진 명령의
 * 런타임 실패에만 쓴다. `next`의 값 없는 `--task`는 생략이 아니라 usage(2)다.
 * 검사 순서(help → 명령명 → blueprint → write-input → fence → generation → 명령별)를
 * 통과하면 revise·next·advance·공통 호출 갈래 중 하나에 위임한다.
 *
 * @param {string[]} rest - `coordinate` 뒤 argv
 * @param {CliIo} io - stdout/stderr
 * @returns {number} 성공 0, 런타임 거절 1, usage 오류 2
 */
function cmdCoordinate(rest: string[], io: CliIo) {
  // 제거된 호출은 --repo 해석·플래그 검증·core보다 앞에서 거절한다.
  if (rest[0] === 'promote-stop') {
    io.err('coordinate promote-stop was removed; replan with /bouncer-plan and declare complexity\n');
    return 2;
  }
  if (rest.includes('--promote-light')) {
    io.err('coordinate bootstrap --promote-light was removed; replan with /bouncer-plan\n');
    return 2;
  }
  // 명령을 선택한 뒤에만 기능을 읽어 다른 경로의 적재를 피한다.
  const { parseFlags, argvRequestsHelp } = require('./cli-flags') as typeof import('./cli-flags');
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
  if (!(COORDINATE_COMMANDS as readonly string[]).includes(command)) {
    return failCoordinateUsage(
      io,
      'coordinate: command must be bootstrap, prepare, ready, dispatch, report, record, rerecord, '
      + 'integrate, status, revise, repair, reverify, partial-close, critical-recovery, revoke, '
      + 'next, advance, session-open, worker-model, or worker-tokens\n',
    );
  }
  if (typeof f.blueprint !== 'string' || f.blueprint === '') {
    return failCoordinateUsage(io, 'coordinate: --blueprint is required\n', command);
  }
  // --generation은 양의 정수만. abc·0은 usage(2) — core의 lease-required와 구분한다.
  const generation = positiveIntFlag(f, 'generation');
  const early = checkWriteInput(f, command, io) ?? checkFenceFlags(f, command, io);
  if (early !== undefined) return early;
  if (generation.bad) {
    return failCoordinateUsage(io, 'coordinate: --generation must be a positive integer\n', command);
  }
  const invalid = checkCommandFlags(f, command, rest, io);
  if (invalid !== undefined) return invalid;
  if (command === 'revise') return coordinateRevise(rest, f, io);
  if (command === 'next' || command === 'advance') return coordinateNextOrAdvance(command, f, io);
  return coordinateCall(command, rest, f, generation.value, io);
}

export = {
  commit: {
    run: cmdCommit,
    usage: cliUsage.COMMAND_USAGE['commit'],
  },
  finalize: {
    run: cmdFinalize,
    usage: cliUsage.COMMAND_USAGE['finalize'],
  },
  'seed-worktree': {
    run: cmdSeedWorktree,
    usage: cliUsage.COMMAND_USAGE['seed-worktree'],
  },
  execute: {
    run: cmdExecute,
    usage: cliUsage.COMMAND_USAGE['execute'],
  },
  coordinate: {
    run: cmdCoordinate,
    usage: cliUsage.COMMAND_USAGE['coordinate'],
  },
  import: {
    run: cmdImport,
    usage: cliUsage.COMMAND_USAGE['import'],
  },
};
