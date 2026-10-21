'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { planLegacyEpicMerge } = require('../scripts/lib/migrate-merge-legacy-epics');

const EPICS = '.bouncer/context/epics';

// 등록부(v2): legacy a(001: x=001, y=002), legacy b(002: z=001), domain d1·d2.
function registryOf(extra = {}) {
  return {
    version: 2,
    profile: 'default',
    domainEpicLimit: 10,
    areas: [],
    epics: [
      { slug: 'a', legacy_id: '001', kind: 'legacy', active: true, blueprint_aliases: { '001': 'x', '002': 'y' } },
      { slug: 'b', legacy_id: '002', kind: 'legacy', active: true, blueprint_aliases: { '001': 'z' } },
      { slug: 'd1', kind: 'domain', active: true },
      { slug: 'd2', kind: 'domain', active: true },
    ],
    ...extra,
  };
}

function domainIndex(list, rows = []) {
  const table = rows.length === 0 ? '' : [
    '### 다른 epic에서 이 영역으로 귀속되는 blueprint',
    '| legacy epic | blueprint | 이유 |',
    '| --- | --- | --- |',
    ...rows.map(([id, cell]) => `| ${id} | ${cell} | 이유 |`),
    '',
  ].join('\n');
  return [
    '# domain', '', '## Legacy epic 귀속', '설명', '',
    ...list.map((slug) => `- [${slug}](../${slug}/index.md)`), '', table, '## Blueprints', '',
  ].join('\n');
}

function bpIndex(order) {
  return `---\ntype: bouncer.blueprint\nbouncer:\n  status: approved\n  order: ${order}\n---\nbody\n`;
}

// 기본 입력: d1 목록 [a], d2 목록 [b] + 예외 표 (a의 y → d2)
function plan({ d1 = domainIndex(['a']), d2 = domainIndex(['b'], [['001', '002']]), dirs = {}, files = {},
  registry = registryOf() } = {}) {
  const fileMap = {
    [`${EPICS}/d1/index.md`]: d1,
    [`${EPICS}/d2/index.md`]: d2,
    [`${EPICS}/a/blueprints/x/index.md`]: bpIndex(1),
    [`${EPICS}/a/blueprints/y/index.md`]: bpIndex(2),
    [`${EPICS}/b/blueprints/z/index.md`]: bpIndex(1),
    ...files,
  };
  const dirMap = {
    [`${EPICS}/a/blueprints`]: ['x', 'y'],
    [`${EPICS}/b/blueprints`]: ['z'],
    ...dirs,
  };
  return planLegacyEpicMerge({
    repoRoot: '/nonexistent',
    registry,
    readFile: (rel) => (rel in fileMap ? fileMap[rel] : null),
    listDirs: (rel) => dirMap[rel] ?? [],
  });
}

const A = `${EPICS}/a/blueprints`;
const B = `${EPICS}/b/blueprints`;

test('귀속 목록과 예외 표가 있으면 → 예외 우선으로 이동 계획과 order가 정해진다', () => {
  const result = plan();
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.moves.map((m) => [m.from, m.to, m.order]), [
    [`${A}/x`, `${EPICS}/d1/blueprints/x`, 1],
    [`${A}/y`, `${EPICS}/d2/blueprints/y`, 1],
    [`${B}/z`, `${EPICS}/d2/blueprints/z`, 2],
  ]);
  assert.deepStrictEqual(result.moves.map((m) => [m.legacyEpic, m.domainEpic, m.slug]), [
    ['a', 'd1', 'x'], ['a', 'd2', 'y'], ['b', 'd2', 'z'],
  ]);
  assert.deepStrictEqual(result.unresolved_rows, []);
});

test('같은 입력을 두 번 계산하면 → 결과가 deepStrictEqual이다', () => {
  assert.deepStrictEqual(plan(), plan());
});

test('대상 epic에 이미 blueprint가 있으면 → order가 기존 최댓값 다음부터 붙는다', () => {
  const result = plan({
    dirs: { [`${EPICS}/d2/blueprints`]: ['old'] },
    files: { [`${EPICS}/d2/blueprints/old/index.md`]: bpIndex(7) },
  });
  assert.deepStrictEqual(result.moves.map((m) => [m.slug, m.order]), [['x', 1], ['y', 8], ['z', 9]]);
});

test('예외 표가 범위이면 → 양끝 포함 모든 blueprint가 예외 대상 epic으로 간다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '001~002']]) });
  assert.deepStrictEqual(result.moves.map((m) => [m.slug, m.domainEpic]), [
    ['x', 'd2'], ['y', 'd2'], ['z', 'd2'],
  ]);
});

test('예외 표가 번호와 slug이면 → 그 blueprint만 간다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '002 y']]) });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.moves.map((m) => [m.slug, m.domainEpic]), [
    ['x', 'd1'], ['y', 'd2'], ['z', 'd2'],
  ]);
});

test('예외 표의 slug가 별칭과 다르면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '002 w']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('범위 끝이 별칭에 없으면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '001~004']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('예외 표 항목 일부만 해석되면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['b'], [['001', '002, 뭔가']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('예외 표가 자유 서술이면 → unresolved_rows에 담고 목록 규칙으로 계획한다', () => {
  const result = plan({ d1: domainIndex(['a'], [['002', '평가 후속']]) });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.unresolved_rows, [{ domain: 'd1', legacy_id: '002', cell: '평가 후속' }]);
  assert.deepStrictEqual(result.moves.find((m) => m.slug === 'z').domainEpic, 'd2');
});

test('legacy epic이 어느 목록에도 없으면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex([]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('legacy epic이 두 목록에 있으면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['a', 'b']) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('목록 링크가 legacy가 아닌 epic을 가리키면 → merge-mapping-invalid다', () => {
  const result = plan({ d1: domainIndex(['a', 'd2']) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('예외 표의 legacy 번호를 등록부에서 찾을 수 없으면 → merge-mapping-invalid다', () => {
  const result = plan({ d2: domainIndex(['b'], [['999', '001']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('한 blueprint가 두 도메인의 예외 표에 있으면 → merge-mapping-invalid다', () => {
  const result = plan({ d1: domainIndex(['a'], [['001', '002']]) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('등록부가 v2가 아니면 → merge-mapping-invalid다', () => {
  const result = plan({ registry: registryOf({ version: 1 }) });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'merge-mapping-invalid');
});

test('대상 epic에 같은 slug가 이미 있으면 → migrate-slug-conflict다', () => {
  const result = plan({ dirs: { [`${EPICS}/d1/blueprints`]: ['x'] } });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'migrate-slug-conflict');
});

test('같은 slug 둘이 한 대상 epic으로 들어오면 → migrate-slug-conflict다', () => {
  const result = plan({ dirs: { [`${B}`]: ['z', 'y'] } });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.code, 'migrate-slug-conflict');
});

test('이미 옮겨진 상태이면 → moves가 빈 배열이다', () => {
  const result = plan({ dirs: { [A]: [], [B]: [] } });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.moves, []);
});
