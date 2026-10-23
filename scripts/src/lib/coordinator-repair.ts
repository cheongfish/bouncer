'use strict';
const fs = require('node:fs');
const path = require('node:path');
import runtime = require('./runtime-state');
import frontmatter = require('./frontmatter');
const { parseFrontmatter, readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import pathsMod = require('./paths');
const { parsePathIds } = pathsMod;
import contextIdsMod = require('./context-ids');
const { parseContextPath } = contextIdsMod;
import validateSections = require('./validate-sections');
const { REPAIR_WAVE_LIMIT } = validateSections;
import executionDag = require('./execution-dag');
const { pathSetOf } = executionDag;
import scopeMod = require('./scope');
const { withLedgerLock } = scopeMod;
import commandArgvMod = require('./command-argv');
import leaseMod = require('./lease');
const { checkLease, revokeLease } = leaseMod;
import type {
  Task, Ledger, FailureEvidence, RepairDecision, OutsideScopeDisposition, Exec, VerificationRunner,
} from './execution-contracts';
import coordinatorLedger = require('./coordinator-ledger');
const { ledgerBytesHash } = coordinatorLedger;
import coordinatorGit = require('./coordinator-git');
const { git } = coordinatorGit;
import coordinatorVerification = require('./coordinator-verification');
const { prepareVerificationDependencies, selectVerificationRunner, runTargetVerification } = coordinatorVerification;
import coordinatorWorker = require('./coordinator-worker');
const {
  readBouncerBlock, isBlueprintReviewModeAt, reviewContractAt, ensureIntegrationCwd, currentScopePaths,
  normalizeSupplementPath, porcelainPaths,
} = coordinatorWorker;

// 실패 복구 계열(repair·supplement 완료·partial-close·critical-recovery)의 정본이다.
// coordinator-commands가 이 모듈을 가져오고, 이 모듈은 coordinator-commands·coordinator를 가져오지 않아
// 순환이 없다. 정상 경로와 공유하는 helper는 하위 모듈에서 가져오거나 `RepairSupport`로 받는다.

/** handler 결과. 성공·거절 payload 모양이 명령마다 달라 공통 필드를 강제하지 않는다. */
type RepairResult = { ok: boolean; reason?: string } & Record<string, unknown>;

/** 이 모듈이 읽는 인자 필드만 선언한다. coordinator-commands의 `CoordinateArgs`가 구조적으로 만족한다. */
type RepairArgs = {
  command: string; repoRoot: string; blueprint: string; task?: string; decision?: unknown;
  failureCommand?: string; summary?: string; paths?: string[]; userConfirmed?: boolean;
  findings?: string[]; reviewFindings?: string[]; kind?: string; outcome?: string; reason?: string;
  resumeTask?: string; disposition?: string; newPaths?: string[]; verify?: string;
  leaseId?: string; generation?: number;
};

/** partial-close가 main checkout handoff를 쓰는 함수. 테스트가 `deps.appendHandoff`로 바꿔 끼운다. */
type AppendHandoff = (mainRoot: string, file: string, record: string) => () => void;

/** 원장 lock 안에서 fence를 통과한 뒤의 handler 문맥. `LockedCtx`가 구조적으로 만족한다. */
type RepairCtx = {
  args: RepairArgs;
  cwd: string;
  deps: { appendHandoff?: AppendHandoff };
  exec: Exec;
  main: { projectRoot?: string };
  integration: { integrationPath: string; ledgerFile: string };
  ledger: Ledger;
  commitWrite: () => { ok: false; reason: 'ledger-lock-lost' } | null;
};

/** task 조회를 마친 뒤의 handler 문맥. `TaskCtx`가 구조적으로 만족한다. */
type RepairTaskCtx = RepairCtx & { item: Task; task: string };

type LedgerFail = { ok: false; reason: string };
type OpenedLedger = { ok: true; ledger: Ledger; bytes: Buffer };

// revoke된 worker 보존 결과. coordinator-commands의 salvageRevokedWorker 반환형과 같은 모양이다.
type SalvageResult = { patch?: string; ref?: string; dirty_paths: string[]; head: string; generation: number };
type SalvageEntry = SalvageResult & { task: string };
// revoke된 worker를 지우기 전에 보존한 산출물 기록. patch·ref는 해당 산출물이 있을 때만 있다.
type WorkerSalvageDecision = {
  task: string; kind: 'worker-salvage'; generation: number; head: string;
  patch?: string; ref?: string; dirty_paths: string[];
};

/**
 * 정상 경로와 복구 경로가 함께 쓰는 helper. 정상 경로 쪽 정의가 coordinator-commands에 있어
 * 거기서 가져오면 순환이 생기므로, handler를 표에 연결하는 coordinator-commands가 인자로 넘긴다.
 */
type RepairSupport = {
  openLedgerFenced: (
    opts: { ledgerFile: string; ledgerPath?: string; ledgerHash?: string },
  ) => OpenedLedger | LedgerFail;
  recheckLedgerCheckpoint: (opts: { ledgerFile: string; expectedHash: string | null }) => OpenedLedger | LedgerFail;
  intentIdFor: (blueprint: string) => string;
  verificationPolicyAt: (root: string, blueprint: string) => 'scoped_terminal' | 'legacy' | null;
  salvageRevokedWorker: (exec: Exec, integrationPath: string, item: Task, integrationHead: string) => SalvageResult;
  withCheckpoint: <T extends { ok: true }>(
    result: T, ledger: Ledger, ledgerFile: string,
  ) => T & { checkpoint: unknown };
};

type SupplementDecision = {
  kind: 'supplement'; outcome: 'pending' | 'verified'; paths: string[]; findings: string[];
};
type CriticalRecoveryDecision = {
  task: string; kind: 'critical-recovery'; used: 1; findings: string[];
  reason: string; outcome: 'resolved' | 'blocked' | null;
};

function sourceRepairPaths(paths: unknown): paths is string[] {
  return Array.isArray(paths) && paths.length > 0 && paths.every((entry) => {
    if (typeof entry !== 'string') return false;
    const candidate = entry.replaceAll('\\', '/').trim();
    if (!candidate || path.posix.isAbsolute(candidate) || /^[A-Za-z]:\//.test(candidate) || candidate.startsWith('~')
      || /[*?[\]{}]/.test(candidate) || candidate.split('/').includes('..')) return false;
    const normalized = path.posix.normalize(candidate);
    return normalized !== '.' && normalized !== './' && normalized !== '..' && !normalized.startsWith('../')
      && normalized !== '.git' && !normalized.startsWith('.git/')
      && normalized !== '.bouncer' && !normalized.startsWith('.bouncer/');
  });
}

/** repair 생성 전 검사 결과. 통과하면 최종 scope와(있으면) 확정 verify를 돌려준다. */
type RepairIntake =
  | { ok: true; paths: string[]; verify?: string }
  | { ok: false; reason: string; paths?: string[] };

/**
 * repair 생성값(경로·verify)을 ledger 객체 수정과 문서 쓰기 전에 검사한다.
 * scoped_terminal repair가 종단 전체 명령과 추측한 경로를 받아 재배정이 반복되던
 * 문제를 생성 시점에 막는 단일 지점이다. CI·리뷰 원인 두 분기가 같은 검사를 쓴다.
 *
 * 1. `--paths`는 integration HEAD에서 추적돼야 하고, `--new-path`는 부모 디렉터리가
 *    추적 파일의 조상이어야 한다(git 실패는 삼키지 않고 던진다).
 * 2. scoped_terminal은 `--verify`가 필수이며 G20과 같은 규칙(단일 argv, 종단 명령과
 *    다름)을 통과해야 한다. legacy·정책 미상은 `--verify`가 없으면 기존
 *    `resolveRepairVerify` 결과를 그대로 쓰도록 verify를 비워 두고, 있으면 단일
 *    argv 검사만 적용한다 — 종단 비교와 필수 검사는 scoped_terminal 전용이다.
 *
 * @param {object} opts
 * @param {RepairSupport} opts.support - 정상 경로 helper(verification policy 조회)
 * @param {Exec} opts.exec - git 실행기
 * @param {string} opts.integrationPath - integration worktree 절대 경로
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {Ledger} opts.ledger - 종단(verification) task 목록을 읽을 원장
 * @param {string[]} opts.paths - `--paths`
 * @param {string[]} opts.newPaths - `--new-path`
 * @param {string | undefined} opts.verify - `--verify`
 * @returns {RepairIntake} 거절 사유(와 위반 경로) 또는 최종 scope·verify
 */
function checkRepairIntake({ exec, integrationPath, blueprint, ledger, paths, newPaths, verify, support }: {
  support: RepairSupport; exec: Exec; integrationPath: string; blueprint: string; ledger: Ledger;
  paths: string[]; newPaths: string[]; verify: string | undefined;
}): RepairIntake {
  if (newPaths.length > 0 && !sourceRepairPaths(newPaths)) {
    return { ok: false, reason: 'repair-scope-out-of-bounds' };
  }
  const violations = scopeMod.trackedScopeViolations(exec, integrationPath, paths, newPaths);
  if (violations.untracked.length > 0) {
    return { ok: false, reason: 'scope-path-untracked', paths: violations.untracked };
  }
  if (violations.parentMissing.length > 0) {
    return { ok: false, reason: 'scope-new-path-parent-missing', paths: violations.parentMissing };
  }
  const finalPaths = [...new Set([...paths, ...newPaths])];
  const scoped = support.verificationPolicyAt(integrationPath, blueprint) === 'scoped_terminal';
  if (verify === undefined) {
    if (scoped) return { ok: false, reason: 'repair-verify-required' };
    return { ok: true, paths: finalPaths };
  }
  if (commandArgvMod.parseVerifyArgv(verify) === null) {
    return { ok: false, reason: 'repair-verify-not-single-argv' };
  }
  if (scoped) {
    const normalized = commandArgvMod.normalizeVerifyCommand(verify);
    for (const terminal of ledger.tasks.filter((entry) => entry.execution_kind === 'verification')) {
      const data = readBouncerBlock(path.join(integrationPath, blueprint, 'tasks', terminal.id, 'tasks.md'));
      const terminalVerify = data && typeof data === 'object'
        ? (data as Record<string, unknown>).verify : undefined;
      if (typeof terminalVerify === 'string'
        && commandArgvMod.normalizeVerifyCommand(terminalVerify) === normalized) {
        return { ok: false, reason: 'repair-verify-is-terminal' };
      }
    }
  }
  return { ok: true, paths: finalPaths, verify };
}

/**
 * 테스트 경로 판정. 첫 조각이 `test`·`tests`이거나 파일명이 `*.test.*`·`*.spec.*`이고
 * 경로 어디에도 `fixtures` 조각이 없는 경로만 true다. fixtures는 테스트가 읽는
 * 데이터라 제품 동작을 바꿀 수 있어 제자리 보완 대상에서 뺀다.
 *
 * @param {string} normalized - normalizeSupplementPath를 거친 경로
 * @returns {boolean} 테스트 경로이면 true
 */
function isSupplementTestPath(normalized: string): boolean {
  const parts = normalized.split('/');
  if (parts.includes('fixtures')) return false;
  const base = parts[parts.length - 1];
  return parts[0] === 'test' || parts[0] === 'tests' || /\.(test|spec)\./.test(base);
}

/**
 * 경로가 허용 경로 목록 중 하나와 같거나 그 아래인지 본다.
 *
 * @param {string} normalized - 비교할 정규형 경로
 * @param {string[]} allowed - 정규형이 아니어도 되는 허용 경로(파일 또는 디렉터리)
 * @returns {boolean} 포함되면 true
 */
function coveredByPaths(normalized: string, allowed: string[]): boolean {
  return allowed.some((entry) => {
    const base = normalizeSupplementPath(entry);
    return normalized === base || normalized.startsWith(`${base}/`);
  });
}

/**
 * 원장에서 가장 최근 supplement 결정을 찾는다. 같은 kind가 여러 번 쌓여도
 * 마지막 하나만 현재 상태를 말한다.
 *
 * @param {Ledger} ledger - 원장
 * @returns {SupplementDecision | undefined} 최신 supplement 결정, 없으면 undefined
 */
function latestSupplementDecision(ledger: Ledger): SupplementDecision | undefined {
  for (let i = ledger.decisions.length - 1; i >= 0; i -= 1) {
    const entry = ledger.decisions[i] as { kind?: unknown } | null;
    if (entry && typeof entry === 'object' && entry.kind === 'supplement') {
      return entry as SupplementDecision;
    }
  }
  return undefined;
}

/**
 * blueprint 루트 `review.md`에 delta 라운드가 이미 있는지 읽는다. review-record의
 * helper가 아니라 문서를 직접 읽는 것은 그 모듈이 허용 시퀀스를 소유하기 때문이다.
 * 문서가 없으면 아직 라운드가 없는 것으로 본다.
 *
 * @param {string} integrationPath - integration worktree
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {boolean} `bouncer.review.rounds[].mode`에 delta가 있으면 true
 */
function rootReviewHasDelta(integrationPath: string, blueprint: string): boolean {
  let data: unknown;
  try {
    data = readDoc(path.join(integrationPath, blueprint, 'review.md')).data;
  } catch (error) {
    // 문서 부재(ENOENT)만 "라운드 없음"으로 흡수한다. YAML 파손 같은 다른 실패를
    // 없음으로 접으면 delta를 이미 쓴 리뷰에 supplement가 한 번 더 열린다.
    if ((error as { code?: string }).code === 'ENOENT') return false;
    throw error;
  }
  const bouncer = (data as { bouncer?: { review?: { rounds?: unknown } } } | undefined)?.bouncer;
  const rounds = bouncer?.review?.rounds;
  return Array.isArray(rounds)
    && rounds.some((round) => (round as { mode?: unknown } | null)?.mode === 'delta');
}

/**
 * blueprint 최종 리뷰가 이미 discovery 한 라운드를 저장했는지 본다. 최종 리뷰는 그 한
 * 라운드로 끝나므로, 저장된 뒤에는 리뷰 원인 repair·supplement가 원장과 task를 쓰기
 * 전에 거절돼야 한다. 리뷰 모드 blueprint의 root `review.md`만 대상으로 하며, 문서 부재
 * (ENOENT)만 "라운드 없음"으로 흡수한다. YAML 파손을 없음으로 접으면 이미 끝난 리뷰에
 * repair가 다시 열리므로 다른 오류는 올린다.
 *
 * @param {string} integrationPath - integration worktree
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {boolean} 리뷰 모드이고 `bouncer.review.rounds[].mode`에 discovery가 있으면 true
 */
function finalReviewDiscoveryStored(integrationPath: string, blueprint: string): boolean {
  if (!isBlueprintReviewModeAt(integrationPath, blueprint)) return false;
  let data: unknown;
  try {
    data = readDoc(path.join(integrationPath, blueprint, 'review.md')).data;
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return false;
    throw error;
  }
  const rounds = (data as { bouncer?: { review?: { rounds?: unknown } } } | undefined)
    ?.bouncer?.review?.rounds;
  return Array.isArray(rounds)
    && rounds.some((round) => (round as { mode?: unknown } | null)?.mode === 'discovery');
}

/**
 * 원장에 리뷰 원인 repair decision(`kind: 'repair'`, `failure.command: 'review'`)이 이미 있는지 본다.
 * 표식 blueprint의 최종 리뷰는 이 repair를 한 번만 허용하므로, 두 번째 접수를 가르는 기준이다.
 *
 * @param {Ledger} ledger - 열린 원장
 * @returns {boolean} 리뷰 원인 repair decision이 있으면 true
 */
function hasReviewRepairDecision(ledger: Ledger): boolean {
  return (ledger.decisions || []).some((entry) => {
    const item = entry as { kind?: unknown; failure?: { command?: unknown } } | null;
    return item?.kind === 'repair' && item.failure?.command === 'review';
  });
}

/**
 * 최종 리뷰 이후 리뷰 원인 repair·supplement 접수 여부를 한 곳에서 판정한다. 표식이 허용 밖의
 * 값이면 구형으로 접지 않고 거절한다. 구형 blueprint는 discovery 뒤 전부 거절하고, `brief`
 * 표식은 discovery 뒤 승인된 경로 안의 리뷰 원인 repair를 한 번(delta 전·이전 repair 없음)만
 * 받는다. 거절은 원장·문서를 쓰기 전에 끝난다.
 *
 * @param {object} opts - 판정 입력
 * @param {string} opts.integrationPath - integration worktree
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {Ledger} opts.ledger - 열린 원장(읽기만 한다)
 * @param {boolean} opts.supplement - supplement 접수이면 true, 리뷰 원인 repair이면 false
 * @param {string[]} [opts.newPaths] - 리뷰 원인 repair가 선언한 새 경로
 * @returns {{ ok: false; reason: string } | null} 거절이면 reason, 접수 가능이면 null
 */
function finalReviewGate(opts: {
  integrationPath: string; blueprint: string; ledger: Ledger; supplement: boolean; newPaths?: string[];
}): { ok: false; reason: string } | null {
  const { integrationPath, blueprint, ledger, supplement, newPaths } = opts;
  const contract = reviewContractAt(integrationPath, blueprint);
  if (contract === null) return { ok: false, reason: 'review-contract-invalid' };
  if (!finalReviewDiscoveryStored(integrationPath, blueprint)) return null;
  // supplement는 표식과 무관하게 discovery 뒤에 닫힌다. 수정 기회는 repair 한 번뿐이다.
  if (contract !== 'brief' || supplement) return { ok: false, reason: 'final-review-single-round' };
  if (hasReviewRepairDecision(ledger) || rootReviewHasDelta(integrationPath, blueprint)) {
    return { ok: false, reason: 'final-review-single-round' };
  }
  // 새 경로는 승인된 affected_paths 밖이다. 최종 리뷰의 수정 1회는 승인 범위 안에서만 열린다.
  if (newPaths && newPaths.length > 0) return { ok: false, reason: 'final-review-repair-scope' };
  return null;
}

/**
 * integration worktree에서 커밋되지 않은 변경 경로를 모은다(추적·미추적 모두).
 * `.bouncer/` 아래는 원장·증적이라 보완 범위 판정에서 뺀다. rename은 양쪽 경로를 낸다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} integrationPath - integration worktree
 * @returns {string[]} 정규형 변경 경로
 */
function integrationChangedPaths(exec: Exec, integrationPath: string): string[] {
  return porcelainPaths(exec, integrationPath)
    .filter((entry) => entry !== '.bouncer' && !entry.startsWith('.bouncer/'));
}

/**
 * supplement 접수 검사. CLI는 경로 조건만 검증하고 finding이 정말 테스트 근거
 * 보완인지는 coordinator가 선언한다 — 그래서 여기서는 선언이 기계적으로 닫을 수
 * 있는 조건(테스트 경로, 승인 범위, 모든 task integrated, delta 미사용)만 본다.
 * 거절 순서는 원인이 겹칠 때 어느 쪽이 먼저 보이는지만 정한다.
 *
 * @param {object} opts - 접수 입력
 * @param {Ledger} opts.ledger - 원장(읽기 전용)
 * @param {string} opts.integrationPath - integration worktree
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string | undefined} opts.failureCommand - CI 원인 플래그(있으면 모호)
 * @param {string[] | undefined} opts.reviewFindings - 최종 리뷰 finding id
 * @param {string | undefined} opts.summary - 보완 필요 사유
 * @param {unknown} opts.paths - `--paths`
 * @returns {{ ok: true, paths: string[], findings: string[] } | { ok: false, reason: string }} 통과 시
 *   정규화된 경로와 finding, 거절 시 reason
 */
function checkSupplementIntake({ ledger, integrationPath, blueprint, failureCommand, reviewFindings, summary, paths }: {
  ledger: Ledger; integrationPath: string; blueprint: string; failureCommand?: string;
  reviewFindings?: string[]; summary?: string; paths: unknown;
}): { ok: true; paths: string[]; findings: string[] } | { ok: false; reason: string } {
  if (typeof failureCommand === 'string') return { ok: false, reason: 'repair-cause-ambiguous' };
  if (!Array.isArray(reviewFindings) || reviewFindings.length === 0
    || reviewFindings.some((entry) => typeof entry !== 'string' || entry === '')
    || typeof summary !== 'string' || summary === '') {
    return { ok: false, reason: 'failure-evidence-required' };
  }
  if (!sourceRepairPaths(paths)) return { ok: false, reason: 'repair-scope-out-of-bounds' };
  const normalized = paths.map(normalizeSupplementPath);
  if (!normalized.every(isSupplementTestPath)) return { ok: false, reason: 'supplement-paths-not-tests' };
  if (ledger.tasks.some((entry) => (entry.status || 'pending') !== 'integrated')) {
    return { ok: false, reason: 'review-repair-requires-integrated' };
  }
  const approved = ledger.tasks.flatMap((entry) => pathSetOf(entry) || []);
  if (!normalized.every((entry) => coveredByPaths(entry, approved))) {
    return { ok: false, reason: 'repair-scope-out-of-bounds' };
  }
  if (rootReviewHasDelta(integrationPath, blueprint)) return { ok: false, reason: 'supplement-delta-used' };
  return { ok: true, paths: normalized, findings: [...reviewFindings] };
}

/**
 * `coordinate repair --kind supplement --done`. implementer가 integration에 남긴
 * 변경이 접수된 경로 안인지 확인하고, 그 경로를 덮는 integrated task의 verify를
 * 명령 중복 없이 기존 러너로 돌린 뒤 결정을 `verified`로 올린다. 검증은 오래 걸릴
 * 수 있어 integrateVerificationTask와 같이 잠금 밖에서 돌리고, 두 번째 잠금에서
 * 원장 bytes가 그대로일 때만 쓴다. 실패하면 결정은 pending에 남아 재시도할 수 있다.
 *
 * @param {object} opts - repair 인자
 * @param {RepairSupport} opts.support - 원장 fence·재확인·checkpoint helper
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string} opts.integrationPath - integration worktree
 * @param {string} opts.ledgerFile - 원장 절대 경로
 * @param {string} [opts.ledgerPath] - fence 원장 상대 경로
 * @param {string} [opts.ledgerHash] - fence sha256
 * @param {Exec} opts.exec - git·npm 주입 실행기
 * @param {Function} opts.writeLedger - 원장 원자 쓰기
 * @param {{ runVerification?: VerificationRunner }} opts.deps - 검증 러너 주입
 * @returns {unknown} 성공 시 ok:true와 결정, 실패 시 ok:false와 reason
 */
function supplementDone({
  blueprint, integrationPath, ledgerFile, ledgerPath, ledgerHash, exec, writeLedger, deps, support,
}: {
  support: RepairSupport; blueprint: string; integrationPath: string; ledgerFile: string;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  deps: { runVerification?: VerificationRunner };
}): unknown {
  let phase1Hash = '';
  let plan: Array<{ taskId: string; verify: string }> = [];
  let approvedPaths: string[] = [];
  const phase1 = withLedgerLock(ledgerFile, () => {
    const opened = support.openLedgerFenced({ ledgerFile, ledgerPath, ledgerHash });
    if (!opened.ok) return opened;
    const { ledger, bytes } = opened;
    if (ledger.status === 'promotion_stopped') return { ok: false, reason: 'promotion-stopped' };
    const pending = latestSupplementDecision(ledger);
    // 거절은 검증 실행과 원장 쓰기보다 앞선다. 최종 discovery 뒤에는 보완 완료도 받지 않는다.
    const gate = finalReviewGate({ integrationPath, blueprint, ledger, supplement: true });
    if (gate) return gate;
    if (!pending || pending.outcome !== 'pending') return { ok: false, reason: 'supplement-not-pending' };
    // 검증이 만드는 증적 파일이 변경 목록에 섞이지 않게 검증 전에 잰다.
    const changed = integrationChangedPaths(exec, integrationPath);
    if (!changed.every((entry) => coveredByPaths(entry, pending.paths))) {
      return { ok: false, reason: 'supplement-paths-exceeded', paths: changed };
    }
    const seen = new Set<string>();
    const next: Array<{ taskId: string; verify: string }> = [];
    for (const entry of ledger.tasks) {
      const own = pathSetOf(entry) || [];
      if (!pending.paths.some((target) => coveredByPaths(target, own))) continue;
      const block = readBouncerBlock(path.join(integrationPath, blueprint, 'tasks', entry.id, 'tasks.md'));
      const verify = block && typeof block.verify === 'string' ? block.verify.trim() : '';
      if (seen.has(verify)) continue;
      seen.add(verify);
      next.push({ taskId: entry.id, verify });
    }
    plan = next;
    approvedPaths = [...pending.paths];
    phase1Hash = ledgerBytesHash(bytes);
    return { ok: true as const };
  });
  if (!phase1 || (phase1 as { ok?: boolean }).ok === false) return phase1;

  // 잠금 밖: 의존성 준비 후 verify 실행. integration checkout은 추적 파일만 받아
  // node_modules가 비어 있을 수 있다.
  const prepared = prepareVerificationDependencies(integrationPath, exec);
  if (!prepared.ok) return { ok: false, reason: 'dependency-install-failed', message: prepared.message };
  const runner = selectVerificationRunner(deps.runVerification);
  const intentId = support.intentIdFor(blueprint);
  const head = git(exec, integrationPath, ['rev-parse', 'HEAD']);
  const evidenceIds: string[] = [];
  for (const step of plan) {
    const result = runTargetVerification(runner, {
      repoRoot: integrationPath,
      blueprintDir: blueprint,
      taskId: step.taskId,
      scope: { kind: 'wave', key: `${intentId}:supplement:${head}` },
    });
    if (!result.ok) {
      return { ok: false, reason: 'supplement-verify-failed', verification: result };
    }
    if (typeof result.evidenceId === 'string' && result.evidenceId !== '') evidenceIds.push(result.evidenceId);
  }

  return withLedgerLock(ledgerFile, (owns) => {
    const rechecked = support.recheckLedgerCheckpoint({ ledgerFile, expectedHash: phase1Hash });
    if (!rechecked.ok) return rechecked;
    const { ledger } = rechecked;
    const decision = latestSupplementDecision(ledger);
    if (!decision) return { ok: false, reason: 'supplement-not-pending' };
    decision.outcome = 'verified';
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(ledgerFile, ledger);
    return support.withCheckpoint({
      ok: true as const, command: 'repair', kind: 'supplement', done: true, paths: approvedPaths,
      decision, evidence_ids: evidenceIds,
    }, ledger, ledgerFile);
  });
}

type TerminalResolution =
  | { ok: false; reason: string; [key: string]: unknown }
  | {
    ok: true; kind: 'disposition'; terminal: Task; failure: FailureEvidence;
    record: { kind: 'disposition'; task: string; summary: string; disposition: OutsideScopeDisposition };
  }
  | {
    ok: true; kind: 'resume'; terminal: Task; target: Task; failure: FailureEvidence;
    repairDecision: RepairDecision; revision: string; previousHead: string | null;
    resetDownstream: Task[]; salvage: SalvageEntry[];
  };

/**
 * terminal 검증 실패를 "기존 task 재배정(resume)" 또는 "범위 밖 분류(disposition)"로 해소하기 위한
 * 모든 판정을 한 곳에서 한다. 이 함수는 원장·문서·Git을 바꾸지 않는다 — 호출자가 ok일 때만
 * 변경을 적용하므로, 어떤 거절도 실패 상태(terminalFailure·verifying)를 건드리지 않는다.
 *
 * 공통 거절: terminal이 아닌 task(`terminal-failure-required`), 증거 누락(`failure-evidence-required`),
 * 결정 근거 누락(`decision-reason-required`), 소스 경로가 아닌 `--paths`(`repair-scope-out-of-bounds`),
 * 기록된 실패와 다른 task·command(`failure-evidence-mismatch`).
 * resume 거절: 형식 오류·terminal 자신·미통합 task(`resume-task-invalid`), 이 blueprint에 없는
 * task(`task-outside-blueprint`), stale lease(`stale-lease`), stale failure identity, owner의
 * 승인 범위 밖 경로(`repair-scope-out-of-bounds`), wave 한도(`repair-wave-limit`), salvage 실패.
 * disposition 거절: 알 수 없는 종류(`disposition-invalid`), 비활성 원장(`ledger-not-active`),
 * 원본 evidence/source identity 없음(`disposition-evidence-required`), 소스가 실패 뒤 바뀜
 * (`disposition-stale-source`), 어느 task 범위와 겹치는 경로(`disposition-scope-mixed`).
 *
 * @param {object} opts - 판정 입력
 * @param {RepairSupport} opts.support - worker 보존 helper
 * @param {Ledger} opts.ledger - 읽기 전용으로 쓰는 현재 원장
 * @param {Exec} opts.exec - git 실행기(integration HEAD 조회)
 * @param {string} opts.integrationPath - integration worktree 경로
 * @param {string | undefined} opts.task - 실패한 terminal task id
 * @param {string | undefined} opts.failureCommand - 호출자가 주장하는 실패 command
 * @param {string | undefined} opts.summary - 원인·실패 테스트·필요 변경의 범위 판단
 * @param {unknown} opts.decision - 결정 근거
 * @param {unknown} opts.repairPaths - `--paths`
 * @param {string | undefined} opts.resumeTask - 재배정할 기존 task id
 * @param {string | undefined} opts.disposition - 분류 종류(`outside_scope`만 허용)
 * @param {string | undefined} opts.leaseId - 재개 owner lease fence
 * @param {number | undefined} opts.generation - 재개 owner generation fence
 * @returns {TerminalResolution} 거절 사유 또는 적용할 변경 계획
 */
function resolveTerminalFailure({
  ledger, exec, integrationPath, task, failureCommand, summary, decision, repairPaths, resumeTask,
  disposition, leaseId, generation, support,
}: {
  support: RepairSupport; ledger: Ledger; exec: Exec; integrationPath: string; task: string | undefined;
  failureCommand: string | undefined; summary: string | undefined; decision: unknown; repairPaths: unknown;
  resumeTask: string | undefined; disposition: string | undefined;
  leaseId?: string; generation?: number;
}): TerminalResolution {
  if (disposition !== undefined && disposition !== 'outside_scope') {
    return { ok: false, reason: 'disposition-invalid' };
  }
  if (!task || !/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
  const terminal = ledger.tasks.find((entry) => entry.id === task);
  if (!terminal) return { ok: false, reason: 'task-outside-blueprint' };
  if (terminal.execution_kind !== 'verification' || terminal.status !== 'verifying') {
    return { ok: false, reason: 'terminal-failure-required' };
  }
  if (disposition !== undefined && ledger.status !== undefined
    && ledger.status !== 'active' && ledger.status !== 'awaiting_confirmation') {
    return { ok: false, reason: 'ledger-not-active' };
  }
  if (typeof failureCommand !== 'string' || failureCommand === ''
    || typeof summary !== 'string' || summary.trim() === '') {
    return { ok: false, reason: 'failure-evidence-required' };
  }
  if (typeof decision !== 'string' || decision.trim() === '') {
    return { ok: false, reason: 'decision-reason-required' };
  }
  if (!sourceRepairPaths(repairPaths)) return { ok: false, reason: 'repair-scope-out-of-bounds' };
  // 지금 기록된 실패와 같은 task·command일 때만 해소한다. 다른 실패에 대한 근거를 끌어다 쓰면
  // 방금 터진 새 실패가 이전 판단으로 덮인다.
  const recorded = ledger.terminalFailure;
  if (!recorded || recorded.task !== task || recorded.command !== failureCommand) {
    return { ok: false, reason: 'failure-evidence-mismatch' };
  }
  const paths = repairPaths.map((entry) => normalizeSupplementPath(entry));

  if (disposition === 'outside_scope') {
    if (typeof recorded.evidence_id !== 'string' || recorded.evidence_id === ''
      || typeof recorded.source_digest !== 'string' || recorded.source_digest === '') {
      return { ok: false, reason: 'disposition-evidence-required' };
    }
    // 소스가 실패 뒤 바뀌었으면 원본 증거가 지금 코드를 설명하지 못한다. 원장 head와 실제 HEAD를
    // 모두 대조해 어느 한쪽만 움직인 경우도 stale로 막는다.
    const ledgerHead = typeof ledger.integrationHead === 'string' ? ledger.integrationHead : null;
    const actualHead = git(exec, integrationPath, ['rev-parse', 'HEAD']);
    if ((ledgerHead !== null && ledgerHead !== recorded.source_digest)
      || actualHead !== recorded.source_digest) {
      return { ok: false, reason: 'disposition-stale-source' };
    }
    // 범위 밖이려면 어떤 task의 승인 범위(조상·후손 포함)와도 겹치지 않아야 한다. 일부라도 겹치면
    // 범위 안 원인이 섞인 것이라 분류하지 않고 기존 blocked를 유지한다.
    const owned = ledger.tasks.flatMap((entry) => currentScopePaths(entry).map(normalizeSupplementPath));
    const overlaps = (candidate: string) => coveredByPaths(candidate, owned)
      || owned.some((entry) => entry.startsWith(`${candidate}/`));
    if (paths.some(overlaps)) return { ok: false, reason: 'disposition-scope-mixed' };
    return {
      ok: true, kind: 'disposition', terminal, failure: recorded,
      record: {
        kind: 'disposition', task, summary: summary.trim(),
        disposition: {
          kind: 'outside_scope', reason: decision.trim(), evidence_id: recorded.evidence_id,
          source_digest: recorded.source_digest, paths,
        },
      },
    };
  }

  if (typeof resumeTask !== 'string' || !/^\d{3}$/.test(resumeTask)) {
    return { ok: false, reason: 'resume-task-invalid' };
  }
  const target = ledger.tasks.find((entry) => entry.id === resumeTask);
  if (!target) return { ok: false, reason: 'task-outside-blueprint' };
  if (target.id === terminal.id || target.execution_kind === 'verification' || target.status !== 'integrated') {
    return { ok: false, reason: 'resume-task-invalid' };
  }
  const leaseCheck = checkLease(target, {
    ...(leaseId !== undefined ? { lease_id: leaseId } : {}),
    ...(generation !== undefined ? { generation } : {}),
  });
  if (!leaseCheck.ok) return { ok: false, reason: leaseCheck.reason,
    expected: leaseCheck.expected, received: leaseCheck.received };
  // 재작업 경로는 지정 task가 이미 승인받은 범위 안이어야 한다. 새 범위를 넓히는 통로가 아니다.
  const approved = currentScopePaths(target);
  if (approved.length === 0 || !paths.every((entry) => coveredByPaths(entry, approved))) {
    return { ok: false, reason: 'repair-scope-out-of-bounds' };
  }
  const waves = ledger.repairWaves || [];
  if (waves.length >= REPAIR_WAVE_LIMIT) {
    return { ok: false, reason: 'repair-wave-limit', status: 'awaiting_confirmation' };
  }
  const dag = dagSnapshot(ledger.tasks);
  const downstream = downstreamTasks(ledger.tasks, target.id);
  if (!downstream.some((entry) => entry.id === terminal.id)) {
    return { ok: false, reason: 'failure-evidence-mismatch' };
  }
  // Failure identity binds the retry to the exact integration snapshot that produced it.
  // A stale source must not turn an old CI result into authority to invalidate newer work.
  if (typeof recorded.evidence_id !== 'string' || recorded.evidence_id === ''
    || typeof recorded.source_digest !== 'string' || recorded.source_digest === ''
    || ledger.integrationHead !== recorded.source_digest
    || git(exec, integrationPath, ['rev-parse', 'HEAD']) !== recorded.source_digest) {
    return { ok: false, reason: 'failure-evidence-mismatch' };
  }
  // 이미 통합된 하위 commit task는 target 수정과 무관하게 결과가 유효하므로 건드리지 않는다.
  // 되돌릴 대상은 target과, 새 통합 결과를 다시 검증해야 하는 downstream verification task뿐이다
  // (failure-evidence-mismatch 판정은 위의 전체 downstream 폐포를 그대로 쓴다).
  const resetDownstream = downstream.filter((entry) => entry.execution_kind === 'verification');
  const resetTasks = [target];
  const salvage: SalvageEntry[] = [];
  let ownerHead: string | null = null;
  for (const item of resetTasks) {
    let saved: SalvageResult;
    try {
      saved = support.salvageRevokedWorker(exec, integrationPath, item, recorded.source_digest);
    } catch (error) {
      const partial = (error as { salvage?: SalvageResult }).salvage;
      return { ok: false, reason: 'worker-salvage-failed', task: item.id,
        message: (error as Error).message,
        salvage: [...salvage, ...(partial?.patch ? [{ ...partial, task: item.id }] : [])] };
    }
    if (item.id === target.id) ownerHead = saved.head || null;
    if (saved.patch || saved.ref) salvage.push({ ...saved, task: item.id });
  }
  const revision = nextLedgerRevision(ledger.revision);
  const failure: FailureEvidence = {
    ...recorded, summary, paths: [...paths], repairWave: waves.length,
  };
  delete failure.disposition;
  const repairDecision: RepairDecision = {
    task: target.id, kind: 'repair', wave: waves.length + 1, reason: decision.trim(), failure,
    previousDag: dag, nextDag: dagSnapshot(ledger.tasks), previousScope: approved, nextScope: [...paths],
    necessity: 'terminal CI failure is owned by an already approved integrated task', revision,
    owner_generation: (target.lease?.generation || 0) + 1,
    salvage_predecessor: {
      head: ownerHead || target.sha || null, lease_id: target.lease?.id || null,
      generation: target.lease?.generation ?? null,
    },
    reset_downstream: resetDownstream.map((entry) => entry.id),
    salvaged: salvage.map(({ task: id, patch, ref, head, generation, dirty_paths }) => ({
      task: id, patch, ref, head, generation, dirty_paths,
    })),
  };
  return {
    ok: true, kind: 'resume', terminal, target, failure, repairDecision, revision,
    previousHead: typeof target.sha === 'string' ? target.sha : null, resetDownstream, salvage,
  };
}

/**
 * owner에서 의존 간선을 따라 도달하는 task를 topological 순서대로 찾는다.
 *
 * @param {Task[]} tasks - 원장의 DAG
 * @param {string} ownerId - 재개 owner task id
 * @returns {Task[]} owner의 모든 transitive downstream task
 */
function downstreamTasks(tasks: Task[], ownerId: string): Task[] {
  const reached = new Set([ownerId]);
  const downstream: Task[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of tasks) {
      if (reached.has(item.id) || !(item.depends_on || []).some((id) => reached.has(id))) continue;
      reached.add(item.id);
      downstream.push(item);
      changed = true;
    }
  }
  return downstream;
}

/**
 * owner부터 terminal까지 downstream DAG의 증적 문서를 재작업 시작 상태로 되돌린다.
 * 새 문서를 만들지 않고 이미 있는 tasks.md·verification.md·review.md의 status만 바꾼다
 * (verification의 harness metadata와 이전 commit_sha도 지운다). 이전 통합 때의 `verified`/`passed`
 * 증적이 남아 있으면 worker가 새 작업 없이도 integrate 증적 검사를 통과시킬 수 있기 때문이다.
 * terminal은 depends_on을 건드리지 않고 `ready`로만 돌린다. 반환한 함수는 쓰기 전 바이트로 되돌린다.
 *
 * @param {object} opts - integrationPath·blueprint·owner·downstream·terminal task
 * @param {Task[]} opts.downstream - owner 이후 도달 가능한 task 목록
 * @returns {() => void} 원장 쓰기 실패 시 호출할 문서 롤백
 */
function writeResumeDocuments({ integrationPath, blueprint, target, downstream, terminal }: {
  integrationPath: string; blueprint: string; target: Task; downstream: Task[]; terminal: Task;
}): () => void {
  const dir = (id: string) => path.join(integrationPath, blueprint, 'tasks', id);
  const reset = (file: string, mutate: (bouncer: Record<string, unknown>) => void) => {
    if (!fs.existsSync(file)) return null;
    const before = fs.readFileSync(file);
    const doc = readDoc(file);
    const bouncer = (doc.data as Record<string, unknown>).bouncer as Record<string, unknown> | undefined;
    if (!bouncer || typeof bouncer !== 'object') return null;
    mutate(bouncer);
    fs.writeFileSync(file, renderDoc(doc.data, doc.body));
    return { file, before };
  };
  const written: Array<{ file: string; before: Buffer }> = [];
  // terminal 문서는 downstream 순회와 terminal 보정에서 두 번 저장될 수 있어 LIFO로 원본 bytes까지 되돌린다.
  const rollback = () => { for (const entry of [...written].reverse()) fs.writeFileSync(entry.file, entry.before); };
  const apply = (file: string, mutate: (bouncer: Record<string, unknown>) => void) => {
    const entry = reset(file, mutate);
    if (entry) written.push(entry);
  };
  try {
    for (const item of [target, ...downstream]) {
      apply(path.join(dir(item.id), 'tasks.md'), (bouncer) => {
        bouncer.status = 'ready';
        delete bouncer.commit_sha;
      });
      apply(path.join(dir(item.id), 'verification.md'), (bouncer) => {
        bouncer.status = 'pending';
        delete bouncer.verification;
      });
      apply(path.join(dir(item.id), 'review.md'), (bouncer) => { bouncer.status = 'pending'; });
    }
    apply(path.join(dir(terminal.id), 'tasks.md'), (bouncer) => { bouncer.status = 'ready'; });
  } catch (error) {
    // 일부만 쓴 문서는 되돌린 뒤 원 예외를 그대로 올린다 — 흡수하지 않는다.
    rollback();
    throw error;
  }
  return rollback;
}

function dagSnapshot(tasks: Task[]): Array<{ id: string; depends_on: string[] }> {
  return tasks.map((entry) => ({ id: entry.id, depends_on: [...(entry.depends_on || [])] }));
}

function nextLedgerRevision(current: unknown): string {
  const match = /^r(\d+)$/.exec(typeof current === 'string' ? current : '');
  return `r${match ? Number(match[1]) + 1 : 1}`;
}

function integratedLeaves(tasks: Task[], terminalId: string): string[] {
  const integrated = tasks.filter((entry) => entry.id !== terminalId && entry.status === 'integrated');
  const depended = new Set(integrated.flatMap((entry) => entry.depends_on || []));
  return integrated.filter((entry) => !depended.has(entry.id)).map((entry) => entry.id).sort();
}

/**
 * repair 문서 frontmatter에 심을 `bouncer.verify`를 고른다. terminal 선언을
 * 우선하고, 없으면 repair가 매달린 integrated leaf(선행 commit) 문서에서
 * 가져온다. `config.verify`는 쓰지 않는다 — repair가 전역 폴백 없이 G13을
 * 통과해야 하고, 없는 config를 만들어 내면 정책 출처가 흐려진다.
 *
 * @param {string} integrationPath - integration checkout 절대 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {Task} repair - 새로 쓸 repair task (`depends_on` = integrated leaves)
 * @param {Record<string, unknown> | null} terminalData - terminal tasks.md data
 * @returns {string | undefined} 비어 있지 않은 verify 문자열. 후보가 없으면 undefined
 */
function resolveRepairVerify(
  integrationPath: string,
  blueprint: string,
  repair: Task,
  terminalData: Record<string, unknown> | null,
): string | undefined {
  if (terminalData) {
    const terminalBouncer = terminalData.bouncer;
    if (terminalBouncer && typeof terminalBouncer === 'object') {
      const terminalVerify = (terminalBouncer as Record<string, unknown>).verify;
      if (typeof terminalVerify === 'string' && terminalVerify.trim() !== '') {
        return terminalVerify;
      }
    }
  }
  // depends_on은 integratedLeaves가 준 leaf다. 번호 순 첫 선언을 취해
  // readVerifyCommand의 earliest-numbered 쪽과 같은 후보를 고른다.
  for (const id of [...(repair.depends_on || [])].sort()) {
    const file = path.join(integrationPath, blueprint, 'tasks', id, 'tasks.md');
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (error) {
      // 선행 leaf 문서 부재(ENOENT)만 흡수하고 다음 leaf로 간다. EACCES 등을
      // 조용히 넘기면 verify 선택이 비어 G13이 config 부재로 오진한다.
      if (error && typeof error === 'object' && 'code' in error
        && (error as { code?: unknown }).code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    let data: unknown;
    try {
      data = parseFrontmatter(raw).data;
    } catch (_error) {
      // frontmatter 부재·깨진 YAML — 이 leaf는 후보에서 빼고 다음으로.
      // 한 문서 파손이 repair write 전체를 막으면 terminal CI 복구가 끊긴다.
      continue;
    }
    if (!data || typeof data !== 'object') continue;
    const bouncer = (data as Record<string, unknown>).bouncer;
    if (!bouncer || typeof bouncer !== 'object') continue;
    const verify = (bouncer as Record<string, unknown>).verify;
    if (typeof verify === 'string' && verify.trim() !== '') {
      return verify;
    }
  }
  return undefined;
}

/** 리뷰 원인 repair 문서에 싣는 finding 한 건의 필드. `found: false`면 id만 의미가 있다. */
interface ReviewFindingLine {
  id: string; found: boolean;
  severity?: string; category?: string; actionability?: string;
  file?: string; symbol?: string; brief_clause?: string; note?: string;
}

/**
 * root `review.md`의 finding 목록에서 요청한 id들의 필드를 읽어 repair 문서용
 * 줄 데이터로 만든다. repair는 리뷰 문서 상태와 무관하게 진행해야 하므로
 * 파일 부재·권한 오류·YAML 오류·id 부재를 모두 `found: false`로 접는다 —
 * 이 읽기는 보조 정보이고, 막으면 이미 확정된 repair 결정이 문서 없이 남는다.
 *
 * @param {string} integrationPath - integration worktree 경로
 * @param {string} blueprint - blueprint 디렉터리(repo 상대)
 * @param {string[]} ids - `--review-finding` 순서의 finding id
 * @returns {ReviewFindingLine[]} ids와 같은 순서·길이의 줄 데이터
 */
function readReviewFindingLines(integrationPath: string, blueprint: string, ids: string[]): ReviewFindingLine[] {
  let findings: unknown[] = [];
  try {
    const block = readBouncerBlock(path.join(integrationPath, blueprint, 'review.md'));
    const list = (block?.review as { findings?: unknown } | undefined)?.findings;
    if (Array.isArray(list)) findings = list;
  } catch {
    // readBouncerBlock이 던지는 권한 오류·YAML 오류 등 모든 읽기 실패를 흡수한다.
    // 안전한 이유: 결과가 "찾지 못함" 표시일 뿐이라 repair 결정·원장에는 영향이 없다.
    findings = [];
  }
  const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);
  return ids.map((id): ReviewFindingLine => {
    const hit = findings.find((entry) => (entry as { id?: unknown } | null)?.id === id) as
      Record<string, unknown> | undefined;
    if (!hit) return { id, found: false };
    const line: ReviewFindingLine = { id, found: true };
    for (const key of ['severity', 'category', 'actionability', 'file', 'symbol', 'brief_clause', 'note'] as const) {
      const value = text(hit[key]);
      if (value !== undefined) line[key] = value;
    }
    return line;
  });
}

/**
 * finding 한 건을 repair 문서의 한 줄 목록 항목으로 쓴다. 값의 개행은 공백 하나로
 * 접어 한 줄을 유지한다(목록 항목이 다음 줄로 번지면 절 구조를 깬다). file은 backtick으로
 * 감싸지 않는다 — Touch 밖 절의 backtick 경로는 경로 선언으로 읽혀 Touch·Do not touch 경로 해석을 오인시킨다.
 *
 * @param {ReviewFindingLine} line - finding 줄 데이터
 * @returns {string} `- F1 (major, correctness, must_fix) — file#symbol — clause — note: …` 형식의 한 줄
 */
function formatReviewFindingLine(line: ReviewFindingLine): string {
  if (!line.found) return `- ${line.id} — review.md에서 찾지 못함`;
  const fold = (value: string): string => value.replace(/\s*[\r\n]+\s*/g, ' ');
  const tags = [line.severity, line.category, line.actionability].filter((v): v is string => v !== undefined);
  const parts = [`- ${line.id}${tags.length > 0 ? ` (${fold(tags.join(', '))})` : ''}`];
  if (line.file !== undefined) parts.push(fold(line.file) + (line.symbol !== undefined ? `#${fold(line.symbol)}` : ''));
  else if (line.symbol !== undefined) parts.push(`#${fold(line.symbol)}`);
  if (line.brief_clause !== undefined) parts.push(fold(line.brief_clause));
  if (line.note !== undefined) parts.push(`note: ${fold(line.note)}`);
  return parts.join(' — ');
}

/**
 * repair task 문서와 (있으면) terminal edge를 한 revision으로 쓴다. 두 write
 * 중 하나가 실패하면 원래 terminal 문서를 복구하고 새 task를 지워, ledger만
 * 다음 graph를 가리키는 반쪽 상태가 생기지 않게 한다. 종단 verification이
 * 없는 blueprint는 terminal을 생략한다 — 없는 tasks.md를 만들어 의존 그래프를
 * 꾸며내지 않기 위해서다. repair frontmatter에는 terminal(또는 선행
 * integrated commit)의 `bouncer.verify`를 심어 config 폴백 없이 G13이
 * 명령을 읽게 한다.
 *
 * `reviewFindings`가 있으면 리뷰 원인 본문(제목·Goal에 finding 목록)을, 없으면
 * CI 원인 본문을 쓴다. CI 본문은 바이트 단위로 바뀌지 않아야 한다.
 *
 * @param {{ integrationPath: string, blueprint: string, repair: Task, terminal?: Task,
 *   reviewFindings?: ReviewFindingLine[], verify?: string }} opts
 *   integration 경로, blueprint, repair task, 선택적 종단 verification, 선택적 리뷰 finding 줄,
 *   선택적 `--verify`(검사를 통과한 repair 전용 명령)
 * @returns {() => void} ledger write 실패 시 호출할 문서 롤백
 */
function writeRepairDocuments({ integrationPath, blueprint, repair, terminal, reviewFindings, verify }: {
  integrationPath: string; blueprint: string; repair: Task; terminal?: Task; reviewFindings?: ReviewFindingLine[];
  verify?: string;
}): () => void {
  // task 문서와 ledger revision은 한 write 단위다.
  const terminalFile = terminal
    ? path.join(integrationPath, blueprint, 'tasks', terminal.id, 'tasks.md')
    : null;
  const terminalBefore = terminalFile ? fs.readFileSync(terminalFile, 'utf8') : null;
  let terminalData: Record<string, unknown> | null = null;
  let terminalBody = '';
  if (terminalFile && terminal) {
    const terminalDoc = readDoc(terminalFile);
    terminalData = terminalDoc.data as Record<string, unknown>;
    terminalBody = terminalDoc.body;
    const terminalBouncer = terminalData.bouncer as Record<string, unknown>;
    terminalBouncer.depends_on = (terminal.depends_on || []).map((id) => `TASKS-${id}`);
    terminalBouncer.status = 'ready';
  }
  const repairFile = path.join(integrationPath, blueprint, 'tasks', repair.id, 'tasks.md');
  // 번호·slug 두 형식을 context-ids로 읽는다. 해석 불가는 예전처럼 빈 id를 심는다.
  const repairIds = parseContextPath(blueprint);
  const epicId = repairIds && repairIds.blueprintKey !== null ? repairIds.epicKey : '';
  const bpId = repairIds && repairIds.blueprintKey !== null ? repairIds.blueprintKey : '';
  // 호출자가 검사를 통과시킨 --verify가 있으면 그 값이 우선한다. 없을 때만(legacy)
  // 기존 종단·선행 leaf 해석을 쓰므로 --verify 없는 legacy 결과는 바이트 단위로 같다.
  const repairVerify = verify !== undefined
    ? verify : resolveRepairVerify(integrationPath, blueprint, repair, terminalData);
  const repairData = {
    type: 'bouncer.tasks',
    title: reviewFindings ? `Review repair wave ${repair.id}` : `CI repair wave ${repair.id}`,
    description: reviewFindings ? 'Repairs final review findings.' : 'Repairs terminal CI failure.',
    resource: path.relative(integrationPath, repairFile).replaceAll('\\', '/'), tags: ['bouncer', 'repair-wave'],
    timestamp: new Date().toISOString(), bouncer: {
      id: `TASKS-${repair.id}`, epic_id: epicId, blueprint_id: bpId,
      status: 'ready', depends_on: (repair.depends_on || []).map((id) => `TASKS-${id}`),
      parallel_safe: false, dependency_gate: 'integrated', affected_paths: repair.scope?.paths || [],
      scope_revision: repair.scope?.revision,
      // 후보가 있을 때만 심는다. 빈 문자열·날조 config는 S12/G13을 가린다.
      ...(repairVerify !== undefined ? { verify: repairVerify } : {}),
    },
  };
  const timestamp = (repairData as { timestamp: string }).timestamp;
  const verificationFile = path.join(path.dirname(repairFile), 'verification.md');
  const repairRel = path.relative(integrationPath, path.dirname(repairFile)).replaceAll('\\', '/');
  const verificationData = {
    type: 'bouncer.verification', title: `TASKS-${repair.id} verification`,
    description: `Verification for TASKS-${repair.id}`, resource: `${repairRel}/verification.md`,
    tags: ['bouncer', 'verification'], timestamp,
    bouncer: { id: `VERIFY-${repair.id}`, epic_id: epicId, blueprint_id: bpId, status: 'pending' },
  };
  // 모드 worker에는 task 리뷰가 없다. 구형 계약만 review.md를 같이 심는다.
  const reviewMode = isBlueprintReviewModeAt(integrationPath, blueprint);
  const reviewFile = path.join(path.dirname(repairFile), 'review.md');
  const reviewData = {
    type: 'bouncer.review', title: `TASKS-${repair.id} review`, description: `Review for TASKS-${repair.id}`,
    resource: `${repairRel}/review.md`, tags: ['bouncer', 'review'], timestamp,
    bouncer: {
      id: `REVIEW-${repair.id}`, epic_id: epicId, blueprint_id: bpId, status: 'pending',
      review: { required: true },
    },
  };
  // 원인별 문구만 갈아 끼운다. 절 구조는 같게 두어야 CI 본문이 바이트 단위로 보존되고,
  // finding 목록은 새 `##` 제목 없이 Goal & intent 안에 둬 intent bundle이 그대로 싣는다.
  const cause = reviewFindings
    ? {
      touch: '기록된 리뷰 finding을 수정한다.',
      goal: `최종 리뷰 finding을 수정한다.\n\n${reviewFindings.map(formatReviewFindingLine).join('\n')}`,
      provide: '기록된 리뷰 finding을 해소하는 최소 수정',
      done: '기록된 리뷰 finding을 모두 수정한다.',
      first: 'finding을 재현하고 관련 source와 regression test를 수정한다.',
    }
    : {
      touch: '기록된 CI 실패를 복구한다.',
      goal: '기록된 terminal CI 실패를 복구한다.',
      provide: '실패 command와 관련 경로를 통과시키는 최소 수정',
      done: '기록된 terminal CI command를 통과시킨다.',
      first: '실패를 재현하고 관련 source와 regression test를 수정한다.',
    };
  const touch = (repair.scope?.paths || []).map((entry) => `- Modify \`${entry}\` — ${cause.touch}`).join('\n');
  const repairBody = `# Tasks

## Goal & intent

${cause.goal}

## Interface

- 제공: ${cause.provide}
- 거부: Blueprint 밖 scope와 새 기능

## Touch

${touch}

## Do not touch

- \`.git/\`과 \`.bouncer/\` governance tree

## Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

## Checklist

- [ ] ${cause.first}
- [ ] ${cause.done}
`;
  try {
    fs.mkdirSync(path.dirname(repairFile), { recursive: true });
    fs.writeFileSync(repairFile, renderDoc(repairData, repairBody));
    const verificationBody = '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n';
    fs.writeFileSync(verificationFile, renderDoc(verificationData, verificationBody));
    if (!reviewMode) {
      fs.writeFileSync(reviewFile, renderDoc(reviewData, '# Review\n\n## Findings\n- <finding>\n'));
    }
    if (terminalFile && terminalData && terminalBefore !== null) {
      fs.writeFileSync(terminalFile, renderDoc(terminalData, terminalBody));
    }
  } catch (error) {
    if (terminalFile && terminalBefore !== null) fs.writeFileSync(terminalFile, terminalBefore);
    fs.rmSync(path.dirname(repairFile), { recursive: true, force: true });
    throw error;
  }
  return () => {
    if (terminalFile && terminalBefore !== null) fs.writeFileSync(terminalFile, terminalBefore);
    fs.rmSync(path.dirname(repairFile), { recursive: true, force: true });
  };
}

function writePartialCloseBlueprint(integrationPath: string, blueprint: string): () => void {
  const file = path.join(integrationPath, blueprint, 'index.md');
  const before = fs.readFileSync(file);
  const doc = readDoc(file);
  const data = doc.data as Record<string, unknown>;
  (data.bouncer as Record<string, unknown>).status = 'partial_closed';
  fs.writeFileSync(file, renderDoc(data, doc.body));
  return () => fs.writeFileSync(file, before);
}

/**
 * partial-close용 main checkout handoff를 append하고 원래 bytes를 복구할 함수를 돌려준다.
 * 심볼릭 링크와 directory는 main checkout 밖으로 쓰기가 새지 않도록 거절한다.
 *
 * @param {string} mainRoot - canonical main checkout
 * @param {string} file - main checkout 기준 handoff 경로
 * @param {string} record - 이번 실패의 재현 가능한 record
 * @returns {() => void} 후속 ledger/index 쓰기가 실패했을 때 bytes 복구 함수
 */
function appendMainHandoff(mainRoot: string, file: string, record: string): () => void {
  const target = path.join(mainRoot, file);
  let before: Buffer | null = null;
  let mode = 0o666;
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile()) throw new Error('next-plan-must-be-regular-file');
    mode = stat.mode & 0o777;
    before = fs.readFileSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const separator = before && before.length > 0 && before[before.length - 1] !== 0x0a ? '\n' : '';
  const appended = Buffer.concat([before || Buffer.alloc(0), Buffer.from(`${separator}---\n${record}`)]);
  const temporary = `${target}.partial-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    fs.writeFileSync(temporary, appended, { flag: 'wx', mode });
    // 같은 디렉터리의 임시 파일을 rename해 append I/O 실패가 원본을 비우지 않게 한다.
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch (cleanupError) {
      if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') throw cleanupError;
    }
    throw error;
  }
  return () => {
    if (before === null) fs.rmSync(target, { force: true });
    else {
      const rollback = `${target}.rollback-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      try {
        fs.writeFileSync(rollback, before, { flag: 'wx', mode });
        fs.renameSync(rollback, target);
      } catch (error) {
        try { fs.rmSync(rollback, { force: true }); } catch (cleanupError) {
          if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') throw cleanupError;
        }
        throw error;
      }
    }
  };
}

/**
 * `partial-close`: awaiting_confirmation 원장을 사용자 확인 뒤 partial_closed로 닫고 handoff를 남긴다.
 *
 * @param {RepairCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @param {RepairSupport} support - coordinator-commands가 소유한 정상 경로 helper
 * @returns {RepairResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinatePartialClose(ctx: RepairCtx, support: RepairSupport): RepairResult {
  const { cwd, deps, exec, main, integration, ledger, commitWrite } = ctx;
  const { command, repoRoot, blueprint, userConfirmed } = ctx.args;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  if (ledger.status !== 'awaiting_confirmation') {
    return { ok: false, reason: 'partial-close-awaiting-confirmation-required' };
  }
  if (!main.projectRoot || fs.realpathSync(repoRoot) !== fs.realpathSync(main.projectRoot)) {
    return { ok: false, reason: 'main-checkout-root-required' };
  }
  const { epicId, blueprintId } = parsePathIds(blueprint);
  const handoffPath = `${epicId}_${blueprintId}_NEXT_PLAN.md`;
  const handoffAbs = path.join(main.projectRoot, handoffPath);
  let handoffStat: ReturnType<typeof fs.lstatSync> | null = null;
  try { handoffStat = fs.lstatSync(handoffAbs); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (handoffStat && !handoffStat.isFile()) return { ok: false, reason: 'next-plan-must-be-regular-file' };
  if (git(exec, main.projectRoot, ['ls-files', '--', handoffPath]) !== '') {
    return { ok: false, reason: 'next-plan-must-be-untracked' };
  }
  if (userConfirmed !== true) return { ok: false, reason: 'partial-close-user-confirmation-required' };
  const timestamp = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
  const failure = ledger.terminalFailure as FailureEvidence;
  const handoff = { path: handoffPath, timestamp, source_digest: failure.source_digest || '' };
  const candidate = { ...ledger, status: 'partial_closed', userConfirmed: true, handoff };
  const validPartialClose = runtime.validateCoordinatorLedger(candidate);
  if (!validPartialClose.ok) return validPartialClose;
  Object.assign(ledger, candidate);
  const remaining = failure.paths.length ? failure.paths.join(', ') : 'none recorded';
  const record = `# Partial-close handoff\n\n- Timestamp: ${timestamp}\n`
    + `- Failed command: \`${failure.command}\`\n- Exit code: ${failure.exitCode}\n`
    + `- Source identity: ${handoff.source_digest}\n- Owner: ${failure.task}\n`
    + `- Recovery scope: ${remaining}\n- Preserved paths: ${integration.integrationPath}\n`;
  let rollbackHandoff: (() => void) | undefined;
  const rollbackBlueprint = writePartialCloseBlueprint(integration.integrationPath, blueprint);
  try {
    const appendHandoff = typeof deps.appendHandoff === 'function'
      ? deps.appendHandoff
      : appendMainHandoff;
    rollbackHandoff = appendHandoff(main.projectRoot, handoffPath, record);
    const lost = commitWrite();
    if (lost) {
      rollbackHandoff();
      rollbackBlueprint();
      return lost;
    }
  } catch (error) {
    rollbackHandoff?.();
    rollbackBlueprint();
    throw error;
  }
  return support.withCheckpoint({ ok: true as const, command, status: 'partial_closed', nextPlan: handoffAbs, handoff,
    message: 'NEXT_PLAN.md를 확인하고 후속 계획 진행 여부를 승인해 주세요.',
    preserved: [integration.integrationPath, ...ledger.tasks.map((entry) => entry.workerPath).filter(Boolean)] },
  ledger, integration.ledgerFile);
}

/**
 * `repair`: terminal CI 실패·최종 리뷰 finding·supplement·resume·outside_scope 해소를 처리한다.
 * 모든 새 검사는 ledger 객체를 만지기 전에 끝내 거절이 바이트 불변이 되게 한다.
 *
 * @param {RepairCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @param {RepairSupport} support - coordinator-commands가 소유한 정상 경로 helper
 * @returns {RepairResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateRepair(ctx: RepairCtx, support: RepairSupport): RepairResult {
  const { cwd, exec, integration, ledger, commitWrite } = ctx;
  const {
    command, repoRoot, blueprint, task, decision, failureCommand, summary, reviewFindings, kind,
    resumeTask, disposition, newPaths, verify, leaseId, generation, paths: repairPaths,
  } = ctx.args;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  // 최종 리뷰 discovery가 저장된 뒤의 리뷰 원인 repair·supplement는 wave 한도나 증거
  // 검사보다 먼저 거절한다. 원장·task 문서를 쓰기 전이라 거절은 아무 파일도 바꾸지 않는다.
  // CI 원인 repair(`--failure-command`)는 리뷰 원인이 아니므로 이 거절을 받지 않는다.
  if (kind === 'supplement' || Array.isArray(reviewFindings)) {
    const gate = finalReviewGate({
      integrationPath: integration.integrationPath, blueprint, ledger,
      supplement: kind === 'supplement', newPaths,
    });
    if (gate) return gate;
  }
  // supplement는 wave 한도 검사보다 앞에서 처리한다. 새 task·wave를 쓰지 않으므로
  // 두 wave를 쓴 뒤에도 접수되어야 한다.
  if (kind === 'supplement') {
    const intake = checkSupplementIntake({
      ledger, integrationPath: integration.integrationPath, blueprint,
      failureCommand, reviewFindings, summary, paths: repairPaths,
    });
    if (!intake.ok) return intake;
    const supplement: SupplementDecision = {
      kind: 'supplement', outcome: 'pending', paths: intake.paths, findings: intake.findings,
    };
    ledger.decisions.push(supplement);
    { const lost = commitWrite(); if (lost) return lost; }
    return support.withCheckpoint({
      ok: true as const, command, kind: 'supplement', paths: intake.paths,
    }, ledger, integration.ledgerFile);
  }
  // terminal CI 실패의 두 새 해소 경로. 둘은 상호배타이고 리뷰 원인과도 섞을 수 없다.
  // 어느 쪽이든 새 task를 만들지 않는다 — 기존 task의 승인 범위 안 재작업이거나, 증거에 묶인
  // 범위 밖 분류 기록일 뿐이다.
  if (resumeTask !== undefined || disposition !== undefined) {
    if (resumeTask !== undefined && disposition !== undefined) {
      return { ok: false, reason: 'repair-resolution-ambiguous' };
    }
    if (Array.isArray(reviewFindings)) return { ok: false, reason: 'repair-cause-ambiguous' };
    const resolved = resolveTerminalFailure({
      support, ledger, exec, integrationPath: integration.integrationPath, task,
      failureCommand, summary, decision, repairPaths, resumeTask, disposition, leaseId, generation,
    });
    if (!resolved.ok) return resolved;
    if (resolved.kind === 'disposition') {
      const { terminal, failure, record } = resolved;
      failure.disposition = record.disposition;
      ledger.decisions.push(record);
      // 한도 소진으로 멈춘 drive도 범위 밖 분류로는 이어 갈 수 있다. 분류는 wave를 쓰지 않는다.
      if (ledger.status === 'awaiting_confirmation') ledger.status = 'active';
      { const lost = commitWrite(); if (lost) return lost; }
      return support.withCheckpoint({
        ok: true as const, command, kind: 'outside_scope', task: terminal, disposition: record.disposition,
      }, ledger, integration.ledgerFile);
    }
    const { terminal, target, repairDecision, failure, revision, resetDownstream, salvage } = resolved;
    const waves = ledger.repairWaves || [];
    const rollbackDocuments = writeResumeDocuments({
      integrationPath: integration.integrationPath, blueprint, target, downstream: resetDownstream, terminal,
    });
    // 통합된 하위 commit task는 lease·sha·status를 유지하고 target만 새 integration 결과로 다시 준비한다.
    revokeLease(ledger, target, {
      reason: String(decision).trim(), previousHead: typeof target.sha === 'string' ? target.sha : null,
    });
    target.resumed = true;
    target.dependency_gate = 'integrated';
    target.decisions = [...(target.decisions || []), repairDecision];
    // downstream verification은 기존 DAG edge를 보존한 채 target 재통합을 기다리게 한다.
    for (const item of resetDownstream) item.status = 'pending';
    terminal.status = 'pending';
    for (const entry of salvage) {
      ledger.decisions.push({
        task: entry.task, kind: 'worker-salvage', generation: entry.generation, head: entry.head,
        patch: entry.patch, ref: entry.ref, dirty_paths: entry.dirty_paths,
      } satisfies WorkerSalvageDecision);
    }
    ledger.decisions.push(repairDecision);
    ledger.repairWaves = [...waves, repairDecision];
    ledger.revision = revision;
    ledger.terminalFailure = failure;
    ledger.status = 'active';
    try {
      const lost = commitWrite();
      if (lost) {
        rollbackDocuments();
        return lost;
      }
    } catch (error) {
      rollbackDocuments();
      throw error;
    }
    return support.withCheckpoint({
      ok: true as const, command, kind: 'resume', wave: repairDecision.wave, resumedTask: target,
      terminalTask: terminal, decision: repairDecision,
      owner_generation: repairDecision.owner_generation,
      salvage_predecessor: repairDecision.salvage_predecessor,
      reset_downstream: repairDecision.reset_downstream,
      salvage: salvage.map(({ task: id, patch, ref }) => ({ task: id, patch, ref })),
    }, ledger, integration.ledgerFile);
  }
  const waves = ledger.repairWaves || [];
  if (waves.length >= REPAIR_WAVE_LIMIT) {
    return { ok: false, reason: 'repair-wave-limit', status: 'awaiting_confirmation' };
  }
  const hasReviewCause = Array.isArray(reviewFindings);
  const hasCiCause = typeof failureCommand === 'string';
  // 두 원인을 한 결정에 넣으면 failure.command가 review와 CI 중 무엇이었는지
  // 원장이 답할 수 없다. 빈 문자열도 플래그가 온 것으로 본다.
  if (hasReviewCause && hasCiCause) {
    return { ok: false, reason: 'repair-cause-ambiguous' };
  }
  if (hasReviewCause) {
    if (reviewFindings.length === 0
      || reviewFindings.some((entry) => typeof entry !== 'string' || entry === '')
      || typeof summary !== 'string' || summary === '') {
      return { ok: false, reason: 'failure-evidence-required' };
    }
    if (typeof decision !== 'string' || decision.trim() === '') {
      return { ok: false, reason: 'decision-reason-required' };
    }
    if (!sourceRepairPaths(repairPaths)) return { ok: false, reason: 'repair-scope-out-of-bounds' };
    // 새 검사는 ledger 객체를 만지기 전에 끝내 거절이 바이트 불변이 되게 한다.
    const intake = checkRepairIntake({
      support, exec, integrationPath: integration.integrationPath, blueprint, ledger,
      paths: repairPaths, newPaths: newPaths || [], verify,
    });
    if (!intake.ok) return intake;
    const scopePaths = intake.paths;
    // 최종 리뷰 수정은 in-flight 작업과 같은 경로를 고칠 수 있다. 모두
    // integrated일 때만 열어, 미통합 worker HEAD를 리뷰 범위로 착각하지 않게 한다.
    if (ledger.tasks.some((entry) => (entry.status || 'pending') !== 'integrated')) {
      return { ok: false, reason: 'review-repair-requires-integrated' };
    }
    let terminal: Task | undefined;
    if (task !== undefined && task !== '') {
      if (!/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
      const found = ledger.tasks.find((x) => x.id === task);
      if (!found) return { ok: false, reason: 'task-outside-blueprint' };
      if (found.execution_kind !== 'verification') {
        return { ok: false, reason: 'terminal-failure-required' };
      }
      terminal = found;
    }
    const previousDag = dagSnapshot(ledger.tasks);
    const leaves = integratedLeaves(ledger.tasks, terminal ? terminal.id : '');
    const repairId = String(Math.max(...ledger.tasks.map((entry) => Number(entry.id)), 0) + 1).padStart(3, '0');
    const wave = waves.length + 1;
    const revision = nextLedgerRevision(ledger.revision);
    const failure: FailureEvidence = {
      task: terminal ? terminal.id : repairId,
      command: 'review',
      summary,
      paths: [...repairPaths],
      exitCode: 1,
      repairWave: waves.length,
      findings: [...reviewFindings],
    };
    const repair: Task = {
      id: repairId, depends_on: leaves, dependency_gate: 'integrated', parallel_safe: false,
      execution_kind: 'commit', status: 'pending', dynamic: true,
      scope: { revision, paths: [...scopePaths] },
    };
    if (terminal) {
      terminal.depends_on = [repairId];
      terminal.status = 'pending';
    }
    ledger.tasks.push(repair);
    const repairDecision: RepairDecision = {
      task: repairId, kind: 'repair', wave, reason: decision.trim(), failure,
      previousDag, nextDag: dagSnapshot(ledger.tasks), previousScope: [],
      nextScope: [...scopePaths],
      necessity: 'final review finding requires a Blueprint-scoped source repair',
      revision,
    };
    repair.decisions = [repairDecision];
    ledger.decisions.push(repairDecision);
    ledger.repairWaves = [...waves, repairDecision];
    ledger.revision = revision;
    ledger.terminalFailure = failure;
    ledger.status = 'active';
    const rollbackDocuments = writeRepairDocuments({
      integrationPath: integration.integrationPath, blueprint, repair, terminal,
      reviewFindings: readReviewFindingLines(integration.integrationPath, blueprint, reviewFindings),
      verify: intake.verify,
    });
    try {
      { const lost = commitWrite(); if (lost) return lost; }
    } catch (error) {
      rollbackDocuments();
      throw error;
    }
    return support.withCheckpoint({
      ok: true as const, command, wave, repairTask: repair, terminalTask: terminal, decision: repairDecision,
    }, ledger, integration.ledgerFile);
  }
  if (!task || !/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
  const item = ledger.tasks.find((x) => x.id === task);
  if (!item) return { ok: false, reason: 'task-outside-blueprint' };
  if (item.execution_kind !== 'verification' || item.status !== 'verifying') {
    return { ok: false, reason: 'terminal-failure-required' };
  }
  if (typeof failureCommand !== 'string' || failureCommand === ''
    || typeof summary !== 'string' || summary === '') {
    return { ok: false, reason: 'failure-evidence-required' };
  }
  if (typeof decision !== 'string' || decision.trim() === '') {
    return { ok: false, reason: 'decision-reason-required' };
  }
  if (!sourceRepairPaths(repairPaths)) return { ok: false, reason: 'repair-scope-out-of-bounds' };
  // 새 검사는 ledger 객체를 만지기 전에 끝내 거절이 바이트 불변이 되게 한다.
  const intake = checkRepairIntake({
    support, exec, integrationPath: integration.integrationPath, blueprint, ledger,
    paths: repairPaths, newPaths: newPaths || [], verify,
  });
  if (!intake.ok) return intake;
  const scopePaths = intake.paths;
  const previousDag = dagSnapshot(ledger.tasks);
  const leaves = integratedLeaves(ledger.tasks, task);
  const repairId = String(Math.max(...ledger.tasks.map((entry) => Number(entry.id)), 0) + 1).padStart(3, '0');
  const wave = waves.length + 1;
  const revision = nextLedgerRevision(ledger.revision);
  const failure: FailureEvidence = {
    task, command: failureCommand, summary, paths: [...repairPaths], exitCode: 1, repairWave: waves.length,
  };
  const repair: Task = {
    id: repairId, depends_on: leaves, dependency_gate: 'integrated', parallel_safe: false,
    execution_kind: 'commit', status: 'pending', dynamic: true,
    scope: { revision, paths: [...scopePaths] },
  };
  item.depends_on = [repairId];
  item.status = 'pending';
  ledger.tasks.push(repair);
  const repairDecision: RepairDecision = {
    task: repairId, kind: 'repair', wave, reason: decision.trim(), failure,
    previousDag, nextDag: dagSnapshot(ledger.tasks), previousScope: [],
    nextScope: [...scopePaths],
    necessity: 'terminal CI failure requires a Blueprint-scoped source repair',
    revision,
  };
  repair.decisions = [repairDecision];
  ledger.decisions.push(repairDecision);
  ledger.repairWaves = [...waves, repairDecision];
  ledger.revision = revision;
  ledger.terminalFailure = failure;
  ledger.status = 'active';
  const rollbackDocuments = writeRepairDocuments({
    integrationPath: integration.integrationPath, blueprint, repair, terminal: item,
    verify: intake.verify,
  });
  try {
    { const lost = commitWrite(); if (lost) return lost; }
  } catch (error) {
    rollbackDocuments();
    throw error;
  }
  return support.withCheckpoint({
    ok: true as const, command, wave, repairTask: repair, terminalTask: item, decision: repairDecision,
  }, ledger, integration.ledgerFile);
}

/**
 * `critical-recovery` 2단계: task 조회 뒤 결과 기록 또는 1회 recovery 시작을 원장에 쓴다.
 * lease 검사를 받지 않는다(현재 동작 그대로).
 *
 * @param {RepairTaskCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @param {RepairSupport} support - coordinator-commands가 소유한 정상 경로 helper
 * @returns {RepairResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateCriticalRecovery(ctx: RepairTaskCtx, support: RepairSupport): RepairResult {
  const { task, integration, ledger, commitWrite, item } = ctx;
  const { command, findings, outcome, reason } = ctx.args;
  if (typeof reason !== 'string' || reason.trim() === '') return { ok: false, reason: 'reason-required' };
  if (outcome !== undefined) {
    if (outcome !== 'resolved' && outcome !== 'blocked') {
      return { ok: false, reason: 'critical-recovery-outcome-invalid' };
    }
    if (!item.criticalRecovery) return { ok: false, reason: 'critical-recovery-not-started' };
    if (item.criticalRecovery.outcome !== null) return { ok: false, reason: 'critical-recovery-closed' };
    item.criticalRecovery.outcome = outcome;
    const result: CriticalRecoveryDecision = {
      task, kind: 'critical-recovery', used: 1, findings: [...item.criticalRecovery.findings],
      reason: reason.trim(), outcome,
    };
    item.decisions = [...(item.decisions || []), result];
    ledger.decisions.push(result);
    { const lost = commitWrite(); if (lost) return lost; }
    return support.withCheckpoint({
      ok: true as const, command, task: item, decision: result, decisions: ledger.decisions,
    },
    ledger, integration.ledgerFile);
  }
  if (item.status !== 'prepared') return { ok: false, reason: 'illegal-transition' };
  if (item.criticalRecovery) return { ok: false, reason: 'critical-recovery-exhausted' };
  if (!Array.isArray(findings) || findings.length === 0 || findings.some((entry) => entry.trim() === '')) {
    return { ok: false, reason: 'findings-required' };
  }
  item.criticalRecovery = { used: 1, findings: [...findings], reason: reason.trim(), outcome: null };
  const started: CriticalRecoveryDecision = {
    task, kind: 'critical-recovery', used: 1, findings: [...findings], reason: reason.trim(), outcome: null,
  };
  item.decisions = [...(item.decisions || []), started];
  ledger.decisions.push(started);
  { const lost = commitWrite(); if (lost) return lost; }
  return support.withCheckpoint({
    ok: true as const, command, task: item, decision: started, decisions: ledger.decisions,
  },
  ledger, integration.ledgerFile);
}

/**
 * finalReviewGate가 낼 수 있는 거절 reason의 읽기 전용 목록. 문서 lint(check-doc-shape)가
 * rules/cli.md의 거절 표를 이 목록과 대조한다. 값만 노출하며 repair나 원장 쓰기를 일으키지 않는다.
 * 새 reason을 finalReviewGate에 추가하면 이 목록에도 넣어야 문서 표 검사가 따라온다.
 */
const FINAL_REVIEW_REJECTION_REASONS: readonly string[] = Object.freeze([
  'review-contract-invalid', 'final-review-single-round', 'final-review-repair-scope',
]);

export = {
  FINAL_REVIEW_REJECTION_REASONS,
  supplementDone, coordinateRepair, coordinatePartialClose, coordinateCriticalRecovery,
};
