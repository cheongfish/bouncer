'use strict';

/**
 * Graphify 검색 품질 고정 corpus 회귀.
 *
 * 점수·저신뢰는 Task 002 `graphSuggest`만 쓴다. 이 파일은 top-N 절단과
 * precision/recall·test-only·generated 임계치만 검사한다.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { graphSuggest } = require('../scripts/lib/graph-search');

const ROOT = path.join(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'graph-search-quality.json');
const DOC_PATH = path.join(ROOT, 'docs/benchmark/graphify-search-quality.md');

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const thresholds = fixture.meta.thresholds;
const excludeDirs = fixture.meta.exclude_dirs || [];
const testDirs = fixture.meta.test_dirs || ['test'];

/**
 * 임시 저장소에 사례 그래프와 exclude_dirs config를 깐다.
 *
 * @param {object} caseEntry - fixture cases[] 항목
 * @returns {string} repoRoot
 */
function materializeCase(caseEntry) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-gsq-'));
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    JSON.stringify({
      source_dirs: ['scripts/src', 'hooks'],
      verify: 'npm test',
      base_branch: 'main',
      graphify: {
        enabled: true,
        test_dirs: testDirs,
        exclude_dirs: excludeDirs,
      },
    }),
  );
  for (const role of ['source', 'test', 'context']) {
    const dir = path.join(repo, 'graphify-out', role);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'graph.json'),
      JSON.stringify(caseEntry.graphs[role] || { nodes: [], links: [] }),
    );
  }
  return repo;
}

/**
 * @param {string} filePath
 * @param {string[]} prefixes
 * @returns {boolean}
 */
function matchesPrefix(filePath, prefixes) {
  const posix = filePath.split('\\').join('/');
  return prefixes.some((raw) => {
    const pref = String(raw).replace(/\/+$/, '');
    return posix === pref || posix.startsWith(`${pref}/`);
  });
}

/**
 * @param {string} filePath
 * @param {string[]} dirs
 * @returns {boolean}
 */
function underDirs(filePath, dirs) {
  return matchesPrefix(filePath, dirs);
}

/**
 * @param {string[]} paths
 * @param {number} n
 * @returns {string[]}
 */
function topN(paths, n) {
  return paths.slice(0, n);
}

/**
 * top-N 안 관련 구현 개수 (정답 implementation 집합과의 교집합).
 *
 * @param {string[]} topPaths
 * @param {string[]} goldImpl
 * @returns {number}
 */
function countRelatedImpl(topPaths, goldImpl) {
  const gold = new Set(goldImpl);
  return topPaths.filter((p) => gold.has(p)).length;
}

/**
 * 필수 구현 recall. 분모 0은 NaN — 호출측에서 실패로 취급한다.
 *
 * @param {string[]} foundPaths
 * @param {string[]} requiredImpl
 * @returns {number}
 */
function implRecall(foundPaths, requiredImpl) {
  if (!requiredImpl || requiredImpl.length === 0) return Number.NaN;
  const found = new Set(foundPaths);
  const hit = requiredImpl.filter((p) => found.has(p)).length;
  return hit / requiredImpl.length;
}

/**
 * @param {string[]} topPaths
 * @param {string[]} goldImpl
 * @returns {number}
 */
function precisionAt(topPaths, goldImpl) {
  if (topPaths.length === 0) return 0;
  return countRelatedImpl(topPaths, goldImpl) / topPaths.length;
}

/**
 * 추천 경로가 무연결 test-only인지. 역할은 test_dirs prefix로 보고,
 * 연결된 gold.test·connected suggested는 제외한다.
 *
 * @param {string} filePath
 * @param {object} result - graphSuggest 결과
 * @param {string[]} goldTest
 * @returns {boolean}
 */
function isUnlinkedTestOnly(filePath, result, goldTest) {
  if (!underDirs(filePath, testDirs)) return false;
  if (goldTest.includes(filePath)) return false;
  const testCand = (result.candidates.test || []).find((c) => c.path === filePath);
  if (!testCand) {
    // suggested에만 있고 candidates.test에 없으면 연결 근거를 못 읽는다 → 무연결로 센다
    return true;
  }
  const basis = testCand.basis || [];
  if (basis.some((b) => /test-only without implementation/i.test(b))) return true;
  if (basis.some((b) => /connected test/i.test(b))) return false;
  return true;
}

/**
 * @param {object} result
 * @returns {string[]} 구현 후보 path (점수순; graphSuggest가 이미 정렬)
 */
function implCandidatePaths(result) {
  return (result.candidates.implementation || []).map((c) => c.path);
}

/**
 * 새 방식 top-N 추천. ranked면 suggested_paths를 우선하고, 비면 구현 후보로 폴백.
 *
 * @param {object} result
 * @param {number} n
 * @returns {string[]}
 */
function newTopRecommendations(result, n) {
  if (result.status === 'low-confidence' || result.status === 'unavailable') {
    return [];
  }
  const suggested = Array.isArray(result.suggested_paths) ? result.suggested_paths : [];
  if (suggested.length > 0) return topN(suggested, n);
  return topN(implCandidatePaths(result), n);
}

test('fixture declares three cases with non-empty gold in graph roles', () => {
  assert.equal(fixture.cases.length, 3);
  const ids = fixture.cases.map((c) => c.id);
  assert.deepEqual(ids, ['light-plan', 'verification-ledger', 'graphify-bootstrap']);

  for (const caseEntry of fixture.cases) {
    const goldImpl = caseEntry.gold.implementation;
    const goldTest = caseEntry.gold.test;
    assert.ok(Array.isArray(goldImpl) && goldImpl.length > 0, `${caseEntry.id}: empty gold.implementation`);
    assert.ok(Array.isArray(goldTest) && goldTest.length > 0, `${caseEntry.id}: empty gold.test`);

    const sourceFiles = new Set(
      (caseEntry.graphs.source.nodes || [])
        .map((n) => n.source_file)
        .filter(Boolean),
    );
    const testFiles = new Set(
      (caseEntry.graphs.test.nodes || [])
        .map((n) => n.source_file)
        .filter(Boolean),
    );
    for (const p of goldImpl) {
      assert.ok(sourceFiles.has(p), `${caseEntry.id}: gold impl not in source roles: ${p}`);
    }
    for (const p of goldTest) {
      assert.ok(testFiles.has(p), `${caseEntry.id}: gold test not in test roles: ${p}`);
    }
    assert.ok(Array.isArray(caseEntry.legacy_candidates) && caseEntry.legacy_candidates.length > 0);
  }
});

test('metric helpers: injected bad candidates fail thresholds', () => {
  const goldImpl = [
    'scripts/src/lib/a.ts',
    'scripts/src/lib/b.ts',
    'scripts/src/lib/c.ts',
    'scripts/src/lib/d.ts',
    'scripts/src/lib/e.ts',
    'scripts/src/lib/f.ts',
    'scripts/src/lib/g.ts',
  ];
  // 전부 테스트·생성물 — 관련 구현 0
  const badTop10 = [
    'test/a.test.js',
    'test/b.test.js',
    'test/c.test.js',
    'test/d.test.js',
    'test/e.test.js',
    'test/f.test.js',
    'test/g.test.js',
    'test/h.test.js',
    'scripts/lib/a.js',
    'scripts/lib/b.js',
  ];
  const related = countRelatedImpl(badTop10, goldImpl);
  assert.ok(
    related < thresholds.min_related_impl_in_top10,
    `expected injected bad top10 to miss related threshold, got ${related}`,
  );
  assert.ok(precisionAt(badTop10, goldImpl) < 0.7);

  const recall = implRecall(['test/a.test.js'], goldImpl);
  assert.ok(recall < thresholds.min_impl_recall, `expected low recall, got ${recall}`);

  // 분모 0 recall은 통과가 아니다
  assert.ok(Number.isNaN(implRecall(['x'], [])));

  const generated = badTop10.filter((p) => matchesPrefix(p, excludeDirs)).length;
  assert.ok(generated > thresholds.max_generated);

  // 무연결 test-only 비율: 추천이 전부 test면 100% > 10%
  const unlinkedRate = badTop10.filter((p) => underDirs(p, testDirs)).length / badTop10.length;
  assert.ok(unlinkedRate > thresholds.max_unlinked_test_only_rate);
});

test('graphSuggest on fixture: ranked cases meet precision/recall; probe is low-confidence', () => {
  const topCut = thresholds.top_n;
  /** @type {string[]} */
  const unionTop = [];
  /** @type {{ id: string, result: object }[]} */
  const rankedRuns = [];

  for (const caseEntry of fixture.cases) {
    const repo = materializeCase(caseEntry);
    const result = graphSuggest({
      repoRoot: repo,
      query: caseEntry.query,
      seeds: caseEntry.seeds,
    });

    assert.equal(
      result.status,
      caseEntry.expect.status,
      `${caseEntry.id}: status ${result.status}, reasons: ${(result.reasons || []).join(' | ')}`,
    );
    assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0, `${caseEntry.id}: empty reasons`);

    if (caseEntry.expect.status === 'ranked') {
      assert.notEqual(result.confidence, 'low');
      assert.ok(result.suggested_paths.length > 0, `${caseEntry.id}: empty suggested_paths`);

      const implTop = topN(implCandidatePaths(result), topCut);
      const related = countRelatedImpl(implTop, caseEntry.gold.implementation);
      assert.ok(
        related >= thresholds.min_related_impl_in_top10,
        `${caseEntry.id}: related impl in top-${topCut} = ${related}, `
        + `need ≥${thresholds.min_related_impl_in_top10}; top=${implTop.join(',')}`,
      );

      const recall = implRecall(implCandidatePaths(result), caseEntry.gold.implementation);
      assert.ok(!Number.isNaN(recall), `${caseEntry.id}: recall NaN`);
      assert.ok(
        recall >= thresholds.min_impl_recall,
        `${caseEntry.id}: impl recall ${recall} < ${thresholds.min_impl_recall}`,
      );

      rankedRuns.push({ id: caseEntry.id, result });
      unionTop.push(...newTopRecommendations(result, topCut));
    }

    if (caseEntry.low_confidence_probe) {
      const probe = graphSuggest({
        repoRoot: repo,
        query: caseEntry.low_confidence_probe.query,
        seeds: caseEntry.low_confidence_probe.seeds || [],
      });
      assert.equal(probe.status, 'low-confidence', `${caseEntry.id} probe status`);
      assert.deepEqual(probe.suggested_paths, []);
      assert.ok(probe.reasons.length > 0, `${caseEntry.id} probe reasons`);
    }
  }

  const union = [...new Set(unionTop)];
  assert.ok(union.length > 0, 'union of new top-N recommendations is empty (denom 0 = fail)');

  // 무연결 test-only: 합친 추천에서 test_dirs 아래이면서 연결 근거가 없는 경로
  let unlinked = 0;
  for (const p of union) {
    // 어느 ranked 결과의 candidates로 판정할지 — 경로를 배출한 첫 결과를 쓴다
    const owner = rankedRuns.find((r) => newTopRecommendations(r.result, topCut).includes(p));
    const goldTest = fixture.cases.find((c) => c.id === owner.id).gold.test;
    if (isUnlinkedTestOnly(p, owner.result, goldTest)) unlinked += 1;
  }
  const unlinkedRate = unlinked / union.length;
  assert.ok(
    unlinkedRate <= thresholds.max_unlinked_test_only_rate,
    `unlinked test-only rate ${unlinkedRate} (unlinked=${unlinked}, denom=${union.length})`,
  );

  const generated = union.filter((p) => matchesPrefix(p, excludeDirs)).length;
  assert.equal(generated, thresholds.max_generated, `generated count ${generated} in union`);
});

test('legacy vs new precision/recall are computable side by side on the same gold', () => {
  const rows = [];
  for (const caseEntry of fixture.cases) {
    const repo = materializeCase(caseEntry);
    const result = graphSuggest({
      repoRoot: repo,
      query: caseEntry.query,
      seeds: caseEntry.seeds,
    });
    const topCut = thresholds.top_n;
    const legacyTop = topN(caseEntry.legacy_candidates, topCut);
    const newImplTop = topN(implCandidatePaths(result), topCut);

    rows.push({
      id: caseEntry.id,
      legacy_precision: precisionAt(legacyTop, caseEntry.gold.implementation),
      legacy_recall: implRecall(legacyTop, caseEntry.gold.implementation),
      new_precision: precisionAt(newImplTop, caseEntry.gold.implementation),
      new_recall: implRecall(implCandidatePaths(result), caseEntry.gold.implementation),
      new_status: result.status,
      exploration: fixture.meta.legacy_node_exploration[caseEntry.id],
    });
  }

  // 측정 자체가 숫자로 나와야 한다. NaN 은닉 금지.
  for (const row of rows) {
    assert.ok(Number.isFinite(row.legacy_precision), `${row.id} legacy precision`);
    assert.ok(Number.isFinite(row.legacy_recall), `${row.id} legacy recall`);
    if (row.new_status === 'ranked') {
      assert.ok(Number.isFinite(row.new_precision), `${row.id} new precision`);
      assert.ok(Number.isFinite(row.new_recall), `${row.id} new recall`);
      assert.ok(row.new_recall >= thresholds.min_impl_recall, `${row.id} new recall gate`);
    }
  }
});

test('docs/benchmark/graphify-search-quality.md records corpus, versions, metrics, thresholds, reproduce cmd', () => {
  assert.ok(fs.existsSync(DOC_PATH), 'missing docs/benchmark/graphify-search-quality.md');
  const body = fs.readFileSync(DOC_PATH, 'utf8');
  assert.ok(body.includes('graphify-evaluation.md'), 'corpus source');
  assert.ok(body.includes('0.8.22'), 'Graphify package version');
  assert.ok(body.includes('0.9.41'), 'Graphify skill version');
  assert.ok(body.includes('light-plan'), 'light-plan case');
  assert.ok(body.includes('verification-ledger'), 'verification-ledger case');
  assert.ok(body.includes('graphify-bootstrap'), 'graphify-bootstrap case');
  assert.ok(/precision/i.test(body) && /recall/i.test(body), 'precision/recall');
  assert.ok(/test-only/i.test(body), 'test-only');
  assert.ok(/generated/i.test(body), 'generated');
  assert.ok(body.includes('npm test -- test/graph-search-quality.test.js'), 'reproduce command');
  // 원 실험 탐색량은 보조 지표로만
  assert.ok(body.includes('97') && body.includes('36') && body.includes('71'), 'legacy exploration counts');
});
