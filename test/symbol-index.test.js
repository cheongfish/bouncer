'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveSymbol } = require('../packages/cli/dist/symbol-index');

/**
 * 파일 맵으로 임시 저장소를 만든다. resolveSymbol은 파일 시스템만 훑는다.
 *
 * @param {Record<string, string>} files - 저장소 상대 경로 → 본문
 * @returns {string} 임시 저장소 루트
 */
function makeRepo(files) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-symbol-')));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return root;
}

/**
 * 임시 저장소에서 함수 하나를 조회하고 저장소를 정리한다.
 *
 * @param {Record<string, string>} files - 저장소 파일 맵
 * @param {string} symbol - 조회할 함수명
 * @returns {ReturnType<typeof resolveSymbol>} 조회 결과
 */
function resolveIn(files, symbol) {
  const root = makeRepo(files);
  try {
    return resolveSymbol({ repoRoot: root, symbol });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// 파서가 끝내 지원하지 않을 구문. 테스트가 특정 파서 한계에 묶이지 않게 괄호가 안 맞는 파일을 쓴다.
const BROKEN = 'function target() { return ( ;\n';

test('파싱에 실패한 source 파일이 이름을 담으면 → unresolved와 unparsed_files로 알린다', () => {
  const result = resolveIn({ 'src/broken.ts': BROKEN }, 'target');
  assert.equal(result.status, 'unresolved');
  assert.deepStrictEqual(result.unparsed_files, ['src/broken.ts']);
});

test('파싱에 실패했어도 이름이 없는 파일은 → unparsed_files에 넣지 않는다', () => {
  const result = resolveIn({ 'src/broken.ts': 'function other() { return ( ;\n' }, 'target');
  assert.equal(result.status, 'unresolved');
  assert.deepStrictEqual(result.unparsed_files, []);
});

test('이름이 더 긴 식별자의 일부일 뿐이면 → unparsed_files에 넣지 않는다', () => {
  const result = resolveIn({ 'src/broken.ts': 'function targetExtra() { return ( ;\n' }, 'target');
  assert.deepStrictEqual(result.unparsed_files, []);
});

test('생성물 경로의 파싱 실패는 → unparsed_files에 넣지 않는다', () => {
  const result = resolveIn({ 'packages/cli/dist/broken.js': BROKEN }, 'target');
  assert.deepStrictEqual(result.unparsed_files, []);
});

test('정상 파일이 정의를 담으면 → resolved이고 unparsed_files가 없다', () => {
  const result = resolveIn({ 'src/ok.ts': 'function target() { return 1; }\n', 'src/broken.ts': BROKEN }, 'target');
  assert.equal(result.status, 'resolved');
  assert.equal(result.symbol_ref.path, 'src/ok.ts');
  assert.equal('unparsed_files' in result, false);
});

// 아래 구문은 예전에 파서를 어긋나게 해 파일 전체를 색인에서 빼던 형태다. 구문 뒤의 함수를 찾아야 한다.
const PARSEABLE_CONSTRUCTS = {
  'as 단언 뒤 객체 타입 안의 쉼표 제네릭': 'const a = (d as { b: Record<string, unknown> }).b;',
  '객체 리터럴 값의 as 단언에 쉼표 제네릭': 'const s = { a: d as Record<string, unknown> | null, n: 1 };',
  'satisfies 단언에 쉼표 제네릭': 'const s = { a: 1 } satisfies Record<string, number>;',
  '쉼표 제네릭의 화살표 타입 인자 호출': 'const m = new Map<string, (c: X) => Y>([["a", h]]);',
  '타입 인자가 있는 함수 호출': 'const v = g<string, number>(1);',
  '필드 선언이 있는 클래스의 생성자': 'class E extends Error { code: string; constructor(c: string) { super(c); this.code = c; } }',
  '초기값이 있는 클래스 필드': 'class E { code: string = "a"; other = 1; method() { return 1; } }',
  '템플릿 조각이 여는 괄호 문자': 'const t = g ? `[${h(g)}] ` : "";',
  '템플릿 조각이 닫는 중괄호 문자': 'const t = `${a}(${b.join(", ")}): ${c}`;',
  'import() 타입의 한정자': 'function stat(a: string): import("node:fs").Stats | null { return null; }',
};

for (const [label, construct] of Object.entries(PARSEABLE_CONSTRUCTS)) {
  test(`${label}가 앞에 있어도 → 뒤의 함수를 resolved로 찾는다`, () => {
    const result = resolveIn({ 'src/a.ts': `${construct}\nfunction target() { return 1; }\n` }, 'target');
    assert.equal(result.status, 'resolved');
    assert.equal(result.symbol_ref.path, 'src/a.ts');
  });
}

test('비교식의 꺾쇠는 → 타입 인자로 오인해 뒤의 정의를 삼키지 않는다', () => {
  const src = 'const c = a < b && d > (e);\nfunction target() { return 1; }\n';
  assert.equal(resolveIn({ 'src/a.ts': src }, 'target').status, 'resolved');
});

test('문자열 값이 구조 문자와 같아도 → 괄호 짝에 영향을 주지 않는다', () => {
  const src = 'const s = ["(", "[", "{", "}"];\nfunction target() { return "}"; }\n';
  assert.equal(resolveIn({ 'src/a.ts': src }, 'target').status, 'resolved');
});
