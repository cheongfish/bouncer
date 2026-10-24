'use strict';
import seed = require('./seed-worktree');
import verification = require('./verification');
import type { Exec, VerificationRunner } from './execution-contracts';

/**
 * npm 설치 출력이 coordinator의 stdout 계약을 오염시키지 않도록 stderr로 보낸다.
 *
 * @param {Exec} exec - execFileSync 호환 함수
 * @returns {Exec} 설치 출력을 stderr로 보내는 실행기
 */
function withInstallStdioToStderr(exec: Exec): Exec {
  return (file, args, options) => exec(file, args, { ...options, stdio: ['ignore', 2, 2] });
}

/**
 * 검증 직전 의존성을 준비한다. 호출자는 준비 결과를 중간 판정 뒤에 해석한다.
 *
 * @param {string} repoRoot - 준비할 checkout
 * @param {Exec} exec - 주입 가능한 실행기
 * @returns {ReturnType<typeof seed.prepareDependencies>} 성공 여부와 설치 오류 정보
 */
function prepareVerificationDependencies(repoRoot: string, exec: Exec) {
  return seed.prepareDependencies(repoRoot, { execFileSync: withInstallStdioToStderr(exec) });
}

/**
 * 주입된 runner를 사용하고, 없으면 기본 verification runner를 고른다.
 *
 * @param {VerificationRunner | undefined} injected - 테스트 seam 또는 명시 주입
 * @returns {VerificationRunner} 선택한 runner
 */
function selectVerificationRunner(injected?: VerificationRunner): VerificationRunner {
  return injected || verification.runVerification as VerificationRunner;
}

/**
 * 명시된 task·wave·terminal 대상에 기존 runner를 호출한다.
 *
 * @param {VerificationRunner} runner - 선택된 verification runner
 * @param {Parameters<VerificationRunner>[0]} target - repo, blueprint, task 및 scope
 * @returns {ReturnType<VerificationRunner>} 기존 evidence shape를 포함한 결과
 */
function runTargetVerification(
  runner: VerificationRunner, target: Parameters<VerificationRunner>[0],
): ReturnType<VerificationRunner> {
  return runner(target);
}

export = { withInstallStdioToStderr, prepareVerificationDependencies, selectVerificationRunner, runTargetVerification };
