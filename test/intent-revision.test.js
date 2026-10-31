'use strict';

// intent-revision 모듈은 고정 SHA 하나의 Git 트리만 읽어야 한다. 작업 트리·HEAD·인덱스가 달라도
// 같은 SHA에서 같은 답이 나오고, 거부(throw)와 부재(상태 값)가 섞이지 않는지 실제 임시 저장소로 확인한다.
// Git을 띄우므로 integration tier에 둔다(test/tiers.json).

const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  resolveHistoryRef,
  readBlobAt,
  listExplainSourcesAt,
  readRegistryAt,
  listDefinitionsAtRevision,
} = require('../packages/cli/dist/intent-revision');
const { canonicalJson } = require('../packages/cli/dist/canonical-json');

const dirs = [];

after(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

const GITLINK_SHA = '1234567890abcdef1234567890abcdef12345678';
const EXPLAIN_ONE = '.bouncer/context/epics/demo/blueprints/one/explain.md';
const EXPLAIN_TWO = '.bouncer/context/epics/demo/blueprints/two/explain.md';
const REGISTRY_REL = '.bouncer/epics.json';
const REGISTRY_OK = '{"version":2,"profile":"domain-only","domainEpicLimit":9,"areas":[],"epics":[]}\n';
const REGISTRY_BAD = '{"version":9}\n';
const A_C1 = 'export function alpha() {\n  return 1;\n}\nfunction beta() { return 2; }\n';
const A_C2 = [
  'export function alpha2() {',
  '  return 10;',
  '}',
  'function beta() { return 2; }',
  'function gamma() { return 3; }',
  '',
].join('\n');
const WORKTREE_A = 'function worktreeOnly() { return 0; }\n';

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
 * 고정 identity로 git을 실행한다. 상위 프로세스가 물려준 GIT_DIR 등은 지워서 fixture가 엉뚱한
 * 저장소를 건드리지 않게 하고, GIT_CONFIG_NOSYSTEM=1로 시스템 설정이 fixture SHA에 섞이지 않게 한다.
 *
 * @param {string} cwd - git을 실행할 디렉터리
 * @param {string[]} args - git argv
 * @param {string} [input] - stdin 본문
 * @returns {string} stdout(utf8)
 */
function git(cwd, args, input) {
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key];
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    input,
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
 * 저장소에서 spec을 40자 SHA로 펼친다. 기대값을 테스트가 Git에서 독립적으로 얻는 통로다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} spec - rev-parse 인자
 * @returns {string} rev-parse 출력(공백 제거)
 */
function revParse(repo, spec) {
  return git(repo, ['rev-parse', spec]).trim();
}

/**
 * 저장소 상대 경로에 본문을 쓴다. 상위 디렉터리가 없으면 만든다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} rel - 저장소 상대 경로
 * @param {string} body - 파일 본문
 * @returns {void}
 */
function writeText(repo, rel, body) {
  const abs = path.join(repo, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

/**
 * 워킹트리 전체를 스테이징하고 gitlink를 index에 직접 넣은 뒤 커밋한다. gitlink는 워킹트리에 디렉터리가
 * 없어도 되므로 `git add -A` 뒤에 update-index로 넣는다. 먼저 넣으면 add가 그 항목을 삭제로 본다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} message - 커밋 메시지
 * @param {Array<[string, string]>} [gitlinks] - [40자 sha, 저장소 상대 경로] 쌍
 * @returns {string} 새 커밋의 40자 SHA
 */
function commitAll(repo, message, gitlinks = []) {
  git(repo, ['add', '-A']);
  for (const [sha, rel] of gitlinks) {
    git(repo, ['update-index', '--add', '--cacheinfo', `160000,${sha},${rel}`]);
  }
  // 전역 서명 설정과 무관하게 같은 방식으로 커밋한다.
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message]);
  return revParse(repo, 'HEAD');
}

/**
 * 고정 SHA 픽스처를 만든다. C0은 빈 README뿐인 첫 커밋, C1은 종류별 파일이 모두 있는 기준선,
 * C2는 C1에서 바뀐 상태다. 마지막에 커밋하지 않은 작업 트리 변경을 얹어 HEAD와 다른 디스크를 만든다.
 *
 * @returns {{ repo: string, c0: string, c1: string, c2: string }} 저장소 경로와 세 커밋 SHA
 */
function buildFixture() {
  const repo = tmpDir('bouncer-intent-revision-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'README.md', '');
  const c0 = commitAll(repo, 'C0');

  writeText(repo, 'src/a.ts', A_C1);
  writeText(repo, 'src/gone.ts', 'function gone() { return 0; }\n');
  writeText(repo, 'src/empty.ts', '');
  writeText(repo, 'src/broken.ts', 'function target() { return ( ;\n');
  writeText(repo, 'src/types.d.ts', 'declare function d(): void;\n');
  writeText(repo, 'docs/readme.md', '# docs\n');
  fs.symlinkSync('src/a.ts', path.join(repo, 'link.ts'));
  writeText(repo, EXPLAIN_ONE, 'v1\n');
  writeText(repo, REGISTRY_REL, REGISTRY_OK);
  const c1 = commitAll(repo, 'C1', [[GITLINK_SHA, 'vendor/sub.ts']]);

  writeText(repo, 'src/a.ts', A_C2);
  fs.rmSync(path.join(repo, 'src', 'gone.ts'));
  writeText(repo, 'src/new.ts', 'function fresh() { return 4; }\n');
  writeText(repo, EXPLAIN_ONE, 'v2\n');
  writeText(repo, EXPLAIN_TWO, 'two\n');
  writeText(repo, REGISTRY_REL, REGISTRY_BAD);
  const c2 = commitAll(repo, 'C2', [[GITLINK_SHA, 'vendor/sub.ts']]);

  // 커밋하지 않은 작업 트리: HEAD(C2)와도 C1과도 다른 내용을 디스크에 둔다.
  writeText(repo, 'src/a.ts', WORKTREE_A);
  writeText(repo, 'src/untracked.ts', 'function untracked() {}\n');
  return { repo, c0, c1, c2 };
}

/**
 * 거절돼야 하는 호출이 실제 검증 경로에서 throw하는지 확인한다. 뼈대 export에서 나는 TypeError는
 * 거절로 세지 않는다. 아직 구현되지 않은 상태에서 거절 테스트가 우연히 통과하는 일을 막기 위해서다.
 *
 * @param {() => unknown} fn - 거절돼야 하는 호출
 * @param {RegExp} [pattern] - 메시지에 있어야 할 문구
 * @returns {void}
 */
function assertRejects(fn, pattern) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof Error, 'expected the call to throw an Error');
  assert.notEqual(thrown.name, 'TypeError', `expected a guard error, got a TypeError: ${thrown.message}`);
  assert.notEqual(thrown.message, '', 'error message must not be empty');
  if (pattern) assert.match(thrown.message, pattern);
}

/**
 * 읽기 호출 전후에 비교할 저장소 상태를 모은다. `--no-optional-locks`로 status가 index를 갱신하지
 * 않게 해서, 이 스냅샷 자체가 index 바이트를 바꾸지 않게 한다.
 *
 * @param {string} repo - 저장소 루트
 * @returns {{ head: string, status: string, index: Buffer }} HEAD SHA, status 출력, index 바이트
 */
function repoState(repo) {
  return {
    head: revParse(repo, 'HEAD'),
    status: git(repo, ['--no-optional-locks', 'status', '--porcelain']),
    index: fs.readFileSync(path.join(repo, '.git', 'index')),
  };
}

test('C1의 짧은 SHA와 작업 트리 덮어쓰기 → 커밋 트리의 정의만 나오고 작업 트리 함수는 나오지 않는다', () => {
  const fx = buildFixture();
  const atC1 = listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1.slice(0, 7), path: 'src/a.ts' });

  assert.equal(atC1.history_ref, fx.c1);
  assert.equal(atC1.status, 'parsed');
  assert.deepEqual(atC1.definitions.map((d) => d.qualified_name), ['alpha', 'beta']);
  assert.deepEqual(atC1.definitions.map((d) => d.kind), ['exported-function', 'function-declaration']);
  assert.deepEqual(atC1.definitions.map((d) => [d.start_line, d.end_line]), [[1, 3], [4, 4]]);
  assert.ok(!JSON.stringify(atC1).includes('worktreeOnly'), 'worktree-only function must not leak into C1');

  const atC2 = listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c2, path: 'src/a.ts' });
  assert.deepEqual(atC2.definitions.map((d) => d.qualified_name), ['alpha2', 'beta', 'gamma']);
});

test('같은 C1 SHA를 작업 트리 수정 전후로 읽음 → canonical JSON 바이트가 같다', () => {
  const fx = buildFixture();
  const read = () => canonicalJson(listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' }));
  const before = read();

  writeText(fx.repo, 'src/a.ts', 'function changedAgain() { return 9; }\n');
  assert.equal(read(), before);
});

test('C1의 src/a.ts를 읽음 → blob_sha가 git rev-parse C1:src/a.ts 값과 같다', () => {
  const fx = buildFixture();
  const expected = revParse(fx.repo, `${fx.c1}:src/a.ts`);

  const defs = listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' });
  assert.equal(defs.blob_sha, expected);
  assert.ok(defs.definitions.every((d) => d.blob_sha === expected));

  const blob = readBlobAt({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' });
  assert.equal(blob.status, 'present');
  assert.equal(blob.blob_sha, expected);
  assert.equal(blob.mode, '100644');
});

test('C1에 없는 src/new.ts를 읽음 → absent로 돌려주고 throw하지 않는다', () => {
  const fx = buildFixture();
  assert.deepEqual(readBlobAt({ repoRoot: fx.repo, ref: fx.c1, path: 'src/new.ts' }), { status: 'absent' });
  assert.deepEqual(
    listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/new.ts' }),
    { history_ref: fx.c1, status: 'absent', path: 'src/new.ts' },
  );
});

test('C2에서 삭제된 src/gone.ts를 읽음 → absent이고, 같은 경로의 C1에서는 gone 정의 1개가 나온다', () => {
  const fx = buildFixture();
  assert.deepEqual(
    listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c2, path: 'src/gone.ts' }),
    { history_ref: fx.c2, status: 'absent', path: 'src/gone.ts' },
  );

  const atC1 = listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/gone.ts' });
  assert.equal(atC1.status, 'parsed');
  assert.deepEqual(atC1.definitions.map((d) => [d.qualified_name, d.kind]), [['gone', 'function-declaration']]);
});

test('디렉터리 경로 src를 읽음 → 파일 부재로 absent를 돌려준다', () => {
  const fx = buildFixture();
  assert.deepEqual(readBlobAt({ repoRoot: fx.repo, ref: fx.c1, path: 'src' }), { status: 'absent' });
  assert.deepEqual(
    listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src' }),
    { history_ref: fx.c1, status: 'absent', path: 'src' },
  );
});

test('빈 파일과 구문 오류 파일 → parsed(정의 0개)와 parse_failed로 구분된다', () => {
  const fx = buildFixture();
  const empty = listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/empty.ts' });
  assert.equal(empty.status, 'parsed');
  assert.deepEqual(empty.definitions, []);

  const broken = listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/broken.ts' });
  assert.equal(broken.status, 'parse_failed');
  assert.equal(Object.hasOwn(broken, 'definitions'), false);
});

test('선언 파일·확장자 미지원·symlink·gitlink → 각각 다른 사유의 unsupported가 된다', () => {
  const fx = buildFixture();
  const readAt = (p) => listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: p });
  assert.deepEqual(readAt('src/types.d.ts'), {
    history_ref: fx.c1, status: 'unsupported', path: 'src/types.d.ts', reason: 'declaration-file',
  });
  assert.deepEqual(readAt('docs/readme.md'), {
    history_ref: fx.c1, status: 'unsupported', path: 'docs/readme.md', reason: 'extension',
  });
  // symlink는 확장자가 .ts여도 링크로 본다. 링크 대상의 정의를 이 파일의 정의로 세지 않게 하기 위해서다.
  assert.deepEqual(readAt('link.ts'), {
    history_ref: fx.c1, status: 'unsupported', path: 'link.ts', reason: 'symlink',
  });
  assert.deepEqual(readAt('vendor/sub.ts'), {
    history_ref: fx.c1, status: 'unsupported', path: 'vendor/sub.ts', reason: 'submodule',
  });
});

test('C1의 Explain 원문 → 한 건이고 blob_sha가 커밋 트리 blob과 같다', () => {
  const fx = buildFixture();
  const sources = listExplainSourcesAt({ repoRoot: fx.repo, ref: fx.c1 });
  assert.equal(sources.length, 1);
  assert.equal(sources[0].rel, EXPLAIN_ONE);
  assert.equal(sources[0].text, 'v1\n');
  assert.equal(sources[0].blob_sha, revParse(fx.repo, `${fx.c1}:${EXPLAIN_ONE}`));
});

test('C2의 Explain 두 건 → rel 오름차순이고 C1에 없던 two는 C1 결과에 나오지 않는다', () => {
  const fx = buildFixture();
  const atC2 = listExplainSourcesAt({ repoRoot: fx.repo, ref: fx.c2 });
  assert.deepEqual(atC2.map((s) => s.rel), [EXPLAIN_ONE, EXPLAIN_TWO]);
  assert.deepEqual(atC2.map((s) => s.text), ['v2\n', 'two\n']);

  const atC1 = listExplainSourcesAt({ repoRoot: fx.repo, ref: fx.c1 });
  assert.ok(!atC1.some((s) => s.rel === EXPLAIN_TWO));
});

test('작업 트리에서 Explain을 고쳐도 → C1 Explain 결과가 바뀌지 않는다', () => {
  const fx = buildFixture();
  const before = canonicalJson(listExplainSourcesAt({ repoRoot: fx.repo, ref: fx.c1 }));
  writeText(fx.repo, EXPLAIN_ONE, 'worktree edit\n');
  assert.equal(canonicalJson(listExplainSourcesAt({ repoRoot: fx.repo, ref: fx.c1 })), before);
});

test('C1의 registry → status ok이고 blob_sha가 커밋 트리 blob과 같다', () => {
  const fx = buildFixture();
  const result = readRegistryAt({ repoRoot: fx.repo, ref: fx.c1 });
  assert.equal(result.status, 'ok');
  assert.equal(result.blob_sha, revParse(fx.repo, `${fx.c1}:${REGISTRY_REL}`));
});

test('C2의 registry가 스키마 위반 → invalid와 비어 있지 않은 message를 돌려주고 throw하지 않는다', () => {
  const fx = buildFixture();
  const result = readRegistryAt({ repoRoot: fx.repo, ref: fx.c2 });
  assert.equal(result.status, 'invalid');
  assert.equal(result.blob_sha, revParse(fx.repo, `${fx.c2}:${REGISTRY_REL}`));
  assert.equal(typeof result.message, 'string');
  assert.notEqual(result.message, '');
});

test('registry와 Explain이 없는 C0 → registry는 missing(blob_sha null)이고 Explain은 빈 배열이다', () => {
  const fx = buildFixture();
  assert.deepEqual(readRegistryAt({ repoRoot: fx.repo, ref: fx.c0 }), { status: 'missing', blob_sha: null });
  assert.deepEqual(listExplainSourcesAt({ repoRoot: fx.repo, ref: fx.c0 }), []);
});

test('hex가 아니거나 형식이 틀린 ref 목록 → 모두 throw하고, 그 뒤 정상 ref 호출은 성공한다', () => {
  const fx = buildFixture();
  const rejected = ['HEAD', 'main', 'abc', 'ABCDEF1', '--version', 'main~1', '0'.repeat(40), 'a'.repeat(41)];
  for (const ref of rejected) {
    assertRejects(() => resolveHistoryRef({ repoRoot: fx.repo, ref }));
  }
  assert.equal(resolveHistoryRef({ repoRoot: fx.repo, ref: fx.c1.slice(0, 7) }), fx.c1);
});

test('위험하거나 잘못된 path 목록 → readBlobAt이 모두 throw한다', () => {
  const fx = buildFixture();
  const rejected = ['', '/etc/passwd', '../x', 'src//a.ts', 'src\\a.ts', './src/a.ts'];
  for (const p of rejected) {
    assertRejects(() => readBlobAt({ repoRoot: fx.repo, ref: fx.c1, path: p }));
  }
});

test('Git 저장소가 아닌 repoRoot → resolveHistoryRef가 throw한다', () => {
  const nonRepo = tmpDir('bouncer-intent-nonrepo-');
  assertRejects(() => resolveHistoryRef({ repoRoot: nonRepo, ref: 'abcdef1' }));
});

test('고정 SHA 읽기 호출을 모두 마침 → HEAD·status·.git/index 바이트가 호출 전과 같다', () => {
  const fx = buildFixture();
  const before = repoState(fx.repo);

  resolveHistoryRef({ repoRoot: fx.repo, ref: fx.c1.slice(0, 7) });
  readBlobAt({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' });
  listExplainSourcesAt({ repoRoot: fx.repo, ref: fx.c2 });
  readRegistryAt({ repoRoot: fx.repo, ref: fx.c2 });
  listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' });

  assert.deepEqual(repoState(fx.repo), before);
});

test('ref 이름이 짧은 hex와 겹침 → 7·8자는 throw하고 겹치지 않는 10자는 40자 커밋으로 풀린다', () => {
  const repo = tmpDir('bouncer-intent-collide-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'x.txt', 'x\n');
  const x = commitAll(repo, 'X');
  writeText(repo, 'y.txt', 'y\n');
  const y = commitAll(repo, 'Y');
  // 같은 문자열이 브랜치·태그 이름이기도 하면 Git은 그 이름을 먼저 풀어 다른 커밋(Y)을 가리킨다.
  git(repo, ['branch', x.slice(0, 7), y]);
  git(repo, ['tag', x.slice(0, 8), y]);

  assertRejects(() => resolveHistoryRef({ repoRoot: repo, ref: x.slice(0, 7) }));
  assertRejects(() => resolveHistoryRef({ repoRoot: repo, ref: x.slice(0, 8) }));
  assert.equal(resolveHistoryRef({ repoRoot: repo, ref: x.slice(0, 10) }), x);
});

test('작업 트리에 .gitattributes·.mailmap이 생김 → C1 정의와 Explain 결과가 그대로다', () => {
  const fx = buildFixture();
  const readAll = () => canonicalJson({
    defs: listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' }),
    explains: listExplainSourcesAt({ repoRoot: fx.repo, ref: fx.c1 }),
  });
  const before = readAll();

  writeText(fx.repo, '.gitattributes', '* text eol=crlf\n');
  writeText(fx.repo, '.mailmap', 'Someone <new@example.com> <t@example.com>\n');
  assert.equal(readAll(), before);
});

test('C1 blob에 git replace를 걸음 → 읽은 blob 바이트와 정의가 replace 이전과 같다', () => {
  const fx = buildFixture();
  const blob = revParse(fx.repo, `${fx.c1}:src/a.ts`);
  const before = {
    blob: readBlobAt({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' }),
    defs: listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' }),
  };

  const other = git(fx.repo, ['hash-object', '-w', '--stdin'], 'function replaced() { return 7; }\n').trim();
  git(fx.repo, ['replace', blob, other]);
  // replace가 실제로 걸렸는지 먼저 확인한다. 걸리지 않았다면 아래 비교는 아무것도 증명하지 못한다.
  assert.equal(git(fx.repo, ['cat-file', 'blob', blob]), 'function replaced() { return 7; }\n');

  assert.deepEqual(readBlobAt({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' }), before.blob);
  assert.deepEqual(listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' }), before.defs);
});

test('process.env.GIT_DIR이 다른 저장소를 가리킴 → C1 정의 결과가 그대로다', () => {
  const fx = buildFixture();
  const other = tmpDir('bouncer-intent-other-');
  git(other, ['init', '-q', '-b', 'main']);
  writeText(other, 'unrelated.ts', 'function unrelated() {}\n');
  commitAll(other, 'other');

  const read = () => listDefinitionsAtRevision({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts' });
  const before = read();

  const prior = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(other, '.git');
  let during;
  try {
    during = read();
  } finally {
    if (prior === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = prior;
  }
  assert.deepEqual(during, before);
});

/**
 * 600 KiB 가까운 Explain 본문을 만든다. 한 줄은 100바이트이고 마지막 줄에 한글을 둬서,
 * 출력이 문자열 디코딩이나 기본 버퍼 한도에서 깨지면 바이트 길이가 어긋나게 한다.
 *
 * @param {number} index - 본문을 구분하는 번호
 * @returns {string} UTF-8 본문
 */
function bigExplainBody(index) {
  const line = `${String(index).padStart(2, '0')}${'a'.repeat(97)}\n`;
  return `${line.repeat(6000)}한글 마지막 줄\n`;
}

/**
 * 큰 Explain 세 건을 커밋한 저장소를 만든다.
 *
 * @returns {{ repo: string, c: string, rels: string[], bodies: string[] }} 저장소, 커밋 SHA, 경로, 본문
 */
function buildBigFixture() {
  const repo = tmpDir('bouncer-intent-big-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'README.md', '');
  commitAll(repo, 'C0');
  const names = ['a', 'b', 'c'];
  const rels = names.map((n) => `.bouncer/context/epics/big/blueprints/${n}/explain.md`);
  const bodies = names.map((_, i) => bigExplainBody(i));
  rels.forEach((rel, i) => writeText(repo, rel, bodies[i]));
  const c = commitAll(repo, 'big');
  return { repo, c, rels, bodies };
}

test('Explain 3건(각 600 KiB, 한글 마지막 줄) → text 바이트가 입력과 같고 기본 한도에서 잘리지 않는다', () => {
  const big = buildBigFixture();
  const sources = listExplainSourcesAt({ repoRoot: big.repo, ref: big.c });
  assert.deepEqual(sources.map((s) => s.rel), big.rels);
  sources.forEach((s, i) => {
    assert.equal(s.text, big.bodies[i]);
    assert.equal(Buffer.byteLength(s.text, 'utf8'), Buffer.byteLength(big.bodies[i], 'utf8'));
  });
});

test('Explain 목록 출력이 maxBuffer 1024를 넘음 → 일부 결과 없이 git output exceeds 1024 bytes로 throw한다', () => {
  const big = buildBigFixture();
  assertRejects(
    () => listExplainSourcesAt({ repoRoot: big.repo, ref: big.c, maxBuffer: 1024 }),
    /git output exceeds 1024 bytes/,
  );
});

test('C1 src/a.ts가 maxBuffer 16보다 큼 → git output exceeds 16 bytes로 throw한다', () => {
  const fx = buildFixture();
  assertRejects(
    () => readBlobAt({ repoRoot: fx.repo, ref: fx.c1, path: 'src/a.ts', maxBuffer: 16 }),
    /git output exceeds 16 bytes/,
  );
});

test('Explain 본문 blob이 maxBuffer 1024를 넘음 → 같은 메시지로 throw하고, 짧은 호출 단계는 통과한다', () => {
  // 위 테스트는 rev-parse 한 줄(41바이트)에서도 16 한도에 걸리므로 blob 읽기 단계를 증명하지 못한다.
  // 1024는 SHA 펼침과 ls-tree를 통과시키고 600 KiB blob 본문에서만 걸리므로 blob 단계를 따로 검증한다.
  const big = buildBigFixture();
  assertRejects(
    () => readBlobAt({ repoRoot: big.repo, ref: big.c, path: big.rels[0], maxBuffer: 1024 }),
    /git output exceeds 1024 bytes/,
  );
});
