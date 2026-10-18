'use strict';
// 경로 겹침 규칙의 정본. 문서 검증(validate-sections)이 소유하면 scope·dag-shape·
// execution-dag 같은 하위 모듈이 규칙 하나 때문에 검증 계층을 가져와야 한다.
// 그래서 I/O 없는 별도 모듈로 두고 validate-sections는 같은 이름으로 재export한다.
/**
 * 두 경로가 같거나 한쪽이 다른 쪽의 조상 디렉터리인지 판정한다.
 * 디렉터리 prefix도 교차로 본다. `scripts/` 금지가 `scripts/lib/x.js`를
 * 통과시키면 G12가 파일 단위 affected_paths를 놓친다.
 *
 * @param {string} a - 한쪽 경로(`./`·trailing `/`는 호출자가 미리 정규화한다)
 * @param {string} b - 다른 쪽 경로
 * @returns {boolean} 같거나 조상·자손 관계이면 true
 */
function pathsOverlap(a, b) {
    return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
module.exports = { pathsOverlap };
