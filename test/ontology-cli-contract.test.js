'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const BOUNCER = path.join(REPO_ROOT, 'packages', 'cli', 'bin', 'bouncer');
const PIPE_SKIP = process.platform === 'win32'
  ? 'POSIX 셸 파이프만 64KiB 절단을 재현한다'
  : false;
const SHARED_TOKEN = 'SharedToken';
const BLUEPRINT_COUNT = 100;
const UNIQUE_PER_BLUEPRINT = 60;
const TOKEN_LEN = 20;
const PIPE_CUTOFF = 65536;
const LARGE_BUFFER = 4 * 1024 * 1024;
const EPIPE_TIMEOUT_MS = 20_000;

const EXPECTED_WARNING_SUMMARY = {
  total: 5,
  by_code: { 'document-invalid': 3, 'path-rejected': 2 },
};
const EXPECTED_WARNING_DETAILS = [
  {
    code: 'document-invalid',
    source: '.bouncer/context/epics/e1/blueprints/bad-1/index.md',
    line: 0,
    detail: 'frontmatter is invalid',
  },
  {
    code: 'document-invalid',
    source: '.bouncer/context/epics/e1/blueprints/bad-2/index.md',
    line: 0,
    detail: 'frontmatter is invalid',
  },
  {
    code: 'document-invalid',
    source: '.bouncer/context/epics/e1/blueprints/bad-3/index.md',
    line: 0,
    detail: 'frontmatter is invalid',
  },
  {
    code: 'path-rejected',
    source: '.bouncer/context/notes/a.md',
    line: 0,
    detail: 'document path is outside the canonical context layout',
  },
  {
    code: 'path-rejected',
    source: '.bouncer/context/notes/b.md',
    line: 0,
    detail: 'document path is outside the canonical context layout',
  },
];

let fixtureRepo = null;
let warningRepo = null;
let cleanRepo = null;
let epipeDir = null;

/**
 * slug epic·blueprint 문서와 `SharedToken` 질의가 100건·64KiB를 넘도록 임시 git 저장소를 만든다.
 * 토큰 길이와 개수는 요구사항에서 온 값이며, 구현의 직렬화 결과를 보고 맞추지 않는다.
 *
 * @returns {string} git init된 fixture 루트 절대 경로
 */
function createLargeOntologyFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-ontology-cli-'));
  const git = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
  const epicRel = '.bouncer/context/epics/e1';
  writeContextDoc(root, `${epicRel}/index.md`, {
    type: 'bouncer.epic',
    bouncer: { id: 'e1', status: 'approved' },
  }, '# e1\n');
  for (let bp = 1; bp <= BLUEPRINT_COUNT; bp += 1) {
    const slug = `bp-${String(bp).padStart(3, '0')}`;
    const tokens = [`\`${SHARED_TOKEN}\``];
    for (let i = 1; i <= UNIQUE_PER_BLUEPRINT; i += 1) {
      tokens.push(`\`${uniqueToken(bp, i)}\``);
    }
    writeContextDoc(root, `${epicRel}/blueprints/${slug}/index.md`, {
      type: 'bouncer.blueprint',
      bouncer: { id: slug, status: 'approved' },
    }, `# ${slug}\n\n## Contract\n\n${tokens.join(' ')}\n`);
  }
  return root;
}

/**
 * 경고 계약용 저장소를 만든다. 깨진 blueprint 3개와 layout 밖 Markdown 2개만 두어
 * 기대 경고 5건을 문서 구성에서 셀 수 있게 한다. 100건 fixture와 분리한다.
 *
 * @returns {string} git init된 fixture 루트 절대 경로
 */
function createWarningOntologyFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-ontology-warn-'));
  const git = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
  for (const slug of ['bad-1', 'bad-2', 'bad-3']) {
    const rel = `.bouncer/context/epics/e1/blueprints/${slug}/index.md`;
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'not-frontmatter\n');
  }
  for (const name of ['a.md', 'b.md']) {
    const rel = `.bouncer/context/notes/${name}`;
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '# note\n');
  }
  return root;
}

/**
 * 경고가 나오지 않는 작은 저장소를 만든다. 앞 task의 100건 fixture를 재사용하지 않는다.
 *
 * @returns {string} git init된 fixture 루트 절대 경로
 */
function createCleanOntologyFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-ontology-clean-'));
  const git = spawnSync('git', ['init', '-q'], { cwd: root, encoding: 'utf8' });
  assert.equal(git.status, 0, git.stderr);
  const epicRel = '.bouncer/context/epics/e1';
  writeContextDoc(root, `${epicRel}/index.md`, {
    type: 'bouncer.epic',
    bouncer: { id: 'e1', status: 'approved' },
  }, '# e1\n');
  for (const slug of ['bp-a', 'bp-b', 'bp-c']) {
    writeContextDoc(root, `${epicRel}/blueprints/${slug}/index.md`, {
      type: 'bouncer.blueprint',
      bouncer: { id: slug, status: 'approved' },
    }, `# ${slug}\n\n## Contract\n\n\`${SHARED_TOKEN}\`\n`);
  }
  return root;
}

/**
 * 블루프린트마다 겹치지 않는 20자 ASCII 식별자를 만든다.
 *
 * @param {number} blueprint - 1부터 100까지의 블루프린트 번호
 * @param {number} index - 그 문서 안 고유 토큰 번호
 * @returns {string} 길이 20인 토큰
 */
function uniqueToken(blueprint, index) {
  const token = `T${String(blueprint).padStart(3, '0')}${String(index).padStart(16, '0')}`;
  assert.equal(token.length, TOKEN_LEN);
  return token;
}

/**
 * readContextDoc이 요구하는 type·bouncer.id·bouncer.status만 있는 컨텍스트 문서를 쓴다.
 *
 * @param {string} root - fixture 루트
 * @param {string} rel - 저장소 상대 posix 경로
 * @param {{type: string, bouncer: {id: string, status: string}}} data - frontmatter
 * @param {string} body - frontmatter 뒤 본문
 * @returns {void}
 */
function writeContextDoc(root, rel, data, body) {
  const abs = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const yaml = [
    '---',
    `type: ${data.type}`,
    'bouncer:',
    `  id: ${data.bouncer.id}`,
    `  status: ${data.bouncer.status}`,
    '---',
    '',
  ].join('\n');
  fs.writeFileSync(abs, `${yaml}${body}`);
}

/**
 * 큰 ontology 질의 argv를 돌려준다. 셸 문자열에 경로를 끼우지 않기 위한 배열이다.
 *
 * @param {string} repo - --repo 로 넘길 절대 경로
 * @returns {string[]} node 다음의 bouncer argv
 */
function ontologyArgv(repo) {
  return [
    BOUNCER,
    'ontology',
    'entity',
    '--entity',
    SHARED_TOKEN,
    '--limit',
    '100',
    '--repo',
    repo,
  ];
}

/**
 * 경고·거절 계약용 ontology argv. extra는 --warnings·--limit처럼 뒤에 붙는 옵션이다.
 *
 * @param {string} repo - --repo 절대 경로
 * @param {string[]} [extra] - entity 공통 인자 뒤에 붙일 옵션
 * @returns {string[]} node 다음의 bouncer argv
 */
function ontologyEntityArgv(repo, extra = []) {
  return [BOUNCER, 'ontology', 'entity', '--entity', SHARED_TOKEN, '--repo', repo, ...extra];
}

/**
 * ontology entity를 한 번 실행한다.
 *
 * @param {string} repo - fixture 루트
 * @param {string[]} [extra] - 추가 옵션
 * @returns {import('node:child_process').SpawnSyncReturns<string>} spawn 결과
 */
function runOntologyEntity(repo, extra = []) {
  return spawnSync(process.execPath, ontologyEntityArgv(repo, extra), {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: LARGE_BUFFER,
  });
}

/**
 * stdout을 파일 디스크립터로 리다이렉트해 파이프 절단과 무관한 전체 출력을 받는다.
 *
 * @param {string} repo - fixture 루트
 * @param {string} outPath - stdout을 쓸 파일
 * @returns {{status: number | null, stderr: string, stdout: string}} 종료 코드·stderr·파일 내용
 */
function runOntologyToFile(repo, outPath) {
  const fd = fs.openSync(outPath, 'w');
  try {
    const result = spawnSync(process.execPath, ontologyArgv(repo), {
      cwd: REPO_ROOT,
      stdio: ['ignore', fd, 'pipe'],
      encoding: 'utf8',
      maxBuffer: LARGE_BUFFER,
    });
    return {
      status: result.status,
      stderr: result.stderr,
      stdout: fs.readFileSync(outPath, 'utf8'),
    };
  } finally {
    fs.closeSync(fd);
  }
}

test.before(() => {
  fixtureRepo = createLargeOntologyFixture();
  warningRepo = createWarningOntologyFixture();
  cleanRepo = createCleanOntologyFixture();
  epipeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-ontology-epipe-'));
});

test.after(() => {
  if (fixtureRepo) fs.rmSync(fixtureRepo, { recursive: true, force: true });
  if (warningRepo) fs.rmSync(warningRepo, { recursive: true, force: true });
  if (cleanRepo) fs.rmSync(cleanRepo, { recursive: true, force: true });
  if (epipeDir) fs.rmSync(epipeDir, { recursive: true, force: true });
});

test(
  '큰 ontology 출력을 셸 파이프로 받으면 → 잘리지 않은 JSON 한 줄이고 파일 출력과 바이트가 같다',
  { skip: PIPE_SKIP },
  () => {
    const outPath = path.join(epipeDir, 'file-stdout.json');
    const fileRun = runOntologyToFile(fixtureRepo, outPath);
    // (a) fixture가 64KiB 절단을 건드리기에 충분한지. 수정 전에도 통과해야 한다.
    assert.ok(
      Buffer.byteLength(fileRun.stdout) > PIPE_CUTOFF,
      `file redirect length ${Buffer.byteLength(fileRun.stdout)}`,
    );

    const piped = spawnSync('sh', ['-c', '"$0" "$@" | cat', process.execPath, ...ontologyArgv(fixtureRepo)], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: LARGE_BUFFER,
    });
    assert.equal(piped.status, 0, piped.stderr);
    // (b) 파이프가 잘리면 JSON.parse가 SyntaxError가 된다.
    const parsed = JSON.parse(piped.stdout);
    assert.equal(parsed.total, BLUEPRINT_COUNT);
    // (c) 파일 리다이렉트와 바이트가 같다.
    assert.equal(piped.stdout, fileRun.stdout);
    // (d) JSON 한 줄 + 끝 개행 하나.
    assert.ok(piped.stdout.endsWith('\n'));
    assert.equal(piped.stdout.slice(0, -1).includes('\n'), false);
  },
);

test('잘못된 ontology 인자는 → exit 2, stderr에 ontology: 설명, stdout 비어 있음', () => {
  const result = spawnSync(process.execPath, [BOUNCER, 'ontology', 'entity'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.ok(result.stderr.startsWith('ontology: '));
  assert.equal(result.stdout.length, 0);
});

test('저장소가 아닌 경로로 ontology를 실행하면 → exit 2와 repoRoot is not a Git checkout 설명', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-ontology-nongit-'));
  try {
    const result = spawnSync(
      process.execPath,
      [BOUNCER, 'ontology', 'entity', '--entity', SHARED_TOKEN, '--repo', empty],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    assert.equal(result.status, 2);
    assert.equal(result.stderr, 'ontology: repoRoot is not a Git checkout\n');
    assert.equal(result.stdout.length, 0);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test(
  '출력을 받는 쪽이 일찍 닫히면 → 종료 코드 0이고 stderr가 비어 있다',
  { skip: PIPE_SKIP, timeout: EPIPE_TIMEOUT_MS },
  () => {
    const errFile = path.join(epipeDir, 'stderr.txt');
    const codeFile = path.join(epipeDir, 'exit-code.txt');
    const result = spawnSync(
      'sh',
      [
        '-c',
        '{ "$0" "$@" 2>"$ERR_FILE"; echo $? >"$CODE_FILE"; } | head -c 1',
        process.execPath,
        ...ontologyArgv(fixtureRepo),
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, ERR_FILE: errFile, CODE_FILE: codeFile },
        timeout: EPIPE_TIMEOUT_MS,
        maxBuffer: LARGE_BUFFER,
      },
    );
    assert.equal(result.stdout.length, 1);
    assert.equal(fs.readFileSync(codeFile, 'utf8').trim(), '0');
    assert.equal(fs.readFileSync(errFile, 'utf8'), '');
    assert.equal(result.error, undefined);
  },
);

test('기본 질의는 → warnings가 {total, by_code} 요약이고 항목 본문이 없다', () => {
  const result = runOntologyEntity(warningRepo);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.deepStrictEqual(parsed.warnings, EXPECTED_WARNING_SUMMARY);
  assert.equal(Object.hasOwn(parsed.warnings, 'details'), false);
  assert.equal(result.stdout.includes('bad-1'), false);
});

test('--warnings detail은 → details 5건이 total·by_code와 일치하고 항목 모양이 같다', () => {
  const result = runOntologyEntity(warningRepo, ['--warnings', 'detail']);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.warnings.total, 5);
  assert.deepStrictEqual(parsed.warnings.by_code, EXPECTED_WARNING_SUMMARY.by_code);
  assert.deepStrictEqual(parsed.warnings.details, EXPECTED_WARNING_DETAILS);
});

test('--warnings summary 명시는 → 기본 질의와 같은 응답이다', () => {
  const implicit = runOntologyEntity(warningRepo);
  const explicit = runOntologyEntity(warningRepo, ['--warnings', 'summary']);
  assert.equal(implicit.status, 0, implicit.stderr);
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.deepStrictEqual(JSON.parse(explicit.stdout), JSON.parse(implicit.stdout));
});

test('경고 없는 저장소는 → warnings가 {total: 0, by_code: {}}이다', () => {
  const result = runOntologyEntity(cleanRepo);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.deepStrictEqual(parsed.warnings, { total: 0, by_code: {} });
});

test('warnings 옵션과 무관하게 → results·total·truncated가 같고 --limit 1이면 truncated가 true다', () => {
  const summary = runOntologyEntity(cleanRepo, ['--warnings', 'summary']);
  const detail = runOntologyEntity(cleanRepo, ['--warnings', 'detail']);
  assert.equal(summary.status, 0, summary.stderr);
  assert.equal(detail.status, 0, detail.stderr);
  const summaryBody = JSON.parse(summary.stdout);
  const detailBody = JSON.parse(detail.stdout);
  assert.deepStrictEqual(detailBody.results, summaryBody.results);
  assert.deepStrictEqual(detailBody.total, summaryBody.total);
  assert.deepStrictEqual(detailBody.truncated, summaryBody.truncated);
  assert.deepStrictEqual(detailBody.query, summaryBody.query);

  const limited = runOntologyEntity(cleanRepo, ['--limit', '1']);
  assert.equal(limited.status, 0, limited.stderr);
  const limitedBody = JSON.parse(limited.stdout);
  assert.equal(limitedBody.results.length, 1);
  assert.equal(limitedBody.total, 3);
  assert.equal(limitedBody.truncated, true);
});

test('--warnings 값이 잘못되면 → exit 2와 stderr 설명, stdout 비어 있음', () => {
  const cases = [
    { extra: ['--warnings', 'bogus'], stderr: 'ontology: --warnings must be summary or detail\n' },
    { extra: ['--warnings'], stderr: 'ontology: --warnings requires a value\n' },
    {
      extra: ['--warnings', 'summary', '--warnings', 'detail'],
      stderr: 'ontology: --warnings may be specified only once\n',
    },
  ];
  for (const { extra, stderr } of cases) {
    const result = runOntologyEntity(warningRepo, extra);
    assert.equal(result.status, 2, extra.join(' '));
    assert.equal(result.stdout.length, 0, extra.join(' '));
    assert.equal(result.stderr, stderr, extra.join(' '));
  }
});

test('ontology --help는 → --warnings를 안내한다', () => {
  const { COMMAND_USAGE } = require('../packages/cli/dist/cli-usage');
  const result = spawnSync(process.execPath, [BOUNCER, 'ontology', '--help'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, COMMAND_USAGE.ontology);
  assert.equal(result.stdout.includes('--warnings'), true);
});
