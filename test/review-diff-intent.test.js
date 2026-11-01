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

const { extractChangedFunctions } = require('../packages/cli/dist/review-diff-intent');
const { captureReviewSnapshot } = require('../packages/cli/dist/review-snapshot');
const { canonicalJson } = require('../packages/cli/dist/canonical-json');

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
