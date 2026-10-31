'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolveSymbol, listDefinitionsInText } = require('../packages/cli/dist/symbol-index');

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

/**
 * 파일 본문 하나를 listDefinitionsInText로 연다. 경로와 본문만 받아 호출을 짧게 한다.
 *
 * @param {string} rel - 저장소 상대 posix 경로
 * @param {string} text - 파일 본문
 * @returns {ReturnType<typeof listDefinitionsInText>} 열거 결과
 */
function listText(rel, text) {
  return listDefinitionsInText({ path: rel, bytes: Buffer.from(text) });
}

/**
 * Git blob 형식(`blob <길이>\0` 헤더 + 본문)을 테스트가 직접 해시한다. 구현이 돌려준 값을
 * 기대값으로 쓰지 않도록 구현과 따로 계산한다.
 *
 * @param {Buffer} bytes - 파일 본문
 * @returns {string} 40자리 hex blob SHA
 */
function independentBlobSha(bytes) {
  return crypto.createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

test('같은 이름의 함수 선언과 클래스 메서드 → 두 정의를 선언 순서대로 모두 열거한다', () => {
  const result = listText('src/a.ts', 'function a() { return 1; }\nclass K { a() { return 2; } }\n');
  assert.equal(result.status, 'parsed');
  assert.deepStrictEqual(result.definitions.map((d) => d.qualified_name), ['a', 'K.a']);
  assert.deepStrictEqual(result.definitions.map((d) => d.kind), ['function-declaration', 'class-method']);
});

test('중첩 함수와 안쪽 화살표 함수가 있으면 → 바깥과 안쪽 정의를 모두 start_line 순으로 열거한다', () => {
  const src = [
    'function outer() {',
    '  function inner() { return 1; }',
    '  const arrow = () => 2;',
    '  return inner() + arrow();',
    '}',
    '',
  ].join('\n');
  const result = listText('src/a.ts', src);
  assert.deepStrictEqual(
    result.definitions.map((d) => [d.qualified_name, d.start_line, d.end_line]),
    [['outer', 1, 5], ['outer.inner', 2, 2], ['outer.arrow', 3, 3]],
  );
});

test('같은 이름과 kind의 함수 선언이 두 번 있으면 → 두 항목을 start_line 1과 2로 모두 남긴다', () => {
  const result = listText('src/a.ts', 'function f() { return 1; }\nfunction f() { return 2; }\n');
  assert.deepStrictEqual(
    result.definitions.map((d) => [d.qualified_name, d.kind, d.start_line]),
    [['f', 'function-declaration', 1], ['f', 'function-declaration', 2]],
  );
});

for (const [label, construct] of Object.entries(PARSEABLE_CONSTRUCTS)) {
  test(`${label}가 앞에 있어도 → 뒤의 target 정의를 parsed로 열거한다`, () => {
    const result = listText('src/a.ts', `${construct}\nfunction target() { return 1; }\n`);
    assert.equal(result.status, 'parsed');
    assert.ok(result.definitions.map((d) => d.qualified_name).includes('target'));
  });
}

test('비교식의 꺾쇠가 있으면 → 뒤의 target 정의를 parsed로 열거한다', () => {
  const result = listText('src/a.ts', 'const c = a < b && d > (e);\nfunction target() { return 1; }\n');
  assert.equal(result.status, 'parsed');
  assert.ok(result.definitions.map((d) => d.qualified_name).includes('target'));
});

test('문자열 값이 구조 문자와 같으면 → 뒤의 target 정의를 parsed로 열거한다', () => {
  const result = listText('src/a.ts', 'const s = ["(", "[", "{", "}"];\nfunction target() { return "}"; }\n');
  assert.equal(result.status, 'parsed');
  assert.ok(result.definitions.map((d) => d.qualified_name).includes('target'));
});

test('구문 오류 파일이면 → parse_failed이고 definitions 키가 없으며 blob_sha는 독립 계산값과 같다', () => {
  const bytes = Buffer.from(BROKEN);
  const result = listDefinitionsInText({ path: 'src/broken.ts', bytes });
  assert.equal(result.status, 'parse_failed');
  assert.equal('definitions' in result, false);
  assert.equal(result.blob_sha, independentBlobSha(bytes));
});

test('빈 본문이면 → 구문 실패가 아니라 definitions가 빈 parsed다', () => {
  const result = listDefinitionsInText({ path: 'src/empty.ts', bytes: Buffer.alloc(0) });
  assert.equal(result.status, 'parsed');
  assert.deepStrictEqual(result.definitions, []);
});

test('정의가 있는 파일이면 → 결과와 각 정의의 blob_sha가 독립 계산값과 같다', () => {
  const bytes = Buffer.from('function f() { return 1; }\n');
  const result = listDefinitionsInText({ path: 'src/a.ts', bytes });
  const expected = independentBlobSha(bytes);
  assert.equal(result.blob_sha, expected);
  assert.deepStrictEqual(result.definitions.map((d) => d.blob_sha), [expected]);
});

test('스크립트가 아닌 확장자면 → unsupported이고 reason은 extension이며 blob_sha와 role이 없다', () => {
  const result = listDefinitionsInText({ path: 'docs/readme.md', bytes: Buffer.from('function f() {}\n') });
  assert.deepStrictEqual(result, { status: 'unsupported', path: 'docs/readme.md', reason: 'extension' });
});

test('.d.ts 선언 파일이면 → unsupported이고 reason은 declaration-file이다', () => {
  const bytes = Buffer.from('declare function f(): void;\n');
  const result = listDefinitionsInText({ path: 'src/types.d.ts', bytes });
  assert.deepStrictEqual(result, { status: 'unsupported', path: 'src/types.d.ts', reason: 'declaration-file' });
});

test('NUL 바이트가 있으면 → unsupported이고 reason은 binary이다', () => {
  const result = listDefinitionsInText({ path: 'src/bin.ts', bytes: Buffer.from([0x61, 0x00, 0x62]) });
  assert.deepStrictEqual(result, { status: 'unsupported', path: 'src/bin.ts', reason: 'binary' });
});

test('UTF-8이 아닌 바이트가 있으면 → unsupported이고 reason은 binary이다', () => {
  const result = listDefinitionsInText({ path: 'src/bin.ts', bytes: Buffer.from([0xff, 0xfe]) });
  assert.deepStrictEqual(result, { status: 'unsupported', path: 'src/bin.ts', reason: 'binary' });
});

for (const [rel, role] of [
  ['test/a.test.js', 'test'],
  ['packages/cli/dist/a.js', 'generated'],
  ['vendor/a.js', 'vendor'],
  ['src/a.ts', 'source'],
]) {
  test(`${rel} 경로이면 → role이 ${role}이다`, () => {
    const result = listText(rel, 'function f() { return 1; }\n');
    assert.equal(result.status, 'parsed');
    assert.equal(result.role, role);
  });
}

test('path가 빈 문자열이면 → 호출 거부로 throw한다', () => {
  // 원시 TypeError와 구분하려고 name을 Error로 고정한다. 검증 가드가 던진 오류만 통과한다.
  assert.throws(() => listDefinitionsInText({ path: '', bytes: Buffer.alloc(0) }), { name: 'Error' });
});

test('bytes가 문자열이면 → 호출 거부로 throw한다', () => {
  assert.throws(
    () => listDefinitionsInText({ path: 'src/a.ts', bytes: 'function a() {}' }),
    { name: 'Error' },
  );
});
