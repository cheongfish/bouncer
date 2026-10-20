'use strict';
const fs = require('node:fs');
const path = require('node:path');

const COMMON_SLUGS = [
  'foundation', 'core', 'data', 'integration', 'identity-access', 'interface', 'features', 'quality-ops',
];

/**
 * repoRoot/.bouncer/epics.json에 standard 등록부 fixture를 쓴다.
 * 기본은 공통 epic ID 001~008, areas []. overrides는 최상위 키를 덮어쓴다.
 * 구현의 expandProfile을 쓰지 않아 기대값이 구현 출력에 끌려가지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {object} [overrides] - 덮어쓸 최상위 키
 * @returns {object} 쓴 등록부 객체
 */
function writeEpicRegistry(repoRoot, overrides = {}) {
  const registry = {
    version: 1,
    profile: 'standard',
    domainEpicLimit: 0,
    areas: [],
    epics: COMMON_SLUGS.map((slug, index) => ({
      slug, id: String(index + 1).padStart(3, '0'), kind: 'common', active: true,
    })),
    ...overrides,
  };
  const abs = path.join(repoRoot, '.bouncer', 'epics.json');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(registry, null, 2)}\n`);
  return registry;
}

/**
 * fixture epic 디렉터리(`<id>-<slug>`)를 등록부에 활성 항목으로 추가한다. 등록부가 없으면
 * domainEpicLimit 99의 domain-only 등록부를 만든다. plan gate fixture가 G26~G27을 피하는 용도다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} epicDirName - `<id>-<slug>` 형식의 epic 디렉터리 이름
 * @param {string} [kind] - 항목 kind (기본 domain)
 * @returns {void}
 */
function registerFixtureEpic(repoRoot, epicDirName, kind = 'domain') {
  const abs = path.join(repoRoot, '.bouncer', 'epics.json');
  if (!fs.existsSync(abs)) {
    writeEpicRegistry(repoRoot, { profile: 'domain-only', domainEpicLimit: 99, epics: [] });
  }
  const registry = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const id = epicDirName.slice(0, 3);
  const slug = epicDirName.slice(4);
  // 같은 fixture가 여러 문서를 쓰며 반복 등록해도 등록부가 중복 행으로 깨지지 않게 한다.
  if (registry.epics.some((e) => e.id === id && e.slug === slug)) return;
  registry.epics.push({
    slug, id, kind, active: true,
    approval: { reason: 'fixture', approvedAt: '2026-01-01T00:00:00.000Z' },
  });
  fs.writeFileSync(abs, `${JSON.stringify(registry, null, 2)}\n`);
}

module.exports = { writeEpicRegistry, registerFixtureEpic, COMMON_SLUGS };
