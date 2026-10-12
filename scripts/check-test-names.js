'use strict';

const fs = require('node:fs');
const path = require('node:path');

// 화살표 구분자. ASCII `->`는 일부러 인정하지 않는다(규칙: 조건 → 결과).
const ARROW = ' → ';
// 정규식 리터럴이 시작될 수 있는 직전 유효 문자들. 나눗셈과 구분하기 위한 휴리스틱이다.
const REGEX_PREV = '(,=:[!&|?{};+-*%<>~^';
const IDENT_CHAR = /[A-Za-z0-9_$]/;

/**
 * 따옴표 문자열 하나를 건너뛴다. 이스케이프는 다음 글자까지 통째로 넘긴다.
 *
 * @param {string} src - 전체 소스
 * @param {number} i - 여는 따옴표 위치
 * @returns {number} 닫는 따옴표 다음 위치(닫히지 않으면 src 길이)
 */
function skipQuoted(src, i) {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
  return Math.min(j + 1, src.length);
}

/**
 * template literal 하나를 건너뛴다. `${…}` 안은 코드이므로 scanCode로 재귀해
 * 안쪽의 문자열·중첩 template이 닫는 백틱을 가리지 않게 한다.
 *
 * @param {string} src - 전체 소스
 * @param {number} i - 여는 백틱 위치
 * @returns {number} 닫는 백틱 다음 위치(닫히지 않으면 src 길이)
 */
function skipTemplate(src, i) {
  let j = i + 1;
  while (j < src.length && src[j] !== '`') {
    if (src[j] === '\\') j += 2;
    else if (src[j] === '$' && src[j + 1] === '{') j = scanCode(src, j + 2, null, true);
    else j += 1;
  }
  return Math.min(j + 1, src.length);
}

/**
 * 정규식 리터럴 하나를 건너뛴다. 문자 클래스 `[...]` 안의 `/`는 종료가 아니다.
 *
 * @param {string} src - 전체 소스
 * @param {number} i - 여는 `/` 위치
 * @returns {number} 플래그까지 포함한 다음 위치
 */
function skipRegex(src, i) {
  let j = i + 1;
  let inClass = false;
  while (j < src.length && src[j] !== '\n') {
    const c = src[j];
    if (c === '\\') j += 2;
    else if (c === '[') { inClass = true; j += 1; }
    else if (c === ']') { inClass = false; j += 1; }
    else if (c === '/' && !inClass) { j += 1; break; }
    else j += 1;
  }
  while (j < src.length && /[a-z]/.test(src[j])) j += 1;
  return j;
}

/**
 * 첫 인자 토큰을 읽어 이름 항목으로 만든다. 리터럴 뒤가 `,`/`)`가 아니면
 * (`'a' + b` 같은 연결식) 리터럴이 아니므로 dynamic으로 본다.
 *
 * @param {string} src - 전체 소스
 * @param {number} open - `(` 위치
 * @param {number} line - 호출 시작 줄
 * @returns {{line: number, name: string|null, kind: string}} 이름 항목
 */
function readFirstArg(src, open, line) {
  let i = open + 1;
  while (i < src.length && /\s/.test(src[i])) i += 1;
  const c = src[i];
  const dynamic = { line, name: null, kind: 'dynamic' };
  if (c !== "'" && c !== '"' && c !== '`') return dynamic;
  const end = c === '`' ? skipTemplate(src, i) : skipQuoted(src, i);
  let k = end;
  while (k < src.length && /\s/.test(src[k])) k += 1;
  if (src[k] !== ',' && src[k] !== ')') return dynamic;
  return { line, name: src.slice(i + 1, end - 1), kind: c === '`' ? 'template' : 'literal' };
}

/**
 * 코드 영역을 훑으며 주석·문자열·정규식은 건너뛰고 `test(`/`it(` 호출을 수집한다.
 *
 * @param {string} src - 전체 소스
 * @param {number} start - 시작 위치
 * @param {Array|null} hits - 수집 배열(template 안쪽 재귀에서는 null: 건너뛰기만 함)
 * @param {boolean} untilBrace - true면 짝이 맞는 `}`에서 멈추고 그 다음 위치를 반환
 * @returns {number} 멈춘 위치
 */
function scanCode(src, start, hits, untilBrace) {
  let i = start;
  let depth = 0;
  let prev = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
    } else if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      i = close === -1 ? src.length : close + 2;
    } else if (c === "'" || c === '"') {
      i = skipQuoted(src, i);
      prev = 'x';
    } else if (c === '`') {
      i = skipTemplate(src, i);
      prev = 'x';
    } else if (c === '/' && (prev === '' || REGEX_PREV.includes(prev))) {
      i = skipRegex(src, i);
      prev = 'x';
    } else {
      if (untilBrace && c === '{') depth += 1;
      if (untilBrace && c === '}') {
        if (depth === 0) return i + 1;
        depth -= 1;
      }
      const m = hits && (c === 't' || c === 'i') && /^(test|it)\(/.exec(src.slice(i, i + 5));
      if (m && !IDENT_CHAR.test(src[i - 1] || '') && src[i - 1] !== '.') {
        const line = src.slice(0, i).split('\n').length;
        hits.push(readFirstArg(src, i + m[1].length, line));
        i += m[1].length + 1;
        prev = '(';
        continue;
      }
      if (!/\s/.test(c)) prev = c;
      i += 1;
    }
  }
  return i;
}

/**
 * 소스에서 `test(`/`it(` 호출의 첫 인자를 추출한다. 한 줄 정규식이 아니라
 * 토큰 단위로 훑으므로 여러 줄 호출, 주석, 문자열 속 `test(`를 올바르게 처리한다.
 *
 * @param {string} source - 테스트 파일 소스
 * @returns {Array<{line: number, name: string|null, kind: 'literal'|'template'|'dynamic'}>}
 *   line은 호출 시작 줄(1부터), name은 따옴표를 뺀 원문(dynamic이면 null)
 */
function findTestNames(source) {
  const hits = [];
  scanCode(source, 0, hits, false);
  return hits;
}

/**
 * 이름 항목이 `<조건> → <결과>` 형식인지 판정한다.
 *
 * @param {{name: string|null, kind: string}} entry - findTestNames 항목
 * @returns {null|'missing-arrow'|'empty-side'|'dynamic-name'} 적합이면 null, 아니면 사유
 */
function classifyName(entry) {
  if (entry.kind === 'dynamic' || entry.name === null) return 'dynamic-name';
  // 공백으로 감싼 화살표만 인정한다. ASCII `->`나 공백 없는 `→`는 화살표 없음으로 본다.
  const spaced = entry.name.indexOf(ARROW);
  if (spaced === -1) return 'missing-arrow';
  const left = entry.name.slice(0, spaced);
  const right = entry.name.slice(spaced + ARROW.length);
  if (left.trim() === '' || right.trim() === '') return 'empty-side';
  return null;
}

/**
 * 인자로 받은 파일(없으면 `<cwd>/test/*.test.js`)의 테스트 이름을 검사한다.
 * 부적합 이름마다 io.err를 한 번, 마지막에 io.out을 한 번 호출한다.
 *
 * @param {string[]} argv - 파일 경로 목록(상대 경로는 io.cwd 기준)
 * @param {{out: function(string): void, err: function(string): void, cwd: string}} io - 출력 seam과 기준 디렉터리
 * @returns {number} 부적합 이름이 하나라도 있으면 1, 없으면 0
 */
function main(argv, io) {
  const files = argv.length > 0
    ? argv
    : fs.readdirSync(path.join(io.cwd, 'test'))
      .filter((f) => f.endsWith('.test.js') && fs.statSync(path.join(io.cwd, 'test', f)).isFile())
      .sort()
      .map((f) => `test/${f}`);
  let names = 0;
  let bad = 0;
  for (const file of files) {
    const abs = path.resolve(io.cwd, file);
    const rel = path.relative(io.cwd, abs).split(path.sep).join('/');
    for (const entry of findTestNames(fs.readFileSync(abs, 'utf8'))) {
      names += 1;
      const reason = classifyName(entry);
      if (reason === null) continue;
      bad += 1;
      io.err(`${rel}:${entry.line} ${reason} ${entry.name === null ? '-' : entry.name}\n`);
    }
  }
  io.out(`checked ${files.length} files, ${names} names\n`);
  return bad > 0 ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2), {
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
    cwd: process.cwd(),
  });
}

module.exports = { findTestNames, classifyName, main };
