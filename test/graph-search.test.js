'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  graphSuggest,
  contextSearch,
  scoreConfidence,
  tokenize,
  normalizeQuery,
  ROLE_PRIORITY,
  SCORE,
  CORPUS_SCORE,
  SEARCH_MODES,
  CONTEXT_SEARCH_INPUT_SCHEMA,
  validateContextSearchInput,
} = require('../scripts/lib/graph-search');
const { buildContextDigest } = require('../scripts/lib/context-digest');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-graph-search-'));
}

function writeGraph(repo, role, graph) {
  const dir = path.join(repo, 'graphify-out', role);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(graph));
}

function writeConfig(repo, extra = {}) {
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    verify: 'npm test',
    base_branch: mainBranch(),
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: ['src/generated'], ...extra.graphify },
    ...extra,
  }));
}

function mainBranch() {
  return 'main';
}

const qualityFixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'graph-search-quality.json'),
  'utf8',
));

function materializeQualityCase(caseEntry, includeContext) {
  const repo = tmpRepo();
  writeConfig(repo, {
    source_dirs: ['scripts/src', 'hooks'],
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: ['scripts/lib'] },
  });
  for (const role of ['source', 'test', 'context']) {
    writeGraph(
      repo,
      role,
      role === 'context' && !includeContext
        ? { nodes: [], links: [] }
        : (caseEntry.graphs[role] || { nodes: [], links: [] }),
    );
  }
  return repo;
}

function topKRecall(result, goldPaths, topK) {
  const top = result.suggested_paths.slice(0, topK);
  return top.filter((candidate) => goldPaths.includes(candidate)).length / goldPaths.length;
}

function falsePositiveCount(result, goldPaths, topK) {
  return result.suggested_paths
    .slice(0, topK)
    .filter((candidate) => !goldPaths.includes(candidate)).length;
}

test('derived-anchor token grammar preserves hierarchy anchors and rejects colon form', () => {
  const anchors = [
    'epic-054',
    'bp-054-001',
    'task-054-001-002',
    // corpus consolidation fixed queries (018/007/060) must stay atomic tokens
    'epic-018',
    'epic-007',
    'epic-060',
  ];

  for (const anchor of anchors) {
    assert.deepEqual(tokenize(anchor), [anchor]);
  }
  assert.deepEqual(tokenize('epic:054'), ['epic', '054']);
});

/**
 * 최소 연결 그래프: context가 심볼·경로를 가리키고, source가 정의를 소유하며
 * calls/imports로 이웃을 열고, test가 구현 심볼을 호출한다.
 */
function connectedFixture(repo) {
  writeConfig(repo);
  writeGraph(repo, 'context', {
    nodes: [
      {
        id: 'ctx::doc',
        label: 'tasks.md',
        source_file: '.bouncer/context/epics/060/blueprints/001/tasks/002/tasks.md',
      },
      {
        id: 'ctx::sym',
        label: 'verifyLedgerPathFor',
        source_file: '.bouncer/context/epics/060/blueprints/001/tasks/002/tasks.md',
      },
    ],
    links: [
      {
        relation: 'contains',
        source: 'ctx::doc',
        target: 'ctx::sym',
        source_file: '.bouncer/context/epics/060/blueprints/001/tasks/002/tasks.md',
      },
    ],
  });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'src::file', label: 'verification.ts', source_file: 'src/lib/verification.ts' },
      { id: 'src::sym', label: 'verifyLedgerPathFor', source_file: 'src/lib/verification.ts' },
      { id: 'src::caller', label: 'runVerify', source_file: 'src/lib/runner.ts' },
      { id: 'src::runner', label: 'runner.ts', source_file: 'src/lib/runner.ts' },
      { id: 'src::imported', label: 'paths.ts', source_file: 'src/lib/paths.ts' },
      { id: 'src::gen', label: 'generated.js', source_file: 'src/generated/out.js' },
      { id: 'src::genSym', label: 'verifyLedgerPathFor', source_file: 'src/generated/out.js' },
    ],
    links: [
      { relation: 'contains', source: 'src::file', target: 'src::sym', source_file: 'src/lib/verification.ts' },
      { relation: 'contains', source: 'src::runner', target: 'src::caller', source_file: 'src/lib/runner.ts' },
      { relation: 'calls', source: 'src::caller', target: 'src::sym', source_file: 'src/lib/runner.ts' },
      { relation: 'imports', source: 'src::file', target: 'src::imported', source_file: 'src/lib/verification.ts' },
      { relation: 'contains', source: 'src::gen', target: 'src::genSym', source_file: 'src/generated/out.js' },
    ],
  });
  writeGraph(repo, 'test', {
    nodes: [
      { id: 'test::file', label: 'verification.test.js', source_file: 'test/verification.test.js' },
      { id: 'test::sym', label: 'coversLedger', source_file: 'test/verification.test.js' },
      { id: 'test::orphan', label: 'orphan.test.js', source_file: 'test/orphan.test.js' },
      { id: 'test::orphanSym', label: 'plan', source_file: 'test/orphan.test.js' },
    ],
    links: [
      { relation: 'contains', source: 'test::file', target: 'test::sym', source_file: 'test/verification.test.js' },
      { relation: 'calls', source: 'test::sym', target: 'src::sym', source_file: 'test/verification.test.js' },
      { relation: 'contains', source: 'test::orphan', target: 'test::orphanSym', source_file: 'test/orphan.test.js' },
    ],
  });
}

test('SCORE table exposes the fixed relation and penalty weights', () => {
  assert.equal(SCORE.uniqueSeedDefinition, 5);
  assert.equal(SCORE.contextHit, 4);
  assert.equal(SCORE.implementationPath, 3);
  assert.equal(SCORE.relationEdge, 2);
  assert.equal(SCORE.connectedTest, 1);
  assert.equal(SCORE.genericNameOnly, -4);
  assert.equal(SCORE.testOnlyUnlinked, -5);
  assert.equal(SCORE.excludedPath, -5);
  assert.equal(SCORE.containsOnly, -3);
});

test('scoreConfidence boundary values 3/4 and 7/8', () => {
  assert.equal(scoreConfidence(3), 'low');
  assert.equal(scoreConfidence(4), 'medium');
  assert.equal(scoreConfidence(7), 'medium');
  assert.equal(scoreConfidence(8), 'high');
});

test('ROLE_PRIORITY ranks implementation before test before context', () => {
  assert.ok(ROLE_PRIORITY.implementation < ROLE_PRIORITY.test);
  assert.ok(ROLE_PRIORITY.test < ROLE_PRIORITY.context);
});

test('ranked high: unique seed + context + implementation + relation scores', () => {
  const repo = tmpRepo();
  connectedFixture(repo);
  const result = graphSuggest({
    repoRoot: repo,
    query: 'verifyLedgerPathFor ledger',
    seeds: ['verifyLedgerPathFor'],
  });
  assert.equal(result.status, 'ranked');
  assert.equal(result.confidence, 'high');
  assert.ok(result.reasons.length > 0);
  assert.match(result.reasons.join('\n'), /context seed/i);
  assert.match(result.reasons.join('\n'), /calls|imports/i);

  const impl = result.candidates.implementation;
  assert.ok(impl.length >= 1);
  const primary = impl.find((c) => c.path === 'src/lib/verification.ts');
  assert.ok(primary, 'implementation owner missing');
  // unique(+5) + context(+4) + impl(+3) + relation via imports neighbor still on owner? owner defines seed
  // At minimum unique+context+impl = 12 → high
  assert.ok(primary.score >= 8, `expected high score, got ${primary.score}`);
  assert.equal(primary.confidence, 'high');
  assert.ok(primary.basis.length > 0);

  const linkedTest = result.candidates.test.find((c) => c.path === 'test/verification.test.js');
  assert.ok(linkedTest, 'connected test missing');
  assert.ok(linkedTest.score >= 1);
  assert.ok(result.suggested_paths.includes('src/lib/verification.ts'));
  assert.ok(result.suggested_paths.includes('test/verification.test.js'));
  assert.ok(!result.suggested_paths.some((p) => p.startsWith('.bouncer/')));
  assert.ok(!result.candidates.implementation.some((c) => c.path.startsWith('graphify-out/')));
});

test('stable sort: equal scores break by role then path ascending', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo, 'context', {
    nodes: [
      { id: 'c1', label: 'Alpha', source_file: '.bouncer/context/a.md' },
      { id: 'c2', label: 'Beta', source_file: '.bouncer/context/b.md' },
    ],
    links: [],
  });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 's1', label: 'Alpha', source_file: 'src/z.ts' },
      { id: 's2', label: 'Beta', source_file: 'src/a.ts' },
      { id: 'sf1', label: 'z.ts', source_file: 'src/z.ts' },
      { id: 'sf2', label: 'a.ts', source_file: 'src/a.ts' },
    ],
    links: [
      { relation: 'contains', source: 'sf1', target: 's1', source_file: 'src/z.ts' },
      { relation: 'contains', source: 'sf2', target: 's2', source_file: 'src/a.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = graphSuggest({ repoRoot: repo, query: 'Alpha Beta', seeds: ['Alpha', 'Beta'] });
  assert.equal(result.status, 'ranked');
  const paths = result.candidates.implementation.map((c) => c.path);
  // same role; path ascending when scores tie
  const a = result.candidates.implementation.find((c) => c.path === 'src/a.ts');
  const z = result.candidates.implementation.find((c) => c.path === 'src/z.ts');
  assert.ok(a && z);
  assert.equal(a.score, z.score);
  assert.deepEqual(
    paths.slice(0, 2),
    ['src/a.ts', 'src/z.ts'],
  );
});

test('ranked medium when best implementation is medium only', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  // context 없음. unique(+5)+impl(+3)+containsOnly(−3)=5 → medium (high는 context 또는 관계 가산 필요)
  writeGraph(repo, 'context', { nodes: [], links: [] });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'def', label: 'UniqueFn', source_file: 'src/core.ts' },
      { id: 'file', label: 'core.ts', source_file: 'src/core.ts' },
      { id: 'neighbor', label: 'helper.ts', source_file: 'src/helper.ts' },
      { id: 'nfile', label: 'helper.ts', source_file: 'src/helper.ts' },
    ],
    links: [
      { relation: 'contains', source: 'file', target: 'def', source_file: 'src/core.ts' },
      { relation: 'imports_from', source: 'neighbor', target: 'def', source_file: 'src/helper.ts' },
      { relation: 'contains', source: 'nfile', target: 'neighbor', source_file: 'src/helper.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = graphSuggest({
    repoRoot: repo,
    query: 'UniqueFn',
    seeds: ['UniqueFn'],
  });
  assert.equal(result.status, 'ranked');
  assert.equal(result.confidence, 'medium');
  const core = result.candidates.implementation.find((c) => c.path === 'src/core.ts');
  assert.ok(core);
  assert.equal(core.confidence, 'medium');
  assert.ok(core.basis.some((b) => /contains-only/i.test(b)));

  const mediumRepo = tmpRepo();
  writeConfig(mediumRepo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(mediumRepo, 'context', { nodes: [], links: [] });
  writeGraph(mediumRepo, 'source', {
    nodes: [
      { id: 'seed', label: 'SharedName', source_file: 'src/a.ts' },
      { id: 'a', label: 'a.ts', source_file: 'src/a.ts' },
      { id: 'seed2', label: 'SharedName', source_file: 'src/b.ts' },
      { id: 'b', label: 'b.ts', source_file: 'src/b.ts' },
      { id: 'nbr', label: 'c.ts', source_file: 'src/c.ts' },
    ],
    links: [
      { relation: 'contains', source: 'a', target: 'seed', source_file: 'src/a.ts' },
      { relation: 'contains', source: 'b', target: 'seed2', source_file: 'src/b.ts' },
      { relation: 'calls', source: 'nbr', target: 'seed', source_file: 'src/c.ts' },
    ],
  });
  writeGraph(mediumRepo, 'test', { nodes: [], links: [] });
  // SharedName is repeated → not unique (+5). context absent.
  // a/b: impl(+3) + generic(-4) + containsOnly(-3) = -4 low; c: impl(+3)+relation(+2)=5 medium
  const medium = graphSuggest({
    repoRoot: mediumRepo,
    query: 'SharedName',
    seeds: ['SharedName'],
  });
  assert.equal(medium.status, 'ranked');
  assert.equal(medium.confidence, 'medium');
  assert.ok(medium.reasons.length > 0);
  assert.ok(medium.candidates.implementation.every((c) => c.confidence !== 'high'));
  assert.ok(medium.candidates.implementation.some((c) => c.confidence === 'medium'));
});

test('low-confidence: no implementation candidates', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', {
    nodes: [{ id: 'c', label: 'OnlyDoc', source_file: '.bouncer/context/note.md' }],
    links: [],
  });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', {
    nodes: [{ id: 't', label: 'OnlyDoc', source_file: 'test/x.test.js' }],
    links: [],
  });
  const result = graphSuggest({ repoRoot: repo, query: 'OnlyDoc', seeds: ['OnlyDoc'] });
  assert.equal(result.status, 'low-confidence');
  assert.equal(result.confidence, 'low');
  assert.deepEqual(result.suggested_paths, []);
  assert.ok(result.reasons.some((r) => /implementation/i.test(r)));
});

test('low-confidence: all implementation candidates are low', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo, 'context', { nodes: [], links: [] });
  // 비일반 반복 심볼 — generic-only 게이트를 피하고 all-low 분기를 고정한다.
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'a', label: 'SharedLow', source_file: 'src/a.ts' },
      { id: 'af', label: 'a.ts', source_file: 'src/a.ts' },
      { id: 'b', label: 'SharedLow', source_file: 'src/b.ts' },
      { id: 'bf', label: 'b.ts', source_file: 'src/b.ts' },
    ],
    links: [
      { relation: 'contains', source: 'af', target: 'a', source_file: 'src/a.ts' },
      { relation: 'contains', source: 'bf', target: 'b', source_file: 'src/b.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'SharedLow', seeds: ['SharedLow'] });
  assert.equal(result.status, 'low-confidence');
  assert.equal(result.confidence, 'low');
  assert.deepEqual(result.suggested_paths, []);
  assert.ok(
    result.reasons.some((r) => /implementation candidates are all low confidence/i.test(r)),
    `expected all-low reason, got: ${result.reasons.join(' | ')}`,
  );
  assert.ok(result.candidates.implementation.length > 0);
  assert.ok(result.candidates.implementation.every((c) => c.confidence === 'low'));
});

test('low-confidence: generic-only seeds', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', {
    nodes: [{ id: 'c', label: 'result', source_file: '.bouncer/context/x.md' }],
    links: [],
  });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'a', label: 'result', source_file: 'src/a.ts' },
      { id: 'b', label: 'result', source_file: 'src/b.ts' },
      { id: 'c', label: 'result', source_file: 'src/c.ts' },
      { id: 'af', label: 'a.ts', source_file: 'src/a.ts' },
      { id: 'bf', label: 'b.ts', source_file: 'src/b.ts' },
      { id: 'cf', label: 'c.ts', source_file: 'src/c.ts' },
    ],
    links: [
      { relation: 'contains', source: 'af', target: 'a', source_file: 'src/a.ts' },
      { relation: 'contains', source: 'bf', target: 'b', source_file: 'src/b.ts' },
      { relation: 'contains', source: 'cf', target: 'c', source_file: 'src/c.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'result plan hook', seeds: ['result', 'plan', 'hook'] });
  assert.equal(result.status, 'low-confidence');
  assert.equal(result.confidence, 'low');
  assert.deepEqual(result.suggested_paths, []);
  assert.ok(result.reasons.some((r) => /generic/i.test(r)));
});

test('low-confidence: result explosion at 50 or more candidates', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo, 'context', {
    nodes: [{ id: 'c', label: 'BoomFn', source_file: '.bouncer/context/x.md' }],
    links: [],
  });
  const nodes = [];
  const links = [];
  nodes.push({ id: 'seed', label: 'BoomFn', source_file: 'src/0.ts' });
  nodes.push({ id: 'seedFile', label: '0.ts', source_file: 'src/0.ts' });
  links.push({ relation: 'contains', source: 'seedFile', target: 'seed', source_file: 'src/0.ts' });
  for (let i = 1; i <= 50; i += 1) {
    const id = `n${i}`;
    const fid = `f${i}`;
    const p = `src/f${i}.ts`;
    nodes.push({ id, label: `Fn${i}`, source_file: p });
    nodes.push({ id: fid, label: `f${i}.ts`, source_file: p });
    links.push({ relation: 'contains', source: fid, target: id, source_file: p });
    links.push({ relation: 'calls', source: id, target: 'seed', source_file: p });
  }
  writeGraph(repo, 'source', { nodes, links });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'BoomFn', seeds: ['BoomFn'] });
  assert.equal(result.status, 'low-confidence');
  assert.equal(result.confidence, 'low');
  assert.deepEqual(result.suggested_paths, []);
  assert.ok(result.reasons.some((r) => /50|explod/i.test(r)));
});

test('low-confidence: top results are test-only', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo, 'context', {
    nodes: [{ id: 'c', label: 'WidgetProbe', source_file: '.bouncer/context/x.md' }],
    links: [],
  });
  // 약한 반복 구현(low) + 연결 테스트가 상위 — generic-only와 섞지 않는다.
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'wa', label: 'WidgetProbe', source_file: 'src/weak-a.ts' },
      { id: 'waf', label: 'weak-a.ts', source_file: 'src/weak-a.ts' },
      { id: 'wb', label: 'WidgetProbe', source_file: 'src/weak-b.ts' },
      { id: 'wbf', label: 'weak-b.ts', source_file: 'src/weak-b.ts' },
    ],
    links: [
      { relation: 'contains', source: 'waf', target: 'wa', source_file: 'src/weak-a.ts' },
      { relation: 'contains', source: 'wbf', target: 'wb', source_file: 'src/weak-b.ts' },
    ],
  });
  writeGraph(repo, 'test', {
    nodes: [
      { id: 't1', label: 'coversA', source_file: 'test/a.test.js' },
      { id: 't1f', label: 'a.test.js', source_file: 'test/a.test.js' },
      { id: 't2', label: 'coversB', source_file: 'test/b.test.js' },
      { id: 't2f', label: 'b.test.js', source_file: 'test/b.test.js' },
      { id: 't3', label: 'coversC', source_file: 'test/c.test.js' },
      { id: 't3f', label: 'c.test.js', source_file: 'test/c.test.js' },
    ],
    links: [
      { relation: 'contains', source: 't1f', target: 't1', source_file: 'test/a.test.js' },
      { relation: 'contains', source: 't2f', target: 't2', source_file: 'test/b.test.js' },
      { relation: 'contains', source: 't3f', target: 't3', source_file: 'test/c.test.js' },
      { relation: 'calls', source: 't1', target: 'wa', source_file: 'test/a.test.js' },
      { relation: 'calls', source: 't2', target: 'wb', source_file: 'test/b.test.js' },
      { relation: 'calls', source: 't3', target: 'wa', source_file: 'test/c.test.js' },
    ],
  });
  const result = graphSuggest({ repoRoot: repo, query: 'WidgetProbe', seeds: ['WidgetProbe'] });
  assert.equal(result.status, 'low-confidence');
  assert.equal(result.confidence, 'low');
  assert.deepEqual(result.suggested_paths, []);
  assert.ok(
    result.reasons.some((r) => /top results are test-only/i.test(r)),
    `expected test-only reason, got: ${result.reasons.join(' | ')}`,
  );
});

test('low-confidence: no source/context functional link', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', {
    nodes: [{ id: 'c', label: 'PastDecisionOnly', source_file: '.bouncer/context/old.md' }],
    links: [],
  });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 's', label: 'UnrelatedFn', source_file: 'src/other.ts' },
      { id: 'sf', label: 'other.ts', source_file: 'src/other.ts' },
    ],
    links: [{ relation: 'contains', source: 'sf', target: 's', source_file: 'src/other.ts' }],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({
    repoRoot: repo,
    query: 'PastDecisionOnly',
    seeds: ['PastDecisionOnly'],
  });
  assert.equal(result.status, 'low-confidence');
  assert.equal(result.confidence, 'low');
  assert.deepEqual(result.suggested_paths, []);
  assert.ok(result.reasons.some((r) => /link|connect|source.*context|context.*source/i.test(r)));
});

test('unavailable when source graph cannot be read', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', {
    nodes: [{ id: 'c', label: 'X', source_file: '.bouncer/context/x.md' }],
    links: [],
  });
  // source graph.json 부재
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'X', seeds: ['X'] });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.confidence, 'low');
  assert.deepEqual(result.suggested_paths, []);
  assert.ok(result.reasons.length > 0);
  assert.ok(result.reasons.some((r) => /source/i.test(r)));
});

test('corrupt partial graph keeps valid nodes and records omissions in reasons', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', {
    nodes: [
      { id: 'c', label: 'GoodSym', source_file: '.bouncer/context/x.md' },
      { label: 'no-id' },
      null,
    ],
    links: [
      { relation: 'contains', source: 'c', target: 'missing' },
      { relation: 'weird_unknown', source: 'c', target: 'c' },
      'bad-link',
    ],
  });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 's', label: 'GoodSym', source_file: 'src/good.ts' },
      { id: 'sf', label: 'good.ts', source_file: 'src/good.ts' },
      { id: 'bad', label: 'NoPath' },
      { id: 'gout', label: 'leak', source_file: 'graphify-out/source/parts/x.ts' },
    ],
    links: [
      { relation: 'contains', source: 'sf', target: 's', source_file: 'src/good.ts' },
      { relation: 'calls', source: 's', target: 'missing-target', source_file: 'src/good.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'GoodSym', seeds: ['GoodSym'] });
  assert.ok(['ranked', 'low-confidence'].includes(result.status));
  assert.ok(result.reasons.some((r) => /omit|invalid|unknown|corrupt|skip/i.test(r)));
  assert.ok(!result.candidates.implementation.some((c) => !c.path));
  assert.ok(!result.candidates.implementation.some((c) => c.path.startsWith('graphify-out/')));
  assert.ok(result.candidates.implementation.some((c) => c.path === 'src/good.ts'));
});

test('contains is not used to BFS from generic nouns', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo, 'context', { nodes: [], links: [] });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'file', label: 'big.ts', source_file: 'src/big.ts' },
      { id: 'gen', label: 'plan', source_file: 'src/big.ts' },
      { id: 'other', label: 'secretHelper', source_file: 'src/big.ts' },
      { id: 'otherFile', label: 'other.ts', source_file: 'src/other.ts' },
      { id: 'otherSym', label: 'secretHelper', source_file: 'src/other.ts' },
    ],
    links: [
      { relation: 'contains', source: 'file', target: 'gen', source_file: 'src/big.ts' },
      { relation: 'contains', source: 'file', target: 'other', source_file: 'src/big.ts' },
      { relation: 'contains', source: 'otherFile', target: 'otherSym', source_file: 'src/other.ts' },
      // plan --contains--> would wrongly pull secretHelper siblings if BFS used contains
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'plan', seeds: ['plan'] });
  // sibling via contains must not appear as relation expansion
  assert.ok(!result.candidates.implementation.some((c) => c.path === 'src/other.ts'));
});

test('relation scoring applies calls imports imports_from and contains-only penalty', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo, 'context', {
    nodes: [{ id: 'c', label: 'RelSym', source_file: '.bouncer/context/x.md' }],
    links: [],
  });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'def', label: 'RelSym', source_file: 'src/def.ts' },
      { id: 'deff', label: 'def.ts', source_file: 'src/def.ts' },
      { id: 'call', label: 'caller.ts', source_file: 'src/caller.ts' },
      { id: 'imp', label: 'importer.ts', source_file: 'src/importer.ts' },
      { id: 'impf', label: 'from.ts', source_file: 'src/from.ts' },
      { id: 'onlyContains', label: 'RelSymExtra', source_file: 'src/def.ts' },
    ],
    links: [
      { relation: 'contains', source: 'deff', target: 'def', source_file: 'src/def.ts' },
      { relation: 'contains', source: 'deff', target: 'onlyContains', source_file: 'src/def.ts' },
      { relation: 'calls', source: 'call', target: 'def', source_file: 'src/caller.ts' },
      { relation: 'imports', source: 'imp', target: 'def', source_file: 'src/importer.ts' },
      { relation: 'imports_from', source: 'impf', target: 'def', source_file: 'src/from.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'RelSym', seeds: ['RelSym'] });
  assert.equal(result.status, 'ranked');
  const byPath = Object.fromEntries(result.candidates.implementation.map((c) => [c.path, c]));
  assert.ok(byPath['src/caller.ts'], 'calls neighbor');
  assert.ok(byPath['src/importer.ts'], 'imports neighbor');
  assert.ok(byPath['src/from.ts'], 'imports_from neighbor');
  // relation neighbors should carry relation basis (+2) and not be contains-only
  assert.ok(byPath['src/caller.ts'].basis.some((b) => /calls|relation/i.test(b)));
  assert.ok(!byPath['src/caller.ts'].basis.some((b) => /contains-only/i.test(b)));
  // 소유 파일은 contains로만 도달 → −3와 basis 고정
  assert.ok(byPath['src/def.ts'], 'definition owner');
  assert.ok(byPath['src/def.ts'].basis.some((b) => /contains-only/i.test(b)));
  assert.ok(
    byPath['src/def.ts'].score
      <= SCORE.uniqueSeedDefinition + SCORE.contextHit + SCORE.implementationPath + SCORE.containsOnly,
  );
  // unique(+5)+context(+4)+impl(+3)+containsOnly(−3) = 9
  assert.equal(
    byPath['src/def.ts'].score,
    SCORE.uniqueSeedDefinition + SCORE.contextHit + SCORE.implementationPath + SCORE.containsOnly,
  );
});

test('excluded path penalty and drop of pathless or graphify-out candidates', () => {
  const repo = tmpRepo();
  connectedFixture(repo);
  const result = graphSuggest({
    repoRoot: repo,
    query: 'verifyLedgerPathFor',
    seeds: ['verifyLedgerPathFor'],
  });
  assert.ok(!result.candidates.implementation.some((c) => c.path.startsWith('src/generated/')));
  assert.ok(!result.suggested_paths.some((p) => p.startsWith('src/generated/')));
});

test('unlinked test-only gets penalty and is not suggested', () => {
  const repo = tmpRepo();
  connectedFixture(repo);
  const result = graphSuggest({
    repoRoot: repo,
    query: 'verifyLedgerPathFor plan',
    seeds: ['verifyLedgerPathFor', 'plan'],
  });
  const orphan = result.candidates.test.find((c) => c.path === 'test/orphan.test.js');
  if (orphan) {
    assert.ok(orphan.score <= SCORE.connectedTest + SCORE.testOnlyUnlinked);
    assert.ok(orphan.basis.some((b) => /test-only|unlinked|no implementation/i.test(b)));
  }
  assert.ok(!result.suggested_paths.includes('test/orphan.test.js'));
});

test('every status returns non-empty reasons', () => {
  const cases = [];
  {
    const repo = tmpRepo();
    connectedFixture(repo);
    cases.push(graphSuggest({ repoRoot: repo, query: 'verifyLedgerPathFor', seeds: ['verifyLedgerPathFor'] }));
  }
  {
    const repo = tmpRepo();
    writeConfig(repo);
    writeGraph(repo, 'context', { nodes: [], links: [] });
    // no source
    cases.push(graphSuggest({ repoRoot: repo, query: 'x', seeds: ['x'] }));
  }
  {
    const repo = tmpRepo();
    writeConfig(repo);
    writeGraph(repo, 'context', { nodes: [], links: [] });
    writeGraph(repo, 'source', { nodes: [], links: [] });
    writeGraph(repo, 'test', { nodes: [], links: [] });
    cases.push(graphSuggest({ repoRoot: repo, query: 'nothing', seeds: ['nothing'] }));
  }
  for (const result of cases) {
    assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0, JSON.stringify(result));
    assert.ok(result.reasons.every((r) => typeof r === 'string' && r.length > 0));
  }
});

test('trailing-paren source label matches bare seed as implementation', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', { nodes: [], links: [] });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'src::file', label: 'graphify.ts', source_file: 'src/lib/graphify.ts' },
      { id: 'src::sym', label: 'setupGraphify()', source_file: 'src/lib/graphify.ts' },
    ],
    links: [
      { relation: 'contains', source: 'src::file', target: 'src::sym', source_file: 'src/lib/graphify.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'graphify', seeds: ['setupGraphify'] });
  assert.ok(result.candidates.implementation.some((c) => c.path === 'src/lib/graphify.ts'));
});

test('empty lookup key from () label is not indexed for seed match', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', { nodes: [], links: [] });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'a::file', label: 'a.ts', source_file: 'src/a.ts' },
      { id: 'a::sym', label: '()', source_file: 'src/a.ts' },
      { id: 'b::file', label: 'b.ts', source_file: 'src/b.ts' },
      { id: 'b::sym', label: '()', source_file: 'src/b.ts' },
    ],
    links: [
      { relation: 'contains', source: 'a::file', target: 'a::sym', source_file: 'src/a.ts' },
      { relation: 'contains', source: 'b::file', target: 'b::sym', source_file: 'src/b.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'empty', seeds: ['()'] });
  const implPaths = result.candidates.implementation.map((c) => c.path);
  assert.ok(
    !(implPaths.includes('src/a.ts') && implPaths.includes('src/b.ts')),
    `() seed must not surface both empty-key files together, got: ${implPaths.join(', ')}`,
  );
});

test('trailing paren with spaces trims to same lookup key as bare seed', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', { nodes: [], links: [] });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'src::file', label: 'graphify.ts', source_file: 'src/lib/graphify.ts' },
      { id: 'src::sym', label: 'setupGraphify ()', source_file: 'src/lib/graphify.ts' },
    ],
    links: [
      { relation: 'contains', source: 'src::file', target: 'src::sym', source_file: 'src/lib/graphify.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'graphify', seeds: ['setupGraphify'] });
  assert.ok(result.candidates.implementation.some((c) => c.path === 'src/lib/graphify.ts'));
});

test('fixed corpus measures context contribution without changing recommendation policy', () => {
  const topK = qualityFixture.meta.context_contribution.top_k;

  for (const caseEntry of qualityFixture.cases) {
    const withoutContext = graphSuggest({
      repoRoot: materializeQualityCase(caseEntry, false),
      query: caseEntry.query,
      seeds: caseEntry.seeds,
    });
    const withContext = graphSuggest({
      repoRoot: materializeQualityCase(caseEntry, true),
      query: caseEntry.query,
      seeds: caseEntry.seeds,
    });
    const expected = caseEntry.context_contribution;
    const expectedBaselines = expected.baselines;
    const goldPaths = [...caseEntry.gold.implementation, ...caseEntry.gold.test];
    const extraPaths = withContext.suggested_paths
      .filter((candidate) => !withoutContext.suggested_paths.includes(candidate));
    const baselineFalsePositives = falsePositiveCount(withoutContext, goldPaths, topK);
    const contextFalsePositives = falsePositiveCount(withContext, goldPaths, topK);

    for (const [name, result] of Object.entries({ without_context: withoutContext, with_context: withContext })) {
      const baseline = expectedBaselines[name];
      // These fixed source/test sets catch ranking or confidence changes that aggregate
      // contribution metrics can hide (for example, a same-size path replacement).
      assert.deepEqual(result.suggested_paths, baseline.suggested_paths, `${caseEntry.id}: ${name} paths`);
      assert.deepEqual(
        {
          implementation: result.candidates.implementation.map((candidate) => candidate.path),
          test: result.candidates.test.map((candidate) => candidate.path),
        },
        baseline.candidates,
        `${caseEntry.id}: ${name} source/test candidates`,
      );
      assert.equal(result.status, baseline.status, `${caseEntry.id}: ${name} status`);
      assert.equal(result.confidence, baseline.confidence, `${caseEntry.id}: ${name} confidence`);
    }

    assert.equal(extraPaths.length, expected.extra_paths, `${caseEntry.id}: extra paths`);
    assert.equal(
      topKRecall(withoutContext, goldPaths, topK),
      expected.top_k_recall.without_context,
      `${caseEntry.id}: baseline top-${topK} recall`,
    );
    assert.equal(
      topKRecall(withContext, goldPaths, topK),
      expected.top_k_recall.with_context,
      `${caseEntry.id}: context top-${topK} recall`,
    );
    assert.equal(
      baselineFalsePositives,
      expected.false_positives.without_context,
      `${caseEntry.id}: baseline false positives`,
    );
    assert.equal(
      contextFalsePositives,
      expected.false_positives.with_context,
      `${caseEntry.id}: context false positives`,
    );
    assert.ok(
      contextFalsePositives <= baselineFalsePositives,
      `${caseEntry.id}: context false positives must not exceed the baseline`,
    );
  }
});

test('fixed corpus exposes a current-draft context self-hit separately from path suggestions', () => {
  const draft = qualityFixture.draft_self_hit;
  const policy = qualityFixture.meta.context_contribution.policy;
  const result = graphSuggest({
    repoRoot: materializeQualityCase(draft, true),
    query: draft.query,
    seeds: draft.seeds,
  });
  const contextPaths = result.candidates.context.map((candidate) => candidate.path);
  const selfHitRatio = contextPaths.filter((candidate) => candidate === draft.draft_path).length
    / contextPaths.length;

  assert.equal(selfHitRatio, draft.expected_ratio);
  assert.equal(policy.false_positive_comparison, 'context must not exceed the source/test baseline');
  assert.equal(policy.max_self_hit_ratio, 0);
  // 사후 context 검색은 현재 draft를 되찾아 0 임계치를 넘는다. 이 fixture는
  // pre-scaffold 순서를 깨뜨렸을 때 policy 통과로 오인하지 않게 하는 실패 모델이다.
  assert.ok(selfHitRatio > policy.max_self_hit_ratio);
  assert.ok(!result.suggested_paths.includes(draft.draft_path));
});

test('context-search JSON schema owns mode enum and max-candidates 1..8', () => {
  assert.deepEqual(CONTEXT_SEARCH_INPUT_SCHEMA.properties.mode.enum, [...SEARCH_MODES]);
  assert.equal(CONTEXT_SEARCH_INPUT_SCHEMA.properties.maxCandidates.minimum, 1);
  assert.equal(CONTEXT_SEARCH_INPUT_SCHEMA.properties.maxCandidates.maximum, 8);
  assert.equal(validateContextSearchInput({ mode: 'decision', query: 'epic-060' }), null);
  assert.equal(validateContextSearchInput({
    mode: 'history',
    query: 'bp-060-001',
    maxCandidates: 4,
    seeds: ['epic-060'],
  }), null);
  assert.match(
    String(validateContextSearchInput({ mode: 'other', query: 'epic-060' })),
    /mode/,
  );
  assert.match(
    String(validateContextSearchInput({ mode: 'decision', query: 'epic-060', maxCandidates: 9 })),
    /max-candidates/,
  );
  assert.match(
    String(validateContextSearchInput({ mode: 'decision', query: 'epic-060', maxCandidates: 0 })),
    /max-candidates/,
  );
  assert.match(
    String(validateContextSearchInput({ mode: 'decision', query: '' })),
    /query/,
  );
});

test('normalizeQuery maps confirmed Korean vocabulary and keeps anchors and paths', () => {
  const korean = normalizeQuery('결정 검색 epic-060');
  assert.ok(korean.terms.includes('decision'));
  assert.ok(korean.terms.includes('epic-060'));
  assert.ok(!korean.genericOnly);

  const generic = normalizeQuery('plan test result');
  assert.equal(generic.genericOnly, true);
  assert.ok(generic.terms.length > 0);

  const unknownKorean = normalizeQuery('알 수 없는 문장만');
  assert.equal(unknownKorean.terms.length === 0, true);
});

test('file-level corpus scoring applies exact, tag, intent, evidence, and structural weights', () => {
  const repo = tmpRepo();
  const epic = '.bouncer/context/epics/060-x';
  const bp = `${epic}/blueprints/001-y`;
  fs.mkdirSync(path.join(repo, bp), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  writeConfig(repo, {
    source_dirs: ['scripts/src'],
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '## Shards\n\n- core\n');
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), [
    '---',
    'type: bouncer.epic',
    'tags:',
    '  - bouncer',
    '  - epic',
    '  - graphify-search-quality',
    'bouncer:',
    "  epic_id: '060'",
    '  status: approved',
    '---',
    '',
    '## Success criteria',
    '',
    'graphify-search-quality ranked retrieval',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, `${bp}/index.md`), [
    '---',
    'type: bouncer.blueprint',
    'tags:',
    '  - bouncer',
    '  - blueprint',
    'bouncer:',
    "  epic_id: '060'",
    "  blueprint_id: '001'",
    '  status: closed',
    '---',
    '',
    '## Intent',
    '',
    'context-first ranking',
    '',
    '## Contract',
    '',
    'closed evidence for graphify-search-quality',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, `${bp}/explain.md`), [
    '---',
    'type: bouncer.explain',
    'tags:',
    '  - bouncer',
    '  - explain',
    'bouncer:',
    "  epic_id: '060'",
    "  blueprint_id: '001'",
    '  status: published',
    '---',
    '',
    '## Background',
    '',
    'closed explain background',
    '',
    '## Intuition',
    '',
    'seed then expand',
    '',
    '## Code',
    '',
    'graphSuggest',
    '',
  ].join('\n'));
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', {
    nodes: [
      { id: 'e', label: 'epic-060', source_file: `${epic}/index.md` },
      { id: 't', label: 'graphify-search-quality', source_file: `${epic}/index.md` },
      { id: 'b', label: 'bp-060-001', source_file: `${bp}/index.md` },
      { id: 'x', label: 'explain', source_file: `${bp}/explain.md` },
    ],
    links: [],
  });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'epic-060 graphify-search-quality',
  });
  assert.equal(result.status, 'ranked');
  const epicHit = result.candidates.find((row) => row.path === `${epic}/index.md`);
  assert.ok(epicHit);
  assert.ok(epicHit.score >= CORPUS_SCORE.exactAnchorOrPath);
  assert.ok(epicHit.basis.some((b) => /exact anchor|path/i.test(b)));
  assert.ok(epicHit.anchors.includes('epic-060'));
  assert.ok(epicHit.tags.includes('graphify-search-quality'));

  const closed = result.candidates.find((row) => row.path === `${bp}/index.md`);
  assert.ok(closed);
  assert.ok(closed.score >= CORPUS_SCORE.closedEvidenceSection || closed.basis.length > 0);
  assert.ok(closed.basis.some((b) => /closed evidence/i.test(b)));
});

test('closed evidence +3 comes from digest body not graph labels', () => {
  const repo = tmpRepo();
  const bp = '.bouncer/context/epics/083-labelonly/blueprints/001-doc';
  fs.mkdirSync(path.join(repo, bp), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  writeConfig(repo, {
    source_dirs: ['scripts/src'],
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  });
  fs.writeFileSync(path.join(repo, `${bp}/index.md`), [
    '---',
    'type: bouncer.blueprint',
    'tags:',
    '  - bouncer',
    '  - blueprint',
    '  - uniquelabelxyz',
    'bouncer:',
    "  epic_id: '083'",
    "  blueprint_id: '001'",
    '  status: closed',
    '---',
    '',
    '## Intent',
    '',
    'plain closed body without the label token',
    '',
    '## Contract',
    '',
    'plain closed body without the label token',
    '',
  ].join('\n'));
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', {
    nodes: [{ id: 'b', label: 'uniquelabelxyz', source_file: `${bp}/index.md` }],
    links: [],
  });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'uniquelabelxyz',
  });
  assert.equal(result.status, 'ranked');
  const closed = result.candidates.find((row) => row.path === `${bp}/index.md`);
  assert.ok(closed);
  assert.equal(closed.score, CORPUS_SCORE.domainTag);
  assert.ok(!closed.basis.some((b) => /closed evidence/i.test(b)));
});

test('structural heading query applies the locked -5 weight', () => {
  const repo = tmpRepo();
  const bp = '.bouncer/context/epics/081-struct/blueprints/001-doc';
  fs.mkdirSync(path.join(repo, bp), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  writeConfig(repo, {
    source_dirs: ['scripts/src'],
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  });
  fs.writeFileSync(path.join(repo, `${bp}/index.md`), [
    '---',
    'type: bouncer.blueprint',
    'tags:',
    '  - bouncer',
    '  - blueprint',
    'bouncer:',
    "  epic_id: '081'",
    "  blueprint_id: '001'",
    '  status: approved',
    '---',
    '',
    '## Intent',
    '',
    'template heading only',
    '',
    '## Contract',
    '',
    'template heading only',
    '',
  ].join('\n'));
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', {
    nodes: [{ id: 'b', label: 'Intent', source_file: `${bp}/index.md` }],
    links: [],
  });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'intent',
  });
  assert.equal(result.status, 'ranked');
  const hit = result.candidates.find((row) => row.path === `${bp}/index.md`);
  assert.ok(hit);
  assert.equal(hit.score, CORPUS_SCORE.taskOnlyOrStructuralHeading);
  assert.ok(hit.basis.some((b) => /task-only or structural heading/i.test(b)));
});

test('structural heading -5 applies only to docs that hit those headings', () => {
  const repo = tmpRepo();
  const epic = '.bouncer/context/epics/085-structpen';
  const startRel = `${epic}/blueprints/001-start/index.md`;
  fs.mkdirSync(path.join(repo, `${epic}/blueprints/001-start`), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  writeConfig(repo, {
    source_dirs: ['scripts/src'],
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  });
  fs.writeFileSync(path.join(repo, startRel), [
    '---',
    'type: bouncer.blueprint',
    'tags:',
    '  - bouncer',
    '  - blueprint',
    'bouncer:',
    "  epic_id: '085'",
    "  blueprint_id: '001'",
    '  status: approved',
    '---',
    '',
    '## Intent',
    '',
    'template heading only',
    '',
    '## Contract',
    '',
    'template heading only',
    '',
  ].join('\n'));
  const extraRels = [];
  const nodes = [{ id: 'start', label: 'Intent', source_file: startRel }];
  for (let i = 2; i <= 10; i += 1) {
    const id = String(i).padStart(3, '0');
    const rel = `${epic}/blueprints/${id}-filler/index.md`;
    extraRels.push(rel);
    fs.mkdirSync(path.join(repo, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), [
      '---',
      'type: bouncer.blueprint',
      'tags:',
      '  - bouncer',
      '  - blueprint',
      'bouncer:',
      "  epic_id: '085'",
      `  blueprint_id: '${id}'`,
      '  status: approved',
      '---',
      '',
      '## Intent',
      '',
      'plain ranked retrieval body',
      '',
      '## Contract',
      '',
      'plain ranked retrieval body',
      '',
    ].join('\n'));
    nodes.push({ id: `f${id}`, label: `bp-085-${id}`, source_file: rel });
  }
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', { nodes, links: [] });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'intent',
  });
  assert.notEqual(result.status, 'low-confidence: broad-query');
  assert.equal(result.status, 'ranked');
  assert.ok(result.eligible_document_count > 8);
  const startHit = result.candidates.find((row) => row.path === startRel);
  assert.ok(startHit);
  assert.equal(startHit.score, CORPUS_SCORE.taskOnlyOrStructuralHeading);
  const penalizedExtras = result.candidates.filter((row) => (
    extraRels.includes(row.path) && row.score === CORPUS_SCORE.taskOnlyOrStructuralHeading
  ));
  assert.equal(penalizedExtras.length, 0);
  assert.ok(!extraRels.every((rel) => result.candidates.some((row) => row.path === rel)));
});

test('zero-hit retry ranks after camelCase to kebab command expansion', () => {
  const repo = tmpRepo();
  const bp = '.bouncer/context/epics/084-synonym/blueprints/001-doc';
  fs.mkdirSync(path.join(repo, bp), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  writeConfig(repo, {
    source_dirs: ['scripts/src'],
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  });
  fs.writeFileSync(path.join(repo, `${bp}/index.md`), [
    '---',
    'type: bouncer.blueprint',
    'tags:',
    '  - bouncer',
    '  - blueprint',
    'bouncer:',
    "  epic_id: '084'",
    "  blueprint_id: '001'",
    '  status: closed',
    '---',
    '',
    '## Intent',
    '',
    'public command context-search retrieval',
    '',
    '## Contract',
    '',
    'ranked context-search candidates',
    '',
  ].join('\n'));
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', {
    nodes: [{ id: 'b', label: 'bp-084-001', source_file: `${bp}/index.md` }],
    links: [],
  });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const miss = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'contextSearch',
  });
  assert.equal(miss.status, 'ranked');
  const hit = miss.candidates.find((row) => row.path === `${bp}/index.md`);
  assert.ok(hit);
  assert.ok(hit.score > 0);
});

test('zero-hit retry does not promote a missed blueprint to the parent epic', () => {
  const repo = tmpRepo();
  const epic = '.bouncer/context/epics/060-x';
  fs.mkdirSync(path.join(repo, epic), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  writeConfig(repo, {
    source_dirs: ['scripts/src'],
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  });
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), [
    '---',
    'type: bouncer.epic',
    'tags:',
    '  - bouncer',
    '  - epic',
    'bouncer:',
    "  epic_id: '060'",
    '  status: approved',
    '---',
    '',
    '## Success criteria',
    '',
    'parent epic body',
    '',
  ].join('\n'));
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', {
    nodes: [{ id: 'e', label: 'epic-060', source_file: `${epic}/index.md` }],
    links: [],
  });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'bp-060-999',
  });
  assert.equal(result.status, 'zero-hit');
  assert.deepEqual(result.candidates, []);
});

test('document start with all-zero scores is low-confidence not zero-hit', () => {
  const repo = tmpRepo();
  const epic = '.bouncer/context/epics/082-zeroscore';
  fs.mkdirSync(path.join(repo, epic), { recursive: true });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  writeConfig(repo, {
    source_dirs: ['scripts/src'],
    graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] },
  });
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), [
    '---',
    'type: bouncer.epic',
    'tags:',
    '  - bouncer',
    '  - epic',
    'bouncer:',
    "  epic_id: '082'",
    '  status: approved',
    '---',
    '',
    '## Success criteria',
    '',
    'uniquetermxyz appears in the evidence body',
    '',
  ].join('\n'));
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  writeGraph(repo, 'context', {
    nodes: [{ id: 'e', label: 'zeroscore-epic', source_file: `${epic}/index.md` }],
    links: [],
  });
  writeGraph(repo, 'source', { nodes: [], links: [] });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const result = contextSearch({
    repoRoot: repo,
    mode: 'decision',
    query: 'uniquetermxyz',
  });
  assert.equal(result.status, 'low-confidence');
  assert.deepEqual(result.candidates, []);
});

test('implementation mode still returns graphSuggest-compatible source files', () => {
  const repo = tmpRepo();
  connectedFixture(repo);
  const suggest = graphSuggest({
    repoRoot: repo,
    query: 'verifyLedgerPathFor ledger',
    seeds: ['verifyLedgerPathFor'],
  });
  assert.equal(suggest.status, 'ranked');
  assert.ok(suggest.candidates.implementation.some((c) => c.path === 'src/lib/verification.ts'));

  const search = contextSearch({
    repoRoot: repo,
    mode: 'implementation',
    query: 'verifyLedgerPathFor',
    seeds: ['verifyLedgerPathFor'],
  });
  assert.equal(search.status, 'ranked');
  assert.ok(search.candidates.some((row) => row.path === 'src/lib/verification.ts'));
});

test('implementation mode feeds graphSuggest normalized Korean command terms', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'context', { nodes: [], links: [] });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'src::file', label: 'graph-search.ts', source_file: 'scripts/src/lib/graph-search.ts' },
      { id: 'src::sym', label: 'graphSuggest', source_file: 'scripts/src/lib/graph-search.ts' },
    ],
    links: [
      {
        relation: 'contains',
        source: 'src::file',
        target: 'src::sym',
        source_file: 'scripts/src/lib/graph-search.ts',
      },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });

  const search = contextSearch({
    repoRoot: repo,
    mode: 'implementation',
    query: '그래프 제안',
  });
  assert.equal(search.status, 'ranked');
  assert.ok(search.candidates.some((row) => row.path === 'scripts/src/lib/graph-search.ts'));
});
