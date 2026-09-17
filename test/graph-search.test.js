'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  graphSuggest,
  scoreConfidence,
  tokenize,
  ROLE_PRIORITY,
  SCORE,
} = require('../scripts/lib/graph-search');

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
 * 최소 연결 그래프: source가 정의를 소유하며
 * calls/imports로 이웃을 열고, test가 구현 심볼을 호출한다.
 */
function connectedFixture(repo) {
  writeConfig(repo);
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
  assert.equal(SCORE.implementationPath, 3);
  assert.equal(SCORE.relationEdge, 2);
  assert.equal(SCORE.connectedTest, 1);
  assert.equal(SCORE.genericNameOnly, -4);
  assert.equal(SCORE.testOnlyUnlinked, -5);
  assert.equal(SCORE.excludedPath, -5);
  assert.equal(SCORE.containsOnly, -3);
  assert.equal(SCORE.contextHit, undefined);
});

// context-search 공개 surface는 TASKS-001에서 제거됐다. 재도입되면 이 네 단언이 깨진다.
test('graph-search does not export retired context-search surface', () => {
  const graphSearch = require('../scripts/lib/graph-search');
  assert.equal(graphSearch.contextSearch, undefined);
  assert.equal(graphSearch.validateContextSearchInput, undefined);
  assert.equal(graphSearch.normalizeQuery, undefined);
  assert.equal(graphSearch.CONTEXT_SEARCH_INPUT_SCHEMA, undefined);
});

test('scoreConfidence boundary values 3/4 and 7/8', () => {
  assert.equal(scoreConfidence(3), 'low');
  assert.equal(scoreConfidence(4), 'medium');
  assert.equal(scoreConfidence(7), 'medium');
  assert.equal(scoreConfidence(8), 'high');
});

test('ROLE_PRIORITY ranks implementation before test', () => {
  assert.ok(ROLE_PRIORITY.implementation < ROLE_PRIORITY.test);
  assert.equal(ROLE_PRIORITY.context, undefined);
});

// TASKS-002: context graph를 열지 않으면 손상된 context/graph.json 이 있어도 동일 결과여야 한다.
test('graphSuggest ignores broken context graph and omits context candidates', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'sf', label: 'x.ts', source_file: 'src/x.ts' },
      { id: 's', label: 'uniqueSym', source_file: 'src/x.ts' },
    ],
    links: [
      { relation: 'contains', source: 'sf', target: 's', source_file: 'src/x.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const base = graphSuggest({ repoRoot: repo, query: 'q', seeds: ['uniqueSym'] });
  fs.mkdirSync(path.join(repo, 'graphify-out/context'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'graphify-out/context/graph.json'), '{');
  const withBroken = graphSuggest({ repoRoot: repo, query: 'q', seeds: ['uniqueSym'] });
  assert.deepStrictEqual(withBroken, base);
  assert.deepStrictEqual(Object.keys(base.candidates), ['implementation', 'test']);
  assert.ok(base.reasons.every((r) => !/^context/.test(r)));
});

test('ranked high: unique seed + implementation + relation scores', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  // unique(+5)+impl(+3)+relation(+2)=10.
  // contains 소유가 있으면 containsOnly(−3)가 붙고, 양끝 start면 relation 마크가
  // 건너뛰어지므로 — 심볼은 source_file만 두고 caller→file imports로 +2를 연다.
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'src::file', label: 'owner.ts', source_file: 'src/owner.ts' },
      { id: 'src::sym', label: 'uniqueSym', source_file: 'src/owner.ts' },
      { id: 'src::nbr', label: 'nbr.ts', source_file: 'src/nbr.ts' },
      { id: 'src::caller', label: 'callFromNbr', source_file: 'src/nbr.ts' },
    ],
    links: [
      { relation: 'contains', source: 'src::nbr', target: 'src::caller', source_file: 'src/nbr.ts' },
      { relation: 'calls', source: 'src::caller', target: 'src::sym', source_file: 'src/nbr.ts' },
      { relation: 'imports', source: 'src::caller', target: 'src::file', source_file: 'src/nbr.ts' },
    ],
  });
  writeGraph(repo, 'test', {
    nodes: [
      { id: 'test::file', label: 'owner.test.js', source_file: 'test/owner.test.js' },
      { id: 'test::sym', label: 'coversUnique', source_file: 'test/owner.test.js' },
    ],
    links: [
      { relation: 'contains', source: 'test::file', target: 'test::sym', source_file: 'test/owner.test.js' },
      { relation: 'calls', source: 'test::sym', target: 'src::sym', source_file: 'test/owner.test.js' },
    ],
  });
  const result = graphSuggest({
    repoRoot: repo,
    query: 'uniqueSym',
    seeds: ['uniqueSym'],
  });
  assert.equal(result.status, 'ranked');
  assert.equal(result.confidence, 'high');
  assert.ok(result.reasons.length > 0);
  assert.ok(result.reasons.every((r) => !/^context/.test(r)));
  assert.ok(result.reasons.includes('result.ranked'));
  assert.deepStrictEqual(Object.keys(result.candidates), ['implementation', 'test']);

  const impl = result.candidates.implementation;
  assert.ok(impl.length >= 1);
  const primary = impl.find((c) => c.path === 'src/owner.ts');
  assert.ok(primary, 'implementation owner missing');
  assert.equal(primary.score, 10);
  assert.equal(primary.role, 'implementation');
  assert.ok(primary.basis.includes('seed.unique'));
  assert.ok(primary.basis.includes('role.implementation'));
  // relation evidence는 compact basis code로만 기본 응답에 남는다.
  assert.ok(
    primary.basis.some((b) => b === 'rel.calls' || b === 'rel.imports'),
    `expected rel.* basis, got: ${primary.basis.join(',')}`,
  );

  const linkedTest = result.candidates.test.find((c) => c.path === 'test/owner.test.js');
  assert.ok(linkedTest, 'connected test missing');
  assert.ok(linkedTest.score >= 1);
  assert.ok(linkedTest.basis.includes('test.connected'));
  assert.ok(result.suggested_paths.includes('src/owner.ts'));
  assert.ok(result.suggested_paths.includes('test/owner.test.js'));
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
  assert.ok(core.score >= 4 && core.score < 8);
  assert.ok(core.basis.includes('reach.contains_only'));

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
  assert.ok(medium.candidates.implementation.every((c) => c.score < 8));
  assert.ok(medium.candidates.implementation.some((c) => c.score >= 4));
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
  assert.ok(result.reasons.includes('implementation.none'));
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
    result.reasons.includes('implementation.low_only'),
    `expected implementation.low_only, got: ${result.reasons.join(' | ')}`,
  );
  // 기본 후보는 threshold(≥4)만 남기므로 all-low에서는 비운다. 상세는 debug에만.
  assert.deepEqual(result.candidates.implementation, []);
  const debug = graphSuggest({
    repoRoot: repo,
    query: 'SharedLow',
    seeds: ['SharedLow'],
    debug: true,
  });
  assert.ok(debug.debug.candidates.implementation.length > 0);
  assert.ok(debug.debug.candidates.implementation.every((c) => c.confidence === 'low'));
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
  assert.ok(result.reasons.includes('seed.generic_only'));
});

test('low-confidence: seed fan-out supersedes legacy 50-candidate explosion', () => {
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
  // 50 neighbors는 fan-out 8을 먼저 넘긴다 — 부분 ranked 없이 low-confidence.
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
  assert.ok(result.reasons.includes('seed.fanout_cap'));
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
  // 약한 반복 구현은 score < 4라 implementation.low_only로 수렴한다(구 test-only 분기 대체).
  assert.ok(
    result.reasons.includes('implementation.low_only'),
    `expected implementation.low_only, got: ${result.reasons.join(' | ')}`,
  );
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
  assert.ok(result.reasons.includes('source.unavailable'));
});

test('corrupt partial graph keeps valid nodes and records omissions in reasons', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  // context graph는 더 이상 읽지 않으므로 omission 단언은 source 손상 항목으로 고정한다.
  writeGraph(repo, 'source', {
    nodes: [
      { id: 's', label: 'GoodSym', source_file: 'src/good.ts' },
      { id: 'sf', label: 'good.ts', source_file: 'src/good.ts' },
      { id: 'bad', label: 'NoPath' },
      { id: 'gout', label: 'leak', source_file: 'graphify-out/source/parts/x.ts' },
      { label: 'no-id' },
      null,
    ],
    links: [
      { relation: 'contains', source: 'sf', target: 's', source_file: 'src/good.ts' },
      { relation: 'calls', source: 's', target: 'missing-target', source_file: 'src/good.ts' },
      { relation: 'weird_unknown', source: 's', target: 's' },
      'bad-link',
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'GoodSym', seeds: ['GoodSym'], debug: true });
  assert.ok(['ranked', 'low-confidence'].includes(result.status));
  assert.ok(result.reasons.includes('source.omitted'));
  assert.ok(result.debug.omissions.some((r) => /omit|invalid|unknown|corrupt|skip/i.test(r)));
  assert.ok(!result.candidates.implementation.some((c) => !c.path));
  assert.ok(!result.candidates.implementation.some((c) => c.path.startsWith('graphify-out/')));
  assert.ok(
    result.debug.candidates.implementation.some((c) => c.path === 'src/good.ts')
      || result.candidates.implementation.some((c) => c.path === 'src/good.ts'),
  );
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
  const result = graphSuggest({ repoRoot: repo, query: 'RelSym', seeds: ['RelSym'], debug: true });
  assert.equal(result.status, 'ranked');
  // 기본 후보는 역할당 3개라 이웃 전부는 debug(top-N 전)에서 확인한다.
  const byPath = Object.fromEntries(
    result.debug.candidates.implementation.map((c) => [c.path, c]),
  );
  assert.ok(byPath['src/caller.ts'], 'calls neighbor');
  assert.ok(byPath['src/importer.ts'], 'imports neighbor');
  assert.ok(byPath['src/from.ts'], 'imports_from neighbor');
  assert.ok(byPath['src/caller.ts'].basis.some((b) => /calls|relation/i.test(b)));
  assert.ok(!byPath['src/caller.ts'].basis.some((b) => /contains-only/i.test(b)));
  assert.ok(byPath['src/def.ts'], 'definition owner');
  assert.ok(byPath['src/def.ts'].basis.some((b) => /contains-only/i.test(b)));
  assert.equal(
    byPath['src/def.ts'].score,
    SCORE.uniqueSeedDefinition + SCORE.implementationPath + SCORE.containsOnly,
  );
  const compactDef = result.candidates.implementation.find((c) => c.path === 'src/def.ts');
  assert.ok(compactDef);
  assert.ok(compactDef.basis.includes('reach.contains_only'));
  assert.ok(compactDef.basis.includes('seed.unique'));
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
    debug: true,
  });
  // 기본 추천에서는 연결되지 않은 test를 빼고, debug detail에만 남긴다.
  assert.ok(!result.candidates.test.some((c) => c.path === 'test/orphan.test.js'));
  const orphan = result.debug.candidates.test.find((c) => c.path === 'test/orphan.test.js');
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

// --- TASKS-001 compact payload / traversal budget contracts ---

const COMPACT_BASIS = new Set([
  'seed.unique',
  'seed.path',
  'seed.match',
  'rel.calls',
  'rel.imports',
  'rel.imports_from',
  'role.implementation',
  'test.connected',
  'reach.contains_only',
  'graph.evidence',
]);

const DEFAULT_REASONS = new Set([
  'result.ranked',
  'source.unavailable',
  'source.omitted',
  'test.unavailable',
  'test.omitted',
  'exclude.skipped',
  'seed.generic_only',
  'seed.fanout_cap',
  'traversal.frontier_cap',
  'implementation.none',
  'implementation.low_only',
]);

function assertCompactCandidate(c) {
  assert.deepEqual(Object.keys(c).sort(), ['basis', 'path', 'role', 'score']);
  assert.equal(typeof c.path, 'string');
  assert.ok(c.role === 'implementation' || c.role === 'test');
  assert.equal(typeof c.score, 'number');
  assert.ok(Array.isArray(c.basis));
  assert.equal(c.basis.length, new Set(c.basis).size, 'basis codes must be unique');
  for (const code of c.basis) {
    assert.ok(COMPACT_BASIS.has(code), `unknown basis code: ${code}`);
    assert.ok(/^[ -~]+$/.test(code), `basis not ASCII: ${code}`);
    assert.ok(code.length <= 24, `basis longer than 24: ${code}`);
  }
}

function assertDefaultReasons(reasons) {
  assert.ok(Array.isArray(reasons) && reasons.length > 0);
  assert.equal(reasons.length, new Set(reasons).size, 'reasons must be unique');
  for (const code of reasons) {
    assert.ok(DEFAULT_REASONS.has(code), `unknown reason code: ${code}`);
  }
}

function defaultFields(result) {
  const { debug: _debug, ...rest } = result;
  void _debug;
  return rest;
}

test('compact payload: candidate keys, basis enum, reason enum, role/total caps', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  const nodes = [];
  const links = [];
  // unique(+5)+impl(+3)+relation(+2)=10 on hub; fan neighbors also medium via relation.
  nodes.push({ id: 'hub', label: 'CapHub', source_file: 'src/hub.ts' });
  nodes.push({ id: 'hubf', label: 'hub.ts', source_file: 'src/hub.ts' });
  links.push({ relation: 'contains', source: 'hubf', target: 'hub', source_file: 'src/hub.ts' });
  for (let i = 0; i < 6; i += 1) {
    const p = `src/n${i}.ts`;
    nodes.push({ id: `n${i}`, label: `N${i}`, source_file: p });
    nodes.push({ id: `nf${i}`, label: `n${i}.ts`, source_file: p });
    links.push({ relation: 'contains', source: `nf${i}`, target: `n${i}`, source_file: p });
    links.push({ relation: 'calls', source: `n${i}`, target: 'hub', source_file: p });
  }
  writeGraph(repo, 'source', { nodes, links });
  const testNodes = [];
  const testLinks = [];
  for (let i = 0; i < 5; i += 1) {
    const p = `test/t${i}.test.js`;
    testNodes.push({ id: `t${i}`, label: `covers${i}`, source_file: p });
    testNodes.push({ id: `tf${i}`, label: `t${i}.test.js`, source_file: p });
    testLinks.push({ relation: 'contains', source: `tf${i}`, target: `t${i}`, source_file: p });
    testLinks.push({ relation: 'calls', source: `t${i}`, target: 'hub', source_file: p });
  }
  writeGraph(repo, 'test', { nodes: testNodes, links: testLinks });

  const result = graphSuggest({ repoRoot: repo, query: 'CapHub', seeds: ['CapHub'] });
  assert.equal(result.status, 'ranked');
  assertDefaultReasons(result.reasons);
  assert.ok(result.reasons.includes('result.ranked'));

  const impl = result.candidates.implementation;
  const tests = result.candidates.test;
  assert.ok(impl.length <= 3, `impl cap 3, got ${impl.length}`);
  assert.ok(tests.length <= 3, `test cap 3, got ${tests.length}`);
  assert.ok(impl.length + tests.length <= 8, `total cap 8, got ${impl.length + tests.length}`);
  for (const c of [...impl, ...tests]) assertCompactCandidate(c);
  assert.ok(impl.every((c) => c.score >= 4), 'implementation threshold score >= 4');
  assert.ok(tests.every((c) => c.basis.includes('test.connected')));
});

test('generic-only seeds return low-confidence with seed.generic_only and empty suggested_paths', () => {
  const repo = tmpRepo();
  writeConfig(repo);
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'a', label: 'result', source_file: 'src/a.ts' },
      { id: 'af', label: 'a.ts', source_file: 'src/a.ts' },
    ],
    links: [{ relation: 'contains', source: 'af', target: 'a', source_file: 'src/a.ts' }],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({
    repoRoot: repo,
    query: 'result plan hook',
    seeds: ['result', 'plan', 'hook'],
  });
  assert.equal(result.status, 'low-confidence');
  assert.deepEqual(result.suggested_paths, []);
  assertDefaultReasons(result.reasons);
  assert.ok(result.reasons.includes('seed.generic_only'));
});

test('path seed survives generic-word filter', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  // path seed만으로도 관계 이웃을 열어 medium 이상(≥4)이 되게 한다.
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'f', label: 'plan.ts', source_file: 'src/plan.ts' },
      { id: 's', label: 'PlanHelper', source_file: 'src/plan.ts' },
      { id: 'n', label: 'nbr.ts', source_file: 'src/nbr.ts' },
      { id: 'c', label: 'callPlan', source_file: 'src/nbr.ts' },
    ],
    links: [
      { relation: 'contains', source: 'f', target: 's', source_file: 'src/plan.ts' },
      { relation: 'contains', source: 'n', target: 'c', source_file: 'src/nbr.ts' },
      { relation: 'calls', source: 'c', target: 's', source_file: 'src/nbr.ts' },
      { relation: 'imports', source: 'c', target: 'f', source_file: 'src/nbr.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  // generic token "plan" alone would fail; explicit path seed must preserve ranking.
  const alone = graphSuggest({ repoRoot: repo, query: 'plan', seeds: [] });
  assert.equal(alone.status, 'low-confidence');
  assert.ok(alone.reasons.includes('seed.generic_only'));

  const result = graphSuggest({
    repoRoot: repo,
    query: 'plan',
    seeds: ['src/plan.ts'],
    debug: true,
  });
  assert.equal(result.status, 'ranked');
  assert.ok(result.suggested_paths.length > 0);
  // path seed 파일은 start라 relation 재방문이 없어 score 3일 수 있다.
  // 필터 보존 증거는 debug detail basis의 path seed 문자열과 ranked 성공이다.
  assert.ok(
    result.debug.candidates.implementation.some(
      (c) => c.path === 'src/plan.ts' && c.basis.some((b) => /path seed/i.test(b)),
    ),
    'path seed must record detail basis on src/plan.ts',
  );
});

test('seed fan-out cap (>8 files) yields low-confidence + seed.fanout_cap', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  const nodes = [{ id: 'seed', label: 'FanSym', source_file: 'src/0.ts' }, { id: 'seedf', label: '0.ts', source_file: 'src/0.ts' }];
  const links = [{ relation: 'contains', source: 'seedf', target: 'seed', source_file: 'src/0.ts' }];
  // seed file + 8 neighbors = 9 files from one seed → fan-out > 8
  for (let i = 1; i <= 8; i += 1) {
    const p = `src/f${i}.ts`;
    nodes.push({ id: `n${i}`, label: `Fn${i}`, source_file: p });
    nodes.push({ id: `f${i}`, label: `f${i}.ts`, source_file: p });
    links.push({ relation: 'contains', source: `f${i}`, target: `n${i}`, source_file: p });
    links.push({ relation: 'calls', source: `n${i}`, target: 'seed', source_file: p });
  }
  writeGraph(repo, 'source', { nodes, links });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'FanSym', seeds: ['FanSym'] });
  assert.equal(result.status, 'low-confidence');
  assert.deepEqual(result.suggested_paths, []);
  assertDefaultReasons(result.reasons);
  assert.ok(result.reasons.includes('seed.fanout_cap'));
});

test('BFS frontier cap (>32 nodes) yields low-confidence + traversal.frontier_cap', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  // One seed symbol owned by a file; 33 distinct neighbor symbol nodes via calls
  // stay within file fan-out (reuse few files) but exceed frontier 32.
  const nodes = [
    { id: 'seed', label: 'FrontSym', source_file: 'src/hub.ts' },
    { id: 'hubf', label: 'hub.ts', source_file: 'src/hub.ts' },
    { id: 'a', label: 'a.ts', source_file: 'src/a.ts' },
    { id: 'b', label: 'b.ts', source_file: 'src/b.ts' },
    { id: 'c', label: 'c.ts', source_file: 'src/c.ts' },
  ];
  const links = [
    { relation: 'contains', source: 'hubf', target: 'seed', source_file: 'src/hub.ts' },
  ];
  const files = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
  const fileIds = ['a', 'b', 'c'];
  for (let i = 0; i < 33; i += 1) {
    const fi = i % 3;
    const id = `sym${i}`;
    nodes.push({ id, label: `Sym${i}`, source_file: files[fi] });
    links.push({ relation: 'contains', source: fileIds[fi], target: id, source_file: files[fi] });
    links.push({ relation: 'calls', source: id, target: 'seed', source_file: files[fi] });
  }
  writeGraph(repo, 'source', { nodes, links });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({ repoRoot: repo, query: 'FrontSym', seeds: ['FrontSym'] });
  assert.equal(result.status, 'low-confidence');
  assert.deepEqual(result.suggested_paths, []);
  assertDefaultReasons(result.reasons);
  assert.ok(result.reasons.includes('traversal.frontier_cap'));
});

test('test-graph frontier cap preserves ranked implementation (secondary expand)', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  // Source-only: unique + implementation + relation → ranked high.
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'f', label: 'core.ts', source_file: 'src/core.ts' },
      { id: 's', label: 'KeepRank', source_file: 'src/core.ts' },
      { id: 'n', label: 'nbr.ts', source_file: 'src/nbr.ts' },
      { id: 'c', label: 'callNbr', source_file: 'src/nbr.ts' },
    ],
    links: [
      { relation: 'contains', source: 'n', target: 'c', source_file: 'src/nbr.ts' },
      { relation: 'calls', source: 'c', target: 's', source_file: 'src/nbr.ts' },
      { relation: 'imports', source: 'c', target: 'f', source_file: 'src/nbr.ts' },
    ],
  });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const sourceOnly = graphSuggest({
    repoRoot: repo,
    query: 'KeepRank',
    seeds: ['KeepRank'],
  });
  assert.equal(sourceOnly.status, 'ranked');
  assert.equal(sourceOnly.confidence, 'high');
  assert.ok(sourceOnly.suggested_paths.includes('src/core.ts'));
  assert.ok(!sourceOnly.reasons.includes('traversal.frontier_cap'));

  // Same seed in test graph with frontier>32 (few files, many symbol nodes).
  // Secondary expand is for debug unlinked hits — must not wipe ranked impl.
  const testNodes = [
    { id: 'tseed', label: 'KeepRank', source_file: 'test/hub.test.js' },
    { id: 'thub', label: 'hub.test.js', source_file: 'test/hub.test.js' },
    { id: 'ta', label: 'a.test.js', source_file: 'test/a.test.js' },
    { id: 'tb', label: 'b.test.js', source_file: 'test/b.test.js' },
    { id: 'tc', label: 'c.test.js', source_file: 'test/c.test.js' },
  ];
  const testLinks = [
    { relation: 'contains', source: 'thub', target: 'tseed', source_file: 'test/hub.test.js' },
  ];
  const tFiles = ['test/a.test.js', 'test/b.test.js', 'test/c.test.js'];
  const tFileIds = ['ta', 'tb', 'tc'];
  for (let i = 0; i < 33; i += 1) {
    const fi = i % 3;
    const id = `tsym${i}`;
    testNodes.push({ id, label: `TSym${i}`, source_file: tFiles[fi] });
    testLinks.push({
      relation: 'contains',
      source: tFileIds[fi],
      target: id,
      source_file: tFiles[fi],
    });
    testLinks.push({
      relation: 'calls',
      source: id,
      target: 'tseed',
      source_file: tFiles[fi],
    });
  }
  writeGraph(repo, 'test', { nodes: testNodes, links: testLinks });

  const withTestBudget = graphSuggest({
    repoRoot: repo,
    query: 'KeepRank',
    seeds: ['KeepRank'],
    debug: true,
  });
  assert.equal(withTestBudget.status, 'ranked');
  assert.equal(withTestBudget.confidence, 'high');
  assert.ok(withTestBudget.suggested_paths.includes('src/core.ts'));
  assert.ok(withTestBudget.suggested_paths.length > 0);
  assertDefaultReasons(withTestBudget.reasons);
  assert.ok(withTestBudget.reasons.includes('result.ranked'));
  assert.ok(withTestBudget.reasons.includes('traversal.frontier_cap'));
  assert.ok(withTestBudget.debug);
  assert.equal(withTestBudget.debug.traversal.frontier_capped, true);
  // frontier-only trip: fanout flag must mirror actual budget, not hardcode true
  assert.equal(withTestBudget.debug.traversal.fanout_capped, false);
});

test('source fan-out abort debug keeps discovered candidates', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  const nodes = [
    { id: 'seed', label: 'FanDbg', source_file: 'src/0.ts' },
    { id: 'seedf', label: '0.ts', source_file: 'src/0.ts' },
  ];
  const links = [
    { relation: 'contains', source: 'seedf', target: 'seed', source_file: 'src/0.ts' },
  ];
  for (let i = 1; i <= 8; i += 1) {
    const p = `src/f${i}.ts`;
    nodes.push({ id: `n${i}`, label: `Fn${i}`, source_file: p });
    nodes.push({ id: `f${i}`, label: `f${i}.ts`, source_file: p });
    links.push({ relation: 'contains', source: `f${i}`, target: `n${i}`, source_file: p });
    links.push({ relation: 'calls', source: `n${i}`, target: 'seed', source_file: p });
  }
  writeGraph(repo, 'source', { nodes, links });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const result = graphSuggest({
    repoRoot: repo,
    query: 'FanDbg',
    seeds: ['FanDbg'],
    debug: true,
  });
  assert.equal(result.status, 'low-confidence');
  assert.deepEqual(result.suggested_paths, []);
  assert.ok(result.reasons.includes('seed.fanout_cap'));
  assert.ok(result.debug);
  assert.ok(
    result.debug.candidates.implementation.length > 0,
    'budget abort debug must keep in-budget implementation rows',
  );
});

test('missing test graph preserves implementation ranking with test.unavailable', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'f', label: 'core.ts', source_file: 'src/core.ts' },
      { id: 's', label: 'SoloSym', source_file: 'src/core.ts' },
      { id: 'n', label: 'nbr.ts', source_file: 'src/nbr.ts' },
      { id: 'c', label: 'callNbr', source_file: 'src/nbr.ts' },
    ],
    links: [
      { relation: 'contains', source: 'n', target: 'c', source_file: 'src/nbr.ts' },
      { relation: 'calls', source: 'c', target: 's', source_file: 'src/nbr.ts' },
      { relation: 'imports', source: 'c', target: 'f', source_file: 'src/nbr.ts' },
    ],
  });
  // no test graph.json
  const result = graphSuggest({ repoRoot: repo, query: 'SoloSym', seeds: ['SoloSym'] });
  assert.equal(result.status, 'ranked');
  assert.equal(result.confidence, 'high');
  assert.ok(result.candidates.implementation.some((c) => c.path === 'src/core.ts'));
  assert.deepEqual(result.candidates.test, []);
  assertDefaultReasons(result.reasons);
  assert.ok(result.reasons.includes('test.unavailable'));
  assert.ok(result.reasons.includes('result.ranked'));
});

test('debug on/off keeps identical default fields; debug adds detail', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo, 'source', {
    nodes: [
      { id: 'f', label: 'owner.ts', source_file: 'src/owner.ts' },
      { id: 's', label: 'DbgSym', source_file: 'src/owner.ts' },
      { id: 'n', label: 'nbr.ts', source_file: 'src/nbr.ts' },
      { id: 'c', label: 'callFrom', source_file: 'src/nbr.ts' },
    ],
    links: [
      { relation: 'contains', source: 'n', target: 'c', source_file: 'src/nbr.ts' },
      { relation: 'calls', source: 'c', target: 's', source_file: 'src/nbr.ts' },
      { relation: 'imports', source: 'c', target: 'f', source_file: 'src/nbr.ts' },
    ],
  });
  writeGraph(repo, 'test', {
    nodes: [
      { id: 'tf', label: 'owner.test.js', source_file: 'test/owner.test.js' },
      { id: 'ts', label: 'coversDbg', source_file: 'test/owner.test.js' },
    ],
    links: [
      { relation: 'contains', source: 'tf', target: 'ts', source_file: 'test/owner.test.js' },
      { relation: 'calls', source: 'ts', target: 's', source_file: 'test/owner.test.js' },
    ],
  });
  const plain = graphSuggest({ repoRoot: repo, query: 'DbgSym', seeds: ['DbgSym'] });
  const withDebug = graphSuggest({
    repoRoot: repo,
    query: 'DbgSym',
    seeds: ['DbgSym'],
    debug: true,
  });
  assert.deepStrictEqual(defaultFields(withDebug), plain);
  assert.equal(plain.debug, undefined);
  assert.ok(withDebug.debug);
  assert.ok(withDebug.debug.candidates);
  assert.ok(Array.isArray(withDebug.debug.reasons));
  assert.ok(withDebug.debug.traversal);
  assert.ok(
    withDebug.debug.candidates.implementation.length
      >= plain.candidates.implementation.length,
  );
});

test('equal score sorts by role then path; shuffled nodes/links match', () => {
  const repo = tmpRepo();
  writeConfig(repo, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  const baseNodes = [
    { id: 's1', label: 'Alpha', source_file: 'src/z.ts' },
    { id: 's2', label: 'Beta', source_file: 'src/a.ts' },
    { id: 'sf1', label: 'z.ts', source_file: 'src/z.ts' },
    { id: 'sf2', label: 'a.ts', source_file: 'src/a.ts' },
  ];
  const baseLinks = [
    { relation: 'contains', source: 'sf1', target: 's1', source_file: 'src/z.ts' },
    { relation: 'contains', source: 'sf2', target: 's2', source_file: 'src/a.ts' },
  ];
  writeGraph(repo, 'source', { nodes: baseNodes, links: baseLinks });
  writeGraph(repo, 'test', { nodes: [], links: [] });
  const ordered = graphSuggest({ repoRoot: repo, query: 'Alpha Beta', seeds: ['Alpha', 'Beta'] });
  assert.equal(ordered.status, 'ranked');
  const paths = ordered.candidates.implementation.map((c) => c.path);
  assert.deepEqual(paths.slice(0, 2), ['src/a.ts', 'src/z.ts']);

  const repo2 = tmpRepo();
  writeConfig(repo2, { graphify: { enabled: true, test_dirs: ['test'], exclude_dirs: [] } });
  writeGraph(repo2, 'source', {
    nodes: [...baseNodes].reverse(),
    links: [...baseLinks].reverse(),
  });
  writeGraph(repo2, 'test', { nodes: [], links: [] });
  const shuffled = graphSuggest({
    repoRoot: repo2,
    query: 'Alpha Beta',
    seeds: ['Alpha', 'Beta'],
  });
  assert.deepStrictEqual(defaultFields(shuffled), defaultFields(ordered));
});
