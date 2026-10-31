'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  computeComplexitySignals, classifyRoutingPaths, collectModules, isSourcePath, singleVerdict, strongCauses,
} = require('../packages/cli/dist/complexity-signals');
const {
  readComplexityPolicy, DEFAULT_COMPLEXITY_POLICY, DEFAULT_RISK_PATHS, DEFAULT_GENERATED_PATHS,
} = require('../packages/cli/dist/config');

const POLICY = DEFAULT_COMPLEXITY_POLICY;
const DIST = path.join(__dirname, '..', 'packages', 'cli', 'dist');

function compute(files, extra = {}) {
  return computeComplexitySignals({ files, policy: POLICY, ...extra });
}
function f(p, lines) {
  return lines === undefined ? { path: p } : { path: p, lines };
}
function tmpRepo(config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'complexity-policy-'));
  fs.mkdirSync(path.join(root, '.bouncer'));
  if (config !== undefined) {
    fs.writeFileSync(path.join(root, '.bouncer', 'config.json'),
      typeof config === 'string' ? config : JSON.stringify(config));
  }
  return root;
}
function policyOf(complexity) {
  return readComplexityPolicy(tmpRepo({ complexity }));
}

// --- 신호 계산 ---

test('signals with source, test, docs and generated files → counts only source files and lines', () => {
  const signals = compute([
    f('packages/cli/src/a.ts', 10), f('packages/web/src/b.ts', 5), f('test/a.test.js', 40),
    f('docs/x.md', 3), f('scripts/lib/a.js', 99),
  ]);
  assert.strictEqual(signals.totalFiles, 4);
  assert.strictEqual(signals.sourceFiles, 2);
  assert.strictEqual(signals.sourceLines, 15);
  assert.deepStrictEqual(signals.modules, ['packages/cli', 'packages/web']);
  assert.deepStrictEqual(signals.riskPaths, []);
});

test('signals with generated paths → counted for risk only', () => {
  const signals = compute([f('scripts/lib/commit-guard.js', 7)]);
  assert.strictEqual(signals.totalFiles, 0);
  assert.strictEqual(signals.sourceFiles, 0);
  assert.deepStrictEqual(signals.riskPaths, [{ path: 'scripts/lib/commit-guard.js', kind: 'repo' }]);
});

test('signals with .bouncer/context plan docs → count total files only', () => {
  const signals = compute([f('.bouncer/context/epics/e/tasks/001/tasks.md')]);
  assert.strictEqual(signals.totalFiles, 1);
  assert.strictEqual(signals.sourceFiles, 0);
  assert.strictEqual(signals.sourceLines, 0);
  assert.deepStrictEqual(signals.modules, []);
});

test('signals with backslash and ./ paths → normalizes risk paths', () => {
  assert.strictEqual(compute([f('src\\commit-guard.ts')]).riskPaths[0].path, 'src/commit-guard.ts');
  assert.strictEqual(compute([f('./AGENTS.md')]).riskPaths[0].path, 'AGENTS.md');
  assert.strictEqual(compute([f('././AGENTS.md')]).riskPaths[0].path, 'AGENTS.md');
});

test('signals with non-string or empty paths → ignores them', () => {
  const signals = compute([{ path: 5 }, { path: '' }, { path: null }, {}, f('src/a.ts', 1)]);
  assert.strictEqual(signals.totalFiles, 1);
  assert.strictEqual(signals.sourceLines, 1);
});

test('signals lines → distinguishes absent, invalid and partial lines', () => {
  assert.strictEqual(compute([]).sourceLines, 0);
  assert.strictEqual(compute([f('src/a.ts')]).sourceLines, null);
  assert.strictEqual(compute([f('test/a.test.js')]).sourceLines, 0);
  assert.strictEqual(compute([f('src/a.ts', 5), f('src/b.ts')]).sourceLines, null);
  assert.strictEqual(compute([f('src/a.ts', 5), f('src/b.ts', -3), f('src/c.ts', 1.5)]).sourceLines, 5);
  assert.strictEqual(compute([f('src/a.ts', NaN)]).sourceLines, 0);
});

test('isSourcePath boundaries → matches the table', () => {
  const source = [
    'src/a.ts', 'packages/cli/src/a.ts', 'rules/cli.md', 'package.json', 'config.example.json',
    '.bouncer/config.json', 'packages/cli/src/test/a.ts', 'src/docs/a.ts', 'Test/a.ts', 'src/test.js',
    'src/latest.js', 'src/readme-parser.ts',
  ];
  const nonSource = [
    'test/helpers/x.js', 'tests/a.js', 'docs/x.md', 'packages/cli/test/a.js', 'packages/cli/docs/x.md',
    '.bouncer/context/epics/e/index.md', 'a.test.js', 'src/a.spec.ts', 'src/a.test.d.ts', 'README.md',
    'readme.txt', 'packages/cli/README', 'CHANGELOG.md', 'changelog.md',
  ];
  for (const p of source) assert.strictEqual(isSourcePath(p), true, p);
  for (const p of nonSource) assert.strictEqual(isSourcePath(p), false, p);
});

test('collectModules boundaries → matches the examples', () => {
  assert.deepStrictEqual(collectModules(['packages/cli/src/a.ts']), ['packages/cli']);
  assert.deepStrictEqual(collectModules(['packages/foo.ts']), ['packages']);
  assert.deepStrictEqual(collectModules(['src/a.ts', 'src/b.ts']), ['src']);
  assert.deepStrictEqual(collectModules(['.bouncer/config.json', 'package.json']), []);
  assert.deepStrictEqual(collectModules(['.github/workflows/ci.yml']), ['.github']);
  assert.deepStrictEqual(collectModules(['test/a.js', 'docs/x.md', 'src/z.ts', 'lib/y.ts']), ['lib', 'src']);
  assert.deepStrictEqual(collectModules(['scripts/lib/a.js'], ['scripts/lib/']), []);
});

test('signals driveShape values → map to serial true, false or null', () => {
  assert.strictEqual(compute([], { driveShape: 'serial' }).serial, true);
  assert.strictEqual(compute([], { driveShape: 'parallel' }).serial, false);
  assert.strictEqual(compute([], { driveShape: 'mixed' }).serial, false);
  assert.strictEqual(compute([], { driveShape: 'unknown' }).serial, null);
  assert.strictEqual(compute([], { driveShape: undefined }).serial, null);
  assert.strictEqual(compute([], { driveShape: null }).serial, null);
});

test('generated-only input → single verdict with zero counts', () => {
  const signals = compute([f('.codex/agents/a.toml')]);
  assert.strictEqual(signals.totalFiles, 0);
  assert.strictEqual(signals.sourceFiles, 0);
  assert.strictEqual(signals.sourceLines, 0);
  assert.deepStrictEqual(singleVerdict(signals, POLICY, []), {
    single: true, reasons: ['source files 0 <= 2, source lines 0 <= 200, no risk signal'],
  });
  assert.deepStrictEqual(strongCauses(signals, POLICY, { riskFlags: [], complexity: null }), []);
});

test('generated_paths empty → the same file counts as a source file', () => {
  const policy = { ...POLICY, generatedPaths: [] };
  const signals = computeComplexitySignals({ files: [f('.codex/agents/a.toml', 1)], policy });
  assert.strictEqual(signals.sourceFiles, 1);
  assert.strictEqual(signals.totalFiles, 1);
});

// --- 위험 경로 ---

test('default risk patterns → tag repo paths and respect precedence', () => {
  const repoPaths = [
    'packages/cli/src/commit-guard.ts', 'test/commit-guard.test.js', 'AGENTS.md', 'docs/AGENTS.md',
    'hooks/hooks.json', 'plugins/x/hooks/run.sh', 'rules/acq-gates.json',
  ];
  for (const p of repoPaths) {
    assert.deepStrictEqual(compute([f(p, 1)]).riskPaths, [{ path: p, kind: 'repo' }], p);
  }
  assert.deepStrictEqual(compute([f('rules/other.json'), f('my-commit-guard.ts')]).riskPaths, []);
  assert.deepStrictEqual(compute([f('src/auth/session.ts')]).riskPaths, [{ path: 'src/auth/session.ts', kind: 'security' }]);
});

test('classifyRoutingPaths without repo patterns → applies no default list', () => {
  assert.deepStrictEqual(classifyRoutingPaths(['AGENTS.md', 'hooks/a.sh']), []);
  assert.deepStrictEqual(classifyRoutingPaths(['AGENTS.md'], ['AGENTS.md']), [{ path: 'AGENTS.md', kind: 'repo' }]);
});

test('risk pattern shapes → match basename, directory or exact path', () => {
  const hit = (pattern, p) => classifyRoutingPaths([p], [pattern]).length === 1;
  assert.ok(hit('commit-guard*', 'commit-guard.ts'));
  assert.ok(hit('commit-guard*', 'test/commit-guard.test.js'));
  assert.ok(!hit('commit-guard*', 'my-commit-guard.ts'));
  assert.ok(hit('AGENTS.md', 'docs/AGENTS.md'));
  assert.ok(hit('*.pem', 'certs/a.pem'));
  assert.ok(hit('hooks/', 'hooks/a.sh'));
  assert.ok(hit('hooks/', 'x/hooks/a.sh'));
  assert.ok(!hit('hooks/', 'hooks.md'));
  assert.ok(!hit('hooks/', 'src/hooks'));
  assert.ok(!hit('hooks/', 'src/hooksx/a.sh'));
  assert.ok(hit('src/payments/', 'src/payments/a.ts'));
  assert.ok(hit('src/payments/', 'app/src/payments/a.ts'));
  assert.ok(!hit('src/payments/', 'src/payments.ts'));
  assert.ok(!hit('src/payments/', 'src/a/payments/b.ts'));
  assert.ok(hit('rules/acq-gates.json', 'rules/acq-gates.json'));
  assert.ok(!hit('rules/acq-gates.json', 'rules/other.json'));
  assert.ok(!hit('AGENTS.md', 'agents.md'));
});

// --- 문턱 판정 ---

function sourceFiles(n, lines = 1) {
  return Array.from({ length: n }, (_v, i) => f(`src/f${i}.ts`, lines));
}

test('single verdict boundaries → 2 files and 200 lines stay single, 3 files or 201 lines do not', () => {
  const two = compute([f('src/a.ts', 100), f('src/b.ts', 100)]);
  assert.deepStrictEqual(singleVerdict(two, POLICY, []), {
    single: true, reasons: ['source files 2 <= 2, source lines 200 <= 200, no risk signal'],
  });
  const three = compute(sourceFiles(3));
  assert.deepStrictEqual(singleVerdict(three, POLICY, []), { single: false, reasons: ['source files 3 > 2'] });
  const lines = compute([f('src/a.ts', 201)]);
  assert.deepStrictEqual(singleVerdict(lines, POLICY, []), { single: false, reasons: ['source lines 201 > 200'] });
  const unknown = compute([f('src/a.ts')]);
  assert.deepStrictEqual(singleVerdict(unknown, POLICY, []), { single: false, reasons: ['source lines unknown'] });
});

test('single verdict with risk signals → lists review_risk and risk path reasons in order', () => {
  const signals = compute([f('src/a.ts', 1), f('AGENTS.md', 1), f('hooks/a.sh', 1), f('x/commit-hook.ts', 1)]);
  const verdict = singleVerdict(signals, POLICY, ['public_interface']);
  assert.strictEqual(verdict.single, false);
  assert.deepStrictEqual(verdict.reasons, [
    'source files 4 > 2', 'review_risk public_interface', 'risk path AGENTS.md', 'risk path hooks/a.sh',
    'risk path x/commit-hook.ts',
  ]);
});

test('strong causes size boundaries → 8 source files, 4 modules and 11 total files trigger', () => {
  assert.deepStrictEqual(strongCauses(compute(sourceFiles(7)), POLICY, { riskFlags: [] }), []);
  assert.deepStrictEqual(strongCauses(compute(sourceFiles(8)), POLICY, { riskFlags: [] }), ['source files 8 >= 8']);
  const modules = (n) => compute(Array.from({ length: n }, (_v, i) => f(`m${i}/a.ts`, 1)));
  assert.deepStrictEqual(strongCauses(modules(3), POLICY, { riskFlags: [] }), []);
  assert.deepStrictEqual(strongCauses(modules(4), POLICY, { riskFlags: [] }), ['modules 4 >= 4']);
  const tests = (n) => compute(Array.from({ length: n }, (_v, i) => f(`test/t${i}.test.js`, 1)));
  assert.deepStrictEqual(strongCauses(tests(10), POLICY, { riskFlags: [] }), []);
  assert.deepStrictEqual(strongCauses(tests(11), POLICY, { riskFlags: [] }), ['total files 11 >= 11']);
});

test('strong causes with every signal → orders review_risk, risk path, then size', () => {
  const files = [
    ...Array.from({ length: 5 }, (_v, i) => f(`m${i}/commit-guard.ts`, 1)),
    ...Array.from({ length: 6 }, (_v, i) => f(`m0/s${i}.ts`, 1)),
  ];
  const causes = strongCauses(compute(files), POLICY, { riskFlags: ['a', 'b'], complexity: 'standard' });
  assert.deepStrictEqual(causes, [
    'review_risk a, b',
    'risk path m0/commit-guard.ts', 'risk path m1/commit-guard.ts', 'risk path m2/commit-guard.ts',
    'risk path +2 more',
    'source files 11 >= 8', 'modules 5 >= 4', 'total files 11 >= 11',
  ]);
});

test('strong causes with complexity low → skips size conditions and keeps risk conditions', () => {
  const big = compute([...sourceFiles(12), f('AGENTS.md', 1)]);
  assert.deepStrictEqual(strongCauses(big, POLICY, { riskFlags: ['x'], complexity: 'low' }), [
    'review_risk x', 'risk path AGENTS.md',
  ]);
  assert.deepStrictEqual(strongCauses(compute(sourceFiles(12)), POLICY, { riskFlags: [], complexity: 'low' }), []);
});

test('custom policy thresholds → drive the verdicts', () => {
  const policy = { ...POLICY, singleMaxSourceFiles: 5, strongMinSourceFiles: 2 };
  const signals = computeComplexitySignals({ files: sourceFiles(3), policy });
  assert.strictEqual(singleVerdict(signals, policy, []).single, true);
  assert.deepStrictEqual(strongCauses(signals, policy, { riskFlags: [] }), ['source files 3 >= 2']);
});

// --- 경계: 모듈 의존 ---

test('compiled modules → keep node:path as the only runtime require and config free of signals', () => {
  const signalsJs = fs.readFileSync(path.join(DIST, 'complexity-signals.js'), 'utf8');
  const targets = [...signalsJs.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  assert.deepStrictEqual([...new Set(targets)], ['node:path']);
  assert.ok(!fs.readFileSync(path.join(DIST, 'config.js'), 'utf8').includes('complexity-signals'));
});

test('default policy → feeds every signal function unchanged', () => {
  const signals = computeComplexitySignals({ files: [f('src/a.ts', 3)], policy: DEFAULT_COMPLEXITY_POLICY });
  assert.strictEqual(singleVerdict(signals, DEFAULT_COMPLEXITY_POLICY, []).single, true);
  assert.deepStrictEqual(strongCauses(signals, DEFAULT_COMPLEXITY_POLICY, { riskFlags: [] }), []);
  assert.deepStrictEqual(DEFAULT_COMPLEXITY_POLICY.riskPaths, [...DEFAULT_RISK_PATHS]);
  assert.deepStrictEqual(DEFAULT_COMPLEXITY_POLICY.generatedPaths, [...DEFAULT_GENERATED_PATHS]);
});

// --- 판독기 ---

test('readComplexityPolicy with a missing file or key → returns the default policy', () => {
  assert.deepStrictEqual(readComplexityPolicy(tmpRepo()), { ok: true, policy: { ...DEFAULT_COMPLEXITY_POLICY } });
  assert.deepStrictEqual(readComplexityPolicy(tmpRepo({ verify: 'x' })), {
    ok: true, policy: { ...DEFAULT_COMPLEXITY_POLICY },
  });
  assert.deepStrictEqual(readComplexityPolicy(tmpRepo({ complexity: {} })), {
    ok: true, policy: { ...DEFAULT_COMPLEXITY_POLICY },
  });
});

test('readComplexityPolicy with valid values → carries them into the policy', () => {
  const result = policyOf({
    single_max_source_files: 0, single_max_source_lines: 0, strong_min_source_files: 1,
    strong_min_modules: 1, strong_min_total_files: 1000000,
    risk_paths: ['src/payments/', '*.pem'], generated_paths: ['out/'],
  });
  assert.deepStrictEqual(result, {
    ok: true,
    policy: {
      singleMaxSourceFiles: 0, singleMaxSourceLines: 0, strongMinSourceFiles: 1, strongMinModules: 1,
      strongMinTotalFiles: 1000000, riskPaths: ['src/payments/', '*.pem'], generatedPaths: ['out/'],
    },
  });
  assert.deepStrictEqual(policyOf({ risk_paths: ['src/payments/'] }).policy.riskPaths, ['src/payments/']);
  assert.deepStrictEqual(policyOf({ risk_paths: [] }).policy.riskPaths, []);
  assert.deepStrictEqual(policyOf({ risk_paths: [] }).policy.generatedPaths, [...DEFAULT_GENERATED_PATHS]);
  assert.deepStrictEqual(policyOf({ generated_paths: [] }).policy.generatedPaths, []);
  assert.deepStrictEqual(policyOf({ risk_paths: ['*.pem'] }).policy.riskPaths, ['*.pem']);
});

test('readComplexityPolicy with unreadable or malformed config → returns invalid', () => {
  const invalid = { ok: false, reason: 'invalid' };
  assert.deepStrictEqual(readComplexityPolicy(tmpRepo('{ not json')), invalid);
  // 디렉터리를 config.json 자리에 둬 읽기가 EISDIR로 실패하게 한다(권한 비트에 의존하지 않는다).
  const dirRepo = tmpRepo();
  fs.mkdirSync(path.join(dirRepo, '.bouncer', 'config.json'));
  assert.deepStrictEqual(readComplexityPolicy(dirRepo), invalid);
  assert.deepStrictEqual(policyOf([]), invalid);
  assert.deepStrictEqual(policyOf('x'), invalid);
  assert.deepStrictEqual(policyOf(null), invalid);
});

test('readComplexityPolicy with bad thresholds or unknown keys → returns invalid', () => {
  const invalid = { ok: false, reason: 'invalid' };
  for (const bad of [
    { strong_min_modules: 0 }, { single_max_source_files: 1.5 }, { single_max_source_files: -1 },
    { single_max_source_files: '2' }, { single_max_source_lines: null }, { strong_min_total_files: 0 },
    { strong_min_source_files: 0 }, { single_max_source_fils: 2 },
  ]) {
    assert.deepStrictEqual(policyOf(bad), invalid, JSON.stringify(bad));
  }
});

test('readComplexityPolicy with bad risk_paths entries → returns invalid', () => {
  const invalid = { ok: false, reason: 'invalid' };
  const bads = [
    ['/etc'], ['a/../b'], ['src\\a'], ['./AGENTS.md'], [' AGENTS.md'], ['AGENTS.md '], ['*'], ['**'], ['/'],
    ['a//b'], ['src/*.ts'], [1], [''], ['x'.repeat(201)], ['a*b*c*d*e'], 'AGENTS.md', {},
  ];
  for (const bad of bads) assert.deepStrictEqual(policyOf({ risk_paths: bad }), invalid, JSON.stringify(bad));
  assert.strictEqual(policyOf({ risk_paths: ['x'.repeat(200)] }).ok, true);
  assert.strictEqual(policyOf({ risk_paths: ['a*b*c*d'] }).ok, true);
});

test('readComplexityPolicy with bad generated_paths entries → returns invalid', () => {
  const invalid = { ok: false, reason: 'invalid' };
  for (const bad of [['dist'], ['dist/*/'], ['/dist/'], ['../x/'], 'dist/', ['a//b/'], [3]]) {
    assert.deepStrictEqual(policyOf({ generated_paths: bad }), invalid, JSON.stringify(bad));
  }
  assert.strictEqual(policyOf({ generated_paths: ['out/', 'a/b/'] }).ok, true);
});
