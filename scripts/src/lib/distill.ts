'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('./frontmatter') as {
  parseFrontmatter: (markdown: string) => { data: unknown; body: string };
};
const { runtimePaths } = require('./runtime-state') as {
  runtimePaths: (opts: { repoRoot: string }) => RuntimeLike;
};
const { DISTILL_INDEX, DISTILL_ROOT } = require('./layout') as {
  DISTILL_INDEX: string;
  DISTILL_ROOT: string;
};
const { toPosix } = require('./paths') as {
  toPosix: (p: unknown) => string;
};

const DISTILL_VERSION = 1;

type RuntimeLike = {
  unavailable?: unknown;
  projectRoot?: unknown;
};

type DistillShard = {
  id: string;
  path: string;
  raw: string;
  body: string;
  content: string;
  always: boolean;
  paths?: Array<string | null>;
  pulls?: string[];
  pathsKnown: boolean;
  pullsKnown: boolean;
  metadata: Record<string, unknown>;
};

type DistillSelection = {
  full: boolean;
  reason: string;
  ids: string[];
  shards: DistillShard[];
};

type DistillRouteInput = DistillShard[] | {
  shards?: DistillShard[];
  repoRoot?: string;
  affectedPaths?: unknown;
  forPaths?: unknown;
  paths?: unknown;
  routingEnabled?: boolean;
  routing_enabled?: boolean;
  config?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRepoRelative(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = toPosix(value).replace(/^\.\//, '').replace(/\/+/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) return null;
  if (normalized.split('/').includes('..')) return null;
  return normalized;
}

function resolveDistillRoot({
  repoRoot,
  runtime,
  runtimePaths: suppliedRuntimePaths,
  paths: suppliedPaths,
}: {
  repoRoot?: string;
  runtime?: RuntimeLike | null;
  runtimePaths?: RuntimeLike | null;
  paths?: RuntimeLike | null;
} = {}) {
  const fallback = repoRoot || process.cwd();
  // Distill.md 파일 존재만 본다. shard 디렉터리나 frontmatter로 고르면
  // 인덱스 폴백 사유(legacyResult)와 기준 경로 선택이 한 판정으로 섞인다.
  if (fs.existsSync(path.join(fallback, DISTILL_INDEX))) {
    return fallback;
  }
  // 세 별칭을 그대로 받는다. 호출자가 runtimePaths/paths만 넘기는데 여기서
  // runtime만 보면 Git 없는 단위 테스트가 조용히 폴백으로 떨어진다.
  const paths = runtime || suppliedRuntimePaths || suppliedPaths || (() => {
    try {
      return runtimePaths({ repoRoot: fallback });
    } catch (_error) {
      return null;
    }
  })();
  // checkout에 Distill이 없을 때만 main worktree로 돌아간다. Git이 없으면
  // unavailable이라 전달받은 root를 유지한다(라이브러리 폴백 계약).
  return paths && !paths.unavailable && typeof paths.projectRoot === 'string'
    ? paths.projectRoot
    : fallback;
}

function asList(value: unknown): unknown[] | null {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value : null;
}

function metadataFrom(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  if (isRecord(value.distill)) return value.distill;
  if (isRecord(value.shard)) return value.shard;
  return value;
}

function declarationEntries(indexMeta: Record<string, unknown>): Array<Record<string, unknown> | null> | null {
  const declarations = indexMeta.shards;
  if (Array.isArray(declarations)) {
    return declarations.map((entry: unknown) => {
      if (typeof entry === 'string') return { id: entry };
      if (!isRecord(entry)) return null;
      return { ...entry, id: entry.id || entry.name || entry.shard };
    });
  }
  if (isRecord(declarations)) {
    return Object.entries(declarations).map(([id, entry]) => (
      isRecord(entry) ? { ...entry, id: entry.id || id } : { id }
    ));
  }
  return null;
}

function shardRelativePath(id: string, declaration: Record<string, unknown>) {
  const candidate = declaration.file || declaration.path || declaration.resource;
  const rel = normalizeRepoRelative(candidate || `${DISTILL_ROOT}/${id}.md`);
  return rel;
}

function readShard(repoRoot: string, declaration: Record<string, unknown>): DistillShard | null {
  const id = typeof declaration.id === 'string' ? declaration.id.trim() : '';
  if (!id || id.includes('/') || id.includes('\\')) return null;
  const rel = shardRelativePath(id, declaration);
  if (!rel) return null;
  const abs = path.join(repoRoot, rel);
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (_error) {
    return null;
  }

  let data: unknown = {};
  let body = raw;
  try {
    const parsed = parseFrontmatter(raw);
    data = parsed.data;
    body = parsed.body;
  } catch (_error) {
    // 샤드 본문은 일반 Markdown일 수 있다. 인덱스 메타데이터가 충분하면
    // frontmatter 부재만으로 전체 저장소를 레거시로 오판하지 않는다.
  }

  const fileMeta = metadataFrom(data);
  const meta = { ...fileMeta, ...declaration };
  const rawPaths = meta.paths;
  const paths = asList(rawPaths);
  const pulls = asList(meta.pulls);
  const normalizedPaths = paths
    ? paths.map(normalizeRepoRelative)
    : undefined;
  const normalizedPulls = pulls
    ? pulls.filter((entry) => typeof entry === 'string').map((entry) => entry.trim())
    : undefined;

  return {
    id,
    path: rel,
    raw,
    body,
    content: body,
    always: meta.always === true,
    paths: normalizedPaths,
    pulls: normalizedPulls,
    // 구조 validator가 별도로 누락을 보고하더라도 라우터는 이 신호를 보고
    // 선택 결과를 만들지 않는다. 누락을 빈 배열로 바꾸면 규칙을 잃는다.
    // asList(array)는 입력을 그대로 돌려주므로 rawPaths가 배열이면
    // normalizedPaths/normalizedPulls는 항상 있다 — ! 는 그 불변식만 적는다.
    pathsKnown: rawPaths === undefined
      || (Array.isArray(rawPaths) && normalizedPaths!.every(Boolean)),
    pullsKnown: Array.isArray(pulls) && normalizedPulls!.length === pulls.length,
    metadata: meta,
  };
}

function legacyResult(repoRoot: string, content: string, reason: string) {
  return {
    mode: 'legacy',
    valid: false,
    sharded: false,
    fallback: true,
    path: DISTILL_INDEX,
    content,
    body: content,
    shards: [],
    ids: [],
    reason,
    repoRoot,
  };
}

/**
 * Project Distill 인덱스와 등록된 샤드를 읽는다.
 * 인덱스가 없거나 일부 샤드를 읽지 못하면 인덱스 요약만 선택 소비하는
 * 위험을 피하기 위해 원래 단일 파일을 그대로 반환한다.
 */
function readShards({
  repoRoot,
  paths: suppliedPaths,
  runtime,
  runtimePaths: suppliedRuntimePaths,
}: {
  repoRoot?: string;
  paths?: RuntimeLike | null;
  runtime?: RuntimeLike | null;
  runtimePaths?: RuntimeLike | null;
} = {}) {
  const root = resolveDistillRoot({
    repoRoot,
    runtime,
    runtimePaths: suppliedRuntimePaths,
    paths: suppliedPaths,
  });
  const indexAbs = path.join(root, DISTILL_INDEX);
  let raw;
  try {
    raw = fs.readFileSync(indexAbs, 'utf8');
  } catch (_error) {
    return legacyResult(root, '', 'index-missing');
  }

  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch (_error) {
    return legacyResult(root, raw, 'index-frontmatter-invalid');
  }
  const indexMeta = metadataFrom(parsed.data);
  if (indexMeta.version !== DISTILL_VERSION) {
    return legacyResult(root, raw, 'index-version-invalid');
  }
  const declarations = declarationEntries(indexMeta);
  if (!declarations || declarations.length === 0 || declarations.some((entry) => !entry)) {
    return legacyResult(root, raw, 'index-shards-invalid');
  }

  const shards = declarations.map((declaration) => readShard(root, declaration as Record<string, unknown>));
  const ids = shards.map((entry) => entry && entry.id);
  if (
    shards.some((entry) => !entry)
    || ids.some((id) => !id)
    || new Set(ids).size !== ids.length
  ) {
    return legacyResult(root, raw, 'shard-unreadable');
  }

  const routingEnabled = indexMeta.routing_enabled === true
    || indexMeta.routingEnabled === true;
  return {
    mode: 'sharded',
    valid: true,
    sharded: true,
    fallback: false,
    path: DISTILL_INDEX,
    index: raw,
    indexBody: parsed.body,
    repoRoot: root,
    routingEnabled,
    routing_enabled: routingEnabled,
    shards,
    ids,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globRegExp(pattern: string) {
  let source = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*' && pattern[i + 1] === '*') {
      i += 1;
      if (pattern[i + 1] === '/') {
        i += 1;
        source += '(?:.*/)?';
      } else {
        source += '.*';
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`${source}/?$`);
}

function matchesGlob(pattern: string, value: string) {
  try {
    return globRegExp(pattern).test(value);
  } catch (_error) {
    return false;
  }
}

function isUnderPath(file: string, directory: string) {
  return file === directory || file.startsWith(`${directory}/`);
}

function pathMayIntersect(repoRoot: string, patternValue: unknown, targetValue: unknown) {
  const pattern = normalizeRepoRelative(patternValue);
  const target = normalizeRepoRelative(targetValue);
  if (!pattern || !target) return true;
  if (matchesGlob(pattern, target) || isUnderPath(target, pattern) || isUnderPath(pattern, target)) {
    return true;
  }

  // `scripts/**`는 디렉터리 자체가 glob과 일치하지 않아도 그 하위가
  // 일치한다. 실제 stat을 먼저 쓰고, 판별할 수 없으면 보수적으로 포함한다.
  let targetIsDirectory = false;
  let targetKnown = true;
  try {
    targetIsDirectory = fs.statSync(path.join(repoRoot, target)).isDirectory();
  } catch (_error) {
    targetKnown = false;
  }
  if (targetIsDirectory && matchesGlob(pattern, `${target}/__bouncer_probe__`)) return true;
  const wildcard = pattern.search(/[?*]/);
  if (wildcard !== -1) {
    const staticPrefix = pattern.slice(0, wildcard).replace(/\/$/, '');
    // 대상이 아직 생성되지 않았더라도 정적 접두사가 서로 갈라지면
    // 디렉터리로 해석할 여지가 없다. 반대로 접두사 경계가 겹치면 stat
    // 실패를 포함으로 접어 새 파일이 생기는 경우의 누락을 막는다.
    if (staticPrefix && (target === staticPrefix || isUnderPath(target, staticPrefix))) return true;
    if (staticPrefix && isUnderPath(staticPrefix, target)) return true;
    return false;
  }
  return targetKnown ? false : true;
}

function allSelection(shards: DistillShard[], reason: string): DistillSelection {
  const list = Array.isArray(shards) ? shards : [];
  return {
    full: true,
    reason,
    ids: list.map((shard) => shard.id),
    shards: list.slice(),
  };
}

function routingFlag(options: Exclude<DistillRouteInput, DistillShard[]>) {
  if (typeof options.routingEnabled === 'boolean') return options.routingEnabled;
  if (typeof options.routing_enabled === 'boolean') return options.routing_enabled;
  const config = options.config;
  if (isRecord(config) && isRecord(config.distill)) {
    return config.distill.routing_enabled === true || config.distill.routingEnabled === true;
  }
  return false;
}

/**
 * affected paths에 대한 샤드 선택. 경로를 확정할 수 없는 경우와 매칭 0은
 * 모두 전량 결과다. 이 함수는 "관련 없어 보이는 규칙"을 제거하는 최적화가
 * 아니라, 명백히 관련된 규칙을 추가하는 보수적 라우터로만 동작한다.
 */
function routeShards(options: DistillRouteInput = {}) {
  const input = Array.isArray(options) ? { shards: options } : options;
  const shards: DistillShard[] = Array.isArray(input.shards) ? input.shards : [];
  const repoRoot = input.repoRoot || process.cwd();
  const affected = input.affectedPaths || input.forPaths || input.paths;
  if (!routingFlag(input)) return allSelection(shards, 'routing-disabled');
  if (!Array.isArray(affected) || affected.length === 0) return allSelection(shards, 'paths-unknown');

  const selected = new Set<string>();
  let matchedPath = false;
  for (const shard of shards) {
    if (!shard || typeof shard.id !== 'string') return allSelection(shards, 'shard-invalid');
    if (shard.always === true) selected.add(shard.id);
    const pathsMissing = !Array.isArray(shard.paths) || shard.paths.length === 0;
    const pathsUncertain = shard.pathsKnown === false
      || (pathsMissing && shard.always !== true)
      || (Array.isArray(shard.paths) && shard.paths.some((entry) => !entry));
    if (pathsUncertain) {
      // always는 선택을 강제할 뿐 경로 선언의 불확실성을 해소하지 않는다.
      // 이를 건너뛰면 always 샤드와 일부 매칭 샤드만 남아, 원문 전체를 보존해야
      // 하는 fail-open 계약이 부분 라우팅으로 바뀐다.
      return allSelection(shards, 'shard-paths-unknown');
    }
    if (pathsMissing) continue;
    if (affected.some((target) => shard.paths!.some((pattern) => (
      pathMayIntersect(repoRoot, pattern, target)
    )))) {
      matchedPath = true;
      selected.add(shard.id);
    }
  }

  if (!matchedPath) return allSelection(shards, 'no-match');

  const byId = new Map<string, DistillShard>(shards.map((shard) => [shard.id, shard]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function close(id: string) {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    const shard = byId.get(id);
    if (!shard || !Array.isArray(shard.pulls)) return false;
    visiting.add(id);
    for (const pull of shard.pulls) {
      if (typeof pull !== 'string' || !byId.has(pull) || !close(pull)) return false;
      selected.add(pull);
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  }
  for (const id of Array.from(selected)) {
    const shard = byId.get(id);
    // pullsKnown이 false인 샤드는 빈 배열로 추측하지 않는다. 전량 결과가
    // 기존 단일 Distill을 보존하는 유일한 안전한 선택이다.
    if (!shard || shard.pullsKnown === false || !close(id)) {
      return allSelection(shards, 'pulls-uncertain');
    }
  }

  const result = shards.filter((shard) => selected.has(shard.id));
  return {
    full: false,
    reason: 'matched',
    ids: result.map((shard) => shard.id),
    shards: result,
  };
}

function renderShards(input: {
  mode?: string;
  fallback?: boolean;
  content?: string;
  shards?: DistillShard[];
  selection?: DistillSelection;
} | null | undefined, suppliedSelection?: DistillSelection) {
  const state = input || {};
  if (state.mode === 'legacy' || state.fallback === true) return state.content || '';
  const shards = Array.isArray(state.shards) ? state.shards : [];
  const selection = suppliedSelection || state.selection;
  const selectedIds = selection && Array.isArray(selection.ids) ? new Set(selection.ids) : null;
  const chosen = selectedIds
    ? shards.filter((shard) => selectedIds.has(shard.id))
    : shards;
  return chosen.map((shard) => shard.body || shard.content || '').filter(Boolean).join('\n\n');
}

module.exports = {
  DISTILL_VERSION,
  resolveDistillRoot,
  readShards,
  routeShards,
  renderShards,
  matchesGlob,
  pathMayIntersect,
};
