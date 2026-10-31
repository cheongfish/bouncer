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
const { resolveIntentAtRevision, expandShaAmong } = require('../packages/cli/dist/intent-provenance');

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
 * @param {Record<string, string>} [extraEnv] - 이 호출에만 덧씌울 env(예: 커밋 시각 고정)
 * @returns {string} stdout(utf8)
 */
function git(cwd, args, input, extraEnv = {}) {
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
      ...extraEnv,
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

// ── resolveIntentAtRevision: 고정 SHA 기준 provenance ────────────────────────────────────
// 아래 fixture는 test/terminal-intent-provenance.test.js의 Explain·trailer 형식을 따르되 이 파일 안에만 둔다.
// 기대값은 fixture가 커밋한 SHA와 git rev-parse로 얻고, 조회 결과로 기대값을 만들지 않는다.

const PROV_KIND = 'exported-function';
const PROV_EXPLAIN = '.bouncer/context/epics/001-demo/blueprints/001-demo/explain.md';
const PROV_BROKEN = '.bouncer/context/epics/002-bad/blueprints/002-bad/explain.md';
const PROV_TASK_1 = 'EPIC-001/BP-001/TASK-001';
const PROV_TASK_2 = 'EPIC-001/BP-001/TASK-002';
const PROV_REGISTRY_EXPLAIN = '.bouncer/context/epics/plan-workflow/blueprints/registry-gates/explain.md';

/**
 * Bouncer-Task·Bouncer-Intent trailer가 붙은 커밋 메시지를 만든다.
 *
 * @param {string} subject - 제목 한 줄
 * @param {string} task - trailer의 stable Task ID
 * @returns {string} 커밋 메시지
 */
function provMessage(subject, task) {
  return `${subject}\n\nBouncer-Task: ${task}\nBouncer-Intent: EPIC-001/BP-001\n`;
}

/**
 * task_commits 한 행을 YAML 조각으로 적는다. sha는 8자 접두사다.
 *
 * @param {string} task - stable Task ID
 * @param {string} sha8 - 8자 접두사
 * @param {string} anchor - intent_anchor (`task-NNN`)
 * @returns {string} YAML 조각
 */
function provRow(task, sha8, anchor) {
  return [
    `    - task: ${JSON.stringify(task)}`,
    `      sha: ${JSON.stringify(sha8)}`,
    `      intent_anchor: ${JSON.stringify(anchor)}`,
  ].join('\n');
}

/**
 * 001-demo Explain 원문을 만든다. Background·Intuition·Code 세 절에 `tag`를 넣어 어느 시점의 본문인지 구분한다.
 *
 * @param {string[]} rows - provRow 결과
 * @param {string} tag - 본문 머리말(base, head, tampered 등)
 * @returns {string} explain.md 본문
 */
function provExplain(rows, tag) {
  return [
    '---',
    'type: bouncer.explain',
    'title: intent at revision fixture',
    'description: fixture',
    `resource: ${PROV_EXPLAIN}`,
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
    `${tag} background`,
    '',
    '## Intuition',
    '',
    `${tag} intuition`,
    '',
    '## Code',
    '',
    `${tag} code`,
    '',
  ].join('\n');
}

/**
 * 함수 좌표를 커밋 시점 기준으로 직접 만든다. blob_sha는 git rev-parse로 얻어 조회 함수의 판정을 빌리지 않는다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} rev - 커밋 SHA
 * @param {string} rel - 저장소 상대 경로
 * @param {string} name - qualified_name
 * @param {string} kind - symbol kind
 * @param {number} line - 정의가 있는 한 줄(start = end)
 * @returns {object} SymbolRef 형태 객체
 */
function symbolAt(repo, rev, rel, name, kind, line) {
  return {
    path: rel,
    qualified_name: name,
    kind,
    start_line: line,
    end_line: line,
    blob_sha: revParse(repo, `${rev}:${rel}`),
  };
}

/**
 * 001-demo task 문서 하나를 쓴다. 조회는 이 문서를 읽지 않지만 실제 커밋 구성과 맞춘다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} digits - '001' | '002'
 * @returns {void}
 */
function provTaskDoc(repo, digits) {
  writeText(repo, `.bouncer/context/epics/001-demo/blueprints/001-demo/tasks/${digits}/tasks.md`, [
    '# Tasks',
    '',
    '## Goal & intent',
    '',
    `task ${digits}`,
    '',
  ].join('\n'));
}

/**
 * 의도 조회 fixture를 만든다. G0(trailer 없음) → G1(TASK-001 trailer) → B(Explain 커밋, 파싱 실패 Explain 포함)
 * → H(TASK-002 trailer). 마지막에 커밋하지 않은 작업 트리 변경(tampered)을 얹어 HEAD와 디스크를 다르게 둔다.
 *
 * @returns {{ repo: string, g0: string, g1: string, b: string, h: string }} 저장소와 커밋 SHA 네 개
 */
function buildIntentFixture() {
  const repo = tmpDir('bouncer-intent-at-revision-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/one.ts', 'export function shared() { return 1; }\n');
  writeText(repo, 'src/two.ts', 'export function shared() { return 2; }\n');
  writeText(repo, 'src/other.ts', 'export function other() { return 0; }\n');
  const g0 = commitAll(repo, 'G0');

  writeText(repo, 'src/one.ts', 'export function shared() { return 10; }\n');
  provTaskDoc(repo, '001');
  const g1 = commitAll(repo, provMessage('G1', PROV_TASK_1));

  writeText(repo, PROV_BROKEN, 'no frontmatter\n');
  writeText(repo, PROV_EXPLAIN, provExplain([provRow(PROV_TASK_1, g1.slice(0, 8), 'task-001')], 'base'));
  const b = commitAll(repo, 'B');

  writeText(repo, 'src/one.ts', 'export function shared() { return 11; }\n');
  provTaskDoc(repo, '002');
  writeText(repo, PROV_EXPLAIN, provExplain([
    provRow(PROV_TASK_1, g1.slice(0, 8), 'task-001'),
    // 두 번째 행의 sha는 연결 증거가 아니다. TASK-002는 H의 trailer로 이어진다. 같은 커밋 안에서
    // H 자신의 8자는 쓸 수 없으므로 B의 8자를 쓴다.
    provRow(PROV_TASK_2, b.slice(0, 8), 'task-002'),
  ], 'head'));
  const h = commitAll(repo, provMessage('H', PROV_TASK_2));

  // 커밋하지 않은 작업 트리: 고정 SHA 결과에 섞이면 안 되는 본문과 함수 정의다.
  writeText(repo, 'src/one.ts', 'export function shared() { return 99; }\n');
  writeText(repo, PROV_EXPLAIN, provExplain([provRow(PROV_TASK_1, g1.slice(0, 8), 'task-001')], 'tampered'));
  return { repo, g0, g1, b, h };
}

/**
 * 커밋 시각을 고정해 커밋한다. freshness는 commit 시각 순서에 기대므로 같은 초에 찍힌 두 커밋은
 * "나중"이 되지 못해 비교 결과가 실행 시각에 흔들린다. 시각을 직접 적어 그 흔들림을 없앤다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} message - 커밋 메시지
 * @param {number} unixSeconds - 커밋 시각(초)
 * @returns {string} 새 커밋의 40자 SHA
 */
function commitDated(repo, message, unixSeconds) {
  git(repo, ['add', '-A']);
  const date = `${unixSeconds} +0000`;
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message], undefined, {
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
  return revParse(repo, 'HEAD');
}

/**
 * 같은 정의 줄을 두 번 바꾼 fixture를 만든다. C1은 `render`를 처음 쓴 커밋이라 `-G render`로만 잡히고 blame은
 * 아니다. C2는 조회 줄을 마지막으로 바꾼 커밋이라 blame이다. B는 두 TASK의 Explain만 커밋한다. 두 커밋 모두
 * trailer로 연결하므로 이 fixture는 `-G`가 함수 이력을 잡는지만 본다.
 *
 * @param {string} rel - 함수가 있는 저장소 상대 경로
 * @param {string} c1Body - C1 본문(`render` 포함)
 * @param {string} c2Body - C2 본문(`render` 포함, 같은 줄)
 * @returns {{ repo: string, c1: string, c2: string, b: string }} 저장소와 세 커밋 SHA
 */
function buildRenderFixture(rel, c1Body, c2Body) {
  const repo = tmpDir('bouncer-intent-render-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'README.md', '');
  commitDated(repo, 'C0', 1700000000);
  writeText(repo, rel, c1Body);
  const c1 = commitDated(repo, provMessage('C1', PROV_TASK_1), 1700000100);
  writeText(repo, rel, c2Body);
  const c2 = commitDated(repo, provMessage('C2', PROV_TASK_2), 1700000200);
  writeText(repo, PROV_EXPLAIN, provExplain([
    provRow(PROV_TASK_1, c1.slice(0, 8), 'task-001'),
    provRow(PROV_TASK_2, c2.slice(0, 8), 'task-002'),
  ], 'base'));
  const b = commitDated(repo, 'B', 1700000300);
  return { repo, c1, c2, b };
}

test('B 고정 SHA의 shared → TASK-001 근거 한 건만 나오고 작업 트리의 tampered 본문은 없다', () => {
  const fx = buildIntentFixture();
  const result = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.b,
    symbolRef: symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  assert.equal(result.status, 'resolved');
  assert.equal(result.history_ref, fx.b);
  assert.equal(result.explain_docs, 1);
  assert.equal(result.total_linked, 1);
  assert.equal(result.candidates.length, 1);
  const [cand] = result.candidates;
  assert.equal(cand.commit, fx.g1);
  assert.equal(cand.task, PROV_TASK_1);
  assert.equal(cand.explain, PROV_EXPLAIN);
  assert.equal(cand.explain_blob_sha, revParse(fx.repo, `${fx.b}:${PROV_EXPLAIN}`));
  assert.deepEqual(cand.sections.map((s) => s.name), ['Background', 'Intuition', 'Code']);
  assert.match(cand.sections[0].body, /base background/);
  assert.match(cand.sections[1].body, /base intuition/);
  assert.match(cand.sections[2].body, /base code/);
  assert.equal(JSON.stringify(result).includes('tampered'), false);
});

test('H 고정 SHA의 shared → TASK-002 근거가 head 본문과 함께 나오고 total_linked는 2다', () => {
  const fx = buildIntentFixture();
  const result = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.h,
    symbolRef: symbolAt(fx.repo, fx.h, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  assert.equal(result.status, 'resolved');
  assert.equal(result.total_linked, 2);
  const task2 = result.candidates.find((cand) => cand.task === PROV_TASK_2);
  assert.ok(task2, 'TASK-002 candidate must be present at H');
  assert.equal(task2.commit, fx.h);
  assert.equal(task2.explain_blob_sha, revParse(fx.repo, `${fx.h}:${PROV_EXPLAIN}`));
  assert.match(task2.sections[0].body, /head background/);
});

test('G1 시점(Explain 아직 없음) → unlinked이고 explain_docs 0이며, trailer 없는 other 조회는 explain_docs 1로 구분된다', () => {
  const fx = buildIntentFixture();
  const noExplain = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.g1,
    symbolRef: symbolAt(fx.repo, fx.g1, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  assert.equal(noExplain.status, 'unlinked');
  assert.equal(noExplain.explain_docs, 0);
  assert.deepEqual(noExplain.candidates, []);
  assert.equal(noExplain.total_linked, 0);

  const noLink = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.b,
    symbolRef: symbolAt(fx.repo, fx.b, 'src/other.ts', 'other', PROV_KIND, 1),
  });
  assert.equal(noLink.status, 'unlinked');
  assert.equal(noLink.explain_docs, 1);
  assert.deepEqual(noLink.candidates, []);
});

test('작업 트리를 다시 바꾼 뒤 같은 B 조회 → canonical JSON과 digest가 그대로이고 H 조회와 digest가 다르다', () => {
  const fx = buildIntentFixture();
  const first = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.b,
    symbolRef: symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  writeText(fx.repo, 'src/one.ts', 'export function shared() { return 1234; }\n');
  writeText(fx.repo, PROV_EXPLAIN, provExplain([provRow(PROV_TASK_1, fx.g1.slice(0, 8), 'task-001')], 'other tamper'));
  const second = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.b,
    symbolRef: symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  assert.equal(canonicalJson(second), canonicalJson(first));
  assert.equal(second.digest, first.digest);

  const atHead = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.h,
    symbolRef: symbolAt(fx.repo, fx.h, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  assert.notEqual(atHead.digest, first.digest);
});

/**
 * registry 시나리오 fixture를 만든다. R1은 옛 trailer(EPIC-071/BP-002) 커밋, R2는 slug Explain을 두되 registry가
 * 없는 커밋, R3은 alias registry를 둔 커밋, R4는 registry를 스키마 위반으로 바꾼 커밋이다.
 *
 * @returns {{ repo: string, r1: string, r2: string, r3: string, r4: string }} 저장소와 커밋 SHA 네 개
 */
function buildRegistryFixture() {
  const repo = tmpDir('bouncer-intent-registry-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/one.ts', 'export function aliased() { return 1; }\n');
  const r1 = commitAll(repo, 'R1\n\nBouncer-Task: EPIC-071/BP-002/TASK-001\nBouncer-Intent: EPIC-071/BP-002\n');

  writeText(repo, PROV_REGISTRY_EXPLAIN, [
    '---',
    'type: bouncer.explain',
    'title: fixture',
    'description: fixture',
    `resource: ${PROV_REGISTRY_EXPLAIN}`,
    'tags: [bouncer]',
    "timestamp: '2026-09-14T00:00:00+09:00'",
    'bouncer:',
    '  id: EXPLAIN-001',
    '  epic_id: plan-workflow',
    '  blueprint_id: registry-gates',
    '  status: published',
    '  task_commits: []',
    '---',
    '# Explain',
    '',
    '## Background',
    '',
    'migrated explain background',
    '',
  ].join('\n'));
  const r2 = commitAll(repo, 'R2');

  writeText(repo, REGISTRY_REL, JSON.stringify({
    version: 2,
    profile: 'domain-only',
    domainEpicLimit: 3,
    areas: [],
    epics: [{
      slug: 'plan-workflow', legacy_id: '071', kind: 'domain', active: true,
      blueprint_aliases: { '002': 'registry-gates' },
    }],
  }));
  const r3 = commitAll(repo, 'R3');

  writeText(repo, REGISTRY_REL, REGISTRY_BAD);
  const r4 = commitAll(repo, 'R4');
  return { repo, r1, r2, r3, r4 };
}

test('registry 없는 R2 시점 → unlinked이고 registry_blob_sha가 null이다', () => {
  const fx = buildRegistryFixture();
  const result = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.r2,
    symbolRef: symbolAt(fx.repo, fx.r2, 'src/one.ts', 'aliased', PROV_KIND, 1),
  });
  assert.equal(result.status, 'unlinked');
  assert.equal(result.explain_docs, 1);
  assert.equal(result.registry_blob_sha, null);
});

test('alias registry가 있는 R3 시점 → resolved이고 후보 commit은 옛 trailer 커밋 R1이다', () => {
  const fx = buildRegistryFixture();
  const result = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.r3,
    symbolRef: symbolAt(fx.repo, fx.r3, 'src/one.ts', 'aliased', PROV_KIND, 1),
  });
  assert.equal(result.status, 'resolved');
  assert.equal(result.registry_blob_sha, revParse(fx.repo, `${fx.r3}:${REGISTRY_REL}`));
  assert.equal(result.candidates[0].commit, fx.r1);
  assert.equal(result.candidates[0].explain, PROV_REGISTRY_EXPLAIN);
});

test('손상된 registry의 R4 시점 → unlinked이고 registry_blob_sha는 손상된 blob SHA다(null이 아니다)', () => {
  const fx = buildRegistryFixture();
  const result = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.r4,
    symbolRef: symbolAt(fx.repo, fx.r4, 'src/one.ts', 'aliased', PROV_KIND, 1),
  });
  assert.equal(result.status, 'unlinked');
  assert.equal(result.registry_blob_sha, revParse(fx.repo, `${fx.r4}:${REGISTRY_REL}`));
  assert.notEqual(result.registry_blob_sha, null);
});

test('shared 좌표의 blob·끝 줄·이름·kind·경로를 틀리게 준 호출 → 모두 symbolRef does not match로 throw한다', () => {
  const fx = buildIntentFixture();
  const good = symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1);
  const variants = [
    { ...good, blob_sha: '0'.repeat(40) },
    { ...good, end_line: 2 },
    { ...good, qualified_name: 'other' },
    { ...good, kind: 'arrow-function' },
    { ...good, path: 'src/nope.ts' },
    // src/two.ts에도 같은 이름의 shared가 있다. 다른 파일의 정의로 대체하지 않고 거절해야 한다.
    { ...good, path: 'src/two.ts' },
  ];
  for (const symbolRef of variants) {
    assertRejects(
      () => resolveIntentAtRevision({ repoRoot: fx.repo, historyRef: fx.b, symbolRef }),
      /^symbolRef does not match/,
    );
  }
});

test('historyRef가 HEAD·짧은 abc·40자 0 → 고정 커밋으로 풀리지 않아 throw한다', () => {
  const fx = buildIntentFixture();
  const symbolRef = symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1);
  for (const historyRef of ['HEAD', 'abc', '0'.repeat(40)]) {
    assertRejects(() => resolveIntentAtRevision({ repoRoot: fx.repo, historyRef, symbolRef }));
  }
});

test('limit가 0·6·문자열 3·1.5 → limit 범위 오류로 throw한다', () => {
  const fx = buildIntentFixture();
  const symbolRef = symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1);
  for (const limit of [0, 6, '3', 1.5]) {
    assertRejects(
      () => resolveIntentAtRevision({ repoRoot: fx.repo, historyRef: fx.b, symbolRef, limit }),
      /limit must be an integer between 1 and 5/,
    );
  }
});

test('Git 저장소가 아닌 repoRoot → resolveIntentAtRevision이 throw한다', () => {
  const fx = buildIntentFixture();
  const plain = tmpDir('bouncer-intent-plain-');
  assertRejects(() => resolveIntentAtRevision({
    repoRoot: plain,
    historyRef: fx.b,
    symbolRef: symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1),
  }));
});

test('symbolRef가 null·start_line 문자열·start_line 2 > end_line 1 → invalid symbolRef로 throw한다', () => {
  const fx = buildIntentFixture();
  const good = symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1);
  const bad = [null, { ...good, start_line: '1' }, { ...good, start_line: 2, end_line: 1 }];
  for (const symbolRef of bad) {
    assertRejects(
      () => resolveIntentAtRevision({ repoRoot: fx.repo, historyRef: fx.b, symbolRef }),
      /^invalid symbolRef:/,
    );
  }
});

test('H 조회에 limit 1을 주면 → candidates는 1건이고 total_linked는 적용 전 2다', () => {
  const fx = buildIntentFixture();
  const result = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.h,
    symbolRef: symbolAt(fx.repo, fx.h, 'src/one.ts', 'shared', PROV_KIND, 1),
    limit: 1,
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.total_linked, 2);
});

test('같은 8자 접두사를 가진 커밋이 목록에 둘 → ambiguous로 돌려주고 하나를 고르지 않는다', () => {
  const commits = [`aaaaaaaa11${'0'.repeat(30)}`, `aaaaaaaa22${'0'.repeat(30)}`];
  assert.deepEqual(expandShaAmong(commits, 'aaaaaaaa'), { status: 'ambiguous' });
});

test('접두사가 하나뿐이면 → unique로 40자를 돌려주고, 목록에 없으면 → missing이다', () => {
  assert.deepEqual(
    expandShaAmong([`aaaaaaaa11${'0'.repeat(30)}`, `bbbbbbbb22${'0'.repeat(30)}`], 'aaaaaaaa'),
    { status: 'unique', full: `aaaaaaaa11${'0'.repeat(30)}` },
  );
  assert.deepEqual(expandShaAmong([], 'aaaaaaaa'), { status: 'missing' });
  assert.deepEqual(expandShaAmong([`bbbbbbbb22${'0'.repeat(30)}`], 'aaaaaaaa'), { status: 'missing' });
});

test('replace ref를 걸고 GIT_DIR을 다른 저장소로 바꾼 뒤에도 → B 조회의 canonical JSON이 그대로다', () => {
  const fx = buildIntentFixture();
  const symbolRef = symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1);
  const before = canonicalJson(resolveIntentAtRevision({ repoRoot: fx.repo, historyRef: fx.b, symbolRef }));

  // B의 부모를 G0으로 바꾸는 replace ref다. 고정 조회가 이를 따르면 blame·log 결과가 달라진다.
  git(fx.repo, ['replace', '--graft', fx.b, fx.g0]);
  const afterReplace = canonicalJson(resolveIntentAtRevision({ repoRoot: fx.repo, historyRef: fx.b, symbolRef }));
  assert.equal(afterReplace, before);

  const other = tmpDir('bouncer-intent-other-');
  git(other, ['init', '-q', '-b', 'main']);
  const savedGitDir = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(other, '.git');
  try {
    const underOtherDir = canonicalJson(resolveIntentAtRevision({ repoRoot: fx.repo, historyRef: fx.b, symbolRef }));
    assert.equal(underOtherDir, before);
  } finally {
    if (savedGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = savedGitDir;
  }
});

test('파싱에 실패한 Explain만 있는 G1b → explain_docs 0이고 unlinked이다', () => {
  const repo = tmpDir('bouncer-intent-broken-only-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/one.ts', 'export function shared() { return 1; }\n');
  commitAll(repo, provMessage('G1', PROV_TASK_1));
  writeText(repo, PROV_BROKEN, 'no frontmatter\n');
  const g1b = commitAll(repo, 'G1b');
  const result = resolveIntentAtRevision({
    repoRoot: repo,
    historyRef: g1b,
    symbolRef: symbolAt(repo, g1b, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  assert.equal(result.status, 'unlinked');
  assert.equal(result.explain_docs, 0);
});

test('고정 SHA provenance 조회를 마침 → HEAD·status·.git/index 바이트가 호출 전과 같다', () => {
  const fx = buildIntentFixture();
  const before = repoState(fx.repo);
  resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.b,
    symbolRef: symbolAt(fx.repo, fx.b, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.h,
    symbolRef: symbolAt(fx.repo, fx.h, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  assert.deepEqual(repoState(fx.repo), before);
});

/**
 * 결과 후보 중 commit SHA가 같은 것을 찾는다. 후보가 없으면 테스트가 실패하도록 undefined를 그대로 돌려준다.
 *
 * @param {{ candidates: Array<{ commit: string }> }} result - resolveIntentAtRevision 결과
 * @param {string} sha - 찾을 40자 커밋
 * @returns {object | undefined} 해당 후보
 */
function candidateOf(result, sha) {
  return result.candidates.find((item) => item.commit === sha);
}

test('클래스 메서드 Box.render의 이전 정의 커밋 → 이름 bare render로 -G가 잡혀 possibly-superseded가 된다', () => {
  const fx = buildRenderFixture(
    'src/box.ts',
    'class Box {\n  render() { return 1; }\n}\n',
    'class Box {\n  render() { return 2; }\n}\n',
  );
  const result = resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.b,
    symbolRef: symbolAt(fx.repo, fx.b, 'src/box.ts', 'Box.render', 'class-method', 2),
  });
  assert.equal(result.status, 'resolved');
  assert.equal(candidateOf(result, fx.c2).freshness, 'current');
  assert.equal(candidateOf(result, fx.c1).freshness, 'possibly-superseded');
});

test('작업 트리에 -diff .gitattributes가 생김 → 같은 B 조회의 canonical JSON과 digest가 그대로다', () => {
  const fx = buildRenderFixture(
    'src/top.ts',
    'export function render() { return 1; }\n',
    'export function render() { return 2; }\n',
  );
  const query = () => resolveIntentAtRevision({
    repoRoot: fx.repo,
    historyRef: fx.b,
    symbolRef: symbolAt(fx.repo, fx.b, 'src/top.ts', 'render', 'exported-function', 1),
  });
  const before = query();
  assert.equal(candidateOf(before, fx.c1).freshness, 'possibly-superseded');

  // -diff는 이 파일을 바이너리로 만들어 작업 트리 속성이 바뀌면 `-G` 결과가 0건이 된다. 고정 SHA 조회는 이 속성을
  // 읽으면 안 되므로 결과가 바뀌지 않아야 한다.
  writeText(fx.repo, '.gitattributes', 'src/top.ts -diff\n');
  const after = query();
  assert.equal(canonicalJson(after), canonicalJson(before));
  assert.equal(after.digest, before.digest);
});

test('task_commits의 8자 SHA가 historyRef 도달 커밋 안에 하나뿐 → trailer 없는 커밋이 TASK-001 근거로 연결된다', () => {
  const repo = tmpDir('bouncer-intent-short-sha-');
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/one.ts', 'export function shared() { return 1; }\n');
  const c1 = commitDated(repo, 'C1 without trailer', 1700000100);
  // Explain 행은 8자 접두사만 적는다. 펼침은 historyRef에서 rev-list로 도달하는 커밋 목록 안에서만 한다.
  writeText(repo, PROV_EXPLAIN, provExplain([provRow(PROV_TASK_1, c1.slice(0, 8), 'task-001')], 'base'));
  const b = commitDated(repo, 'B', 1700000200);
  const result = resolveIntentAtRevision({
    repoRoot: repo,
    historyRef: b,
    symbolRef: symbolAt(repo, b, 'src/one.ts', 'shared', PROV_KIND, 1),
  });
  assert.equal(result.status, 'resolved');
  assert.equal(result.explain_docs, 1);
  assert.equal(result.total_linked, 1);
  const [cand] = result.candidates;
  assert.equal(cand.commit, c1);
  assert.equal(cand.task, PROV_TASK_1);
  assert.equal(cand.explain, PROV_EXPLAIN);
});
