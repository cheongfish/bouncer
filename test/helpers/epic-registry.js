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

module.exports = { writeEpicRegistry, COMMON_SLUGS };
