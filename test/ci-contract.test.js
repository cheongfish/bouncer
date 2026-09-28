'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

function gitEnv() {
  const env = { ...process.env };
  // 워크트리에서 돌릴 때 상위 GIT_* 가 fixture 저장소를 가로채지 않게 한다.
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  return env;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() });
}

function runCheckEmit(cwd) {
  return spawnSync(process.execPath, [path.join(root, 'scripts', 'check-emit.js')], {
    cwd,
    encoding: 'utf8',
    env: gitEnv(),
  });
}

/**
 * check-emit 전용 임시 git 저장소를 만든다.
 * 기본은 scripts/lib 를 ignore하고 커밋하지 않는다. 추적 금지 계약의 성공
 * 경로와 같고, lib를 index에 넣으면 강제 추적 실패 경로가 되기 때문이다.
 *
 * @param {string} buildSource - `scripts/write-emit.js`에 쓸 빌드 스크립트 본문
 * @param {{ ignoreLib?: boolean }} [options] - ignoreLib가 false면 gitignore를 생략해 ignore 누락 경로를 재현한다
 * @returns {string} 임시 저장소 절대 경로
 */
function makeEmitRepo(buildSource, { ignoreLib = true } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-check-emit-'));
  git(repo, ['init', '--quiet']);
  git(repo, ['config', 'user.email', 't@example.com']);
  git(repo, ['config', 'user.name', 't']);
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({
    scripts: { build: 'node scripts/write-emit.js' },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, 'scripts', 'write-emit.js'), buildSource);
  // 기본 fixture는 생성물을 커밋하지 않는다. check-emit 계약이 "추적된 emit
  // 최신성"에서 "추적 금지·ignore"로 바뀌었고, lib를 index에 넣으면 성공
  // 경로가 아니라 강제 추적 실패 경로가 된다.
  if (ignoreLib) {
    fs.writeFileSync(path.join(repo, '.gitignore'), 'scripts/lib/\n');
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'init', '--quiet']);
  return repo;
}

const IDENTITY_BUILD = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.mkdirSync(path.join('scripts', 'lib'), { recursive: true });
fs.writeFileSync(path.join('scripts', 'lib', 'app.js'), 'module.exports = 1;\\n');
`;

test('package.json exposes context comment lint and ordered ci', () => {
  const pkg = readJson('package.json');
  assert.match(pkg.scripts['check:emit'], /scripts\/check-emit\.js/);
  assert.match(pkg.scripts['lint:docs'], /scripts\/check-doc-shape\.js/);
  assert.match(pkg.scripts['lint:context-comments'], /scripts\/check-context-comments\.js/);
  const coverage = pkg.scripts['test:coverage'];
  assert.match(coverage, /node --test/);
  assert.match(coverage, /--test-concurrency=1/);
  assert.match(coverage, /--experimental-test-coverage/);
  assert.match(coverage, /--test-coverage-include=scripts\/lib\/\*\*/);
  assert.match(coverage, /--test-coverage-lines=94/);
  assert.match(coverage, /--test-coverage-branches=82/);
  assert.match(coverage, /--test-coverage-functions=96/);
  const ci = pkg.scripts.ci;
  const emitAt = ci.indexOf('check:emit');
  const covAt = ci.indexOf('test:coverage');
  const lintAt = ci.indexOf('npm run lint');
  const lintDocsAt = ci.indexOf('npm run lint:docs');
  const lintCommentsAt = ci.indexOf('npm run lint:context-comments');
  assert.ok(emitAt >= 0, 'ci must run check:emit');
  assert.ok(covAt > emitAt, 'emit check must finish before coverage');
  assert.ok(lintAt >= 0, 'ci must run lint');
  assert.ok(lintDocsAt > lintAt, 'lint:docs must run immediately after lint');
  assert.ok(lintCommentsAt > lintDocsAt, 'context comment lint must run after lint:docs');
  assert.match(ci, /npm run lint && npm run lint:docs && npm run lint:context-comments && npm run typecheck/);
  assert.match(ci, /npm run typecheck/);
  assert.match(ci, /npm audit --audit-level=high/);
});

test('GitHub Actions and GitLab CI share npm ci then npm run ci', () => {
  const gh = yaml.load(read('.github/workflows/test.yml'));
  const gl = yaml.load(read('.gitlab-ci.yml'));
  const ghRuns = gh.jobs.test.steps.filter((s) => s.run).map((s) => String(s.run).trim());
  assert.deepStrictEqual(ghRuns, ['npm ci', 'npm run ci']);
  assert.deepStrictEqual(gl.test.script, ['npm ci', 'npm run ci']);
});

test('check-emit.js inspects tracked and ignored emit via git argv, not porcelain status', () => {
  const src = read('scripts/check-emit.js');
  assert.match(src, /spawnSync|execFile/);
  assert.match(src, /ls-files/);
  assert.match(src, /--others/);
  assert.match(src, /--exclude-standard/);
  assert.doesNotMatch(src, /status --porcelain/);
  assert.doesNotMatch(src, /shell:\s*true/);
});

test('check-emit.js exits 0 on a clean ignored tree after identity build', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 0, r.stderr || r.stdout);
});

test('check-emit.js exits 1 when scripts/lib is force-tracked', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD);
  fs.mkdirSync(path.join(repo, 'scripts', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'scripts', 'lib', 'app.js'), 'module.exports = 1;\n');
  git(repo, ['add', '-f', '--', 'scripts/lib/app.js']);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /must not be tracked/);
});

test('check-emit.js exits 1 when scripts/lib is not ignored', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD, { ignoreLib: false });
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /is not ignored/);
});

test('check-emit.js propagates a failing build exit code', () => {
  const repo = makeEmitRepo(`'use strict';
process.exit(7);
`);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 7);
});

test('graph-exec realHasGraphify reports whether a graphify bin resolves', () => {
  // session-graph 테스트는 hasGraphify 를 주입해서 realHasGraphify 본문이
  // 한 번도 실행되지 않는다. 함수 하한 96%는 이 실제 PATH 판정을 빼면 깨진다.
  const { realHasGraphify } = require('../scripts/lib/graph-exec');
  assert.strictEqual(typeof realHasGraphify(root), 'boolean');
});
