'use strict';

// 코디네이터 원장(ledger)과 task의 핵심 타입 정본. 타입 전용 모듈이라 컴파일 결과에
// require가 없고, 다른 lib을 가져오지 않는다 — coordinator·scope·coordinate-next가
// 모두 이 정본에서 읽기 타입을 파생하므로 정본 → 소비자 방향 간선을 만들면 순환이 된다.
// 예전에는 세 파일이 각자 Task·Ledger를 선언해 필드가 어긋나도 컴파일러가 못 잡았다.
// 읽기 쪽은 `Pick`/`Omit`으로 파생해 정본 필드가 바뀌면 컴파일러가 소비자를 짚게 한다.

/** report outcome 열거. coordinator의 REPORT_OUTCOMES가 `satisfies`로 이 합집합과 맞춰진다. */
export type ReportOutcome = 'accepted' | 'rework' | 'scope_revision' | 'task_change' | 'blocked';

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
  verify_evidence_id?: string; review_evidence_id?: string; advisory?: unknown;
};

export type FailureEvidence = {
  task: string; command: string; summary: string; paths: string[]; exitCode: number; repairWave: number;
  findings?: string[];
};

export type RepairDecision = {
  task: string; kind: 'repair'; wave: number; reason: string; failure: FailureEvidence;
  previousDag: Array<{ id: string; depends_on: string[] }>;
  nextDag: Array<{ id: string; depends_on: string[] }>;
  previousScope: string[]; nextScope: string[]; necessity: string; revision: string;
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
  status?: 'active' | 'awaiting_confirmation' | 'partial_closed' | 'promotion_stopped';
  userConfirmed?: boolean; revision?: string;
  leaseSeq?: number;
  // light만 기록한다. 부재·undefined는 full(legacy 호환). 응답 mode는 항상 light|full.
  mode?: 'light';
  // light 승격 정지 스냅샷. status가 promotion_stopped일 때만 쓴다. fanin·terminalFailure와 별개.
  promotion?: PromotionRecord;
  // candidate fan-in 진행 상태. null/부재는 진행 없음. building→verified→null.
  fanin?: FaninState | null;
};

export type LedgerRef = { path: string; sha256: string; revision: string | null };

/** current pointer 또는 worker lease로 해석된 실행 대상 task. */
export type EffectiveTask =
  | { source: 'lease'; blueprint: string; path: string; id: string; lease_id: string | null; generation: number | null }
  | { source: 'pointer'; blueprint: string; path: string; id: string | null }
  | { source: null; blueprint: string; reason: 'no-active-lease' | 'unreadable-ledger'; path: null; id: null };
