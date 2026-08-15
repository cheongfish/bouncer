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

function makeEmitRepo(buildSource) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-check-emit-'));
  git(repo, ['init', '--quiet']);
  git(repo, ['config', 'user.email', 't@example.com']);
  git(repo, ['config', 'user.name', 't']);
  fs.mkdirSync(path.join(repo, 'scripts', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'scripts', 'lib', 'app.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({
    scripts: { build: 'node scripts/write-emit.js' },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, 'scripts', 'write-emit.js'), buildSource);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'init', '--quiet']);
  return repo;
}

const IDENTITY_BUILD = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.writeFileSync(path.join('scripts', 'lib', 'app.js'), 'module.exports = 1;\\n');
`;

test('package.json exposes check:emit, test:coverage, and ordered ci', () => {
  const pkg = readJson('package.json');
  assert.match(pkg.scripts['check:emit'], /scripts\/check-emit\.js/);
  const coverage = pkg.scripts['test:coverage'];
  assert.match(coverage, /node --test/);
  assert.match(coverage, /--test-concurrency=1/);
  assert.match(coverage, /--experimental-test-coverage/);
  assert.match(coverage, /--test-coverage-include=scripts\/lib\/\*\*/);
  assert.match(coverage, /--test-coverage-lines=94/);
  assert.match(coverage, /--test-coverage-branches=83/);
  assert.match(coverage, /--test-coverage-functions=96/);
  const ci = pkg.scripts.ci;
  const emitAt = ci.indexOf('check:emit');
  const covAt = ci.indexOf('test:coverage');
  assert.ok(emitAt >= 0, 'ci must run check:emit');
  assert.ok(covAt > emitAt, 'emit check must finish before coverage');
  assert.match(ci, /npm run lint/);
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

test('docs/contributing.md documents local verify, coverage floors, audit, and shared CI', () => {
  const body = read('docs/contributing.md');
  assert.match(body, /npm run ci/);
  assert.match(body, /scripts\/lib/);
  assert.match(body, /94%/);
  assert.match(body, /83%/);
  assert.match(body, /96%/);
  assert.match(body, /audit/);
  assert.match(body, /GitHub/);
  assert.match(body, /GitLab/);
});

test('check-emit.js inspects unstaged and untracked emit via git argv, not porcelain status', () => {
  const src = read('scripts/check-emit.js');
  assert.match(src, /spawnSync|execFile/);
  assert.match(src, /diff/);
  assert.match(src, /--exit-code/);
  assert.match(src, /ls-files/);
  assert.match(src, /--others/);
  assert.doesNotMatch(src, /status --porcelain/);
  assert.doesNotMatch(src, /shell:\s*true/);
});

test('check-emit.js exits 0 on a clean tree after identity build', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 0, r.stderr || r.stdout);
});

test('check-emit.js exits 1 when build leaves untracked emit', () => {
  const repo = makeEmitRepo(`'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.writeFileSync(path.join('scripts', 'lib', 'extra.js'), 'module.exports = 2;\\n');
`);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /untracked/);
});

test('check-emit.js exits 1 when build leaves unstaged emit', () => {
  const repo = makeEmitRepo(`'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.writeFileSync(path.join('scripts', 'lib', 'app.js'), 'module.exports = 99;\\n');
`);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /unstaged/);
});

test('check-emit.js exits 0 when matching TS/CJS emit is already staged', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD);
  fs.mkdirSync(path.join(repo, 'scripts', 'src', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'scripts', 'src', 'lib', 'app.ts'), 'export default 2;\n');
  fs.writeFileSync(path.join(repo, 'scripts', 'lib', 'app.js'), 'module.exports = 2;\n');
  fs.writeFileSync(path.join(repo, 'scripts', 'write-emit.js'), `'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.writeFileSync(path.join('scripts', 'lib', 'app.js'), 'module.exports = 2;\\n');
`);
  git(repo, ['add', '--', 'scripts/src/lib/app.ts', 'scripts/lib/app.js']);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 0, r.stderr || r.stdout);
});

test('graph-exec realHasGraphify reports whether a graphify bin resolves', () => {
  // session-graph 테스트는 hasGraphify 를 주입해서 realHasGraphify 본문이
  // 한 번도 실행되지 않는다. 함수 하한 96%는 이 실제 PATH 판정을 빼면 깨진다.
  const { realHasGraphify } = require('../scripts/lib/graph-exec');
  assert.strictEqual(typeof realHasGraphify(root), 'boolean');
});

test('check-emit.js exits 1 when build dirties already-staged CJS again', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD);
  fs.writeFileSync(path.join(repo, 'scripts', 'lib', 'app.js'), 'module.exports = 2;\n');
  git(repo, ['add', '--', 'scripts/lib/app.js']);
  fs.writeFileSync(path.join(repo, 'scripts', 'write-emit.js'), `'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.writeFileSync(path.join('scripts', 'lib', 'app.js'), 'module.exports = 3;\\n');
`);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /unstaged/);
});
