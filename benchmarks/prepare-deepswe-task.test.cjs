'use strict';

// 이 파일은 docker와 네트워크를 쓰지 않는다(runGit·runDocker는 가짜). 다만 git과 tar는 임시 디렉터리에서 실제로 돌린다:
// 미추적/무시 경로 계산(`ls-files` 무시 규칙)과 untracked.tar 항목 목록이 이 명령의 계약 자체라
// seam으로 대신하면 검사 대상이 사라지기 때문이다.

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  deepsweFixturePaths, loadPrepared, prepareDeepSweTask, readTaskToml, untrackedPaths,
} = require('./prepare-deepswe-task.cjs');

const BASE = 'a'.repeat(40);
const COMMIT = 'b'.repeat(40);
const TASK_TOML = `[metadata]
base_commit_hash = "${BASE}"

[environment]
docker_image = "example/img:1"

[agent]
timeout_sec = 10800

[verifier]
timeout_sec = 1800
`;

function realGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.replace(/\n$/, '');
}

// 커밋 1개, 무시되지 않은 미추적 파일 1개, 무시 파일 1개를 가진 git 저장소.
function makeRepo(dir, branch = 'develop') {
  mkdirSync(dir, { recursive: true });
  realGit(['init', '--quiet', '-b', branch], dir);
  realGit(['config', 'user.email', 't@example.com'], dir);
  realGit(['config', 'user.name', 't'], dir);
  writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n');
  writeFileSync(path.join(dir, 'a.txt'), 'one\n');
  realGit(['add', '.'], dir);
  realGit(['commit', '--quiet', '-m', 'base'], dir);
  mkdirSync(path.join(dir, 'extra'));
  writeFileSync(path.join(dir, 'extra', 'a.txt'), 'x\n');
  mkdirSync(path.join(dir, 'node_modules', 'x'), { recursive: true });
  writeFileSync(path.join(dir, 'node_modules', 'x', 'y.js'), 'y\n');
}

// 주입 의존성 묶음. 기본은 성공 경로이고 사례마다 일부를 덮어쓴다.
function makeEnv(t, overrides = {}) {
  const base = mkdtempSync(path.join(tmpdir(), 'deepswe-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'root');
  const cacheDir = path.join(base, 'cache');
  const tmpDir = path.join(base, 'tmp');
  mkdirSync(root);
  mkdirSync(tmpDir);
  const gitCalls = [];
  const dockerCalls = [];
  const runGit = (args, cwd) => {
    gitCalls.push(args);
    const [command] = args;
    if (command === 'clone' || command === 'fetch') return '';
    if (command === 'archive') {
      if (overrides.archiveFails) throw new Error('fatal: pathspec did not match');
      const stage = path.join(base, 'stage');
      mkdirSync(path.join(stage, 'tasks', 'quill', 'environment'), { recursive: true });
      writeFileSync(path.join(stage, 'tasks', 'quill', 'task.toml'), TASK_TOML);
      const tar = spawnSync('tar', ['-cf', args[args.indexOf('-o') + 1], '-C', stage, 'tasks/quill']);
      assert.equal(tar.status, 0);
      return '';
    }
    if (command === 'rev-parse') return overrides.head ?? BASE;
    if (command === 'symbolic-ref') return 'develop';
    if (command === 'bundle') {
      writeFileSync(args[2], '');
      return '';
    }
    if (command === 'ls-files') return realGit(args, cwd);
    throw new Error(`unexpected git ${command}`);
  };
  const runDocker = (args) => {
    dockerCalls.push(args);
    if (args[0] === 'create') return 'ctr1\n';
    if (args[0] === 'cp') {
      if (overrides.cpFails) throw new Error('docker cp failed');
      makeRepo(args[2]);
      return '';
    }
    if (args[0] === 'image') return 'example/img@sha256:abc\n';
    return '';
  };
  const manifest = overrides.manifest ?? { repo: 'https://example.invalid/r', commit: COMMIT, tasks: { 'deepswe-quill-001': 'quill' } };
  return { deps: { manifest, root, cacheDir, tmpDir, runGit, runDocker }, root, gitCalls, dockerCalls };
}

const fixtureEntries = (root, id) => {
  const dir = path.join(root, 'fixtures', 'deepswe');
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.startsWith(id)) : [];
};

test('task.toml text → baseCommit, dockerImage and both timeouts', () => {
  assert.deepEqual(readTaskToml(TASK_TOML),
    { baseCommit: BASE, dockerImage: 'example/img:1', agentTimeoutSec: 10800, verifierTimeoutSec: 1800 });
});

test('card id given → fixture paths under fixtures/deepswe', () => {
  const paths = deepsweFixturePaths('deepswe-quill-001', '/r');
  assert.deepEqual(paths, {
    dir: '/r/fixtures/deepswe/deepswe-quill-001',
    taskDir: '/r/fixtures/deepswe/deepswe-quill-001/task',
    bundle: '/r/fixtures/deepswe/deepswe-quill-001.bundle',
    untracked: '/r/fixtures/deepswe/deepswe-quill-001/untracked.tar',
    prepared: '/r/fixtures/deepswe/deepswe-quill-001/prepared.json',
  });
});

test('card id missing from the manifest → rejected', (t) => {
  const { deps } = makeEnv(t);
  assert.throws(() => prepareDeepSweTask('deepswe-other-001', deps), /not in benchmarks\/deepswe\/manifest\.json/);
});

test('manifest commit that is not 40 hex → rejected', (t) => {
  const { deps } = makeEnv(t, { manifest: { repo: 'r', commit: 'abc', tasks: { 'deepswe-quill-001': 'quill' } } });
  assert.throws(() => prepareDeepSweTask('deepswe-quill-001', deps), /must be 40 hex characters/);
});

test('task directory missing at the pinned commit → rejected and no partial outputs', (t) => {
  const { deps, root } = makeEnv(t, { archiveFails: true });
  assert.throws(() => prepareDeepSweTask('deepswe-quill-001', deps), /task quill missing at/);
  assert.deepEqual(fixtureEntries(root, 'deepswe-quill-001'), []);
});

test('/app HEAD differs from base_commit_hash → rejected and no partial outputs', (t) => {
  const { deps, root } = makeEnv(t, { head: 'c'.repeat(40) });
  assert.throws(() => prepareDeepSweTask('deepswe-quill-001', deps), /differs from base_commit_hash/);
  assert.deepEqual(fixtureEntries(root, 'deepswe-quill-001'), []);
});

test('docker cp fails → same error propagates and no partial outputs', (t) => {
  const { deps, root, dockerCalls } = makeEnv(t, { cpFails: true });
  assert.throws(() => prepareDeepSweTask('deepswe-quill-001', deps), /docker cp failed/);
  assert.deepEqual(fixtureEntries(root, 'deepswe-quill-001'), []);
  assert.deepEqual(dockerCalls.map((args) => args[0]), ['pull', 'create', 'cp', 'rm']);
});

test('successful prepare → eight prepared.json fields and a bundle made from HEAD and the base branch', (t) => {
  const { deps, root, gitCalls } = makeEnv(t);
  const prepared = prepareDeepSweTask('deepswe-quill-001', deps);
  assert.deepEqual(prepared, {
    card_id: 'deepswe-quill-001',
    task_name: 'quill',
    deepswe_commit: COMMIT,
    docker_image: 'example/img:1',
    image_digest: 'example/img@sha256:abc',
    base_commit: BASE,
    base_branch: 'develop',
    untracked_paths: ['extra/a.txt', 'node_modules/'],
  });
  assert.deepEqual(loadPrepared('deepswe-quill-001', root), prepared);
  const paths = deepsweFixturePaths('deepswe-quill-001', root);
  assert.ok(existsSync(path.join(paths.taskDir, 'task.toml')));
  const bundleCall = gitCalls.find((args) => args[0] === 'bundle');
  assert.deepEqual(bundleCall, ['bundle', 'create', paths.bundle, 'HEAD', 'develop']);
  const listing = spawnSync('tar', ['-tf', paths.untracked], { encoding: 'utf8' }).stdout.split('\n');
  assert.ok(listing.includes('extra/a.txt'));
  assert.ok(listing.includes('node_modules/x/y.js'));
  assert.ok(!listing.some((entry) => entry.startsWith('.git/')));
});

test('prepare → docker runs pull, create, cp, rm, image inspect in order', (t) => {
  const { deps, dockerCalls } = makeEnv(t);
  prepareDeepSweTask('deepswe-quill-001', deps);
  assert.deepEqual(dockerCalls.map((args) => args.slice(0, args[0] === 'image' ? 2 : 1)),
    [['pull'], ['create'], ['cp'], ['rm'], ['image', 'inspect']]);
});

test('unignored and ignored untracked files → files for unignored, folded directory for ignored', (t) => {
  const base = mkdtempSync(path.join(tmpdir(), 'deepswe-paths-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  makeRepo(base);
  assert.deepEqual(untrackedPaths(base, realGit), ['extra/a.txt', 'node_modules/']);
});

test('no prepared.json → loadPrepared returns null', (t) => {
  const { root } = makeEnv(t);
  assert.equal(loadPrepared('deepswe-quill-001', root), null);
});
