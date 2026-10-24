'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const { buildReleaseTree } = require('../scripts/build-release');
const { resolveSpawn } = require('../scripts/spawn-win');

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
  const call = resolveSpawn(npm, ['pack', '--dry-run', '--json']);
  const result = spawnSync(call.command, call.args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    shell: call.shell,
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

test('(a) fixture tree → matches npm pack list and includes gitignored lib/a.js', () => {
  const { pkg, out } = makeIgnoredLibFixture();
  const result = buildReleaseTree({ root: pkg, outDir: out, deps: { checkVersions: () => {} } });
  assert.strictEqual(result.ok, true);
  assert.ok(fs.existsSync(path.join(out, 'lib', 'a.js')), 'lib/a.js missing from out tree');
  assert.deepStrictEqual(listRelFiles(out), packPaths(pkg));
});

test('(b) non-empty --out → exits 1 and leaves existing files', () => {
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

test('(c) build status 1 → throws and does not create outDir', () => {
  const { pkg } = makeIgnoredLibFixture();
  const outDir = path.join(tmp('bouncer-release-buildfail-'), 'missing');
  assert.throws(
    () => buildReleaseTree({
      root: pkg,
      outDir,
      deps: {
        checkVersions: () => {},
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

test('(g) version check failure → skips build and leaves outDir absent', () => {
  const { pkg } = makeIgnoredLibFixture();
  const outDir = path.join(tmp('bouncer-release-versionfail-'), 'missing');
  let buildCalls = 0;
  assert.throws(
    () => buildReleaseTree({
      root: pkg,
      outDir,
      deps: {
        checkVersions: () => { throw new Error('version drift'); },
        run: (_command, args) => {
          buildCalls += 1;
          return {
            status: 0,
            stdout: args[0] === 'pack' ? '[{"files":[]}]' : '',
            stderr: '',
          };
        },
      },
    }),
    /version drift/,
  );
  assert.strictEqual(buildCalls, 0);
  assert.strictEqual(fs.existsSync(outDir), false);
});

test('(d) real repo tree → matches the plugin pack and excludes runtime files', () => {
  const out = path.join(tmp('bouncer-release-repo-'), 'tree');
  const result = buildReleaseTree({ root, outDir: out });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(listRelFiles(out), packPaths(root));
  assert.ok(fs.existsSync(path.join(out, 'agents', 'bouncer-coordinator.md')));
  assert.equal(fs.existsSync(path.join(out, 'packages', 'cli')), false);
  assert.equal(fs.existsSync(path.join(out, 'scripts', 'lib')), false);
  assert.equal(fs.existsSync(path.join(out, 'node_modules')), false);
});

test('(h) fixture tree → package.json keeps only identity fields', () => {
  const { pkg, out } = makeIgnoredLibFixture();
  buildReleaseTree({ root: pkg, outDir: out, deps: { checkVersions: () => {} } });
  const shipped = JSON.parse(fs.readFileSync(path.join(out, 'package.json'), 'utf8'));
  assert.deepStrictEqual(shipped, { name: 'bouncer-release-fixture', version: '0.0.0', private: true });
});

test('(i) shipped plugin documents → do not point at runtime source paths', () => {
  // 아래 파일은 경로를 설명 예시로만 쓴다(리뷰 fingerprint, task 문서 예시, validator 거절 대상 문자열).
  const examples = new Set([
    'agents/bouncer-reviewer.md',
    'references/review/index.md',
    'references/coordinator-cards/review.md',
    'references/coordinator-cards/final_review.md',
    'references/spec-authoring/review-rounds.md',
    'references/spec-authoring/tasks.md',
    'rules/cli.md',
  ]);
  const internal = /scripts\/(?:lib|src)\/|packages\/cli/;
  const offenders = [];
  for (const dir of ['agents', 'rules', 'references', 'skills']) {
    const base = path.join(root, dir);
    for (const rel of listRelFiles(base)) {
      const key = `${dir}/${rel}`;
      if (!rel.endsWith('.md') || examples.has(key)) continue;
      if (internal.test(fs.readFileSync(path.join(base, rel), 'utf8'))) offenders.push(key);
    }
  }
  assert.deepStrictEqual(offenders, []);
});

test('(e) release.yml → manual dispatch cannot reach publishing', () => {
  const src = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
  const workflow = yaml.load(src);
  assert.deepStrictEqual(workflow.on, { push: { tags: ['bouncer--v*'] }, workflow_dispatch: null });
  assert.ok(workflow.jobs.prepare, 'prepare job missing');
  assert.ok(workflow.jobs.publish, 'tag publish job missing');
  assert.equal([].concat(workflow.jobs.publish.needs)[0], 'prepare');
  assert.match(workflow.jobs.publish.if, /github\.event_name == 'push'/);
  assert.equal(workflow.jobs.prepare.permissions.contents, 'read');
  assert.equal(workflow.jobs.publish.permissions.contents, 'write');
  assert.equal(workflow.jobs.publish.permissions['id-token'], 'write');
  assert.equal(workflow.concurrency.group, 'release');
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const publishRun = workflow.jobs.publish.steps.map((step) => step.run || '').join('\n');
  assert.ok(publishRun.includes('./package.json'), 'root_version must read the root package.json');
  assert.equal(publishRun.includes('packages/cli/package.json'), false);
  assert.ok(workflow.jobs.publish.steps.some((step) => step.uses === 'actions/download-artifact@v4'));
  assert.ok(workflow.jobs.prepare.steps.some((step) => step.uses === 'actions/upload-artifact@v4'));
});
