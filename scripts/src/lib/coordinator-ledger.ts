'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
import runtime = require('./runtime-state');
import configMod = require('./config');
const { readCoordinatorPolicy } = configMod;
import executionDag = require('./execution-dag');
const { readyWave } = executionDag;
import leaseMod = require('./lease');
const { isValidLease, isValidLeaseSeq } = leaseMod;
import coordinatorWorker = require('./coordinator-worker');
const { reportPathFor } = coordinatorWorker;
import driveMetrics = require('./drive-metrics');
import type { Ledger, Task, DispatchState, FailureEvidence, LedgerRef } from './execution-contracts';

const LEDGER_REL = runtime.COORDINATOR_LEDGER_REL;

function atomicWrite(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

/**
 * 원장 bytes와 파싱 결과를 같은 snapshot에서 읽어 fence가 TOCTOU로 느슨해지지 않게 한다.
 *
 * @param {string} file - 원장 절대 경로
 * @returns {{ ledger: Ledger, bytes: Buffer } | null} 파일이 없으면 null
 */
function loadLedgerBytes(file: string): { ledger: Ledger; bytes: Buffer } | null {
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  return { ledger: JSON.parse(bytes.toString('utf8')) as Ledger, bytes };
}

function loadLedger(file: string): Ledger | null {
  const loaded = loadLedgerBytes(file);
  return loaded ? loaded.ledger : null;
}

/** @param {Buffer} bytes - load 시점의 원장 bytes @returns {string} SHA-256 hex */
function ledgerBytesHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * mutation이 들고 온 원장 경로와 hash를 검사하고 detached ledger를 차단한다.
 *
 * @param {{ ledgerPath?: string, ledgerHash?: string, ledgerBytes: Buffer }} opts - fence 입력
 * @returns {{ok: true} | {ok: false, reason: string}} 기존 거절 reason 또는 통과
 */
function assertLedgerFence(opts: {
  ledgerPath?: string; ledgerHash?: string; ledgerBytes: Buffer;
}): { ok: true } | { ok: false; reason: string } {
  const { ledgerPath, ledgerHash, ledgerBytes } = opts;
  if (typeof ledgerPath !== 'string' || ledgerPath === ''
    || typeof ledgerHash !== 'string' || ledgerHash === '') return { ok: false, reason: 'ledger-checkpoint-invalid' };
  if (path.isAbsolute(ledgerPath)) return { ok: false, reason: 'ledger-checkpoint-invalid' };
  if (ledgerPath.includes('\\') || ledgerPath.split('/').includes('..')
    || ledgerPath.split('/').includes('') || ledgerPath !== LEDGER_REL) {
    return { ok: false, reason: 'ledger-checkpoint-invalid' };
  }
  if (!/^[a-f0-9]{64}$/.test(ledgerHash)) return { ok: false, reason: 'ledger-checkpoint-invalid' };
  if (!Buffer.isBuffer(ledgerBytes) || ledgerBytes.length === 0) {
    return { ok: false, reason: 'ledger-checkpoint-invalid' };
  }
  if (ledgerBytesHash(ledgerBytes) !== ledgerHash) return { ok: false, reason: 'stale-ledger-checkpoint' };
  // 모든 fenced mutation이 공유하는 끝단 검사라 새 명령도 detached 상태를 빠뜨리지 않는다.
  const parsed = JSON.parse(ledgerBytes.toString('utf8')) as { status?: unknown };
  if (parsed && parsed.status === 'detached') return { ok: false, reason: 'run-detached' };
  return { ok: true };
}

/**
 * 잠금 소유를 확인한 뒤에만 원장을 쓴다.
 *
 * @param {() => boolean} owns - 현재 잠금 소유 확인
 * @param {(file: string, data: unknown) => void} writeLedger - 원자 쓰기 구현
 * @param {string} file - 원장 경로
 * @param {Ledger} ledger - 기록할 원장
 * @returns {{ok: false, reason: 'ledger-lock-lost'} | null} 소유 상실 시 실패
 */
function writeOwnedLedger(
  owns: () => boolean, writeLedger: (file: string, data: unknown) => void, file: string, ledger: Ledger,
): { ok: false; reason: 'ledger-lock-lost' } | null {
  if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
  writeLedger(file, ledger);
  return null;
}

type CompletedTaskSummary = {
  id: string; status: string; attempt?: number; commit_sha?: string;
  changed_paths?: string[]; scope_revision?: string;
  verify_evidence_id?: string; review_evidence_id?: string; advisory?: unknown;
};

type ActiveTaskProjection = {
  id: string; status: string; depends_on?: string[]; dependency_gate?: string;
  parallel_safe?: boolean; workerPath?: string; branch?: string;
  scope?: { revision: string; paths: string[] }; dispatch?: DispatchState;
  report?: { path: string; attempt: number; state: 'present' | 'absent' };
};

/**
 * 보고 파일의 존재를 투영 시점에 관측한다. 원장에는 기록하지 않는다.
 * 일반 파일이고 크기가 0보다 클 때만 present다. 파일 없음·0바이트·디렉터리와
 * 그 밖의 모든 stat 오류는 absent로 접는다 — 이 관측은 복구 재개 여부를 정하는
 * 보수적 신호일 뿐이라 오류를 던지면 status 전체가 깨지고, absent는 기존
 * 보존 중단 경로로 이어지므로 안전하다.
 *
 * @param {string} reportPath - 현재 attempt의 보고 파일 절대 경로
 * @returns {'present' | 'absent'} 관측 결과
 */
function observeReport(reportPath: string): 'present' | 'absent' {
  try {
    const stat = fs.statSync(reportPath);
    return stat.isFile() && stat.size > 0 ? 'present' : 'absent';
  } catch (_error) {
    // stat 실패(ENOENT·EACCES 등)는 모두 absent: 위 docstring의 보수적 접힘 근거 참조.
    return 'absent';
  }
}

/**
 * 현재 CLI는 호스트 실행기를 추적하지 않으므로 항상 관측 불가를 뜻하는 상수 모양이다.
 * running·terminated는 root가 실제 호스트 핸들로만 확인하며 여기서 만들지 않는다.
 */
// 실패 사유가 아니므로 `reason: '...'` 리터럴 대신 상수로 두어 COORDINATE_FAILURE_HINTS
// 전수 검사(실패 reason 리터럴 수집)에 섞이지 않게 한다.
const EXECUTOR_NOT_TRACKED = 'executor-state-not-tracked' as const;
type ExecutorObservation = {
  state: 'unknown'; source: 'unavailable'; reason: typeof EXECUTOR_NOT_TRACKED;
};
type CoordinatorCheckpoint = {
  ready: string[];
  active_tasks: ActiveTaskProjection[];
  completed_tasks: CompletedTaskSummary[];
  unresolved_decisions: unknown[];
  recent_failure: FailureEvidence | null;
  integration_head: string | null;
  revision: string | null;
  ledger: LedgerRef;
  executor_observation: ExecutorObservation;
  // status 응답에만 싣는다(mutation 응답은 생략). 계측 기록 요약이라 원장 판단에 쓰지 않는다.
  sessions?: ReturnType<typeof driveMetrics.listCoordinatorSessions>;
};

/**
 * 읽기 전용 ready 계산용 한도. 잘못된 config는 1로 접어 병렬 폭을 넓히지 않는다.
 * prepare의 거절 경로와 달리 status·current·commit 안내는 worktree를 만들지 않으므로
 * 여기서는 거절 대신 보수적 폴백만 한다.
 *
 * @param {string} repoRoot - 정책을 읽을 checkout 루트
 * @returns {number} 유효 한도 또는 invalid 시 1
 */
function maxParallelForRead(repoRoot: string): number {
  const policy = readCoordinatorPolicy(repoRoot);
  return policy.ok ? policy.maxParallel : 1;
}

/**
 * 원장 파일 경로에서 integration checkout 루트를 복원한다. checkpoint·bootstrap
 * ready가 prepare와 같은 config를 읽게 하려고 ledger 상대 위치만 쓴다.
 *
 * @param {string} ledgerFile - `.bouncer/runtime/coordinator.json` 절대 경로
 * @returns {string} integration checkout 루트
 */
function integrationRootFromLedger(ledgerFile: string): string {
  return path.resolve(path.dirname(ledgerFile), '..', '..');
}

/**
 * 완료 task를 status에 실을 요약만 고른다. dispatch·decisions 본문은 상세 원장에
 * 남기고, 없는 선택 필드는 키 자체를 생략해 응답이 커지지 않게 한다.
 *
 * @param {Task} task - 원장 task
 * @returns {CompletedTaskSummary} 완료 summary
 */
function summarizeCompletedTask(task: Task): CompletedTaskSummary {
  const summary: CompletedTaskSummary = { id: task.id, status: task.status || 'integrated' };
  if (task.dispatch && Number.isInteger(task.dispatch.attempt)) {
    summary.attempt = task.dispatch.attempt;
  }
  if (typeof task.sha === 'string' && task.sha !== '') summary.commit_sha = task.sha;
  if (task.scope && Array.isArray(task.scope.paths)) summary.changed_paths = [...task.scope.paths];
  if (task.scope && typeof task.scope.revision === 'string') {
    summary.scope_revision = task.scope.revision;
  }
  if (typeof task.verify_evidence_id === 'string' && task.verify_evidence_id !== '') {
    summary.verify_evidence_id = task.verify_evidence_id;
  }
  if (typeof task.review_evidence_id === 'string' && task.review_evidence_id !== '') {
    summary.review_evidence_id = task.review_evidence_id;
  }
  if (task.advisory !== undefined) summary.advisory = task.advisory;
  return summary;
}

/**
 * 다음 dispatch/fan-in에 필요한 활성 task 필드만 고른다. Interface allowlist는
 * current scope·dependency·branch/worktree·dispatch metadata뿐이다 —
 * execution_kind/sha/criticalRecovery/dynamic은 상세 원장에 두고 status를 키우지 않는다.
 *
 * @param {Task} task - 아직 integrated가 아닌 task
 * @returns {ActiveTaskProjection} 활성 projection
 */
function projectActiveTask(task: Task): ActiveTaskProjection {
  const projected: ActiveTaskProjection = {
    id: task.id,
    status: task.status || 'pending',
  };
  if (task.depends_on) projected.depends_on = [...task.depends_on];
  if (task.dependency_gate) projected.dependency_gate = task.dependency_gate;
  if (task.parallel_safe !== undefined) projected.parallel_safe = task.parallel_safe;
  if (task.workerPath) projected.workerPath = task.workerPath;
  if (task.branch) projected.branch = task.branch;
  if (task.scope) projected.scope = { revision: task.scope.revision, paths: [...task.scope.paths] };
  if (task.dispatch) projected.dispatch = { ...task.dispatch };
  // active attempt에만 붙인다: reported 보고는 원장 outcome이 이미 정본이다.
  if (task.dispatch?.status === 'active' && task.workerPath) {
    const reportPath = reportPathFor(task.workerPath, task.id, task.dispatch.attempt);
    projected.report = {
      path: reportPath, attempt: task.dispatch.attempt, state: observeReport(reportPath),
    };
  }
  return projected;
}

/**
 * 상세 원장을 보존한 채 status/mutation 응답에 실을 bounded checkpoint를 만든다.
 * unresolved decision은 아직 integrated가 아닌 task를 가리키는 항목만 남겨,
 * 완료 task의 과거 decision 본문이 활성 context로 되살아나지 않게 한다.
 * sha256은 호출자가 넘긴 원장 bytes(또는 쓰기 직후 디스크)에 묶는다.
 *
 * @param {Ledger} ledger - 메모리상 원장 정본
 * @param {string} ledgerFile - 쓰기 후 hash용 절대 경로(ledgerBytes 없을 때)
 * @param {Buffer} [ledgerBytes] - load 시 고정한 bytes. 있으면 디스크를 다시 읽지 않는다
 * @returns {CoordinatorCheckpoint} compact checkpoint
 */
function projectCheckpoint(
  ledger: Ledger, ledgerFile: string, ledgerBytes?: Buffer,
): CoordinatorCheckpoint {
  const completed_tasks: CompletedTaskSummary[] = [];
  const active_tasks: ActiveTaskProjection[] = [];
  const integratedIds = new Set<string>();
  for (const task of ledger.tasks) {
    if (task.status === 'integrated') {
      integratedIds.add(task.id);
      completed_tasks.push(summarizeCompletedTask(task));
    } else {
      active_tasks.push(projectActiveTask(task));
    }
  }
  const unresolved_decisions = (Array.isArray(ledger.decisions) ? ledger.decisions : [])
    .filter((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const id = (entry as { task?: unknown }).task;
      return typeof id === 'string' && !integratedIds.has(id);
    });
  // 쓰기 직후는 디스크로 확정된 bytes를 읽고, status·fence 직전에는 load bytes를 재사용한다.
  const sha256 = ledgerBytes
    ? ledgerBytesHash(ledgerBytes)
    : ledgerBytesHash(fs.readFileSync(ledgerFile));
  return {
    ready: readyWaveGated(ledger.tasks, {
      maxParallel: maxParallelForRead(integrationRootFromLedger(ledgerFile)),
    }),
    active_tasks,
    completed_tasks,
    unresolved_decisions,
    recent_failure: ledger.terminalFailure || null,
    integration_head: typeof ledger.integrationHead === 'string' ? ledger.integrationHead : null,
    revision: typeof ledger.revision === 'string' ? ledger.revision : null,
    ledger: {
      path: LEDGER_REL,
      sha256,
      revision: typeof ledger.revision === 'string' ? ledger.revision : null,
    },
    // active는 launch 전에 기록되고 stale report도 해시를 바꾸므로, 원장 값은
    // 워커 생존의 증거가 아니다. 프로세스 관측·원장 저장 없이 한계만 명시한다.
    executor_observation: {
      state: 'unknown', source: 'unavailable', reason: EXECUTOR_NOT_TRACKED,
    },
  };
}

/**
 * `readyWave`에 "재배정된 task가 재통합되기 전에는 terminal을 열지 않는다"는 규칙을 더한다.
 * `repair --resume-task`는 DAG를 바꾸지 않으므로 terminal의 직접 선행(통합 완료)만 보면 terminal이
 * 재작업과 동시에(또는 id 순서상 먼저) 열릴 수 있다. resumed 표지가 붙은 task가 integrated가 되기
 * 전까지 pending terminal을 후보에서 뺀다. resumed 표지가 없는 원장은 입력 그대로 `readyWave`에 간다.
 *
 * @param {Task[]} tasks - 원장 task 목록(읽기만 한다)
 * @param {{ maxParallel?: number }} [options] - `readyWave`와 같은 동시 실행 상한
 * @returns {string[]} 다음에 열 수 있는 task id
 */
function readyWaveGated(tasks: Task[], options?: { maxParallel?: number }): string[] {
  const reopened = tasks.some((entry) => entry.resumed === true && entry.status !== 'integrated');
  if (!reopened) return readyWave(tasks, options);
  return readyWave(tasks.map((entry) => (
    entry.execution_kind === 'verification' && (entry.status || 'pending') === 'pending'
      ? { ...entry, status: 'waiting-for-resumed' }
      : entry
  )), options);
}

/**
 * 원장 lease 필드만 검사한다. 전체 validateCoordinatorLedger는 partial-close
 * 불변조건까지 보므로, 일반 mutation에서는 lease-invalid만 분리해 거절한다.
 *
 * @param {Ledger} ledger - 로드한 원장
 * @returns {{ok: true} | {ok: false, reason: 'lease-invalid'}}
 */
function assertLeaseShape(ledger: Ledger): { ok: true } | { ok: false; reason: 'lease-invalid' } {
  if (!isValidLeaseSeq(ledger.leaseSeq)) return { ok: false, reason: 'lease-invalid' };
  for (const task of ledger.tasks) {
    if (task.lease !== undefined && !isValidLease(task.lease)) {
      return { ok: false, reason: 'lease-invalid' };
    }
  }
  return { ok: true };
}

export = {
  atomicWrite, loadLedgerBytes, loadLedger, ledgerBytesHash, assertLedgerFence, writeOwnedLedger, LEDGER_REL,
  projectCheckpoint, assertLeaseShape,
  // coordinator-commands가 checkpoint와 같은 ready 계산·한도 폴백을 쓰도록 함께 내보낸다.
  readyWaveGated, maxParallelForRead,
};

