'use strict';
import current = require('./current');
const { resolveEffectiveTask } = current;
import verification = require('./verification');
const {
  selectVerificationEntries,
  readVerifyCommandFor,
  runVerification,
} = verification;
import type { EffectiveTask } from './execution-contracts';

type VerificationDeps = { [key: string]: unknown };
type TaskDocsEntry = {
  rel: string;
  dir?: string | null;
  number?: number | null;
  tasks?: { rel: string };
  verification?: { rel: string };
};

/**
 * 기본 검증 대상을 한 번 해석하고 실행 계층에 넘길 task 목록을 반환한다.
 * lease와 pointer 선택은 current의 책임으로 두어 실행 모듈이 현재 상태에
 * 직접 의존하지 않게 한다.
 *
 * @param {object} opts - 저장소와 선택 옵션
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {string} [opts.taskId] - 명시 task id
 * @param {VerificationDeps} [opts.deps] - effective task 조회 seam
 * @returns {{effectiveTask: EffectiveTask | null, entries: TaskDocsEntry[]}} 선택된 실행 대상
 */
function resolveVerificationTarget({ repoRoot, blueprintDir, taskId, deps }: {
  repoRoot: string; blueprintDir: string; taskId?: string; deps?: VerificationDeps;
}): { effectiveTask: EffectiveTask | null; entries: TaskDocsEntry[] } {
  const effectiveTask = resolveEffectiveTask({ repoRoot, deps: deps as never });
  const entries = selectVerificationEntries(repoRoot, blueprintDir, { taskId, effectiveTask });
  return { effectiveTask, entries };
}

/**
 * 기본 대상을 해석한 뒤 선택된 값만 verification runner에 전달한다.
 *
 * @param {object} opts - 저장소와 실행 옵션
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {boolean} [opts.markTaskVerified] - 성공 시 대상 commit task 승격 여부
 * @param {VerificationDeps} [opts.deps] - effective task 조회 및 실행 seam
 * @returns {ReturnType<typeof runVerification>} 검증 결과
 */
function runSelectedVerification({ repoRoot, blueprintDir, markTaskVerified, deps }: {
  repoRoot: string; blueprintDir: string; markTaskVerified?: boolean; deps?: VerificationDeps;
}): ReturnType<typeof runVerification> {
  const { effectiveTask } = resolveVerificationTarget({ repoRoot, blueprintDir, deps });
  return runVerification({ repoRoot, blueprintDir, effectiveTask, markTaskVerified, deps: deps as never });
}

/**
 * 기본 대상 선택을 포함해 검증 명령을 읽는다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} [blueprintDir] - 선택할 blueprint
 * @param {string} [taskId] - 명시 task id
 * @returns {string} 단일 검증 명령
 */
function readVerifyCommand(repoRoot: string, blueprintDir?: string, taskId?: string): string {
  if (!blueprintDir) return readVerifyCommandFor(repoRoot, []);
  const { entries } = resolveVerificationTarget({ repoRoot, blueprintDir, taskId });
  return readVerifyCommandFor(repoRoot, entries, blueprintDir);
}

export = { resolveVerificationTarget, runSelectedVerification, readVerifyCommand };
