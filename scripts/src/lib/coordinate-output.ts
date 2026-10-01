'use strict';

type OpenedItem = {
  id: string;
  status: string;
  workerPath?: string;
  branch?: string;
  lease?: unknown;
};

type ResultTask = {
  id?: unknown;
  status?: unknown;
  workerPath?: unknown;
  branch?: unknown;
  lease?: { status?: unknown };
};

/**
 * coordinate 성공 stdout에서 원장 사본을 빼고 prepare에 opened만 남긴다.
 * CLI가 쓰기 직전에 호출한다. lib coordinate() 반환값과 원장 파일은 건드리지
 * 않아 lib 테스트·076 checkpoint 계약을 유지한다.
 *
 * @param {string} command - coordinate 하위 명령. prepare일 때만 opened를 붙인다
 * @param {Record<string, unknown>} result - coordinate() 또는 CLI 거절 payload
 * @returns {Record<string, unknown>} ok가 true가 아니면 같은 참조, 성공이면
 *   tasks·decisions가 없는 얕은 사본(prepare는 opened 추가)
 */
function compactCoordinateOutput(
  command: string,
  result: Record<string, unknown>,
): Record<string, unknown> {
  // 실패는 키·값을 클라이언트가 그대로 파싱해야 하므로 투영하지 않는다.
  if (result.ok !== true) return result;
  const copy: Record<string, unknown> = { ...result };
  delete copy.tasks;
  delete copy.decisions;
  if (command === 'prepare') {
    copy.opened = projectOpened(result);
  }
  return copy;
}

/**
 * 결과 tasks에서 coordinator가 lease해야 하는 항목만 opened로 옮긴다.
 * integrate는 lease를 revoke하지 않으므로 integrated는 상태 조건으로 걸러
 * 앞 wave 완료 task가 계속 들어오지 않게 한다.
 *
 * @param {Record<string, unknown>} result - tasks·ready를 가진 prepare 성공 결과
 * @returns {OpenedItem[]} 원장 순서의 opened 항목
 */
function projectOpened(result: Record<string, unknown>): OpenedItem[] {
  const ready = Array.isArray(result.ready)
    ? result.ready.filter((id): id is string => typeof id === 'string')
    : [];
  const tasks = Array.isArray(result.tasks) ? (result.tasks as ResultTask[]) : [];
  const opened: OpenedItem[] = [];
  for (const task of tasks) {
    if (typeof task.id !== 'string' || typeof task.status !== 'string') continue;
    const inReady = ready.includes(task.id);
    const liveLease = task.status !== 'integrated' && task.lease?.status === 'active';
    if (!inReady && !liveLease) continue;
    const item: OpenedItem = { id: task.id, status: task.status };
    // 검증 task는 lease·worktree가 없다. 키가 있을 때만 옮겨 빈 필드를 만들지 않는다.
    if (task.workerPath !== undefined) item.workerPath = task.workerPath as string;
    if (task.branch !== undefined) item.branch = task.branch as string;
    if (task.lease !== undefined) item.lease = task.lease;
    opened.push(item);
  }
  return opened;
}

export = { compactCoordinateOutput };
