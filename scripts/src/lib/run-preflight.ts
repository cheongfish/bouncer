'use strict';

const path = require('node:path');
import current = require('./current');
const { readCurrent, CurrentSelectionError } = current;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import paths = require('./paths');
const { toPosix } = paths;
import schema = require('./schema');
const {
  AUTONOMY_ENUM, DEFAULT_AUTONOMY, DEFAULT_SCALE,
  DEFAULT_DEPENDS_ON, DEFAULT_PARALLEL_SAFE, DEFAULT_DEPENDENCY_GATE,
  executionKindOf,
} = schema;
import coordinator = require('./coordinator');
const { readyWave } = coordinator;
import configMod = require('./config');
const { readConfig } = configMod;

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
  reason: 'blueprint-closed' | 'no-open-task' | null;
};

type PreflightFail = {
  ok: false;
  reason: string;
  candidates?: unknown;
  issues?: unknown;
};

type PreflightResult = PreflightOk | PreflightFail;

type WaveTask = {
  id: string;
  depends_on?: string[];
  dependency_gate?: string;
  parallel_safe?: boolean;
  status?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
    // index 부재·파싱 실패는 위임 거절로 승격하지 않는다. 열린 task 유무로만 본다.
    return { status: '', scale: DEFAULT_SCALE };
  }
}

function collectTasks(repoRoot: string, blueprintDir: string): {
  openTasks: OpenTask[];
  waveTasks: WaveTask[];
} {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  const openTasks: OpenTask[] = [];
  const waveTasks: WaveTask[] = [];
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
    waveTasks.push({
      id,
      depends_on: ledgerDependsOn(dependsOn),
      dependency_gate: dependencyGate,
      parallel_safe: parallelSafe,
      status: ledgerStatus(status),
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
  return { openTasks, waveTasks };
}

/**
 * drive 시작에 필요한 pointer·blueprint·열린 task·DAG·autonomy를 한 JSON으로
 * 정규화한다. 파일을 쓰지 않으며, 위임 가능 여부는 상태만 보고 결정한다.
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
  const blueprint = toPosix(blueprintDir);
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

  const meta = readBlueprintMeta(repoRoot, blueprint);
  const { openTasks, waveTasks } = collectTasks(repoRoot, blueprint);
  const closed = meta.status === 'closed';
  let reason: PreflightOk['reason'] = null;
  if (closed) reason = 'blueprint-closed';
  else if (openTasks.length === 0) reason = 'no-open-task';

  return {
    ok: true,
    blueprint: { dir: blueprint, status: meta.status, scale: meta.scale },
    base: pointer.base,
    openTasks,
    readyWave: readyWave(waveTasks),
    autonomy: readAutonomy(repoRoot),
    delegable: reason === null,
    reason,
  };
}

export = { runPreflight };
