'use strict';

// review-diff-intent 모듈은 동결된 review snapshot의 diff·files와 base 커밋만으로 변경 함수 후보와 파일별
// coverage를 만들어야 한다. 실제 임시 저장소와 captureReviewSnapshot으로 snapshot을 얻고, 기대값은 fixture
// 소스의 줄 번호와 git 명령으로만 구한다. 구현의 반환값에서 기대값을 만들지 않는다.
// Git을 띄우므로 integration tier에 둔다(test/tiers.json).

const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { extractChangedFunctions, collectDiffIntent } = require('../packages/cli/dist/review-diff-intent');
const { captureReviewSnapshot } = require('../packages/cli/dist/review-snapshot');
const { canonicalJson, sha256Canonical } = require('../packages/cli/dist/canonical-json');
const { resolveIntentAtRevision } = require('../packages/cli/dist/intent-provenance');

const dirs = [];

after(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

const BLUEPRINT = '.bouncer/context/epics/e/blueprints/b';
const M_PATH = 'src/m.ts';
// 공통 fixture. 줄 번호 1~11이 모든 기대값의 근거다. 6번 줄은 `const b`, 9번 줄부터 drop이다.
const M_LINES = [
  'export function keep() {', '  return 1;', '}',
  'export function edit() {', '  const a = 1;', '  const b = 2;', '  return a + b;', '}',
  'export function drop() {', '  return 0;', '}',
];
const M_TEXT = textOf(M_LINES);

/**
 * 테스트마다 새 임시 디렉터리를 realpath 아래에 만든다. 실제 checkout과 사용자 설정을 건드리지 않도록
 * os.tmpdir() 아래에만 둔다.
 *
 * @param {string} prefix - 디렉터리 이름 접두사
 * @returns {string} 정리 대상에 등록된 절대 경로
 */
function tmpDir(prefix) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
  dirs.push(dir);
  return dir;
}

/**
 * 고정 identity로 git을 실행한다. 상위 프로세스가 물려준 GIT_DIR 등은 지워서 fixture가 엉뚱한 저장소를 건드리지
 * 않게 하고, GIT_CONFIG_NOSYSTEM=1로 시스템 설정이 fixture SHA에 섞이지 않게 한다.
 *
 * @param {string} cwd - git을 실행할 디렉터리
 * @param {string[]} args - git argv
 * @returns {string} stdout(utf8)
 */
function git(cwd, args) {
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key];
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'bouncer-test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'bouncer-test',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * 저장소에서 spec을 SHA로 펼친다. 기대값을 테스트가 Git에서 독립적으로 얻는 통로다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} spec - rev-parse 인자
 * @returns {string} rev-parse 출력(공백 제거)
 */
function revParse(repo, spec) {
  return git(repo, ['rev-parse', spec]).trim();
}

/**
 * 줄 배열을 줄바꿈으로 이은 파일 본문으로 바꾼다. 마지막 줄바꿈을 붙인다.
 *
 * @param {string[]} lines - 줄 목록
 * @returns {string} 파일 본문
 */
function textOf(lines) {
  return `${lines.join('\n')}\n`;
}

/**
 * 줄 배열의 한 줄만 바꾼 새 배열을 돌려준다. 원본 fixture는 건드리지 않는다.
 *
 * @param {string[]} lines - 원본 줄 배열
 * @param {number} index - 0부터 센 줄 인덱스(줄 번호 - 1)
 * @param {string} value - 새 줄 내용
 * @returns {string[]} 새 배열
 */
function replaceAt(lines, index, value) {
  const copy = lines.slice();
  copy[index] = value;
  return copy;
}

/**
 * 저장소 상대 경로에 본문을 쓴다. 상위 디렉터리가 없으면 만든다. 본문은 문자열이나 Buffer다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} rel - 저장소 상대 경로
 * @param {string | Buffer} body - 파일 본문
 * @returns {void}
 */
function writeText(repo, rel, body) {
  const abs = path.join(repo, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

/**
 * base 커밋 하나를 만든다. 파일과 symlink를 함께 커밋하고, 커밋 SHA를 돌려준다.
 *
 * @param {Record<string, string | Buffer>} files - 저장소 상대 경로 → 본문
 * @param {Record<string, string>} [links] - 저장소 상대 경로 → symlink 대상
 * @returns {{ repo: string, base: string }} 저장소 경로와 base SHA
 */
function baseRepo(files, links = {}) {
  const repo = tmpDir('bouncer-diff-intent-');
  git(repo, ['init', '-q']);
  for (const [rel, body] of Object.entries(files)) writeText(repo, rel, body);
  for (const [rel, target] of Object.entries(links)) {
    const abs = path.join(repo, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.symlinkSync(target, abs);
  }
  git(repo, ['add', '-A']);
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'base']);
  return { repo, base: revParse(repo, 'HEAD') };
}

/**
 * 작업 트리를 동결해 snapshot 객체를 얻는다. 캡처 실패는 테스트 실패로 본다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} base - base SHA
 * @returns {object} 동결된 snapshot
 */
function snapshotOf(repo, base) {
  const captured = captureReviewSnapshot({
    repoRoot: repo,
    blueprintDir: BLUEPRINT,
    taskId: null,
    base,
    head: 'HEAD',
  });
  assert.equal(captured.ok, true, `snapshot capture failed: ${captured.reason}`);
  return captured.snapshot;
}

/**
 * 모듈을 호출하는 얇은 래퍼다. historyRef는 항상 base SHA다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} base - base SHA
 * @param {object} snapshot - 동결된 snapshot
 * @returns {object} extractChangedFunctions 결과
 */
function extract(repo, base, snapshot) {
  return extractChangedFunctions({ repoRoot: repo, snapshot, historyRef: base });
}

/**
 * base 커밋 → 작업 트리 변경 → snapshot → 추출을 한 번에 한다.
 *
 * @param {Record<string, string | Buffer>} files - base 파일
 * @param {(repo: string) => void} mutate - 작업 트리를 바꾸는 함수
 * @param {Record<string, string>} [links] - base symlink
 * @returns {{ repo: string, base: string, snapshot: object, result: object }} fixture와 결과
 */
function scenario(files, mutate, links = {}) {
  const { repo, base } = baseRepo(files, links);
  mutate(repo);
  const snapshot = snapshotOf(repo, base);
  return { repo, base, snapshot, result: extract(repo, base, snapshot) };
}

/**
 * 후보의 대표 이름(base 쪽이 있으면 base, 없으면 snapshot 쪽)을 돌려준다.
 *
 * @param {object} candidate - 후보
 * @returns {string} qualified_name
 */
function nameOf(candidate) {
  return (candidate.base_ref ?? candidate.snapshot_ref).qualified_name;
}

/**
 * 파일 coverage 행 하나를 찾는다. 없으면 테스트가 실패한다.
 *
 * @param {object} result - extract 결과
 * @param {string} rel - 저장소 상대 경로
 * @returns {object} coverage 행
 */
function rowOf(result, rel) {
  const row = result.files.find((item) => item.path === rel);
  assert.ok(row, `no coverage row for ${rel}`);
  return row;
}

/**
 * 같은 대표 이름을 가진 후보들을 돌려준다.
 *
 * @param {object} result - extract 결과
 * @param {string} name - qualified_name
 * @returns {object[]} 후보 목록
 */
function namedCandidates(result, name) {
  return result.candidates.filter((item) => nameOf(item) === name);
}

/**
 * 모듈이 의도적으로 던진 거절인지 확인하는 검사 함수다. 계약은 "비어 있지 않은 plain Error"다.
 * TypeError 같은 하위 클래스는 모듈이 아직 없거나 깨졌다는 뜻이므로 거절로 세지 않는다. 그래야
 * export 누락이 throw 테스트를 조용히 통과시키지 못한다.
 *
 * @param {unknown} error - 잡힌 값
 * @returns {boolean} 정확히 Error이고 메시지가 비어 있지 않으면 true
 */
function isNonEmptyError(error) {
  return error instanceof Error && error.constructor === Error && error.message.length > 0;
}

/**
 * m.ts 한 파일만 주어진 줄 배열로 바꾸는 mutate 함수를 만든다.
 *
 * @param {string[]} lines - 새 줄 배열
 * @returns {(repo: string) => void} mutate 함수
 */
function withM(lines) {
  return (repo) => writeText(repo, M_PATH, textOf(lines));
}

// 1. 문맥 줄만 겹친 함수는 후보가 아니다.
test('6번 줄만 바뀜(3·9번 문맥) → edit 하나가 paired이고 keep·drop은 후보가 아니다', () => {
  const { result } = scenario({ [M_PATH]: M_TEXT }, withM(replaceAt(M_LINES, 5, '  const b = 3;')));
  assert.deepEqual(result.candidates.map(nameOf), ['edit']);
  const [edit] = result.candidates;
  assert.equal(edit.mapping, 'paired');
  assert.equal(edit.added_lines, 1);
  assert.equal(edit.deleted_lines, 1);
  assert.equal(edit.touched_by_nested, false);
  assert.deepEqual(rowOf(result, M_PATH), {
    path: M_PATH, role: 'source', status: 'covered', added_lines: 1, deleted_lines: 1, non_function_lines: 0,
  });
});

// 2. 함수 내부 추가·삭제 수는 실제 +/- 줄 수다.
test('5~6번 줄을 지우고 세 줄을 넣음 → edit의 added_lines는 3, deleted_lines는 2다', () => {
  const lines = [...M_LINES.slice(0, 4), '  const a = 10;', '  const b = 20;', '  const c = 30;', ...M_LINES.slice(6)];
  const { result } = scenario({ [M_PATH]: M_TEXT }, withM(lines));
  const [edit] = namedCandidates(result, 'edit');
  assert.equal(edit.added_lines, 3);
  assert.equal(edit.deleted_lines, 2);
});

// 3a. 삽입만 있는 변경.
test('6번 줄 뒤에 한 줄 삽입 → edit가 paired이고 added_lines 1, deleted_lines 0이다', () => {
  const lines = [...M_LINES.slice(0, 6), '  const c = 3;', ...M_LINES.slice(6)];
  const { result } = scenario({ [M_PATH]: M_TEXT }, withM(lines));
  const [edit] = namedCandidates(result, 'edit');
  assert.equal(edit.mapping, 'paired');
  assert.equal(edit.added_lines, 1);
  assert.equal(edit.deleted_lines, 0);
});

// 3b. 삭제만 있는 변경. 시작 줄의 정의가 남으므로 paired다.
test('10번 줄 return만 삭제 → drop이 paired이고 deleted_lines 1, snapshot_ref가 있다', () => {
  const lines = M_LINES.filter((_, i) => i !== 9);
  const { result } = scenario({ [M_PATH]: M_TEXT }, withM(lines));
  const [drop] = namedCandidates(result, 'drop');
  assert.equal(drop.mapping, 'paired');
  assert.equal(drop.added_lines, 0);
  assert.equal(drop.deleted_lines, 1);
  assert.notEqual(drop.snapshot_ref, null);
});

// 4. 새 파일은 tracked 추가든 untracked든 같은 결과다.
const NEW_TS = 'export function made() {\n  return 1;\n}\n';

test('git add한 tracked 추가 파일 → made 하나가 added이고 added_lines 3, base_ref는 null이다', () => {
  const { result } = scenario({ [M_PATH]: M_TEXT }, (repo) => {
    writeText(repo, 'src/new.ts', NEW_TS);
    git(repo, ['add', '--', 'src/new.ts']);
  });
  const [made] = result.candidates;
  assert.deepEqual(result.candidates.map(nameOf), ['made']);
  assert.equal(made.mapping, 'added');
  assert.equal(made.base_ref, null);
  assert.equal(made.added_lines, 3);
  assert.equal(made.deleted_lines, 0);
  assert.equal(rowOf(result, 'src/new.ts').status, 'covered');
});

test('untracked 새 파일 → made 하나가 added이고 added_lines 3, base_ref는 null이다', () => {
  const { result } = scenario({ [M_PATH]: M_TEXT }, (repo) => writeText(repo, 'src/new.ts', NEW_TS));
  const [made] = result.candidates;
  assert.deepEqual(result.candidates.map(nameOf), ['made']);
  assert.equal(made.mapping, 'added');
  assert.equal(made.base_ref, null);
  assert.equal(made.added_lines, 3);
  assert.equal(rowOf(result, 'src/new.ts').status, 'covered');
});

// 5a. 함수 삭제는 deleted 후보이고 base 좌표를 가진다.
test('drop 함수 줄(9~11)을 지움 → drop 하나가 deleted이고 base 좌표와 blob이 git과 맞으며 edit는 없다', () => {
  const lines = M_LINES.slice(0, 8);
  const { repo, base, result } = scenario({ [M_PATH]: M_TEXT }, withM(lines));
  assert.deepEqual(result.candidates.map(nameOf), ['drop']);
  const [drop] = result.candidates;
  assert.equal(drop.mapping, 'deleted');
  assert.equal(drop.snapshot_ref, null);
  assert.equal(drop.deleted_lines, 3);
  assert.deepEqual(drop.base_ref, {
    path: M_PATH,
    qualified_name: 'drop',
    kind: 'exported-function',
    start_line: 9,
    end_line: 11,
    blob_sha: revParse(repo, `${base}:${M_PATH}`),
  });
});

// 5b. 파일 삭제는 그 파일의 모든 정의를 deleted로 남긴다.
test('파일 전체 삭제(g1·g2 두 함수) → g1·g2가 각각 deleted이고 deleted_lines 3, 파일 coverage는 covered다', () => {
  const gone = 'export function g1() {\n  return 1;\n}\nexport function g2() {\n  return 2;\n}\n';
  const { result } = scenario({ [M_PATH]: M_TEXT, 'src/gone.ts': gone }, (repo) => {
    fs.rmSync(path.join(repo, 'src', 'gone.ts'));
  });
  assert.deepEqual(result.candidates.map(nameOf).sort(), ['g1', 'g2']);
  for (const candidate of result.candidates) {
    assert.equal(candidate.mapping, 'deleted');
    assert.equal(candidate.deleted_lines, 3);
  }
  assert.equal(rowOf(result, 'src/gone.ts').status, 'covered');
});

// 6. 중첩 함수의 줄은 가장 안쪽 정의만 센다.
test('중첩 inner의 3번 줄만 바뀜 → inner는 1/1, outer는 0/0 touched_by_nested이고 합은 2다', () => {
  const nested = 'export function outer() {\n  function inner() {\n    return 1;\n  }\n  return inner();\n}\n';
  const { result } = scenario({ 'src/n.ts': nested }, (repo) => {
    writeText(repo, 'src/n.ts', nested.replace('    return 1;', '    return 2;'));
  });
  const [inner] = namedCandidates(result, 'outer.inner');
  const [outer] = namedCandidates(result, 'outer');
  assert.equal(inner.added_lines, 1);
  assert.equal(inner.deleted_lines, 1);
  assert.equal(inner.touched_by_nested, false);
  assert.equal(outer.added_lines, 0);
  assert.equal(outer.deleted_lines, 0);
  assert.equal(outer.touched_by_nested, true);
  const sum = result.candidates.reduce((total, c) => total + c.added_lines + c.deleted_lines, 0);
  assert.equal(sum, 2);
});

// 7a. 같은 파일 안의 이름 변경은 본문이 같으면 moved다.
test('같은 파일에서 oldName을 newName으로 바꿈 → 후보 하나가 moved이고 두 이름을 모두 담는다', () => {
  const oldFile = 'function oldName() {\n  return compute(1);\n}\n';
  const { result } = scenario({ 'src/r.ts': oldFile }, (repo) => {
    writeText(repo, 'src/r.ts', oldFile.replace('oldName', 'newName'));
  });
  assert.equal(result.candidates.length, 1);
  const [moved] = result.candidates;
  assert.equal(moved.mapping, 'moved');
  assert.equal(moved.base_ref.qualified_name, 'oldName');
  assert.equal(moved.snapshot_ref.qualified_name, 'newName');
});

// 7b. 파일을 가로지르는 이동도 본문이 같으면 moved다.
test('mv 함수를 a.ts에서 지우고 b.ts에 같은 본문으로 추가 → moved이고 base는 a.ts, snapshot은 b.ts다', () => {
  const mv = 'function mv() {\n  return compute(2);\n}\n';
  const { result } = scenario({ 'src/a.ts': mv }, (repo) => {
    writeText(repo, 'src/a.ts', '');
    writeText(repo, 'src/b.ts', mv);
  });
  assert.equal(result.candidates.length, 1);
  const [moved] = result.candidates;
  assert.equal(moved.mapping, 'moved');
  assert.equal(moved.base_ref.path, 'src/a.ts');
  assert.equal(moved.snapshot_ref.path, 'src/b.ts');
});

// 7c. 같은 본문의 삭제 둘과 추가 하나는 어느 것이 이동인지 정할 수 없어 모두 모호하다.
test('같은 본문 함수 x1·x2 삭제와 y 추가 → 세 후보 모두 ambiguous_mapping이고 하나도 빠지지 않는다', () => {
  const xs = 'function x1() {\n  return compute(3);\n}\nfunction x2() {\n  return compute(3);\n}\n';
  const y = 'function y() {\n  return compute(3);\n}\n';
  const { result } = scenario({ 'src/x.ts': xs }, (repo) => {
    writeText(repo, 'src/x.ts', '');
    writeText(repo, 'src/y.ts', y);
  });
  assert.deepEqual(result.candidates.map(nameOf).sort(), ['x1', 'x2', 'y']);
  for (const candidate of result.candidates) assert.equal(candidate.mapping, 'ambiguous_mapping');
});

// 7d. 본문이 다르면 이름만 같은 교체가 아니다. 삭제와 추가로 따로 남는다.
test('p를 본문이 다른 q로 교체 → p는 deleted, q는 added로 따로 남는다', () => {
  const { result } = scenario({ 'src/p.ts': 'function p() {\n  return 1;\n}\n' }, (repo) => {
    writeText(repo, 'src/p.ts', 'function q() {\n  return 2;\n}\n');
  });
  const byMapping = Object.fromEntries(result.candidates.map((c) => [nameOf(c), c.mapping]));
  assert.deepEqual(byMapping, { p: 'deleted', q: 'added' });
});

// 7e. 같은 파일의 같은 키 정의가 둘이면 양쪽 정의 전부가 모호하다.
test('같은 파일에 dup 두 개가 있고 둘 다 본문이 바뀜 → base 2개와 snapshot 2개가 모두 ambiguous_mapping이다', () => {
  const before = 'function dup() {\n  return 1;\n}\nfunction dup() {\n  return 2;\n}\n';
  const after2 = 'function dup() {\n  return 10;\n}\nfunction dup() {\n  return 20;\n}\n';
  const { result } = scenario({ 'src/d.ts': before }, (repo) => writeText(repo, 'src/d.ts', after2));
  assert.equal(result.candidates.length, 4);
  for (const candidate of result.candidates) assert.equal(candidate.mapping, 'ambiguous_mapping');
  assert.equal(result.candidates.filter((c) => c.base_ref !== null).length, 2);
  assert.equal(result.candidates.filter((c) => c.snapshot_ref !== null).length, 2);
});

// 8. coverage 상태는 파일 종류마다 구분된다. 같은 빈 결과로 접지 않는다.
let coverageCache = null;

/**
 * coverage 구분 테스트들이 같은 fixture를 공유하도록 한 번만 만든다. 파일 종류마다 기대 행이 다르다.
 *
 * @returns {object} extract 결과
 */
function coverageResult() {
  if (coverageCache !== null) return coverageCache;
  const files = {
    'src/broken-base.ts': 'function t() { return ( ;\n',
    'src/broken-snap.ts': 'export function ok() {\n  return 1;\n}\n',
    'assets/x.bin': Buffer.from([0, 1, 2, 3]),
    'test/x.test.js': 'export function tx() {\n  return 1;\n}\n',
    'packages/cli/dist/x.js': 'export function dx() {\n  return 1;\n}\n',
    'vendor/v.js': 'export function vv() {\n  return 1;\n}\n',
    'test/broken.test.js': 'function bt() { return ( ;\n',
    'docs/old.md': '# old\n',
    'test/old.test.js': 'export function old() {\n  return 1;\n}\n',
    'src/c.ts': 'export const LIMIT = 1;\n',
    'src/m.ts': M_TEXT,
  };
  const links = { 'link.ts': 'src/m.ts', 'link3.ts': 'src/m.ts' };
  const { result } = scenario(files, (repo) => {
    writeText(repo, 'src/broken-base.ts', 'function t() {\n  return 1;\n}\n');
    writeText(repo, 'src/broken-snap.ts', 'function t() { return ( ;\n');
    writeText(repo, 'docs/readme.md', 'hello\n');
    writeText(repo, 'src/types.d.ts', 'export declare const z: number;\n');
    writeText(repo, 'test/fixtures/a.d.ts', 'export declare const w: number;\n');
    writeText(repo, 'assets/x.bin', Buffer.from([0, 1, 2, 4]));
    fs.unlinkSync(path.join(repo, 'link.ts'));
    fs.symlinkSync('src/c.ts', path.join(repo, 'link.ts'));
    writeText(repo, 'test/x.test.js', 'export function tx() {\n  return 2;\n}\n');
    writeText(repo, 'packages/cli/dist/x.js', 'export function dx() {\n  return 2;\n}\n');
    writeText(repo, 'vendor/v.js', 'export function vv() {\n  return 2;\n}\n');
    writeText(repo, 'test/broken.test.js', 'function bt() { return ( ;;\n');
    fs.rmSync(path.join(repo, 'docs', 'old.md'));
    fs.rmSync(path.join(repo, 'test', 'old.test.js'));
    fs.unlinkSync(path.join(repo, 'link3.ts'));
    writeText(repo, 'link3.ts', 'export function l3() {\n  return 1;\n}\n');
    writeText(repo, 'src/c.ts', 'export const LIMIT = 2;\n');
  }, links);
  coverageCache = result;
  return result;
}

test('구문이 깨진 base 파일 → parse_failed이고 reason은 base, role은 source이며 후보가 없다', () => {
  const row = rowOf(coverageResult(), 'src/broken-base.ts');
  assert.equal(row.status, 'parse_failed');
  assert.equal(row.reason, 'base');
  assert.equal(row.role, 'source');
  assert.equal(row.non_function_lines, row.added_lines + row.deleted_lines);
  const fromBroken = coverageResult().candidates
    .filter((c) => (c.base_ref ?? c.snapshot_ref).path === 'src/broken-base.ts');
  assert.equal(fromBroken.length, 0);
});

test('구문이 깨진 snapshot 파일 → parse_failed이고 reason은 snapshot이다', () => {
  const row = rowOf(coverageResult(), 'src/broken-snap.ts');
  assert.equal(row.status, 'parse_failed');
  assert.equal(row.reason, 'snapshot');
  assert.equal(row.role, 'source');
  assert.equal(row.non_function_lines, row.added_lines + row.deleted_lines);
});

test('docs/readme.md → unsupported이고 reason은 extension, role은 null이다', () => {
  const row = rowOf(coverageResult(), 'docs/readme.md');
  assert.equal(row.status, 'unsupported');
  assert.equal(row.reason, 'extension');
  assert.equal(row.role, null);
});

test('src/types.d.ts → unsupported이고 reason은 declaration-file, role은 null이다', () => {
  const row = rowOf(coverageResult(), 'src/types.d.ts');
  assert.equal(row.status, 'unsupported');
  assert.equal(row.reason, 'declaration-file');
  assert.equal(row.role, null);
});

test('바이너리 바이트 변경 → excluded이고 reason은 binary, role은 null이다', () => {
  const row = rowOf(coverageResult(), 'assets/x.bin');
  assert.equal(row.status, 'excluded');
  assert.equal(row.reason, 'binary');
  assert.equal(row.role, null);
});

test('symlink 대상 변경 → excluded이고 reason은 symlink, role은 null이다', () => {
  const row = rowOf(coverageResult(), 'link.ts');
  assert.equal(row.status, 'excluded');
  assert.equal(row.reason, 'symlink');
  assert.equal(row.role, null);
});

test('test/x.test.js → excluded이고 reason은 role:test, role은 test다', () => {
  const row = rowOf(coverageResult(), 'test/x.test.js');
  assert.equal(row.status, 'excluded');
  assert.equal(row.reason, 'role:test');
  assert.equal(row.role, 'test');
});

test('packages/cli/dist/x.js → excluded이고 reason은 role:generated, role은 generated다', () => {
  const row = rowOf(coverageResult(), 'packages/cli/dist/x.js');
  assert.equal(row.status, 'excluded');
  assert.equal(row.reason, 'role:generated');
  assert.equal(row.role, 'generated');
});

test('vendor/v.js → excluded이고 reason은 role:vendor, role은 vendor다', () => {
  const row = rowOf(coverageResult(), 'vendor/v.js');
  assert.equal(row.status, 'excluded');
  assert.equal(row.reason, 'role:vendor');
  assert.equal(row.role, 'vendor');
});

test('구문이 깨진 test 파일 → parse_failed가 아니라 excluded이고 reason은 role:test다', () => {
  const row = rowOf(coverageResult(), 'test/broken.test.js');
  assert.equal(row.status, 'excluded');
  assert.equal(row.reason, 'role:test');
  assert.equal(row.role, 'test');
});

test('test/fixtures/a.d.ts → excluded가 아니라 unsupported이고 reason은 declaration-file, role은 null이다', () => {
  const row = rowOf(coverageResult(), 'test/fixtures/a.d.ts');
  assert.equal(row.status, 'unsupported');
  assert.equal(row.reason, 'declaration-file');
  assert.equal(row.role, null);
});

test('삭제된 docs/old.md → unsupported이고 reason은 extension, role은 null이다', () => {
  const row = rowOf(coverageResult(), 'docs/old.md');
  assert.equal(row.status, 'unsupported');
  assert.equal(row.reason, 'extension');
  assert.equal(row.role, null);
});

test('삭제된 test/old.test.js → excluded이고 reason은 role:test, role은 test다(base 쪽 결과로 판정)', () => {
  const row = rowOf(coverageResult(), 'test/old.test.js');
  assert.equal(row.status, 'excluded');
  assert.equal(row.reason, 'role:test');
  assert.equal(row.role, 'test');
});

test('base가 symlink였던 경로를 일반 파일로 바꿈 → excluded이고 reason은 symlink다', () => {
  const row = rowOf(coverageResult(), 'link3.ts');
  assert.equal(row.status, 'excluded');
  assert.equal(row.reason, 'symlink');
  assert.equal(row.role, null);
});

test('LIMIT 상수만 바뀜 → covered이고 후보가 없으며 non_function_lines는 2다', () => {
  const result = coverageResult();
  const row = rowOf(result, 'src/c.ts');
  assert.equal(row.status, 'covered');
  assert.equal(row.non_function_lines, 2);
  assert.equal(result.candidates.filter((c) => (c.base_ref ?? c.snapshot_ref).path === 'src/c.ts').length, 0);
});

// 9. identity: blob_sha와 줄 좌표가 git과 fixture에서 온다.
test('edit 후보의 blob과 줄 좌표 → snapshot 쪽은 hash-object, base 쪽은 rev-parse와 같고 두 쪽 모두 4~8이다', () => {
  const { repo, base, result } = scenario({ [M_PATH]: M_TEXT }, withM(replaceAt(M_LINES, 5, '  const b = 3;')));
  const [edit] = result.candidates;
  assert.equal(edit.snapshot_ref.blob_sha, git(repo, ['hash-object', M_PATH]).trim());
  assert.equal(edit.base_ref.blob_sha, revParse(repo, `${base}:${M_PATH}`));
  assert.equal(edit.base_ref.start_line, 4);
  assert.equal(edit.base_ref.end_line, 8);
  assert.equal(edit.snapshot_ref.start_line, 4);
  assert.equal(edit.snapshot_ref.end_line, 8);
});

// 10. 비ASCII 경로도 인용된 diff 헤더에서 같은 후보가 된다.
test('한글 파일 이름의 함수를 바꿈 → 인용된 diff 헤더에서도 paired 후보로 잡힌다', () => {
  const hangul = 'export function hangul() {\n  return 1;\n}\n';
  const { result } = scenario({ 'src/한글 파일.ts': hangul }, (repo) => {
    writeText(repo, 'src/한글 파일.ts', hangul.replace('return 1;', 'return 2;'));
  });
  const [only] = result.candidates;
  assert.equal(only.mapping, 'paired');
  assert.equal(only.base_ref.path, 'src/한글 파일.ts');
  assert.equal(only.base_ref.qualified_name, 'hangul');
});

// 11. 거부와 결정성: 잘못된 historyRef, 틀린 hunk 줄 수, 같은 입력의 같은 결과, 저장소 상태 불변.
test('historyRef가 base와 다른 커밋·HEAD·형식 위반 → throw하고 메시지가 비어 있지 않다', () => {
  const { repo, base } = baseRepo({ [M_PATH]: M_TEXT });
  writeText(repo, 'other.txt', 'x\n');
  git(repo, ['add', '-A']);
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'second']);
  const second = revParse(repo, 'HEAD');
  writeText(repo, M_PATH, textOf(replaceAt(M_LINES, 5, '  const b = 3;')));
  const snapshot = snapshotOf(repo, base);
  for (const historyRef of [second, 'HEAD', 'main', 'ABCDEF1']) {
    assert.throws(() => extractChangedFunctions({ repoRoot: repo, snapshot, historyRef }), isNonEmptyError);
  }
});

test('diff hunk 헤더의 줄 수를 틀리게 바꿈 → diff를 담은 메시지로 throw한다', () => {
  const { repo, base, snapshot } = scenario({ [M_PATH]: M_TEXT }, withM(replaceAt(M_LINES, 5, '  const b = 3;')));
  const broken = JSON.parse(JSON.stringify(snapshot));
  broken.diff = broken.diff.replace(/^@@ -(\d+),(\d+) /m, (_, start, count) => `@@ -${start},${Number(count) + 1} `);
  assert.throws(
    () => extract(repo, base, broken),
    (error) => error instanceof Error && /diff/.test(error.message),
  );
});

test('같은 입력을 두 번 호출 → canonicalJson 결과가 같다', () => {
  const { repo, base, snapshot } = scenario({ [M_PATH]: M_TEXT }, withM(replaceAt(M_LINES, 5, '  const b = 3;')));
  assert.equal(canonicalJson(extract(repo, base, snapshot)), canonicalJson(extract(repo, base, snapshot)));
});

test('추출 전후 HEAD·git status·.git/index 바이트 → 모두 같다', () => {
  const { repo, base, snapshot } = scenario({ [M_PATH]: M_TEXT }, withM(replaceAt(M_LINES, 5, '  const b = 3;')));
  const indexPath = path.join(repo, '.git', 'index');
  const before = {
    head: revParse(repo, 'HEAD'),
    status: git(repo, ['status', '--porcelain']),
    index: fs.readFileSync(indexPath),
  };
  extract(repo, base, snapshot);
  assert.equal(revParse(repo, 'HEAD'), before.head);
  assert.equal(git(repo, ['status', '--porcelain']), before.status);
  assert.ok(fs.readFileSync(indexPath).equals(before.index));
});

// 12. 변경 줄 0, untracked 빈 파일, untracked 추가, diff 없는 base 동일 파일을 구분한다.
test('src/m.ts에 chmod +x만 함 → m.ts 행이 covered이고 줄 수가 모두 0이며 후보가 없다', () => {
  const { result } = scenario({ [M_PATH]: M_TEXT }, (repo) => fs.chmodSync(path.join(repo, M_PATH), 0o755));
  assert.deepEqual(rowOf(result, M_PATH), {
    path: M_PATH, role: 'source', status: 'covered', added_lines: 0, deleted_lines: 0, non_function_lines: 0,
  });
  assert.deepEqual(result.candidates, []);
});

test('빈 untracked 파일 → covered이고 줄 수가 모두 0이며 후보가 없다', () => {
  const { result } = scenario({ [M_PATH]: M_TEXT }, (repo) => writeText(repo, 'src/empty.ts', ''));
  assert.deepEqual(rowOf(result, 'src/empty.ts'), {
    path: 'src/empty.ts', role: 'source', status: 'covered', added_lines: 0, deleted_lines: 0, non_function_lines: 0,
  });
  assert.deepEqual(result.candidates, []);
});

test('untracked 새 파일 u.ts → u 하나가 added이고 added_lines 3이다(diff 섹션 없음)', () => {
  const { result } = scenario({ [M_PATH]: M_TEXT }, (repo) => {
    writeText(repo, 'src/u.ts', 'export function u() {\n  return 1;\n}\n');
  });
  const [u] = result.candidates;
  assert.deepEqual(result.candidates.map(nameOf), ['u']);
  assert.equal(u.mapping, 'added');
  assert.equal(u.added_lines, 3);
});

test('diff 섹션만 지우고 files 내용을 base와 같게 둠 → 그 파일은 files 결과에 없다', () => {
  const { repo, base, snapshot } = scenario({ [M_PATH]: M_TEXT }, withM(replaceAt(M_LINES, 5, '  const b = 3;')));
  const copy = JSON.parse(JSON.stringify(snapshot));
  copy.diff = '';
  copy.files = copy.files.map((file) => (file.path === M_PATH ? { ...file, content: M_TEXT } : file));
  const result = extract(repo, base, copy);
  assert.equal(result.files.some((row) => row.path === M_PATH), false);
});

test('diff 섹션만 지우고 files 내용을 base와 다르게 둠 → throw한다', () => {
  const { repo, base, snapshot } = scenario({ [M_PATH]: M_TEXT }, withM(replaceAt(M_LINES, 5, '  const b = 3;')));
  const copy = JSON.parse(JSON.stringify(snapshot));
  copy.diff = '';
  copy.files = copy.files.map((file) => (file.path === M_PATH ? { ...file, content: `${M_TEXT}x\n` } : file));
  assert.throws(() => extract(repo, base, copy), isNonEmptyError);
});

// 12b. symlink와 일반 파일 사이의 형식 변경은 deleted·new 두 섹션의 합으로 한 파일이다.
test('base symlink를 지우고 같은 경로에 일반 파일을 만듦 → 행 하나가 excluded symlink이고 줄 수는 두 섹션의 합이다', () => {
  const { result } = scenario({ [M_PATH]: M_TEXT }, (repo) => {
    fs.unlinkSync(path.join(repo, 'typelink.ts'));
    writeText(repo, 'typelink.ts', 'export function z() {\n  return 1;\n}\n');
  }, { 'typelink.ts': 'src/m.ts' });
  const rows = result.files.filter((row) => row.path === 'typelink.ts');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    path: 'typelink.ts', role: null, status: 'excluded', reason: 'symlink',
    added_lines: 3, deleted_lines: 1, non_function_lines: 4,
  });
  assert.equal(result.candidates.some((c) => nameOf(c) === 'z'), false);
});

test('base 일반 파일을 같은 경로의 symlink로 바꿈 → 행 하나가 excluded symlink이고 줄 수는 두 섹션의 합이다', () => {
  const body = 'export function y() {\n  return 1;\n}\n';
  const { result } = scenario({ [M_PATH]: M_TEXT, 'typelink2.ts': body }, (repo) => {
    fs.unlinkSync(path.join(repo, 'typelink2.ts'));
    fs.symlinkSync('src/m.ts', path.join(repo, 'typelink2.ts'));
  });
  const rows = result.files.filter((row) => row.path === 'typelink2.ts');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'excluded');
  assert.equal(rows[0].reason, 'symlink');
  assert.equal(rows[0].deleted_lines, 3);
  assert.equal(rows[0].added_lines, 1);
});

test('typechange 두 섹션의 순서를 바꾸거나 new 섹션을 복제함 → throw한다', () => {
  const { repo, base, snapshot } = scenario({ [M_PATH]: M_TEXT }, (repo2) => {
    fs.unlinkSync(path.join(repo2, 'typelink.ts'));
    writeText(repo2, 'typelink.ts', 'export function z() {\n  return 1;\n}\n');
  }, { 'typelink.ts': 'src/m.ts' });
  // diff를 `diff --git` 경계로 나눠 typelink.ts의 두 섹션을 찾는다.
  const parts = snapshot.diff.split(/(?=^diff --git )/m).filter((part) => part !== '');
  const linkParts = parts.filter((part) => part.startsWith('diff --git a/typelink.ts '));
  assert.equal(linkParts.length, 2, 'typechange must produce two sections for the same path');
  const others = parts.filter((part) => !part.startsWith('diff --git a/typelink.ts '));
  const swapped = JSON.parse(JSON.stringify(snapshot));
  swapped.diff = [...others, linkParts[1], linkParts[0]].join('');
  assert.throws(() => extract(repo, base, swapped), isNonEmptyError);
  const duplicated = JSON.parse(JSON.stringify(snapshot));
  duplicated.diff = [...parts, linkParts[1]].join('');
  assert.throws(() => extract(repo, base, duplicated), isNonEmptyError);
});

// 13. 일관성 위반은 throw하고, 같은 원본 snapshot으로는 여전히 성공한다.
test('snapshot 일관성 위반 목록 → 각각 throw하고 원본 snapshot 호출은 성공한다', () => {
  const gone = 'export function g() {\n  return 1;\n}\n';
  const { repo, base, snapshot } = scenario({ [M_PATH]: M_TEXT, 'src/gone.ts': gone }, (repo2) => {
    writeText(repo2, M_PATH, textOf(replaceAt(M_LINES, 5, '  const b = 3;')));
    fs.rmSync(path.join(repo2, 'src', 'gone.ts'));
  });
  const clone = () => JSON.parse(JSON.stringify(snapshot));
  const cases = [
    ['같은 path가 files에 두 번', (s) => { s.files.push({ ...s.files[0] }); }],
    ['절대 경로', (s) => { s.files.push({ path: '/abs.ts', kind: 'text', content: '' }); }],
    ['상위 경로 ..', (s) => { s.files.push({ path: '../x.ts', kind: 'text', content: '' }); }],
    ['빈 세그먼트', (s) => { s.files.push({ path: 'src//a.ts', kind: 'text', content: '' }); }],
    ['역슬래시', (s) => { s.files.push({ path: 'src\\a.ts', kind: 'text', content: '' }); }],
    ['점 세그먼트', (s) => { s.files.push({ path: './a.ts', kind: 'text', content: '' }); }],
    ['deleted인데 diff에 + 줄', (s) => {
      s.files = s.files.map((f) => (f.path === M_PATH ? { ...f, kind: 'deleted', content: '' } : f));
    }],
    ['kind deleted 항목의 deleted 섹션에 + 줄 → 본문이 남은 모순이라 throw', (s) => {
      // src/gone.ts는 deleted 섹션 하나다. 헤더를 +1,1로 바꾸고 + 줄 하나를 더하면 줄 수는 맞지만 본문이 남는다.
      // 기존 deleted 케이스와 달리 kind와 섹션 종류가 모두 deleted라서, 거절 이유는 + 줄 하나뿐이다.
      const parts = s.diff.split(/(?=^diff --git )/m);
      s.diff = parts.map((part) => (part.startsWith('diff --git a/src/gone.ts ')
        ? `${part.replace(/^@@ -(\d+),(\d+) \+0,0 @@/m, '@@ -$1,$2 +1,1 @@')}+x\n`
        : part)).join('');
    }],
    ['text인데 diff가 deleted file mode', (s) => {
      s.files = s.files.map((f) => (f.path === 'src/gone.ts' ? { ...f, kind: 'text', content: '' } : f));
    }],
    ['diff가 files에 없는 경로를 담음', (s) => {
      s.files = s.files.filter((f) => f.path !== M_PATH);
    }],
  ];
  for (const [label, mutate] of cases) {
    const copy = clone();
    mutate(copy);
    assert.throws(() => extract(repo, base, copy), isNonEmptyError, label);
  }
  assert.equal(extract(repo, base, snapshot).candidates.length > 0, true);
});

// ── collectDiffIntent: 근거 연결, 순위, 바이트 예산, manifest ─────────────────────────────
// 아래 fixture는 test/intent-revision.test.js의 trailer·Explain 형식을 따르되 이 파일 안에만 둔다.
// 기대값은 fixture가 커밋한 SHA·줄 번호와 명세의 규칙으로만 정한다. 조회 결과에서 기대값을 만들지 않는다.
// 조회 주입은 실제 resolveIntentAtRevision에 위임하는 spy나, 명시된 실패·부재 응답을 돌려주는 fake만 쓴다.

const TASK_1 = 'EPIC-001/BP-001/TASK-001';
const TASK_2 = 'EPIC-001/BP-001/TASK-002';
const EXPLAIN_REL = '.bouncer/context/epics/001-demo/blueprints/001-demo/explain.md';
const TASK_DOC_1 = '.bouncer/context/epics/001-demo/blueprints/001-demo/tasks/001/tasks.md';
// 명세의 슬롯 상한(12 KiB)과 개수 상한(8)을 테스트 쪽에서 독립적으로 적는다. 구현 상수를 가져오지 않는다.
const SLOT_LIMIT_BYTES = 12288;
const ENTRY_LIMIT = 8;
// 본문 3 KiB 상한을 시험하려고 UTF-8 3바이트 글자 700개(2100바이트)를 쓴다.
const KOREAN_BODY = '가'.repeat(700);

/**
 * `return` 한 줄짜리 export 함수 하나의 파일 본문을 만든다. 줄 번호는 1 export, 2 return, 3 닫는 괄호다.
 *
 * @param {string} name - 함수 이름
 * @param {number} value - return 값
 * @returns {string} 파일 본문
 */
function fnSource(name, value) {
  return `export function ${name}() {\n  return ${value};\n}\n`;
}

/**
 * Bouncer-Task·Bouncer-Intent trailer가 붙은 커밋 메시지를 만든다. 두 trailer가 있어야 Explain과 이어진다.
 *
 * @param {string} subject - 제목 한 줄
 * @param {string} task - trailer의 stable Task ID
 * @returns {string} 커밋 메시지
 */
function trailerMessage(subject, task) {
  return `${subject}\n\nBouncer-Task: ${task}\nBouncer-Intent: EPIC-001/BP-001\n`;
}

/**
 * 작업 트리 전체를 커밋하고 새 커밋의 SHA를 돌려준다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} message - 커밋 메시지
 * @returns {string} 새 커밋의 40자 SHA
 */
function commitAll(repo, message) {
  git(repo, ['add', '-A']);
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message]);
  return revParse(repo, 'HEAD');
}

/**
 * task_commits 한 행을 YAML 조각으로 적는다. sha는 8자 접두사이며, 이 행이 커밋과 Task를 잇는 연결 증거다.
 *
 * @param {string} task - stable Task ID
 * @param {string} sha8 - 8자 접두사
 * @param {string} anchor - intent_anchor (`task-NNN`)
 * @returns {string} YAML 조각
 */
function taskRow(task, sha8, anchor) {
  return [
    `    - task: ${JSON.stringify(task)}`,
    `      sha: ${JSON.stringify(sha8)}`,
    `      intent_anchor: ${JSON.stringify(anchor)}`,
  ].join('\n');
}

/**
 * 001-demo Explain 원문을 만든다. 세 절 본문을 받아 어느 시점의 본문이 조회되는지 테스트가 구분하게 한다.
 *
 * @param {string[]} rows - taskRow 결과
 * @param {{ background: string, intuition: string, code: string }} bodies - 세 절의 본문
 * @returns {string} explain.md 본문
 */
function explainText(rows, bodies) {
  return [
    '---',
    'type: bouncer.explain',
    'title: diff intent fixture',
    'description: fixture',
    `resource: ${EXPLAIN_REL}`,
    'tags: [bouncer]',
    "timestamp: '2026-09-16T00:00:00+09:00'",
    'bouncer:',
    '  id: EXPLAIN-001',
    "  epic_id: '001'",
    "  blueprint_id: '001'",
    '  status: published',
    '  task_commits:',
    ...rows,
    '---',
    '# Explain',
    '',
    '## Background',
    '',
    bodies.background,
    '',
    '## Intuition',
    '',
    bodies.intuition,
    '',
    '## Code',
    '',
    bodies.code,
    '',
  ].join('\n');
}

/**
 * 연결·미연결 fixture다. P1(trailer TASK-001)이 linked를, G(trailer 없음)가 free를 만들고, B가 Explain을 커밋한다.
 * H는 linked 본문과 Explain Background를 미래 내용으로 바꾼다. 작업 트리는 linked와 free를 한 번 더 바꾼다.
 * snapshot의 기준은 B다. 따라서 H와 작업 트리의 내용은 B 시점 근거에 섞이면 안 된다.
 *
 * @returns {{ repo: string, base: string, p1: string, snapshot: object }} 저장소, 기준 SHA, P1, 동결 snapshot
 */
function fixtureF() {
  const repo = tmpDir('bouncer-diff-intent-f-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/f.ts', fnSource('linked', 1));
  writeText(repo, TASK_DOC_1, '# Tasks\n');
  const p1 = commitAll(repo, trailerMessage('P1', TASK_1));
  writeText(repo, 'src/free.ts', fnSource('free', 1));
  commitAll(repo, 'G');
  writeText(repo, EXPLAIN_REL, explainText([taskRow(TASK_1, p1.slice(0, 8), 'task-001')], {
    background: 'back-text', intuition: 'intu-text', code: 'code-text',
  }));
  const base = commitAll(repo, 'B');
  writeText(repo, 'src/f.ts', fnSource('linked', 5));
  writeText(repo, EXPLAIN_REL, explainText([taskRow(TASK_1, p1.slice(0, 8), 'task-001')], {
    background: 'future-text', intuition: 'intu-text', code: 'code-text',
  }));
  commitAll(repo, trailerMessage('H', TASK_2));
  writeText(repo, 'src/f.ts', fnSource('linked', 6));
  writeText(repo, 'src/free.ts', fnSource('free', 2));
  return { repo, base, p1, snapshot: snapshotOf(repo, base) };
}

/**
 * 순위 fixture의 기준 저장소다. a.ts에 alpha·beta, b.ts에 zeta, c.ts에 줄 수가 많은 big을 둔다.
 * 함수마다 줄 수가 다르게 바뀌도록 mutateRanked가 작업 트리를 바꾼다.
 *
 * @returns {{ repo: string, base: string }} 저장소와 기준 SHA
 */
function rankedBase() {
  const repo = tmpDir('bouncer-diff-intent-rank-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/a.ts', fnSource('alpha', 1) + fnSource('beta', 1));
  writeText(repo, 'src/b.ts', fnSource('zeta', 1));
  writeText(repo, 'src/c.ts', 'export function big() {\n  const a = 1;\n  const b = 2;\n  return a + b;\n}\n');
  return { repo, base: commitAll(repo, 'base') };
}

/**
 * alpha·beta·zeta의 본문 한 줄씩을 바꾼다. 추가 1·삭제 1이라 줄 수는 모두 2다.
 *
 * @param {string} repo - 저장소 루트
 * @returns {void}
 */
function mutateThree(repo) {
  writeText(repo, 'src/a.ts', fnSource('alpha', 2) + fnSource('beta', 2));
  writeText(repo, 'src/b.ts', fnSource('zeta', 2));
}

/**
 * big의 본문 두 줄을 바꾼다. 추가 2·삭제 2라 줄 수는 4다. mutateThree 뒤에 불러 네 후보를 만든다.
 *
 * @param {string} repo - 저장소 루트
 * @returns {void}
 */
function mutateBig(repo) {
  writeText(repo, 'src/c.ts', 'export function big() {\n  const a = 3;\n  const b = 4;\n  return a + b;\n}\n');
}

/**
 * manifest 후보의 대표 이름 → rank 객체를 돌려준다. 이름이 겹치지 않는 fixture에서만 쓴다.
 *
 * @param {object} result - collectDiffIntent 결과
 * @returns {Record<string, number | null>} qualified_name → rank
 */
function rankByName(result) {
  return Object.fromEntries(result.manifest.candidates.map((item) => [nameOf(item), item.rank]));
}

/**
 * 50개 파일 fixture의 경로다. 모두 150자를 넘어 긴 metadata가 슬롯 크기를 키우는 상황을 만든다.
 * 파일 번호를 두 자리로 맞춰 path 오름차순이 번호 오름차순과 같게 한다.
 *
 * @param {number} i - 0부터 센 파일 번호
 * @returns {string} 저장소 상대 경로
 */
function longPath(i) {
  return `src/${'d'.repeat(140)}/f${String(i).padStart(2, '0')}.ts`;
}

/**
 * 긴 경로 fixture의 함수 이름이다. 파일 번호와 같은 두 자리 숫자를 쓴다.
 *
 * @param {number} i - 0부터 센 파일 번호
 * @returns {string} 함수 이름
 */
function longName(i) {
  return `fn${String(i).padStart(2, '0')}`;
}

/**
 * 50개 파일 각각의 함수 본문을 한 줄씩 바꾼 저장소를 만든다. 모든 후보의 줄 수가 같아 순위는 path 순서다.
 *
 * @returns {{ repo: string, base: string, snapshot: object }} 저장소, 기준 SHA, 동결 snapshot
 */
function longRepo() {
  const repo = tmpDir('bouncer-diff-intent-long-');
  git(repo, ['init', '-q', '-b', 'main']);
  for (let i = 0; i < 50; i += 1) writeText(repo, longPath(i), fnSource(longName(i), 1));
  const base = commitAll(repo, 'base');
  for (let i = 0; i < 50; i += 1) writeText(repo, longPath(i), fnSource(longName(i), 2));
  return { repo, base, snapshot: snapshotOf(repo, base) };
}

// 함수 fNN은 본문 NN줄을 가진다. 번호 1..12를 두 자리로 적어 이름 순서와 번호 순서가 같게 한다.
const BIG_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * big 파일 본문을 만든다. 함수 fNN은 본문 NN줄을 가지며 각 줄은 tag와 번호로 구별되는 대입문이다.
 *
 * @param {string} tag - 본문 줄의 접두사(old 또는 new)
 * @returns {string} 파일 본문
 */
function bigSource(tag) {
  const lines = [];
  for (const n of BIG_NUMBERS) {
    lines.push(`export function f${String(n).padStart(2, '0')}() {`);
    for (let k = 0; k < n; k += 1) lines.push(`  const ${tag}${n}_${k} = ${k};`);
    lines.push('}');
  }
  return textOf(lines);
}

/**
 * 한글 절이 큰 fixture다. P1이 big.ts 열두 함수를 만들고 trailer로 연결하며, B의 Explain은 세 절이 각 2100바이트다.
 * 작업 트리는 열두 함수의 본문 줄을 모두 바꾼다. 함수 fNN의 변경 줄 수는 2NN이다.
 *
 * @returns {{ repo: string, base: string, snapshot: object }} 저장소, 기준 SHA, 동결 snapshot
 */
function bigRepo() {
  const repo = tmpDir('bouncer-diff-intent-bytes-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/big.ts', bigSource('old'));
  writeText(repo, TASK_DOC_1, '# Tasks\n');
  const p1 = commitAll(repo, trailerMessage('P1', TASK_1));
  writeText(repo, EXPLAIN_REL, explainText([taskRow(TASK_1, p1.slice(0, 8), 'task-001')], {
    background: KOREAN_BODY, intuition: KOREAN_BODY, code: KOREAN_BODY,
  }));
  const base = commitAll(repo, 'B');
  writeText(repo, 'src/big.ts', bigSource('new'));
  return { repo, base, snapshot: snapshotOf(repo, base) };
}

/**
 * 커버리지 실패 fixture다. ok.ts만 후보를 만들고, docs 파일은 unsupported, base가 깨진 파일은 parse_failed,
 * test 파일은 excluded가 된다. 네 파일 모두 한 snapshot에 든다.
 *
 * @returns {{ repo: string, base: string, snapshot: object }} 저장소, 기준 SHA, 동결 snapshot
 */
function coverageRepo() {
  const repo = tmpDir('bouncer-diff-intent-cover-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/ok.ts', fnSource('okFn', 1));
  writeText(repo, 'docs/readme.md', 'hello\n');
  writeText(repo, 'src/broken-base.ts', 'function t() { return ( ;\n');
  writeText(repo, 'test/x.test.js', fnSource('tx', 1));
  const base = commitAll(repo, 'base');
  writeText(repo, 'src/ok.ts', fnSource('okFn', 2));
  writeText(repo, 'docs/readme.md', 'hello\nworld\n');
  writeText(repo, 'src/broken-base.ts', 'function t() {\n  return 1;\n}\n');
  writeText(repo, 'test/x.test.js', fnSource('tx', 2));
  return { repo, base, snapshot: snapshotOf(repo, base) };
}

/**
 * 슬롯 항목 하나를 대표 이름으로 찾는다. 없으면 테스트가 실패한다.
 *
 * @param {object} slot - 결과의 slot
 * @param {string} name - qualified_name
 * @returns {object} 슬롯 항목
 */
function entryNamed(slot, name) {
  const entry = slot.entries.find((item) => nameOf(item) === name);
  assert.ok(entry, `no slot entry named ${name}`);
  return entry;
}

/**
 * collectDiffIntent를 fixture의 기준 SHA로 부르는 얇은 래퍼다.
 *
 * @param {{ repo: string, base: string, snapshot: object }} fx - fixture
 * @param {object} [deps] - 조회 주입
 * @returns {object} collectDiffIntent 결과
 */
function diffIntent(fx, deps) {
  return collectDiffIntent({ repoRoot: fx.repo, snapshot: fx.snapshot, historyRef: fx.base, deps });
}

test('연결된 linked와 미연결 free → linked는 P1 근거 한 건을 절 세 개로, free는 빈 후보로 남고 미래 근거는 없다', () => {
  const fx = fixtureF();
  const result = diffIntent(fx);
  const linked = entryNamed(result.slot, 'linked');
  assert.equal(linked.evidence, 'linked');
  assert.equal(linked.candidates.length, 1);
  const [cand] = linked.candidates;
  assert.equal(cand.commit, fx.p1);
  assert.equal(cand.task, TASK_1);
  assert.deepEqual(cand.sections.map((section) => section.name), ['Background', 'Intuition', 'Code']);
  assert.deepEqual(cand.sections.map((section) => section.body), ['back-text', 'intu-text', 'code-text']);
  assert.equal(cand.sections_omitted, 0);
  const slotText = JSON.stringify(result.slot);
  assert.equal(slotText.includes('future-text'), false);
  assert.equal(slotText.includes('TASK-002'), false);
  const free = entryNamed(result.slot, 'free');
  assert.equal(free.evidence, 'unlinked');
  assert.equal(free.explain_docs, 1);
  assert.deepEqual(free.candidates, []);
});

test('기준 SHA에 없는 새 함수 → manifest에 added_no_history와 manifest_only로 남고 슬롯 항목에는 없다', () => {
  const fx = fixtureF();
  writeText(fx.repo, 'src/new.ts', fnSource('made', 1));
  const result = collectDiffIntent({
    repoRoot: fx.repo,
    snapshot: snapshotOf(fx.repo, fx.base),
    historyRef: fx.base,
  });
  const row = result.manifest.candidates.find((item) => item.mapping === 'added');
  assert.ok(row, 'an added candidate must be in the manifest');
  assert.equal(nameOf(row), 'made');
  assert.equal(row.rank, null);
  assert.equal(row.evidence, 'added_no_history');
  assert.equal(row.delivery, 'manifest_only');
  assert.equal(result.slot.entries.some((entry) => nameOf(entry) === 'made'), false);
  assert.equal(result.slot.summary.added_no_history, 1);
  assert.equal(result.slot.bundle_dedupe, 'not_applied');
  // 슬롯은 manifest를 담지 않고 manifest_digest로만 가리킨다.
  assert.equal(Object.hasOwn(result.slot, 'manifest'), false);
  assert.equal(result.slot.manifest_digest, sha256Canonical(result.manifest));
});

test('줄 수가 같은 alpha·beta·zeta 뒤 줄 수가 큰 big을 더함 → 줄 수 내림차순, 같으면 path와 이름 오름차순 rank다', () => {
  const { repo, base } = rankedBase();
  mutateThree(repo);
  const three = collectDiffIntent({ repoRoot: repo, snapshot: snapshotOf(repo, base), historyRef: base });
  assert.deepEqual(rankByName(three), { alpha: 1, beta: 2, zeta: 3 });
  mutateBig(repo);
  const four = collectDiffIntent({ repoRoot: repo, snapshot: snapshotOf(repo, base), historyRef: base });
  assert.deepEqual(rankByName(four), { big: 1, alpha: 2, beta: 3, zeta: 4 });
});

test('후보 50개 중 긴 경로 파일 → 조회는 상위 8번만 하고 슬롯은 12 KiB 안이며 9위 이하는 omitted_by_count다', () => {
  const fx = longRepo();
  assert.ok(longPath(0).length > 150, 'fixture paths must exceed 150 characters');
  const calls = [];
  const lookup = (input) => {
    calls.push(input.symbolRef);
    return resolveIntentAtRevision(input);
  };
  const result = diffIntent(fx, { resolveIntentAtRevision: lookup });
  assert.equal(calls.length, ENTRY_LIMIT);
  calls.forEach((ref, i) => {
    assert.equal(ref.path, longPath(i));
    assert.equal(ref.qualified_name, longName(i));
  });
  const { summary } = result.slot;
  assert.equal(summary.candidates_total, 50);
  assert.equal(summary.queryable, 50);
  assert.equal(summary.omitted_by_count, 42);
  assert.equal(summary.selected + summary.omitted_by_bytes, ENTRY_LIMIT);
  assert.ok(Buffer.byteLength(canonicalJson(result.slot), 'utf8') <= SLOT_LIMIT_BYTES);
  const ninth = result.manifest.candidates.find((item) => item.base_ref.path === longPath(8));
  assert.equal(ninth.rank, 9);
  assert.equal(ninth.delivery, 'omitted_by_count');
  assert.equal(ninth.evidence, 'not_queried');
});

test('한글 절 2100바이트 × 열두 함수 → 슬롯은 12 KiB 안이고 줄 수 순서로 절 단위 생략을 거쳐 바이트 상한에서 멈춘다', () => {
  const fx = bigRepo();
  const { slot } = diffIntent(fx);
  const text = canonicalJson(slot);
  const bytes = Buffer.byteLength(text, 'utf8');
  assert.ok(bytes <= SLOT_LIMIT_BYTES, `slot is ${bytes} bytes`);
  assert.ok(text.length < bytes, 'the slot must carry multi-byte characters');
  const expectedOrder = [...BIG_NUMBERS].reverse().map((n) => `f${String(n).padStart(2, '0')}`);
  const names = slot.entries.map((entry) => entry.base_ref.qualified_name);
  assert.deepEqual(names, expectedOrder.slice(0, names.length));
  assert.ok(names.length < ENTRY_LIMIT, `selected ${names.length} entries`);
  assert.ok(slot.summary.omitted_by_bytes >= 1, 'the byte budget must be the binding limit');
  for (const entry of slot.entries) {
    for (const cand of entry.candidates) {
      let keptBytes = 0;
      for (const section of cand.sections) {
        // 절은 중간에서 잘리지 않고 원문 그대로 남는다.
        assert.equal(section.body, KOREAN_BODY);
        keptBytes += Buffer.byteLength(section.body, 'utf8');
      }
      assert.ok(keptBytes <= 3072, `kept ${keptBytes} body bytes for one function`);
      assert.equal(cand.sections_omitted, 3 - cand.sections.length);
    }
  }
});

test('같은 입력을 두 번 호출 → canonicalJson이 같고 digest는 digest를 뺀 객체의 해시이며 작업 트리를 바꾸면 달라진다', () => {
  const fx = fixtureF();
  const first = diffIntent(fx);
  const second = diffIntent(fx);
  assert.equal(canonicalJson(second), canonicalJson(first));
  const { digest, ...rest } = first;
  assert.equal(digest, sha256Canonical(rest));
  writeText(fx.repo, 'src/free.ts', fnSource('free', 3));
  const changed = collectDiffIntent({
    repoRoot: fx.repo,
    snapshot: snapshotOf(fx.repo, fx.base),
    historyRef: fx.base,
  });
  assert.notEqual(changed.digest, first.digest);
  assert.notEqual(changed.snapshot_id, first.snapshot_id);
});

test('collectDiffIntent 전후 HEAD·git status·.git/index 바이트 → 모두 같다', () => {
  const fx = fixtureF();
  const indexPath = path.join(fx.repo, '.git', 'index');
  const before = {
    head: revParse(fx.repo, 'HEAD'),
    status: git(fx.repo, ['status', '--porcelain']),
    index: fs.readFileSync(indexPath),
  };
  diffIntent(fx);
  assert.equal(revParse(fx.repo, 'HEAD'), before.head);
  assert.equal(git(fx.repo, ['status', '--porcelain']), before.status);
  assert.ok(fs.readFileSync(indexPath).equals(before.index));
});

test('두 번째 조회가 lookup boom으로 실패 → 같은 메시지의 Error로 throw하고 조회는 두 번에서 멈춘다', () => {
  const { repo, base } = rankedBase();
  mutateThree(repo);
  mutateBig(repo);
  const snapshot = snapshotOf(repo, base);
  let calls = 0;
  const failing = (input) => {
    calls += 1;
    if (calls === 2) throw new Error('lookup boom');
    return resolveIntentAtRevision(input);
  };
  assert.throws(
    () => collectDiffIntent({ repoRoot: repo, snapshot, historyRef: base, deps: { resolveIntentAtRevision: failing } }),
    (error) => error instanceof Error && error.message === 'lookup boom',
  );
  assert.equal(calls, 2);
  // 같은 입력이 조회 주입 없이는 성공하므로 실패 원인은 조회 단계에 있다.
  const ok = collectDiffIntent({ repoRoot: repo, snapshot, historyRef: base });
  assert.equal(ok.slot.summary.queryable, 4);
});

test('조회가 status unlinked 응답을 돌려줌 → evidence는 unlinked이고 throw하지 않는다', () => {
  const { repo, base } = rankedBase();
  mutateThree(repo);
  const snapshot = snapshotOf(repo, base);
  const unlinkedFake = () => ({ status: 'unlinked', explain_docs: 0, total_linked: 0, candidates: [] });
  const result = collectDiffIntent({
    repoRoot: repo,
    snapshot,
    historyRef: base,
    deps: { resolveIntentAtRevision: unlinkedFake },
  });
  assert.equal(result.slot.entries.length, 3);
  for (const entry of result.slot.entries) {
    assert.equal(entry.evidence, 'unlinked');
    assert.deepEqual(entry.candidates, []);
  }
});

test('ok.ts 한 함수와 docs·구문 깨진 base·test 파일을 함께 바꿈 → 계수는 covered 밖 파일 셋을 세고 후보는 okFn 하나다', () => {
  const fx = coverageRepo();
  const result = diffIntent(fx);
  const { summary } = result.slot;
  assert.equal(summary.changed_files, 4);
  assert.equal(summary.files_not_covered, 3);
  assert.equal(summary.candidates_total, 1);
  assert.equal(summary.queryable, 1);
  assert.equal(summary.selected, 1);
  assert.equal(summary.omitted_by_count, 0);
  assert.equal(summary.omitted_by_bytes, 0);
  assert.equal(summary.added_no_history, 0);
  assert.equal(summary.ambiguous_mapping, 0);
  assert.equal(summary.unlinked, 1);
  const statusOf = (rel) => result.manifest.files.find((item) => item.path === rel).status;
  assert.equal(statusOf('src/ok.ts'), 'covered');
  assert.equal(statusOf('docs/readme.md'), 'unsupported');
  assert.equal(statusOf('src/broken-base.ts'), 'parse_failed');
  assert.equal(statusOf('test/x.test.js'), 'excluded');
  assert.deepEqual(result.manifest.candidates.map((item) => nameOf(item)), ['okFn']);
  assert.deepEqual(result.slot.entries.map((entry) => nameOf(entry)), ['okFn']);
});
