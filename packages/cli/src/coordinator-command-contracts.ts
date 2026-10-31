import type { Exec, Ledger, VerificationRunner } from './execution-contracts';
import runtime = require('./runtime-state');

type WriteLedger = (file: string, data: unknown) => void;

export type CoordinateArgs = {
  command: string; repoRoot: string; blueprint: string; cwd?: string; task?: string; sha?: string; decision?: unknown;
  failureCommand?: string; summary?: string; paths?: string[]; userConfirmed?: boolean;
  findings?: string[]; reviewFindings?: string[]; kind?: string; done?: boolean; outcome?: string; reason?: string;
  resumeTask?: string; disposition?: string; newPaths?: string[]; verify?: string;
  attempt?: number; taskBriefHash?: string; acceptBrokenBaseline?: boolean;
  text?: string; model?: string | true; role?: string; perspective?: string; tokens?: number | string;
  // worker-model 전용 선택 키. coordinator가 review-dispatch payload의 값을 그대로 넘긴다(계산하지 않음).
  strategy?: string; reviewerTier?: string;
  // worker-tokens 전용. 키의 가장 나중 worker-tokens 기록을 덧붙이지 않고 교체한다(값 없는 플래그만 true).
  replace?: boolean;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  deps?: {
    execFileSync?: Exec; runVerification?: VerificationRunner; writeLedger?: WriteLedger;
    makeLeaseId?: () => string;
    appendHandoff?: (mainRoot: string, file: string, record: string) => () => void;
  };
};

export type CoordinateResult = unknown;

/** 명령마다 다른 payload를 유지하는 공통 lock 전 문맥이다. */
export type CoordinateCtx = {
  args: CoordinateArgs;
  cwd: string;
  deps: NonNullable<CoordinateArgs['deps']>;
  exec: Exec;
  writeLedger: WriteLedger;
  makeLeaseId: () => string;
  main: ReturnType<typeof runtime.runtimePaths>;
  base: string;
  paths: ReturnType<typeof runtime.coordinatorPathsFor>;
  integration: ReturnType<typeof runtime.coordinatorPathsFor>;
};

export type LockedCtx = CoordinateCtx & {
  ledger: Ledger;
  ledgerBytes: Buffer;
  commitWrite: () => { ok: false; reason: 'ledger-lock-lost' } | null;
};

export type TaskCtx = LockedCtx & { item: Ledger['tasks'][number]; task: string };

export type LedgerFail = { ok: false; reason: string };
export type OpenedLedger = { ok: true; ledger: Ledger; bytes: Buffer };

export type PlannedWorker = { worker: string; branch: string; action: 'reuse' | 'create' };
export type CreatedWorker = { worker: string; branch: string };
export type SalvageResult = {
  patch?: string; ref?: string; report?: string; dirty_paths: string[]; head: string; generation: number;
};
export type SalvageEntry = SalvageResult & { task: string };
