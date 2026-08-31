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
