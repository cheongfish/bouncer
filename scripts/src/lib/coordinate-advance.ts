'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

/** advance가 next 응답에서 읽는 필드만 구조적으로 선언한다. next 모듈 타입을 export하지 않는다. */
type NextShape = {
  ok: boolean;
  action?: string;
  cwd?: string;
  argv?: string[];
  judge?: unknown;
  payload?: Record<string, unknown>;
  reason?: string;
  cause?: unknown;
  next?: unknown;
  task?: string;
};

type AdvanceDeps = {
  next: (opts: {
    repoRoot: string;
    blueprint: string;
    task?: string;
  }) => NextShape;
  runArgv: (argv: string[], cwd: string) => { stdout: string; status: number };
};

type ExecutedStep = { action: string; task?: string; exit: number };

type StopReason = 'judge' | 'worker' | 'blocked' | 'done' | 'none' | 'max-steps';

type AdvanceOk = {
  ok: true;
  executed: ExecutedStep[];
  stop: { reason: StopReason; next: object };
};

type AdvanceErr = {
  ok: false;
  reason: string;
  cause: unknown;
  next: unknown;
  executed: ExecutedStep[];
};

type RunOutcome =
  | { kind: 'success'; exit: number }
  | { kind: 'failure'; body: Record<string, unknown>; reason: string }
  | { kind: 'unclear'; detail: string };

// judge 없이 argv만으로 끝낼 수 있는 행동. next가 이 집합 밖을 주면 advance는
// 실행하지 않고 worker/judge 정지로 넘긴다 — commit 순서를 advance가 만들지 않게.
const AUTO_ACTIONS = new Set([
  'prepare', 'integrate', 'verification_node', 'verify', 'commit',
]);

const TERMINAL_ACTIONS = new Set(['blocked', 'done', 'none']);

// fence가 한 박자 늦은 경우만 재시도한다. stale-lease 등은 원장·lease를
// 다시 읽어도 같은 argv로는 낫지 않아 즉시 실패로 넘긴다.
const RETRYABLE_REASONS = new Set([
  'stale-ledger-checkpoint', 'stale-integration-head',
]);

const DEFAULT_MAX_STEPS = 20;

/**
 * `coordinate next` argv를 기본 경로에서 실행한다. 첫 토큰 `bouncer`는
 * 이 패키지 launcher로 치환해 PATH에 bouncer가 없어도 같은 설치본을 쓴다.
 *
 * @param {string[]} argv - next가 준 argv(`bouncer`로 시작)
 * @param {string} cwd - 실행 cwd(next 응답의 cwd)
 * @returns {{ stdout: string, status: number }} 자식 stdout과 종료 코드
 */
function defaultRunArgv(argv: string[], cwd: string): { stdout: string; status: number } {
  const launcher = path.join(__dirname, '..', 'bouncer');
  const result = spawnSync(process.execPath, [launcher, ...argv.slice(1)], {
    cwd,
    encoding: 'utf8',
    // stderr는 파이프에 모아 호출자 stdout JSON과 섞이지 않게 한다.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const status = typeof result.status === 'number' ? result.status : 1;
  return { stdout: result.stdout || '', status };
}

/**
 * 기본 next 의존성. advance CLI가 deps를 안 넘길 때 coordinateNext를 부른다.
 *
 * @param {{ repoRoot: string, blueprint: string, task?: string }} opts - advance 옵션
 * @returns {NextShape} coordinateNext 결과
 */
function defaultNext(opts: {
  repoRoot: string; blueprint: string; task?: string;
}): NextShape {
  const { coordinateNext } = require('./coordinate-next') as typeof import('./coordinate-next');
  // next CLI와 같이 호출자 cwd를 넘긴다. integration이 아니면 next가 거절한다.
  return coordinateNext({
    repoRoot: opts.repoRoot,
    blueprint: opts.blueprint,
    cwd: process.cwd(),
    task: opts.task,
  }) as NextShape;
}

/**
 * argv 결과 JSON에서 비교·보고용 실패 reason을 고른다.
 * 검증 실패는 reason 키가 없고 failures[0].code만 있는 경우가 있다.
 *
 * @param {Record<string, unknown>} body - 파싱된 stdout JSON
 * @returns {string | undefined} reason 또는 첫 failures[].code
 */
function failureReasonOf(body: Record<string, unknown>): string | undefined {
  if (typeof body.reason === 'string' && body.reason !== '') return body.reason;
  const failures = body.failures;
  if (Array.isArray(failures) && failures.length > 0) {
    const code = (failures[0] as { code?: unknown }).code;
    if (typeof code === 'string' && code !== '') return code;
  }
  return undefined;
}

/**
 * stdout을 JSON 객체로 파싱한다. 배열·원시값은 결과 계약이 아니라 실패로 본다.
 *
 * @param {string} stdout - runArgv stdout
 * @returns {Record<string, unknown> | null} 객체면 본문, 아니면 null
 */
function parseResultJson(stdout: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    // JSON이 아니면 unclear-result로 올린다. SyntaxError만 흡수한다.
    return null;
  }
}

/**
 * runArgv 한 번의 stdout·status를 성공·실패·불명확으로 분류한다.
 *
 * @param {{ stdout: string, status: number }} attempt - runArgv 결과
 * @returns {RunOutcome} 분류 결과
 */
function classifyRun(attempt: { stdout: string; status: number }): RunOutcome {
  if (attempt.status !== 0 && attempt.status !== 1) {
    return { kind: 'unclear', detail: `automatic action exited with status ${attempt.status}` };
  }
  const body = parseResultJson(attempt.stdout);
  if (body === null) {
    return { kind: 'unclear', detail: 'automatic action stdout was not a JSON object' };
  }
  const hasFailureCodes = Array.isArray(body.failures)
    && body.failures.some((f) => f && typeof (f as { code?: unknown }).code === 'string');
  if (body.ok === false || hasFailureCodes) {
    return {
      kind: 'failure',
      body,
      reason: failureReasonOf(body) || 'failed',
    };
  }
  if (body.ok === true && attempt.status === 0) {
    return { kind: 'success', exit: attempt.status };
  }
  return {
    kind: 'unclear',
    detail: 'automatic action result was not a clear success or failure',
  };
}

/**
 * 자동 행동 실패를 advance 실패 응답으로 옮긴다. 원 응답 필드를 유지하고
 * executed만 붙인다 — 클라이언트가 기존 coordinate 실패와 같이 파싱한다.
 *
 * @param {Record<string, unknown>} body - argv 실패 JSON
 * @param {string} reason - 보고 reason
 * @param {ExecutedStep[]} executed - 지금까지 성공한 단계
 * @returns {AdvanceErr} ok:false 응답
 */
function failFromBody(
  body: Record<string, unknown>,
  reason: string,
  executed: ExecutedStep[],
): AdvanceErr {
  // 원 argv 실패 필드(failures 등)를 유지하고 executed만 붙인다.
  return {
    ...body,
    ok: false,
    reason,
    cause: body.cause !== undefined ? body.cause : reason,
    next: body.next !== undefined ? body.next : '',
    executed,
  } as AdvanceErr;
}

/**
 * unclear-result / advance-argv-invalid처럼 advance가 만든 실패.
 * 검증기 소스를 읽으라는 안내는 넣지 않고 cause·next만 돌린다.
 *
 * @param {string} reason - advance 실패 reason
 * @param {string} cause - 짧은 원인
 * @param {string} nextHint - 다음에 할 일
 * @param {ExecutedStep[]} executed - 지금까지 성공한 단계
 * @returns {AdvanceErr} ok:false 응답
 */
function failAdvance(
  reason: string,
  cause: string,
  nextHint: string,
  executed: ExecutedStep[],
): AdvanceErr {
  return { ok: false, reason, cause, next: nextHint, executed };
}

/**
 * `coordinate next`가 준 결정적 argv를 연쇄 실행하다 판단·worker·한도·오류에서 멈춘다.
 * 원장·pointer는 직접 쓰지 않고 next가 준 argv만 실행하며, 단계마다 next를
 * 다시 불러 fence를 갱신한다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string} [opts.task] - task 범위 next에 넘길 id
 * @param {number} [opts.maxSteps] - 자동 실행 상한(기본 20). 양의 정수만
 * @param {AdvanceDeps} [opts.deps] - next·runArgv 주입 seam
 * @returns {AdvanceOk | AdvanceErr} 정지(ok:true) 또는 실패(ok:false)
 */
function advance(opts: {
  repoRoot: string;
  blueprint: string;
  task?: string;
  maxSteps?: number;
  deps?: Partial<AdvanceDeps>;
}): AdvanceOk | AdvanceErr {
  const maxSteps = opts.maxSteps === undefined ? DEFAULT_MAX_STEPS : opts.maxSteps;
  const nextFn = opts.deps?.next ?? defaultNext;
  const runArgv = opts.deps?.runArgv ?? defaultRunArgv;
  const executed: ExecutedStep[] = [];
  const nextOpts = {
    repoRoot: opts.repoRoot,
    blueprint: opts.blueprint,
    task: opts.task,
  };

  // 1. 매 단계 next를 새로 부른다. 이전 argv의 fence를 재사용하지 않는다.
  while (true) {
    const step = nextFn(nextOpts);

    if (step.ok !== true) {
      return {
        ok: false,
        reason: typeof step.reason === 'string' ? step.reason : 'next-failed',
        cause: step.cause !== undefined ? step.cause : step.reason,
        next: step.next !== undefined ? step.next : '',
        executed,
      };
    }

    const action = typeof step.action === 'string' ? step.action : '';

    // 2. 단말 행동·판단·worker는 실행 없이 정지. stop.next에 이 next 전체를 담는다.
    if (TERMINAL_ACTIONS.has(action)) {
      return {
        ok: true,
        executed,
        stop: { reason: action as 'blocked' | 'done' | 'none', next: step },
      };
    }
    if (step.judge !== undefined && step.judge !== null) {
      return { ok: true, executed, stop: { reason: 'judge', next: step } };
    }

    const argv = Array.isArray(step.argv) ? step.argv : undefined;
    const isAuto = AUTO_ACTIONS.has(action) && argv !== undefined && argv.length > 0;
    if (!isAuto) {
      // drive_tasks(argv 없음)·implement(inline 포함)·그 밖 worker 위임.
      return { ok: true, executed, stop: { reason: 'worker', next: step } };
    }

    // 3. 한도에 닿으면 이번 argv는 실행하지 않는다. executed 길이가 곧 단계 수다.
    if (executed.length >= maxSteps) {
      return { ok: true, executed, stop: { reason: 'max-steps', next: step } };
    }

    if (argv[0] !== 'bouncer') {
      return failAdvance(
        'advance-argv-invalid',
        'next argv must start with bouncer',
        'Inspect coordinate next argv; do not invent a replacement command.',
        executed,
      );
    }

    const cwd = typeof step.cwd === 'string' && step.cwd !== '' ? step.cwd : process.cwd();
    let outcome = classifyRun(runArgv(argv, cwd));

    // 4. stale fence만 next를 다시 불러 한 번 재실행한다. 같은 reason이면
    // repeated-failure, 다른 실패면 그 응답, 성공이면 executed에 넣고 루프.
    if (outcome.kind === 'failure' && RETRYABLE_REASONS.has(outcome.reason)) {
      const firstReason = outcome.reason;
      const again = nextFn(nextOpts);
      if (again.ok === true
        && again.action === action
        && Array.isArray(again.argv)
        && again.argv.length > 0
        && again.argv[0] === 'bouncer') {
        const retryCwd = typeof again.cwd === 'string' && again.cwd !== ''
          ? again.cwd : process.cwd();
        outcome = classifyRun(runArgv(again.argv, retryCwd));
        if (outcome.kind === 'failure' && outcome.reason === firstReason) {
          return {
            ok: false,
            reason: 'repeated-failure',
            cause: firstReason,
            next: outcome.body.next !== undefined ? outcome.body.next : '',
            executed,
          };
        }
      }
    }

    if (outcome.kind === 'unclear') {
      return failAdvance(
        'unclear-result',
        outcome.detail,
        'Inspect the command output, then call coordinate next again.',
        executed,
      );
    }
    if (outcome.kind === 'failure') {
      return failFromBody(outcome.body, outcome.reason, executed);
    }

    const entry: ExecutedStep = { action, exit: outcome.exit };
    if (typeof step.task === 'string' && step.task !== '') entry.task = step.task;
    executed.push(entry);
  }
}

export = { advance };
