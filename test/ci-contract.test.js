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
 * 기본은 packages/cli/dist 를 ignore하고 커밋하지 않는다. 추적 금지 계약의 성공
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
    fs.writeFileSync(path.join(repo, '.gitignore'), 'packages/cli/dist/\n');
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'init', '--quiet']);
  return repo;
}

const IDENTITY_BUILD = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
fs.mkdirSync(path.join('packages', 'cli', 'dist'), { recursive: true });
fs.writeFileSync(path.join('packages', 'cli', 'dist', 'app.js'), 'module.exports = 1;\\n');
`;

// ci 스크립트가 지켜야 할 단계 순서. emit 검사가 coverage보다 먼저 끝나야 생성본 기준이
// 맞고, lint:test-names는 typecheck 뒤·audit 앞에 둔다.
const CI_STEP_ORDER = [
  'check:emit',
  'check:versions',
  'test:coverage',
  'test:unit',
  'lint',
  'lint:docs',
  'lint:context-comments',
  'typecheck',
  'lint:test-names',
  'npm audit',
];

/**
 * `ci` 스크립트를 ` && ` 기준 단계 토큰으로 나눈다.
 * `&&`로 나눌 수 없는 항목(`;`, `||` 등)은 그대로 한 토큰으로 남아, 순서 단언이
 * 그 단계를 찾지 못해 실패하게 둔다.
 *
 * @param {string} script - package.json의 `ci` 스크립트 본문
 * @returns {string[]} 앞뒤 공백을 지운 단계 토큰 배열
 */
function parseCiSteps(script) {
  return script.split('&&').map((token) => token.trim());
}

/**
 * 단계 이름과 정확히 일치하는 토큰의 위치를 찾는다.
 * `npm run ` 접두를 뗀 값이 이름과 같아야 하므로 `lint`와 `lint:docs`가 섞이지 않는다.
 * `npm audit`만은 인자(`--audit-level=...`)가 붙으므로 접두 일치로 본다.
 *
 * @param {string[]} steps - parseCiSteps 결과
 * @param {string} name - 찾을 단계 이름(`lint:docs`) 또는 `npm audit`
 * @returns {number} 첫 일치 위치. 없으면 -1
 */
function stepIndex(steps, name) {
  if (name === 'npm audit') return steps.findIndex((token) => token.startsWith('npm audit'));
  return steps.findIndex((token) => token.replace(/^npm run /, '') === name);
}

test('package.json → exposes context comment lint and ordered ci', () => {
  const pkg = readJson('package.json');
  assert.match(pkg.scripts['check:emit'], /scripts\/check-emit\.js/);
  assert.match(pkg.scripts['check:versions'], /scripts\/sync-versions\.js --check/);
  assert.match(pkg.scripts['sync:versions'], /scripts\/sync-versions\.js --write/);
  assert.match(pkg.scripts['lint:docs'], /scripts\/check-doc-shape\.js/);
  assert.match(pkg.scripts['lint:context-comments'], /scripts\/check-context-comments\.js/);
  assert.strictEqual(pkg.scripts.test, 'node --test test/*.test.js');
  const coverage = pkg.scripts['test:coverage'];
  assert.match(coverage, /node --test/);
  assert.match(coverage, /test\/\*\.test\.js/);
  assert.doesNotMatch(coverage, /--test-concurrency=1/);
  assert.strictEqual(pkg.scripts['test:unit'], 'node scripts/test-tier.js unit');
  assert.strictEqual(pkg.scripts['test:integration'], 'node scripts/test-tier.js integration');
  assert.match(coverage, /--experimental-test-coverage/);
  assert.match(coverage, /--test-coverage-include=packages\/cli\/dist\/\*\*/);
  assert.match(coverage, /--test-coverage-lines=94/);
  assert.match(coverage, /--test-coverage-branches=82/);
  assert.match(coverage, /--test-coverage-functions=96/);
  // 전체 문자열 일치 대신 단계 토큰의 존재와 순서만 고정한다. 인자·공백이 바뀌어도
  // 순서가 지켜지면 통과하고, 단계가 빠지거나 뒤바뀌면 그 단계 이름으로 실패한다.
  const steps = parseCiSteps(pkg.scripts.ci);
  const order = CI_STEP_ORDER.map((name) => {
    const at = stepIndex(steps, name);
    assert.ok(at >= 0, `ci must run ${name} (steps: ${JSON.stringify(steps)})`);
    return at;
  });
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(
      order[i] > order[i - 1],
      `${CI_STEP_ORDER[i]} must run after ${CI_STEP_ORDER[i - 1]} (steps: ${JSON.stringify(steps)})`,
    );
  }
});

test('GitHub Actions and GitLab CI → share npm ci then npm run ci', () => {
  const gh = yaml.load(read('.github/workflows/test.yml'));
  const gl = yaml.load(read('.gitlab-ci.yml'));
  const ghRuns = gh.jobs.test.steps.filter((s) => s.run).map((s) => String(s.run).trim());
  assert.deepStrictEqual(ghRuns, ['npm ci', 'npm run ci']);
  assert.deepStrictEqual(gl.test.script, ['npm ci', 'npm run ci']);
});

// shell 사용 여부는 실행 경계 속성이라 동작 fixture로 관측하기 어렵다. 그래서 이 한 단언만
// 의도적으로 소스 텍스트를 본다. Git 인자 선택은 아래 동작 fixture가 지킨다.
test('check-emit.js source → never spawns through a shell', () => {
  assert.doesNotMatch(read('scripts/check-emit.js'), /shell\s*:\s*true/);
});

// porcelain status 전체를 보는 구현은 emit과 무관한 수정 파일에도 실패한다.
// emit 경로만 보는 계약이면 관련 없는 변경이 있어도 깨끗한 emit은 통과해야 한다.
test('check-emit.js with an unrelated modified file and clean emit → exits 0', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD);
  fs.writeFileSync(path.join(repo, 'notes.txt'), 'v1\n');
  git(repo, ['add', '--', 'notes.txt']);
  git(repo, ['commit', '-m', 'notes', '--quiet']);
  fs.writeFileSync(path.join(repo, 'notes.txt'), 'v2\n');
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 0, r.stderr || r.stdout);
});

test('check-emit.js on a clean ignored tree after identity build → exits 0', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 0, r.stderr || r.stdout);
});

test('check-emit.js when packages/cli/dist is force-tracked → exits 1', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD);
  fs.mkdirSync(path.join(repo, 'packages', 'cli', 'dist'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'packages', 'cli', 'dist', 'app.js'), 'module.exports = 1;\n');
  git(repo, ['add', '-f', '--', 'packages/cli/dist/app.js']);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /must not be tracked/);
});

test('check-emit.js when packages/cli/dist is not ignored → exits 1', () => {
  const repo = makeEmitRepo(IDENTITY_BUILD, { ignoreLib: false });
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /is not ignored/);
});

test('check-emit.js with a failing build → propagates the build exit code', () => {
  const repo = makeEmitRepo(`'use strict';
process.exit(7);
`);
  const r = runCheckEmit(repo);
  assert.strictEqual(r.status, 7);
});

test('graph-exec realHasGraphify → reports whether a graphify bin resolves', () => {
  // session-graph 테스트는 hasGraphify 를 주입해서 realHasGraphify 본문이
  // 한 번도 실행되지 않는다. 함수 하한 96%는 이 실제 PATH 판정을 빼면 깨진다.
  const { realHasGraphify } = require('../packages/cli/dist/graph-exec');
  assert.strictEqual(typeof realHasGraphify(root), 'boolean');
});
