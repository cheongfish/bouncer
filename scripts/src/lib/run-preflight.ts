'use strict';

import guards = require('./guards');
const { isRecord } = guards;
const path = require('node:path');
import current = require('./current');
const { readCurrent, CurrentSelectionError } = current;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import paths = require('./paths');
const { toPosix, parsePathIds } = paths;
import schema = require('./schema');
const {
  AUTONOMY_ENUM, DEFAULT_AUTONOMY, DEFAULT_SCALE,
  DEFAULT_DEPENDS_ON, DEFAULT_PARALLEL_SAFE, DEFAULT_DEPENDENCY_GATE,
  DEFAULT_EXCLUSIVE_RESOURCES, executionKindOf,
} = schema;
import coordinator = require('./coordinator');
const { readyWave, loadLedger } = coordinator;
import runtimeState = require('./runtime-state');
const { coordinatorPathsFor } = runtimeState;
import configMod = require('./config');
const { readConfig, readCoordinatorPolicy, readDirectMaxCommitTasks } = configMod;
import dagShape = require('./dag-shape');
const { analyzeDriveShape } = dagShape;

const OPEN_STATUS = ['ready', 'in_progress'];
const TASK_ID_RE = /^TASKS-(\d{3})$/;
const TASK_DIR_RE = /(?:^|\/)tasks\/(\d{3})\/tasks\.md$/;

type Pointer = {
  blueprint: string;
  base: string;
  task: string | null;
};

type Autonomy = {
  value: string;
  fallback: boolean;
  reason: 'missing' | 'invalid' | null;
};

type OpenTask = {
  id: string;
  taskId: string;
  path: string;
  status: string;
  execution_kind: 'commit' | 'verification';
  affected_paths: string[];
  depends_on: string[];
  parallel_safe: boolean;
  dependency_gate: string;
};

type PreflightOk = {
  ok: true;
  blueprint: { dir: string; status: string; scale: string };
  base: string;
  openTasks: OpenTask[];
  readyWave: string[];
  autonomy: Autonomy;
  delegable: boolean;
  // 열린 commit task의 DAG 모양. 성공 payload에만 붙는다(ok:false에는 없다).
  shape: ReturnType<typeof analyzeDriveShape>;
  // root가 coordinator 없이 직접 돌려도 되는 드라이브인지. 시작 ACQ가 D 선택지를 보일지 정한다.
  direct_eligible: boolean;
  // promotion-stopped는 원장 status만 본다. 원장 부재 시에는 이 값을 내지 않는다.
  // 위임을 막는 이유. 판정 순서는 원장 상태 → 문서 status → no-open-task 이다.
  reason: 'blueprint-closed' | 'no-open-task' | 'promotion-stopped'
    | 'awaiting-confirmation' | 'partial-closed'
    | 'blueprint-partial-closed' | 'blueprint-draft' | 'blueprint-superseded'
    | 'blueprint-imported' | 'blueprint-status-unknown' | null;
};

type PreflightFail = {
  ok: false;
  reason: string;
  candidates?: unknown;
  issues?: unknown;
  // pointer-mismatch에서만 채운다: 포인터 blueprint 경로와 요청 입력값(toPosix만 적용).
  expected?: string;
  actual?: string;
};

type PreflightResult = PreflightOk | PreflightFail;

type WaveTask = {
  id: string;
  depends_on?: string[];
  dependency_gate?: string;
  parallel_safe?: boolean;
  status?: string;
  affected_paths?: string[];
  exclusive_resources?: string[];
};

// shape 시뮬레이션 입력. readyWave에는 필요 없는 필드라 WaveTask와 분리한다.
type ShapeInput = WaveTask & {
  execution_kind: 'commit' | 'verification';
  review_risk: string[];
  open: boolean;
};

function isSelectionError(error: unknown): error is InstanceType<typeof CurrentSelectionError> {
  return error instanceof CurrentSelectionError
    || (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && typeof (error as { code: unknown }).code === 'string'
      && String((error as { code: string }).code).startsWith('CURRENT_')
    );
}

function bouncerOf(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data) || !isRecord(data.bouncer)) return null;
  return data.bouncer;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * frontmatter `TASKS-NNN`과 문서 경로에서 원장과 같은 세 자리 id를 고른다.
 * readyWave는 `other.id === depends_on 항목`으로 선행을 찾으므로, 문서 값
 * `TASKS-001`을 그대로 넘기면 파가 항상 비어 버린다.
 *
 * @param {string | null} taskId - frontmatter `bouncer.id`
 * @param {string} rel - tasks.md 상대 경로
 * @returns {string | null} 세 자리 번호, 둘 다 없으면 null
 */
function ledgerId(taskId: string | null, rel: string): string | null {
  if (taskId) {
    const fromId = TASK_ID_RE.exec(taskId);
    if (fromId) return fromId[1];
  }
  const fromPath = TASK_DIR_RE.exec(toPosix(rel));
  return fromPath ? fromPath[1] : null;
}

function ledgerDependsOn(values: string[]): string[] {
  return values.map((entry) => {
    const match = TASK_ID_RE.exec(entry);
    return match ? match[1] : entry;
  });
}

/**
 * 문서의 열린 상태만 원장 `pending`으로 옮긴다. readyWave는 pending만
 * 후보로 보고, `integrated` 같은 종단 상태는 선행 gate 비교에 그대로 쓴다.
 *
 * @param {string} status - tasks.md `bouncer.status`
 * @returns {string} readyWave에 넣을 상태
 */
function ledgerStatus(status: string): string {
  return OPEN_STATUS.includes(status) ? 'pending' : status;
}

/**
 * main worktree 설정에서 autonomy를 읽는다. 누락·잘못된 값은 기본값으로 접는다.
 * coordinate status --write-input도 같은 규칙을 쓰도록 export한다.
 *
 * @param {string} repoRoot - `.bouncer/config.json`이 있는 main checkout
 * @returns {Autonomy} 값과 기본값 폴백 여부
 */
function readAutonomy(repoRoot: string): Autonomy {
  const parsed = readConfig(repoRoot);
  if (!isRecord(parsed) || !Object.prototype.hasOwnProperty.call(parsed, 'autonomy')) {
    return { value: DEFAULT_AUTONOMY, fallback: true, reason: 'missing' };
  }
  const raw = parsed.autonomy;
  if (typeof raw === 'string' && (AUTONOMY_ENUM as string[]).includes(raw)) {
    return { value: raw, fallback: false, reason: null };
  }
  return { value: DEFAULT_AUTONOMY, fallback: true, reason: 'invalid' };
}

function readBlueprintMeta(repoRoot: string, blueprintDir: string): {
  status: string;
  scale: string;
} {
  try {
    const doc = readDoc(path.join(repoRoot, blueprintDir, 'index.md'));
    const bouncer = bouncerOf(doc.data);
    const status = bouncer && typeof bouncer.status === 'string' ? bouncer.status : '';
    const scale = bouncer && typeof bouncer.scale === 'string' ? bouncer.scale : DEFAULT_SCALE;
    return { status, scale };
  } catch (_error) {
    // index 부재·파싱 실패는 status를 ''로 접는다. 호출부(docStatusReason)가 ''를
    // blueprint-status-unknown으로 거절하므로 읽지 못한 blueprint는 위임되지 않는다.
    return { status: '', scale: DEFAULT_SCALE };
  }
}

// approved가 아닌 문서 status → 위임 거절 reason. 목록에 없는 값(빈 값 포함)은
// 모두 status-unknown으로 접어, 새 status가 생겨도 기본이 "위임 거절"이 되게 한다.
const STATUS_REASON: Record<string, NonNullable<PreflightOk['reason']>> = {
  closed: 'blueprint-closed',
  partial_closed: 'blueprint-partial-closed',
  draft: 'blueprint-draft',
  superseded: 'blueprint-superseded',
  imported: 'blueprint-imported',
};

/**
 * blueprint 문서 status를 위임 거절 reason으로 바꾼다.
 *
 * @param {string} status - index.md `bouncer.status` (읽지 못하면 '')
 * @returns {PreflightOk['reason']} approved면 null, 아니면 상태별 reason
 */
function docStatusReason(status: string): PreflightOk['reason'] {
  if (status === 'approved') return null;
  return Object.prototype.hasOwnProperty.call(STATUS_REASON, status)
    ? STATUS_REASON[status]
    : 'blueprint-status-unknown';
}

// 원장 status → 위임 거절 reason. active는 막지 않으므로 목록에 없다.
const LEDGER_REASON: Record<string, NonNullable<PreflightOk['reason']>> = {
  promotion_stopped: 'promotion-stopped',
  awaiting_confirmation: 'awaiting-confirmation',
  partial_closed: 'partial-closed',
};

function collectTasks(repoRoot: string, blueprintDir: string): {
  openTasks: OpenTask[];
  waveTasks: WaveTask[];
  shapeTasks: ShapeInput[];
} {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  const openTasks: OpenTask[] = [];
  const waveTasks: WaveTask[] = [];
  const shapeTasks: ShapeInput[] = [];
  for (const entry of listing.entries) {
    let data: unknown;
    try {
      data = readDoc(path.join(repoRoot, entry.rel)).data;
    } catch (_error) {
      // 깨진 문서 하나가 나머지 열린 task를 지우지 않게 이 항목만 건너뛴다.
      continue;
    }
    const bouncer = bouncerOf(data);
    const status = bouncer && typeof bouncer.status === 'string' ? bouncer.status : '';
    const taskId = bouncer && typeof bouncer.id === 'string' && bouncer.id
      ? bouncer.id
      : (typeof entry.id === 'string' ? entry.id : null);
    const id = ledgerId(taskId, entry.rel);
    if (!id) continue;
    const dependsOn = bouncer && Object.prototype.hasOwnProperty.call(bouncer, 'depends_on')
      ? stringList(bouncer.depends_on)
      : [...DEFAULT_DEPENDS_ON];
    const parallelSafe = bouncer && typeof bouncer.parallel_safe === 'boolean'
      ? bouncer.parallel_safe
      : DEFAULT_PARALLEL_SAFE;
    const dependencyGate = bouncer && typeof bouncer.dependency_gate === 'string'
      ? bouncer.dependency_gate
      : DEFAULT_DEPENDENCY_GATE;
    const executionKind = executionKindOf(bouncer) || 'commit';
    const affected = bouncer ? stringList(bouncer.affected_paths) : [];
    const exclusive = bouncer && Object.prototype.hasOwnProperty.call(bouncer, 'exclusive_resources')
      ? stringList(bouncer.exclusive_resources)
      : [...DEFAULT_EXCLUSIVE_RESOURCES];
    const waveTask: WaveTask = {
      id,
      depends_on: ledgerDependsOn(dependsOn),
      dependency_gate: dependencyGate,
      parallel_safe: parallelSafe,
      status: ledgerStatus(status),
      // 문서에 키가 없어도 []를 넣어 legacy(필드 부재)와 구분한다. preflight가
      // bootstrap 스냅샷과 같은 충돌 집합을 보게 하려는 목적이다.
      affected_paths: affected,
      exclusive_resources: exclusive,
    };
    waveTasks.push(waveTask);
    // review_risk 형식 거절은 S30 소관이므로 배열이 아니면 빈 위험으로 읽는다.
    shapeTasks.push({
      ...waveTask,
      execution_kind: executionKind,
      review_risk: stringList(bouncer ? bouncer.review_risk : undefined),
      open: OPEN_STATUS.includes(status),
    });
    if (!OPEN_STATUS.includes(status)) continue;
    openTasks.push({
      id,
      taskId: taskId || `TASKS-${id}`,
      path: entry.rel,
      status,
      execution_kind: executionKind,
      affected_paths: affected,
      depends_on: dependsOn,
      parallel_safe: parallelSafe,
      dependency_gate: dependencyGate,
    });
  }
  return { openTasks, waveTasks, shapeTasks };
}

/**
 * drive 시작에 필요한 pointer·blueprint·열린 task·DAG·autonomy를 한 JSON으로
 * 정규화한다. 파일을 쓰지 않으며, 위임 가능 여부는 상태만 보고 결정한다.
 * 요청 blueprint가 포인터와 다르면 `pointer-mismatch`(ok:false)로 거절한다.
 * 위임은 원장이 active이거나 없고, 문서 status가 approved이며, 열린 task가
 * 있을 때만 열린다. 그 밖에는 상태별 reason과 함께 delegable:false이다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 포인터와 plan 문서가 있는 checkout
 * @param {string} opts.blueprintDir - `--blueprint` 값
 * @returns {PreflightResult} 성공 payload 또는 거절 reason
 */
function runPreflight({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): PreflightResult {
  const requested = toPosix(blueprintDir);
  let pointer: Pointer | null;
  try {
    pointer = readCurrent({ repoRoot });
  } catch (error) {
    if (isSelectionError(error)) {
      const fail: PreflightFail = { ok: false, reason: error.code };
      if (error.candidates) fail.candidates = error.candidates;
      if (error.issues) fail.issues = error.issues;
      return fail;
    }
    throw error;
  }
  if (!pointer) return { ok: false, reason: 'no-current' };

  // 포인터와 다른 blueprint를 요청하면 그 task에 포인터의 base를 섞어 위임 가능으로
  // 판정하게 된다. 문자열이 아니라 epic/blueprint id 쌍으로 비교해 끝 슬래시·`./`·
  // 절대 경로 표기 차이는 같은 blueprint로 본다. id를 못 뽑는 입력도 같은 거절이다.
  const want = parsePathIds(requested);
  const have = parsePathIds(pointer.blueprint);
  if (
    !want.epicId || !want.blueprintId
    || want.epicId !== have.epicId || want.blueprintId !== have.blueprintId
  ) {
    return {
      ok: false, reason: 'pointer-mismatch', expected: pointer.blueprint, actual: requested,
    };
  }

  // 문서·원장 조회는 repo 상대 경로가 필요하다. 절대 경로를 path.join(repoRoot, …)에
  // 그대로 넘기면 경로가 겹쳐 읽기에 실패하므로 repoRoot 기준 상대 경로로 맞춘다.
  const blueprint = path.posix.normalize(
    path.isAbsolute(requested) ? toPosix(path.relative(repoRoot, requested)) : requested,
  ).replace(/\/$/, '');

  const meta = readBlueprintMeta(repoRoot, blueprint);
  const { openTasks, waveTasks, shapeTasks } = collectTasks(repoRoot, blueprint);

  // 우선순위: 원장 상태 → 문서 status → no-open-task. 원장이 진행 중 정지·확인 대기·
  // 부분 종료이면 문서가 approved여도 새 drive를 시작하면 안 된다. 원장 부재·손상·
  // integration 경로 해석 실패는 정지 여부를 알 수 없으므로 miss로 두고 문서만 본다.
  let reason: PreflightOk['reason'] = null;
  try {
    const paths = coordinatorPathsFor({ repoRoot, blueprint });
    const ledger = loadLedger(paths.ledgerFile);
    const ledgerStatus = ledger ? ledger.status : undefined;
    if (ledgerStatus && Object.prototype.hasOwnProperty.call(LEDGER_REASON, ledgerStatus)) {
      reason = LEDGER_REASON[ledgerStatus];
    }
  } catch (_error) {
    // 원장 부재·손상·git 실패는 miss로 흡수한다. 위임을 열어 주는 방향이지만
    // 이어지는 문서 status 검사가 승인 전·종료 blueprint를 여전히 막는다.
  }
  if (reason === null) reason = docStatusReason(meta.status);
  if (reason === null && openTasks.length === 0) reason = 'no-open-task';

  // preflight는 repoRoot config를 본다. invalid면 1로 접어 ACQ 미리보기가
  // prepare보다 넓은 wave를 약속하지 않게 한다.
  const policy = readCoordinatorPolicy(repoRoot);
  const maxParallel = policy.ok ? policy.maxParallel : 1;

  const shape = analyzeDriveShape(shapeTasks, { maxParallel });
  // 직접 실행은 위임 가능한 full 직렬 체인이 설정 상한 이하일 때만 연다. 상한 0(꺼짐·invalid
  // 폴백)은 commit_tasks >= 1 조건과 겹쳐 항상 false가 된다.
  const directMax = readDirectMaxCommitTasks(repoRoot);
  const directEligible = reason === null
    && meta.scale === 'full'
    && shape.drive_shape === 'serial'
    && shape.commit_tasks >= 1
    && shape.commit_tasks <= directMax;

  return {
    ok: true,
    blueprint: { dir: blueprint, status: meta.status, scale: meta.scale },
    base: pointer.base,
    openTasks,
    readyWave: readyWave(waveTasks, { maxParallel }),
    autonomy: readAutonomy(repoRoot),
    delegable: reason === null,
    reason,
    // readyWave와 같은 maxParallel(invalid는 1)로 돌려 두 값이 어긋나지 않게 한다.
    shape,
    direct_eligible: directEligible,
  };
}

export = { runPreflight, readAutonomy };
