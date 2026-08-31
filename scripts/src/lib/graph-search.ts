'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_SOURCE_OUT,
  DEFAULT_TEST_OUT,
  DEFAULT_CONTEXT_OUT,
  realExcludeDirs,
} = require('./graph-scope') as {
  DEFAULT_SOURCE_OUT: string;
  DEFAULT_TEST_OUT: string;
  DEFAULT_CONTEXT_OUT: string;
  realExcludeDirs: (repoRoot: string) => { dirs: string[]; skipReason?: string };
};

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

function toPosix(p: string): string {
  return p.split('\\').join('/');
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
      const key = label.toLowerCase();
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
  for (const n of graph.byLabel.get(label.toLowerCase()) || []) {
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
    const nodes = graph.byLabel.get(seed.toLowerCase()) || [];
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
      const lower = seed.toLowerCase();
      for (const node of context.nodes) {
        const labelHit = node.label && node.label.toLowerCase() === lower;
        const normHit = node.norm_label && node.norm_label.toLowerCase() === lower;
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
      return m ? contextSeedLabels.has(m[1]) : false;
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
          const lower = l.toLowerCase();
          if (link.target.toLowerCase() === lower) return true;
          const tgt = source.byId.get(link.target);
          return !!(tgt && tgt.label && tgt.label.toLowerCase() === lower);
        });
      const sourceIsImpl = source.byId.has(link.source)
        || [...implSpecificLabels].some((l) => link.source.toLowerCase() === l.toLowerCase());

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

module.exports = {
  SCORE,
  ROLE_PRIORITY,
  scoreConfidence,
  graphSuggest,
  tokenize,
};
