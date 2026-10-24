'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const registryLib = require('../packages/cli/dist/epic-registry');
const { validateBlueprint } = require('../packages/cli/dist/validate');
const { writeEpicRegistry, COMMON_SLUGS } = require('./helpers/epic-registry');

const {
  expandProfile, planRegistry, readEpicRegistry, serializeEpicRegistry, parseEpicRegistry,
  resolveBlueprintAlias, epicByLegacyId,
} = registryLib;
const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
}

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

// 구조 검사가 돌 만큼의 최소 blueprint. 다른 실패가 섞여도 S35 유무만 본다.
function mkBlueprintRepo() {
  const repo = mkRepo();
  const base = { tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00' };
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    ...base, type: 'bouncer.tasks', title: 't', description: 'd', resource: `${BP_REL}/tasks/001/tasks.md`,
    bouncer: { id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready', affected_paths: ['src/'] },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...base, type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${BP_REL}/index.md`,
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'draft' },
  });
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    ...base, type: 'bouncer.epic', title: 'e', description: 'auth epic',
    resource: '.bouncer/context/epics/001-auth/index.md',
    bouncer: { id: '001', epic_id: '001', status: 'draft' },
  });
  return repo;
}

function s35(repo, gate) {
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
  return res.failures.filter((f) => f.code === 'S35');
}

test('expandProfile standard → eight common epics in fixed order', () => {
  const registry = expandProfile('standard', { domainEpicLimit: 0 });
  assert.deepStrictEqual(registry.epics.map((e) => e.slug), COMMON_SLUGS);
  assert.ok(registry.epics.every((e) => e.kind === 'common' && e.active));
  assert.strictEqual(registry.domainEpicLimit, 0);
});

test('expandProfile domain-only → no common epics and keeps the limit', () => {
  const registry = expandProfile('domain-only', { domainEpicLimit: 8 });
  assert.deepStrictEqual(registry.epics, []);
  assert.strictEqual(registry.domainEpicLimit, 8);
});

test('expandProfile unknown profile or bad limit → throws', () => {
  assert.throws(() => expandProfile('weird', { domainEpicLimit: 0 }));
  assert.throws(() => expandProfile('standard', { domainEpicLimit: -1 }));
  assert.throws(() => expandProfile('standard', { domainEpicLimit: 1.5 }));
});

test('planRegistry with existing foundation and x dirs → keeps ids, legacy x, fills the rest after the max', () => {
  const base = expandProfile('standard', { domainEpicLimit: 0 });
  const { registry, scaffold } = planRegistry(base, ['003-foundation', '010-x']);
  const byslug = Object.fromEntries(registry.epics.map((e) => [e.slug, e]));
  assert.deepStrictEqual([byslug.foundation.id, byslug.foundation.kind], ['003', 'common']);
  assert.deepStrictEqual([byslug.x.id, byslug.x.kind], ['010', 'legacy']);
  const rest = COMMON_SLUGS.filter((s) => s !== 'foundation');
  assert.deepStrictEqual(scaffold, rest.map((slug, i) => ({ slug, id: String(11 + i).padStart(3, '0') })));
  assert.strictEqual(scaffold.length, 7);
});

test('planRegistry with two dirs for one common slug → throws', () => {
  const base = expandProfile('standard', { domainEpicLimit: 0 });
  assert.throws(() => planRegistry(base, ['001-core', '002-core']));
});

test('serializeEpicRegistry → two-space JSON with trailing newline', () => {
  const registry = expandProfile('domain-only', { domainEpicLimit: 2 });
  const text = serializeEpicRegistry(registry);
  assert.ok(text.endsWith('}\n'));
  assert.deepStrictEqual(JSON.parse(text), registry);
  assert.strictEqual(text, `${JSON.stringify(registry, null, 2)}\n`);
});

test('valid registry → readEpicRegistry ok and validate has no S35', () => {
  const repo = mkBlueprintRepo();
  const written = writeEpicRegistry(repo);
  const read = readEpicRegistry(repo);
  assert.strictEqual(read.status, 'ok');
  assert.deepStrictEqual(read.registry, written);
  assert.deepStrictEqual(s35(repo), []);
});

test('registry absent → readEpicRegistry missing and validate has no S35', () => {
  const repo = mkBlueprintRepo();
  assert.deepStrictEqual(readEpicRegistry(repo), { status: 'missing' });
  assert.deepStrictEqual(s35(repo), []);
});

function movedRegistry(oldEpic, extra = {}) {
  return {
    version: 2, profile: 'domain-only', domainEpicLimit: 3, areas: [],
    epics: [
      { slug: 'old', legacy_id: '012', kind: 'legacy', active: true, ...oldEpic },
      { slug: 'dom', kind: 'domain', active: true },
    ],
    ...extra,
  };
}

test('valid moved_to on a legacy epic → parseEpicRegistry ok', () => {
  const res = parseEpicRegistry(movedRegistry({ blueprint_aliases: { '003': 'bp-a' }, moved_to: { 'bp-a': 'dom' } }));
  assert.strictEqual(res.ok, true);
});

test('malformed moved_to → parseEpicRegistry rejects with the reason', () => {
  const cases = [
    [movedRegistry({ moved_to: [] }), 'moved_to is invalid: old: must be an object'],
    [movedRegistry({ moved_to: { 'Bad Key': 'dom' } }), 'moved_to is invalid: old: '],
    [movedRegistry({ moved_to: { 'bp-a': 'nowhere' } }), 'moved_to is invalid: old: '],
    [movedRegistry({ moved_to: { 'bp-a': 'old' } }), 'moved_to is invalid: old: '],
  ];
  for (const [registry, prefix] of cases) {
    const res = parseEpicRegistry(registry);
    assert.strictEqual(res.ok, false);
    assert.ok(res.message.startsWith(prefix), res.message);
  }
});

test('moved_to on a non-legacy epic → parseEpicRegistry rejects', () => {
  const registry = movedRegistry({});
  registry.epics[1].moved_to = { 'bp-a': 'dom' };
  assert.deepStrictEqual(parseEpicRegistry(registry),
    { ok: false, message: 'moved_to is only allowed on legacy epics: dom' });
});

test('moved_to in a v1 registry → parseEpicRegistry rejects', () => {
  const registry = {
    version: 1, profile: 'domain-only', domainEpicLimit: 3, areas: [],
    epics: [
      { slug: 'old', id: '012', kind: 'legacy', active: true, moved_to: { 'bp-a': 'dom' } },
      { slug: 'dom', id: '013', kind: 'domain', active: true },
    ],
  };
  const res = parseEpicRegistry(registry);
  assert.strictEqual(res.ok, false);
  assert.ok(res.message.startsWith('moved_to is invalid: old: '), res.message);
});

test('malformed moved_to in the file → validate reports S35', () => {
  const repo = mkBlueprintRepo();
  writeEpicRegistry(repo, movedRegistry({ moved_to: { 'bp-a': 'nowhere' } }));
  assert.strictEqual(s35(repo).length, 1);
});

test('slug mapped to two ids → S35 with file and next on any gate', () => {
  const repo = mkBlueprintRepo();
  writeEpicRegistry(repo, {
    epics: [
      { slug: 'core', id: '001', kind: 'common', active: true },
      { slug: 'core', id: '002', kind: 'common', active: true },
    ],
  });
  for (const gate of [undefined, 'plan', 'commit']) {
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
    const hit = res.failures.filter((f) => f.code === 'S35');
    assert.strictEqual(hit.length, 1, `gate ${gate}`);
    assert.strictEqual(hit[0].file, '.bouncer/epics.json');
    assert.ok(hit[0].next);
  }
});

const BAD = {
  'area with uppercase and underscore': { areas: ['Order_1'] },
  'duplicate area': { areas: ['ordering', 'ordering'] },
  'areaPromotionThreshold 0': { areaPromotionThreshold: 0 },
  'areaPromotionThreshold 1.5': { areaPromotionThreshold: 1.5 },
  'version 3': { version: 3 },
  'epics key missing': { epics: undefined },
  'domainEpicLimit string': { domainEpicLimit: '1' },
  'identical (slug,id) row twice': {
    epics: [
      { slug: 'core', id: '001', kind: 'common', active: true },
      { slug: 'core', id: '001', kind: 'common', active: true },
    ],
  },
  'one id with two slugs': {
    epics: [
      { slug: 'core', id: '001', kind: 'common', active: true },
      { slug: 'data', id: '001', kind: 'common', active: true },
    ],
  },
};

for (const [name, overrides] of Object.entries(BAD)) {
  test(`${name} → S35`, () => {
    const repo = mkBlueprintRepo();
    writeEpicRegistry(repo, overrides);
    assert.strictEqual(s35(repo).length, 1);
  });
}

test('valid area slug → no S35', () => {
  const repo = mkBlueprintRepo();
  writeEpicRegistry(repo, { areas: ['ordering'], areaPromotionThreshold: 3 });
  assert.deepStrictEqual(s35(repo), []);
});

test('broken JSON → S35', () => {
  const repo = mkBlueprintRepo();
  fs.writeFileSync(path.join(repo, '.bouncer', 'epics.json'), '{ nope');
  assert.strictEqual(s35(repo).length, 1);
});

test('cwd holds a broken epics.json but repo has none → no S35', () => {
  const other = mkRepo();
  fs.mkdirSync(path.join(other, '.bouncer'));
  fs.writeFileSync(path.join(other, '.bouncer', 'epics.json'), '{ nope');
  const repo = mkBlueprintRepo();
  const previous = process.cwd();
  process.chdir(other);
  try {
    assert.deepStrictEqual(s35(repo), []);
  } finally {
    process.chdir(previous);
  }
});

// 요구사항 표(공통 epic 표)의 한국어 문구와 정확히 일치해야 한다. 구현 출력이 아닌 표 원문을 기대값으로 둔다.
test('COMMON_EPICS include/exclude text → matches the requirements table text', () => {
  const bySlug = Object.fromEntries(registryLib.COMMON_EPICS.map((c) => [c.slug, c]));
  assert.strictEqual(
    bySlug.foundation.include,
    '저장소 구조, 빌드·의존성·런타임 버전, 개발 환경, lint·format, CI/CD, 배포·릴리스, 인프라 코드(IaC), 환경별 설정',
  );
  assert.strictEqual(bySlug.foundation.exclude, '특정 기능의 설정값 변경 → 그 기능의 epic');
  assert.strictEqual(bySlug.features.include, '도메인 업무 규칙, 워크플로, 해당 기능 전용 화면·API·스키마·테스트');
  assert.strictEqual(bySlug.features.exclude, '공통 계층 자체의 변경 → 해당 공통 epic');
  assert.strictEqual(bySlug.data.exclude, '한 도메인 기능에만 쓰는 테이블·필드 → `features`');
});

// v2 등록부 fixture. 구현의 expandProfile을 쓰지 않고 손으로 쓴다.
function v2Registry(epics, extra = {}) {
  return { version: 2, profile: 'standard', domainEpicLimit: 3, areas: [], epics, ...extra };
}

test('epics.example.json → parseEpicRegistry accepts it as v2', () => {
  const parsed = parseEpicRegistry(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'epics.example.json'), 'utf8')));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.registry.version, 2);
  assert.deepStrictEqual([...new Set(parsed.registry.epics.map((e) => e.kind))].sort(), ['common', 'domain', 'legacy']);
});

test('v2 registry with legacy_id and blueprint_aliases → parses and resolves them', () => {
  const parsed = parseEpicRegistry(v2Registry([
    { slug: 'consumer-epic-registry', kind: 'domain', active: true, legacy_id: '114',
      blueprint_aliases: { '003': 'registry-gates', 'old-name': 'registry-gates' } },
    { slug: 'features', kind: 'common', active: true },
  ]));
  assert.equal(parsed.ok, true);
  assert.equal(resolveBlueprintAlias(parsed.registry, 'consumer-epic-registry', '003'), 'registry-gates');
  assert.equal(resolveBlueprintAlias(parsed.registry, 'consumer-epic-registry', 'old-name'), 'registry-gates');
  assert.equal(resolveBlueprintAlias(parsed.registry, 'consumer-epic-registry', '004'), null);
  assert.equal(resolveBlueprintAlias(parsed.registry, 'features', '003'), null);
  assert.equal(resolveBlueprintAlias(parsed.registry, 'missing', '003'), null);
  assert.equal(epicByLegacyId(parsed.registry, '114').slug, 'consumer-epic-registry');
  assert.equal(epicByLegacyId(parsed.registry, '999'), null);
});

test('v1 registry → still parses and its id is the legacy id', () => {
  const v1 = { version: 1, profile: 'standard', domainEpicLimit: 0, areas: [],
    epics: [{ slug: 'core', id: '002', kind: 'common', active: true }] };
  const parsed = parseEpicRegistry(v1);
  assert.equal(parsed.ok, true);
  assert.equal(epicByLegacyId(parsed.registry, '002').slug, 'core');
});

test('v1 registry epic without id → rejected', () => {
  const v1 = { version: 1, profile: 'standard', domainEpicLimit: 0, areas: [],
    epics: [{ slug: 'core', kind: 'common', active: true }] };
  assert.equal(parseEpicRegistry(v1).ok, false);
});

test('epic slug of 41 characters → rejected', () => {
  const long = 'a'.repeat(41);
  assert.equal(parseEpicRegistry(v2Registry([{ slug: long, kind: 'domain', active: true }])).ok, false);
  assert.equal(parseEpicRegistry(v2Registry([{ slug: 'a'.repeat(40), kind: 'domain', active: true }])).ok, true);
});

test('epic slug of digits only or with a three-digit prefix → rejected', () => {
  assert.equal(parseEpicRegistry(v2Registry([{ slug: '123', kind: 'domain', active: true }])).ok, false);
  assert.equal(parseEpicRegistry(v2Registry([{ slug: '114-foo', kind: 'domain', active: true }])).ok, false);
});

test('blueprint_aliases key that is neither three digits nor a slug → rejected', () => {
  const bad = parseEpicRegistry(v2Registry([
    { slug: 'billing', kind: 'domain', active: true, blueprint_aliases: { 'Bad_Key': 'registry-gates' } },
  ]));
  assert.equal(bad.ok, false);
  const numberKey = parseEpicRegistry(v2Registry([
    { slug: 'billing', kind: 'domain', active: true, blueprint_aliases: { '12': 'registry-gates' } },
  ]));
  assert.equal(numberKey.ok, false);
});

test('blueprint_aliases value that is not a slug → rejected', () => {
  const badValue = parseEpicRegistry(v2Registry([
    { slug: 'billing', kind: 'domain', active: true, blueprint_aliases: { '003': 'Not A Slug' } },
  ]));
  assert.equal(badValue.ok, false);
  const nonString = parseEpicRegistry(v2Registry([
    { slug: 'billing', kind: 'domain', active: true, blueprint_aliases: { '003': 5 } },
  ]));
  assert.equal(nonString.ok, false);
});

test('two alias keys pointing at one value → accepted', () => {
  const parsed = parseEpicRegistry(v2Registry([
    { slug: 'billing', kind: 'domain', active: true, blueprint_aliases: { '003': 'gates', '004': 'gates' } },
  ]));
  assert.equal(parsed.ok, true);
});

test('v2 registry written by writeEpicRegistry → keeps version 2 on read back', () => {
  const repo = mkRepo();
  const registry = v2Registry([{ slug: 'billing', kind: 'domain', active: true, legacy_id: '009' }]);
  fs.mkdirSync(path.join(repo, '.bouncer'));
  registryLib.writeEpicRegistry(repo, registry);
  const read = readEpicRegistry(repo);
  assert.equal(read.status, 'ok');
  assert.deepStrictEqual(read.registry, registry);
});
