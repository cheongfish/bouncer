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

test('tracked active surfaces reject runtime memory tokens outside the explicit evidence allowlist', () => {
  // 역사 문서와 하위 호환 회귀 test만 파일별 기대 출현 수를 고정한다.
  // 파일만 허용하지 않고 count도 대조해 새 토큰이 숨지 못하게 한다.
  const allowed = new Map([
    ['docs/distill-decommission-audit.md', { count: 22, kind: 'historical-removal-audit' }],
    ['docs/context-search-benchmark.md', { count: 1, kind: 'cutover-evidence' }],
    ['test/cli-help.test.js', { count: 1, kind: 'legacy-compatibility-regression' }],
    ['test/cli-project-commands.test.js', { count: 2, kind: 'legacy-compatibility-regression' }],
    ['test/commit-guard.test.js', { count: 6, kind: 'legacy-compatibility-regression' }],
    ['test/context-corpus-search.test.js', { count: 9, kind: 'historical-corpus-and-cutover-evidence' }],
    ['test/context-digest.test.js', { count: 38, kind: 'legacy-compatibility-regression' }],
    ['test/distill-decommission-audit.test.js', { count: 102, kind: 'historical-removal-audit' }],
    ['test/finalize-pure.test.js', { count: 3, kind: 'legacy-compatibility-regression' }],
    ['test/finalize.test.js', { count: 28, kind: 'legacy-compatibility-regression' }],
    ['test/graph-search.test.js', { count: 1, kind: 'legacy-compatibility-regression' }],
    ['test/graphify.test.js', { count: 16, kind: 'legacy-compatibility-regression' }],
    ['test/init.test.js', { count: 32, kind: 'legacy-compatibility-regression' }],
    ['test/lightweight-cycle.test.js', { count: 1, kind: 'legacy-compatibility-regression' }],
    ['test/master-rules.test.js', { count: 5, kind: 'legacy-compatibility-regression' }],
    ['test/seed-worktree.test.js', { count: 9, kind: 'legacy-compatibility-regression' }],
    ['test/session-graph.test.js', { count: 4, kind: 'legacy-compatibility-regression' }],
    ['test/skill-bouncer-execute.test.js', { count: 1, kind: 'legacy-compatibility-regression' }],
    ['test/skill-bouncer-finalize.test.js', { count: 2, kind: 'legacy-compatibility-regression' }],
    ['test/skill-bouncer-plan.test.js', { count: 6, kind: 'legacy-compatibility-regression' }],
    ['test/skill-bouncer-surface.test.js', { count: 1, kind: 'legacy-compatibility-regression' }],
    ['test/skill-discovery.test.js', { count: 1, kind: 'legacy-compatibility-regression' }],
    ['test/skill-minimality.test.js', { count: 2, kind: 'legacy-compatibility-regression' }],
    ['test/skill-spec-authoring.test.js', { count: 1, kind: 'legacy-compatibility-regression' }],
    ['test/trust-boundary.test.js', { count: 1, kind: 'legacy-compatibility-regression' }],
    ['test/validate-gates.test.js', { count: 4, kind: 'legacy-compatibility-regression' }],
    ['test/fixtures/context-corpus-queries.json', { count: 12, kind: 'historical-corpus-and-cutover-evidence' }],
    ['test/fixtures/graph-search-quality.json', { count: 2, kind: 'historical-corpus-identity' }],
  ]);
  const scanned = git(root, [
    'ls-files', '--', 'README.md', 'CLAUDE.md', '.codex/agents', 'agents', 'docs',
    'references', 'rules', 'scripts/src', 'scripts/lib', 'skills', 'test',
  ]).trim().split('\n').filter(Boolean);
  if (!scanned.includes('docs/context-search-benchmark.md')) {
    scanned.push('docs/context-search-benchmark.md');
  }
  const seenAllowed = new Set();
  const unexpected = [];
  for (const rel of scanned) {
    if (rel === 'test/ci-contract.test.js' || !fs.existsSync(path.join(root, rel))) continue;
    const hits = [...read(rel).matchAll(/distill/gi)].length;
    if (hits === 0) continue;
    const entry = allowed.get(rel);
    if (!entry || hits !== entry.count || !entry.kind) {
      unexpected.push(`${rel}: ${hits}`);
      continue;
    }
    seenAllowed.add(rel);
  }
  assert.deepStrictEqual(unexpected, []);
  assert.deepStrictEqual([...seenAllowed].sort(), [...allowed.keys()].sort());

  for (const rel of [
    '.bouncer/Distill.md',
    '.bouncer/distill/build-ts.md', '.bouncer/distill/context-layout.md',
    '.bouncer/distill/core.md', '.bouncer/distill/git-worktree.md',
    '.bouncer/distill/graph.md', '.bouncer/distill/plugin-skills.md',
    '.bouncer/distill/validate-gates.md',
    'skills/bouncer-plan/references/distill-preflight.md',
    'skills/bouncer-finalize/references/distill-promotion.md',
  ]) {
    assert.equal(fs.existsSync(path.join(root, rel)), false, `${rel} must be removed`);
  }
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
