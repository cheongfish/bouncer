'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findTestNames, classifyName, main } = require('../scripts/check-test-names');

// main()은 디스크를 읽으므로 임시 디렉터리에 fixture 트리를 만든다.
function makeTree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-test-names-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

test('여러 줄 호출·주석·문자열이 섞인 소스 → 대상 호출만 줄 번호와 판정을 돌려줌', () => {
  const src = [
    "test('빈 brief → G10 실패', () => {});",
    'it(\n  `${skill} 카탈로그 → 일치`, () => {});',
    "test('no arrow here', () => {});",
    "test('a -> b', () => {});",
    "test(' → 결과', () => {});",
    'test(name, () => {});',
    'if (/x/.test(s)) {}',
    "// test('줄 주석', () => {});",
    "/* test('블록 주석', () => {}); */",
    'const s = "test(\'문자열 안\', () => {})";',
  ].join('\n');
  const got = findTestNames(src).map((e) => [e.line, classifyName(e)]);
  assert.deepStrictEqual(got, [
    [1, null],
    [2, null],
    [4, 'missing-arrow'],
    [5, 'missing-arrow'],
    [6, 'empty-side'],
    [7, 'dynamic-name'],
  ]);
});

test('template literal 이름 → ${…} 원문을 남기고 kind가 template', () => {
  const [entry] = findTestNames('it(`${a} 조건 → 결과`, () => {});');
  assert.deepStrictEqual(entry, { line: 1, name: '${a} 조건 → 결과', kind: 'template' });
});

test('동적 첫 인자 → name이 null이고 kind가 dynamic', () => {
  const [entry] = findTestNames('test(name, () => {});');
  assert.deepStrictEqual(entry, { line: 1, name: null, kind: 'dynamic' });
});

test('화살표 뒤가 공백뿐인 이름 → empty-side', () => {
  const [entry] = findTestNames("test('조건 →  ', () => {});");
  assert.strictEqual(classifyName(entry), 'empty-side');
});

test('인자 없이 실행 → test/*.test.js만 검사하고 helpers는 제외하며 부적합은 1을 반환', () => {
  const tmp = makeTree({
    'test/a.test.js': "test('no arrow', () => {});\n",
    'test/helpers/h.test.js': "test('ignored', () => {});\n",
  });
  const out = [];
  const err = [];
  const code = main([], { out: (s) => out.push(s), err: (s) => err.push(s), cwd: tmp });
  assert.strictEqual(code, 1);
  assert.deepStrictEqual(err, ['test/a.test.js:1 missing-arrow no arrow\n']);
  assert.deepStrictEqual(out, ['checked 1 files, 1 names\n']);
});

test('모든 이름이 적합 → 0을 반환하고 개수만 출력', () => {
  const tmp2 = makeTree({ 'test/b.test.js': "test('x → y', () => {});\n" });
  const out2 = [];
  assert.strictEqual(main([], { out: (s) => out2.push(s), err: () => {}, cwd: tmp2 }), 0);
  assert.deepStrictEqual(out2, ['checked 1 files, 1 names\n']);
});

test('동적 이름 → stderr에 name 자리 "-"로 보고', () => {
  const tmp = makeTree({ 'test/c.test.js': 'test(name, () => {});\n' });
  const err = [];
  const code = main(['test/c.test.js'], { out: () => {}, err: (s) => err.push(s), cwd: tmp });
  assert.strictEqual(code, 1);
  assert.deepStrictEqual(err, ['test/c.test.js:1 dynamic-name -\n']);
});
