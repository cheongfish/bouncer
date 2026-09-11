'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'context-corpus-queries.json');
const QUALITY_FIXTURE = path.join(__dirname, 'fixtures', 'graph-search-quality.json');
const EPICS = path.join(ROOT, '.bouncer/context/epics');

const {
  contextSearch,
  graphSuggest,
  CORPUS_SCORE,
  SEARCH_MODES,
} = require('../scripts/lib/graph-search');
const { buildContextDigest, CONTEXT_DIGEST_OUT } = require('../scripts/lib/context-digest');

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const qualityFixture = JSON.parse(fs.readFileSync(QUALITY_FIXTURE, 'utf8'));
const RETIRED_GRAPH_PATHS = [
  '.bouncer/Distill.md',
  '.bouncer/distill/build-ts.md',
  '.bouncer/distill/context-layout.md',
  '.bouncer/distill/core.md',
  '.bouncer/distill/git-worktree.md',
  '.bouncer/distill/graph.md',
  '.bouncer/distill/plugin-skills.md',
  '.bouncer/distill/validate-gates.md',
];

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-corpus-search-'));
}

function writeGraph(repo, role, graph) {
  const dir = path.join(repo, 'graphify-out', role);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(graph));
}

function writeFile(repo, rel, body) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

function frontmatter(extra) {
  return [
    '---',
    `type: bouncer.${extra.kind}`,
    'tags:',
    '  - bouncer',
    `  - ${extra.kind}`,
    ...(extra.tags || []).map((tag) => `  - ${tag}`),
    'bouncer:',
    `  epic_id: '${extra.epic}'`,
    extra.blueprint ? `  blueprint_id: '${extra.blueprint}'` : '',
    `  status: ${extra.status}`,
    '---',
    '',
  ].filter((line) => line !== '').join('\n');
}

/**
 * Q1–Q6이 기대하는 060 문서와 구현 파일을 임시 저장소에 심고 digest·graph를 만든다.
 * 원본 epic 트리는 건드리지 않는다 — 검색 계약만 재현한다.
 */
function materializeCorpus() {
  const repo = tmpRepo();
  const epic = '.bouncer/context/epics/060-graphify-search-quality';
  const bp = `${epic}/blueprints/001-context-first-ranking`;
  fs.mkdirSync(path.join(repo, bp, 'tasks/001'), { recursive: true });
  fs.mkdirSync(path.join(repo, bp, 'tasks/002'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts/src/lib'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['scripts/src'],
    verify: 'npm test',
    base_branch: 'main',
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  }));

  writeFile(repo, `${epic}/index.md`, [
    frontmatter({ kind: 'epic', epic: '060', status: 'approved', tags: ['graphify-search-quality'] }),
    '## Success criteria',
    '',
    'ranked context retrieval for graphify-search-quality',
    '',
  ].join('\n'));
  writeFile(repo, `${bp}/index.md`, [
    frontmatter({ kind: 'blueprint', epic: '060', blueprint: '001', status: 'closed', tags: ['context-first-ranking'] }),
    '## Intent',
    '',
    'context-first ranking from past decisions',
    '',
    '## Contract',
    '',
    'graphSuggest returns ranked paths',
    '',
  ].join('\n'));
  writeFile(repo, `${bp}/explain.md`, [
    frontmatter({ kind: 'explain', epic: '060', blueprint: '001', status: 'published' }),
    '## Background',
    '',
    'closed blueprint explain for context-first-ranking',
    '',
    '## Intuition',
    '',
    'seed from decisions then expand implementation',
    '',
    '## Code',
    '',
    'scripts/src/lib/graph-search.ts graphSuggest',
    '',
  ].join('\n'));
  writeFile(repo, `${bp}/tasks/001/tasks.md`, [
    frontmatter({ kind: 'tasks', epic: '060', blueprint: '001', status: 'verified' }),
    '## Goal & intent',
    '',
    'split source and test graphs',
    '',
    '## Interface',
    '',
    'graph-scope test_dirs and graphSuggest compatibility',
    '',
    '## Touch',
    '- Modify `scripts/src/lib/graph-search.ts` — compatibility coverage',
    '',
  ].join('\n'));
  writeFile(repo, `${bp}/tasks/002/tasks.md`, [
    frontmatter({ kind: 'tasks', epic: '060', blueprint: '001', status: 'verified', tags: ['graph-search'] }),
    '## Goal & intent',
    '',
    'rank graphSuggest candidates',
    '',
    '## Interface',
    '',
    'graphSuggest query seeds',
    '',
    '## Touch',
    '- Modify `scripts/src/lib/graph-search.ts` — 검색',
    '',
  ].join('\n'));
  writeFile(repo, 'scripts/src/lib/graph-search.ts', 'function graphSuggest() {}\n');

  const digest = buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  const map = digest.map;
  const contextNodes = Object.entries(map).map(([flat, rel], i) => ({
    id: `ctx::${i}`,
    label: path.posix.basename(rel),
    source_file: `${CONTEXT_DIGEST_OUT}/${flat}`,
  }));
  // 앵커·태그가 그래프 label로도 남아 exact +8 / tag +5 를 탈 수 있게 한다.
  contextNodes.push(
    { id: 'ctx::epic', label: 'epic-060', source_file: `${epic}/index.md` },
    { id: 'ctx::quality', label: 'graphify-search-quality', source_file: `${epic}/index.md` },
    { id: 'ctx::bp', label: 'bp-060-001', source_file: `${bp}/index.md` },
    { id: 'ctx::bp-tag', label: 'context-first-ranking', source_file: `${bp}/index.md` },
    { id: 'ctx::explain', label: 'explain', source_file: `${bp}/explain.md` },
    { id: 'ctx::task2', label: 'graphSuggest', source_file: `${bp}/tasks/002/tasks.md` },
    { id: 'ctx::task2-path', label: 'scripts/src/lib/graph-search.ts', source_file: `${bp}/tasks/002/tasks.md` },
    { id: 'ctx::task1', label: 'task-060-001-001', source_file: `${bp}/tasks/001/tasks.md` },
    { id: 'ctx::task1-symbol', label: 'graphSuggest', source_file: `${bp}/tasks/001/tasks.md` },
    { id: 'ctx::task1-history', label: 'explain', source_file: `${bp}/tasks/001/tasks.md` },
  );
  writeGraph(repo, 'context', { nodes: contextNodes, links: [] });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'src::file', label: 'graph-search.ts', source_file: 'scripts/src/lib/graph-search.ts' },
      { id: 'src::sym', label: 'graphSuggest', source_file: 'scripts/src/lib/graph-search.ts' },
      ...['plan', 'test', 'result', 'hook'].flatMap((label, i) => [
        { id: `generic::file-${i}`, label: `generic-${i}.ts`, source_file: `scripts/src/lib/generic-${i}.ts` },
        { id: `generic::symbol-${i}`, label, source_file: `scripts/src/lib/generic-${i}.ts` },
      ]),
    ],
    links: [
      {
        relation: 'contains',
        source: 'src::file',
        target: 'src::sym',
        source_file: 'scripts/src/lib/graph-search.ts',
      },
      ...['plan', 'test', 'result', 'hook'].map((_, i) => ({
        relation: 'contains',
        source: `generic::file-${i}`,
        target: `generic::symbol-${i}`,
        source_file: `scripts/src/lib/generic-${i}.ts`,
      })),
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  return repo;
}

function rankedPaths(result) {
  return result.candidates.map((row) => row.path);
}

function graphBuildSha(repo) {
  const hash = crypto.createHash('sha256');
  for (const role of ['context', 'source', 'test']) {
    hash.update(fs.readFileSync(path.join(repo, 'graphify-out', role, 'graph.json')));
  }
  return hash.digest('hex');
}

function benchmarkRows(repo, method) {
  return fixture.queries.map((q) => {
    const result = method === 'context-search'
      ? contextSearch({ repoRoot: repo, mode: q.mode, query: q.query, maxCandidates: q.max_candidates })
      : graphSuggest({ repoRoot: repo, query: q.query, seeds: q.query.split(/\s+/) });
    const candidates = method === 'context-search'
      ? rankedPaths(result)
      : result.suggested_paths.slice(0, q.max_candidates);
    return {
      id: q.id,
      status: method === 'context-search' ? result.status : result.status,
      expected_docs: q.expected_docs,
      expected_rank: q.expected_docs
        .map((doc) => candidates.indexOf(doc) + 1)
        .filter((rank) => rank > 0),
      candidates,
    };
  });
}

function measureBatch(repo, method, warmups, repetitions) {
  for (let i = 0; i < warmups; i += 1) benchmarkRows(repo, method);
  const samples = [];
  for (let i = 0; i < repetitions; i += 1) {
    const start = performance.now();
    benchmarkRows(repo, method);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    median_ms: samples[Math.floor(samples.length / 2)],
    p95_ms: samples[Math.ceil(samples.length * 0.95) - 1],
  };
}

function assertBenchmarkMatches(rows, expected) {
  assert.deepEqual(aggregateMetrics(rows), {
    recall_at_8: expected.recall_at_8,
    mrr: expected.mrr,
    broad_query_false_positive_rate: expected.broad_query_false_positive_rate,
    zero_hit_diagnosis_rate: expected.zero_hit_diagnosis_rate,
    median_candidates: expected.median_candidates,
  }, JSON.stringify(rows));
  assert.deepEqual(rows.map((row) => row.expected_rank), expected.expected_ranks);
}

/**
 * 고정 질의의 순위를 집계한다. broad/zero-hit은 정답 문서가 없으므로 품질 분모에서
 * 제외하고, 빈 정답을 임의 후보로 채우는 회귀는 별도 비율로 드러낸다.
 *
 * @param {Array<object>} rows - 질의별 기대 문서와 실제 후보 목록
 * @returns {object} Recall@8, MRR, 후보 중앙값과 진단 비율
 */
function aggregateMetrics(rows) {
  const ranked = rows.filter((row) => row.expected_docs.length > 0);
  const expectedCount = ranked.reduce((sum, row) => sum + row.expected_docs.length, 0);
  const hits = ranked.reduce((sum, row) => {
    const top = row.candidates.slice(0, 8);
    return sum + row.expected_docs.filter((doc) => top.includes(doc)).length;
  }, 0);
  const reciprocalRanks = ranked.map((row) => {
    const ranks = row.expected_docs
      .map((doc) => row.candidates.indexOf(doc) + 1)
      .filter((rank) => rank > 0);
    return ranks.length === 0 ? 0 : 1 / Math.min(...ranks);
  });
  const candidateCounts = ranked.map((row) => row.candidates.length).sort((a, b) => a - b);
  const middle = Math.floor(candidateCounts.length / 2);
  const median = candidateCounts.length % 2 === 0
    ? (candidateCounts[middle - 1] + candidateCounts[middle]) / 2
    : candidateCounts[middle];
  const broad = rows.find((row) => row.id === 'Q4');
  const zero = rows.find((row) => row.id === 'Q5');
  return {
    recall_at_8: hits / expectedCount,
    mrr: reciprocalRanks.reduce((sum, value) => sum + value, 0) / reciprocalRanks.length,
    broad_query_false_positive_rate: broad.candidates.length === 0 ? 0 : 1,
    zero_hit_diagnosis_rate: zero.status === 'zero-hit' && zero.candidates.length === 0 ? 1 : 0,
    median_candidates: median,
  };
}

test('context corpus fixture pins Q1-Q6 mode, expected docs, and candidate caps', () => {
  const ids = fixture.queries.map((q) => q.id);
  assert.deepEqual(ids, ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
  assert.deepEqual(fixture.search.modes, SEARCH_MODES);
  for (const q of fixture.queries) {
    assert.ok(SEARCH_MODES.includes(q.mode), `${q.id} mode`);
    assert.ok(Number.isInteger(q.max_candidates) && q.max_candidates >= 1 && q.max_candidates <= 8);
    assert.ok(Array.isArray(q.expected_docs));
    assert.ok(q.expect_status);
    const isAscii = (s) => [...s].every((ch) => ch.charCodeAt(0) <= 0x7f);
    assert.ok(isAscii(q.query));
    for (const doc of q.expected_docs) {
      assert.ok(isAscii(doc));
    }
  }
});

test('benchmark fixture records one-build direct BFS and context-search metrics', () => {
  const benchmark = fixture.benchmark;
  const repo = materializeCorpus();
  const contextRows = benchmarkRows(repo, 'context-search');
  const baselineRows = benchmarkRows(repo, 'direct-bfs');
  assert.equal(benchmark.graph.commit, benchmark.baseline.graph.commit);
  assert.equal(benchmark.graph.build_sha, benchmark.baseline.graph.build_sha);
  assert.equal(benchmark.graph.graphify_cli_version, benchmark.baseline.graph.graphify_cli_version);
  assert.equal(benchmark.graph.build_sha, graphBuildSha(repo));
  assert.equal(benchmark.context_search.recall_at_8 >= 0.9, true);
  assert.equal(benchmark.context_search.mrr >= 0.7, true);
  assert.equal(benchmark.context_search.broad_query_false_positive_rate, 0);
  assert.equal(benchmark.context_search.zero_hit_diagnosis_rate, 1);
  assert.ok(benchmark.context_search.median_candidates >= 3);
  assert.ok(benchmark.context_search.median_candidates <= 8);
  assert.ok(Number.isInteger(benchmark.context_search.planning_retrieval_tokens));
  assert.ok(benchmark.context_search.planning_retrieval_tokens > 0);
  assertBenchmarkMatches(contextRows, benchmark.context_search);
  assertBenchmarkMatches(baselineRows, benchmark.baseline);
  for (const result of [benchmark.baseline, benchmark.context_search]) {
    assert.equal(result.wall_clock.method, 'performance.now');
    assert.ok(result.wall_clock.warmups >= 1);
    assert.ok(result.wall_clock.repetitions >= 30);
    assert.ok(result.wall_clock.median_ms > 0);
    assert.ok(result.wall_clock.p95_ms >= result.wall_clock.median_ms);
  }
  const mirror = qualityFixture.meta.context_search_comparison;
  assert.equal(mirror.build_sha, benchmark.graph.build_sha);
  assert.deepEqual(mirror.direct_bfs, {
    recall_at_8: benchmark.baseline.recall_at_8,
    mrr: benchmark.baseline.mrr,
    broad_query_false_positive_rate: benchmark.baseline.broad_query_false_positive_rate,
    zero_hit_diagnosis_rate: benchmark.baseline.zero_hit_diagnosis_rate,
    median_candidates: benchmark.baseline.median_candidates,
    planning_retrieval_tokens: benchmark.baseline.planning_retrieval_tokens,
    wall_clock_median_ms: benchmark.baseline.wall_clock.median_ms,
    wall_clock_p95_ms: benchmark.baseline.wall_clock.p95_ms,
  });
  assert.deepEqual(mirror.context_search, {
    recall_at_8: benchmark.context_search.recall_at_8,
    mrr: benchmark.context_search.mrr,
    broad_query_false_positive_rate: benchmark.context_search.broad_query_false_positive_rate,
    zero_hit_diagnosis_rate: benchmark.context_search.zero_hit_diagnosis_rate,
    median_candidates: benchmark.context_search.median_candidates,
    planning_retrieval_tokens: benchmark.context_search.planning_retrieval_tokens,
    wall_clock_median_ms: benchmark.context_search.wall_clock.median_ms,
    wall_clock_p95_ms: benchmark.context_search.wall_clock.p95_ms,
  });
});

test('benchmark gate rejects candidate output that diverges from recorded quality', () => {
  const repo = materializeCorpus();
  const rows = benchmarkRows(repo, 'context-search');
  rows[0].candidates = [];
  rows[0].expected_rank = [];
  assert.throws(
    () => assertBenchmarkMatches(rows, fixture.benchmark.context_search),
    (error) => error && error.code === 'ERR_ASSERTION',
  );
});

test('benchmark wall-clock method executes repeated real searches', () => {
  const repo = materializeCorpus();
  const timing = measureBatch(repo, 'context-search', 1, 3);
  assert.ok(timing.median_ms > 0);
  assert.ok(timing.p95_ms >= timing.median_ms);
});

test('isolated post-deletion regeneration has no retired map entries or source nodes', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.bouncer/context'), { recursive: true });
  fs.cpSync(EPICS, path.join(repo, '.bouncer/context/epics'), { recursive: true });
  const digest = buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  const staleMapEntries = Object.values(digest.map)
    .filter((sourcePath) => RETIRED_GRAPH_PATHS.includes(sourcePath));
  const evidence = fixture.benchmark.graph.post_deletion_regeneration;

  assert.deepEqual(staleMapEntries, []);
  assert.deepEqual(evidence.stale_map_entries, []);
  assert.deepEqual(evidence.stale_source_nodes, []);
  assert.equal(evidence.graphify_cli_version, fixture.benchmark.graph.graphify_cli_version);
  assert.match(evidence.map_sha256, /^[a-f0-9]{64}$/);
  assert.match(evidence.graph_sha256, /^[a-f0-9]{64}$/);
  assert.ok(evidence.map_entries > 0);
  assert.ok(evidence.graph_nodes > 0);
});

test('Q1-Q3 ranked expected docs land in top 8; Q4 broad-query and Q5 zero-hit return no candidates', () => {
  const repo = materializeCorpus();
  for (const q of fixture.queries) {
    const result = contextSearch({
      repoRoot: repo,
      mode: q.mode,
      query: q.query,
      maxCandidates: q.max_candidates,
    });
    assert.equal(result.status, q.expect_status, `${q.id} status`);
    assert.ok(
      result.query_id.startsWith(`${q.mode}:`),
      `${q.id} query_id must prefix mode; got ${result.query_id}`,
    );
    assert.ok(result.candidates.length <= q.max_candidates, `${q.id} cap`);
    if (q.expect_status === 'ranked') {
      const paths = rankedPaths(result);
      for (const doc of q.expected_docs) {
        assert.ok(
          paths.includes(doc),
          `${q.id} missing ${doc}; got ${paths.join(', ')}`,
        );
      }
      assert.ok(result.candidates.length >= 1 && result.candidates.length <= 8);
    } else {
      assert.deepEqual(result.candidates, [], `${q.id} must not invent candidates`);
    }
    if (q.id === 'Q4') {
      assert.ok(
        result.eligible_document_count > 0,
        'generic-only still reports catalog corpus size',
      );
    }
  }
});

test('role filter keeps decision, implementation, and history corpora disjoint for mixed queries', () => {
  const repo = materializeCorpus();
  const decision = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'epic-060 bp-060-001 graphSuggest',
  });
  const implementation = contextSearch({
    repoRoot: repo,
    mode: 'implementation',
    query: 'graphSuggest graph-search.ts',
  });
  const history = contextSearch({
    repoRoot: repo,
    mode: 'history',
    query: 'bp-060-001 explain',
  });

  assert.equal(decision.status, 'ranked');
  assert.ok(decision.candidates.every((row) => row.role === 'decision'));
  assert.ok(!rankedPaths(decision).some((p) => p.endsWith('/tasks.md')));
  assert.ok(!rankedPaths(decision).some((p) => p.endsWith('.ts')));

  assert.equal(implementation.status, 'ranked');
  assert.ok(implementation.candidates.some((row) => row.path.endsWith('tasks.md') || row.path.endsWith('.ts')));
  assert.ok(!rankedPaths(implementation).some((p) => p.endsWith('/index.md')));
  assert.ok(!rankedPaths(implementation).some((p) => p.endsWith('explain.md')));

  assert.equal(history.status, 'ranked');
  assert.ok(history.candidates.every((row) => row.role === 'history'));
  assert.ok(rankedPaths(history).some((p) => p.endsWith('explain.md')));
  assert.ok(!rankedPaths(history).some((p) => p.endsWith('/index.md')));
});

test('partial_closed explain enters decision and history corpora', () => {
  const repo = tmpRepo();
  const epic = '.bouncer/context/epics/086-partial';
  const bp = `${epic}/blueprints/001-doc`;
  const explainRel = `${bp}/explain.md`;
  const taskRel = `${bp}/tasks/001/tasks.md`;
  fs.mkdirSync(path.join(repo, `${bp}/tasks/001`), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    verify: 'npm test',
    base_branch: 'main',
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  }));
  writeFile(repo, `${epic}/index.md`, [
    frontmatter({ kind: 'epic', epic: '086', status: 'approved' }),
    '## Success criteria',
    '',
    'open epic without the marker token',
    '',
  ].join('\n'));
  writeFile(repo, `${bp}/index.md`, [
    frontmatter({ kind: 'blueprint', epic: '086', blueprint: '001', status: 'approved' }),
    '## Intent',
    '',
    'open blueprint without the marker token',
    '',
    '## Contract',
    '',
    'open blueprint without the marker token',
    '',
  ].join('\n'));
  writeFile(repo, explainRel, [
    frontmatter({ kind: 'explain', epic: '086', blueprint: '001', status: 'partial_closed' }),
    '## Background',
    '',
    'partialclosedxyz leftover explain',
    '',
    '## Intuition',
    '',
    'partialclosedxyz leftover explain',
    '',
    '## Code',
    '',
    'partialclosedxyz leftover explain',
    '',
  ].join('\n'));
  writeFile(repo, taskRel, [
    frontmatter({ kind: 'tasks', epic: '086', blueprint: '001', status: 'partial_closed' }),
    '## Goal & intent',
    '',
    'partialclosedtaskxyz leftover task',
    '',
    '## Interface',
    '',
    'partialclosedtaskxyz leftover task',
    '',
  ].join('\n'));
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', {
    nodes: [
      { id: 'e', label: 'epic-086', source_file: `${epic}/index.md` },
      { id: 'b', label: 'bp-086-001', source_file: `${bp}/index.md` },
      { id: 'x', label: 'partialclosedxyz', source_file: explainRel },
      { id: 't', label: 'partialclosedtaskxyz', source_file: taskRel },
    ],
    links: [],
  });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const decision = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'partialclosedxyz',
  });
  assert.equal(decision.status, 'ranked');
  assert.ok(rankedPaths(decision).includes(explainRel));
  assert.ok(!rankedPaths(decision).includes(taskRel));

  const history = contextSearch({
    repoRoot: repo,
    mode: 'history',
    query: 'partialclosedxyz',
  });
  assert.equal(history.status, 'ranked');
  assert.ok(rankedPaths(history).includes(explainRel));

  assert.equal(decision.eligible_document_count, 3);
  assert.equal(history.eligible_document_count, 2);

  const historyTask = contextSearch({
    repoRoot: repo,
    mode: 'history',
    query: 'task-086-001-001',
  });
  assert.equal(historyTask.status, 'ranked');
  assert.ok(rankedPaths(historyTask).includes(taskRel));
});

test('ninth candidate is rejected even when a ninth document scores', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/080-cap/blueprints'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    verify: 'npm test',
    base_branch: 'main',
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  }));
  // 점수 묶음이 아니라 1–9 슬롯을 채우도록 문서마다 다른 가산 조합을 둔다.
  // 9번은 질의 앵커에서 빼 태그 +5만 받아 최하위로 떨어진다.
  const specs = [
    { id: '001', status: 'closed', tags: ['cap-tag'], intents: true },
    { id: '002', status: 'approved', tags: ['cap-tag'], intents: true },
    { id: '003', status: 'closed', tags: ['cap-tag'], intents: false },
    { id: '004', status: 'closed', tags: [], intents: true },
    { id: '005', status: 'approved', tags: ['cap-tag'], intents: false },
    { id: '006', status: 'approved', tags: [], intents: true },
    { id: '007', status: 'closed', tags: [], intents: false },
    { id: '008', status: 'approved', tags: [], intents: false },
    { id: '009', status: 'approved', tags: ['cap-tag'], intents: false, skipAnchor: true },
  ];
  const extras = [];
  const nodes = [];
  for (const spec of specs) {
    const rel = `.bouncer/context/epics/080-cap/blueprints/${spec.id}-doc/index.md`;
    extras.push(rel);
    const body = spec.intents
      ? 'ranking-token retrieval-token unique body'
      : 'plain body without ranking tokens';
    writeFile(repo, rel, [
      frontmatter({
        kind: 'blueprint',
        epic: '080',
        blueprint: spec.id,
        status: spec.status,
        tags: spec.tags,
      }),
      '## Intent',
      '',
      body,
      '',
      '## Contract',
      '',
      body,
      '',
    ].join('\n'));
    nodes.push({
      id: `n${spec.id}`,
      label: spec.skipAnchor ? 'cap-tag' : `bp-080-${spec.id}`,
      source_file: rel,
    });
  }
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', { nodes, links: [] });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: [
      'bp-080-001', 'bp-080-002', 'bp-080-003', 'bp-080-004',
      'bp-080-005', 'bp-080-006', 'bp-080-007', 'bp-080-008',
      'cap-tag', 'ranking-token', 'retrieval-token',
    ].join(' '),
    maxCandidates: 8,
  });
  assert.equal(result.status, 'ranked');
  assert.equal(result.candidates.length, 8);
  const ninth = extras[extras.length - 1];
  assert.ok(!rankedPaths(result).includes(ninth), '9th extra blueprint must not be returned');
});

test('tie group larger than 8 is broad-query with no invented candidates', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/070-tie/blueprints/001-a'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    verify: 'npm test',
    base_branch: 'main',
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  }));
  const nodes = [];
  for (let i = 1; i <= 9; i += 1) {
    const id = String(i).padStart(3, '0');
    const rel = `.bouncer/context/epics/070-tie/blueprints/${id}-doc/index.md`;
    writeFile(repo, rel, [
      frontmatter({ kind: 'blueprint', epic: '070', blueprint: id, status: 'approved', tags: ['shared-tag'] }),
      '## Intent',
      '',
      'shared-tag same intent body',
      '',
      '## Contract',
      '',
      'shared-tag same intent body',
      '',
    ].join('\n'));
    nodes.push({ id: `t${i}`, label: 'shared-tag', source_file: rel });
  }
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', { nodes, links: [] });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'shared-tag',
    maxCandidates: 8,
  });
  assert.equal(result.status, 'low-confidence: broad-query');
  assert.deepEqual(result.candidates, []);
});

test('CORPUS_SCORE pins exact, tag, intent, evidence, and structural weights', () => {
  assert.equal(CORPUS_SCORE.exactAnchorOrPath, 8);
  assert.equal(CORPUS_SCORE.domainTag, 5);
  assert.equal(CORPUS_SCORE.intentTermsTwoPlus, 4);
  assert.equal(CORPUS_SCORE.closedEvidenceSection, 3);
  assert.equal(CORPUS_SCORE.taskOnlyOrStructuralHeading, -5);
});

test('graph/search history lives under 060 hierarchy with retained 001 and migrated 002-008', () => {
  const h = fixture.hierarchy;
  const epicDir = path.join(EPICS, h.canonical_epic);
  assert.ok(fs.existsSync(path.join(epicDir, 'index.md')));
  assert.ok(fs.existsSync(path.join(epicDir, 'blueprints', h.retained_blueprint, 'index.md')));
  for (const bp of h.migrated_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing migrated blueprint ${bp}`,
    );
  }
  for (const src of h.removed_source_epics) {
    assert.equal(
      fs.existsSync(path.join(EPICS, src)),
      false,
      `source epic ${src} should be removed after consolidation`,
    );
  }
});

test('Distill runtime history lives under 007 hierarchy with retained 001-002 and migrated 003-009', () => {
  const h = fixture.hierarchy_007;
  const epicDir = path.join(EPICS, h.canonical_epic);
  assert.ok(fs.existsSync(path.join(epicDir, 'index.md')));
  for (const bp of h.retained_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing retained blueprint ${bp}`,
    );
  }
  for (const bp of h.migrated_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing migrated blueprint ${bp}`,
    );
  }
  for (const src of h.removed_source_epics) {
    assert.equal(
      fs.existsSync(path.join(EPICS, src)),
      false,
      `source epic ${src} should be removed after consolidation`,
    );
  }
});

test('agent orchestration history lives under 009 hierarchy with retained 001-002 and migrated 003-013', () => {
  const h = fixture.hierarchy_009;
  const epicDir = path.join(EPICS, h.canonical_epic);
  assert.ok(fs.existsSync(path.join(epicDir, 'index.md')));
  for (const bp of h.retained_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing retained blueprint ${bp}`,
    );
  }
  for (const bp of h.migrated_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing migrated blueprint ${bp}`,
    );
  }
  for (const src of h.removed_source_epics) {
    assert.equal(
      fs.existsSync(path.join(EPICS, src)),
      false,
      `source epic ${src} should be removed after consolidation`,
    );
  }
});

test('product surface and hosts history lives under 001 hierarchy with retained 001 and migrated 002-009', () => {
  const h = fixture.hierarchy_001;
  const epicDir = path.join(EPICS, h.canonical_epic);
  assert.ok(fs.existsSync(path.join(epicDir, 'index.md')));
  for (const bp of h.retained_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing retained blueprint ${bp}`,
    );
  }
  for (const bp of h.migrated_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing migrated blueprint ${bp}`,
    );
  }
  for (const src of h.removed_source_epics) {
    assert.equal(
      fs.existsSync(path.join(EPICS, src)),
      false,
      `source epic ${src} should be removed after consolidation`,
    );
  }
});

test('planning and quality governance history lives under 004 hierarchy with retained 001-004 and migrated 005-008', () => {
  const h = fixture.hierarchy_004;
  const epicDir = path.join(EPICS, h.canonical_epic);
  assert.ok(fs.existsSync(path.join(epicDir, 'index.md')));
  for (const bp of h.retained_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing retained blueprint ${bp}`,
    );
  }
  for (const bp of h.migrated_blueprints) {
    assert.ok(
      fs.existsSync(path.join(epicDir, 'blueprints', bp, 'index.md')),
      `missing migrated blueprint ${bp}`,
    );
  }
  for (const src of h.removed_source_epics) {
    assert.equal(
      fs.existsSync(path.join(EPICS, src)),
      false,
      `source epic ${src} should be removed after consolidation`,
    );
  }
});
