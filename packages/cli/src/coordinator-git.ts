'use strict';
const fs = require('node:fs');
const path = require('node:path');
import type { Exec } from './execution-contracts';

/**
 * @param {Exec} exec - Git 실행기
 * @param {string} cwd - checkout
 * @param {string[]} args - Git 인자
 * @returns {string} trim된 stdout
 */
function git(exec: Exec, cwd: string, args: string[]): string {
  return String(exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim();
}

/**
 * dispatch 직전 porcelain 출력을 원문 그대로 보존한다.
 *
 * @param {Exec} exec - 주입 가능한 Git 실행기
 * @param {string} cwd - worker worktree
 * @returns {string} porcelain=v1 stdout 원문
 */
function initialWorktreeState(exec: Exec, cwd: string): string {
  return String(exec('git', ['status', '--porcelain=v1'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
}

/** @param {Exec} exec - Git 실행기 @param {string} cwd - checkout @returns {string} source porcelain */
function sourceStatus(exec: Exec, cwd: string): string {
  // .worktrees는 bootstrap fixture에서 ignore 규칙이 아직 없어도 source 변경으로 세지 않는다.
  return git(exec, cwd, ['status', '--porcelain']).split('\n')
    .filter((line) => !line.slice(3).startsWith('.worktrees/')).join('\n');
}

/**
 * worker HEAD가 주어진 SHA를 조상으로 갖는지 확인한다.
 *
 * @param {Exec} exec - Git 실행기
 * @param {string} workerPath - 할당된 worker checkout
 * @param {string} sha - 검사할 commit SHA
 * @returns {boolean} 조상이면 true, Git 조회 실패면 false
 */
function workerOwnsSha(exec: Exec, workerPath: string, sha: string): boolean {
  try {
    git(exec, workerPath, ['merge-base', '--is-ancestor', sha, 'HEAD']);
    return true;
  } catch (_error) {
    // 얕은 clone이나 삭제된 object도 안전하게 입증할 수 없어 소유하지 않은 것으로 처리한다.
    return false;
  }
}

/**
 * SHA의 단일 부모를 구한다. merge 또는 Git 조회 실패는 provenance를 추측하지 않고 거절한다.
 *
 * @param {Exec} exec - Git 실행기
 * @param {string} cwd - 할당된 worker checkout
 * @param {string} sha - 검사할 worker HEAD
 * @returns {string | null} 유일한 부모 SHA 또는 null
 */
function directParent(exec: Exec, cwd: string, sha: string): string | null {
  try {
    const fields = git(exec, cwd, ['rev-list', '--parents', '-n', '1', sha]).split(/\s+/);
    return fields.length === 2 ? fields[1] : null;
  } catch (_error) {
    // 존재하지 않는 object와 Git 조회 실패는 모두 provenance를 입증하지 못한다.
    return null;
  }
}

/**
 * worker 경로가 symlink가 아니며 integration 저장소에 등록된 worktree인지 검사한다.
 *
 * @param {Exec} exec - Git 실행기
 * @param {string} integrationPath - integration checkout
 * @param {string} workerPath - 검사할 worker 경로
 * @returns {boolean} 등록된 동일 checkout이면 true
 */
function registeredWorker(exec: Exec, integrationPath: string, workerPath: string): boolean {
  try {
    const canonicalWorker = fs.realpathSync(workerPath);
    if (canonicalWorker !== path.resolve(workerPath)) return false;
    const workerRoot = fs.realpathSync(path.dirname(workerPath));
    const relative = path.relative(workerRoot, canonicalWorker);
    if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
    const registered = git(exec, integrationPath, ['worktree', 'list', '--porcelain'])
      .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
    return registered.some((entry) => fs.realpathSync(entry) === canonicalWorker);
  } catch (_error) {
    // 사라진 경로·Git 조회 실패는 등록을 입증하지 못하므로 false다.
    return false;
  }
}

/**
 * integration 경로가 symlink가 아니며 project 저장소에 등록된 worktree인지 검사한다.
 *
 * @param {Exec} exec - Git 실행기
 * @param {string} repoRoot - project checkout
 * @param {string} integrationPath - 검사할 integration 경로
 * @returns {boolean} 등록된 동일 checkout이면 true
 */
function registeredIntegration(exec: Exec, repoRoot: string, integrationPath: string): boolean {
  try {
    const canonicalIntegration = fs.realpathSync(integrationPath);
    if (canonicalIntegration !== path.resolve(integrationPath)) return false;
    const integrationRoot = fs.realpathSync(path.dirname(integrationPath));
    const relative = path.relative(integrationRoot, canonicalIntegration);
    if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
    const registered = git(exec, repoRoot, ['worktree', 'list', '--porcelain'])
      .split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length));
    return registered.some((entry) => fs.realpathSync(entry) === canonicalIntegration);
  } catch (_error) {
    // 경로나 Git이 유효하지 않으면 integration checkout 소유권을 입증할 수 없다.
    return false;
  }
}

export = {
  git, initialWorktreeState, sourceStatus, workerOwnsSha, directParent, registeredWorker, registeredIntegration,
};
