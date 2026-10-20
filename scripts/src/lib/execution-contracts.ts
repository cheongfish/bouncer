'use strict';

// 코디네이터 원장(ledger)과 task의 핵심 타입 정본. 다른 lib을 가져오지 않고 컴파일 결과에
// require가 없다(값 export는 아래 의존 없는 순수 판정 하나뿐) — coordinator·scope·coordinate-next가
// 모두 이 정본에서 읽기 타입을 파생하므로 정본 → 소비자 방향 간선을 만들면 순환이 된다.
// 예전에는 세 파일이 각자 Task·Ledger를 선언해 필드가 어긋나도 컴파일러가 못 잡았다.
// 읽기 쪽은 `Pick`/`Omit`으로 파생해 정본 필드가 바뀌면 컴파일러가 소비자를 짚게 한다.

/** report outcome 열거. coordinator의 REPORT_OUTCOMES가 `satisfies`로 이 합집합과 맞춰진다. */
export type ReportOutcome = 'accepted' | 'rework' | 'scope_revision' | 'task_change' | 'blocked';

export type Exec = (file: string, args?: readonly string[], options?: {
  cwd?: unknown; encoding?: unknown; stdio?: unknown;
}) => string | Buffer;

export type VerificationRunner = (opts: {
  repoRoot: string;
  blueprintDir: string;
  taskId?: string;
  scope?: { kind: 'task' | 'wave' | 'terminal'; key: string };
}) => {
  ok: boolean; command: string; exitCode: number;
  evidenceId?: string; reused?: boolean; reusedFrom?: string;
};

/** light 승격 정지 사유. coordinator의 PROMOTE_STOP_REASONS가 `satisfies`로 맞춰진다. */
export type PromoteStopReason =
  'security-risk' | 'out-of-scope' | 'task-split' | 'interface-semantics' | 'reviewer-wider-scope';

export type PromotionRecord = {
  reason: PromoteStopReason;
  summary: string;
  task: string;
  diff_sha: string;
  verify_evidence_id?: string;
  review_evidence_id?: string;
};

export type DispatchState = {
  attempt: number; task_brief_hash: string; base_head: string; initial_worktree_state: string;
  status: 'active' | 'reported'; outcome?: ReportOutcome; summary?: string;
  // dispatch에 넘긴 모델 인자(slug 또는 inherit). `--model`을 준 attempt에만 있다.
  model?: string;
};

export type Lease = {
  id: string; generation: number; seq: number; status: 'active' | 'revoked';
};

export type Task = {
  id: string; depends_on?: string[]; dependency_gate?: string; parallel_safe?: boolean;
  execution_kind?: 'commit' | 'verification'; status?: string; workerPath?: string; branch?: string; sha?: string;
  decisions?: unknown[]; scope?: { revision: string; paths: string[] }; dynamic?: boolean;
  // scope.ts만 읽는다. integrate가 실제로 건드린 경로를 기록한다.
  actualPaths?: string[];
  affected_paths?: string[]; exclusive_resources?: string[];
  criticalRecovery?: { used: 1; findings: string[]; reason: string; outcome: 'resolved' | 'blocked' | null };
  dispatch?: DispatchState;
  lease?: Lease;
  // `repair --resume-task`가 이미 integrated였던 task를 재배정했다는 표지. terminal이 이 task의
  // 재통합을 기다리게 하는 근거라 DAG(depends_on)를 건드리지 않고 지속시킨다.
  resumed?: true;
  verify_evidence_id?: string; review_evidence_id?: string; advisory?: unknown;
};

/**
 * 입증된 범위 밖 terminal 실패 분류. 실패 사실(FailureEvidence의 command·exitCode)은 그대로 두고
 * 별도 사유만 덧붙인다 — passed·integrated 성공값으로 바꾸지 않는다.
 * evidence_id·source_digest는 분류 당시 원본 실패의 identity이고 paths는 범위 밖으로 판정한 경로다.
 */
export type OutsideScopeDisposition = {
  kind: 'outside_scope'; reason: string; evidence_id: string; source_digest: string; paths: string[];
};

export type FailureEvidence = {
  task: string; command: string; summary: string; paths: string[]; exitCode: number; repairWave: number;
  findings?: string[];
  // terminal 검증 실패 시점의 원본 증거 id와 integration HEAD. 범위 밖 분류가 이 identity에 묶인다.
  // 필드가 없는 legacy 실패는 분류를 받을 수 없고 기존 blocked 의미를 유지한다.
  evidence_id?: string; source_digest?: string;
  disposition?: OutsideScopeDisposition;
};

export type RepairDecision = {
  task: string; kind: 'repair'; wave: number; reason: string; failure: FailureEvidence;
  previousDag: Array<{ id: string; depends_on: string[] }>;
  nextDag: Array<{ id: string; depends_on: string[] }>;
  previousScope: string[]; nextScope: string[]; necessity: string; revision: string;
  owner_generation?: number;
  salvage_predecessor?: { head: string | null; lease_id: string | null; generation: number | null };
  reset_downstream?: string[];
  salvaged?: Array<{
    task: string; patch?: string; ref?: string; head: string; generation: number; dirty_paths: string[];
  }>;
};

export type FaninState = {
  base_head: string;
  candidate_head: string | null;
  tasks: string[];
  status: 'building' | 'verified';
};

export type Ledger = {
  version: 1; blueprint: string; base: string; integrationHead?: string; integrationBranch?: string; tasks: Task[];
  seedManifest?: Array<{ path: string; sha256: string }>;
  decisions: unknown[]; repairWaves?: RepairDecision[]; terminalFailure?: FailureEvidence;
  // detached는 `bouncer run detach`가 남기는 종료 상태다. 이 union에 없으면 읽는 쪽이 문자열 cast를 해야 한다.
  status?: 'active' | 'awaiting_confirmation' | 'partial_closed' | 'promotion_stopped' | 'detached';
  userConfirmed?: boolean; revision?: string;
  leaseSeq?: number;
  // light만 기록한다. 부재·undefined는 full(legacy 호환). 응답 mode는 항상 light|full.
  mode?: 'light';
  // light 승격 정지 스냅샷. status가 promotion_stopped일 때만 쓴다. fanin·terminalFailure와 별개.
  promotion?: PromotionRecord;
  // light 원장을 full로 승격할 때 보관 위치와 재사용할 dirty 변경 patch를 기록한다.
  promoted_from?: { archive: string; patch: string | null; diff_sha: string; reason: string; task: string };
  // candidate fan-in 진행 상태. null/부재는 진행 없음. building→verified→null.
  fanin?: FaninState | null;
};

export type LedgerRef = { path: string; sha256: string; revision: string | null };

/** current pointer 또는 worker lease로 해석된 실행 대상 task. */
export type EffectiveTask =
  | { source: 'lease'; blueprint: string; path: string; id: string; lease_id: string | null; generation: number | null }
  | { source: 'pointer'; blueprint: string; path: string; id: string | null }
  | { source: null; blueprint: string; reason: 'no-active-lease' | 'unreadable-ledger'; path: null; id: null };

const nonEmptyText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * terminal verification task가 "성공은 아니지만 범위 밖 실패로 입증돼 완료를 막지 않는" 상태인지
 * 판정한다. next·gate·digest·finalize가 같은 판정을 쓰도록 한 곳에 둔다 — 소비자마다
 * 조건이 다르면 한쪽은 진행시키고 다른 쪽은 막아 drive가 갈라진다.
 *
 * 모든 조건이 맞을 때만 분류를 돌려준다: task가 verification이고 `verifying`이며,
 * 원장 terminalFailure가 그 task의 것이고, disposition이 완전하며(kind·reason·evidence_id·
 * source_digest·paths), 실패 증거의 identity와 일치하고, 현재 integrationHead가 분류 당시의
 * source_digest와 같다(소스가 바뀌었으면 stale). 어느 하나라도 어긋나면 null이라 호출자는
 * 기존 blocked/미완료 의미를 그대로 유지한다.
 *
 * @param {unknown} ledger - 원장 객체(읽기만 한다). 모양이 틀리면 null
 * @param {string} taskId - 세 자리 terminal task id (`TASKS-` 접두는 벗겨 비교한다)
 * @returns {OutsideScopeDisposition | null} 유효한 분류, 아니면 null
 */
export function validOutsideScope(ledger: unknown, taskId: string): OutsideScopeDisposition | null {
  if (!ledger || typeof ledger !== 'object') return null;
  const root = ledger as { tasks?: unknown; terminalFailure?: unknown; integrationHead?: unknown };
  const id = String(taskId).replace(/^TASKS-/, '');
  const task = (Array.isArray(root.tasks) ? root.tasks : []).find(
    (entry: unknown) => Boolean(entry) && typeof entry === 'object' && (entry as { id?: unknown }).id === id,
  ) as { execution_kind?: unknown; status?: unknown } | undefined;
  if (!task || task.execution_kind !== 'verification' || task.status !== 'verifying') return null;
  const failure = root.terminalFailure as Partial<FailureEvidence> | undefined;
  if (!failure || typeof failure !== 'object' || failure.task !== id) return null;
  const disposition = failure.disposition as Partial<OutsideScopeDisposition> | undefined;
  if (!disposition || typeof disposition !== 'object' || disposition.kind !== 'outside_scope') return null;
  if (!nonEmptyText(disposition.reason) || !nonEmptyText(disposition.evidence_id)
    || !nonEmptyText(disposition.source_digest)) return null;
  if (!Array.isArray(disposition.paths) || disposition.paths.length === 0
    || !disposition.paths.every(nonEmptyText)) return null;
  if (disposition.evidence_id !== failure.evidence_id || disposition.source_digest !== failure.source_digest) {
    return null;
  }
  if (root.integrationHead !== disposition.source_digest) return null;
  return disposition as OutsideScopeDisposition;
}
