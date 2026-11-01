'use strict';

// bouncer intent diff는 동결된 review snapshot 하나와 기준 SHA로 변경 함수 근거 JSON을 낸다. 이 파일은 배포 CLI
// 경계(runCli)와 자식 프로세스로 입력 검증·경로 정규화·조회 실패 reason·읽기 전용·지연 적재를 확인한다.
// 기대값은 fixture 소스의 줄 번호, git 명령, 요구 명세(snapshot 경로 형식·reason 목록)에서만 얻고, 구현이 돌려준
// 값에서 만들지 않는다. 실제 Git과 자식 프로세스를 쓰므로 integration tier에 둔다(test/tiers.json).

const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const { runCli } = require('../packages/cli/dist/cli');
const { captureReviewSnapshot } = require('../packages/cli/dist/review-snapshot');
const { sha256Canonical } = require('../packages/cli/dist/canonical-json');

const CLI_DIST = path.join(__dirname, '..', 'packages', 'cli', 'dist', 'cli.js');
const dirs = [];

after(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

const BLUEPRINT = '.bouncer/context/epics/001-demo/blueprints/001-demo';
const EXPLAIN_REL = `${BLUEPRINT}/explain.md`;
const TASK_1 = 'EPIC-001/BP-001/TASK-001';
const TASK_DOC_1 = `${BLUEPRINT}/tasks/001/tasks.md`;
// 명세의 snapshot 경로 형식과 reason 목록을 테스트 쪽에 독립적으로 적는다. 구현 상수를 가져오지 않는다.
const SNAPSHOT_PATH_RE = /^\.bouncer\/runtime\/review-snapshots\/([0-9a-f]{64})\/snapshot\.json$/;
const FIXED_UNEXPECTED_CAUSE = 'unexpected exception without message';

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
 * 작업 트리 전체를 커밋하고 새 커밋의 SHA를 돌려준다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} message - 커밋 메시지
 * @returns {string} 새 커밋의 40자 SHA
 */
function commitAll(repo, message) {
  git(repo, ['add', '-A']);
  git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message]);
  return git(repo, ['rev-parse', 'HEAD']).trim();
}

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
 * task_commits 한 행을 YAML 조각으로 적는다. sha는 8자 접두사이며 이 행이 커밋과 Task를 잇는 연결 증거다.
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
 * 001-demo Explain 원문을 만든다. 본문은 Background 한 절만 의미가 있고 나머지 절은 형식을 맞추는 용도다.
 *
 * @param {string[]} rows - taskRow 결과
 * @param {string} background - Background 절 본문
 * @returns {string} explain.md 본문
 */
function explainText(rows, background) {
  return [
    '---',
    'type: bouncer.explain',
    'title: diff intent command fixture',
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
    background,
    '',
    '## Intuition',
    '',
    'intu-text',
    '',
    '## Code',
    '',
    'code-text',
    '',
  ].join('\n');
}

/**
 * 연결 fixture다. P1(trailer TASK-001)이 `linked`를 만들고 B가 Explain을 커밋한다. H는 B 뒤의 커밋이고,
 * 작업 트리는 `linked`의 return 값을 바꾼다. snapshot의 기준은 B다.
 *
 * @returns {{ repo: string, root: string, base: string, later: string, p1: string, snapshotId: string,
 *   snapshotRel: string, snapshot: object }} 저장소 루트·저장소·기준 SHA·H·P1·snapshot id·상대 경로·동결 snapshot
 */
function fixture() {
  // 저장소를 root/repo에 둬서 같은 root 아래에 symlink 등 보조 경로를 만들 수 있게 한다.
  const root = tmpDir('bouncer-intent-diff-cmd-');
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo);
  git(repo, ['init', '-q', '-b', 'main']);
  writeText(repo, 'src/f.ts', fnSource('linked', 1));
  writeText(repo, TASK_DOC_1, '# Tasks\n');
  const p1 = commitAll(repo, trailerMessage('P1', TASK_1));
  writeText(repo, EXPLAIN_REL, explainText([taskRow(TASK_1, p1.slice(0, 8), 'task-001')], 'back-text'));
  const base = commitAll(repo, 'B');
  // H는 기준 뒤의 커밋이다. history-ref가 이 커밋을 가리키면 snapshot의 base와 달라야 한다.
  writeText(repo, 'notes.md', 'later\n');
  const later = commitAll(repo, 'H');
  writeText(repo, 'src/f.ts', fnSource('linked', 5));
  const captured = captureReviewSnapshot({
    repoRoot: repo,
    blueprintDir: BLUEPRINT,
    taskId: null,
    base,
    head: 'HEAD',
  });
  assert.equal(captured.ok, true, `snapshot capture failed: ${captured.reason}`);
  return {
    repo,
    root,
    base,
    later,
    p1,
    snapshotId: captured.snapshot_id,
    snapshotRel: captured.snapshot_path,
    snapshot: captured.snapshot,
  };
}

/**
 * 배포 CLI 경계로 명령을 실행하고 stdout·stderr를 문자열로 모은다.
 *
 * @param {string[]} argv - `bouncer` 뒤 argv
 * @returns {{ code: number, out: string, err: string }} 종료 코드와 두 스트림
 */
function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (value) => { buf.out += value; },
    err: (value) => { buf.err += value; },
  });
  return { code, ...buf };
}

/**
 * stdout이 JSON 문서 하나이고 `JSON.stringify(…, null, 2)` + `\n` 형식인지 확인한 뒤 파싱한다.
 * 형식이 어긋나면 문서가 두 개거나 끝 개행이 없다는 뜻이므로 실패로 본다.
 *
 * @param {string} out - stdout 전체
 * @returns {object} 파싱된 문서
 */
function parseOnlyJson(out) {
  assert.equal(out.endsWith('\n'), true, 'stdout must end with a newline');
  const doc = JSON.parse(out);
  assert.equal(`${JSON.stringify(doc, null, 2)}\n`, out, 'stdout must be exactly one JSON document');
  return doc;
}

/**
 * 실패 JSON의 공통 계약을 확인한다. exit 1, stderr 비어 있음, ok false, reason 일치, 성공 필드 없음이다.
 *
 * @param {{ code: number, out: string, err: string }} res - capture 결과
 * @param {string} reason - 기대 reason
 * @returns {object} 파싱된 실패 문서
 */
function assertFailure(res, reason) {
  assert.equal(res.code, 1, res.err);
  assert.equal(res.err, '');
  const doc = parseOnlyJson(res.out);
  assert.equal(doc.ok, false);
  assert.equal(doc.reason, reason);
  assert.equal(typeof doc.cause, 'string');
  assert.ok(doc.cause.length > 0, 'cause must not be empty');
  assert.equal(typeof doc.next, 'string');
  for (const field of ['snapshot_id', 'history_ref', 'slot', 'manifest', 'digest']) {
    assert.equal(Object.hasOwn(doc, field), false, `failure must not carry ${field}`);
  }
  return doc;
}

/**
 * 성공 호출 인자를 만든다. 경로와 SHA는 fixture 값이고 --repo는 명시한다.
 *
 * @param {{ repo: string, snapshotRel: string, base: string }} fx - fixture
 * @returns {string[]} `bouncer` 뒤 argv
 */
function successArgs(fx) {
  return ['intent', 'diff', '--repo', fx.repo, '--snapshot', fx.snapshotRel, '--history-ref', fx.base];
}

/**
 * snapshot artifact의 절대 경로를 돌려준다. 손상·삭제 테스트가 이 파일을 직접 바꾼다.
 *
 * @param {{ repo: string, snapshotRel: string }} fx - fixture
 * @returns {string} artifact 절대 경로
 */
function artifactAbs(fx) {
  return path.join(fx.repo, ...fx.snapshotRel.split('/'));
}

/**
 * 자식 프로세스에서 배포 CLI를 실행한다. 같은 프로세스의 require.cache 오염을 피하고 cwd를 직접 고른다.
 *
 * @param {string} cwd - 자식 프로세스 cwd
 * @param {string[]} argv - `bouncer` 뒤 argv
 * @returns {{ code: number, out: string, err: string, keys: string[] }} 종료 코드·두 스트림·적재된 require 키
 */
function childCli(cwd, argv) {
  // 적재 관측은 자식에서만 한다. 명령이 끝난 뒤 require.cache 키를 한 번에 돌려준다.
  const script = [
    `const { runCli } = require(${JSON.stringify(CLI_DIST)});`,
    'const out = [];',
    'const err = [];',
    `const code = runCli(${JSON.stringify(argv)}, {`,
    '  out: (s) => out.push(s),',
    '  err: (s) => err.push(s),',
    '});',
    // 키 목록은 부모가 읽을 수 있게 JSON 한 줄로 쓴다. 명령 출력과 섞이지 않도록 out/err는 따로 담는다.
    'const keys = Object.keys(require.cache);',
    'process.stdout.write(JSON.stringify({ code, out: out.join(""), err: err.join(""), keys }));',
  ].join('\n');
  const res = spawnSync(process.execPath, ['-e', script], { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout);
}

/**
 * 파일 내용의 SHA-256 16진 문자열이다. 바이트 동일성 비교에만 쓴다.
 *
 * @param {Buffer | string} bytes - 해시할 내용
 * @returns {string} 64자 hex
 */
function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * 읽기 전용 검사용 저장소 상태를 모은다. HEAD·symbolic ref·status·index 바이트와 .bouncer/runtime 아래 모든
 * 파일의 경로·내용 해시를 담는다. 명령 호출 전후로 같아야 한다.
 *
 * @param {string} repo - 저장소 루트
 * @returns {object} 비교용 상태 객체
 */
function repoState(repo) {
  const runtime = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else runtime.push([path.relative(repo, abs), sha256Hex(fs.readFileSync(abs))]);
    }
  };
  const runtimeDir = path.join(repo, '.bouncer', 'runtime');
  if (fs.existsSync(runtimeDir)) walk(runtimeDir);
  return {
    head: git(repo, ['rev-parse', 'HEAD']).trim(),
    symref: git(repo, ['symbolic-ref', 'HEAD']).trim(),
    // optional lock을 피해 읽기 명령이 index를 다시 쓰지 않게 한다.
    status: git(repo, ['--no-optional-locks', 'status', '--porcelain']),
    index: sha256Hex(fs.readFileSync(path.join(repo, '.git', 'index'))),
    runtime: runtime.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
  };
}

// 1. 성공 경로. 상대 경로 snapshot과 기준 SHA B로 exit 0, 빈 stderr, ok:true JSON 하나이고 linked 근거가 P1이다.
test('상대 경로 snapshot과 기준 SHA B → exit 0, stderr 없음, stdout은 ok:true JSON 하나이고 linked 근거는 P1', () => {
  const fx = fixture();
  const res = capture(successArgs(fx));
  assert.equal(res.code, 0, res.err);
  assert.equal(res.err, '');
  const doc = parseOnlyJson(res.out);
  assert.equal(doc.ok, true);
  assert.equal(doc.snapshot_id, fx.snapshotId);
  assert.equal(SNAPSHOT_PATH_RE.exec(fx.snapshotRel)[1], doc.snapshot_id);
  assert.equal(doc.history_ref, fx.base);
  assert.equal(doc.slot.entries.length, 1);
  const [linked] = doc.slot.entries;
  assert.equal(linked.base_ref.qualified_name, 'linked');
  assert.equal(linked.evidence, 'linked');
  assert.equal(linked.candidates.length, 1);
  assert.equal(linked.candidates[0].commit, fx.p1);
});

test('절대 경로 snapshot → 상대 경로 호출과 같은 stdout 바이트', () => {
  const fx = fixture();
  const relative = capture(successArgs(fx));
  const absolute = capture([
    'intent', 'diff', '--repo', fx.repo, '--snapshot', artifactAbs(fx), '--history-ref', fx.base,
  ]);
  assert.equal(relative.code, 0, relative.err);
  assert.equal(absolute.code, 0, absolute.err);
  assert.equal(absolute.out, relative.out);
});

test('7자 약식 history-ref → 40자 호출과 같은 stdout 바이트이고 history_ref는 40자 B', () => {
  const fx = fixture();
  const full = capture(successArgs(fx));
  const short = capture([
    'intent', 'diff', '--repo', fx.repo, '--snapshot', fx.snapshotRel, '--history-ref', fx.base.slice(0, 7),
  ]);
  assert.equal(short.code, 0, short.err);
  assert.equal(short.out, full.out);
  assert.equal(parseOnlyJson(short.out).history_ref, fx.base);
});

test('같은 호출을 두 번 실행 → stdout 바이트가 같다', () => {
  const fx = fixture();
  const first = capture(successArgs(fx));
  const second = capture(successArgs(fx));
  assert.equal(first.code, 0, first.err);
  assert.equal(second.out, first.out);
});

// 2. 사용법 오류. 값 누락·중복·빈 값·옵션 자리·알 수 없는 option·남는 positional·history-ref 형식 위반은 exit 2다.
test('사용법 오류 열두 가지 → 모두 exit 2, stdout 빈 값, stderr가 intent: 로 시작', () => {
  const fx = fixture();
  const rel = fx.snapshotRel;
  const base = fx.base;
  const cases = [
    { label: '--snapshot 누락', argv: ['--history-ref', base] },
    { label: '--history-ref 누락', argv: ['--snapshot', rel] },
    { label: '--snapshot 중복', argv: ['--snapshot', rel, '--snapshot', rel, '--history-ref', base] },
    { label: '--history-ref 중복', argv: ['--snapshot', rel, '--history-ref', base, '--history-ref', base] },
    { label: '--snapshot 빈 값', argv: ['--snapshot', '', '--history-ref', base] },
    { label: '--snapshot 값 자리에 --repo', argv: ['--snapshot', '--repo', '--history-ref', base] },
    { label: '알 수 없는 --x', argv: ['--snapshot', rel, '--history-ref', base, '--x', '1'] },
    { label: '남는 positional extra', argv: ['--snapshot', rel, '--history-ref', base, 'extra'] },
    { label: 'history-ref HEAD', argv: ['--snapshot', rel, '--history-ref', 'HEAD'] },
    { label: 'history-ref main', argv: ['--snapshot', rel, '--history-ref', 'main'] },
    { label: 'history-ref 대문자', argv: ['--snapshot', rel, '--history-ref', 'ABCDEF1'] },
    { label: 'history-ref 6자', argv: ['--snapshot', rel, '--history-ref', 'abcdef'] },
  ];
  for (const item of cases) {
    const res = capture(['intent', 'diff', ...item.argv]);
    assert.equal(res.code, 2, item.label);
    assert.equal(res.out, '', item.label);
    assert.ok(res.err.startsWith('intent: '), `${item.label}: ${res.err}`);
  }
});

// 3. 지연 적재. 사용법 오류 경로는 resolver 모듈을 require.cache에 남기지 않고, 유효 경로는 남긴다.
const RESOLVER_BASENAMES = [
  'symbol-index', 'intent-provenance', 'intent-revision', 'review-diff-intent', 'review-snapshot',
];

/**
 * require.cache 키 목록에 resolver 모듈 basename이 있는지 고른다.
 *
 * @param {string[]} keys - `Object.keys(require.cache)`
 * @returns {string[]} 적재된 resolver basename 목록
 */
function loadedResolvers(keys) {
  const names = new Set(keys.map((key) => path.basename(key).replace(/\.js$/, '')));
  return RESOLVER_BASENAMES.filter((name) => names.has(name));
}

test('사용법 오류 호출(--snapshot 누락) → exit 2이고 resolver 모듈을 적재하지 않는다', () => {
  const fx = fixture();
  const probe = childCli(fx.repo, ['intent', 'diff', '--history-ref', 'abc1234']);
  assert.equal(probe.code, 2, probe.err);
  assert.equal(probe.out, '');
  assert.deepEqual(loadedResolvers(probe.keys), []);
});

test('유효한 인자로 성공한 호출 → review-diff-intent와 intent-revision을 적재한다(관측 유효성)', () => {
  const fx = fixture();
  const probe = childCli(fx.repo, successArgs(fx));
  assert.equal(probe.code, 0, probe.err);
  const loaded = loadedResolvers(probe.keys);
  assert.ok(loaded.includes('review-diff-intent'), JSON.stringify(loaded));
  assert.ok(loaded.includes('intent-revision'), JSON.stringify(loaded));
});

// 4. snapshot 로더 실패. 변조·절단·부재·형식 위반·symlink 조상을 각각 별도 테스트로 본다.
test('snapshot.json의 파일 내용 글자 하나만 바꾼 변조 → snapshot-corrupt, exit 1, 성공 필드 없음', () => {
  const fx = fixture();
  const abs = artifactAbs(fx);
  const doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const target = doc.files.find((item) => item.content.length > 0);
  assert.ok(target, 'fixture must carry a non-empty snapshot file');
  // JSON은 그대로 유효하고 값만 한 글자 달라진다. 해시가 id와 어긋나야 corrupt다.
  target.content = (target.content[0] === 'x' ? 'y' : 'x') + target.content.slice(1);
  fs.writeFileSync(abs, JSON.stringify(doc));
  assertFailure(capture(successArgs(fx)), 'snapshot-corrupt');
});

test('snapshot.json을 중간에서 잘라 JSON이 깨진 파일 → snapshot-corrupt, exit 1', () => {
  const fx = fixture();
  const abs = artifactAbs(fx);
  const bytes = fs.readFileSync(abs);
  fs.writeFileSync(abs, bytes.subarray(0, Math.floor(bytes.length / 2)));
  assertFailure(capture(successArgs(fx)), 'snapshot-corrupt');
});

test('snapshot.json 파일 삭제 → snapshot-missing, exit 1', () => {
  const fx = fixture();
  fs.rmSync(artifactAbs(fx));
  assertFailure(capture(successArgs(fx)), 'snapshot-missing');
});

test('같은 내용을 저장소 루트의 copy.json으로 복사해 그 이름을 지정 → snapshot-path-invalid, exit 1', () => {
  const fx = fixture();
  fs.copyFileSync(artifactAbs(fx), path.join(fx.repo, 'copy.json'));
  const res = capture(['intent', 'diff', '--repo', fx.repo, '--snapshot', 'copy.json', '--history-ref', fx.base]);
  assertFailure(res, 'snapshot-path-invalid');
});

test('artifact 디렉터리 이름이 hex 63자인 경로 → snapshot-path-invalid, exit 1', () => {
  const fx = fixture();
  const short = fx.snapshotId.slice(0, 63);
  const dir = path.join(fx.repo, '.bouncer', 'runtime', 'review-snapshots', short);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(artifactAbs(fx), path.join(dir, 'snapshot.json'));
  const rel = `.bouncer/runtime/review-snapshots/${short}/snapshot.json`;
  const res = capture(['intent', 'diff', '--repo', fx.repo, '--snapshot', rel, '--history-ref', fx.base]);
  assertFailure(res, 'snapshot-path-invalid');
});

test('artifact 디렉터리를 다른 곳을 가리키는 symlink로 바꾼 경로 → 로더의 unsafe-path, exit 1', () => {
  const fx = fixture();
  const dirAbs = path.join(fx.repo, '.bouncer', 'runtime', 'review-snapshots', fx.snapshotId);
  const elsewhere = path.join(fx.root, 'elsewhere', fx.snapshotId);
  fs.mkdirSync(path.dirname(elsewhere), { recursive: true });
  fs.renameSync(dirAbs, elsewhere);
  fs.symlinkSync(elsewhere, dirAbs);
  assertFailure(capture(successArgs(fx)), 'unsafe-path');
});

// 5. 기준 실패. history-ref가 snapshot base와 다르거나 저장소에서 확정되지 않으면 exit 1이다.
test('B가 아닌 다른 커밋 H의 SHA를 history-ref로 지정 → history-ref-mismatch, 후보 필드 없음', () => {
  const fx = fixture();
  const res = capture(['intent', 'diff', '--repo', fx.repo, '--snapshot', fx.snapshotRel, '--history-ref', fx.later]);
  assertFailure(res, 'history-ref-mismatch');
});

test('저장소에 없는 40자 SHA를 history-ref로 지정 → history-unreadable, 후보 필드 없음', () => {
  const fx = fixture();
  const res = capture([
    'intent', 'diff', '--repo', fx.repo, '--snapshot', fx.snapshotRel, '--history-ref', '1'.repeat(40),
  ]);
  assertFailure(res, 'history-unreadable');
});

test('Git 저장소가 아닌 디렉터리의 target.base 변조 artifact → history-unreadable, 후보 필드 없음', () => {
  const fx = fixture();
  // 다른 base를 적은 snapshot을 같은 canonical 규칙으로 다시 id를 매겨 Git 없는 디렉터리에 둔다.
  // 다른 필드는 캡처 그대로여서 원인은 Git 저장소 부재 하나다.
  const altered = { ...fx.snapshot, target: { ...fx.snapshot.target, base: '1'.repeat(40) } };
  const altId = sha256Canonical(altered);
  const plain = tmpDir('bouncer-intent-diff-plain-');
  const rel = `.bouncer/runtime/review-snapshots/${altId}/snapshot.json`;
  writeText(plain, rel, `${JSON.stringify(altered, null, 2)}\n`);
  const res = capture(['intent', 'diff', '--repo', plain, '--snapshot', rel, '--history-ref', '1111111']);
  assertFailure(res, 'history-unreadable');
});

// 5b. 수집 실패. collectDiffIntent가 던진 Error의 메시지는 cause가 되고, 메시지가 없으면 고정 문자열이 된다.
test('hunk 헤더의 옛 줄 수를 본문과 어긋나게 바꾼 artifact → collect-failed, cause는 diff를 담는다', () => {
  const fx = fixture();
  // 첫 hunk 헤더의 옛 줄 수 b를 1 늘린다. b가 생략되었으면 1을 2로 바꾼다. 줄 번호 fixture에 기대지 않는다.
  const bad = JSON.parse(JSON.stringify(fx.snapshot));
  bad.diff = bad.diff.replace(
    /^@@ -(\d+)(?:,(\d+))? \+/m,
    (_match, start, count) => `@@ -${start},${Number(count ?? '1') + 1} +`,
  );
  assert.notEqual(bad.diff, fx.snapshot.diff, 'the hunk header must change');
  const id = sha256Canonical(bad);
  const rel = `.bouncer/runtime/review-snapshots/${id}/snapshot.json`;
  writeText(fx.repo, rel, `${JSON.stringify(bad, null, 2)}\n`);
  const res = capture(['intent', 'diff', '--repo', fx.repo, '--snapshot', rel, '--history-ref', fx.base]);
  const doc = assertFailure(res, 'collect-failed');
  assert.ok(doc.cause.includes('diff'), doc.cause);
});

/**
 * 주입한 collectDiffIntent로 run을 직접 호출한다. 성공 fixture의 argv를 쓰고 stdout·stderr를 모은다.
 *
 * @param {{ repo: string, snapshotRel: string, base: string }} fx - fixture
 * @param {Function} collect - 던지는 조회 주입
 * @returns {{ code: number, out: string, err: string }} 종료 코드와 두 스트림
 */
function runWithCollect(fx, collect) {
  // 조회 주입은 모듈을 직접 불러야 가능하다. 배포 경계 검사는 runCli가 맡고, 이 호출은 주입 지점만 본다.
  // 모듈을 파일 상단에서 require하면 구현 전 파일 전체가 적재 실패하므로 이 helper 안에서만 부른다.
  const { run: runIntentDiff } = require('../packages/cli/dist/cli-intent-diff-command');
  const buf = { out: '', err: '' };
  const code = runIntentDiff(
    ['--repo', fx.repo, '--snapshot', fx.snapshotRel, '--history-ref', fx.base],
    { out: (value) => { buf.out += value; }, err: (value) => { buf.err += value; } },
    { collectDiffIntent: collect },
  );
  return { code, ...buf };
}

test('collectDiffIntent가 메시지 없는 Error를 던짐 → collect-failed, cause는 고정 문자열, run은 throw하지 않음', () => {
  const fx = fixture();
  const res = runWithCollect(fx, () => { throw new Error(''); });
  const doc = assertFailure(res, 'collect-failed');
  assert.equal(doc.cause, FIXED_UNEXPECTED_CAUSE);
});

test('collectDiffIntent가 문자열 boom을 던짐 → collect-failed, cause는 고정 문자열, run은 throw하지 않음', () => {
  const fx = fixture();
  const res = runWithCollect(fx, () => { throw 'boom'; });
  const doc = assertFailure(res, 'collect-failed');
  assert.equal(doc.cause, FIXED_UNEXPECTED_CAUSE);
});

test('collectDiffIntent가 빈 객체를 던짐 → collect-failed, cause는 고정 문자열, run은 throw하지 않음', () => {
  const fx = fixture();
  const res = runWithCollect(fx, () => { throw {}; });
  const doc = assertFailure(res, 'collect-failed');
  assert.equal(doc.cause, FIXED_UNEXPECTED_CAUSE);
});

test('collectDiffIntent가 Error boom을 던짐 → collect-failed, cause는 boom', () => {
  const fx = fixture();
  const res = runWithCollect(fx, () => { throw new Error('boom'); });
  const doc = assertFailure(res, 'collect-failed');
  assert.equal(doc.cause, 'boom');
});

// 6. 읽기 전용. 성공과 조회 실패 호출 전후로 HEAD·symbolic ref·status·index 바이트·runtime 파일이 같아야 한다.
test('성공과 조회 실패 호출 전후 → 저장소 상태와 runtime 파일 바이트가 같다', () => {
  const fx = fixture();
  const calls = [
    successArgs(fx),
    ['intent', 'diff', '--repo', fx.repo, '--snapshot', fx.snapshotRel, '--history-ref', fx.later],
    ['intent', 'diff', '--repo', fx.repo, '--snapshot', 'copy.json', '--history-ref', fx.base],
    ['intent', 'diff', '--repo', fx.repo, '--snapshot', fx.snapshotRel, '--history-ref', '1'.repeat(40)],
  ];
  for (const argv of calls) {
    const before = repoState(fx.repo);
    capture(argv);
    assert.deepEqual(repoState(fx.repo), before, argv.join(' '));
  }
});

// 7. 기존 하위 명령 보존. intent --symbol 질의는 이 명령을 추가해도 같은 resolved 상태를 낸다.
test('기존 intent --symbol 질의 → exit 0, status resolved', () => {
  const fx = fixture();
  const res = capture(['intent', '--repo', fx.repo, '--symbol', 'linked']);
  assert.equal(res.code, 0, res.err);
  assert.equal(parseOnlyJson(res.out).status, 'resolved');
});

// 8. --repo 처리. 중복·빈 값·옵션 자리는 exit 2이고, 없는 경로·일반 파일은 stderr 문구로 가른다.
test('--repo가 중복·빈 값·옵션 자리이면 → exit 2, stdout 빈 값', () => {
  const fx = fixture();
  const cases = [
    ['--repo', fx.repo, '--repo', fx.repo, '--snapshot', fx.snapshotRel, '--history-ref', fx.base],
    ['--repo', '', '--snapshot', fx.snapshotRel, '--history-ref', fx.base],
    ['--repo', '--snapshot', '--history-ref', fx.base],
  ];
  for (const tail of cases) {
    const res = capture(['intent', 'diff', ...tail]);
    assert.equal(res.code, 2, tail.join(' '));
    assert.equal(res.out, '', tail.join(' '));
  }
});

test('--repo가 없는 경로이거나 일반 파일이면 → exit 2, stderr가 --repo is not a directory로 시작', () => {
  const fx = fixture();
  const file = path.join(fx.root, 'plain.txt');
  fs.writeFileSync(file, 'x\n');
  for (const repo of [path.join(fx.root, 'missing'), file]) {
    const res = capture(['intent', 'diff', '--repo', repo, '--snapshot', fx.snapshotRel, '--history-ref', fx.base]);
    assert.equal(res.code, 2, repo);
    assert.equal(res.out, '', repo);
    assert.ok(res.err.startsWith('intent: --repo is not a directory:'), res.err);
  }
});

test('--repo가 저장소 하위 디렉터리이고 상대 경로 snapshot → snapshot-missing(하위 디렉터리가 루트로 취급됨)', () => {
  const fx = fixture();
  const res = capture([
    'intent', 'diff', '--repo', path.join(fx.repo, 'src'), '--snapshot', fx.snapshotRel, '--history-ref', fx.base,
  ]);
  assertFailure(res, 'snapshot-missing');
});

test('--repo가 저장소 하위 디렉터리이고 저장소 절대 경로 snapshot → snapshot-path-invalid', () => {
  const fx = fixture();
  const res = capture([
    'intent', 'diff', '--repo', path.join(fx.repo, 'src'), '--snapshot', artifactAbs(fx), '--history-ref', fx.base,
  ]);
  assertFailure(res, 'snapshot-path-invalid');
});

test('--repo 생략이고 cwd가 저장소 루트인 자식 프로세스 → 같은 경로 입력의 stdout 바이트와 같다', () => {
  const fx = fixture();
  const explicit = capture(successArgs(fx));
  const implicit = childCli(fx.repo, ['intent', 'diff', '--snapshot', fx.snapshotRel, '--history-ref', fx.base]);
  assert.equal(explicit.code, 0, explicit.err);
  assert.equal(implicit.code, 0, implicit.err);
  assert.equal(implicit.out, explicit.out);
});

// 9. 경로 정규화. 점·이중 슬래시·끝 슬래시·대문자 hex는 path.resolve로 접지 않고 snapshot-path-invalid다.
test('경로 형태가 잘못된 다섯 가지 → 모두 exit 1, snapshot-path-invalid', () => {
  const fx = fixture();
  const id = fx.snapshotId;
  const forms = [
    `./.bouncer/runtime/review-snapshots/${id}/snapshot.json`,
    `.bouncer/runtime/../runtime/review-snapshots/${id}/snapshot.json`,
    `.bouncer/runtime/review-snapshots/${id}/snapshot.json/`,
    `.bouncer//runtime/review-snapshots/${id}/snapshot.json`,
    `.bouncer/runtime/review-snapshots/${id.toUpperCase()}/snapshot.json`,
  ];
  for (const rel of forms) {
    const res = capture(['intent', 'diff', '--repo', fx.repo, '--snapshot', rel, '--history-ref', fx.base]);
    assertFailure(res, 'snapshot-path-invalid');
  }
});

test('저장소 루트를 가리키는 symlink를 --repo로 쓰고 그 경로의 절대 snapshot → 셀 1과 같은 stdout 바이트', () => {
  const fx = fixture();
  const link = path.join(fx.root, 'link');
  fs.symlinkSync(fx.repo, link);
  const direct = capture(successArgs(fx));
  const viaLink = capture([
    'intent', 'diff', '--repo', link, '--snapshot', path.join(link, ...fx.snapshotRel.split('/')),
    '--history-ref', fx.base,
  ]);
  assert.equal(direct.code, 0, direct.err);
  assert.equal(viaLink.code, 0, viaLink.err);
  assert.equal(viaLink.out, direct.out);
});

test('--repo는 저장소 실경로인데 symlink 경로로 절대 snapshot을 지정 → snapshot-path-invalid', () => {
  const fx = fixture();
  const link = path.join(fx.root, 'link');
  fs.symlinkSync(fx.repo, link);
  const res = capture([
    'intent', 'diff', '--repo', fx.repo, '--snapshot', path.join(link, ...fx.snapshotRel.split('/')),
    '--history-ref', fx.base,
  ]);
  assertFailure(res, 'snapshot-path-invalid');
});
