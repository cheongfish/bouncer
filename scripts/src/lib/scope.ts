// scripts/lib/scope.js
'use strict';
const { epicDirOf, toPosix } = require('./paths');
const { CONTEXT_ROOT, PROJECT_DISTILL, DISTILL_SHARD_DIR } = require('./layout');

// distill.ts는 이 모듈군 밖이라 strict include에 넣지 않는다. 상대 require를
// 그대로 두면 tsc가 그 파일을 편입해 다음 커밋 몫의 오류가 여기로 새어 온다.
// 런타임 경로는 동일하고, 반환 형태만 이 소비 지점이 쓰는 필드에 맞춘다.
const { readShards } = require('./distill') as {
  readShards: (opts: { repoRoot: string }) => {
    sharded?: unknown;
    valid?: unknown;
    shards?: unknown;
  };
};

function isUnder(file: unknown, entry: unknown): boolean {
  const f = toPosix(file);
  const e = toPosix(entry);
  if (f === e) return true;
  const pref = e.endsWith('/') ? e : `${e}/`;
  return f.startsWith(pref);
}

// 빌드 산출물과 runtime state는 Bouncer 관리 scope가 아님: stage하지도
// 위반으로 보고하지도 않아 .gitignore가 없는 repo도 finalize를 막지 않음.
// `bouncer init`은 프로젝트가 무시해야 할 항목을 알려 주며, `--write-gitignore`
// 동의 신호가 있을 때만 마커 블록 안에서 쓴다(기본은 제안만).
// Execute checkout은 `<repo>/.worktrees/<BP-id>` 아래에 있음. 트리 전체를
// ignore하여 finalize가 중첩 worktree 파일을 scope 밖으로 보지 않게 함.
// `.bouncer/.venv/`는 init 설치 산출물 — 범위 위반으로 보고하지 않는다.
const RUNTIME_ARTIFACTS = ['node_modules/', 'graphify-out/', '.worktrees/', '.bouncer/.venv/'];

function isRuntimeArtifact(file: unknown): boolean {
  const f = toPosix(file);
  return RUNTIME_ARTIFACTS.some((entry) => isUnder(f, entry));
}

function registeredDistillShardPaths(repoRoot: unknown): Set<string> {
  if (typeof repoRoot !== 'string' || !repoRoot) return new Set();
  const state = readShards({ repoRoot });
  if (!state.sharded || !state.valid) return new Set();
  // shards는 이 모듈군 밖에서 오므로 원소 형태를 여기서만 읽는다. 배열이
  // 아니면 예전처럼 .map에서 실패하게 두어 호출 계약을 바꾸지 않는다.
  const shards = state.shards as Array<{ path?: unknown } | null | undefined>;
  return new Set(
    shards
      .map((shard) => shard && shard.path)
      .filter((rel: unknown): rel is string => (
        typeof rel === 'string'
        && new RegExp(`^${DISTILL_SHARD_DIR}/[^/]+\\.md$`).test(toPosix(rel))
      )),
  );
}

type AllowedPathsInput = {
  affectedPaths?: unknown;
  blueprintDir: unknown;
};

function makeAllowed({ affectedPaths, blueprintDir }: AllowedPathsInput): (file: unknown) => boolean {
  const bp = toPosix(blueprintDir);
  const epicDir = epicDirOf(bp);
  const paths = Array.isArray(affectedPaths) ? affectedPaths : [];
  return function allowed(file: unknown): boolean {
    const f = toPosix(file);
    if (isUnder(f, `${bp}/`)) return true;
    if (f === `${epicDir}/index.md`) return true;
    if (f === `${CONTEXT_ROOT}/index.md`) return true;
    // Finalize는 promotion으로 project Distill을 항상 갱신; 모든 blueprint의
    // affected_paths에 넣을 필요 없음.
    if (f === PROJECT_DISTILL) return true;
    return paths.some((p: unknown) => isUnder(f, p));
  };
}

// execute/commit 범위는 affected_paths만 권한으로 삼아야 한다. finalize가
// 별도 promotion 단계에서만 이 정책을 확장하도록 함수를 분리해 두면,
// 공용 makeAllowed를 넓혀 일반 task가 샤드를 몰래 커밋하는 회귀를 막는다.
function makeFinalizeAllowed({ repoRoot, affectedPaths, blueprintDir }: {
  repoRoot: unknown;
  affectedPaths?: unknown;
  blueprintDir: unknown;
}): (file: unknown) => boolean {
  const allowed = makeAllowed({ affectedPaths, blueprintDir });
  const registered = registeredDistillShardPaths(repoRoot);
  return function finalizeAllowed(file: unknown): boolean {
    const rel = toPosix(file);
    return allowed(rel) || registered.has(rel);
  };
}

module.exports = {
  isUnder,
  isRuntimeArtifact,
  RUNTIME_ARTIFACTS,
  makeAllowed,
  makeFinalizeAllowed,
  registeredDistillShardPaths,
};
