'use strict';

// 에이전트 실행 환경(비DeepSWE 기본 이미지 / DeepSWE 과제 이미지 기반)을 고르고, 실행 전체 시간 예산과
// 컨테이너가 남긴 파일 소유권 복원을 다루는 모듈. 이 파일의 함수는 파일을 읽지 않고 docker도 직접 띄우지 않는다:
// 모든 외부 호출은 주입된 `deps`를 거쳐 단위 테스트가 docker 없이 돈다.

const MS_PER_MINUTE = 60000;

/**
 * 카드와 조건으로 에이전트 서비스·이미지·플러그인 경로를 정한다.
 * `prepared`가 객체이면 DeepSWE 카드로 보고 과제 이미지 위에 얹은 `deepswe-*` 서비스(root 홈)를 쓴다.
 * `null`이면 기존 Node 이미지 서비스(`node` 사용자 홈)를 그대로 쓴다.
 *
 * @param {{ taskId: string, condition: 'vanilla'|'bouncer-full', prepared: object | null }} input - 카드 id, 조건, `loadPrepared` 결과
 * @returns {{ service: string, env: Record<string, string>, imageTag: string, pluginPackageJson: string, deepswe: boolean, deviations: string[] }} 런타임 기술자
 * @throws {Error} `prepared`가 객체인데 `docker_image`가 비었거나 문자열이 아니면 `<taskId>: prepared.json docker_image missing`
 */
function agentRuntime({ taskId, condition, prepared }) {
  const variant = condition === 'bouncer-full' ? 'bouncer' : 'vanilla';
  if (!prepared) {
    return {
      service: variant, env: {}, imageTag: `bouncer-benchmark-cursor-${variant}:local`,
      pluginPackageJson: '/home/node/.cursor/plugins/local/bouncer/package.json', deepswe: false, deviations: [],
    };
  }
  if (typeof prepared.docker_image !== 'string' || !prepared.docker_image) {
    throw new Error(`${taskId}: prepared.json docker_image missing`);
  }
  return {
    service: `deepswe-${variant}`,
    env: { BENCH_TASK_ID: taskId, BENCH_TASK_IMAGE: prepared.docker_image },
    imageTag: `bouncer-benchmark-deepswe-${taskId}-${variant}:local`,
    pluginPackageJson: '/root/.cursor/plugins/local/bouncer/package.json',
    deepswe: true,
    // 과제 이미지에서 에이전트 컨테이너가 네트워크를 쓰는 점이 원 벤치마크와 다르다는 기록.
    deviations: ['agent_network'],
  };
}

/**
 * DeepSWE 컨테이너가 root로 만든 `/workspace` 파일을 호스트 사용자 소유로 되돌린다.
 * 호스트 git 작업이 root 소유 파일에 막히지 않게 하려는 것이며 비DeepSWE 이미지는 이미 호스트 uid로 돌아 할 일이 없다.
 *
 * @param {{ deepswe: boolean, service: string }} runtime - `agentRuntime` 결과
 * @param {{ uid: number, gid: number }} ids - 호스트 사용자 uid·gid
 * @param {{ runCompose: (args: string[]) => string }} deps - `docker compose` 인자를 받아 실행하는 함수
 * @returns {void}
 */
function restoreOwnership(runtime, { uid, gid }, deps) {
  if (!runtime.deepswe) return;
  deps.runCompose(['run', '--rm', '--no-deps', '--entrypoint', 'chown', runtime.service,
    '-R', `${uid}:${gid}`, '/workspace']);
}

/**
 * `fn`이 끝난 뒤(이행·거부 모두) 소유권을 복원한다. 성공·실패·시간 초과와 상관없이 호스트 git 작업 전에 복원돼야 한다.
 * 복원이 `fn`보다 먼저 일어나지 않도록 `await fn()`이 끝난 뒤 `finally`에서만 부른다.
 * `fn`이 거부되면 복원 뒤 같은 오류로 거부한다.
 *
 * @param {object} runtime - `agentRuntime` 결과
 * @param {{ uid: number, gid: number }} ids - 호스트 사용자 uid·gid
 * @param {() => unknown} fn - 컨테이너를 쓰는 작업(동기 값 또는 Promise를 돌려줘도 된다)
 * @param {{ runCompose: (args: string[]) => string }} deps - `restoreOwnership`에 넘기는 주입
 * @returns {Promise<unknown>} `fn`의 결과
 */
async function withOwnershipRestore(runtime, ids, fn, deps) {
  try {
    return await fn();
  } finally {
    restoreOwnership(runtime, ids, deps);
  }
}

/**
 * 실행 전체 wall-clock 예산에서 다음 단계가 쓸 남은 분을 계산한다.
 *
 * @param {{ totalMinutes: number, startedAt: number, now: number }} input - 총 예산(분, 1..240 정수), 시작·현재 시각(ms)
 * @returns {{ minutes: number } | { exhausted: true }} 남은 분(내림)이 1 이상이면 `minutes`, 아니면 `exhausted`
 * @throws {Error} `totalMinutes`가 1..240 정수가 아니면 `invalid timeout`
 */
function stageBudget({ totalMinutes, startedAt, now }) {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 1 || totalMinutes > 240) throw new Error('invalid timeout');
  const minutes = Math.floor((startedAt + totalMinutes * MS_PER_MINUTE - now) / MS_PER_MINUTE);
  return minutes < 1 ? { exhausted: true } : { minutes };
}

/**
 * 단계를 순서대로 돌리되 단계마다 남은 예산을 확인한다.
 * 앞 단계의 `runStage`가 끝난(await) 뒤에만 다음 단계의 예산을 보므로, 단계 안에서 쓴 시간이 다음 판단에 반영된다.
 * 예산이 소진되면 남은 단계를 건너뛴 목록에 넣고 멈춘다(throw하지 않는다).
 *
 * @param {{ stages: string[], totalMinutes: number, startedAt: number, now: () => number, runStage: (name: string, minutes: number) => unknown }} input - 단계 이름, 총 예산, 시작 시각, 시계, 단계 실행기
 * @returns {Promise<{ completed: string[], skipped: string[] }>} 끝낸 단계와 예산 소진으로 건너뛴 단계
 */
async function runStagesWithBudget({ stages, totalMinutes, startedAt, now, runStage }) {
  const completed = [];
  for (const [index, name] of stages.entries()) {
    const budget = stageBudget({ totalMinutes, startedAt, now: now() });
    if (budget.exhausted) return { completed, skipped: stages.slice(index) };
    await runStage(name, budget.minutes);
    completed.push(name);
  }
  return { completed, skipped: [] };
}

/**
 * 실행 레코드에서 프로세스 종료 코드를 정한다.
 * 예산 소진 중단은 의도된 종료라 성공(0)으로 취급하고, 오류로 멈춘 경우만 1이다.
 *
 * @param {{ status?: string, stop_reason?: string }} record - `run.json` 레코드
 * @returns {0 | 1} `finalized` 또는 `budget_exhausted` 중단이면 0, 그 밖에는 1
 */
function exitCodeFor(record) {
  return record.status === 'finalized' || record.stop_reason === 'budget_exhausted' || record.stop_reason === 'stop_after' ? 0 : 1;
}

/**
 * 예산 소진으로 건너뛴 단계가 있을 때 레코드에 펼칠 필드를 만든다.
 * 채점하지 못한 실행이므로 판정 필드를 모두 null로 두어 `sampleEligibility`가 표본에서 빼게 한다.
 *
 * @param {string[]} skipped - 건너뛴 단계 이름
 * @returns {object} 레코드에 펼칠 중단·판정 필드
 */
function budgetStopRecord(skipped) {
  return {
    status: 'stopped', stop_reason: 'budget_exhausted', skipped_stages: skipped,
    judge_status: 'unjudgeable', error: 'budget exhausted', score: null, outcome_success: null, reward: null,
    f2p_passed: null, f2p_total: null, p2p_passed: null, p2p_total: null, apply_failed: null,
  };
}

/**
 * 이미지 태그의 id를 `docker image inspect`로 읽는다.
 *
 * @param {string} tag - 이미지 태그
 * @param {{ runDocker: (args: string[]) => string }} deps - `docker` 인자를 받아 stdout을 돌려주는 함수
 * @returns {string} 이미지 id
 */
function imageIdOf(tag, deps) {
  return deps.runDocker(['image', 'inspect', '--format', '{{.Id}}', tag]).trim();
}

/**
 * `run.json` 최상위에 펼칠 런타임 필드를 만든다. run-cursor와 bouncer-full이 같은 함수를 쓴다.
 *
 * @param {object} runtime - `agentRuntime` 결과
 * @param {{ runDocker: (args: string[]) => string }} deps - `imageIdOf`에 넘기는 주입
 * @returns {{ image_id: string, deviations: string[] }} 이미지 id와 원 벤치마크와의 차이 목록
 */
function runtimeRecordFields(runtime, deps) {
  return { image_id: imageIdOf(runtime.imageTag, deps), deviations: runtime.deviations };
}

module.exports = {
  agentRuntime, restoreOwnership, withOwnershipRestore, stageBudget, runStagesWithBudget, budgetStopRecord,
  exitCodeFor, imageIdOf, runtimeRecordFields,
};
