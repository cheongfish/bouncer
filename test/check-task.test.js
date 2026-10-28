'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { main } = require('../scripts/check-task');

const GOOD = "test('조건 → 결과', () => {});\n";
const BAD = "test('no arrow', () => {});\n";
const TIERS = { unit: ['u.test.js', 'bad.test.js'], integration: ['i.test.js'] };

// main()은 디스크를 읽으므로 임시 디렉터리에 fixture 저장소를 만든다.
function makeRepo(tiersText = JSON.stringify(TIERS)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-task-'));
  fs.mkdirSync(path.join(dir, 'test', 'dir.test.js'), { recursive: true });
  const files = {
    'tiers.json': tiersText,
    'u.test.js': GOOD,
    'i.test.js': GOOD,
    'bad.test.js': BAD,
    'orphan.test.js': GOOD,
    'both.test.js': GOOD,
  };
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'test', name), body);
  return dir;
}

// spawn 호출을 기록하는 seam. results[i]가 i번째 호출의 반환값이다(기본 status 0).
function runMain(argv, { cwd = makeRepo(), results = [] } = {}) {
  const calls = [];
  let out = '';
  let err = '';
  const deps = {
    spawnSync: (cmd, args, opts) => {
      calls.push({ cmd, args, env: opts.env });
      return results[calls.length - 1] || { status: 0 };
    },
  };
  const io = {
    out: { write: (s) => { out += s; } },
    err: { write: (s) => { err += s; } },
    cwd,
  };
  // 이 테스트 자체가 unit guard 아래서 돌 수 있어 NODE_OPTIONS에 guard가 이미 있다.
  // integration 호출에 guard가 없다는 단언이 실행 환경에 좌우되지 않게 비워 둔다.
  const saved = process.env.NODE_OPTIONS;
  delete process.env.NODE_OPTIONS;
  let code;
  try {
    code = main(argv, io, deps);
  } finally {
    if (saved !== undefined) process.env.NODE_OPTIONS = saved;
  }
  return { code, out, err, calls };
}

test('인자 없음 → exit 2와 usage, spawn 없음', () => {
  const r = runMain([]);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /usage:/);
  assert.strictEqual(r.calls.length, 0);
});

test('없는 테스트 파일 → exit 1과 missing test file, spawn 없음', () => {
  const r = runMain(['test/none.test.js']);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /missing test file: test\/none\.test\.js/);
  assert.strictEqual(r.calls.length, 0);
});

test('test 디렉터리 인자 → exit 1과 not a test file, spawn 없음', () => {
  const r = runMain(['test']);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /not a test file: test\n/);
  assert.strictEqual(r.calls.length, 0);
});

test('디렉터리인 .test.js 경로 → exit 1과 missing test file, spawn 없음', () => {
  const r = runMain(['test/dir.test.js']);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /missing test file: test\/dir\.test\.js/);
  assert.strictEqual(r.calls.length, 0);
});

test('깨진 tiers.json → exit 1, 이름 lint 전에 중단하고 spawn 없음', () => {
  const r = runMain(['test/u.test.js'], { cwd: makeRepo('{') });
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /cannot read test\/tiers\.json:/);
  assert.strictEqual(r.calls.length, 0);
  assert.doesNotMatch(r.out, /names:/);
});

test('이름 위반 파일 → exit 1과 missing-arrow', () => {
  const r = runMain(['test/bad.test.js']);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /missing-arrow/);
});

test('tiers.json에 없는 파일 → exit 1과 not in test/tiers.json', () => {
  const r = runMain(['test/orphan.test.js']);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /not in test\/tiers\.json: test\/orphan\.test\.js/);
});

test('unit과 integration 파일 → exit 0, spawn 3회, tier별 env', () => {
  const r = runMain(['test/u.test.js', 'test/i.test.js']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.calls.length, 3);
  assert.deepStrictEqual(r.calls[0].args, ['--test', 'test/test-tiers.test.js', 'test/plugin-doc-cites.test.js']);
  assert.match(r.calls[1].env.NODE_OPTIONS, /no-spawn\.js/);
  assert.doesNotMatch(r.calls[2].env.NODE_OPTIONS || '', /no-spawn\.js/);
  for (const c of r.calls) assert.ok(!('NODE_TEST_CONTEXT' in c.env));
});

test('성공 실행 → 단계 요약이 정해진 순서로 out에 나옴', () => {
  const r = runMain(['test/u.test.js', 'test/i.test.js']);
  const lines = r.out.split('\n');
  const want = ['names: ok', 'tiers: ok', 'fixed checks: ok', 'unit: ok', 'integration: ok'];
  const idx = want.map((w) => lines.indexOf(w));
  assert.ok(idx.every((i) => i >= 0), r.out);
  assert.deepStrictEqual([...idx].sort((a, b) => a - b), idx);
});

test('unit 파일만 → spawn 2회, integration skip', () => {
  const r = runMain(['test/u.test.js']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.calls.length, 2);
  assert.match(r.out, /integration: skip/);
});

test('unit 호출만 status 1 → exit 1', () => {
  const r = runMain(['test/u.test.js', 'test/i.test.js'], { results: [{ status: 0 }, { status: 1 }] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /unit: fail/);
});

test('고정 검사 호출만 status null → exit 1', () => {
  const r = runMain(['test/u.test.js', 'test/i.test.js'], { results: [{ status: null }] });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /fixed checks: fail/);
});

test('integration 호출만 error → exit 1', () => {
  const results = [{ status: 0 }, { status: 0 }, { status: 0, error: new Error('x') }];
  const r = runMain(['test/u.test.js', 'test/i.test.js'], { results });
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /integration: fail/);
});

test('이름 위반 뒤에도 → exit 1이고 남은 단계 spawn 3회', () => {
  const r = runMain(['test/bad.test.js', 'test/i.test.js']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.calls.length, 3);
});

test('미등록 파일과 unit 파일 → exit 1, spawn 2회, 미등록 파일은 실행 안 함', () => {
  const r = runMain(['test/orphan.test.js', 'test/u.test.js']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.calls.length, 2);
  for (const c of r.calls) assert.ok(!c.args.includes('test/orphan.test.js'));
});

test('두 tier에 모두 등록된 파일 → exit 1, tiers fail, 실행 안 함', () => {
  const both = { unit: ['both.test.js'], integration: ['both.test.js'] };
  const r = runMain(['test/both.test.js'], { cwd: makeRepo(JSON.stringify(both)) });
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /in both tiers of test\/tiers\.json: test\/both\.test\.js/);
  assert.match(r.out, /tiers: fail/);
  for (const c of r.calls) assert.ok(!c.args.includes('test/both.test.js'));
});

test('./ 접두 경로 → 정규화되어 unit 호출 args에 test/u.test.js', () => {
  const r = runMain(['./test/u.test.js']);
  assert.strictEqual(r.code, 0);
  assert.ok(r.calls[1].args.includes('test/u.test.js'));
});
