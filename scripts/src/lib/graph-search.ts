'use strict';

const fs = require('node:fs');
const path = require('node:path');
import graphScope = require('./graph-scope');
const {
  DEFAULT_SOURCE_OUT,
  DEFAULT_TEST_OUT,
  DEFAULT_CONTEXT_OUT,
  realExcludeDirs,
} = graphScope;
import contextDigest = require('./context-digest');
const {
  CONTEXT_DIGEST_OUT,
  DIGEST_MAP_REL,
  parseDigestMetadata,
  documentKindFor,
  anchorsFor,
} = contextDigest;

// 점수표는 Task 003·평가 corpus가 같은 숫자를 재사용하므로 상수로 고정한다.
const SCORE = {
  uniqueSeedDefinition: 5,
  contextHit: 4,
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
  context: 2,
} as const;

type Role = keyof typeof ROLE_PRIORITY;
type Confidence = 'high' | 'medium' | 'low';
type Status = 'ranked' | 'low-confidence' | 'unavailable';

type Candidate = {
  path: string;
  score: number;
  confidence: Confidence;
  basis: string[];
};

type GraphSuggestResult = {
  status: Status;
  confidence: Confidence;
  candidates: {
    implementation: Candidate[];
    test: Candidate[];
    context: Candidate[];
  };
  suggested_paths: string[];
  reasons: string[];
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
  contextHit?: boolean;
  relation?: boolean;
  containsOnly?: boolean;
  genericOnly?: boolean;
  linkedTest?: boolean;
  unlinkedTest?: boolean;
  excluded?: boolean;
};

type FileAcc = {
  path: string;
  role: Role;
  flags: ReachFlags;
  basis: Set<string>;
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

const MAX_DEPTH = 2;
const EXPLOSION_LIMIT = 50;

const SEARCH_MODES = ['decision', 'implementation', 'history'] as const;
type SearchMode = typeof SEARCH_MODES[number];

/**
 * context-search CLI·라이브러리 입력을 한 JSON schema로 고정한다.
 * 모드 enum과 후보 상한 1..8은 여기만 바꾸고, CLI 거절(exit 2)이 같은 검증기를 탄다.
 * AJV를 쓰지 않는다 — 허용 필드가 네 개뿐이라 표준 라이브러리 검사가 계약이다.
 */
const CONTEXT_SEARCH_INPUT_SCHEMA = {
  type: 'object',
  required: ['mode', 'query'],
  properties: {
    mode: { type: 'string', enum: SEARCH_MODES },
    query: { type: 'string', minLength: 1 },
    seeds: { type: 'array', items: { type: 'string', minLength: 1 } },
    maxCandidates: { type: 'integer', minimum: 1, maximum: 8 },
  },
} as const;

const CORPUS_SCORE = {
  exactAnchorOrPath: 8,
  domainTag: 5,
  intentTermsTwoPlus: 4,
  closedEvidenceSection: 3,
  taskOnlyOrStructuralHeading: -5,
} as const;

const CLOSED_LIFECYCLE = new Set(['closed', 'partial_closed']);

// tokenize가 한국어를 버리므로, 확인된 공개 단어만 ASCII로 치환한다. 임의 의미 확장은 하지 않는다.
const KO_VOCAB: [string, string][] = [
  ['컨텍스트 검색', 'context-search'],
  ['그래프 제안', 'graph-suggest'],
  ['구현', 'implementation'],
  ['결정', 'decision'],
  ['이력', 'history'],
  ['에픽', 'epic'],
  ['태스크', 'task'],
  ['검색', 'search'],
  ['설명', 'explain'],
];

const COMMAND_SYNONYMS: Record<string, string[]> = {
  'graph-suggest': ['graphSuggest'],
  graphSuggest: ['graph-suggest'],
  'context-search': ['contextSearch'],
  contextSearch: ['context-search'],
};

const STRUCTURAL_HEADING_TERMS = new Set([
  'goal', 'intent', 'interface', 'touch', 'constraints', 'checklist',
  'contract', 'success', 'criteria', 'background', 'intuition',
  'documents', 'scope',
]);

type DigestMeta = ReturnType<typeof parseDigestMetadata>;

type ContextCandidate = {
  path: string;
  role: SearchMode | 'test';
  tags: string[];
  anchors: string[];
  score: number;
  basis: string[];
};

type ContextSearchResult = {
  query_id: string;
  terms: string[];
  seed: string | string[];
  raw_node_count: number;
  eligible_document_count: number;
  candidates: ContextCandidate[];
  // start>0 인데 점수가 모두 0이면 graphSuggest와 같은 `low-confidence`로 둔다.
  // zero-hit은 재시도 뒤에도 시작점이 없을 때만.
  status: 'ranked' | 'low-confidence: broad-query' | 'low-confidence' | 'zero-hit';
};

type NormalizedQuery = {
  terms: string[];
  specific: string[];
  genericOnly: boolean;
};

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

function emptyResult(
  status: Status,
  confidence: Confidence,
  reasons: string[],
): GraphSuggestResult {
  return {
    status,
    confidence,
    candidates: { implementation: [], test: [], context: [] },
    suggested_paths: [],
    reasons: reasons.length > 0 ? reasons : [`${status}: no further detail`],
  };
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

function isGenericWord(seed: string): boolean {
  return GENERIC_WORDS.has(seed.toLowerCase());
}

/**
 * 관계 인접 리스트. contains는 소유 조회용으로만 따로 둔다.
 *
 * @param {LoadedGraph} graph
 * @returns {{ expand: Map<string, string[]>, ownedBy: Map<string, string[]> }}
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
    acc = { path: posix, role, flags: {}, basis: new Set() };
    map.set(posix, acc);
  }
  return acc;
}

/**
 * seed 노드에서 calls/imports/imports_from 만 depth≤2로 확장한다.
 * contains는 시작 심볼의 소유 파일 확인에만 사용한다.
 *
 * @param {LoadedGraph} graph
 * @param {string[]} seedLabels
 * @param {Role} role
 * @param {Map<string, FileAcc>} files
 * @param {{ markUnique?: boolean, markGeneric?: boolean }} opts
 * @returns {{ hitLabels: Set<string>, startNodes: number }}
 */
function expandFromSeeds(
  graph: LoadedGraph,
  seedLabels: string[],
  role: Role,
  files: Map<string, FileAcc>,
  opts: { excludeDirs?: string[] } = {},
): { hitLabels: Set<string>; startNodes: number } {
  const excludeDirs = opts.excludeDirs || [];
  const { expand, ownedBy } = buildAdjacency(graph);
  const hitLabels = new Set<string>();
  const startIds = new Set<string>();

  for (const seed of seedLabels) {
    const nodes = graph.byLabel.get(lookupKey(seed)) || [];
    for (const node of nodes) {
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
        const acc = ensureFile(files, owner.path, role);
        if (!acc) continue;
        // 소유 확인은 contains 엣지다. 관계 BFS로 다시 닿기 전까지 contains-only로 둔다.
        if (owners.length > 0) {
          acc.flags.containsOnly = true;
        }
        // 고유 정의 가산은 구현 그래프에만 적용 — 테스트 라벨 일치로 +5가 되면 안 된다.
        if (role === 'implementation' && unique) {
          acc.flags.uniqueDef = true;
          acc.basis.add(`defines unique seed ${seed}`);
        } else if (genericWord || repeated) {
          acc.flags.genericOnly = true;
          acc.basis.add(`generic name match for ${seed}`);
        } else {
          acc.basis.add(`seed match ${seed}`);
        }
      }
    }

    // 경로 seed: source_file 정확·접미사 일치
    for (const node of graph.nodes) {
      if (!node.source_file) continue;
      const sf = toPosix(node.source_file);
      if (excludeDirs.length > 0 && matchesPrefix(sf, excludeDirs)) continue;
      if (sf === seed || sf.endsWith(`/${seed}`)) {
        const acc = ensureFile(files, sf, role);
        if (!acc) continue;
        hitLabels.add(seed);
        acc.basis.add(`path seed ${seed}`);
        startIds.add(node.id);
      }
    }
  }

  // 관계 BFS — contains는 큐에 넣지 않는다.
  const visited = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [];
  for (const id of startIds) {
    visited.set(id, 0);
    queue.push({ id, depth: 0 });
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.depth >= MAX_DEPTH) continue;
    for (const next of expand.get(cur.id) || []) {
      const prev = visited.get(next.id);
      const nextDepth = cur.depth + 1;
      if (prev !== undefined && prev <= nextDepth) continue;
      visited.set(next.id, nextDepth);
      queue.push({ id: next.id, depth: nextDepth });
      const node = graph.byId.get(next.id);
      if (!node || !node.source_file) continue;
      if (excludeDirs.length > 0 && matchesPrefix(toPosix(node.source_file), excludeDirs)) {
        continue;
      }
      const acc = ensureFile(files, node.source_file, role);
      if (!acc) continue;
      acc.flags.relation = true;
      // calls/imports로 닿으면 contains-only 감점을 걷는다.
      acc.flags.containsOnly = false;
      acc.basis.add(`${next.relation} relation`);
    }
  }

  return { hitLabels, startNodes: startIds.size };
}

function scoreFile(acc: FileAcc): { score: number; basis: string[] } {
  let score = 0;
  const basis = [...acc.basis];
  if (acc.flags.uniqueDef) {
    score += SCORE.uniqueSeedDefinition;
  }
  if (acc.flags.contextHit) {
    score += SCORE.contextHit;
    if (!basis.some((b) => /context/i.test(b))) basis.push('context hit for same feature');
  }
  if (acc.role === 'implementation') {
    score += SCORE.implementationPath;
    basis.push('implementation path');
  }
  if (acc.flags.relation) {
    score += SCORE.relationEdge;
  }
  if (acc.flags.linkedTest) {
    score += SCORE.connectedTest;
    basis.push('connected test');
  }
  if (acc.flags.genericOnly && !acc.flags.uniqueDef && !acc.flags.relation && !acc.flags.contextHit) {
    score += SCORE.genericNameOnly;
    if (!basis.some((b) => /generic/i.test(b))) basis.push('generic name only');
  } else if (acc.flags.genericOnly && !acc.flags.uniqueDef) {
    // 반복 이름 정의 파일: 고유 +5는 없고 일반 이름 감점만 적용
    score += SCORE.genericNameOnly;
    if (!basis.some((b) => /generic/i.test(b))) basis.push('generic name only');
  }
  if (acc.flags.unlinkedTest) {
    score += SCORE.testOnlyUnlinked;
    basis.push('test-only without implementation link');
  }
  if (acc.flags.excluded) {
    score += SCORE.excludedPath;
    basis.push('excluded path');
  }
  if (acc.flags.containsOnly) {
    score += SCORE.containsOnly;
    basis.push('contains-only reach');
  }
  if (basis.length === 0) basis.push('graph evidence');
  return { score, basis };
}

function sortCandidates(list: Candidate[], roleOf: (c: Candidate) => Role): Candidate[] {
  return list.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ra = ROLE_PRIORITY[roleOf(a)];
    const rb = ROLE_PRIORITY[roleOf(b)];
    if (ra !== rb) return ra - rb;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
}

/**
 * context-first로 seed를 모은 뒤 source·test 관계를 확장하고 역할별 점수를 매긴다.
 * 그래프 본문은 데이터가 아니며 node·link·path만 소비한다.
 *
 * @param {{ repoRoot: string, query: string, seeds?: string[] }} opts
 * @returns {GraphSuggestResult} ranked|low-confidence|unavailable JSON 계약
 */
function graphSuggest(opts: {
  repoRoot: string;
  query: string;
  seeds?: string[];
}): GraphSuggestResult {
  const repoRoot = opts.repoRoot;
  const query = opts.query;
  const explicitSeeds = Array.isArray(opts.seeds)
    ? opts.seeds.filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  const reasons: string[] = [];

  const sourcePath = path.join(repoRoot, DEFAULT_SOURCE_OUT, 'graph.json');
  const testPath = path.join(repoRoot, DEFAULT_TEST_OUT, 'graph.json');
  const contextPath = path.join(repoRoot, DEFAULT_CONTEXT_OUT, 'graph.json');

  const sourceLoad = loadGraphFile(sourcePath);
  if (!sourceLoad.graph) {
    reasons.push(`source graph unavailable: ${sourceLoad.reason || 'unreadable'}`);
    // context가 있어도 source 없이는 구현 확장이 불가능 — unavailable로 구분한다.
    const ctxLoad = loadGraphFile(contextPath);
    if (ctxLoad.graph && ctxLoad.graph.omissions.length > 0) {
      reasons.push(`context omissions: ${ctxLoad.graph.omissions.slice(0, 5).join('; ')}`);
    }
    return emptyResult('unavailable', 'low', reasons);
  }
  const source = sourceLoad.graph;
  if (source.omissions.length > 0) {
    reasons.push(`source omissions: ${[...new Set(source.omissions)].slice(0, 8).join('; ')}`);
  }

  const contextLoad = loadGraphFile(contextPath);
  const context = contextLoad.graph;
  if (!context) {
    reasons.push(`context graph missing: ${contextLoad.reason || 'unreadable'}`);
  } else if (context.omissions.length > 0) {
    reasons.push(`context omissions: ${[...new Set(context.omissions)].slice(0, 8).join('; ')}`);
  }

  const testLoad = loadGraphFile(testPath);
  const testGraph = testLoad.graph;
  if (!testGraph) {
    reasons.push(`test graph missing: ${testLoad.reason || 'unreadable'}`);
  } else if (testGraph.omissions.length > 0) {
    reasons.push(`test omissions: ${[...new Set(testGraph.omissions)].slice(0, 8).join('; ')}`);
  }

  const exclude = realExcludeDirs(repoRoot);
  if (exclude.skipReason) reasons.push(`exclude_dirs: ${exclude.skipReason}`);
  const excludeDirs = exclude.dirs || [];

  const queryTokens = tokenize(query);
  const seedSet = new Set<string>([...queryTokens, ...explicitSeeds]);

  // context hit에서 경로·심볼을 seed로 추출
  const contextHitPaths = new Set<string>();
  const contextSeedLabels = new Set<string>();
  if (context) {
    for (const seed of seedSet) {
      const seedKey = lookupKey(seed);
      const lower = seed.toLowerCase();
      for (const node of context.nodes) {
        const labelHit = !!(node.label && seedKey && lookupKey(node.label) === seedKey);
        const normHit = !!(node.norm_label && seedKey && lookupKey(node.norm_label) === seedKey);
        const pathHit = node.source_file && (() => {
          const sf = toPosix(node.source_file).toLowerCase();
          // substring 남용 금지 — 정확 경로 또는 path segment 일치만.
          if (sf === lower) return true;
          return sf.split('/').includes(lower) || sf.endsWith(`/${lower}`);
        })();
        if (!labelHit && !normHit && !pathHit) continue;
        if (node.source_file && isSafeRepoRelative(node.source_file)) {
          contextHitPaths.add(toPosix(node.source_file));
        }
        if (node.label && node.label.length >= 2) contextSeedLabels.add(node.label);
      }
    }
  }

  for (const label of contextSeedLabels) seedSet.add(label);
  for (const p of contextHitPaths) seedSet.add(p);

  const seeds = [...seedSet];
  reasons.push(`context seeds: ${contextSeedLabels.size} labels, ${contextHitPaths.size} paths`);
  reasons.push('relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only');

  const files = new Map<string, FileAcc>();

  // context 후보 기록
  for (const p of contextHitPaths) {
    const acc = ensureFile(files, p, 'context');
    if (!acc) continue;
    acc.role = 'context';
    acc.flags.contextHit = true;
    acc.basis.add('context graph hit');
  }

  const sourceExpand = expandFromSeeds(source, seeds, 'implementation', files, {
    excludeDirs,
  });

  // context에서 추출한 심볼이 이 파일의 고유 정의면 같은 기능 hit(+4)
  for (const [, acc] of files) {
    if (acc.role !== 'implementation') continue;
    if (contextHitPaths.has(acc.path)) {
      acc.flags.contextHit = true;
      acc.basis.add('context hit for same feature');
      continue;
    }
    const definedFromContext = [...acc.basis].some((b) => {
      const m = /^defines unique seed (.+)$/.exec(b);
      if (!m) return false;
      const definedKey = lookupKey(m[1]);
      if (!definedKey) return false;
      return [...contextSeedLabels].some((label) => lookupKey(label) === definedKey);
    });
    if (definedFromContext) {
      acc.flags.contextHit = true;
      acc.basis.add('context hit for same feature');
    }
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

  if (testGraph) {
    const { ownedBy } = buildAdjacency(testGraph);
    const linkedTestFiles = new Set<string>();
    const matchedTestNodeIds = new Set<string>();

    // cross-graph: test link가 구현 심볼/노드를 가리킬 때만 연결로 본다.
    // 같은 일반 명사 라벨 공유만으로는 connected로 승격하지 않는다.
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

    for (const fp of linkedTestFiles) {
      const acc = ensureFile(files, fp, 'test');
      if (!acc) continue;
      acc.role = 'test';
      acc.flags.linkedTest = true;
      acc.basis.add('connected test');
    }

    // seed로 직접 맞은 테스트이지만 구현 연결이 없으면 test-only 감점
    expandFromSeeds(testGraph, seeds, 'test', files, {});
    for (const [, acc] of files) {
      if (acc.role !== 'test') continue;
      if (!acc.flags.linkedTest) {
        acc.flags.unlinkedTest = true;
        acc.basis.add('test-only without implementation link');
      }
    }
  }

  // 제외·graphify-out·경로 없음 제거 (exclude는 후보에서 drop; −5는 점수표 상수로만 유지)
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
    reasons.push(
      `dropped ${droppedExcluded.length} excluded path(s) `
      + `(exclude_dirs; score ${SCORE.excludedPath} not applied to kept candidates)`,
    );
  }

  // 후보 수 폭발 — 추천 포기
  if (files.size >= EXPLOSION_LIMIT) {
    reasons.push(`result explosion: ${files.size} candidates (≥ ${EXPLOSION_LIMIT})`);
    return emptyResult('low-confidence', 'low', reasons);
  }

  const implCandidates: Candidate[] = [];
  const testCandidates: Candidate[] = [];
  const contextCandidates: Candidate[] = [];

  for (const acc of files.values()) {
    const { score, basis } = scoreFile(acc);
    const cand: Candidate = {
      path: acc.path,
      score,
      confidence: scoreConfidence(score),
      basis,
    };
    if (acc.role === 'implementation') implCandidates.push(cand);
    else if (acc.role === 'test') testCandidates.push(cand);
    else contextCandidates.push(cand);
  }

  const byRole = (c: Candidate): Role => {
    if (implCandidates.includes(c)) return 'implementation';
    if (testCandidates.includes(c)) return 'test';
    return 'context';
  };

  const sortedImpl = sortCandidates(implCandidates, () => 'implementation');
  const sortedTest = sortCandidates(testCandidates, () => 'test');
  const sortedContext = sortCandidates(contextCandidates, () => 'context');

  const pack = (
    status: Status,
    confidence: Confidence,
    extraReason: string,
  ): GraphSuggestResult => ({
    status,
    confidence,
    candidates: {
      implementation: sortedImpl,
      test: sortedTest,
      context: sortedContext,
    },
    suggested_paths: [],
    reasons: [...reasons, extraReason],
  });

  // 질의·명시 seed만 본다. context가 자동 추가한 문서 경로는 고유 seed로 치지 않는다.
  const primarySeeds = [...new Set([...queryTokens, ...explicitSeeds])];
  const hasSpecificPrimary = primarySeeds.some((s) => {
    if (!s) return false;
    if (isGenericWord(s)) return false;
    if (s.includes('/') || /\.[a-z]+$/i.test(s)) return true;
    return true;
  });

  // 저신뢰: 일반 단어 seed만 (반복 심볼은 감점만 하고 여기선 막지 않는다)
  if (primarySeeds.length > 0 && !hasSpecificPrimary) {
    return pack('low-confidence', 'low', 'generic-only seeds; no unique symbol or path seed');
  }

  // 저신뢰: source/context 기능 연결 부재 — 구현 부재보다 구체적 사유를 남긴다.
  const contextHadSeeds = contextSeedLabels.size > 0 || contextHitPaths.size > 0;
  const sourceLinked = sourceExpand.hitLabels.size > 0 || sourceExpand.startNodes > 0;
  if (contextHadSeeds && !sourceLinked) {
    const detail = sortedImpl.length === 0
      ? 'no source/context functional link; no implementation candidates'
      : 'no source/context functional link';
    return pack('low-confidence', 'low', detail);
  }

  // 저신뢰: 구현 후보 없음
  if (sortedImpl.length === 0) {
    return pack('low-confidence', 'low', 'no implementation candidates');
  }

  // 저신뢰: 상위 결과가 test-only — 구현·테스트만 본다(context +4가 상위를 가로채지 않게).
  // 최고 점수 티어가 전부 test이면 발동. low 구현이 뒤에 있어도 가리지 않는다.
  const codeFacing = sortCandidates(
    [...sortedImpl, ...sortedTest],
    byRole,
  );
  if (codeFacing.length > 0 && sortedTest.length > 0) {
    const bestScore = codeFacing[0].score;
    const leading = codeFacing.filter((c) => c.score === bestScore);
    const leadingAllTest = leading.every((c) => sortedTest.some((t) => t.path === c.path));
    if (leadingAllTest) {
      return pack('low-confidence', 'low', 'top results are test-only');
    }
  }

  // 저신뢰: 구현 후보가 모두 low (Interface confidence 규칙)
  const hasHighImpl = sortedImpl.some((c) => c.confidence === 'high');
  const hasMediumImpl = sortedImpl.some((c) => c.confidence === 'medium');
  if (!hasHighImpl && !hasMediumImpl) {
    return pack('low-confidence', 'low', 'implementation candidates are all low confidence');
  }

  const overall: Confidence = hasHighImpl ? 'high' : 'medium';
  const suggested: string[] = [];
  for (const c of sortedImpl) {
    if (c.confidence === 'high' || c.confidence === 'medium') suggested.push(c.path);
  }
  // 연결 테스트는 점수와 무관하게 suggested에 넣는다 — Task 003이 confidence
  // 필터를 구현에만 걸고 테스트는 연결 여부만 본다.
  for (const c of sortedTest) {
    if (
      c.basis.some((b) => /connected test/i.test(b))
      && !c.basis.some((b) => /test-only without implementation/i.test(b))
    ) {
      suggested.push(c.path);
    }
  }

  return {
    status: 'ranked',
    confidence: overall,
    candidates: {
      implementation: sortedImpl,
      test: sortedTest,
      context: sortedContext,
    },
    suggested_paths: suggested,
    reasons,
  };
}

function isClosedLifecycle(meta: DigestMeta): boolean {
  return CLOSED_LIFECYCLE.has(meta.status) || CLOSED_LIFECYCLE.has(meta.blueprint_status);
}

/**
 * JSON schema로 mode·query·maxCandidates·seeds를 검사한다. 실패 문구는 CLI가
 * `context-search: ` 접두만 붙여 exit 2로 그대로 쓴다 — 파서가 별도 범위 검사를 두지 않게.
 *
 * @param {{ mode?: unknown, query?: unknown, seeds?: unknown, maxCandidates?: unknown }} input
 * @returns {string | null} 거절 사유. 통과면 null
 */
function validateContextSearchInput(input: {
  mode?: unknown;
  query?: unknown;
  seeds?: unknown;
  maxCandidates?: unknown;
}): string | null {
  const mode = input.mode;
  const allowedModes = CONTEXT_SEARCH_INPUT_SCHEMA.properties.mode.enum as readonly string[];
  if (typeof mode !== 'string' || !allowedModes.includes(mode)) {
    return '--mode <decision|implementation|history> is required';
  }
  const query = input.query;
  const minQuery = CONTEXT_SEARCH_INPUT_SCHEMA.properties.query.minLength;
  if (typeof query !== 'string' || query.length < minQuery) {
    return '--query <text> is required';
  }
  if (input.maxCandidates !== undefined && input.maxCandidates !== null) {
    const n = input.maxCandidates;
    const spec = CONTEXT_SEARCH_INPUT_SCHEMA.properties.maxCandidates;
    if (!Number.isInteger(n) || Number(n) < spec.minimum || Number(n) > spec.maximum) {
      return '--max-candidates must be an integer 1..8';
    }
  }
  if (input.seeds !== undefined) {
    if (
      !Array.isArray(input.seeds)
      || input.seeds.some((s) => typeof s !== 'string' || s.length === 0)
    ) {
      return '--seed requires a value';
    }
  }
  return null;
}

/**
 * 검색 모드별 원본 문서 역할. Distill은 세 corpus 어디에도 넣지 않는다.
 * decision: epic·blueprint index + 닫힌 explain. implementation: task brief.
 * history: 닫힌 task와 explain. 닫힘은 문서 status 또는 부모 blueprint_status.
 *
 * @param {DigestMeta} meta - 다이제스트 메타데이터
 * @param {SearchMode} mode - decision | implementation | history
 * @returns {boolean} corpus 포함 여부
 */
function inCorpus(meta: DigestMeta, mode: SearchMode): boolean {
  if (!meta.kind || meta.kind === 'distill') return false;
  if (mode === 'decision') {
    if (meta.kind === 'epic' || meta.kind === 'blueprint') return true;
    return meta.kind === 'explain' && isClosedLifecycle(meta);
  }
  if (mode === 'implementation') return meta.kind === 'task';
  if (mode === 'history') {
    return (meta.kind === 'explain' || meta.kind === 'task') && isClosedLifecycle(meta);
  }
  return false;
}

function isAnchorToken(term: string): boolean {
  return /^(epic|bp|task)-\d{3}(?:-\d{3}){0,2}$/i.test(term);
}

function isPathToken(term: string): boolean {
  return term.includes('/') || /\.[a-z0-9]+$/i.test(term);
}

/**
 * 한국어 고정 어휘를 ASCII로 바꾼 뒤 tokenize한다. 확인된 앵커·경로·공개 명령만 남긴다.
 *
 * @param {string} text - --query 값
 * @param {string[]} [extraSeeds] - --seed 반복 값
 * @returns {NormalizedQuery} terms는 표시용, specific은 일반어를 뺀 검색 키
 */
function normalizeQuery(text: string, extraSeeds: string[] = []): NormalizedQuery {
  let raw = String(text || '');
  for (const [ko, en] of KO_VOCAB) {
    if (raw.includes(ko)) raw = raw.split(ko).join(` ${en} `);
  }
  const seedTokens = extraSeeds.flatMap((s) => tokenize(s));
  const terms = [...new Set([...tokenize(raw), ...seedTokens])];
  // 구조 heading은 specific에 남겨 scoreDocument의 −5가 실제로 적용되게 한다.
  // 일반어만 빼면 "intent contract" 같은 질의가 genericOnly로 새지 않는다.
  const specific = terms.filter((t) => !isGenericWord(t));
  return { terms, specific, genericOnly: terms.length > 0 && specific.length === 0 };
}

/**
 * zero-hit 재시도용 동의어 확장. 한 번만 호출한다.
 * 공개 명령 camelCase/kebab 쌍만 더한다. 놓친 bp-XXX-YYY를 부모 epic으로
 * 올리면 없는 블루프린트가 에픽 corpus에 exact-match되므로 금지한다.
 *
 * @param {string[]} terms - 정규화된 specific terms
 * @returns {string[]} 확장된 term 집합(배열)
 */
function expandTerms(terms: string[]): string[] {
  const out = new Set(terms);
  for (const t of terms) {
    for (const syn of COMMAND_SYNONYMS[t] || []) out.add(syn);
  }
  return [...out];
}

/**
 * 후보 없는 context-search 결과를 만든다. query_id는 항상 `mode:` 접두를 붙인다.
 *
 * @param {ContextSearchResult['status']} status - broad-query | zero-hit | low-confidence
 * @param {string[]} terms - 정규화된 표시 terms
 * @param {string | string[]} seed - 질의 원문 또는 --seed 값
 * @param {number} rawNodeCount - context graph 노드 수
 * @param {number} eligible - corpus에 들어간 문서 수
 * @param {string} mode - decision | implementation | history (잘못된 값도 접두로 남긴다)
 * @returns {ContextSearchResult} 빈 후보 JSON
 */
function emptyContextResult(
  status: ContextSearchResult['status'],
  terms: string[],
  seed: string | string[],
  rawNodeCount: number,
  eligible: number,
  mode: string,
): ContextSearchResult {
  return {
    query_id: queryIdFrom(mode, terms),
    terms,
    seed,
    raw_node_count: rawNodeCount,
    eligible_document_count: eligible,
    candidates: [],
    status,
  };
}

/**
 * 검색 결과 query_id. 일반어 조기 반환도 ranked·zero-hit와 같이 mode 접두를 쓴다.
 *
 * @param {string} mode - 검색 모드 접두
 * @param {string[]} terms - slug에 쓸 terms (최대 4개)
 * @returns {string} `mode:term+term` 또는 `mode:empty`
 */
function queryIdFrom(mode: string, terms: string[]): string {
  const slug = terms.slice(0, 4).join('+') || 'empty';
  return `${mode}:${slug}`;
}

function loadDigestCatalog(repoRoot: string): {
  byOriginal: Map<string, DigestMeta>;
  digestToOriginal: Map<string, string>;
} {
  const byOriginal = new Map<string, DigestMeta>();
  const digestToOriginal = new Map<string, string>();
  const mapPath = path.join(repoRoot, DIGEST_MAP_REL);
  if (!fs.existsSync(mapPath)) return { byOriginal, digestToOriginal };
  let map: unknown;
  try {
    map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch (_e) {
    // map.json 파손만 빈 카탈로그로 둔다. 검색은 graph source_file 폴백으로 계속한다.
    return { byOriginal, digestToOriginal };
  }
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return { byOriginal, digestToOriginal };
  }
  for (const [flat, rel] of Object.entries(map as Record<string, unknown>)) {
    if (typeof rel !== 'string' || !rel) continue;
    const original = toPosix(rel);
    digestToOriginal.set(flat, original);
    const abs = path.join(repoRoot, CONTEXT_DIGEST_OUT, flat);
    let raw: string;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch (_e) {
      // 카탈로그 항목의 파생 파일 부재·권한 오류만 건너뛴다. 검색은 나머지 문서로 계속한다.
      continue;
    }
    const meta = parseDigestMetadata(raw);
    if (!meta.source_path) meta.source_path = original;
    if (!meta.kind) {
      const inferred = documentKindFor(original);
      meta.kind = inferred || '';
    }
    byOriginal.set(original, meta);
  }
  return { byOriginal, digestToOriginal };
}

function resolveOriginalPath(
  sourceFile: string,
  digestToOriginal: Map<string, string>,
): string | null {
  const posix = toPosix(sourceFile);
  if (posix.startsWith(`${CONTEXT_DIGEST_OUT}/`)) {
    const flat = posix.slice(CONTEXT_DIGEST_OUT.length + 1);
    return digestToOriginal.get(flat) || null;
  }
  if (posix.startsWith('graphify-out/')) return null;
  if (!isSafeRepoRelative(posix)) return null;
  return posix;
}

function headingLabels(raw: string): string[] {
  return String(raw || '')
    .split(/\r?\n/)
    .filter((line) => /^##\s/.test(line))
    .map((line) => line.replace(/^##\s+/, '').trim())
    .filter(Boolean);
}

function digestBodyText(raw: string): string {
  return String(raw || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^##\s+.+$/gm, ' ');
}

function metaForPath(
  rel: string,
  catalog: Map<string, DigestMeta>,
): DigestMeta {
  const hit = catalog.get(rel);
  if (hit) return hit;
  const kind = documentKindFor(rel) || '';
  const anchors = anchorsFor(rel);
  const epic = anchors.find((a) => /^epic-\d{3}$/.test(a));
  const bp = anchors.find((a) => /^bp-\d{3}-\d{3}$/.test(a));
  return {
    kind,
    status: '',
    epic_id: epic ? epic.slice('epic-'.length) : '',
    blueprint_id: bp ? bp.slice(-3) : '',
    blueprint_status: '',
    tags: [],
    source_path: rel,
  };
}

function termMatchesValue(term: string, value: string): boolean {
  const t = lookupKey(term);
  const v = lookupKey(value);
  if (!t || !v) return false;
  return t === v;
}

function pathLikeMatch(term: string, value: string): boolean {
  if (termMatchesValue(term, value)) return true;
  const t = lookupKey(term);
  const v = lookupKey(value);
  if (!t || !v) return false;
  return v.endsWith(`/${t}`);
}

/**
 * 원본 파일 하나의 corpus 점수. 기준선은 exact +8, tag +5, intent 2개 +4,
 * closed 근거 +3, task-only·구조 heading −5. 같은 가산은 문서당 한 번만.
 * −5는 이 문서 heading·label·본문이 구조 heading에 걸렸을 때만 적용한다.
 *
 * @param {{ path: string, meta: DigestMeta, labels: string[], digestRaw: string, specific: string[] }} opts
 * @returns {{ score: number, basis: string[], tags: string[], anchors: string[] }}
 */
function scoreDocument(opts: {
  path: string;
  meta: DigestMeta;
  labels: string[];
  digestRaw: string;
  specific: string[];
}): { score: number; basis: string[]; tags: string[]; anchors: string[] } {
  const { path: docPath, meta, labels, digestRaw, specific } = opts;
  const anchors = [...new Set([...anchorsFor(docPath), ...headingLabels(digestRaw)
    .filter((h) => isAnchorToken(h))])];
  const tags = [...meta.tags];
  const heading = headingLabels(digestRaw);
  const body = digestBodyText(digestRaw);
  const basis: string[] = [];
  let score = 0;

  const exact = specific.some((term) => {
    if (anchors.some((a) => termMatchesValue(term, a))) return true;
    if (pathLikeMatch(term, docPath)) return true;
    if (heading.some((h) => pathLikeMatch(term, h) && (isAnchorToken(h) || isPathToken(h) || isPathToken(term)))) {
      return true;
    }
    if (labels.some((l) => pathLikeMatch(term, l) && (isAnchorToken(l) || isPathToken(term) || isAnchorToken(term)))) {
      return true;
    }
    return false;
  });
  if (exact) {
    score += CORPUS_SCORE.exactAnchorOrPath;
    basis.push('exact anchor or path');
  }

  const tagHit = specific.some((term) => tags.some((tag) => termMatchesValue(term, tag))
    || heading.some((h) => tags.some((tag) => termMatchesValue(term, h) && termMatchesValue(h, tag))));
  if (tagHit) {
    score += CORPUS_SCORE.domainTag;
    basis.push('domain tag');
  }

  const haystack = [docPath, ...labels, ...heading, ...tags, body].join('\n');
  const intentHits = specific.filter((term) => {
    if (isAnchorToken(term) || isPathToken(term)) return false;
    if (tags.some((tag) => termMatchesValue(term, tag))) return false;
    const key = lookupKey(term);
    return haystack.toLowerCase().includes(key);
  });
  if (intentHits.length >= 2) {
    score += CORPUS_SCORE.intentTermsTwoPlus;
    basis.push('intent terms');
  }

  if (isClosedLifecycle(meta) && (meta.kind === 'explain' || meta.kind === 'blueprint' || meta.kind === 'epic')) {
    // +3은 닫힌 문서 다이제스트의 근거 본문만. 그래프 label은 임의 심볼이라 근거가 아니다.
    const evidenceHit = specific.some((term) => {
      const key = lookupKey(term);
      return !!(key && body.toLowerCase().includes(key));
    });
    if (evidenceHit) {
      score += CORPUS_SCORE.closedEvidenceSection;
      basis.push('closed evidence section');
    }
  }

  // −5는 질의 term이 구조어인 것만이 아니라, 이 문서 heading·label·본문이
  // 그 구조·task-only heading에 실제로 걸렸을 때만 준다. 카탈로그 전체에
  // 뿌리면 −5 동점군이 8을 넘어 broad-query가 되고 진짜 시작점을 버린다.
  const structuralQuery = specific.length > 0 && specific.every((term) => (
    STRUCTURAL_HEADING_TERMS.has(lookupKey(term))
  ));
  const structuralHit = structuralQuery && specific.some((term) => {
    if (heading.some((h) => pathLikeMatch(term, h) || termMatchesValue(term, h))) return true;
    if (labels.some((l) => pathLikeMatch(term, l) || termMatchesValue(term, l))) return true;
    const key = lookupKey(term);
    return !!(key && body.toLowerCase().includes(key));
  });
  if (structuralHit && !exact && !tagHit) {
    score += CORPUS_SCORE.taskOnlyOrStructuralHeading;
    basis.push('task-only or structural heading');
  }

  if (basis.length === 0 && specific.some((term) => haystack.toLowerCase().includes(lookupKey(term)))) {
    basis.push('term match');
  }
  return { score, basis, tags, anchors };
}

/**
 * 이 문서가 질의 specific term의 시작점인지. 앵커·경로·태그·그래프 label·본문 일치만 본다.
 * 점수 0이어도 start로 세면 zero-hit 재시도와 구분된다.
 *
 * @param {string[]} specific - 일반어를 뺀 terms
 * @param {string} docPath - 원본 경로
 * @param {DigestMeta} meta
 * @param {string[]} labels - 그래프 노드 label
 * @param {string} digestRaw - 파생 파일 본문
 * @returns {boolean}
 */
function documentHitStart(
  specific: string[],
  docPath: string,
  meta: DigestMeta,
  labels: string[],
  digestRaw: string,
): boolean {
  const anchors = anchorsFor(docPath);
  const heading = headingLabels(digestRaw);
  const body = digestBodyText(digestRaw);
  return specific.some((term) => {
    if (anchors.some((a) => termMatchesValue(term, a))) return true;
    if (pathLikeMatch(term, docPath)) return true;
    if (meta.tags.some((tag) => termMatchesValue(term, tag))) return true;
    if (labels.some((l) => pathLikeMatch(term, l) || termMatchesValue(term, l))) return true;
    if (heading.some((h) => pathLikeMatch(term, h) || termMatchesValue(term, h))) return true;
    const key = lookupKey(term);
    return !!(key && body.toLowerCase().includes(key));
  });
}

/**
 * 점수 내림차순 후보를 상한 안에서 동점군 단위로 자른다.
 * 맨 앞 동점군이 8개를 넘거나, 상한 안에 온전히 못 들어가는 첫 묶음이면
 * 임의로 자르지 않고 broad-query·빈 후보로 끝낸다.
 *
 * @param {ContextCandidate[]} ranked - 점수·경로 정렬된 후보
 * @param {number} maxCandidates - 1..8
 * @returns {{ status: ContextSearchResult['status'], candidates: ContextCandidate[] }}
 */
function applyCandidateCap(
  ranked: ContextCandidate[],
  maxCandidates: number,
): { status: ContextSearchResult['status']; candidates: ContextCandidate[] } {
  if (ranked.length === 0) return { status: 'zero-hit', candidates: [] };
  const groups: ContextCandidate[][] = [];
  for (const row of ranked) {
    const last = groups[groups.length - 1];
    if (!last || last[0].score !== row.score) groups.push([row]);
    else last.push(row);
  }
  // 상위 동점군이 8개를 넘으면 8개를 임의로 자르지 않는다. 아래 점수 묶음이
  // 커도 이미 상위 후보를 채웠으면 그 묶음만 버리고 ranked를 유지한다.
  if (groups.length > 0 && groups[0].length > 8) {
    return { status: 'low-confidence: broad-query', candidates: [] };
  }
  const taken: ContextCandidate[] = [];
  for (const group of groups) {
    if (taken.length + group.length <= maxCandidates) {
      taken.push(...group);
      continue;
    }
    if (taken.length === 0) {
      return { status: 'low-confidence: broad-query', candidates: [] };
    }
    break;
  }
  if (taken.length === 0) return { status: 'zero-hit', candidates: [] };
  return { status: 'ranked', candidates: taken };
}

/**
 * 정규화 terms로 context graph를 읽고 원본 파일별 점수를 매긴다.
 * 일반어만 남거나 8개를 넘는 동점군은 후보를 만들지 않고 broad-query로 끝낸다.
 *
 * @param {{ repoRoot: string, mode: SearchMode, query: string, seeds?: string[], maxCandidates?: number }} opts
 * @returns {ContextSearchResult}
 */
function contextSearch(opts: {
  repoRoot: string;
  mode: SearchMode | string;
  query: string;
  seeds?: string[];
  maxCandidates?: number;
}): ContextSearchResult {
  const repoRoot = opts.repoRoot;
  const mode = opts.mode as SearchMode;
  const seeds = Array.isArray(opts.seeds)
    ? opts.seeds.filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  const maxCandidates = Number.isInteger(opts.maxCandidates) ? Number(opts.maxCandidates) : 8;
  const seedOut: string | string[] = seeds.length === 0 ? (opts.query || '') : (seeds.length === 1 ? seeds[0] : seeds);
  const normalized = normalizeQuery(opts.query, seeds);

  const contextPath = path.join(repoRoot, DEFAULT_CONTEXT_OUT, 'graph.json');
  const loaded = loadGraphFile(contextPath);
  const rawNodeCount = loaded.graph ? loaded.graph.nodes.length : 0;
  const { byOriginal, digestToOriginal } = loadDigestCatalog(repoRoot);

  if (!SEARCH_MODES.includes(mode)) {
    return emptyContextResult('zero-hit', normalized.terms, seedOut, rawNodeCount, 0, mode);
  }
  // 일반어 조기 반환 전에 카탈로그 corpus 크기를 센다. 잘못된 mode는 위에서 0으로 둔다.
  const catalogEligible = [...byOriginal.values()].filter((meta) => inCorpus(meta, mode)).length;
  if (normalized.genericOnly) {
    return emptyContextResult(
      'low-confidence: broad-query',
      normalized.terms,
      seedOut,
      rawNodeCount,
      catalogEligible,
      mode,
    );
  }

  const graph = loaded.graph;
  const labelsByPath = new Map<string, string[]>();
  if (graph) {
    for (const node of graph.nodes) {
      if (!node.source_file) continue;
      const original = resolveOriginalPath(node.source_file, digestToOriginal)
        || (isSafeRepoRelative(toPosix(node.source_file))
          && !toPosix(node.source_file).startsWith('graphify-out/')
          ? toPosix(node.source_file)
          : null);
      if (!original) continue;
      if (!byOriginal.has(original)) {
        byOriginal.set(original, metaForPath(original, byOriginal));
      }
      const list = labelsByPath.get(original) || [];
      if (node.label) list.push(node.label);
      if (node.norm_label) list.push(node.norm_label);
      labelsByPath.set(original, list);
    }
  }

  const eligible = [...byOriginal.entries()].filter(([, meta]) => inCorpus(meta, mode));
  const eligibleCount = eligible.length;

  const digestRawByPath = new Map<string, string>();
  for (const [flat, original] of digestToOriginal.entries()) {
    try {
      digestRawByPath.set(
        original,
        fs.readFileSync(path.join(repoRoot, CONTEXT_DIGEST_OUT, flat), 'utf8'),
      );
    } catch (_e) {
      // 파생 파일 부재·읽기 오류만 빈 본문으로 둔다. 메타·그래프 label로 점수는 계속 매긴다.
      digestRawByPath.set(original, '');
    }
  }

  const rankOnce = (specific: string[]): {
    start: number;
    ranked: ContextCandidate[];
  } => {
    const ranked: ContextCandidate[] = [];
    let start = 0;
    for (const [docPath, meta] of eligible) {
      const labels = labelsByPath.get(docPath) || [];
      const digestRaw = digestRawByPath.get(docPath) || '';
      if (documentHitStart(specific, docPath, meta, labels, digestRaw)) start += 1;
      const scored = scoreDocument({ path: docPath, meta, labels, digestRaw, specific });
      if (scored.score === 0) continue;
      ranked.push({
        path: docPath,
        role: mode,
        tags: scored.tags,
        anchors: scored.anchors,
        score: scored.score,
        basis: scored.basis,
      });
    }
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
    return { start, ranked };
  };

  let specific = normalized.specific.slice();
  let pass = rankOnce(specific);
  if (pass.start === 0) {
    specific = expandTerms(specific.length ? specific : normalized.terms);
    pass = rankOnce(specific);
    if (pass.start === 0 && mode !== 'implementation') {
      return {
        ...emptyContextResult('zero-hit', normalized.terms, seedOut, rawNodeCount, eligibleCount, mode),
        query_id: queryIdFrom(mode, normalized.specific.length ? normalized.specific : normalized.terms),
      };
    }
  }

  const merged: ContextCandidate[] = pass.ranked.slice();
  if (mode === 'implementation') {
    // graphSuggest는 한국어를 tokenize에서 버리므로, KO_VOCAB을 거친 terms·명령 쌍을 넘긴다.
    const suggestSeeds = [...new Set([
      ...seeds,
      ...specific,
      ...specific.flatMap((t) => COMMAND_SYNONYMS[t] || []),
    ])];
    const suggest = graphSuggest({
      repoRoot,
      query: normalized.terms.join(' '),
      seeds: suggestSeeds,
    });
    const extra: ContextCandidate[] = [];
    for (const row of suggest.candidates.implementation) {
      extra.push({
        path: row.path,
        role: 'implementation',
        tags: [],
        anchors: [],
        score: row.score,
        basis: row.basis,
      });
    }
    for (const row of suggest.candidates.test) {
      extra.push({
        path: row.path,
        role: 'test',
        tags: [],
        anchors: [],
        score: row.score,
        basis: row.basis,
      });
    }
    const seen = new Set(merged.map((c) => c.path));
    for (const row of extra) {
      if (seen.has(row.path)) continue;
      seen.add(row.path);
      merged.push(row);
    }
    merged.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
    if (pass.start === 0 && extra.length === 0) {
      return {
        ...emptyContextResult('zero-hit', normalized.terms, seedOut, rawNodeCount, eligibleCount, mode),
        query_id: queryIdFrom(mode, normalized.specific),
      };
    }
  }

  const scoredRows = merged.filter((c) => c.score !== 0 || c.basis.length > 0);
  if (scoredRows.length === 0) {
    // 시작점은 있는데 점수가 전부 0이면 재시도 실패(zero-hit)가 아니다.
    const status = pass.start > 0 ? 'low-confidence' : 'zero-hit';
    return {
      query_id: queryIdFrom(mode, normalized.specific.length ? normalized.specific : normalized.terms),
      terms: normalized.terms,
      seed: seedOut,
      raw_node_count: rawNodeCount,
      eligible_document_count: eligibleCount,
      candidates: [],
      status,
    };
  }
  const capped = applyCandidateCap(scoredRows, maxCandidates);
  return {
    query_id: queryIdFrom(mode, normalized.specific.length ? normalized.specific : normalized.terms),
    terms: normalized.terms,
    seed: seedOut,
    raw_node_count: rawNodeCount,
    eligible_document_count: eligibleCount,
    candidates: capped.candidates,
    status: capped.status,
  };
}

export = {
  SCORE,
  CORPUS_SCORE,
  SEARCH_MODES,
  CONTEXT_SEARCH_INPUT_SCHEMA,
  ROLE_PRIORITY,
  scoreConfidence,
  graphSuggest,
  contextSearch,
  normalizeQuery,
  tokenize,
  validateContextSearchInput,
};
