'use strict';
const fs = require('node:fs');
const path = require('node:path');
import runtime = require('./runtime-state');
const { runtimePaths, COORDINATOR_LEDGER_REL } = runtime;
import executionDag = require('./execution-dag');
const { taskConflictDetail } = executionDag;
import type { Task } from './execution-contracts';

type DriveTasks = { blueprint: string; ledgerFile: string; tasks: Task[] };
type DriveConflict = {
  blueprint: string; task: string; paths: string[]; resources: string[]; legacy: boolean;
};

/**
 * 저장소의 worktree 원장을 열거해 다른 활성 drive의 시작된 task만 돌려준다.
 * 원장 경로가 존재하는데 읽을 수 없으면 충돌을 놓치지 않도록 해당 경로로 실패한다.
 *
 * @param {object} opts - 저장소와 현재 drive 원장
 * @param {string} opts.repoRoot - main checkout 루트
 * @param {string} opts.ownLedgerFile - 제외할 현재 원장 절대 경로
 * @returns {object} 성공 시 drives, 실패 시 읽을 수 없는 ledgerFile이 포함된 거절
 */
function otherDriveTasks({ repoRoot, ownLedgerFile }: {
  repoRoot: string; ownLedgerFile: string;
}): { ok: true; drives: DriveTasks[] }
  | { ok: false; reason: 'cross-drive-ledger-unreadable'; ledgerFile: string } {
  const roots = runtimePaths({ repoRoot });
  if ('unavailable' in roots) return { ok: true, drives: [] };
  const worktreeRoot = roots.worktreeRoot as string;
  const drives: DriveTasks[] = [];
  let epics: string[];
  try {
    epics = fs.readdirSync(worktreeRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true, drives };
    throw error;
  }
  for (const epic of epics) {
    const epicPath = path.join(worktreeRoot, epic);
    if (!fs.statSync(epicPath).isDirectory()) continue;
    for (const blueprint of fs.readdirSync(epicPath)) {
      const integration = path.join(epicPath, blueprint, 'integration');
      if (!fs.existsSync(integration) || !fs.statSync(integration).isDirectory()) continue;
      const ledgerFile = path.join(integration, ...COORDINATOR_LEDGER_REL.split('/'));
      if (path.resolve(ledgerFile) === path.resolve(ownLedgerFile) || !fs.existsSync(ledgerFile)) continue;
      let ledger: { blueprint?: string; status?: string; tasks?: Task[] };
      try {
        ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
      } catch (_error) {
        // JSON 파싱 오류만 원장 불가로 흡수한다. 충돌 가능성을 누락하지 않게 prepare를 막는다.
        return { ok: false, reason: 'cross-drive-ledger-unreadable', ledgerFile };
      }
      if (!ledger || typeof ledger !== 'object') {
        return { ok: false, reason: 'cross-drive-ledger-unreadable', ledgerFile };
      }
      if (ledger.status === 'detached') continue;
      const tasks = Array.isArray(ledger.tasks)
        ? ledger.tasks.filter((task) => task && task.status !== 'pending') : [];
      drives.push({ blueprint: typeof ledger.blueprint === 'string'
        ? ledger.blueprint : `${epic}/${blueprint}`, ledgerFile, tasks });
    }
  }
  return { ok: true, drives };
}

/**
 * 후보 task 각각을 모든 활성 drive task와 비교해 상대 원장 기준 충돌을 만든다.
 *
 * @param {Task[]} candidates - 이번 prepare wave 후보
 * @param {DriveTasks[]} drives - 다른 원장에서 읽은 task 집합
 * @returns {DriveConflict[]} 충돌 상대별 상세 목록
 */
function crossDriveConflicts(candidates: Task[], drives: DriveTasks[]): DriveConflict[] {
  const conflicts: DriveConflict[] = [];
  for (const candidate of candidates) {
    for (const drive of drives) {
      for (const task of drive.tasks) {
        const detail = taskConflictDetail(candidate, task);
        if (detail) conflicts.push({ blueprint: drive.blueprint, task: task.id,
          paths: detail.paths, resources: detail.resources, legacy: detail.legacy });
      }
    }
  }
  return conflicts;
}

export = { otherDriveTasks, crossDriveConflicts };
