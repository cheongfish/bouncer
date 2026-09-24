'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync: realExecFileSync } = require('node:child_process');
import runtime = require('./runtime-state');
const {
  coordinatorPathsFor, runtimePaths, branchNamesFor, resolveWorktreeBranch,
  COORDINATOR_LEDGER_REL,
} = runtime;
import seed = require('./seed-worktree');
const { seedCoordinatorWorker, seedIntegration, releaseSeedManifest } = seed;
import frontmatter = require('./frontmatter');
const { parseFrontmatter, readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import schema = require('./schema');
const { executionKindOf } = schema;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import commitShaMod = require('./commit-sha');
const { normalizeCommitSha } = commitShaMod;
import pathsMod = require('./paths');
const { parsePathIds } = pathsMod;
import validateSections = require('./validate-sections');
const { pathsOverlap } = validateSections;
import configMod = require('./config');
const { readCoordinatorPolicy, DEFAULT_MAX_PARALLEL } = configMod;
import scopeMod = require('./scope');
const { withLedgerLock } = scopeMod;
import leaseMod = require('./lease');
const { issueLease, revokeLease, checkLease } = leaseMod;
const { randomUUID } = require('node:crypto');

// runtime-state가 정본. 여기서 다시 문자열을 쓰면 fence path와 validator가 갈라진다.
const LEDGER_REL = COORDINATOR_LEDGER_REL;

/**
 * status/bootstrap을 제외한 원장 쓰기 명령. path/hash 쌍이 없거나 어긋나면
 * Git·파일 mutation보다 먼저 거절해야 stale checkpoint로 상태가 갈라지지 않는다.
 */
const LEDGER_FENCED_COMMANDS = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'release', 'revoke',
]);

/** report outcome 열거. CLI·ledger 검증과 같은 집합을 써야 stale/accepted 판정이 갈라지지 않는다. */
const REPORT_OUTCOMES = ['accepted', 'rework', 'scope_revision', 'task_change', 'blocked'] as const;
type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

type DispatchState = {
  attempt: number; task_brief_hash: string; base_head: string; initial_worktree_state: string;
  status: 'active' | 'reported'; outcome?: ReportOutcome; summary?: string;
};
type DispatchDecision = {
  task: string; kind: 'dispatch'; attempt: number; task_brief_hash: string;
  base_head: string; initial_worktree_state: string;
};
type ReportDecision = {
  task: string; kind: 'report'; attempt: number; task_brief_hash: string;
  outcome: ReportOutcome; summary: string;
};
type StaleReportDecision = {
  task: string; kind: 'stale-report';
  expected: { attempt: number; task_brief_hash: string };
  received: { attempt: number; task_brief_hash: string };
};
type StaleLeaseDecision = {
  task: string; kind: 'stale-lease';
  expected: { lease_id: string; generation: number } | null;
  received: { lease_id?: string; generation?: number };
};
type Lease = {
  id: string; generation: number; seq: number; status: 'active' | 'revoked';
};

type Task = {
  id: string; depends_on?: string[]; dependency_gate?: string; parallel_safe?: boolean;
  execution_kind?: 'commit' | 'verification'; status?: string; workerPath?: string; branch?: string; sha?: string;
  decisions?: unknown[]; scope?: { revision: string; paths: string[] }; dynamic?: boolean;
  affected_paths?: string[]; exclusive_resources?: string[];
  criticalRecovery?: { used: 1; findings: string[]; reason: string; outcome: 'resolved' | 'blocked' | null };
  dispatch?: DispatchState;
  lease?: Lease;
  verify_evidence_id?: string; review_evidence_id?: string; advisory?: unknown;
};
type Ledger = {
  version: 1; blueprint: string; base: string; integrationHead?: string; integrationBranch?: string; tasks: Task[];
  seedManifest?: Array<{ path: string; sha256: string }>;
  decisions: unknown[]; repairWaves?: RepairDecision[]; terminalFailure?: FailureEvidence;
  status?: 'active' | 'awaiting_confirmation' | 'partial_closed'; userConfirmed?: boolean; revision?: string;
  leaseSeq?: number;
  // candidate fan-in 진행 상태. null/부재는 진행 없음. building→verified→null.
  fanin?: FaninState | null;
};
type FaninState = {
  base_head: string;
  candidate_head: string | null;
  tasks: string[];
  status: 'building' | 'verified';
};
type FailureEvidence = {
  task: string; command: string; summary: string; paths: string[]; exitCode: number; repairWave: number;
};
type RepairDecision = {
  task: string; kind: 'repair'; wave: number; reason: string; failure: FailureEvidence;
  previousDag: Array<{ id: string; depends_on: string[] }>;
  nextDag: Array<{ id: string; depends_on: string[] }>;
  previousScope: string[]; nextScope: string[]; necessity: string; revision: string;
};
type RerecordDecision = {
  task: string; kind: 'rerecord'; reason: string; previousSha: string;
  nextSha: string; integrationHead: string;
};
type CriticalRecoveryDecision = {
  task: string; kind: 'critical-recovery'; used: 1; findings: string[];
  reason: string; outcome: 'resolved' | 'blocked' | null;
};
type FaninDecision = {
  kind: 'fanin'; tasks: string[]; base_head: string; candidate_head: string; evidence_id: string | null;
};
type FaninVerificationFailedDecision = {
  kind: 'fanin-verification-failed'; tasks: string[];
  command: string; exitCode: number; evidence_id: string | null;
};
type Exec = (file: string, args?: readonly string[], options?: {
  cwd?: unknown; encoding?: unknown; stdio?: unknown;
}) => string | Buffer;
type VerificationRunner = (opts: {
  repoRoot: string;
  blueprintDir: string;
  taskId?: string;
  scope?: { kind: 'task' | 'wave' | 'terminal'; key: string };
}) => {
  ok: boolean; command: string; exitCode: number;
  evidenceId?: string; reused?: boolean; reusedFrom?: string;
};

type LedgerRef = { path: string; sha256: string; revision: string | null };
type CompletedTaskSummary = {
  id: string; status: string; attempt?: number; commit_sha?: string;
  changed_paths?: string[]; scope_revision?: string;
  verify_evidence_id?: string; review_evidence_id?: string; advisory?: unknown;
};
type ActiveTaskProjection = {
  id: string; status: string; depends_on?: string[]; dependency_gate?: string;
  parallel_safe?: boolean; workerPath?: string; branch?: string;
  scope?: { revision: string; paths: string[] }; dispatch?: DispatchState;
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
};

/**
 * commit은 prepared·recorded, verification은 ready·verifying만 in-flight다.
 * pending·integrated·(commit의) ready는 자리 수를 쓰지 않는다 — prepare가
 * ready를 거쳐 바로 prepared로 올리므로, ready를 세면 한 wave가 자신을 막는다.
 *
 * @param {Task} task - 원장 task
 * @returns {boolean} 동시 실행 한도·충돌 집합에 넣을지
 */
function isInFlight(task: Task): boolean {
  const status = task.status || 'pending';
  if ((task.execution_kind || 'commit') === 'verification') {
    return status === 'ready' || status === 'verifying';
  }
  return status === 'prepared' || status === 'recorded';
}

/**
 * 충돌 판정용 경로 집합. scope.paths가 있으면 lease 개정 뒤의 실제 범위를
 * 쓰고, 없으면 bootstrap 스냅샷 affected_paths를 쓴다. 둘 다 없으면 legacy —
 * 옛 원장이 경로 없이 열려 병렬로 겹치는 쓰기를 막기 위해 모든 task와 충돌한다.
 *
 * @param {Task} task - 원장 task
 * @returns {string[] | null} 경로 목록, legacy면 null
 */
function pathSetOf(task: Task): string[] | null {
  if (task.scope && Array.isArray(task.scope.paths)) return task.scope.paths;
  if (Array.isArray(task.affected_paths)) return task.affected_paths;
  return null;
}

/**
 * pathsOverlap에 넘기기 전에 경로 표기만 맞춘다. 비교 알고리즘은 바꾸지 않는다.
 * 문서·Checklist는 `src/`·`./src/a.ts`처럼 trailing slash·`./`를 쓰는데,
 * pathsOverlap은 그 형태를 조상으로 보지 못하므로 호출 전에 벗겨야 Goal이 성립한다.
 *
 * @param {string} raw - affected_paths/scope.paths 항목
 * @returns {string} `./`·trailing `/`(단독 `/` 제외)를 제거한 경로
 */
function normalizeOverlapPath(raw: string): string {
  let p = raw;
  // 1. 문서·lease가 상대경로를 `./foo`로 적는 경우 — 동일 경로를 놓치지 않게 접두만 제거
  while (p.startsWith('./')) p = p.slice(2);
  // 2. 디렉터리 표기 `src/` → `src`. bare `/`는 루트 의미가 있어 유지한다.
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/**
 * 두 task가 같은 시점에 in-flight이면 안 되는지 판정한다. 경로 조상·동일
 * 비교는 validate-sections.pathsOverlap 하나만 쓴다 — 새 규칙을 두면 G12와
 * scheduler가 갈라진다. 입력만 normalizeOverlapPath로 맞춘다.
 *
 * @param {Task} left - 한쪽 task
 * @param {Task} right - 다른 쪽 task
 * @returns {boolean} 충돌이면 true
 */
function tasksConflict(left: Task, right: Task): boolean {
  const leftPaths = pathSetOf(left);
  const rightPaths = pathSetOf(right);
  if (leftPaths === null || rightPaths === null) return true;
  for (const a of leftPaths) {
    for (const b of rightPaths) {
      if (pathsOverlap(normalizeOverlapPath(a), normalizeOverlapPath(b))) return true;
    }
  }
  const leftResources = new Set(
    Array.isArray(left.exclusive_resources) ? left.exclusive_resources : [],
  );
  for (const resource of Array.isArray(right.exclusive_resources) ? right.exclusive_resources : []) {
    if (leftResources.has(resource)) return true;
  }
  return false;
}

/**
 * 설정 한도와 경로·exclusive_resources 충돌 안에서 다음에 열 수 있는 task id를
 * 고른다. in-flight에 순차 task가 있거나 후보에 순차 task가 있으면 병렬 wave를
 * 열지 않는다 — parallel_safe는 명시 true만 허용하는 기존 계약을 유지한다.
 *
 * @param {Task[]} tasks - 원장 task 목록
 * @param {{ maxParallel?: number }} [options] - 동시 실행 상한. 부재 시 기본 2
 * @returns {string[]} ID순으로 고른 ready task id
 */
function readyWave(tasks: Task[], options?: { maxParallel?: number }): string[] {
  const maxParallel = options && typeof options.maxParallel === 'number'
    ? options.maxParallel
    : DEFAULT_MAX_PARALLEL;
  const inFlight = tasks.filter(isInFlight);
  // 순차 task가 이미 돌고 있으면 자리를 더 열지 않는다. prepared 옆의 parallel
  // 후보를 예전처럼 바로 열면 한도·충돌 정책과 어긋난다.
  if (inFlight.some((task) => task.parallel_safe !== true)) return [];

  const candidates = tasks.filter((task) => (task.status || 'pending') === 'pending'
    && (task.depends_on || []).every((id) => {
      const predecessor = tasks.find((other) => other.id === id);
      // successor가 요구한 gate를 predecessor status와 그대로 비교한다. gate는
      // integrated 하나뿐이므로 종단에 닿지 않은 predecessor는 successor를 열지 않는다.
      return predecessor?.status === (task.dependency_gate || 'integrated');
    })).sort((a, b) => a.id.localeCompare(b.id));

  const sequential = candidates.find((task) => task.parallel_safe !== true);
  if (sequential) {
    // in-flight가 비었을 때만 순차 하나를 연다. 이미 자리가 있으면 [] —
    // 순차와 parallel을 같은 순간에 섞지 않는다.
    return inFlight.length === 0 ? [sequential.id] : [];
  }

  const slots = maxParallel - inFlight.length;
  if (slots <= 0) return [];
  const selected: Task[] = [];
  for (const candidate of candidates) {
    if (selected.length >= slots) break;
    const blocked = inFlight.some((task) => tasksConflict(candidate, task))
      || selected.some((task) => tasksConflict(candidate, task));
    if (blocked) continue;
    selected.push(candidate);
  }
  return selected.map((task) => task.id);
}

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
 * 실행 종류별 coordinator 상태 전이를 검증한다. verification은 worker·SHA를
 * 만들지 않으므로 commit 전이와 교차할 수 없다.
 *
 * @param {string} from - 현재 ledger 상태
 * @param {string} to - 요청한 다음 상태
 * @param {'commit' | 'verification'} [executionKind] - 부재면 기존 commit 전이
 * @returns {string} 허용된 다음 상태
 */
function transition(from: string, to: string, executionKind: 'commit' | 'verification' = 'commit'): string {
  const allowed: Record<string, string[]> = executionKind === 'verification'
    ? { pending: ['ready'], ready: ['verifying'], verifying: ['integrated'] }
    : { pending: ['ready'], ready: ['prepared'], prepared: ['recorded'], recorded: ['integrated'] };
  if (!(allowed[from] || []).includes(to)) throw new Error(`illegal state transition: ${from} -> ${to}`);
  return to;
}

function atomicWrite(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

/**
 * 원장 파일 bytes와 파싱 결과를 한 번에 읽는다. fence hash는 이 bytes에만 묶여야
 * load 직후 재read로 다른 내용이 검증되는 TOCTOU가 생기지 않는다.
 *
 * @param {string} file - 원장 절대 경로
 * @returns {{ ledger: Ledger, bytes: Buffer } | null} 없거나 파싱 실패 전 부재면 null
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

/**
 * 이미 읽은 원장 bytes의 SHA-256. trim·재직렬화 없이 status token과 mutation fence가
 * 같은 메모리 bytes를 쓰게 한다 — 디스크를 다시 읽으면 load와 fence 사이에 내용이
 * 바뀌어도 통과할 수 있다.
 *
 * @param {Buffer} bytes - load 시점에 고정한 원장 bytes
 * @returns {string} 64자리 소문자 hex
 */
function ledgerBytesHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * mutation이 들고 온 ledger path/hash 쌍을 쓰기 전에 검사한다. 절대·escaping·
 * 잘못된 상대경로·비 64-hex는 invalid, 이미 로드한 bytes hash 불일치는 stale로 구분한다.
 * hash는 `ledgerBytes`에만 묶는다 — 호출자가 load한 내용과 다른 디스크 snapshot을
 * 다시 읽어 fencing하면 토큰이 곧 변조될 bytes와 어긋난다.
 *
 * @param {{ ledgerPath?: string, ledgerHash?: string, ledgerBytes: Buffer }} opts
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function assertLedgerFence(opts: {
  ledgerPath?: string; ledgerHash?: string; ledgerBytes: Buffer;
}): { ok: true } | { ok: false; reason: string } {
  const { ledgerPath, ledgerHash, ledgerBytes } = opts;
  if (typeof ledgerPath !== 'string' || ledgerPath === ''
    || typeof ledgerHash !== 'string' || ledgerHash === '') {
    return { ok: false, reason: 'ledger-checkpoint-invalid' };
  }
  // 절대 경로는 integration-relative 계약을 깨뜨려 다른 worktree 원장을 가리킬 수 있다.
  if (path.isAbsolute(ledgerPath)) {
    return { ok: false, reason: 'ledger-checkpoint-invalid' };
  }
  if (ledgerPath.includes('\\') || ledgerPath.split('/').includes('..')
    || ledgerPath.split('/').includes('')
    || ledgerPath !== LEDGER_REL) {
    return { ok: false, reason: 'ledger-checkpoint-invalid' };
  }
  if (!/^[a-f0-9]{64}$/.test(ledgerHash)) {
    return { ok: false, reason: 'ledger-checkpoint-invalid' };
  }
  if (!Buffer.isBuffer(ledgerBytes) || ledgerBytes.length === 0) {
    return { ok: false, reason: 'ledger-checkpoint-invalid' };
  }
  if (ledgerBytesHash(ledgerBytes) !== ledgerHash) {
    return { ok: false, reason: 'stale-ledger-checkpoint' };
  }
  return { ok: true };
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
    ready: readyWave(ledger.tasks, {
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
  };
}

/**
 * 성공 mutation 결과에 다음 fencing token이 될 checkpoint를 붙인다.
 *
 * @param {object} result - ok:true mutation 결과
 * @param {Ledger} ledger - 기록 직후 원장
 * @param {string} ledgerFile - 원장 절대 경로
 * @returns {object} checkpoint가 추가된 결과
 */
function withCheckpoint<T extends { ok: true }>(
  result: T, ledger: Ledger, ledgerFile: string,
): T & { checkpoint: CoordinatorCheckpoint } {
  return { ...result, checkpoint: projectCheckpoint(ledger, ledgerFile) };
}

function git(exec: Exec, cwd: string, args: string[]): string {
  return String(exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim();
}

/**
 * canonical tasks.md 전체 bytes의 SHA-256. trim·재직렬화 없이 읽어 dispatch·record가
 * 같은 정의를 쓰게 한다 — intent-bundle의 task_brief_hash와 바이트 계약을 맞춘다.
 *
 * @param {string} workerRoot - 할당된 worker worktree
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task id
 * @returns {string} 64자리 소문자 hex
 */
function taskBriefHashOf(workerRoot: string, blueprint: string, taskId: string): string {
  const bytes = fs.readFileSync(path.join(workerRoot, blueprint, 'tasks', taskId, 'tasks.md'));
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * dispatch 직전 working-tree 원문. trim하지 않는다 — clean은 빈 문자열, dirty는
 * porcelain=v1 stdout 그대로여야 재개 시 baseline과 바이트 비교가 가능하다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} cwd - worker worktree
 * @returns {string} `git status --porcelain=v1` stdout 원문
 */
function initialWorktreeState(exec: Exec, cwd: string): string {
  return String(exec('git', ['status', '--porcelain=v1'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
}

function sourceStatus(exec: Exec, cwd: string): string {
  // worktree 등록 대상은 source가 아니며, 프로젝트 .gitignore가 아직 없는
  // bootstrap fixture에서도 porcelain에 나타난다. 그 한 경로만 제외한다.
  return git(exec, cwd, ['status', '--porcelain']).split('\n')
    .filter((line) => !line.slice(3).startsWith('.worktrees/')).join('\n');
}

function workerOwnsSha(exec: Exec, workerPath: string, sha: string): boolean {
  try {
    // SHA 문자열만 ledger에 넣으면 다른 worktree commit도 fan-in될 수 있다. worker
    // HEAD의 조상인지 Git에 묻고, 얕은 clone/삭제된 object 같은 오류도 거절한다.
    git(exec, workerPath, ['merge-base', '--is-ancestor', sha, 'HEAD']);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * 교체 SHA가 integration HEAD의 단 하나짜리 직계 자식인지 판정한다.
 * merge commit은 부모가 둘이므로 거절하며, 조회할 수 없는 object도 provenance를
 * 추측하지 않고 null로 접어 rerecord 경계에서 거절한다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} cwd - 할당된 worker worktree
 * @param {string} sha - 검사할 worker HEAD
 * @returns {string | null} 유일한 부모 SHA 또는 null
 */
function directParent(exec: Exec, cwd: string, sha: string): string | null {
  try {
    const fields = git(exec, cwd, ['rev-list', '--parents', '-n', '1', sha]).split(/\s+/);
    return fields.length === 2 ? fields[1] : null;
  } catch (_error) {
    // 존재하지 않는 object와 Git 조회 실패만 흡수한다. 둘 다 안전한 답은 거절이다.
    return null;
  }
}

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
 * repair task 문서와 terminal edge를 한 revision으로 쓴다. 두 rename 중 하나가
 * 실패하면 원래 terminal 문서를 복구하고 새 task를 지워, ledger만 다음 graph를
 * 가리키는 반쪽 상태가 생기지 않게 한다.
 *
 * @param {object} opts - integration 경로, blueprint, 두 task와 scope
 * @returns {void}
 */
function writeRepairDocuments({ integrationPath, blueprint, repair, terminal }: {
  integrationPath: string; blueprint: string; repair: Task; terminal: Task;
}): () => void {
  const terminalFile = path.join(integrationPath, blueprint, 'tasks', terminal.id, 'tasks.md');
  const terminalBefore = fs.readFileSync(terminalFile, 'utf8');
  const terminalDoc = readDoc(terminalFile);
  const terminalData = terminalDoc.data as Record<string, unknown>;
  const terminalBouncer = terminalData.bouncer as Record<string, unknown>;
  terminalBouncer.depends_on = (terminal.depends_on || []).map((id) => `TASKS-${id}`);
  terminalBouncer.status = 'ready';
  const repairFile = path.join(integrationPath, blueprint, 'tasks', repair.id, 'tasks.md');
  const idMatch = /(?:^|\/)epics\/(\d{3})[^/]*\/blueprints\/(\d{3})[^/]*$/.exec(blueprint.replaceAll('\\', '/'));
  const epicId = idMatch ? idMatch[1] : '';
  const bpId = idMatch ? idMatch[2] : '';
  const repairData = {
    type: 'bouncer.tasks', title: `CI repair wave ${repair.id}`, description: 'Repairs terminal CI failure.',
    resource: path.relative(integrationPath, repairFile).replaceAll('\\', '/'), tags: ['bouncer', 'repair-wave'],
    timestamp: new Date().toISOString(), bouncer: {
      id: `TASKS-${repair.id}`, epic_id: epicId, blueprint_id: bpId,
      status: 'ready', depends_on: (repair.depends_on || []).map((id) => `TASKS-${id}`),
      parallel_safe: false, dependency_gate: 'integrated', affected_paths: repair.scope?.paths || [],
      scope_revision: repair.scope?.revision,
    },
  };
  const timestamp = (repairData as { timestamp: string }).timestamp;
  const verificationFile = path.join(path.dirname(repairFile), 'verification.md');
  const reviewFile = path.join(path.dirname(repairFile), 'review.md');
  const repairRel = path.relative(integrationPath, path.dirname(repairFile)).replaceAll('\\', '/');
  const verificationData = {
    type: 'bouncer.verification', title: `TASKS-${repair.id} verification`,
    description: `Verification for TASKS-${repair.id}`, resource: `${repairRel}/verification.md`,
    tags: ['bouncer', 'verification'], timestamp,
    bouncer: { id: `VERIFY-${repair.id}`, epic_id: epicId, blueprint_id: bpId, status: 'pending' },
  };
  const reviewData = {
    type: 'bouncer.review', title: `TASKS-${repair.id} review`, description: `Review for TASKS-${repair.id}`,
    resource: `${repairRel}/review.md`, tags: ['bouncer', 'review'], timestamp,
    bouncer: {
      id: `REVIEW-${repair.id}`, epic_id: epicId, blueprint_id: bpId, status: 'pending',
      review: { required: true },
    },
  };
  const touch = (repair.scope?.paths || []).map((entry) => `- Modify \`${entry}\` — 기록된 CI 실패를 복구한다.`).join('\n');
  const repairBody = `# Tasks

## Goal & intent

기록된 terminal CI 실패를 복구한다.

## Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

## Touch

${touch}

## Do not touch

- \`.git/\`과 \`.bouncer/\` governance tree

## Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

## Checklist

- [ ] 실패를 재현하고 관련 source와 regression test를 수정한다.
- [ ] 기록된 terminal CI command를 통과시킨다.
`;
  try {
    fs.mkdirSync(path.dirname(repairFile), { recursive: true });
    fs.writeFileSync(repairFile, renderDoc(repairData, repairBody));
    const verificationBody = '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n';
    fs.writeFileSync(verificationFile, renderDoc(verificationData, verificationBody));
    fs.writeFileSync(reviewFile, renderDoc(reviewData, '# Review\n\n## Findings\n- <finding>\n'));
    fs.writeFileSync(terminalFile, renderDoc(terminalData, terminalDoc.body));
  } catch (error) {
    fs.writeFileSync(terminalFile, terminalBefore);
    fs.rmSync(path.dirname(repairFile), { recursive: true, force: true });
    throw error;
  }
  return () => {
    fs.writeFileSync(terminalFile, terminalBefore);
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

function taskList(repoRoot: string, blueprint: string): Task[] {
  const listing = listTasksDocs({ repoRoot, blueprintDir: blueprint });
  return listing.entries.map((entry) => {
    const id = String(entry.number).padStart(3, '0');
    const file = path.join(repoRoot, entry.tasks.rel);
    const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const data = parseFrontmatter(source).data as {
      bouncer?: {
        depends_on?: unknown;
        dependency_gate?: unknown;
        parallel_safe?: unknown;
        affected_paths?: unknown;
        exclusive_resources?: unknown;
      };
    };
    const bouncer = data && typeof data.bouncer === 'object' && data.bouncer ? data.bouncer : {};
    const rawDependencies = Array.isArray(bouncer.depends_on) ? bouncer.depends_on : [];
    const depends_on = rawDependencies.map((value) => String(value).replace(/^TASKS-/, '')).filter((value) => /^\d{3}$/.test(value));
    // task metadata의 정본은 bouncer 아래다. absence를 병렬 허용으로 바꾸면
    // 오래된 문서가 의도치 않게 같은 wave로 열리므로 명시 true만 허용한다.
    const execution_kind = entry.executionKind || executionKindOf(bouncer) || 'commit';
    // 문서에 키가 없어도 []를 심는다. 필드를 빼 두면 readyWave가 legacy 충돌로
    // 단독 실행만 허용해, 경로 없는 신규 bootstrap이 전부 직렬화된다.
    const affected_paths = Array.isArray(bouncer.affected_paths)
      ? bouncer.affected_paths.filter((value): value is string => typeof value === 'string')
      : [];
    const exclusive_resources = Array.isArray(bouncer.exclusive_resources)
      ? bouncer.exclusive_resources.filter((value): value is string => typeof value === 'string')
      : [];
    return { id, depends_on, execution_kind,
      dependency_gate: typeof bouncer.dependency_gate === 'string' ? bouncer.dependency_gate : 'integrated',
      parallel_safe: bouncer.parallel_safe === true,
      affected_paths, exclusive_resources, status: 'pending' };
  });
}

/**
 * terminal node를 실행할 bundle이 integration checkout에 있는지 확인한다.
 * 계획 문서와 config는 bootstrap이 이미 integration에 seed했고, 그 뒤로는
 * integration 사본이 정본이다. 여기서 main을 다시 복사하면 `coordinate repair`가
 * integration에서 바꾼 terminal `tasks.md`(depends_on)가 main 바이트로 되돌아간다.
 *
 * @param {string} integrationPath - 검증을 실행할 integration checkout
 * @param {string} blueprint - blueprint 저장소 상대 경로
 * @param {string} taskId - 세 자리 terminal task 번호
 * @returns {{ ok: true } | { ok: false; reason: string }} 확인 결과
 */
function checkVerificationNode(
  integrationPath: string,
  blueprint: string,
  taskId: string,
): { ok: true } | { ok: false; reason: string } {
  if (!fs.existsSync(path.join(integrationPath, blueprint, 'tasks', taskId))) {
    return { ok: false, reason: 'missing-verification-bundle' };
  }
  return { ok: true };
}

/**
 * verification task 문서 상태를 runner 증적과 같은 checkout에 기록한다.
 * 실패 실행은 verifying을 유지하고 성공만 integrated로 올린다.
 *
 * @param {string} integrationPath - integration checkout 절대 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @param {'verifying' | 'integrated'} status - 기록할 lifecycle 상태
 * @returns {void}
 */
function writeVerificationTaskStatus(
  integrationPath: string,
  blueprint: string,
  taskId: string,
  status: 'verifying' | 'integrated',
): void {
  const file = path.join(integrationPath, blueprint, 'tasks', taskId, 'tasks.md');
  const doc = readDoc(file);
  const data = doc.data as Record<string, unknown>;
  const bouncer = data.bouncer as Record<string, unknown>;
  bouncer.status = status;
  fs.writeFileSync(file, renderDoc(data, doc.body));
}

// commit task가 fan-in될 수 있는 worker 증적. 문서마다 execute gate와 review가
// 남기는 terminal 상태 하나만 받는다.
const EVIDENCE_FILES: ReadonlyArray<readonly [string, string]> = [
  ['tasks.md', 'verified'], ['verification.md', 'passed'], ['review.md', 'accepted'],
];

// frontmatter.ts의 FRONTMATTER_RE에서 뒤쪽 `\n?([\s\S]*)$`(항상 맞는 부분)를 뺀
// 앞부분과 같다. 이 검사를 통과한 문서는 parseFrontmatter가 블록 부재로 throw할 수
// 없으므로, 블록 부재를 오류 문구 비교 없이 구조로 판정한다.
const FRONTMATTER_FENCE_RE = /^---\n[\s\S]*?\n---/;

/**
 * 문서의 bouncer 블록을 읽는다. 문서가 없거나 frontmatter 블록이 없거나 YAML이
 * 깨졌으면 null — 호출자는 셋 다 "상태를 읽을 수 없다"로 판정한다. integrate의
 * worker 증적 판정과 finalize의 원장·문서 대조가 이 한 구현을 같이 쓴다.
 *
 * @param {string} file - 문서 절대 경로
 * @returns {Record<string, unknown> | null} bouncer 블록 또는 null
 * @example
 * readBouncerBlock('/wt/.bouncer/.../tasks/001/tasks.md'); // { id: 'TASKS-001', status: 'verified', ... }
 * readBouncerBlock('/wt/.bouncer/.../tasks/001/missing.md'); // null
 */
function readBouncerBlock(file: string): Record<string, unknown> | null {
  let source: string;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    // 파일 부재(ENOENT)만 흡수한다. 아직 쓰이지 않은 문서는 상태를 읽을 수 없는 것으로
    // 판정하면 되지만, 권한 오류 같은 다른 실패를 "문서 없음"으로 접으면 원인이 가려진다.
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
  if (!FRONTMATTER_FENCE_RE.test(source)) return null;
  let data: unknown;
  try {
    data = parseFrontmatter(source).data;
  } catch (error) {
    // YAML 파싱 오류만 흡수한다. 블록 부재는 위 구조 검사가 이미 걸렀으므로 여기 오는
    // 것은 깨진 YAML뿐이고, 상태를 읽을 수 없는 문서라 null로 접어도 판정이 안전하다.
    if ((error as Error).name === 'YAMLException') return null;
    throw error;
  }
  const bouncer = data && typeof data === 'object' ? (data as Record<string, unknown>).bouncer : null;
  return bouncer && typeof bouncer === 'object' ? bouncer as Record<string, unknown> : null;
}

/**
 * commit task의 worker bundle이 fan-in할 terminal 증적인지 판정한다. 읽기만 한다.
 * 상태가 모자라면 그 문서들을, 상태는 맞는데 `commit_sha`가 기록된 SHA의 앞
 * 8자리(`bouncer commit`이 찍는 길이)와 다르면 tasks.md를 `files`로 돌려준다.
 *
 * @param {string} workerPath - 배정된 worker worktree
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @param {string} sha - 원장에 기록된 worker SHA
 * @returns {{ ok: true } | { ok: false; reason: string; files: string[] }} 판정
 */
function checkWorkerEvidence(workerPath: string, blueprint: string, taskId: string, sha: string):
  { ok: true } | { ok: false; reason: string; files: string[] } {
  const relOf = (name: string) => `${blueprint.replaceAll('\\', '/')}/tasks/${taskId}/${name}`;
  const open: string[] = [];
  let stamped: unknown;
  for (const [name, terminal] of EVIDENCE_FILES) {
    const bouncer = readBouncerBlock(path.join(workerPath, blueprint, 'tasks', taskId, name));
    if (!bouncer || bouncer.status !== terminal) open.push(relOf(name));
    if (name === 'tasks.md' && bouncer) stamped = bouncer.commit_sha;
  }
  if (open.length > 0) return { ok: false, reason: 'worker-evidence-not-terminal', files: open };
  // normalizeCommitSha는 YAML이 숫자로 읽은 SHA도 문자열로 되돌리고 소문자로 맞춘다.
  if (normalizeCommitSha(stamped) !== sha.slice(0, 8).toLowerCase()) {
    return { ok: false, reason: 'worker-evidence-sha-mismatch', files: [relOf('tasks.md')] };
  }
  return { ok: true };
}

/**
 * worker의 task bundle 세 문서를 integration의 같은 경로로 복사한다. 다른 task
 * bundle·blueprint index·source는 건드리지 않는다. 돌려주는 함수는 복사 전 바이트로
 * 되돌리며, 복사 전에 없던 파일은 지우고 복사가 새로 만든 `tasks/<NNN>/`도 지운다.
 *
 * @param {string} workerPath - 배정된 worker worktree
 * @param {string} integrationPath - integration checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @returns {() => void} 복사 되돌림
 */
function copyEvidenceBundle(
  workerPath: string, integrationPath: string, blueprint: string, taskId: string,
): () => void {
  const targetDir = path.join(integrationPath, blueprint, 'tasks', taskId);
  // 복사 전에 bundle 디렉터리가 없었다면 그 안의 파일은 모두 이 복사가 만든 것이다.
  // 파일만 지우면 빈 `tasks/<NNN>/`이 남아 integration 사본이 복사 전과 달라진다.
  const dirExisted = fs.existsSync(targetDir);
  const entries = EVIDENCE_FILES.map(([name]) => {
    const target = path.join(targetDir, name);
    return {
      source: path.join(workerPath, blueprint, 'tasks', taskId, name), target,
      before: fs.existsSync(target) ? fs.readFileSync(target) as Buffer : null,
    };
  });
  const restore = () => {
    if (!dirExisted) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return;
    }
    for (const entry of entries) {
      if (entry.before === null) fs.rmSync(entry.target, { force: true });
      else fs.writeFileSync(entry.target, entry.before);
    }
  };
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const entry of entries) fs.copyFileSync(entry.source, entry.target);
  } catch (error) {
    // 흡수하지 않는다. 일부만 복사된 bundle을 되돌린 뒤 같은 예외를 올린다.
    restore();
    throw error;
  }
  return restore;
}

function registeredWorker(exec: Exec, integrationPath: string, workerPath: string): boolean {
  try {
    const canonicalWorker = fs.realpathSync(workerPath);
    // direct symlink worktree paths are not stable assignment boundaries even
    // when their eventual target happens to be a registered checkout.
    if (canonicalWorker !== path.resolve(workerPath)) return false;
    const workerRoot = fs.realpathSync(path.dirname(workerPath));
    const relative = path.relative(workerRoot, canonicalWorker);
    if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
    const registered = git(exec, integrationPath, ['worktree', 'list', '--porcelain'])
      .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
    return registered.some((entry) => fs.realpathSync(entry) === canonicalWorker);
  } catch (_error) { return false; }
}

function registeredIntegration(exec: Exec, repoRoot: string, integrationPath: string): boolean {
  try {
    const canonicalIntegration = fs.realpathSync(integrationPath);
    // integration은 ledger와 fan-in Git 명령의 기준 경계다. 경로 자체나 상위
    // 할당 경로가 symlink면 realpath 비교만으로 외부 checkout을 허용하게 된다.
    if (canonicalIntegration !== path.resolve(integrationPath)) return false;
    const integrationRoot = fs.realpathSync(path.dirname(integrationPath));
    const relative = path.relative(integrationRoot, canonicalIntegration);
    if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
    const registered = git(exec, repoRoot, ['worktree', 'list', '--porcelain'])
      .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
    return registered.some((entry) => fs.realpathSync(entry) === canonicalIntegration);
  } catch (_error) { return false; }
}


/**
 * 원장 lease 필드만 검사한다. 전체 validateCoordinatorLedger는 partial-close
 * 불변조건까지 보므로, 일반 mutation에서는 lease-invalid만 분리해 거절한다.
 *
 * @param {Ledger} ledger - 로드한 원장
 * @returns {{ok: true} | {ok: false, reason: 'lease-invalid'}}
 */
function assertLeaseShape(ledger: Ledger): { ok: true } | { ok: false; reason: 'lease-invalid' } {
  const { isValidLease, isValidLeaseSeq } = require('./lease') as typeof import('./lease');
  if (!isValidLeaseSeq(ledger.leaseSeq)) return { ok: false, reason: 'lease-invalid' };
  for (const task of ledger.tasks) {
    if (task.lease !== undefined && !isValidLease(task.lease)) {
      return { ok: false, reason: 'lease-invalid' };
    }
  }
  return { ok: true };
}

/**
 * lease 검사 실패를 decision으로만 남긴다. status·dispatch·sha는 바꾸지 않는다.
 *
 * @param {Ledger} ledger - 원장
 * @param {Task} item - 대상 task
 * @param {string} taskId - task id
 * @param {ReturnType<typeof checkLease> & {ok: false}} checked - 거절 결과
 * @returns {{ok: false, reason: string, expected: unknown, received: unknown}}
 */
function rejectLeaseMismatch(
  ledger: Ledger,
  item: Task,
  taskId: string,
  checked: { ok: false; reason: 'lease-required' | 'stale-lease'; expected: StaleLeaseDecision['expected']; received: StaleLeaseDecision['received'] },
) {
  if (checked.reason === 'stale-lease') {
    const stale: StaleLeaseDecision = {
      task: taskId, kind: 'stale-lease',
      expected: checked.expected, received: checked.received,
    };
    item.decisions = [...(item.decisions || []), stale];
    ledger.decisions.push(stale);
  }
  return {
    ok: false as const,
    reason: checked.reason,
    expected: checked.expected,
    received: checked.received,
  };
}

/**
 * revoke된 배정의 worker worktree·branch를 지운다. 다음 prepare가 integration
 * HEAD에서 새로 만들 수 있게 등록을 비운다.
 *
 * @param {Exec} exec - git 실행기
 * @param {string} integrationPath - integration checkout
 * @param {Task} item - revoke 후 재준비 대상
 */
function removeRevokedWorker(exec: Exec, integrationPath: string, item: Task): void {
  if (item.workerPath && registeredWorker(exec, integrationPath, item.workerPath)) {
    try {
      git(exec, integrationPath, ['worktree', 'remove', '--force', item.workerPath]);
    } catch (_error) {
      // worktree가 이미 없으면 아래 branch 삭제만으로 재준비가 가능하다.
    }
  }
  if (typeof item.branch === 'string' && item.branch !== '') {
    try {
      git(exec, integrationPath, ['branch', '-D', item.branch]);
    } catch (_error) {
      // branch가 없으면 새 -b 생성이 이어지면 된다.
    }
  }
  delete item.workerPath;
  delete item.branch;
}

/**
 * prepare 재배정 전에 이전 worker를 지울지 본다.
 * lease.status === 'revoked'인 경우뿐 아니라, lease 없이 prepared/recorded에서
 * revoke된 legacy 배정도 workerPath를 남기므로 같은 재작성 규칙에 넣는다.
 *
 * @param {Task} item - ready wave의 commit task
 * @returns {boolean} removeRevokedWorker를 호출해야 하면 true
 */
function shouldRemoveRevokedWorker(item: Task): boolean {
  if (item.lease?.status === 'revoked') return true;
  // legacy: lease 필드가 없으면 status만 pending으로 돌아가므로, 마지막 revoke
  // decision의 previous_status로 prepared/recorded 배정 잔재를 판별한다.
  if (!item.workerPath && !(typeof item.branch === 'string' && item.branch !== '')) {
    return false;
  }
  if (item.lease) return false;
  const decisions = Array.isArray(item.decisions) ? item.decisions : [];
  for (let i = decisions.length - 1; i >= 0; i -= 1) {
    const entry = decisions[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const decision = entry as { kind?: string; previous_status?: string };
    if (decision.kind !== 'revoke') continue;
    return decision.previous_status === 'prepared' || decision.previous_status === 'recorded';
  }
  return false;
}

/**
 * 잠금 소유를 확인한 뒤 원장을 쓴다. owns가 거짓이면 쓰지 않고 ledger-lock-lost.
 *
 * @param {() => boolean} owns - withLedgerLock이 넘긴 소유 확인
 * @param {(file: string, data: unknown) => void} writeLedger - 원자적 쓰기
 * @param {string} file - 원장 경로
 * @param {Ledger} ledger - 기록할 원장
 * @returns {{ok: false, reason: 'ledger-lock-lost'} | null} 실패 시 거절, 성공 시 null
 */
function writeOwnedLedger(
  owns: () => boolean,
  writeLedger: (file: string, data: unknown) => void,
  file: string,
  ledger: Ledger,
): { ok: false; reason: 'ledger-lock-lost' } | null {
  if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
  writeLedger(file, ledger);
  return null;
}

function ensureIntegrationCwd(repoRoot: string, blueprint: string, cwd: string, task?: string) {
  const paths = coordinatorPathsFor({ repoRoot, blueprint, task });
  const actual = fs.realpathSync(cwd);
  const allowed = fs.realpathSync(task ? paths.workerPath as string : paths.integrationPath);
  if (actual !== allowed) throw new Error('coordinate command must run in its assigned worktree');
  return paths;
}


/**
 * integrate. verification node는 verifying 전이와 결과 기록을 잠금으로 나누고,
 * commit wave는 candidate worktree에서 cherry-pick·검증한 뒤 CAS ff만 canonical에
 * 반영한다. runVerification 동안 원장 잠금 파일이 없게 한다.
 */
function integrateTask({
  repoRoot, blueprint, cwd, task, sha, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
}: {
  repoRoot: string; blueprint: string; cwd: string; task?: string; sha?: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  deps: { runVerification?: VerificationRunner };
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  // wave 형태에 lease 플래그가 오면 어느 task의 lease인지 모호하므로 거절한다.
  if (!task && (leaseId !== undefined || generation !== undefined)) {
    return { ok: false, reason: 'lease-flags-require-task' };
  }
  if (task !== undefined && !/^\d{3}$/.test(task)) {
    return { ok: false, reason: 'task-required' };
  }
  ensureIntegrationCwd(repoRoot, blueprint, cwd);

  // verification --task는 기존 두 단계 경로. commit/wave는 candidate fan-in.
  if (task) {
    const peek = loadLedger(integration.ledgerFile);
    const peekItem = peek?.tasks.find((x) => x.id === task);
    if (peekItem?.execution_kind === 'verification') {
      return integrateVerificationTask({
        repoRoot, blueprint, task, leaseId, generation,
        ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
      });
    }
  }

  return integrateCommitWave({
    repoRoot, blueprint, task, leaseId, generation,
    ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
  });
}

/**
 * verification node integrate. terminal scope·repair 한도 2를 보존하고, 명시
 * taskId로 pointer 없이도 그 task의 verify를 고른다.
 */
function integrateVerificationTask({
  repoRoot, blueprint, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
}: {
  repoRoot: string; blueprint: string; task: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  deps: { runVerification?: VerificationRunner };
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  let phase1CheckpointHash: string | null = null;
  let verificationRetry = false;
  const phase1 = withLedgerLock(integration.ledgerFile, (owns) => {
    const loaded = loadLedgerBytes(integration.ledgerFile);
    if (!loaded) return { ok: false, reason: 'missing-ledger' };
    const { ledger, bytes: ledgerBytes } = loaded;
    const leaseShape = assertLeaseShape(ledger);
    if (!leaseShape.ok) return leaseShape;
    const fenced = assertLedgerFence({ ledgerPath, ledgerHash, ledgerBytes });
    if (!fenced.ok) return fenced;
    const item = ledger.tasks.find((x) => x.id === task);
    if (!item) return { ok: false, reason: 'task-outside-blueprint' };

    const status = item.status || 'pending';
    // terminalFailure가 있는 verifying는 repair만 받는다.
    if (status === 'verifying' && ledger.terminalFailure
      && ledger.terminalFailure.task === task) {
      return { ok: false, reason: 'not-ready' };
    }
    if (status === 'verifying' && !(ledger.terminalFailure && ledger.terminalFailure.task === task)) {
      // 전이 없이 검증만 재실행 — repair wave를 소모하지 않는다.
      verificationRetry = true;
      phase1CheckpointHash = ledgerBytesHash(fs.readFileSync(integration.ledgerFile));
      return { ok: true as const, mode: 'verification' as const, ledger };
    }
    if (status !== 'ready') return { ok: false, reason: 'not-ready' };
    item.status = transition('ready', 'verifying', 'verification');
    writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'verifying');
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    phase1CheckpointHash = ledgerBytesHash(fs.readFileSync(integration.ledgerFile));
    return { ok: true as const, mode: 'verification' as const, ledger };
  });

  if (!phase1 || typeof phase1 !== 'object') return phase1;
  if ((phase1 as { ok?: boolean }).ok === false) return phase1;

  // --- 잠금 밖에서 검증 실행 ---
  const runner = deps.runVerification
    || (require('./verification').runVerification as VerificationRunner);
  const { epicId, blueprintId } = parsePathIds(blueprint);
  const headForKey = (() => {
    const live = loadLedger(integration.ledgerFile);
    if (live && typeof live.integrationHead === 'string') return live.integrationHead;
    return git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
  })();
  const result = runner({
    repoRoot: integration.integrationPath,
    blueprintDir: blueprint,
    // pointer를 옮기지 않으므로 자기 task id로 verify·문서를 고른다.
    taskId: task,
    scope: {
      kind: 'terminal',
      key: `EPIC-${epicId}/BP-${blueprintId}:${headForKey}`,
    },
  });

  return withLedgerLock(integration.ledgerFile, (owns) => {
    const loaded = loadLedgerBytes(integration.ledgerFile);
    if (!loaded) return { ok: false, reason: 'missing-ledger' };
    const { ledger, bytes: ledgerBytes } = loaded;
    const currentHash = ledgerBytesHash(ledgerBytes);
    if (phase1CheckpointHash !== currentHash) {
      return { ok: false, reason: 'stale-ledger-checkpoint' };
    }
    const item = ledger.tasks.find((x) => x.id === task);
    if (!item) return { ok: false, reason: 'task-outside-blueprint' };
    if (!result.ok) {
      const lastRepair = (ledger.repairWaves || []).at(-1);
      const evidence: FailureEvidence = {
        task, command: result.command, summary: `exit code ${result.exitCode}`,
        paths: lastRepair ? [...lastRepair.nextScope] : [...(ledger.terminalFailure?.paths || [])],
        exitCode: result.exitCode, repairWave: (ledger.repairWaves || []).length,
      };
      ledger.terminalFailure = evidence;
      const exhausted = (ledger.repairWaves || []).length >= 2;
      if (exhausted) {
        ledger.status = 'awaiting_confirmation';
        const nextPlan = path.join(integration.integrationPath, 'NEXT_PLAN.md');
        const remaining = evidence.paths.length > 0 ? evidence.paths.join(', ') : 'none recorded';
        const nextPlanBody = `# Next plan\n\n- Failed command: \`${result.command}\`\n`
          + `- Exit code: ${result.exitCode}\n- Remaining paths: ${remaining}\n`;
        fs.writeFileSync(nextPlan, nextPlanBody);
      }
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      return { ok: false, reason: 'verification-failed', task: item, verification: result,
        repairWaves: (ledger.repairWaves || []).length, stopped: exhausted };
    }
    item.status = transition('verifying', 'integrated', 'verification');
    if (typeof result.evidenceId === 'string' && result.evidenceId !== '') {
      item.verify_evidence_id = result.evidenceId;
    }
    writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'integrated');
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    void verificationRetry;
    void leaseId;
    void generation;
    void exec;
    return withCheckpoint({ ok: true as const, command: 'integrate', task: item, verification: result,
      ready: readyWave(ledger.tasks, {
        maxParallel: maxParallelForRead(integration.integrationPath),
      }), decisions: ledger.decisions },
    ledger, integration.ledgerFile);
  });
}

/**
 * recorded commit task를 depends_on 우선·ID순으로 정렬한다. wave 안 의존만
 * 본다 — 이미 integrated인 선행은 edge가 없어 병렬 순서가 ID로만 정해진다.
 *
 * @param {Task[]} tasks - 원장 전체
 * @param {string[]} ids - wave 대상 id
 * @returns {string[]} cherry-pick 순서
 */
function sortFaninTasks(tasks: Task[], ids: string[]): string[] {
  const idSet = new Set(ids);
  const byId = new Map(tasks.filter((entry) => idSet.has(entry.id)).map((entry) => [entry.id, entry]));
  const indegree = new Map(ids.map((id) => [id, 0]));
  const children = new Map(ids.map((id) => [id, [] as string[]]));
  for (const id of ids) {
    const deps = (byId.get(id)?.depends_on || []).filter((dep) => idSet.has(dep));
    indegree.set(id, deps.length);
    for (const dep of deps) {
      (children.get(dep) as string[]).push(id);
    }
  }
  const ready = ids.filter((id) => indegree.get(id) === 0).sort((a, b) => a.localeCompare(b));
  const ordered: string[] = [];
  while (ready.length > 0) {
    const next = ready.shift() as string;
    ordered.push(next);
    for (const child of ((children.get(next) || []) as string[]).slice().sort((a, b) => a.localeCompare(b))) {
      const nextDegree = (indegree.get(child) as number) - 1;
      indegree.set(child, nextDegree);
      if (nextDegree === 0) {
        ready.push(child);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }
  // 순환이 남으면 ID순으로 붙여 cherry-pick이 멈추지 않게 한다.
  if (ordered.length < ids.length) {
    for (const id of [...ids].sort((a, b) => a.localeCompare(b))) {
      if (!ordered.includes(id)) ordered.push(id);
    }
  }
  return ordered;
}

/**
 * recorded + (active lease | lease 부재) commit만 wave 후보다. revoked는 빼고,
 * `--task`면 그 하나만 검사한다.
 *
 * @param {Ledger} ledger - 원장
 * @param {string | undefined} task - 선택적 단일 task
 * @returns {string[]} 정렬 전 후보 id
 */
function selectRecordedCommitIds(ledger: Ledger, task?: string): string[] {
  const candidates = ledger.tasks.filter((entry) => {
    if ((entry.execution_kind || 'commit') === 'verification') return false;
    if (entry.status !== 'recorded' || !entry.sha) return false;
    // revoked lease는 플래그 없는 wave에서 제외. legacy(lease 없음)는 포함한다.
    if (entry.lease && entry.lease.status !== 'active') return false;
    if (task) return entry.id === task;
    return true;
  });
  return candidates.map((entry) => entry.id);
}

/**
 * fanin candidate worktree를 지운다. 등록이 없거나 경로만 남은 잔해도 제거한다.
 *
 * @param {Exec} exec - git 실행기
 * @param {string} repoRoot - 저장소 루트
 * @param {string} faninPath - candidate 경로
 */
function removeFaninWorktree(exec: Exec, repoRoot: string, faninPath: string): void {
  try {
    git(exec, repoRoot, ['worktree', 'remove', '--force', faninPath]);
  } catch (_error) {
    // 등록이 이미 없으면 디렉터리만 남아 있을 수 있다 — 강제 삭제로 재시드를 연다.
  }
  fs.rmSync(faninPath, { recursive: true, force: true });
}

/**
 * cherry-pick 예외·stderr에서 사람이 읽을 수 있는 진단 문자열을 모은다.
 * status/signal은 분류에 쓰지 않는다 — CONFLICT 없는 exit 1도 흔하다.
 *
 * @param {unknown} error - execFileSync 또는 주입 예외
 * @returns {string} stdout·stderr·message를 이어 붙인 원문
 */
function cherryPickErrorText(error: unknown): string {
  if (error == null || typeof error !== 'object') return String(error ?? '');
  const err = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [err.stdout, err.stderr, err.message]
    .filter((part) => part != null && part !== '')
    .map((part) => String(part))
    .join('\n');
}

/**
 * cherry-pick 실패가 내용 충돌인지 판별한다. fanin-conflict+revoke는 충돌만
 * 해당하므로, bad object·empty commit 같은 다른 실패와 섞이면 안 된다.
 *
 * @param {unknown} error - cherry-pick이 던진 예외
 * @param {Exec} exec - candidate에서 인덱스 조사용
 * @param {string} faninPath - abort 전 candidate cwd
 * @returns {boolean} unmerged 경로 또는 CONFLICT 표식이 있으면 true
 */
function isCherryPickConflict(error: unknown, exec: Exec, faninPath: string): boolean {
  // 1. abort 전에 unmerged index가 있으면 실제 merge conflict다.
  try {
    if (git(exec, faninPath, ['ls-files', '-u']).length > 0) return true;
  } catch (_probeError) {
    // candidate가 이미 깨졌거나 ls-files가 실패하면 메시지 휴리스틱으로 간다.
  }
  // 2. git은 충돌 시 stderr에 `CONFLICT`를 찍는다. 테스트 seam 주입도 같은 표식을 쓴다.
  const text = cherryPickErrorText(error);
  return /\bCONFLICT\b/.test(text) || /Merge conflict/i.test(text);
}

/**
 * commit wave fan-in: candidate에서 cherry-pick·검증 후 CAS ff만 canonical에 쓴다.
 */
function integrateCommitWave({
  repoRoot, blueprint, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
}: {
  repoRoot: string; blueprint: string; task?: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  deps: { runVerification?: VerificationRunner };
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  const faninPath = integration.faninPath;
  const runner = deps.runVerification
    || (require('./verification').runVerification as VerificationRunner);

  // --- 재시작 복구: 이전 fanin 상태가 있으면 먼저 처리 ---
  const recovery = withLedgerLock(integration.ledgerFile, (owns) => {
    const loaded = loadLedgerBytes(integration.ledgerFile);
    if (!loaded) return { ok: false as const, reason: 'missing-ledger' };
    const { ledger, bytes: ledgerBytes } = loaded;
    const leaseShape = assertLeaseShape(ledger);
    if (!leaseShape.ok) return leaseShape;
    const faninChecked = runtime.validateCoordinatorLedger(ledger);
    if (!faninChecked.ok) return { ok: false as const, reason: faninChecked.reason };
    const fenced = assertLedgerFence({ ledgerPath, ledgerHash, ledgerBytes });
    if (!fenced.ok) return fenced;
    if (!ledger.fanin) return { ok: true as const, resume: null as null };
    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    const fanin = ledger.fanin;
    // verified + HEAD가 candidate면 cherry-pick 없이 번들 복사부터 완결.
    if (fanin.status === 'verified' && fanin.candidate_head && head === fanin.candidate_head) {
      return {
        ok: true as const,
        resume: {
          mode: 'finish' as const,
          tasks: [...fanin.tasks],
          baseHead: fanin.base_head,
          candidateHead: fanin.candidate_head,
          evidenceId: null as string | null,
        },
      };
    }
    // HEAD가 base면 building이거나 ff 전 중단 — candidate만 지우고 원장은
    // phase 1이 덮어쓴다. 여기서 쓰면 fence hash가 깨져 같은 호출의 1단계가 거절된다.
    if (head === fanin.base_head) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      return { ok: true as const, resume: null as null };
    }
    // base도 candidate도 아니면 원장·Git이 갈라진 상태.
    removeFaninWorktree(exec, repoRoot, faninPath);
    ledger.fanin = null;
    if (!owns()) return { ok: false as const, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    return { ok: false as const, reason: 'stale-integration-head' };
  });
  if (!recovery || typeof recovery !== 'object') return recovery;
  if ((recovery as { ok?: boolean }).ok === false) return recovery;

  const resume = (recovery as { resume: null | {
    mode: 'finish'; tasks: string[]; baseHead: string; candidateHead: string; evidenceId: string | null;
  } }).resume;

  if (resume && resume.mode === 'finish') {
    return finishFaninAfterFf({
      repoRoot, blueprint, exec, writeLedger, integration,
      ledgerPath, ledgerHash,
      tasks: resume.tasks,
      baseHead: resume.baseHead,
      candidateHead: resume.candidateHead,
      evidenceId: resume.evidenceId,
      alreadyFastForwarded: true,
      phase1CheckpointHash: null,
    });
  }

  // --- phase 1: 잠금 안에서 대상 확정·fanin building 기록 ---
  let phase1CheckpointHash: string | null = null;
  let waveTasks: string[] = [];
  let baseHead = '';
  const phase1 = withLedgerLock(integration.ledgerFile, (owns) => {
    const loaded = loadLedgerBytes(integration.ledgerFile);
    if (!loaded) return { ok: false, reason: 'missing-ledger' };
    const { ledger, bytes: ledgerBytes } = loaded;
    const leaseShape = assertLeaseShape(ledger);
    if (!leaseShape.ok) return leaseShape;
    const faninChecked = runtime.validateCoordinatorLedger(ledger);
    if (!faninChecked.ok) return { ok: false, reason: faninChecked.reason };
    const fenced = assertLedgerFence({ ledgerPath, ledgerHash, ledgerBytes });
    if (!fenced.ok) return fenced;

    // --task + lease 플래그는 대상 확정 전에 checkLease.
    if (task) {
      const item = ledger.tasks.find((x) => x.id === task);
      if (!item) return { ok: false, reason: 'task-outside-blueprint' };
      if ((item.execution_kind || 'commit') === 'verification') {
        return { ok: false, reason: 'task-outside-blueprint' };
      }
      const leaseChecked = checkLease(item, {
        ...(leaseId !== undefined ? { lease_id: leaseId } : {}),
        ...(generation !== undefined ? { generation } : {}),
      });
      if (!leaseChecked.ok) {
        const rejected = rejectLeaseMismatch(ledger, item, task, leaseChecked);
        if (leaseChecked.reason === 'stale-lease') {
          if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
          writeLedger(integration.ledgerFile, ledger);
        }
        return rejected;
      }
    }

    const selected = selectRecordedCommitIds(ledger, task);
    if (selected.length === 0) return { ok: false, reason: 'nothing-to-integrate' };
    const ordered = sortFaninTasks(ledger.tasks, selected);

    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    if (ledger.integrationHead !== head) {
      return { ok: false, reason: 'stale-integration-head' };
    }

    for (const id of ordered) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
      if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)
        || !workerOwnsSha(exec, worker, item.sha as string)) {
        return { ok: false, reason: 'sha-not-owned-by-worker' };
      }
      const evidence = checkWorkerEvidence(worker, blueprint, id, item.sha as string);
      if (!evidence.ok) return evidence;
    }

    baseHead = head;
    waveTasks = ordered;
    ledger.fanin = {
      base_head: baseHead,
      candidate_head: null,
      tasks: ordered,
      status: 'building',
    };
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    phase1CheckpointHash = ledgerBytesHash(fs.readFileSync(integration.ledgerFile));
    return { ok: true as const, tasks: ordered, baseHead };
  });

  if (!phase1 || typeof phase1 !== 'object') return phase1;
  if ((phase1 as { ok?: boolean }).ok === false) return phase1;
  waveTasks = (phase1 as { tasks: string[] }).tasks;
  baseHead = (phase1 as { baseHead: string }).baseHead;

  // --- phase 2: 잠금 밖 — candidate 생성·cherry-pick·wave 검증 ---
  removeFaninWorktree(exec, repoRoot, faninPath);
  try {
    fs.mkdirSync(path.dirname(faninPath), { recursive: true });
    git(exec, repoRoot, ['worktree', 'add', '--detach', faninPath, baseHead]);
  } catch (error) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    throw error;
  }

  const seeded = seedCoordinatorWorker({
    repoRoot: integration.integrationPath, blueprintDir: blueprint, worktreePath: faninPath,
  });
  if (!seeded.ok) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      loaded.ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, loaded.ledger);
      return seeded;
    });
  }

  const liveForSha = loadLedger(integration.ledgerFile);
  for (const id of waveTasks) {
    const item = liveForSha?.tasks.find((x) => x.id === id);
    const pickSha = item?.sha;
    if (!pickSha) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      return { ok: false, reason: 'nothing-to-integrate' };
    }
    try {
      git(exec, faninPath, ['cherry-pick', pickSha]);
    } catch (error) {
      // abort 전에 충돌 여부를 본다 — abort가 unmerged를 지우면 분류가 무너진다.
      const conflict = isCherryPickConflict(error, exec, faninPath);
      try {
        git(exec, faninPath, ['cherry-pick', '--abort']);
      } catch (_abortError) {
        // abort 실패도 candidate 삭제로 충분하다 — 진행 중 상태가 fanin에만 있다.
      }
      removeFaninWorktree(exec, repoRoot, faninPath);
      return withLedgerLock(integration.ledgerFile, (owns) => {
        const loaded = loadLedgerBytes(integration.ledgerFile);
        if (!loaded) return { ok: false, reason: 'missing-ledger' };
        const { ledger } = loaded;
        if (conflict) {
          // Target behavior: 충돌 task만 revoke. 나머지는 recorded로 남긴다.
          const conflicted = ledger.tasks.find((x) => x.id === id);
          if (conflicted) {
            revokeLease(ledger, conflicted, {
              reason: 'fanin-conflict',
              previousHead: typeof conflicted.sha === 'string' ? conflicted.sha : null,
            });
          }
          ledger.fanin = null;
          if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
          writeLedger(integration.ledgerFile, ledger);
          return { ok: false, reason: 'fanin-conflict', task: id };
        }
        // CONFLICT가 아니면 revoke하지 않는다 — 잘못된 fanin-conflict는 requeue를 속인다.
        ledger.fanin = null;
        if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
        writeLedger(integration.ledgerFile, ledger);
        return { ok: false, reason: 'cherry-pick-failed', task: id };
      });
    }
  }

  const candidateHead = git(exec, faninPath, ['rev-parse', 'HEAD']);
  const { epicId, blueprintId } = parsePathIds(blueprint);
  const lastTask = waveTasks[waveTasks.length - 1];
  const verification = runner({
    repoRoot: faninPath,
    blueprintDir: blueprint,
    taskId: lastTask,
    scope: {
      kind: 'wave',
      key: `EPIC-${epicId}/BP-${blueprintId}:wave:${candidateHead}`,
    },
  });

  if (!verification.ok) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      const { ledger } = loaded;
      const failed: FaninVerificationFailedDecision = {
        kind: 'fanin-verification-failed',
        tasks: [...waveTasks],
        command: verification.command,
        exitCode: verification.exitCode,
        evidence_id: typeof verification.evidenceId === 'string' ? verification.evidenceId : null,
      };
      ledger.decisions.push(failed);
      ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      return {
        ok: false,
        reason: 'wave-verification-failed',
        tasks: [...waveTasks],
        verification,
      };
    });
  }

  // --- phase 3: 잠금 — checkpoint·CAS·verified 기록·ff·번들·integrated ---
  return finishFaninAfterFf({
    repoRoot, blueprint, exec, writeLedger, integration,
    ledgerPath, ledgerHash,
    tasks: waveTasks,
    baseHead,
    candidateHead,
    evidenceId: typeof verification.evidenceId === 'string' ? verification.evidenceId : null,
    alreadyFastForwarded: false,
    phase1CheckpointHash,
    verification,
  });
}

/**
 * CAS 확인 후 ff(또는 이미 ff된 복구)와 번들 복사·integrated 전이를 마친다.
 */
function finishFaninAfterFf({
  repoRoot, blueprint, exec, writeLedger, integration,
  ledgerPath, ledgerHash,
  tasks, baseHead, candidateHead, evidenceId,
  alreadyFastForwarded, phase1CheckpointHash, verification,
}: {
  repoRoot: string; blueprint: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  integration: ReturnType<typeof coordinatorPathsFor>;
  ledgerPath?: string; ledgerHash?: string;
  tasks: string[];
  baseHead: string;
  candidateHead: string;
  evidenceId: string | null;
  alreadyFastForwarded: boolean;
  phase1CheckpointHash: string | null;
  verification?: { ok: boolean; command: string; exitCode: number; evidenceId?: string };
}): unknown {
  const faninPath = integration.faninPath;
  return withLedgerLock(integration.ledgerFile, (owns) => {
    const loaded = loadLedgerBytes(integration.ledgerFile);
    if (!loaded) return { ok: false, reason: 'missing-ledger' };
    const { ledger, bytes: ledgerBytes } = loaded;
    // 정상 wave는 phase1CheckpointHash로만 끼어든 쓰기를 본다. 호출자 fence는
    // 1단계 쓰기 전 값이라 여기서 다시 검사하면 항상 stale가 된다.
    // 재시작 finish(이미 ff됨)만 호출자 fence를 다시 검사한다.
    if (phase1CheckpointHash === null) {
      const fenced = assertLedgerFence({ ledgerPath, ledgerHash, ledgerBytes });
      if (!fenced.ok) return fenced;
    } else {
      const currentHash = ledgerBytesHash(ledgerBytes);
      if (phase1CheckpointHash !== currentHash) {
        removeFaninWorktree(exec, repoRoot, faninPath);
        return { ok: false, reason: 'stale-ledger-checkpoint' };
      }
    }

    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    if (!alreadyFastForwarded) {
      // CAS: canonical이 여전히 base일 때만 ff.
      if (head !== baseHead) {
        removeFaninWorktree(exec, repoRoot, faninPath);
        ledger.fanin = null;
        if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
        writeLedger(integration.ledgerFile, ledger);
        return { ok: false, reason: 'stale-integration-head' };
      }
      // ff 전 첫 쓰기: verified + candidate_head. 중단 시 재실행이 finish로 복구.
      ledger.fanin = {
        base_head: baseHead,
        candidate_head: candidateHead,
        tasks: [...tasks],
        status: 'verified',
      };
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);

      try {
        git(exec, integration.integrationPath, ['merge', '--ff-only', candidateHead]);
      } catch (error) {
        // ff 실패는 CAS를 다시 깨뜨린 것과 같다 — candidate만 지우고 원장을 비운다.
        removeFaninWorktree(exec, repoRoot, faninPath);
        const again = loadLedger(integration.ledgerFile);
        if (again) {
          again.fanin = null;
          writeLedger(integration.ledgerFile, again);
        }
        throw error;
      }
    } else if (head !== candidateHead) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      return { ok: false, reason: 'stale-integration-head' };
    }

    for (const id of tasks) {
      const item = ledger.tasks.find((x) => x.id === id);
      if (!item) continue;
      const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
      copyEvidenceBundle(worker, integration.integrationPath, blueprint, id);
      item.status = transition('recorded', 'integrated');
    }
    ledger.integrationHead = candidateHead;
    const decision: FaninDecision = {
      kind: 'fanin',
      tasks: [...tasks],
      base_head: baseHead,
      candidate_head: candidateHead,
      evidence_id: evidenceId,
    };
    ledger.decisions.push(decision);
    ledger.fanin = null;
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withCheckpoint({
      ok: true as const,
      command: 'integrate',
      integrated: [...tasks],
      integrationHead: candidateHead,
      verification: verification || { ok: true, command: '', exitCode: 0 },
      ready: readyWave(ledger.tasks, {
        maxParallel: maxParallelForRead(integration.integrationPath),
      }),
    }, ledger, integration.ledgerFile);
  });
}

function coordinate({ command, repoRoot, blueprint, cwd = repoRoot, task, sha, decision,
  failureCommand, summary, paths: repairPaths, findings, outcome, reason, attempt, taskBriefHash,
  leaseId, generation,
  ledgerPath, ledgerHash,
  userConfirmed = false, deps = {} }: {
  command: string; repoRoot: string; blueprint: string; cwd?: string; task?: string; sha?: string; decision?: unknown;
  failureCommand?: string; summary?: string; paths?: string[]; userConfirmed?: boolean;
  findings?: string[]; outcome?: string; reason?: string;
  attempt?: number; taskBriefHash?: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  deps?: {
    execFileSync?: Exec; runVerification?: VerificationRunner; writeLedger?: typeof atomicWrite;
    makeLeaseId?: () => string;
  };
}) {
  const exec = deps.execFileSync || realExecFileSync as unknown as Exec;
  const writeLedger = deps.writeLedger || atomicWrite;
  const makeLeaseId = deps.makeLeaseId || randomUUID;
  const main = runtimePaths({ repoRoot, execFileSync: exec });
  if (main.unavailable) return { ok: false, reason: 'non-git-root' };
  const base = git(exec, repoRoot, ['rev-parse', 'HEAD']);
  const paths = coordinatorPathsFor({ repoRoot, blueprint, task });
  if (command === 'bootstrap') {
    if (path.resolve(repoRoot) !== path.resolve(main.projectRoot as string)) {
      return { ok: false, reason: 'bootstrap-requires-main-checkout' };
    }
    const before = sourceStatus(exec, repoRoot);
    if (fs.existsSync(paths.integrationPath) && !registeredIntegration(exec, repoRoot, paths.integrationPath)) {
      return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: paths.integrationPath };
    }
    let integrationBranch: string;
    try {
      const names = branchNamesFor({ repoRoot, blueprint });
      const resolved = resolveWorktreeBranch({
        repoRoot, worktreePath: paths.integrationPath, branch: names.integration, execFileSync: exec,
      });
      integrationBranch = resolved.branch;
      if (resolved.action === 'create') {
        fs.mkdirSync(path.dirname(paths.integrationPath), { recursive: true });
        // argv 호출만 사용해 branch 이름과 경로가 shell 해석으로 새지 않게 한다.
        git(exec, repoRoot, ['worktree', 'add', '-b', integrationBranch,
          paths.integrationPath, 'HEAD']);
      }
    } catch (error) {
      const reason = (error as { code?: string }).code;
      if (reason) return { ok: false, reason };
      throw error;
    }
    if (sourceStatus(exec, repoRoot) !== before) return { ok: false, reason: 'main-source-mutated' };
    if (!registeredIntegration(exec, repoRoot, paths.integrationPath)) {
      return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: paths.integrationPath };
    }
    let ledger = loadLedger(paths.ledgerFile);
    if (!ledger) {
      const seeded = seedIntegration({ repoRoot, blueprintDir: blueprint, integrationPath: paths.integrationPath });
      if (!seeded.ok) return seeded;
      ledger = {
        version: 1 as const, blueprint, base,
        integrationHead: git(exec, paths.integrationPath, ['rev-parse', 'HEAD']),
        tasks: taskList(paths.integrationPath, blueprint), decisions: [], status: 'active' as const, repairWaves: [],
        seedManifest: seeded.manifest,
      };
    } else {
      // 기존 원장을 재개할 때도 lease shape를 본다. fenced mutation과 같이
      // 손상 lease가 bootstrap 응답·이후 명령의 기준이 되지 않게 한다.
      const leaseShape = assertLeaseShape(ledger);
      if (!leaseShape.ok) return leaseShape;
    }
    ledger.integrationBranch = integrationBranch;
    writeLedger(paths.ledgerFile, ledger);
    return withCheckpoint({
      ok: true as const, command, integrationPath: paths.integrationPath,
      ready: readyWave(ledger.tasks, { maxParallel: maxParallelForRead(paths.integrationPath) }),
      tasks: ledger.tasks, decisions: ledger.decisions, integrationBranch,
    }, ledger, paths.ledgerFile);
  }
  if (command === 'release') {
    // release는 main의 계획 사본을 쓰는 유일한 명령이다. --repo와 실제 cwd가 모두 main
    // 루트여야 한다 — 어느 하나라도 integration·worker면 그 checkout의 파일을 main
    // 사본으로 오인해 되돌리게 된다. 원장보다 먼저 판정해 자리가 틀린 호출은 원장을 읽지 않는다.
    const mainRoot = fs.realpathSync(main.projectRoot as string);
    if (fs.realpathSync(repoRoot) !== mainRoot || fs.realpathSync(cwd) !== mainRoot) {
      return { ok: false, reason: 'release-requires-main-checkout' };
    }
  }
  const integration = coordinatorPathsFor({ repoRoot, blueprint });
  if (!registeredIntegration(exec, repoRoot, integration.integrationPath)) {
    return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: integration.integrationPath };
  }
  // status는 읽기 전용 — 잠금 없이 load bytes로 checkpoint만 만든다.
  if (command === 'status') {
    const loaded = loadLedgerBytes(integration.ledgerFile);
    if (!loaded) return { ok: false, reason: 'missing-ledger' };
    const leaseShape = assertLeaseShape(loaded.ledger);
    if (!leaseShape.ok) return leaseShape;
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    return {
      ok: true as const,
      command,
      checkpoint: projectCheckpoint(loaded.ledger, integration.ledgerFile, loaded.bytes),
    };
  }

  // verification integrate는 검증 실행을 잠금 밖에 두려고 두 단계로 나눈다.
  if (command === 'integrate') {
    return integrateTask({
      repoRoot, blueprint, cwd, task, sha, leaseId, generation,
      ledgerPath, ledgerHash, exec, writeLedger, deps,
      integration,
    });
  }

  if (!LEDGER_FENCED_COMMANDS.has(command)) {
    return { ok: false, reason: 'unknown-coordinate-command' };
  }

  return withLedgerLock(integration.ledgerFile, (owns) => {
    const loaded = loadLedgerBytes(integration.ledgerFile);
    if (!loaded) return { ok: false, reason: 'missing-ledger' };
    const { ledger, bytes: ledgerBytes } = loaded;
    const leaseShape = assertLeaseShape(ledger);
    if (!leaseShape.ok) return leaseShape;
    // status는 읽기 전용, bootstrap은 위에서 이미 반환. 그 외 쓰기는 path/hash가
    // 방금 로드한 원장 bytes와 같을 때만 진행해 stale checkpoint로 Git·원장이 갈라지지 않게 한다.
    const fenced = assertLedgerFence({
      ledgerPath, ledgerHash, ledgerBytes,
    });
    if (!fenced.ok) return fenced;

    const commitWrite = (): { ok: false; reason: 'ledger-lock-lost' } | null => (
      writeOwnedLedger(owns, writeLedger, integration.ledgerFile, ledger)
    );

    if (command === 'release') {
    // 판정은 모두 읽기뿐이고 main 쓰기는 마지막 releaseSeedManifest 하나다. 어떤 거절도
    // main 파일을 바꾸지 않는다. 멈춘 drive(확인 대기·partial close·열린 task)는 main
    // 사본까지 복구 상태이므로 건드리지 않는다.
    if (!Array.isArray(ledger.seedManifest)) return { ok: false, reason: 'missing-seed-manifest' };
    if (ledger.status === 'awaiting_confirmation' || ledger.status === 'partial_closed'
      || ledger.tasks.some((entry) => entry.status !== 'integrated')) {
      return { ok: false, reason: 'drive-not-closed' };
    }
    // 원장이 끝났어도 finalize가 integration blueprint를 닫기 전이면 main 사본이 아직
    // 병합으로 돌아올 정본이 없다. closed는 integration 사본에서만 읽는다.
    const index = readBouncerBlock(path.join(integration.integrationPath, blueprint, 'index.md'));
    if (!index || index.status !== 'closed') return { ok: false, reason: 'blueprint-not-closed' };
    const released = releaseSeedManifest({ repoRoot, blueprintDir: blueprint, manifest: ledger.seedManifest });
    return withCheckpoint({ ok: true as const, command, ...released }, ledger, integration.ledgerFile);
  }
  if (command === 'critical-recovery') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    const checked = runtime.validateCoordinatorLedger(ledger);
    if (!checked.ok) return { ok: false, reason: checked.reason };
  }
  if (command === 'partial-close') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    if (ledger.status !== 'awaiting_confirmation') {
      return { ok: false, reason: 'partial-close-awaiting-confirmation-required' };
    }
    const checked = runtime.validateCoordinatorLedger({ ...ledger, status: 'partial_closed', userConfirmed });
    if (!checked.ok) return { ok: false, reason: checked.reason };
    const nextPlan = path.join(integration.integrationPath, 'NEXT_PLAN.md');
    if (!fs.existsSync(nextPlan)) return { ok: false, reason: 'next-plan-required' };
    if (!fs.lstatSync(nextPlan).isFile()) return { ok: false, reason: 'next-plan-must-be-regular-file' };
    if (git(exec, integration.integrationPath, ['ls-files', '--', 'NEXT_PLAN.md']) !== '') {
      return { ok: false, reason: 'next-plan-must-be-untracked' };
    }
    ledger.status = 'partial_closed';
    ledger.userConfirmed = true;
    const rollbackBlueprint = writePartialCloseBlueprint(integration.integrationPath, blueprint);
    try {
      { const lost = commitWrite(); if (lost) return lost; }
    } catch (error) {
      rollbackBlueprint();
      throw error;
    }
    return withCheckpoint({ ok: true as const, command, status: 'partial_closed', nextPlan,
      message: 'NEXT_PLAN.md를 확인하고 후속 계획 진행 여부를 승인해 주세요.',
      preserved: [integration.integrationPath, ...ledger.tasks.map((entry) => entry.workerPath).filter(Boolean)] },
    ledger, integration.ledgerFile);
  }
  if (command === 'prepare') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    let names: { integration: string; standalone: string; worker?: string };
    try {
      // verification-only wave는 worker branch를 만들지 않아 아래 branch 판정에서
      // commit_type을 한 번도 읽지 않는다. task 종류를 보기 전에 blueprint 전체의
      // commit_type을 검증해야, 잘못된 값이 verification node의 ready 전이를 원장에
      // 남긴 뒤 다음 commit wave에서야 드러나는 일을 막는다. 등록 checkout은 실제
      // branch를 재사용해 legacy 원장에만 provenance 필드를 보충하고 rename하지 않는다.
      // commit_type은 integration 사본에서 읽는다. drive 동안 main은 base SHA 출처일 뿐이다.
      names = branchNamesFor({ repoRoot: integration.integrationPath, blueprint });
      const resolved = resolveWorktreeBranch({ repoRoot: integration.integrationPath,
        worktreePath: integration.integrationPath, branch: names.integration, execFileSync: exec });
      if (resolved.action !== 'reuse') {
        return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: integration.integrationPath };
      }
      if (!ledger.integrationBranch) ledger.integrationBranch = resolved.branch;
    } catch (error) {
      const reason = (error as { code?: string }).code;
      if (reason) return { ok: false, reason };
      throw error;
    }
    // prepare만 invalid config를 거절한다. worktree를 만들기 전에 막아 잘못된
    // 한도로 worker가 생기지 않게 한다. status 등 읽기 경로는 1로 폴백한다.
    const policy = readCoordinatorPolicy(integration.integrationPath);
    if (!policy.ok) return { ok: false, reason: 'coordinator-config-invalid' };
    const ready = readyWave(ledger.tasks, { maxParallel: policy.maxParallel });
    // 판정 단계의 사전 검사. worker seed 출처는 integration의 blueprint 트리뿐이므로,
    // 그것이 없으면 worktree를 하나도 만들기 전에 멈춰야 ledger와 Git 등록이 갈라지지 않는다.
    const integrationBlueprint = path.join(integration.integrationPath, blueprint);
    if (!fs.existsSync(integrationBlueprint) || !fs.statSync(integrationBlueprint).isDirectory()) {
      return { ok: false, reason: 'missing-blueprint', blueprintDir: blueprint,
        integrationPath: integration.integrationPath };
    }
    // verification bundle 확인도 읽기만 하므로 같은 판정 단계에 둔다. 섞인 wave에서
    // 아래 루프가 commit worker를 먼저 만든 뒤 이 node에서 멈추면, 원장은 쓰이지 않았는데
    // Git에는 worker가 등록되어 재시도 전 둘이 갈라진다.
    for (const id of ready) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (item.execution_kind !== 'verification') continue;
      const checked = checkVerificationNode(integration.integrationPath, blueprint, id);
      if (!checked.ok) return checked;
    }
    const plannedWorkers = new Map<string, { worker: string; branch: string; action: 'reuse' | 'create' }>();
    try {
      // revoke된 배정은 등록 worktree·branch를 지운 뒤 새로 만든다. reuse하면
      // 이전 generation의 dirty HEAD가 그대로 남는다. leased-revoked와
      // legacy(no lease) revoke를 같은 헬퍼로 덮는다.
      for (const id of ready) {
        const item = ledger.tasks.find((x) => x.id === id) as Task;
        if (item.execution_kind === 'verification') continue;
        if (shouldRemoveRevokedWorker(item)) {
          removeRevokedWorker(exec, integration.integrationPath, item);
        }
      }
      // 한 wave의 branch 충돌을 모두 확인한 뒤에만 worktree를 만든다. 앞 task를
      // 먼저 만들고 뒤 task에서 멈추면 재시도 전 ledger와 Git 등록이 갈라지므로,
      // 이 단계는 Git 조회만 하고 seed·mkdir·worktree add를 절대 호출하지 않는다.
      for (const id of ready) {
        const item = ledger.tasks.find((x) => x.id === id) as Task;
        if (item.execution_kind === 'verification') continue;
        const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
        if (fs.existsSync(worker) && !registeredWorker(exec, integration.integrationPath, worker)) {
          return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        const workerNames = branchNamesFor({ repoRoot: integration.integrationPath, blueprint, task: id });
        const resolved = resolveWorktreeBranch({ repoRoot: integration.integrationPath, worktreePath: worker,
          branch: workerNames.worker as string, execFileSync: exec });
        plannedWorkers.set(id, { worker, branch: resolved.branch, action: resolved.action });
      }
      // 이전 원장의 prepared task는 ready wave에 없어서 별도로 실제 checkout을 읽는다.
      // 이미 등록된 branch를 rename하지 않고 field만 채워 재개 payload의 provenance를
      // 복원한다. prepared인데 등록이 사라진 경우에는 새 branch를 만들 수 없다.
      for (const item of ledger.tasks) {
        if (item.execution_kind === 'verification' || item.status !== 'prepared' || item.branch) continue;
        const worker = coordinatorPathsFor({ repoRoot, blueprint, task: item.id }).workerPath as string;
        if (!registeredWorker(exec, integration.integrationPath, worker)) {
          return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        const workerNames = branchNamesFor({ repoRoot: integration.integrationPath, blueprint, task: item.id });
        const resolved = resolveWorktreeBranch({ repoRoot: integration.integrationPath, worktreePath: worker,
          branch: workerNames.worker as string, execFileSync: exec });
        if (resolved.action !== 'reuse') {
          return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
        }
        item.branch = resolved.branch;
      }
    } catch (error) {
      const reason = (error as { code?: string }).code;
      if (reason) return { ok: false, reason };
      throw error;
    }
    for (const id of ready) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (item.execution_kind === 'verification') {
        item.status = transition(item.status || 'pending', 'ready', 'verification');
        continue;
      }
      const planned = plannedWorkers.get(id) as { worker: string; branch: string; action: 'reuse' | 'create' };
      if (planned.action === 'create') {
        fs.mkdirSync(path.dirname(planned.worker), { recursive: true });
        git(exec, integration.integrationPath,
          ['worktree', 'add', '-b', planned.branch, planned.worker, 'HEAD']);
      }
      if (!registeredWorker(exec, integration.integrationPath, planned.worker)) {
        return { ok: false, reason: 'unassigned-worker-worktree', workerPath: planned.worker };
      }
      // 모든 worker는 integration 사본을 받는다. bootstrap 뒤 계획 문서의 정본은
      // integration이고(동적 repair 문서는 그곳에만 있다), main은 drive 동안 base SHA
      // 출처로만 남으므로 main 계획이 사라져도 준비가 이어진다. cpSync는 worker마다
      // 독립 사본을 쓰므로 병렬 worker끼리 문서를 공유하지 않는다.
      const seeded = seedCoordinatorWorker({
        repoRoot: integration.integrationPath, blueprintDir: blueprint, worktreePath: planned.worker,
      });
      if (!seeded.ok) return seeded;
      item.status = transition(item.status || 'pending', 'ready');
      item.status = transition(item.status, 'prepared');
      item.workerPath = planned.worker;
      item.branch = planned.branch;
      // commit task 배정마다 lease를 발급한다. generation은 revoke 재배정에서 오른다.
      issueLease(ledger, item, makeLeaseId);
    }
    { const lost = commitWrite(); if (lost) return lost; }
    return withCheckpoint({ ok: true as const, command, ready, tasks: ledger.tasks, decisions: ledger.decisions },
      ledger, integration.ledgerFile);
  }
  if (command === 'revoke') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    if (!task || !/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
    const revokeItem = ledger.tasks.find((x) => x.id === task);
    if (!revokeItem) return { ok: false, reason: 'task-outside-blueprint' };
    if (typeof reason !== 'string' || reason.trim() === '') {
      return { ok: false, reason: 'decision-reason-required' };
    }
    const status = revokeItem.status || 'pending';
    if (status !== 'prepared' && status !== 'recorded') {
      return { ok: false, reason: 'illegal-transition' };
    }
    const previousHead = typeof revokeItem.sha === 'string' ? revokeItem.sha : null;
    const decision = revokeLease(ledger, revokeItem, {
      reason: reason.trim(), previousHead,
    });
    { const lost = commitWrite(); if (lost) return lost; }
    return withCheckpoint({
      ok: true as const, command, task: revokeItem, decision,
    }, ledger, integration.ledgerFile);
  }
  if (!task || !/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
  const item = ledger.tasks.find((x) => x.id === task);
  if (!item) return { ok: false, reason: 'task-outside-blueprint' };
  // lease 검사는 attempt·brief hash·상태 검사보다 앞에 둔다. revoke 뒤 늦은
  // 플래그 호출이 illegal-transition으로 가려지지 않게 한다.
  if (command === 'dispatch' || command === 'report' || command === 'record') {
    const leaseChecked = checkLease(item, {
      ...(leaseId !== undefined ? { lease_id: leaseId } : {}),
      ...(generation !== undefined ? { generation } : {}),
    });
    if (!leaseChecked.ok) {
      const rejected = rejectLeaseMismatch(ledger, item, task, leaseChecked);
      if (leaseChecked.reason === 'stale-lease') {
        const lost = commitWrite();
        if (lost) return lost;
      }
      return rejected;
    }
  }
  if (command === 'critical-recovery') {
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
      return withCheckpoint({ ok: true as const, command, task: item, decision: result, decisions: ledger.decisions },
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
    return withCheckpoint({ ok: true as const, command, task: item, decision: started, decisions: ledger.decisions },
      ledger, integration.ledgerFile);
  }
  if (command === 'dispatch' || command === 'report') {
    // dispatch/report는 implementer 경계다. record와 같이 할당 worker에서만 열리며,
    // task 상태(prepared)는 유지하고 attempt 상태(active|reported)만 바꾼다.
    const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
    if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
      return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
    if (item.execution_kind === 'verification') {
      return { ok: false, reason: 'dispatch-commit-task-required' };
    }
    if ((item.status || 'pending') !== 'prepared') return { ok: false, reason: 'illegal-transition' };
  }
  if (command === 'dispatch') {
    if (item.dispatch?.status === 'active') {
      return { ok: false, reason: 'dispatch-already-active' };
    }
    // 직전 reported attempt가 있을 때만 previous_outcome을 싣는다. 최초 1회는 필드를
    // 생략해 "없음"과 빈 객체를 구분한다.
    const previousOutcome = item.dispatch?.status === 'reported'
      && item.dispatch.outcome && item.dispatch.summary
      ? { outcome: item.dispatch.outcome, summary: item.dispatch.summary }
      : undefined;
    let baseHead: string;
    let porcelain: string;
    try {
      baseHead = git(exec, cwd, ['rev-parse', 'HEAD']);
      porcelain = initialWorktreeState(exec, cwd);
    } catch (_error) {
      // HEAD·porcelain 조회 실패는 attempt를 열지 않는다. 부분 ledger를 남기면 재개가
      // 깨진 baseline을 정본으로 삼는다.
      return { ok: false, reason: 'dispatch-git-read-failed' };
    }
    const hash = taskBriefHashOf(cwd, blueprint, task);
    const nextAttempt = (item.dispatch?.attempt || 0) + 1;
    item.dispatch = {
      attempt: nextAttempt, task_brief_hash: hash, base_head: baseHead,
      initial_worktree_state: porcelain, status: 'active',
    };
    const dispatchDecision: DispatchDecision = {
      task, kind: 'dispatch', attempt: nextAttempt, task_brief_hash: hash,
      base_head: baseHead, initial_worktree_state: porcelain,
    };
    item.decisions = [...(item.decisions || []), dispatchDecision];
    ledger.decisions.push(dispatchDecision);
    { const lost = commitWrite(); if (lost) return lost; }
    const metadata: {
      attempt: number; task_brief_hash: string; base_head: string; initial_worktree_state: string;
      previous_outcome?: { outcome: string; summary: string };
    } = {
      attempt: nextAttempt, task_brief_hash: hash, base_head: baseHead,
      initial_worktree_state: porcelain,
    };
    if (previousOutcome) metadata.previous_outcome = previousOutcome;
    return withCheckpoint({ ok: true as const, command, metadata, task: item, decisions: ledger.decisions },
      ledger, integration.ledgerFile);
  }
  if (command === 'report') {
    if (!item.dispatch || item.dispatch.status !== 'active') {
      return { ok: false, reason: 'no-active-dispatch' };
    }
    if (!Number.isInteger(attempt) || (attempt as number) < 1) {
      return { ok: false, reason: 'invalid-attempt' };
    }
    if (typeof taskBriefHash !== 'string' || !/^[a-f0-9]{64}$/.test(taskBriefHash)) {
      return { ok: false, reason: 'invalid-task-brief-hash' };
    }
    if (!(REPORT_OUTCOMES as readonly string[]).includes(outcome || '')) {
      return { ok: false, reason: 'invalid-report-outcome' };
    }
    if (typeof summary !== 'string' || summary.trim() === '') {
      return { ok: false, reason: 'summary-required' };
    }
    const expected = {
      attempt: item.dispatch.attempt, task_brief_hash: item.dispatch.task_brief_hash,
    };
    const received = { attempt: attempt as number, task_brief_hash: taskBriefHash };
    // mismatch는 stale 증적만 남기고 활성 attempt를 유지한다. recorded로 올리면
    // 늦은 보고가 현재 dispatch를 닫아 재시도를 막는다.
    if (received.attempt !== expected.attempt
      || received.task_brief_hash !== expected.task_brief_hash) {
      const stale: StaleReportDecision = {
        task, kind: 'stale-report', expected, received,
      };
      item.decisions = [...(item.decisions || []), stale];
      ledger.decisions.push(stale);
      { const lost = commitWrite(); if (lost) return lost; }
      return { ok: false, reason: 'stale-report', expected, received };
    }
    item.dispatch.status = 'reported';
    item.dispatch.outcome = outcome as ReportOutcome;
    item.dispatch.summary = summary;
    const reportDecision: ReportDecision = {
      task, kind: 'report', attempt: attempt as number, task_brief_hash: taskBriefHash,
      outcome: outcome as ReportOutcome, summary,
    };
    item.decisions = [...(item.decisions || []), reportDecision];
    ledger.decisions.push(reportDecision);
    { const lost = commitWrite(); if (lost) return lost; }
    return withCheckpoint({
      ok: true as const, command, attempt: attempt as number, decision: reportDecision,
      task: item, decisions: ledger.decisions,
    }, ledger, integration.ledgerFile);
  }
  if (command === 'record') {
    // record는 worker가 만든 SHA와 provenance를 ledger로 올리는 경계다. integration
    // checkout에서 다시 worker 경계를 요구하면 어떤 정상 worker도 기록할 수 없다.
    const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
    // prepare 뒤에도 경로 치환은 가능하다. ledger에 저장한 문자열과 Git 등록을 둘 다
    // 다시 확인해야 symlink가 외부 checkout의 HEAD를 provenance로 기록할 수 없다.
    if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
      return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
    if ((item.status || 'pending') !== 'prepared') return { ok: false, reason: 'illegal-transition' };
    // accepted report가 없는 HEAD는 어느 brief·attempt의 결과인지 알 수 없다.
    // dispatch 없이 record하던 경로를 여기서 끊는다.
    if (!item.dispatch || item.dispatch.status !== 'reported'
      || item.dispatch.outcome !== 'accepted') {
      return { ok: false, reason: 'accepted-report-required' };
    }
    // report 이후 brief bytes가 바뀌면 수락한 보고와 다른 문서다. attempt를 닫지
    // 않은 채 stale-worker-report로만 거절해 재디스패치 여지를 남긴다.
    if (taskBriefHashOf(cwd, blueprint, task) !== item.dispatch.task_brief_hash) {
      return { ok: false, reason: 'stale-worker-report' };
    }
    const workerHead = git(exec, cwd, ['rev-parse', 'HEAD']);
    // record 시점의 HEAD만 허용한다. caller가 임의 SHA를 주장하거나 worker가
    // 다른 commit을 향한 뒤의 값을 기록하면 coordinator provenance가 무너진다.
    if (sha && sha !== workerHead) return { ok: false, reason: 'sha-not-worker-head' };
    item.status = transition('prepared', 'recorded'); item.sha = workerHead;
    if (decision !== undefined) {
      item.decisions = [...(item.decisions || []), decision];
      ledger.decisions.push({ task, decision });
    }
    { const lost = commitWrite(); if (lost) return lost; }
    return withCheckpoint({ ok: true as const, command, task: item, decisions: ledger.decisions },
      ledger, integration.ledgerFile);
  }
  if (command === 'rerecord') {
    const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
    if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
      return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
    if (item.status !== 'recorded' || !item.sha) return { ok: false, reason: 'not-recorded' };
    if (typeof decision !== 'string' || decision.trim() === '') {
      return { ok: false, reason: 'decision-reason-required' };
    }
    const integrationHead = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    if (ledger.integrationHead !== integrationHead) return { ok: false, reason: 'stale-integration-head' };
    const workerHead = git(exec, cwd, ['rev-parse', 'HEAD']);
    if (sha && sha !== workerHead) return { ok: false, reason: 'sha-not-worker-head' };
    if (workerHead === item.sha) return { ok: false, reason: 'sha-unchanged' };
    if (directParent(exec, cwd, workerHead) !== integrationHead) {
      return { ok: false, reason: 'sha-not-direct-integration-child' };
    }
    const rerecordDecision: RerecordDecision = {
      task, kind: 'rerecord', reason: decision.trim(), previousSha: item.sha,
      nextSha: workerHead, integrationHead,
    };
    item.sha = workerHead;
    item.decisions = [...(item.decisions || []), rerecordDecision];
    ledger.decisions.push(rerecordDecision);
    { const lost = commitWrite(); if (lost) return lost; }
    return withCheckpoint({
      ok: true as const, command, task: item, decision: rerecordDecision, decisions: ledger.decisions,
    }, ledger, integration.ledgerFile);
  }
  if (command === 'repair') {
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
    const waves = ledger.repairWaves || [];
    if (waves.length >= 2) return { ok: false, reason: 'repair-wave-limit', status: 'awaiting_confirmation' };
    if (item.execution_kind !== 'verification' || item.status !== 'verifying') {
      return { ok: false, reason: 'terminal-failure-required' };
    }
    if (typeof failureCommand !== 'string' || failureCommand === '' || typeof summary !== 'string' || summary === '') {
      return { ok: false, reason: 'failure-evidence-required' };
    }
    if (typeof decision !== 'string' || decision.trim() === '') {
      return { ok: false, reason: 'decision-reason-required' };
    }
    if (!sourceRepairPaths(repairPaths)) return { ok: false, reason: 'repair-scope-out-of-bounds' };
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
      scope: { revision, paths: [...repairPaths] },
    };
    item.depends_on = [repairId];
    item.status = 'pending';
    ledger.tasks.push(repair);
    const repairDecision: RepairDecision = {
      task: repairId, kind: 'repair', wave, reason: decision.trim(), failure,
      previousDag, nextDag: dagSnapshot(ledger.tasks), previousScope: [],
      nextScope: [...repairPaths], necessity: 'terminal CI failure requires a Blueprint-scoped source repair', revision,
    };
    repair.decisions = [repairDecision];
    ledger.decisions.push(repairDecision);
    ledger.repairWaves = [...waves, repairDecision];
    ledger.revision = revision;
    ledger.terminalFailure = failure;
    ledger.status = 'active';
    const rollbackDocuments = writeRepairDocuments({
      integrationPath: integration.integrationPath, blueprint, repair, terminal: item,
    });
    try {
      { const lost = commitWrite(); if (lost) return lost; }
    } catch (error) {
      rollbackDocuments();
      throw error;
    }
    return withCheckpoint({
      ok: true as const, command, wave, repairTask: repair, terminalTask: item, decision: repairDecision,
    }, ledger, integration.ledgerFile);
  }
  return { ok: false, reason: 'unknown-coordinate-command' };
  });
}

export = {
  readyWave, transition, coordinate, loadLedger, loadLedgerBytes, readBouncerBlock,
  projectCheckpoint, assertLedgerFence, LEDGER_REL,
};
