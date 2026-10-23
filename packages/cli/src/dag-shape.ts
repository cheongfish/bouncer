'use strict';

import executionDag = require('./execution-dag');
const { readyWave, normalizeOverlapPath } = executionDag;
import pathOverlapMod = require('./path-overlap');
const { pathsOverlap } = pathOverlapMod;

type DriveShape = 'serial' | 'parallel' | 'mixed' | 'unknown' | null;

// run-preflight의 WaveTask와 같은 모양이다. 그쪽은 export하지 않는 지역 타입이라
// 구조만 맞춰 두고, 두 모듈이 같은 readyWave 입력을 만들도록 키 이름을 유지한다.
type ShapeTask = {
  id: string;
  depends_on?: string[];
  dependency_gate?: string;
  parallel_safe?: boolean;
  status?: string;
  affected_paths?: string[];
  exclusive_resources?: string[];
  execution_kind: 'commit' | 'verification';
  review_risk: string[];
  open: boolean;
};

type DriveShapeResult = {
  drive_shape: DriveShape;
  max_wave_width: number;
  commit_tasks: number;
  review_risk: string[];
  parallel_safe_tasks: number;
};

/**
 * a의 경로 중 b의 어떤 경로와 겹치는(같거나 조상·자손) 것의 비율을 낸다.
 * 분모는 더 짧은 쪽 길이다 — 작은 task가 큰 task 안에 거의 포함되는 경우를
 * 큰 쪽 크기에 희석되지 않고 드러내기 위해서다. 겹침 판정은 plan gate와 같은
 * validate-sections.pathsOverlap 하나만 쓴다.
 *
 * @param {string[]} a - 한쪽 affected_paths
 * @param {string[]} b - 다른 쪽 affected_paths
 * @returns {number} 0 이상 1 이하 비율. 어느 한쪽이 비면 0
 */
function pathOverlapRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bNorm = b.map(normalizeOverlapPath);
  const hits = a.filter((p) => {
    const norm = normalizeOverlapPath(p);
    return bNorm.some((other) => pathsOverlap(norm, other));
  }).length;
  return Math.min(1, hits / Math.min(a.length, b.length));
}

/**
 * 열린 commit task만으로 prepare와 같은 readyWave 시뮬레이션을 돌려 DAG
 * 모양을 낸다. 순수 함수이며 I/O가 없다.
 *
 * 열려 있지 않은 commit task는 이미 `integrated`로 두어 후속 gate를 통과시키고,
 * verification 노드는 task와 그 노드를 향한 edge를 모두 무시한다 — 노드는 drive
 * 대상이 아니라 마지막 확인 단계다. 선행이 목록에 없으면 그 task는 영영 열리지
 * 않으므로 시뮬레이션이 멈춰 `unknown`이 된다. 종료 보장을 위해 반복은
 * `tasks.length + 1`회로 제한한다.
 *
 * @param {ShapeTask[]} tasks - 문서에서 모은 전체 task(열림 여부 포함)
 * @param {{ maxParallel: number }} opts - 동시 실행 상한. invalid config는 호출자가 1로 접는다
 * @returns {DriveShapeResult} drive_shape와 요약 수치. 열린 commit task가 없으면
 *   drive_shape가 null, 시뮬레이션이 남은 task를 열지 못하면 'unknown'
 */
function analyzeDriveShape(tasks: ShapeTask[], opts: { maxParallel: number }): DriveShapeResult {
  const commits = tasks.filter((task) => task.execution_kind === 'commit');
  const verificationIds = new Set(
    tasks.filter((task) => task.execution_kind !== 'commit').map((task) => task.id),
  );
  const openCommits = commits.filter((task) => task.open);

  // review_risk가 배열이 아닌 문서는 형식 거절이 S30 소관이라 여기서는 빈 위험으로 읽는다.
  const riskSet = new Set<string>();
  for (const task of openCommits) {
    if (Array.isArray(task.review_risk)) {
      for (const risk of task.review_risk) if (typeof risk === 'string') riskSet.add(risk);
    }
  }
  const summary = {
    commit_tasks: openCommits.length,
    review_risk: [...riskSet].sort(),
    parallel_safe_tasks: openCommits.filter((task) => task.parallel_safe === true).length,
  };
  if (openCommits.length === 0) {
    return { drive_shape: null, max_wave_width: 0, ...summary };
  }

  // 시뮬레이션 상태. 열린 task만 pending, 나머지는 선행 gate를 만족하는 integrated.
  const sim = commits.map((task) => ({
    id: task.id,
    depends_on: (task.depends_on || []).filter((dep) => !verificationIds.has(dep)),
    dependency_gate: task.dependency_gate,
    parallel_safe: task.parallel_safe,
    status: task.open ? 'pending' : 'integrated',
    affected_paths: task.affected_paths,
    exclusive_resources: task.exclusive_resources,
  }));

  const widths: number[] = [];
  let remaining = openCommits.length;
  for (let round = 0; remaining > 0; round += 1) {
    const wave = round > tasks.length ? [] : readyWave(sim, { maxParallel: opts.maxParallel });
    if (wave.length === 0) {
      return { drive_shape: 'unknown', max_wave_width: Math.max(0, ...widths), ...summary };
    }
    widths.push(wave.length);
    remaining -= wave.length;
    for (const entry of sim) if (wave.includes(entry.id)) entry.status = 'integrated';
  }

  const maxWidth = Math.max(...widths);
  let shape: DriveShape = 'mixed';
  if (maxWidth === 1) shape = 'serial';
  else if (widths.length === 1) shape = 'parallel';
  return { drive_shape: shape, max_wave_width: maxWidth, ...summary };
}

export = { analyzeDriveShape, pathOverlapRatio };
