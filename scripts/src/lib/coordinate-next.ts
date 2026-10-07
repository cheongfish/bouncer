'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
import coordinator = require('./coordinator');
const {
  registeredIntegration, ensureIntegrationCwd, assertLeaseShape,
  isBlueprintReviewModeAt, initialWorktreeState, taskBriefHashOf, normalizeCommitSha,
  loadLedgerBytes, readBouncerBlock, projectCheckpoint, COORDINATE_FAILURE_HINTS,
} = coordinator;
import runtime = require('./runtime-state');
const { coordinatorPathsFor, runtimePaths } = runtime;

type Exec = (file: string, args?: readonly string[], options?: {
  cwd?: unknown; encoding?: unknown; stdio?: unknown;
}) => string | Buffer;

type Lease = { id: string; generation: number; status?: string };
type DispatchState = {
  attempt: number; task_brief_hash: string; base_head: string;
  initial_worktree_state: string; status: string; outcome?: string; summary?: string;
};
type LedgerTask = {
  id: string; status?: string; execution_kind?: string; workerPath?: string;
  lease?: Lease; dispatch?: DispatchState; sha?: string;
  criticalRecovery?: { outcome: string | null };
  decisions?: Array<{ kind?: string; outcome?: string; summary?: string }>;
};
type Ledger = {
  status?: string; base?: string; integrationHead?: string; fanin?: unknown;
  terminalFailure?: { task?: string }; tasks: LedgerTask[];
  revision?: string | null;
};
type LedgerRef = { path: string; sha256: string; revision: string | null };
type Judge = { kind: string; fields: string[]; allowed?: string[] };
// 계약 카드를 싣는 action. 판단(judge)이나 worker 위임이 필요한 행동만 카드를 받는다.
// argv만 실행하면 끝나는 prepare·drive_tasks·integrate·verification_node·commit·done·none은
// 카드가 없다 — 응답을 키우지 않고, 그 행동의 규칙은 argv 자체가 담는다.
const CARD_IDS = [
  'dispatch', 'implement', 'verify', 'review', 'report', 'revise', 'record', 'final_review', 'blocked',
] as const;
type CardId = typeof CARD_IDS[number];
type Card = { id: CardId; body: string };
type NextOk = {
  ok: true; scope: 'blueprint' | 'task'; action: string; task?: string;
  cwd: string; argv?: string[]; judge?: Judge; task_ids?: string[];
  payload?: Record<string, unknown>; reason?: string; cause?: string; next?: string;
  card?: Card;
  checkpoint: { ledger: LedgerRef };
};
type NextErr = { ok: false; reason: string; cause: string; next: string };

const NEXT_FAILURE_HINTS: Record<string, { cause: string; next: string }> = {
  'partial-closed': {
    cause: 'This drive was partial-closed after the repair-wave limit.',
    next: 'Report the preserved drive to the user; do not retry coordinate mutations on this blueprint.',
  },
  'terminal-verification-failed': {
    cause: 'Terminal verification failed and that verification task is still verifying.',
    next: 'Inspect the failure, then `bouncer coordinate repair`, or report the block to the user.',
  },
  'no-ready-task': {
    cause: 'No prepared, recorded, ready, or integrable work remains, and the blueprint is not done.',
    next: 'Run `bouncer coordinate status` and report the unexpected ledger combination; do not invent an action.',
  },
  'critical-recovery-open': {
    cause: 'This prepared task has an open critical-recovery record with no outcome yet.',
    next: 'Close it with `bouncer coordinate critical-recovery` outcome resolved or blocked before driving the task.',
  },
  'task-reported-blocked': {
    cause: 'The worker reported outcome blocked, so the coordinator must stop this task.',
    next: 'Report the block to the user; do not dispatch or record this attempt.',
  },
  'commit-evidence-mismatch': {
    cause: 'Worker HEAD, commit_sha, or porcelain does not match a commit that only dirtied this task tasks.md.',
    next: 'Restore the worker to the recorded commit evidence, or redo commit so only that tasks.md is dirty.',
  },
  'verification-task-uses-blueprint-next': {
    cause: 'Verification tasks are driven with blueprint-scope next, not --task.',
    next: 'Omit --task and run `bouncer coordinate next --blueprint <dir>` so verification_node can be selected.',
  },
  'coordinator-card-missing': {
    cause: 'The contract card for this action is missing or unreadable in plugin references/coordinator-cards/.',
    next: 'Reinstall the Bouncer plugin so references/coordinator-cards/ ships every card, then call next again.',
  },
};

/**
 * reason에 맞는 cause·next를 고른다. next가 만든 reason은 NEXT_FAILURE_HINTS,
 * 기존 coordinate reason은 COORDINATE_FAILURE_HINTS만 본다 — 같은 키를 두 표에
 * 두면 안내가 갈라진다.
 *
 * @param {string} reason - 실패 또는 blocked reason
 * @returns {{ cause: string, next: string }} 안내 문구
 */
function hintFor(reason: string): { cause: string; next: string } {
  return NEXT_FAILURE_HINTS[reason] || COORDINATE_FAILURE_HINTS[reason] || {
    cause: reason,
    next: 'Run `bouncer coordinate status` and continue from its checkpoint.',
  };
}

/**
 * ok:false 결과에 힌트를 붙인다.
 *
 * @param {string} reason - 거절 코드
 * @returns {NextErr} exit 1 대상
 */
function fail(reason: string): NextErr {
  const hint = hintFor(reason);
  return { ok: false, reason, cause: hint.cause, next: hint.next };
}

/**
 * 플러그인 루트의 계약 카드 한 장을 UTF-8 그대로 읽는다. 빌드 출력은
 * `scripts/lib`이므로 두 단계 위가 플러그인 루트다(`graphify.ts`의
 * `pluginRootFromLib`와 같은 기준). cwd·`--repo`·소비 저장소는 보지 않는다 —
 * 카드는 플러그인이 배포하는 계약이지 사용자 저장소 문서가 아니다.
 * 파일이 없거나 읽기에 실패하면 fs 오류를 그대로 던진다.
 *
 * @param {CardId} id - 카드 id. 호출부가 CARD_IDS 안의 값만 넘긴다
 * @returns {string} 카드 파일 본문
 */
function readPluginCard(id: CardId): string {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'references', 'coordinator-cards', `${id}.md`),
    'utf8',
  );
}

/**
 * 성공 응답의 action이 카드 대상이면 `card: { id, body }`를 붙인다.
 * 카드를 못 읽으면 카드 없는 성공 응답으로 내보내지 않고
 * `coordinator-card-missing`으로 거절한다 — 규칙 없이 행동만 받은 coordinator가
 * 예전처럼 reference를 뒤지거나 규칙을 추측하지 않게 하려는 것이다.
 *
 * @param {NextOk | NextErr} result - blueprintNext/taskNext 판정
 * @param {(id: CardId) => string} readCard - 카드 읽기. 기본은 readPluginCard
 * @returns {NextOk | NextErr} 카드를 붙인 성공 응답, 비대상 응답 그대로, 또는 거절
 */
function attachCard(result: NextOk | NextErr, readCard: (id: CardId) => string): NextOk | NextErr {
  if (!result.ok) return result;
  const id = CARD_IDS.find((candidate) => candidate === result.action);
  if (id === undefined) return result;
  let body: string;
  try {
    body = readCard(id);
  } catch (_error) {
    // 카드 읽기의 모든 실패(ENOENT·EACCES·EISDIR, 주입 seam의 throw)를 같은 거절로 흡수한다.
    // 어느 경우든 이 action의 계약을 줄 수 없다는 결과는 같고, 원장·worktree는 이
    // 함수가 건드리지 않으므로 흡수해도 상태가 어긋나지 않는다. 안내는 hint가 맡는다.
    return fail('coordinator-card-missing');
  }
  return { ...result, card: { id, body } };
}

/**
 * Git 한 번. trim은 rev-parse 비교용이고 porcelain은 별도 헬퍼가 원문을 지킨다.
 *
 * @param {Exec} exec - 주입 실행기
 * @param {string} cwd - 작업 디렉터리
 * @param {string[]} args - git argv
 * @returns {string} stdout trim
 */
function git(exec: Exec, cwd: string, args: string[]): string {
  return String(exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim();
}

/**
 * fence 쌍. next가 읽은 bytes의 path·hash만 넣어야 argv 실행이 stale로 거절되지 않는다.
 *
 * @param {LedgerRef} ledger - checkpoint.ledger
 * @returns {string[]} --ledger-path/--ledger-hash 토큰
 */
function fenceArgs(ledger: LedgerRef): string[] {
  return ['--ledger-path', ledger.path, '--ledger-hash', ledger.sha256];
}

/**
 * 원장 lease가 있을 때만 플래그를 붙인다. verification은 lease가 없어 꾸며내지 않는다.
 *
 * @param {LedgerTask} [item] - 대상 task
 * @returns {string[]} lease 플래그 또는 빈 배열
 */
function leaseArgs(item?: LedgerTask): string[] {
  if (!item || !item.lease || typeof item.lease.id !== 'string') return [];
  if (!Number.isInteger(item.lease.generation)) return [];
  return ['--lease-id', item.lease.id, '--generation', String(item.lease.generation)];
}

/**
 * `bouncer coordinate <sub>` 뒤에 blueprint와 fence를 고정 순서로 붙인다.
 * 표가 이 순서를 요구하므로 플래그를 명령마다 다르게 섞지 않는다.
 *
 * @param {string} sub - coordinate 서브커맨드
 * @param {string} blueprint - blueprint 상대 경로
 * @param {LedgerRef} ledger - fence
 * @param {{ task?: string, item?: LedgerTask }} [taskOpts] - task 대상이면 id와 lease
 * @param {string[]} [extra] - attempt 등 이미 채운 플래그
 * @returns {string[]} argv
 */
function coordinateArgv(
  sub: string, blueprint: string, ledger: LedgerRef,
  taskOpts?: { task?: string; item?: LedgerTask }, extra: string[] = [],
): string[] {
  const argv = ['bouncer', 'coordinate', sub, '--blueprint', blueprint, ...fenceArgs(ledger)];
  if (taskOpts && taskOpts.task) {
    argv.push('--task', taskOpts.task, ...leaseArgs(taskOpts.item));
  }
  argv.push(...extra);
  return argv;
}

/**
 * porcelain v1 경로. rename은 양쪽을 모두 dirty로 본다 — tasks.md만 남긴
 * commit 직후 상태를 다른 경로가 가리면 report가 되면 안 된다.
 *
 * @param {string} text - `git status --porcelain=v1` 원문
 * @returns {string[]} 상대 경로
 */
function dirtyPaths(text: string): string[] {
  const paths: string[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const rest = line.slice(3);
    const parts = rest.includes(' -> ') ? rest.split(' -> ') : [rest];
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        try {
          paths.push(JSON.parse(trimmed) as string);
        } catch (_error) {
          // 잘못된 따옴표는 원문 그대로 비교한다. 경로를 추측해 지우면 mismatch를 놓친다.
          paths.push(trimmed);
        }
      } else {
        paths.push(trimmed.replaceAll('\\', '/'));
      }
    }
  }
  return paths;
}

/**
 * 이 task의 tasks.md만 dirty인지. commit이 SHA를 그 파일에만 쓰므로 그 한
 * 경로의 변경은 report의 정상 잔여물이다.
 *
 * @param {string[]} paths - porcelain 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 id
 * @returns {boolean} tasks.md 외 dirty가 있으면 false
 */
function onlyTaskBriefDirty(paths: string[], blueprint: string, taskId: string): boolean {
  const allowed = `${blueprint.replaceAll('\\', '/')}/tasks/${taskId}/tasks.md`;
  return paths.every((rel) => rel.replaceAll('\\', '/') === allowed);
}

/**
 * 문서 bouncer.status. 파일 부재는 미완으로 본다 — 없는 증적을 통과로 꾸미지 않는다.
 *
 * @param {string} root - worker 또는 integration
 * @param {string} rel - 문서 상대 경로
 * @returns {unknown} status 또는 undefined
 */
function bouncerStatus(root: string, rel: string): unknown {
  const block = readBouncerBlock(path.join(root, rel));
  return block ? block.status : undefined;
}

type Built = Omit<NextOk, 'ok' | 'checkpoint' | 'cwd'> & { cwd: string };

/**
 * checkpoint.ledger를 붙이고 blocked면 힌트를 채운다.
 *
 * @param {Built} body - action 판정
 * @param {string} cwd - argv 실행 cwd
 * @param {LedgerRef} ledgerRef - 읽기 bytes의 fence
 * @returns {NextOk} 성공 응답
 */
function succeed(body: Built, cwd: string, ledgerRef: LedgerRef): NextOk {
  const result: NextOk = { ok: true, checkpoint: { ledger: ledgerRef }, ...body, cwd };
  if (result.action === 'blocked' && typeof result.reason === 'string') {
    const hint = hintFor(result.reason);
    result.cause = hint.cause;
    result.next = hint.next;
  }
  return result;
}

/**
 * 원장과 worker 문서를 읽어 다음에 실행할 행동 하나와 채운 argv를 돌려준다.
 * 잠금·원장 쓰기·worktree 쓰기는 하지 않는다. status와 같이 integration cwd에서
 * 읽고, 응답 cwd만 worker일 수 있다. 판단·worker action이면 플러그인 계약 카드를 `card`로 함께 싣는다.
 *
 * @param {object} opts - 판정 입력
 * @param {string} opts.repoRoot - 메인 체크아웃
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string} opts.cwd - 호출 cwd. integration worktree여야 한다
 * @param {string} [opts.task] - 있으면 task 범위
 * @param {{ execFileSync?: Exec, readCard?: (id: CardId) => string }} [opts.deps] - git·카드 읽기 주입(테스트 seam)
 * @returns {NextOk | NextErr} 결정(카드 대상이면 card 포함) 또는 즉시 거절
 */
function coordinateNext(opts: {
  repoRoot: string; blueprint: string; cwd: string; task?: string;
  deps?: { execFileSync?: Exec; readCard?: (id: CardId) => string };
}): NextOk | NextErr {
  const readCard = (opts.deps && opts.deps.readCard) || readPluginCard;
  return attachCard(decideNext(opts), readCard);
}

/**
 * 원장과 worker 문서를 읽어 다음 행동 하나를 정한다. 카드 첨부 전 단계다.
 *
 * @param {object} opts - coordinateNext와 같은 입력
 * @param {string} opts.repoRoot - 메인 체크아웃
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string} opts.cwd - 호출 cwd. integration worktree여야 한다
 * @param {string} [opts.task] - 있으면 task 범위
 * @param {{ execFileSync?: Exec }} [opts.deps] - git 주입
 * @returns {NextOk | NextErr} 결정 또는 즉시 거절
 */
function decideNext(opts: {
  repoRoot: string; blueprint: string; cwd: string; task?: string;
  deps?: { execFileSync?: Exec };
}): NextOk | NextErr {
  const { repoRoot, blueprint, cwd, task } = opts;
  const exec = (opts.deps && opts.deps.execFileSync) || realExecFileSync as unknown as Exec;

  // 1. status와 같은 원장 읽기 순서. 쓰기는 이 함수에 없다.
  const main = runtimePaths({ repoRoot, execFileSync: exec });
  if (main.unavailable) return fail('non-git-root');
  const integration = coordinatorPathsFor({ repoRoot, blueprint });
  if (!registeredIntegration(exec, repoRoot, integration.integrationPath)) {
    return fail('unassigned-integration-worktree');
  }
  const loaded = loadLedgerBytes(integration.ledgerFile);
  if (!loaded) return fail('missing-ledger');
  const leaseShape = assertLeaseShape(loaded.ledger);
  if (!leaseShape.ok) return fail(leaseShape.reason);
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  const ledger = loaded.ledger as Ledger;
  const checkpoint = projectCheckpoint(loaded.ledger, integration.ledgerFile, loaded.bytes);
  const ledgerRef = checkpoint.ledger;
  const integrationCwd = integration.integrationPath;

  if (task !== undefined && task !== '') {
    return taskNext({
      repoRoot, blueprint, task, exec, ledger, ledgerRef, checkpoint, integrationCwd, integration,
    });
  }
  return blueprintNext({
    blueprint, exec, ledger, ledgerRef, checkpoint, integrationCwd,
  });
}

/**
 * blueprint 범위 표. 위에서 처음 맞는 행만 쓴다.
 *
 * @param {object} ctx - 읽기 스냅샷
 * @param {string} ctx.blueprint - blueprint 경로
 * @param {Exec} ctx.exec - git
 * @param {Ledger} ctx.ledger - 원장
 * @param {LedgerRef} ctx.ledgerRef - fence
 * @param {{ ready: string[] }} ctx.checkpoint - status checkpoint의 ready wave
 * @param {string} ctx.integrationCwd - integration 절대 경로
 * @returns {NextOk | NextErr} 판정
 */
function blueprintNext(ctx: {
  blueprint: string; exec: Exec; ledger: Ledger; ledgerRef: LedgerRef;
  checkpoint: { ready: string[] }; integrationCwd: string;
}): NextOk | NextErr {
  const { blueprint, exec, ledger, ledgerRef, checkpoint, integrationCwd } = ctx;
  const ok = (body: Built) => succeed(body, body.cwd, ledgerRef);

  if (ledger.status === 'partial_closed') {
    return ok({
      scope: 'blueprint', action: 'blocked', reason: 'partial-closed', cwd: integrationCwd,
    });
  }
  if (ledger.status === 'awaiting_confirmation') {
    return ok({
      scope: 'blueprint', action: 'blocked', reason: 'repair-wave-limit', cwd: integrationCwd,
    });
  }
  const failedId = ledger.terminalFailure && ledger.terminalFailure.task;
  if (failedId) {
    const failed = ledger.tasks.find((item) => item.id === failedId);
    if (failed && failed.execution_kind === 'verification' && failed.status === 'verifying') {
      return ok({
        scope: 'blueprint', action: 'blocked', reason: 'terminal-verification-failed',
        cwd: integrationCwd,
      });
    }
  }
  if (ledger.fanin != null) {
    return ok({
      scope: 'blueprint', action: 'integrate', cwd: integrationCwd,
      argv: coordinateArgv('integrate', blueprint, ledgerRef),
    });
  }
  const prepared = ledger.tasks.filter((item) => item.status === 'prepared'
    && item.execution_kind !== 'verification');
  if (prepared.length > 0) {
    return ok({
      scope: 'blueprint', action: 'drive_tasks', cwd: integrationCwd,
      task_ids: prepared.map((item) => item.id),
    });
  }
  const recorded = ledger.tasks.some((item) => item.status === 'recorded'
    && item.execution_kind !== 'verification');
  if (recorded) {
    return ok({
      scope: 'blueprint', action: 'integrate', cwd: integrationCwd,
      argv: coordinateArgv('integrate', blueprint, ledgerRef),
    });
  }
  // checkpoint.ready는 pending 후보다. verification node는 prepare가 status를
  // ready로 올린 뒤에만 integrate가 받아 주므로, 여기를 status ready/verifying으로
  // 본다. pending verification은 아래 prepare 행이 연다.
  const verificationLive = ledger.tasks.find((item) => item.execution_kind === 'verification'
    && (item.status === 'ready'
      || (item.status === 'verifying'
        && !(ledger.terminalFailure && ledger.terminalFailure.task === item.id))));
  if (verificationLive) {
    return ok({
      scope: 'blueprint', action: 'verification_node', cwd: integrationCwd, task: verificationLive.id,
      argv: coordinateArgv('integrate', blueprint, ledgerRef, {
        task: verificationLive.id, item: verificationLive,
      }),
    });
  }
  if (checkpoint.ready.length > 0) {
    return ok({
      scope: 'blueprint', action: 'prepare', cwd: integrationCwd,
      argv: coordinateArgv('prepare', blueprint, ledgerRef),
    });
  }
  const allIntegrated = ledger.tasks.length > 0
    && ledger.tasks.every((item) => item.status === 'integrated');
  if (allIntegrated && isBlueprintReviewModeAt(integrationCwd, blueprint)) {
    const rootReview = bouncerStatus(integrationCwd, `${blueprint.replaceAll('\\', '/')}/review.md`);
    if (rootReview !== 'accepted') {
      const head = typeof ledger.integrationHead === 'string'
        ? ledger.integrationHead
        : git(exec, integrationCwd, ['rev-parse', 'HEAD']);
      const base = typeof ledger.base === 'string' ? ledger.base : head;
      return ok({
        scope: 'blueprint', action: 'final_review', cwd: integrationCwd,
        argv: [
          'bouncer', 'review-dispatch', 'execute', '--blueprint', blueprint,
          '--base', base, '--head', head,
        ],
        judge: { kind: 'review-round', fields: [] },
      });
    }
  }
  if (allIntegrated) {
    return ok({ scope: 'blueprint', action: 'done', cwd: integrationCwd });
  }
  return ok({
    scope: 'blueprint', action: 'blocked', reason: 'no-ready-task', cwd: integrationCwd,
  });
}

/**
 * task 범위. verification --task는 즉시 거절하고, prepared가 아닌 상태는 none이다.
 * reported `scope_revision`은 brief hash가 보고 때와 같으면 revise, 다르면
 * 개정이 반영된 것으로 보고 재디스패치한다.
 *
 * @param {object} ctx - 읽기 스냅샷
 * @param {string} ctx.repoRoot - 메인 루트
 * @param {string} ctx.blueprint - blueprint 경로
 * @param {string} ctx.task - --task 값
 * @param {Exec} ctx.exec - git
 * @param {Ledger} ctx.ledger - 원장
 * @param {LedgerRef} ctx.ledgerRef - fence
 * @param {{ ready: string[] }} ctx.checkpoint - unused, 시그니처 대칭
 * @param {string} ctx.integrationCwd - integration
 * @param {{ workerPath?: string }} ctx.integration - coordinatorPaths는 호출부에서 다시 계산
 * @returns {NextOk | NextErr} 판정
 */
function taskNext(ctx: {
  repoRoot: string; blueprint: string; task: string; exec: Exec; ledger: Ledger;
  ledgerRef: LedgerRef; checkpoint: { ready: string[] }; integrationCwd: string;
  integration: { workerPath?: string; integrationPath: string };
}): NextOk | NextErr {
  const { repoRoot, blueprint, task, exec, ledger, ledgerRef, integrationCwd } = ctx;
  if (!/^\d{3}$/.test(task)) return fail('task-required');
  const item = ledger.tasks.find((entry) => entry.id === task);
  if (!item) return fail('task-outside-blueprint');
  if (item.execution_kind === 'verification') return fail('verification-task-uses-blueprint-next');

  const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
  const cwd = item.workerPath || worker;
  const ok = (body: Built) => succeed({ ...body, task }, body.cwd, ledgerRef);
  const status = item.status || 'pending';
  if (status === 'recorded' || status === 'integrated' || status === 'pending' || status === 'ready') {
    return ok({
      scope: 'task', action: 'none', reason: status, cwd,
    });
  }
  if (status !== 'prepared') {
    return ok({
      scope: 'task', action: 'blocked', reason: 'commit-evidence-mismatch', cwd,
    });
  }

  if (item.criticalRecovery && item.criticalRecovery.outcome === null) {
    return ok({
      scope: 'task', action: 'blocked', reason: 'critical-recovery-open', cwd,
    });
  }
  if (!item.dispatch) {
    return ok({
      scope: 'task', action: 'dispatch', cwd,
      argv: coordinateArgv('dispatch', blueprint, ledgerRef, { task, item }),
      judge: { kind: 'intent-symbols', fields: [] },
    });
  }
  if (item.dispatch.status === 'reported' && item.dispatch.outcome === 'accepted') {
    return ok({
      scope: 'task', action: 'record', cwd,
      argv: coordinateArgv('record', blueprint, ledgerRef, { task, item }),
      judge: { kind: 'record-decision', fields: ['--decision'] },
    });
  }
  if (item.dispatch.status === 'reported' && item.dispatch.outcome === 'scope_revision') {
    let currentHash: string | undefined;
    try {
      currentHash = taskBriefHashOf(cwd, blueprint, task);
    } catch (error) {
      // 문서 부재(ENOENT)만 흡수한다. hash를 못 읽으면 같은 brief라고 단정하지 않는다.
      if ((error as { code?: string }).code !== 'ENOENT') throw error;
    }
    if (currentHash === item.dispatch.task_brief_hash) {
      return ok({
        scope: 'task', action: 'revise', cwd,
        argv: coordinateArgv('revise', blueprint, ledgerRef, { task, item }),
        judge: { kind: 'scope-revision', fields: ['--paths', '--reason'] },
      });
    }
    // hash가 보고 때와 다르면 이미 개정이 반영된 상태다. 표의 말단
    // commit-evidence-mismatch로 접으면 재디스패치가 막히므로 아래 reported
    // 분기로 떨어뜨린다.
  }
  if (item.dispatch.status === 'reported' && item.dispatch.outcome === 'blocked') {
    return ok({
      scope: 'task', action: 'blocked', reason: 'task-reported-blocked', cwd,
    });
  }
  if (item.dispatch.status === 'reported') {
    return ok({
      scope: 'task', action: 'dispatch', cwd,
      argv: coordinateArgv('dispatch', blueprint, ledgerRef, { task, item }),
      judge: { kind: 'intent-symbols', fields: [] },
    });
  }
  if (item.dispatch.status !== 'active') {
    return ok({
      scope: 'task', action: 'blocked', reason: 'commit-evidence-mismatch', cwd,
    });
  }

  const workerHead = git(exec, cwd, ['rev-parse', 'HEAD']);
  const porcelainText = initialWorktreeState(exec, cwd);
  if (workerHead === item.dispatch.base_head
    && porcelainText === item.dispatch.initial_worktree_state) {
    const payload: Record<string, unknown> = {
      attempt: item.dispatch.attempt,
      task_brief_hash: item.dispatch.task_brief_hash,
      base_head: item.dispatch.base_head,
      initial_worktree_state: item.dispatch.initial_worktree_state,
    };
    const previous = lastReportedOutcome(item);
    if (previous) payload.previous_outcome = previous;
    return ok({ scope: 'task', action: 'implement', cwd, payload });
  }

  const tasksRel = `${blueprint.replaceAll('\\', '/')}/tasks/${task}/tasks.md`;
  const verifyRel = `${blueprint.replaceAll('\\', '/')}/tasks/${task}/verification.md`;
  const reviewRel = `${blueprint.replaceAll('\\', '/')}/tasks/${task}/review.md`;
  const tasksBlock = readBouncerBlock(path.join(cwd, tasksRel));
  const tasksStatus = tasksBlock ? tasksBlock.status : undefined;
  const verifyStatus = bouncerStatus(cwd, verifyRel);
  if (tasksStatus !== 'verified' || verifyStatus !== 'passed') {
    return ok({
      scope: 'task', action: 'verify', cwd,
      argv: ['bouncer', 'validate', '--blueprint', blueprint, '--gate', 'execute'],
    });
  }
  if (!isBlueprintReviewModeAt(integrationCwd, blueprint)
    && bouncerStatus(cwd, reviewRel) !== 'accepted') {
    let mergeBase: string;
    try {
      const integrationHead = typeof ledger.integrationHead === 'string'
        ? ledger.integrationHead
        : git(exec, integrationCwd, ['rev-parse', 'HEAD']);
      mergeBase = git(exec, cwd, ['merge-base', integrationHead, workerHead]);
    } catch (_error) {
      // merge-base 실패는 추측한 base를 넣지 않고 표의 말단 blocked로 접는다.
      return ok({
        scope: 'task', action: 'blocked', reason: 'commit-evidence-mismatch', cwd,
      });
    }
    return ok({
      scope: 'task', action: 'review', cwd,
      argv: [
        'bouncer', 'review-dispatch', 'execute', '--blueprint', blueprint, '--task', task,
        '--base', mergeBase, '--head', workerHead,
      ],
      judge: { kind: 'review-round', fields: [] },
    });
  }

  const stamped = tasksBlock ? tasksBlock.commit_sha : undefined;
  if (stamped === undefined || stamped === null || stamped === '') {
    return ok({
      scope: 'task', action: 'commit', cwd,
      argv: ['bouncer', 'commit', '--blueprint', blueprint, '--yes'],
    });
  }
  const shortHead = workerHead.slice(0, 8).toLowerCase();
  const shortStamp = normalizeCommitSha(stamped);
  const extras = dirtyPaths(porcelainText);
  if (shortStamp === shortHead && onlyTaskBriefDirty(extras, blueprint, task)) {
    return ok({
      scope: 'task', action: 'report', cwd,
      argv: coordinateArgv('report', blueprint, ledgerRef, { task, item }, [
        '--attempt', String(item.dispatch.attempt),
        '--task-brief-hash', item.dispatch.task_brief_hash,
      ]),
      judge: {
        kind: 'report-outcome',
        fields: ['--outcome', '--summary'],
        allowed: ['accepted', 'rework', 'scope_revision', 'task_change', 'blocked'],
      },
    });
  }
  return ok({
    scope: 'task', action: 'blocked', reason: 'commit-evidence-mismatch', cwd,
  });
}

/**
 * 재디스패치 뒤 implement payload용 직전 보고. dispatch 객체는 attempt를
 * 덮어쓰므로 decisions의 마지막 report만 복구한다.
 *
 * @param {LedgerTask} item - prepared task
 * @returns {{ outcome: string, summary: string } | undefined} 있으면 previous_outcome
 */
function lastReportedOutcome(item: LedgerTask): { outcome: string; summary: string } | undefined {
  const decisions = Array.isArray(item.decisions) ? item.decisions : [];
  for (let i = decisions.length - 1; i >= 0; i -= 1) {
    const entry = decisions[i];
    if (entry && entry.kind === 'report' && typeof entry.outcome === 'string'
      && typeof entry.summary === 'string') {
      return { outcome: entry.outcome, summary: entry.summary };
    }
  }
  return undefined;
}

export = { coordinateNext, NEXT_FAILURE_HINTS };
