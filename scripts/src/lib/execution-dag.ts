'use strict';
// I/O 없는 DAG 규칙: 어떤 task를 지금 열 수 있는지(readyWave)와 상태 전이(transition).
// coordinator가 명령 처리와 이 규칙을 함께 들고 있으면 current·commit 같은 읽기 쪽 모듈이
// readyWave 하나 때문에 coordinator 전체를 가져와 verification → current → coordinator →
// verification 순환이 생긴다. 규칙만 하위 모듈로 내려 그 간선을 끊는다.
// 이 모듈은 config(DEFAULT_MAX_PARALLEL)와 path-overlap만 런타임에 가져온다 —
// cli·validate·coordinator·current·verification을 가져오면 경계 테스트가 실패한다.
import configMod = require('./config');
const { DEFAULT_MAX_PARALLEL } = configMod;
import pathOverlapMod = require('./path-overlap');
// 정규화 정본은 path-overlap이다. 기존 소비자(dag-shape·coordinator-commands)가 이 모듈에서
// 같은 이름으로 가져가므로 아래 export에서 그대로 다시 내보낸다.
const { pathsOverlap, normalizeOverlapPath } = pathOverlapMod;
import type { Task } from './execution-contracts';

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
 * 두 task가 같은 시점에 in-flight이면 안 되는지 판정한다. 경로 조상·동일
 * 비교는 path-overlap.pathsOverlap 하나만 쓴다 — 새 규칙을 두면 경로 중첩 규칙과
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

// pathSetOf는 coordinator의 scope 보충·감사 경로도 같은 "충돌 판정용 경로 집합"을
// 써야 해서 함께 내보낸다 — 두 곳이 다른 집합을 보면 scheduler와 감사가 갈라진다.
export = { readyWave, tasksConflict, transition, normalizeOverlapPath, pathSetOf };
