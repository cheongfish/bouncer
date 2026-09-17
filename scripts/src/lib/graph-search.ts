'use strict';

const fs = require('node:fs');
const path = require('node:path');
import graphScope = require('./graph-scope');
const {
  DEFAULT_SOURCE_OUT,
  DEFAULT_TEST_OUT,
  realExcludeDirs,
} = graphScope;
// 점수표는 Task 003·평가 corpus가 같은 숫자를 재사용하므로 상수로 고정한다.
// contextHit(+4)는 문서 seed 폭증·저신뢰 유발로 제거했다(TASKS-002).
const SCORE = {
  uniqueSeedDefinition: 5,
  implementationPath: 3,
  relationEdge: 2,
  connectedTest: 1,
  genericNameOnly: -4,
  testOnlyUnlinked: -5,
  excludedPath: -5,
  containsOnly: -3,
} as const;

const ROLE_PRIORITY = {
  implementation: 0,
  test: 1,
} as const;

/** 역할별·전체 후보 상한. cap 초과 탐색은 ranked로 위장하지 않는다. */
const MAX_CANDIDATES_PER_ROLE = 3;
const MAX_CANDIDATES_TOTAL = 8;
/** seed 하나가 건드릴 수 있는 파일 수. 초과 시 seed.fanout_cap → low-confidence. */
const MAX_FILES_PER_SEED = 8;
/** seed 하나 BFS가 방문할 수 있는 노드 수. 초과 시 traversal.frontier_cap. */
const MAX_FRONTIER_PER_SEED = 32;
const MAX_DEPTH = 2;
/** 기본 응답에 남기는 implementation 최소 점수(medium 경계와 동일). */
const IMPLEMENTATION_SCORE_THRESHOLD = 4;

type Role = keyof typeof ROLE_PRIORITY;
type Confidence = 'high' | 'medium' | 'low';
type Status = 'ranked' | 'low-confidence' | 'unavailable';

/** 기본 candidate basis — 폐쇄형 enum, 각 값 ≤24 ASCII. */
const COMPACT_BASIS = {
  seedUnique: 'seed.unique',
  seedPath: 'seed.path',
  seedMatch: 'seed.match',
  relCalls: 'rel.calls',
  relImports: 'rel.imports',
  relImportsFrom: 'rel.imports_from',
  roleImplementation: 'role.implementation',
  testConnected: 'test.connected',
  reachContainsOnly: 'reach.contains_only',
  graphEvidence: 'graph.evidence',
} as const;

type CompactBasisCode = (typeof COMPACT_BASIS)[keyof typeof COMPACT_BASIS];

/** 기본 reasons — 폐쇄형 enum. 동적 설명은 debug에만 둔다. */
const REASON = {
  ranked: 'result.ranked',
  sourceUnavailable: 'source.unavailable',
  sourceOmitted: 'source.omitted',
  testUnavailable: 'test.unavailable',
  testOmitted: 'test.omitted',
  excludeSkipped: 'exclude.skipped',
  seedGenericOnly: 'seed.generic_only',
  seedFanoutCap: 'seed.fanout_cap',
  frontierCap: 'traversal.frontier_cap',
  implementationNone: 'implementation.none',
  implementationLowOnly: 'implementation.low_only',
} as const;

type ReasonCode = (typeof REASON)[keyof typeof REASON];

type CompactCandidate = {
  path: string;
  role: Role;
  score: number;
  basis: CompactBasisCode[];
};

type DetailedCandidate = {
  path: string;
  role: Role;
  score: number;
  confidence: Confidence;
  basis: string[];
};

type TraversalDebug = {
  max_depth: number;
  max_files_per_seed: number;
  max_frontier_per_seed: number;
  seeds_used: string[];
  seeds_dropped_generic: string[];
  fanout_capped: boolean;
  frontier_capped: boolean;
  files_touched: number;
};

type GraphSuggestDebug = {
  candidates: {
    implementation: DetailedCandidate[];
    test: DetailedCandidate[];
  };
  reasons: string[];
  omissions: string[];
  traversal: TraversalDebug;
};

type GraphSuggestResult = {
  status: Status;
  confidence: Confidence;
  candidates: {
    implementation: CompactCandidate[];
    test: CompactCandidate[];
  };
  suggested_paths: string[];
  reasons: ReasonCode[];
  debug?: GraphSuggestDebug;
};

type GraphNode = {
  id: string;
  label: string;
  norm_label?: string;
  source_file?: string;
};

type GraphLink = {
  relation: string;
  source: string;
  target: string;
  source_file?: string;
};

type LoadedGraph = {
  nodes: GraphNode[];
  links: GraphLink[];
  byId: Map<string, GraphNode>;
  // label(lower) → nodes
  byLabel: Map<string, GraphNode[]>;
  omissions: string[];
};

type ReachFlags = {
  uniqueDef?: boolean;
  relation?: boolean;
  containsOnly?: boolean;
  genericOnly?: boolean;
  linkedTest?: boolean;
  unlinkedTest?: boolean;
  excluded?: boolean;
  /** 관계별 compact basis 투영용. */
  relCalls?: boolean;
  relImports?: boolean;
  relImportsFrom?: boolean;
  seedPath?: boolean;
  seedMatch?: boolean;
};

type FileAcc = {
  path: string;
  role: Role;
  flags: ReachFlags;
  /** debug용 사람 읽기 근거. compact는 flags에서 투영한다. */
  detailBasis: Set<string>;
};

// contains는 소유 확인에만 쓰고 BFS 확장 관계에서는 뺀다.
const EXPAND_RELATIONS = new Set(['calls', 'imports', 'imports_from']);
const KNOWN_RELATIONS = new Set(['contains', 'calls', 'imports', 'imports_from']);

// 단독 seed로 쓰면 테스트 편향을 키우는 일반 명사. 심볼 고유성과 별개로 막는다.
const GENERIC_WORDS = new Set([
  'plan', 'test', 'assert', 'result', 'hook', 'gate', 'file', 'path', 'repo',
  'code', 'data', 'item', 'value', 'type', 'name', 'node', 'link', 'graph',
  'query', 'seed', 'run', 'call', 'import', 'module', 'index', 'main', 'util',
  'helper', 'config', 'option', 'error', 'status', 'state', 'context', 'source',
]);

function toPosix(p: string): string {
  return p.split('\\').join('/');
}

// Graphify는 함수 노드 label을 `setupGraphify()`처럼 후행 괄호로 쓰고, tokenize는
// 괄호를 구분자로 잘라 `setupGraphify`만 seed로 남긴다. 원본 label·norm_label·
// graphSuggest 결과의 path/score/confidence는 그대로 두고, byLabel 색인·조회
// 키에서만 맞춰 두 표기가 같은 버킷을 보게 한다. 괄호 제거를 trim보다 먼저 해야
// `foo ()`가 `foo`와 같은 키가 된다. 빈 키는 색인·조회하지 않는다.
function lookupKey(value: unknown): string {
  return String(value || '').toLowerCase().replace(/\(\)$/, '').trim();
}

/**
 * 후보 점수 → 파일 신뢰도. 3/4·7/8 경계는 Task 003이 그대로 소비한다.
 *
 * @param {number} score - 합산 점수
 * @returns {Confidence} high|medium|low
 */
function scoreConfidence(score: number): Confidence {
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function isSafeRepoRelative(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  const posix = toPosix(value);
  if (path.isAbsolute(value) || path.isAbsolute(posix)) return false;
  if (posix.startsWith('/') || /^[A-Za-z]:/.test(posix)) return false;
  if (posix.split('/').includes('..')) return false;
  return true;
}

function matchesPrefix(filePath: string, prefixes: string[]): boolean {
  const posix = toPosix(filePath);
  return prefixes.some((raw) => {
    const pref = toPosix(raw).replace(/\/+$/, '');
    if (!pref) return false;
    return posix === pref || posix.startsWith(`${pref}/`);
  });
}

/**
 * 질의 문자열을 seed 토큰으로 분해한다. 내용은 지시가 아니라 문자열 토큰만 본다.
 *
 * @param {string} text - --query 값
 * @returns {string[]} 길이 2 이상 토큰
 */
function tokenize(text: string): string[] {
  return String(text)
    .split(/[^A-Za-z0-9_./-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * path seed는 generic 단어 필터로 버리지 않는다. `/` 또는 확장자처럼 보이면 path.
 *
 * @param {string} seed
 * @returns {boolean}
 */
function isPathSeed(seed: string): boolean {
  return seed.includes('/') || /\.[A-Za-z0-9]+$/.test(seed);
}

function isGenericWord(seed: string): boolean {
  return GENERIC_WORDS.has(seed.toLowerCase());
}

/**
 * label seed에서 generic을 제거하고 path seed는 보존한다.
 *
 * @param {string[]} rawSeeds - query token + 명시 seed
 * @returns {{ kept: string[], droppedGeneric: string[] }}
 */
function prepareSeeds(rawSeeds: string[]): { kept: string[]; droppedGeneric: string[] } {
  const kept: string[] = [];
  const droppedGeneric: string[] = [];
  const seen = new Set<string>();
  for (const seed of rawSeeds) {
    if (!seed || seen.has(seed)) continue;
    seen.add(seed);
    if (!isPathSeed(seed) && isGenericWord(seed)) {
      droppedGeneric.push(seed);
      continue;
    }
    kept.push(seed);
  }
  // 결정성: 입력 순서를 버리고 동일 집합이면 같은 순회가 되게 정렬한다.
  kept.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { kept, droppedGeneric };
}

function emptyResult(
  status: Status,
  confidence: Confidence,
  reasons: ReasonCode[],
  debug?: GraphSuggestDebug,
): GraphSuggestResult {
  const result: GraphSuggestResult = {
    status,
    confidence,
    candidates: { implementation: [], test: [] },
    suggested_paths: [],
    reasons: reasons.length > 0 ? uniqueReasons(reasons) : [REASON.implementationNone],
  };
  if (debug) result.debug = debug;
  return result;
}

function uniqueReasons(codes: ReasonCode[]): ReasonCode[] {
  const out: ReasonCode[] = [];
  const seen = new Set<ReasonCode>();
  for (const c of codes) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/**
 * graph.json을 관대하게 읽는다. 손상·알 수 없는 관계는 버리고 omissions에 남긴다.
 *
 * @param {string} absPath - graph.json 절대 경로
 * @returns {{ graph: LoadedGraph | null, reason?: string }}
 */
function loadGraphFile(absPath: string): { graph: LoadedGraph | null; reason?: string } {
  if (!fs.existsSync(absPath)) {
    return { graph: null, reason: `missing ${toPosix(absPath)}` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { graph: null, reason: `unreadable JSON: ${msg}` };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { graph: null, reason: 'graph root is not an object' };
  }
  const root = raw as Record<string, unknown>;
  const omissions: string[] = [];
  const nodes: GraphNode[] = [];
  const byId = new Map<string, GraphNode>();
  const byLabel = new Map<string, GraphNode[]>();

  const rawNodes = Array.isArray(root.nodes) ? root.nodes : [];
  for (const entry of rawNodes) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      omissions.push('skipped invalid node entry');
      continue;
    }
    const n = entry as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.id) {
      omissions.push('skipped node without id');
      continue;
    }
    const label = typeof n.label === 'string' ? n.label : '';
    const source_file = typeof n.source_file === 'string' ? n.source_file : undefined;
    const node: GraphNode = {
      id: n.id,
      label,
      source_file,
    };
    if (typeof n.norm_label === 'string') node.norm_label = n.norm_label;
    nodes.push(node);
    byId.set(node.id, node);
    if (label) {
      const key = lookupKey(label);
      if (!key) continue;
      const list = byLabel.get(key) || [];
      list.push(node);
      byLabel.set(key, list);
    }
  }

  // label 버킷·nodes 순회를 id 오름차순으로 고정해 입력 배열 순서 독립성을 만든다.
  for (const [key, list] of byLabel) {
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    byLabel.set(key, list);
  }
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const links: GraphLink[] = [];
  const rawLinks = Array.isArray(root.links) ? root.links : [];
  for (const entry of rawLinks) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      omissions.push('skipped invalid link entry');
      continue;
    }
    const l = entry as Record<string, unknown>;
    if (typeof l.source !== 'string' || typeof l.target !== 'string') {
      omissions.push('skipped link without source/target');
      continue;
    }
    const relation = typeof l.relation === 'string' ? l.relation : '';
    if (!KNOWN_RELATIONS.has(relation)) {
      omissions.push(`skipped unknown relation: ${relation || '(empty)'}`);
      continue;
    }
    // 엔드포인트가 없어도 링크를 기록해 두되 확장은 byId 조회로 자연 스킵한다.
    links.push({
      relation,
      source: l.source,
      target: l.target,
      source_file: typeof l.source_file === 'string' ? l.source_file : undefined,
    });
  }
  links.sort((a, b) => {
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    if (a.target !== b.target) return a.target < b.target ? -1 : 1;
    if (a.relation !== b.relation) return a.relation < b.relation ? -1 : 1;
    return 0;
  });

  return { graph: { nodes, links, byId, byLabel, omissions } };
}

function labelFiles(
  graph: LoadedGraph,
  label: string,
  excludeDirs: string[] = [],
): Set<string> {
  const files = new Set<string>();
  for (const n of graph.byLabel.get(lookupKey(label)) || []) {
    if (!n.source_file || !isSafeRepoRelative(n.source_file)) continue;
    const posix = toPosix(n.source_file);
    // exclude·graphify-out 아래 중복은 고유성 판정에서 무시한다.
    if (posix.startsWith('graphify-out/')) continue;
    if (excludeDirs.length > 0 && matchesPrefix(posix, excludeDirs)) continue;
    files.add(posix);
  }
  return files;
}

function isUniqueSeed(
  graph: LoadedGraph,
  seed: string,
  excludeDirs: string[] = [],
): boolean {
  // 일반 명사는 파일 하나뿐이라도 고유 seed로 승격하지 않는다.
  if (GENERIC_WORDS.has(seed.toLowerCase())) return false;
  return labelFiles(graph, seed, excludeDirs).size === 1;
}

function isRepeatedSeed(
  graph: LoadedGraph,
  seed: string,
  excludeDirs: string[] = [],
): boolean {
  return labelFiles(graph, seed, excludeDirs).size >= 2;
}

/**
 * 관계 인접 리스트. contains는 소유 조회용으로만 따로 둔다.
 * 이웃은 id·relation 오름차순으로 정렬해 link 입력 순서가 queue에 남지 않게 한다.
 *
 * @param {LoadedGraph} graph
 * @returns {{ expand: Map<string, { id: string, relation: string }[]>, ownedBy: Map<string, string[]> }}
 */
function buildAdjacency(graph: LoadedGraph) {
  const expand = new Map<string, { id: string; relation: string }[]>();
  const ownedBy = new Map<string, string[]>(); // symbolId → file node ids that contain it
  const addExpand = (a: string, b: string, relation: string) => {
    const list = expand.get(a) || [];
    list.push({ id: b, relation });
    expand.set(a, list);
  };
  for (const link of graph.links) {
    if (link.relation === 'contains') {
      const list = ownedBy.get(link.target) || [];
      list.push(link.source);
      ownedBy.set(link.target, list);
      continue;
    }
    if (!EXPAND_RELATIONS.has(link.relation)) continue;
    addExpand(link.source, link.target, link.relation);
    addExpand(link.target, link.source, link.relation);
  }
  for (const [id, list] of expand) {
    list.sort((a, b) => {
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      return a.relation < b.relation ? -1 : a.relation > b.relation ? 1 : 0;
    });
    expand.set(id, list);
  }
  for (const [id, list] of ownedBy) {
    list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    ownedBy.set(id, list);
  }
  return { expand, ownedBy };
}

function ensureFile(
  map: Map<string, FileAcc>,
  filePath: string,
  role: Role,
): FileAcc | null {
  const posix = toPosix(filePath);
  if (!isSafeRepoRelative(posix)) return null;
  if (posix === 'graphify-out' || posix.startsWith('graphify-out/')) return null;
  let acc = map.get(posix);
  if (!acc) {
    acc = { path: posix, role, flags: {}, detailBasis: new Set() };
    map.set(posix, acc);
  }
  return acc;
}

type ExpandBudget = {
  fanoutCapped: boolean;
  frontierCapped: boolean;
};

/**
 * seed마다 정렬된 시작 노드·인접으로 calls/imports/imports_from 만 depth≤2 확장한다.
 * seed별 file fan-out·frontier 예산을 넘기면 해당 플래그만 세우고 계속하지 않는다.
 *
 * @param {LoadedGraph} graph
 * @param {string[]} seedLabels - prepareSeeds를 거친 kept seed
 * @param {Role} role
 * @param {Map<string, FileAcc>} files
 * @param {{ excludeDirs?: string[] }} opts
 * @returns {{ hitLabels: Set<string>, startNodes: number, budget: ExpandBudget }}
 */
function expandFromSeeds(
  graph: LoadedGraph,
  seedLabels: string[],
  role: Role,
  files: Map<string, FileAcc>,
  opts: { excludeDirs?: string[] } = {},
): { hitLabels: Set<string>; startNodes: number; budget: ExpandBudget } {
  const excludeDirs = opts.excludeDirs || [];
  const { expand, ownedBy } = buildAdjacency(graph);
  const hitLabels = new Set<string>();
  let startNodes = 0;
  const budget: ExpandBudget = { fanoutCapped: false, frontierCapped: false };

  for (const seed of seedLabels) {
    const seedFiles = new Set<string>();
    const startIds = new Set<string>();
    const labelNodes = [...(graph.byLabel.get(lookupKey(seed)) || [])];
    // path seed와 label seed를 같은 seed 예산으로 묶는다.
    for (const node of labelNodes) {
      // 제외 경로에만 있는 라벨 히트는 seed로 쓰지 않는다.
      if (
        node.source_file
        && excludeDirs.length > 0
        && matchesPrefix(toPosix(node.source_file), excludeDirs)
      ) {
        continue;
      }
      startIds.add(node.id);
      hitLabels.add(seed);
      const unique = isUniqueSeed(graph, seed, excludeDirs);
      const genericWord = isGenericWord(seed);
      const repeated = isRepeatedSeed(graph, seed, excludeDirs);

      // 정확 seed의 소유 파일만 contains로 확인 — 형제 심볼로 BFS하지 않는다.
      const owners = ownedBy.get(node.id) || [];
      const ownerFiles: { id?: string; path: string }[] = [];
      if (owners.length > 0) {
        for (const ownerId of owners) {
          const owner = graph.byId.get(ownerId);
          if (owner && owner.source_file) {
            ownerFiles.push({ id: ownerId, path: owner.source_file });
            // 파일 노드에서도 관계 BFS를 시작해야 imports 이웃을 놓치지 않는다.
            startIds.add(ownerId);
          }
        }
      } else if (node.source_file) {
        ownerFiles.push({ path: node.source_file });
      }
      for (const owner of ownerFiles) {
        const posix = toPosix(owner.path);
        if (seedFiles.size >= MAX_FILES_PER_SEED && !seedFiles.has(posix)) {
          budget.fanoutCapped = true;
          continue;
        }
        const acc = ensureFile(files, owner.path, role);
        if (!acc) continue;
        seedFiles.add(posix);
        // 소유 확인은 contains 엣지다. 관계 BFS로 다시 닿기 전까지 contains-only로 둔다.
        if (owners.length > 0) {
          acc.flags.containsOnly = true;
        }
        // 고유 정의 가산은 구현 그래프에만 적용 — 테스트 라벨 일치로 +5가 되면 안 된다.
        if (role === 'implementation' && unique) {
          acc.flags.uniqueDef = true;
          acc.detailBasis.add(`defines unique seed ${seed}`);
        } else if (genericWord || repeated) {
          acc.flags.genericOnly = true;
          acc.flags.seedMatch = true;
          acc.detailBasis.add(`generic name match for ${seed}`);
        } else {
          acc.flags.seedMatch = true;
          acc.detailBasis.add(`seed match ${seed}`);
        }
      }
    }

    // 경로 seed: source_file 정확·접미사 일치 — nodes는 load 시 id 정렬됨.
    for (const node of graph.nodes) {
      if (!node.source_file) continue;
      const sf = toPosix(node.source_file);
      if (excludeDirs.length > 0 && matchesPrefix(sf, excludeDirs)) continue;
      if (sf === seed || sf.endsWith(`/${seed}`)) {
        if (seedFiles.size >= MAX_FILES_PER_SEED && !seedFiles.has(sf)) {
          budget.fanoutCapped = true;
          continue;
        }
        const acc = ensureFile(files, sf, role);
        if (!acc) continue;
        hitLabels.add(seed);
        seedFiles.add(sf);
        acc.flags.seedPath = true;
        acc.detailBasis.add(`path seed ${seed}`);
        startIds.add(node.id);
      }
    }

    const sortedStarts = [...startIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    startNodes += sortedStarts.length;

    // seed별 BFS — frontier는 방문 노드 수, fan-out은 이 seed가 연 파일 수.
    const visited = new Map<string, number>();
    const queue: { id: string; depth: number }[] = [];
    for (const id of sortedStarts) {
      if (visited.size >= MAX_FRONTIER_PER_SEED) {
        budget.frontierCapped = true;
        break;
      }
      visited.set(id, 0);
      queue.push({ id, depth: 0 });
    }

    while (queue.length > 0) {
      if (budget.fanoutCapped || budget.frontierCapped) break;
      const cur = queue.shift()!;
      if (cur.depth >= MAX_DEPTH) continue;
      for (const next of expand.get(cur.id) || []) {
        const prev = visited.get(next.id);
        const nextDepth = cur.depth + 1;
        if (prev !== undefined && prev <= nextDepth) continue;
        if (visited.size >= MAX_FRONTIER_PER_SEED && !visited.has(next.id)) {
          budget.frontierCapped = true;
          break;
        }
        visited.set(next.id, nextDepth);
        queue.push({ id: next.id, depth: nextDepth });
        const node = graph.byId.get(next.id);
        if (!node || !node.source_file) continue;
        if (excludeDirs.length > 0 && matchesPrefix(toPosix(node.source_file), excludeDirs)) {
          continue;
        }
        const posix = toPosix(node.source_file);
        if (seedFiles.size >= MAX_FILES_PER_SEED && !seedFiles.has(posix)) {
          budget.fanoutCapped = true;
          break;
        }
        const acc = ensureFile(files, node.source_file, role);
        if (!acc) continue;
        seedFiles.add(posix);
        acc.flags.relation = true;
        // calls/imports로 닿으면 contains-only 감점을 걷는다.
        acc.flags.containsOnly = false;
        if (next.relation === 'calls') acc.flags.relCalls = true;
        else if (next.relation === 'imports') acc.flags.relImports = true;
        else if (next.relation === 'imports_from') acc.flags.relImportsFrom = true;
        acc.detailBasis.add(`${next.relation} relation`);
      }
    }

    if (budget.fanoutCapped || budget.frontierCapped) {
      // 어느 seed든 예산 초과면 전체 추천을 low-confidence로 내린다 — 부분 ranked 금지.
      break;
    }
  }

  return { hitLabels, startNodes, budget };
}

function scoreFile(acc: FileAcc): { score: number; detailBasis: string[] } {
  let score = 0;
  const detailBasis = [...acc.detailBasis];
  if (acc.flags.uniqueDef) {
    score += SCORE.uniqueSeedDefinition;
  }
  if (acc.role === 'implementation') {
    score += SCORE.implementationPath;
    detailBasis.push('implementation path');
  }
  if (acc.flags.relation) {
    score += SCORE.relationEdge;
  }
  if (acc.flags.linkedTest) {
    score += SCORE.connectedTest;
    detailBasis.push('connected test');
  }
  if (acc.flags.genericOnly && !acc.flags.uniqueDef && !acc.flags.relation) {
    score += SCORE.genericNameOnly;
    if (!detailBasis.some((b) => /generic/i.test(b))) detailBasis.push('generic name only');
  } else if (acc.flags.genericOnly && !acc.flags.uniqueDef) {
    // 반복 이름 정의 파일: 고유 +5는 없고 일반 이름 감점만 적용
    score += SCORE.genericNameOnly;
    if (!detailBasis.some((b) => /generic/i.test(b))) detailBasis.push('generic name only');
  }
  if (acc.flags.unlinkedTest) {
    score += SCORE.testOnlyUnlinked;
    detailBasis.push('test-only without implementation link');
  }
  if (acc.flags.excluded) {
    score += SCORE.excludedPath;
    detailBasis.push('excluded path');
  }
  if (acc.flags.containsOnly) {
    score += SCORE.containsOnly;
    detailBasis.push('contains-only reach');
  }
  if (detailBasis.length === 0) detailBasis.push('graph evidence');
  return { score, detailBasis };
}

/**
 * FileAcc flags → 중복 없는 compact basis code.
 *
 * @param {FileAcc} acc
 * @returns {CompactBasisCode[]}
 */
function compactBasisFrom(acc: FileAcc): CompactBasisCode[] {
  const codes: CompactBasisCode[] = [];
  const add = (c: CompactBasisCode) => {
    if (!codes.includes(c)) codes.push(c);
  };
  if (acc.flags.uniqueDef) add(COMPACT_BASIS.seedUnique);
  if (acc.flags.seedPath) add(COMPACT_BASIS.seedPath);
  if (acc.flags.seedMatch && !acc.flags.uniqueDef) add(COMPACT_BASIS.seedMatch);
  if (acc.flags.relCalls) add(COMPACT_BASIS.relCalls);
  if (acc.flags.relImports) add(COMPACT_BASIS.relImports);
  if (acc.flags.relImportsFrom) add(COMPACT_BASIS.relImportsFrom);
  if (acc.role === 'implementation') add(COMPACT_BASIS.roleImplementation);
  if (acc.flags.linkedTest) add(COMPACT_BASIS.testConnected);
  if (acc.flags.containsOnly) add(COMPACT_BASIS.reachContainsOnly);
  if (codes.length === 0) add(COMPACT_BASIS.graphEvidence);
  return codes;
}

function sortDetailed(
  list: DetailedCandidate[],
): DetailedCandidate[] {
  return list.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ra = ROLE_PRIORITY[a.role];
    const rb = ROLE_PRIORITY[b.role];
    if (ra !== rb) return ra - rb;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
}

type ScoredRow = {
  detailed: DetailedCandidate;
  compactBasis: CompactBasisCode[];
  linkedTest: boolean;
};

/**
 * 역할·전체 상한을 적용해 compact 후보를 만든다.
 *
 * @param {ScoredRow[]} implRows
 * @param {ScoredRow[]} testRows
 * @returns {{ implementation: CompactCandidate[], test: CompactCandidate[] }}
 */
function projectCompact(
  implRows: ScoredRow[],
  testRows: ScoredRow[],
): { implementation: CompactCandidate[]; test: CompactCandidate[] } {
  const sortedImpl = implRows
    .slice()
    .sort((a, b) => {
      if (b.detailed.score !== a.detailed.score) return b.detailed.score - a.detailed.score;
      return a.detailed.path < b.detailed.path ? -1 : a.detailed.path > b.detailed.path ? 1 : 0;
    });
  const sortedTest = testRows
    .slice()
    .sort((a, b) => {
      if (b.detailed.score !== a.detailed.score) return b.detailed.score - a.detailed.score;
      return a.detailed.path < b.detailed.path ? -1 : a.detailed.path > b.detailed.path ? 1 : 0;
    });

  const pickImpl = sortedImpl.slice(0, MAX_CANDIDATES_PER_ROLE);
  const pickTest = sortedTest.slice(0, MAX_CANDIDATES_PER_ROLE);
  // 전체 8: 역할 내부 정렬을 유지한 채 합집합을 score↓ role↑ path↑로 다시 자른다.
  const merged = [...pickImpl, ...pickTest].sort((a, b) => {
    if (b.detailed.score !== a.detailed.score) return b.detailed.score - a.detailed.score;
    const ra = ROLE_PRIORITY[a.detailed.role];
    const rb = ROLE_PRIORITY[b.detailed.role];
    if (ra !== rb) return ra - rb;
    return a.detailed.path < b.detailed.path ? -1 : a.detailed.path > b.detailed.path ? 1 : 0;
  });
  const kept = new Set(merged.slice(0, MAX_CANDIDATES_TOTAL).map((r) => r.detailed.path));

  const implementation: CompactCandidate[] = [];
  for (const row of pickImpl) {
    if (!kept.has(row.detailed.path)) continue;
    implementation.push({
      path: row.detailed.path,
      role: 'implementation',
      score: row.detailed.score,
      basis: row.compactBasis,
    });
  }
  const test: CompactCandidate[] = [];
  for (const row of pickTest) {
    if (!kept.has(row.detailed.path)) continue;
    test.push({
      path: row.detailed.path,
      role: 'test',
      score: row.detailed.score,
      basis: row.compactBasis,
    });
  }
  return { implementation, test };
}

/**
 * source·test graph만으로 seed를 확장하고 역할별 점수를 매긴다.
 * context graph는 열지 않는다 — 문서 label seed가 후보를 폭증시키던 경로를 끊는다.
 * 그래프 본문은 지시가 아니며 node·link·path만 소비한다.
 * default/debug는 한 번 계산한 ranking을 projection만 한다.
 *
 * @param {{ repoRoot: string, query: string, seeds?: string[], debug?: boolean }} opts
 * @returns {GraphSuggestResult} ranked|low-confidence|unavailable JSON 계약
 */
function graphSuggest(opts: {
  repoRoot: string;
  query: string;
  seeds?: string[];
  debug?: boolean;
}): GraphSuggestResult {
  const repoRoot = opts.repoRoot;
  const query = opts.query;
  const wantDebug = opts.debug === true;
  const explicitSeeds = Array.isArray(opts.seeds)
    ? opts.seeds.filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  const reasonCodes: ReasonCode[] = [];
  const detailReasons: string[] = [];
  const omissionNotes: string[] = [];

  const sourcePath = path.join(repoRoot, DEFAULT_SOURCE_OUT, 'graph.json');
  const testPath = path.join(repoRoot, DEFAULT_TEST_OUT, 'graph.json');

  const buildDebug = (
    traversal: TraversalDebug,
    implDetailed: DetailedCandidate[] = [],
    testDetailed: DetailedCandidate[] = [],
  ): GraphSuggestDebug | undefined => {
    if (!wantDebug) return undefined;
    return {
      candidates: {
        implementation: implDetailed,
        test: testDetailed,
      },
      reasons: detailReasons.slice(),
      omissions: omissionNotes.slice(),
      traversal,
    };
  };

  const sourceLoad = loadGraphFile(sourcePath);
  if (!sourceLoad.graph) {
    reasonCodes.push(REASON.sourceUnavailable);
    detailReasons.push(`source graph unavailable: ${sourceLoad.reason || 'unreadable'}`);
    const traversal: TraversalDebug = {
      max_depth: MAX_DEPTH,
      max_files_per_seed: MAX_FILES_PER_SEED,
      max_frontier_per_seed: MAX_FRONTIER_PER_SEED,
      seeds_used: [],
      seeds_dropped_generic: [],
      fanout_capped: false,
      frontier_capped: false,
      files_touched: 0,
    };
    return emptyResult('unavailable', 'low', reasonCodes, buildDebug(traversal));
  }
  const source = sourceLoad.graph;
  if (source.omissions.length > 0) {
    reasonCodes.push(REASON.sourceOmitted);
    const note = `source omissions: ${[...new Set(source.omissions)].slice(0, 8).join('; ')}`;
    detailReasons.push(note);
    omissionNotes.push(note);
  }

  const testLoad = loadGraphFile(testPath);
  const testGraph = testLoad.graph;
  if (!testGraph) {
    reasonCodes.push(REASON.testUnavailable);
    detailReasons.push(`test graph missing: ${testLoad.reason || 'unreadable'}`);
  } else if (testGraph.omissions.length > 0) {
    reasonCodes.push(REASON.testOmitted);
    const note = `test omissions: ${[...new Set(testGraph.omissions)].slice(0, 8).join('; ')}`;
    detailReasons.push(note);
    omissionNotes.push(note);
  }

  const exclude = realExcludeDirs(repoRoot);
  if (exclude.skipReason) {
    detailReasons.push(`exclude_dirs: ${exclude.skipReason}`);
  }
  const excludeDirs = exclude.dirs || [];

  const queryTokens = tokenize(query);
  const rawSeeds = [...new Set([...queryTokens, ...explicitSeeds])];
  const { kept: seeds, droppedGeneric } = prepareSeeds(rawSeeds);
  detailReasons.push(
    'relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only',
  );

  const baseTraversal = (): TraversalDebug => ({
    max_depth: MAX_DEPTH,
    max_files_per_seed: MAX_FILES_PER_SEED,
    max_frontier_per_seed: MAX_FRONTIER_PER_SEED,
    seeds_used: seeds.slice(),
    seeds_dropped_generic: droppedGeneric.slice(),
    fanout_capped: false,
    frontier_capped: false,
    files_touched: 0,
  });

  // generic-only: 준비 단계에서 label이 전부 떨어져 path seed도 없을 때.
  if (seeds.length === 0) {
    reasonCodes.push(REASON.seedGenericOnly);
    detailReasons.push('generic-only seeds; no unique symbol or path seed');
    return emptyResult(
      'low-confidence',
      'low',
      reasonCodes,
      buildDebug(baseTraversal()),
    );
  }

  const files = new Map<string, FileAcc>();

  const sourceExpand = expandFromSeeds(source, seeds, 'implementation', files, {
    excludeDirs,
  });

  if (sourceExpand.budget.fanoutCapped) {
    reasonCodes.push(REASON.seedFanoutCap);
    detailReasons.push(
      `seed file fan-out exceeded ${MAX_FILES_PER_SEED} files for at least one seed`,
    );
  }
  if (sourceExpand.budget.frontierCapped) {
    reasonCodes.push(REASON.frontierCap);
    detailReasons.push(
      `BFS frontier exceeded ${MAX_FRONTIER_PER_SEED} nodes for at least one seed`,
    );
  }

  // 예산 초과는 부분 결과를 ranked로 내보내지 않는다.
  if (sourceExpand.budget.fanoutCapped || sourceExpand.budget.frontierCapped) {
    const traversal = baseTraversal();
    traversal.fanout_capped = sourceExpand.budget.fanoutCapped;
    traversal.frontier_capped = sourceExpand.budget.frontierCapped;
    traversal.files_touched = files.size;
    // debug: 예산 안에서 이미 모은 후보를 남긴다(finishLow와 동일). 기본 응답은 비운다.
    const abortImpl: DetailedCandidate[] = [];
    const abortTest: DetailedCandidate[] = [];
    const abortSorted = [...files.values()].sort((a, b) => (
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0
    ));
    for (const acc of abortSorted) {
      const { score, detailBasis } = scoreFile(acc);
      const detailed: DetailedCandidate = {
        path: acc.path,
        role: acc.role,
        score,
        confidence: scoreConfidence(score),
        basis: detailBasis,
      };
      if (acc.role === 'implementation') abortImpl.push(detailed);
      else if (acc.role === 'test') abortTest.push(detailed);
    }
    return emptyResult(
      'low-confidence',
      'low',
      reasonCodes,
      buildDebug(traversal, sortDetailed(abortImpl), sortDetailed(abortTest)),
    );
  }

  // 구현 후보 경로·비일반 심볼 — 테스트 연결은 관계 엣지로만 판정한다.
  const implSpecificLabels = new Set<string>();
  for (const [p, acc] of files) {
    if (acc.role !== 'implementation') continue;
    if (excludeDirs.length > 0 && matchesPrefix(p, excludeDirs)) {
      acc.flags.excluded = true;
    }
    for (const n of source.nodes) {
      if (
        n.source_file
        && toPosix(n.source_file) === p
        && n.label
        && !isGenericWord(n.label)
      ) {
        implSpecificLabels.add(n.label);
      }
    }
  }
  for (const s of sourceExpand.hitLabels) {
    if (!isGenericWord(s)) implSpecificLabels.add(s);
  }

  // source 성공 후 test 2차 expand 예산 — 추천을 지우지 않고 traversal/reasons에만 남긴다.
  const testBudgetFlags = { fanoutCapped: false, frontierCapped: false };

  if (testGraph) {
    const { ownedBy } = buildAdjacency(testGraph);
    const linkedTestFiles = new Set<string>();
    const matchedTestNodeIds = new Set<string>();

    // cross-graph: test link가 구현 심볼/노드를 가리킬 때만 연결로 본다.
    for (const link of testGraph.links) {
      if (!EXPAND_RELATIONS.has(link.relation)) continue;
      const srcNode = testGraph.byId.get(link.source);
      const tgtNode = testGraph.byId.get(link.target);
      const targetIsImpl = source.byId.has(link.target)
        || [...implSpecificLabels].some((l) => {
          const key = lookupKey(l);
          if (!key) return false;
          if (lookupKey(link.target) === key) return true;
          const tgt = source.byId.get(link.target);
          return !!(tgt && tgt.label && lookupKey(tgt.label) === key);
        });
      const sourceIsImpl = source.byId.has(link.source)
        || [...implSpecificLabels].some((l) => {
          const key = lookupKey(l);
          return !!(key && lookupKey(link.source) === key);
        });

      if (targetIsImpl && srcNode) {
        matchedTestNodeIds.add(srcNode.id);
        if (srcNode.source_file) linkedTestFiles.add(toPosix(srcNode.source_file));
      }
      if (sourceIsImpl && tgtNode) {
        matchedTestNodeIds.add(tgtNode.id);
        if (tgtNode.source_file) linkedTestFiles.add(toPosix(tgtNode.source_file));
      }
    }

    for (const id of matchedTestNodeIds) {
      const node = testGraph.byId.get(id);
      if (node && node.source_file) linkedTestFiles.add(toPosix(node.source_file));
      for (const ownerId of ownedBy.get(id) || []) {
        const owner = testGraph.byId.get(ownerId);
        if (owner && owner.source_file) linkedTestFiles.add(toPosix(owner.source_file));
      }
    }

    for (const fp of [...linkedTestFiles].sort()) {
      const acc = ensureFile(files, fp, 'test');
      if (!acc) continue;
      acc.role = 'test';
      acc.flags.linkedTest = true;
      acc.detailBasis.add('connected test');
    }

    // seed로 직접 맞은 테스트 — debug에는 남기되 기본 추천에서는 연결분만.
    // source가 이미 예산 안이면 test 2차 expand의 fan-out/frontier는 추천을 지우지 않는다.
    const testExpand = expandFromSeeds(testGraph, seeds, 'test', files, {});
    if (testExpand.budget.fanoutCapped) {
      reasonCodes.push(REASON.seedFanoutCap);
      detailReasons.push('test-graph seed file fan-out exceeded');
    }
    if (testExpand.budget.frontierCapped) {
      reasonCodes.push(REASON.frontierCap);
      detailReasons.push('test-graph BFS frontier exceeded');
    }
    // test 예산 플래그는 실제 budget을 미러한다(하드코드 금지). emptyResult 하지 않음.
    testBudgetFlags.fanoutCapped = testExpand.budget.fanoutCapped;
    testBudgetFlags.frontierCapped = testExpand.budget.frontierCapped;
    for (const [, acc] of files) {
      if (acc.role !== 'test') continue;
      if (!acc.flags.linkedTest) {
        acc.flags.unlinkedTest = true;
        acc.detailBasis.add('test-only without implementation link');
      }
    }
  }

  // 제외·graphify-out·경로 없음 제거
  const droppedExcluded: string[] = [];
  for (const [p, acc] of [...files.entries()]) {
    if (!p || p.startsWith('graphify-out/')) {
      files.delete(p);
      continue;
    }
    if (acc.flags.excluded || (excludeDirs.length > 0 && matchesPrefix(p, excludeDirs))) {
      droppedExcluded.push(p);
      files.delete(p);
    }
  }
  if (droppedExcluded.length > 0) {
    reasonCodes.push(REASON.excludeSkipped);
    detailReasons.push(
      `dropped ${droppedExcluded.length} excluded path(s) `
      + `(exclude_dirs; score ${SCORE.excludedPath} not applied to kept candidates)`,
    );
  }

  const implRows: ScoredRow[] = [];
  const testRows: ScoredRow[] = [];
  // path 오름차순으로 점수화해 Map 삽입 순서가 결과에 안 남게 한다.
  const sortedAcc = [...files.values()].sort((a, b) => (
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0
  ));
  for (const acc of sortedAcc) {
    const { score, detailBasis } = scoreFile(acc);
    const detailed: DetailedCandidate = {
      path: acc.path,
      role: acc.role,
      score,
      confidence: scoreConfidence(score),
      basis: detailBasis,
    };
    const row: ScoredRow = {
      detailed,
      compactBasis: compactBasisFrom(acc),
      linkedTest: !!acc.flags.linkedTest && !acc.flags.unlinkedTest,
    };
    if (acc.role === 'implementation') implRows.push(row);
    else if (acc.role === 'test') testRows.push(row);
  }

  // 기본 추천: implementation은 threshold 이상, test는 연결분만.
  const eligibleImpl = implRows.filter(
    (r) => r.detailed.score >= IMPLEMENTATION_SCORE_THRESHOLD,
  );
  const eligibleTest = testRows.filter((r) => r.linkedTest);

  const allImplDetailed = sortDetailed(implRows.map((r) => r.detailed));
  const allTestDetailed = sortDetailed(testRows.map((r) => r.detailed));
  const traversal = baseTraversal();
  traversal.files_touched = files.size;
  // source는 여기까지 오면 예산 안; test 2차 expand 플래그만 실제 budget을 미러한다.
  traversal.fanout_capped = testBudgetFlags.fanoutCapped;
  traversal.frontier_capped = testBudgetFlags.frontierCapped;

  const finishLow = (extra: ReasonCode, detail: string): GraphSuggestResult => {
    reasonCodes.push(extra);
    detailReasons.push(detail);
    return emptyResult(
      'low-confidence',
      'low',
      reasonCodes,
      buildDebug(traversal, allImplDetailed, allTestDetailed),
    );
  };

  // 구현 후보 없음 (threshold 전 전체 기준 — 탐색 자체가 비었을 때)
  if (implRows.length === 0) {
    return finishLow(REASON.implementationNone, 'no implementation candidates');
  }

  // 구현 후보가 모두 low (score < 4). medium 경계 === threshold이므로 이 게이트가
  // implementation.low_only의 유일한 진입점이다(별도 eligibleImpl 빈 분기 불필요).
  const hasHighImpl = implRows.some((r) => r.detailed.confidence === 'high');
  const hasMediumImpl = implRows.some((r) => r.detailed.confidence === 'medium');
  if (!hasHighImpl && !hasMediumImpl) {
    // low-only여도 debug에는 후보를 남긴다. 기본 candidates는 비운다.
    const lowPack = finishLow(
      REASON.implementationLowOnly,
      'implementation candidates are all low confidence',
    );
    // emptyResult가 candidates를 비우므로, debug에만 상세를 실었다.
    return lowPack;
  }

  const compact = projectCompact(eligibleImpl, eligibleTest);
  const overall: Confidence = hasHighImpl ? 'high' : 'medium';
  const suggested: string[] = [];
  for (const c of compact.implementation) {
    if (c.score >= IMPLEMENTATION_SCORE_THRESHOLD) suggested.push(c.path);
  }
  for (const c of compact.test) {
    if (c.basis.includes(COMPACT_BASIS.testConnected)) suggested.push(c.path);
  }

  reasonCodes.push(REASON.ranked);
  detailReasons.push('ranked implementation and connected test candidates within caps');

  const result: GraphSuggestResult = {
    status: 'ranked',
    confidence: overall,
    candidates: compact,
    suggested_paths: suggested,
    reasons: uniqueReasons(reasonCodes),
  };
  const debugPayload = buildDebug(traversal, allImplDetailed, allTestDetailed);
  if (debugPayload) result.debug = debugPayload;
  return result;
}

export = {
  SCORE,
  ROLE_PRIORITY,
  COMPACT_BASIS,
  REASON,
  MAX_CANDIDATES_PER_ROLE,
  MAX_CANDIDATES_TOTAL,
  MAX_FILES_PER_SEED,
  MAX_FRONTIER_PER_SEED,
  MAX_DEPTH,
  IMPLEMENTATION_SCORE_THRESHOLD,
  scoreConfidence,
  graphSuggest,
  tokenize,
};
