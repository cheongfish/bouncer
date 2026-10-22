'use strict';
import canonicalJsonMod = require('./canonical-json');
const { canonicalJson } = canonicalJsonMod;
const { spawnSync } = require('node:child_process');
import type { DocLeaf, TaskUnit } from './validate-docs';
import comprehension = require('./comprehension');
import validateDocs = require('./validate-docs');

// 게이트 단계 모듈이 공유하는 타입·헬퍼. validate·finalize·review-dispatch를
// require하지 않는다 — 상위 오케스트레이션이 이 층을 다시 부르면 순환이 생긴다.

type FailureEntry = { code: string; message: string; file: string };
type BlueprintRels = {
  epicIndex: string;
  blueprintIndex: string;
  tasks: string;
  verification: string;
  review: string;
  explain: string;
  contextReview: string;
  [key: string]: string;
};
type BlueprintDocs = {
  epicIndex?: DocLeaf;
  blueprintIndex?: DocLeaf;
  verification?: DocLeaf;
  review?: DocLeaf;
  explain?: DocLeaf;
  contextReview?: DocLeaf;
  tasks?: DocLeaf;
  tasksDocs?: DocLeaf[];
  taskUnits?: TaskUnit[];
};
type VerifyLedgerRecord = {
  unavailable?: boolean;
  reason?: string;
  rel?: unknown;
  command?: unknown;
  ran_at?: unknown;
  exit_code?: unknown;
  output_sha?: unknown;
  evidence_id?: unknown;
  identity?: unknown;
  scope?: unknown;
  reused?: unknown;
  reused_from?: unknown;
  source_digest?: unknown;
};

type GateDeps = {
  computeDiffSha?: typeof comprehension.computeDiffSha;
  // comprehension.computeDiffSha의 GitExec와 맞춰 소비자 캐스트 없이 주입한다.
  exec?: (args: string[]) => { status: number; stdout: string; stderr: string };
  stagedFiles?: typeof validateDocs.defaultStagedFiles;
  readVerifyLedger?: (opts: {
    repoRoot?: string;
    verificationRel?: string;
    evidenceId?: string;
    deps?: GateDeps;
  }) => VerifyLedgerRecord | null;
  // runtime-state.verifyLedgerPathFor의 ExecFileSyncFn과 맞춘다. Node 전체
  // 오버로드(typeof execFileSync)를 쓰면 RuntimeDeps 대입이 깨진다.
  execFileSync?: (
    file: string,
    args?: readonly string[],
    options?: { cwd?: unknown; encoding?: unknown; stdio?: unknown },
  ) => string | Buffer;
  fs?: {
    existsSync: (p: string) => boolean;
    readFileSync: (p: string, encoding: string) => string;
  };
  platform?: string;
  // finalize G21 stale 검사용. 원장이 없으면 null — drive가 아니므로 git을 부르지 않는다.
  readCoordinatorLedger?: (opts: { repoRoot: string }) => { blueprint: string } | null;
  // commit G23: verify 시점 source_digest와 현재 checkout을 대조한다.
  sourceDigest?: (repoRoot: string) => string;
  // G24: 승인 파일. null은 파일 없음(대조 skip), ok:false는 unreadable 실패.
  readApprovalSnapshot?: (opts: {
    repoRoot: string;
    blueprintDir: string;
  }) => ApprovalRead;
  // G24: common dir coordinator 원장. 객체가 있으면 대조 skip.
  // G21의 checkout 원장 seam `readCoordinatorLedger`와 별개다.
  coordinatorLedgerFor?: (opts: {
    repoRoot: string;
    blueprint: string;
  }) => object | null;
};
type ApprovalRead =
  | { ok: true; snapshot: { digest: string; parts: Record<string, string> } }
  | { ok: false; path: string }
  | null;

type GateContext = {
  repoRoot?: string;
  blueprintDir?: string;
  deps?: GateDeps;
  taskUnit?: TaskUnit | null;
  // loader가 남긴 S0 원본 목록. failures에 합쳐지기 전 문서별 파싱 실패를 구분할 때 쓴다.
  parseErrors?: FailureEntry[];
  // plan task 분해 보조 신호. failures와 분리 — 호출부가 배열을 넘길 때만 채운다.
  warnings?: FailureEntry[];
  partialClose?: { ledger?: unknown; handoff?: unknown; userConfirmed?: boolean };
};

type CheckGateOpts = {
  gate: string;
  docs?: BlueprintDocs;
  rels?: BlueprintRels;
  repoRoot?: string;
  blueprintDir?: string;
  deps?: GateDeps;
  taskUnit?: TaskUnit | null;
  parseErrors?: FailureEntry[];
  partialClose?: { ledger?: unknown; handoff?: unknown; userConfirmed?: boolean };
};

type GateStageCtx = {
  add: (code: string, message: string, fileKey: string) => void;
  docs: BlueprintDocs;
  rels: BlueprintRels;
  // add는 rels[fileKey]만 쓴다. execute·commit·finalize는 unit 경로·G17에
  // failures를 직접 push하므로 단계 ctx에 배열을 같이 넘긴다.
  failures: FailureEntry[];
  repoRoot?: string;
  blueprintDir?: string;
  deps?: GateDeps;
  taskUnit?: TaskUnit | null;
  parseErrors?: FailureEntry[];
  partialClose?: { ledger?: unknown; handoff?: unknown; userConfirmed?: boolean };
  warnings?: FailureEntry[];
};

/**
 * 단계 함수가 G13·G21처럼 GateContext를 받는 헬퍼를 그대로 부르게 한다.
 * stage 필드를 빼먹으면 repoRoot·deps가 비어 기본 원장 읽기가 건너뛰어질 수 있다.
 *
 * @param {GateStageCtx} stage - runCheckGate가 만든 단계 문맥
 * @returns {GateContext} 기존 헬퍼가 기대하는 문맥
 */
function toGateContext(stage: GateStageCtx): GateContext {
  return {
    repoRoot: stage.repoRoot,
    blueprintDir: stage.blueprintDir,
    deps: stage.deps,
    taskUnit: stage.taskUnit,
    parseErrors: stage.parseErrors,
    warnings: stage.warnings,
    partialClose: stage.partialClose,
  };
}

/**
 * 문서 YAML data를 레코드로 읽는다. data가 null이면 빈 객체로 바꾸지 않는다 —
 * 예전 호출부가 `.bouncer` 접근에서 터지던 실패 형태를 유지해야 한다.
 *
 * @param {DocLeaf | undefined | null} doc - 로드된 문서 또는 부재
 * @returns {Record<string, unknown> | undefined} data. 문서가 없으면 undefined
 */
function asData(doc: DocLeaf | undefined | null): Record<string, unknown> | undefined {
  if (!doc) return undefined;
  // 호출부가 `doc.data.bouncer`로 바로 들어가던 곳은 그대로 두기 위해
  // 여기서 data를 빈 객체로 바꾸지 않는다. null data는 예전처럼 접근 시 터진다.
  return doc.data as Record<string, unknown>;
}

/**
 * 주입된 git exec가 없으면 repoRoot에 바인딩한 spawnSync를 쓴다.
 * merge-base --is-ancestor는 status 1이 정상 실패라 execFileSync를 쓰면 안 된다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string[]} args - `git` 뒤 argv
 * @param {GateDeps['exec']} [injected] - 테스트 seam
 * @returns {{ status: number, stdout: string, stderr: string }} git 결과
 */
function gitExec(
  repoRoot: string,
  args: string[],
  injected?: GateDeps['exec'],
): { status: number; stdout: string; stderr: string } {
  if (typeof injected === 'function') return injected(args);
  const r = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return {
    status: typeof r.status === 'number' ? r.status : 1,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

/**
 * 마지막 라운드의 `target.head`. 없거나 빈 값이면 라운드 계약이 없다.
 *
 * @param {unknown} rounds - `bouncer.review.rounds`
 * @returns {string | null} head 또는 null
 */
function lastReviewHead(rounds: unknown): string | null {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  const last = rounds[rounds.length - 1];
  if (!last || typeof last !== 'object') return null;
  const target = (last as Record<string, unknown>).target;
  if (!target || typeof target !== 'object') return null;
  const head = (target as Record<string, unknown>).head;
  return typeof head === 'string' && head.trim() !== '' ? head : null;
}

/**
 * git stderr에서 첫 줄을 골라 G21 메시지에 붙인다. 여러 줄 전체를 넣으면
 * gate 실패 문구가 한 줄 계약을 넘는다.
 *
 * @param {string} stderr - exec 결과 stderr
 * @returns {string} 첫 줄(trim). 비어 있으면 빈 문자열
 */
function firstStderrLine(stderr: string): string {
  const line = String(stderr).split(/\r?\n/)[0] || '';
  return line.trim();
}

/**
 * 객체를 키 정렬 JSON으로 비교한다. G13 identity/scope 대조가 삽입 순서에
 * 흔들리지 않게 한다.
 *
 * @param {unknown} left - 문서 값
 * @param {unknown} right - 원장 값
 * @returns {boolean} 동치면 true
 */
function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

/**
 * `collectFindingFailures`가 돌려준 메시지 중 gate가 실패로 남길 실질 판정인지 가린다.
 * 열린 finding·열린 must_fix는 리뷰가 승인될 수 없다는 뜻이고, findings 배열·status·actionability가
 * 깨지면 위 두 판정을 내릴 수 없으므로 fail-closed로 같이 남긴다. 나머지(severity·note·fingerprint·
 * rounds 순서 등) 형식 위반은 기록 시점(`review record`·`accept-risk`)이 이미 거절하므로 gate에서는 뺀다.
 * id 자리는 `.+`다 — id 없는 finding은 `(no id)`(공백 포함)로 찍힌다.
 *
 * @param {string} message - `collectFindingFailures`의 메시지 한 건
 * @returns {boolean} gate 실패로 남겨야 하면 true, 형식 메시지라 뺄 수 있으면 false
 */
function isBlockingReviewFailure(message: string): boolean {
  return /^\S+ finding .+ open in accepted review$/.test(message)
    || /^\S+ accepted with open must_fix .+$/.test(message)
    || /^\S+ findings must be an array$/.test(message)
    || /^\S+ finding .+ status invalid: .*$/.test(message)
    || /^\S+ finding .+ actionability (invalid|missing)$/.test(message);
}

export type {
  FailureEntry, BlueprintRels, BlueprintDocs, VerifyLedgerRecord, GateDeps,
  ApprovalRead, GateContext, CheckGateOpts, GateStageCtx,
};
export {
  toGateContext, asData, gitExec, lastReviewHead, firstStderrLine, sameCanonical,
  isBlockingReviewFailure,
};
