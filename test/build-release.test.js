'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { buildReleaseTree } = require('../scripts/build-release');

const root = path.join(__dirname, '..');
const script = path.join(root, 'scripts', 'build-release.js');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const temps = [];

/**
 * 테스트가 만든 임시 디렉터리를 추적한다.
 * after 훅이 일괄 삭제하므로 각 테스트가 실패해도 잔여 트리가 남지 않는다.
 *
 * @param {string} prefix - os.tmpdir() 아래 mkdtemp 접두사
 * @returns {string} 생성된 절대 경로
 */
function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

after(() => {
  for (const dir of temps) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * 디렉터리 아래 파일의 정렬된 posix 상대 경로를 모은다.
 * npm pack files[].path 와 같은 구분자로 맞춰 deepStrictEqual 이 OS 에 흔들리지 않게 한다.
 *
 * @param {string} dir - 산출 트리 절대 경로
 * @returns {string[]} 정렬된 상대 경로
 */
function listRelFiles(dir) {
  const out = [];
  /**
   * @param {string} current - 현재 순회 절대 경로
   * @returns {void}
   */
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  }
  walk(dir);
  return out.sort();
}

/**
 * fixture 패키지에서 npm pack --dry-run --json 의 files[].path 정렬 목록을 읽는다.
 * 판정은 pack 목록만 신뢰한다 — 테스트가 별도 allowlist 를 만들지 않기 위함.
 *
 * @param {string} cwd - 패키지 루트
 * @returns {string[]} 정렬된 pack 상대 경로
 */
function packPaths(cwd) {
  const result = spawnSync(npm, ['pack', '--dry-run', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout)[0].files.map((file) => file.path).sort();
}

/**
 * files: ["lib/"] 이고 .gitignore 가 lib/ 인 최소 패키지를 만든다.
 * 루트 ignore 가 files 필드를 덮지 않는다는 npm 전제를 이 fixture 가 고정한다.
 *
 * @returns {{pkg: string, out: string}} fixture 루트와 비어 있는 산출 디렉터리
 */
function makeIgnoredLibFixture() {
  const pkg = tmp('bouncer-release-fixture-');
  fs.writeFileSync(path.join(pkg, 'package.json'), `${JSON.stringify({
    name: 'bouncer-release-fixture',
    version: '0.0.0',
    private: true,
    files: ['lib/'],
    scripts: { build: 'node ./write-lib.js' },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(pkg, '.gitignore'), 'lib/\n');
  fs.writeFileSync(path.join(pkg, 'write-lib.js'), `'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.mkdirSync(path.join(__dirname, 'lib'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'lib', 'a.js'), 'module.exports = 1;\\n');
`);
  return { pkg, out: path.join(tmp('bouncer-release-out-'), 'tree') };
}

test('(a) fixture tree matches npm pack list and includes gitignored lib/a.js', () => {
  const { pkg, out } = makeIgnoredLibFixture();
  const result = buildReleaseTree({ root: pkg, outDir: out });
  assert.strictEqual(result.ok, true);
  assert.ok(fs.existsSync(path.join(out, 'lib', 'a.js')), 'lib/a.js missing from out tree');
  assert.deepStrictEqual(listRelFiles(out), packPaths(pkg));
});

test('(b) non-empty --out exits 1 and leaves existing files', () => {
  const out = tmp('bouncer-release- nonempty-');
  const keep = path.join(out, 'keep.txt');
  fs.writeFileSync(keep, 'keep\n');
  const spawned = spawnSync(process.execPath, [script, '--out', out], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.strictEqual(spawned.status, 1, spawned.stderr || spawned.stdout);
  assert.strictEqual(fs.readFileSync(keep, 'utf8'), 'keep\n');
  assert.deepStrictEqual(fs.readdirSync(out), ['keep.txt']);
});

test('(c) build status 1 throws and does not create outDir', () => {
  const { pkg } = makeIgnoredLibFixture();
  const outDir = path.join(tmp('bouncer-release-buildfail-'), 'missing');
  assert.throws(
    () => buildReleaseTree({
      root: pkg,
      outDir,
      deps: {
        run: (_command, args) => {
          if (args[0] === 'run' && args[1] === 'build') {
            return { status: 1, stdout: '', stderr: 'build failed' };
          }
          return { status: 0, stdout: '[]', stderr: '' };
        },
      },
    }),
    (err) => err instanceof Error && /build/i.test(err.message),
  );
  assert.equal(fs.existsSync(outDir), false);
});

test('(d) real repo tree matches pack list, ships lib, has no node_modules, --help exits 0', () => {
  const out = path.join(tmp('bouncer-release-repo-'), 'tree');
  const result = buildReleaseTree({ root, outDir: out });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(listRelFiles(out), packPaths(root));
  for (const rel of [
    path.join('scripts', 'lib', 'cli.js'),
    path.join('scripts', 'lib', 'commit-hook.js'),
    path.join('scripts', 'lib', 'session-graph.js'),
  ]) {
    assert.ok(fs.existsSync(path.join(out, rel)), `missing ${rel}`);
  }
  assert.equal(fs.existsSync(path.join(out, 'node_modules')), false);
  const help = spawnSync(process.execPath, [path.join(out, 'scripts', 'bouncer'), '--help'], {
    env: { ...process.env, BOUNCER_HOME: out },
    encoding: 'utf8',
  });
  assert.strictEqual(help.status, 0, help.stderr || help.stdout);
});

test('(e) release.yml declares tag and develop-only dispatch contracts', () => {
  const src = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.match(src, /bouncer--v\*/);
  assert.match(src, /workflow_dispatch/);
  assert.match(src, /github\.ref == 'refs\/heads\/develop'/);
  const ciAt = src.indexOf('npm run ci');
  const buildAt = src.indexOf('build-release.js');
  const fetchAt = src.indexOf('git fetch --no-tags origin release');
  const commitAt = src.search(/git(?:\s+-C\s+\S+)?\s+commit\b/);
  assert.ok(ciAt >= 0, 'npm run ci missing');
  assert.ok(buildAt > ciAt, 'npm run ci must run before build-release.js');
  assert.ok(fetchAt >= 0, 'git fetch --no-tags origin release missing');
  assert.ok(commitAt > fetchAt, 'fetch must run before the commit step');
  assert.match(src, /HEAD:refs\/heads\/release/);
  assert.doesNotMatch(src, /--force/);
  // Publish run: 안에 ${{ github.* }} 를 두면 태그 이름(bouncer--v*)의 셸
  // 메타문자가 contents: write job 에 주입된다. env: 로 넘긴 뒤 셸이
  // 확장해야 하고, 표현식은 run: 스크립트 밖에만 둔다.
  const publishStart = src.indexOf('name: Publish release branch');
  assert.ok(publishStart >= 0, 'Publish release branch step missing');
  const publishTail = src.slice(publishStart);
  const runMatch = publishTail.match(/\n[ \t]+run:\s*\|[ \t]*\n([\s\S]*)/);
  assert.ok(runMatch, 'Publish run script missing');
  const publishRun = runMatch[1];
  assert.doesNotMatch(publishRun, /\$\{\{\s*github\./);
  assert.match(publishTail.slice(0, runMatch.index), /\$\{\{\s*github\.ref_name\s*\}\}/);
  assert.match(publishRun, /release: \$\{?[A-Z_][A-Z0-9_]*\}? \(\$\{?short_sha\}?\)/);
});

test('(f) install.md documents clone -b release and develop workflow_dispatch', () => {
  const src = fs.readFileSync(path.join(root, 'docs', 'install.md'), 'utf8');
  assert.match(src, /git clone -b release/);
  assert.match(src, /gh workflow run release.yml --ref develop/);
});
