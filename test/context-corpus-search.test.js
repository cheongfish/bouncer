'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'context-corpus-queries.json');
const EPICS = path.join(ROOT, '.bouncer/context/epics');

const { contextSearch, CORPUS_SCORE, SEARCH_MODES } = require('../scripts/lib/graph-search');
const { buildContextDigest, CONTEXT_DIGEST_OUT } = require('../scripts/lib/context-digest');

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

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
    'graph-scope test_dirs',
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
  );
  writeGraph(repo, 'context', { nodes: contextNodes, links: [] });
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
  return repo;
}

function rankedPaths(result) {
  return result.candidates.map((row) => row.path);
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
