'use strict';
// 경로 겹침 규칙의 정본. 문서 검증(validate-sections)이 소유하면 scope·dag-shape·
// execution-dag 같은 하위 모듈이 규칙 하나 때문에 검증 계층을 가져와야 한다.
// 그래서 I/O 없는 별도 모듈로 두고 validate-sections는 같은 이름으로 재export한다.

/**
 * 두 경로가 같거나 한쪽이 다른 쪽의 조상 디렉터리인지 판정한다.
 * 디렉터리 prefix도 교차로 본다. `scripts/` 금지가 `scripts/lib/x.js`를
 * 통과시키면 scope 충돌 판정이 파일 단위 affected_paths를 놓친다.
 *
 * @param {string} a - 한쪽 경로(`./`·trailing `/`는 호출자가 미리 정규화한다)
 * @param {string} b - 다른 쪽 경로
 * @returns {boolean} 같거나 조상·자손 관계이면 true
 */
function pathsOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

/**
 * pathsOverlap에 넘기기 전에 경로 표기만 맞추는 정규화의 정본. 비교 알고리즘은 바꾸지 않는다.
 * 문서·Checklist·원장은 `src/`·`./src/a.ts`·Windows식 `src\\a.ts`처럼 표기가 갈리는데,
 * pathsOverlap은 그 형태를 조상으로 보지 못하므로 호출 전에 같은 모양으로 벗겨야 한다.
 * 경로 겹침(execution-dag)과 scope 비교(finalize-digest)가 따로 정규화하면 한쪽만 고쳐
 * 판정이 갈라지므로 이 함수 하나만 쓴다. 이 모듈은 import가 없어야 해서
 * 역슬래시 변환(posix-path의 toPosix와 같은 규칙)도 여기에 직접 둔다.
 *
 * @param {string} raw - affected_paths/scope.paths 항목 또는 변경 경로
 * @returns {string} 역슬래시를 `/`로 바꾸고 선행 `./`·말미 `/`(단독 `/` 제외)를 제거한 경로
 */
function normalizeOverlapPath(raw: string): string {
  let p = raw.replace(/\\/g, '/');
  // 1. 문서·lease가 상대경로를 `./foo`·`././foo`로 적는 경우 — 동일 경로를 놓치지 않게 접두만 반복 제거
  while (p.startsWith('./')) p = p.slice(2);
  // 2. 디렉터리 표기 `src/` → `src`. bare `/`는 루트 의미가 있어 유지한다.
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

export = { pathsOverlap, normalizeOverlapPath };
