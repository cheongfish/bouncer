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

let fixtureRepo = null;
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
  epipeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-ontology-epipe-'));
});

test.after(() => {
  if (fixtureRepo) fs.rmSync(fixtureRepo, { recursive: true, force: true });
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
