'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runBouncerRoot } = require('../packages/cli/dist/bouncer-root');
const { findPluginCandidates, resolvePluginAssetRoot, resolvePluginRoot } = require('../packages/cli/dist/plugin-root');

// 격리 복사본에도 있는 runtime package.json이 버전을 정한다. 릴리스 버전을 올려도 fixture가 따라가게 한다.
const RUNTIME_VERSION = require('../packages/cli/package.json').version;
const repoPackage = path.join(__dirname, '..', 'packages', 'cli');
const launcher = path.join(repoPackage, 'bin', 'bouncer');
const repoScripts = path.join(repoPackage, 'bin');

/**
 * 후보 검증이 요구하는 필수 자산 여섯 개(디렉터리 다섯 + AGENTS.md)를 root 아래에 만든다.
 *
 * @param {string} root - fixture 플러그인 루트
 */
function writeAssets(root) {
  for (const dir of ['agents', 'skills', 'rules', 'references', 'hooks']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# fixture\n');
}

function fixture(home, host, version, marketplace = 'chunjae-tools', metadata = 'plugin.json', launcher = true) {
  const root = host === 'claude' || host === 'codex'
    ? path.join(home, `.${host}`, 'plugins', 'cache', marketplace, 'bouncer', version)
    : host === 'cursor'
      ? path.join(home, '.cursor', 'plugins', 'local', 'bouncer')
      : path.join(home, '.gemini', 'antigravity-ide', 'plugins', 'bouncer');
  fs.mkdirSync(root, { recursive: true });
  if (metadata.includes('/')) fs.mkdirSync(path.dirname(path.join(root, metadata)), { recursive: true });
  fs.writeFileSync(path.join(root, metadata), JSON.stringify({ name: 'bouncer', version }));
  if (launcher) {
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'scripts', 'bouncer'), '#!/usr/bin/env node\n');
  }
  writeAssets(root);
  return root;
}

function capture(argv, options) {
  const result = { out: '', err: '' };
  result.code = runBouncerRoot(argv, {
    // 후보 해석은 앰비언트 BOUNCER_HOME을 먼저 읽는다. 개발자 셸에 그 변수가
    // 있으면 fixture가 아니라 그 경로가 뽑혀 이 파일의 단언이 통째로 흔들리므로,
    // 기본값을 빈 env로 고정한다. 오버라이드 자체를 검증하는 호출만 env를 넘긴다.
    env: {},
    ...options,
    out: (s) => { result.out += s; },
    err: (s) => { result.err += s; },
  });
  return result;
}

test('BOUNCER_HOME, --host candidates, and all candidates → BOUNCER_HOME wins over --host, which wins over all', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const codex = fixture(home, 'codex', RUNTIME_VERSION);
  const claude = fixture(home, 'claude', RUNTIME_VERSION);
  const override = fixture(home, 'antigravity', RUNTIME_VERSION);
  assert.strictEqual(capture(['--host', 'claude'], { homeDir: home }).out, `${claude}\n`);
  assert.strictEqual(
    capture(['--host', 'claude'], { homeDir: home, env: { BOUNCER_HOME: override } }).out,
    `${override}\n`,
  );
  assert.strictEqual(capture([], { homeDir: home }).out, `${[codex, claude, override].sort()[0]}\n`);
});

test('auto sorting → is strict semver descending then absolute path ascending', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const first = fixture(home, 'claude', '1.2.3', 'aaa');
  fixture(home, 'codex', '1.2.4');
  fixture(home, 'claude', 'not-semver');
  const codex = path.join(home, '.codex', 'plugins', 'cache', 'chunjae-tools', 'bouncer', '1.2.4');
  assert.strictEqual(findPluginCandidates({ homeDir: home })[0].path, codex);
  assert.strictEqual(findPluginCandidates({ homeDir: home }, 'claude')[0].path, first);
});

test('strict semver ordering with large numeric identifiers → does not lose precision', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const newer = fixture(home, 'claude', '9007199254740993.0.0', 'z-marketplace');
  fixture(home, 'codex', '9007199254740992.0.0', 'a-marketplace');
  assert.strictEqual(findPluginCandidates({ homeDir: home })[0].path, newer);
});

test('package-only metadata → is rejected while host plugin manifest is accepted', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const packageCandidate = fixture(home, 'claude', '3.0.0', 'package-only', 'package.json');
  const hostManifest = fixture(home, 'codex', RUNTIME_VERSION, 'host-manifest', '.codex-plugin/plugin.json');
  assert.deepStrictEqual(findPluginCandidates({ homeDir: home }).map((candidate) => candidate.path), [hostManifest]);
  assert.ok(fs.existsSync(packageCandidate));
});

test('asset-only matching plugin → resolves without a launcher and checks the runtime version', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-asset-only-'));
  const root = fixture(home, 'claude', RUNTIME_VERSION, 'assets', 'plugin.json', false);
  assert.strictEqual(resolvePluginAssetRoot({ env: { BOUNCER_HOME: root }, runtimeVersion: RUNTIME_VERSION }), root);
});

test('plugin compatibility range → accepts runtime 0.1.14 and rejects 0.1.13', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-runtime-range-'));
  const root = fixture(home, 'claude', '0.1.12', 'range', 'plugin.json', false);
  fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({
    name: 'bouncer',
    version: '0.1.12',
    runtimeCompatibility: '>=0.1.14 <0.2.0',
  }));

  assert.strictEqual(resolvePluginRoot({ env: { BOUNCER_HOME: root }, runtimeVersion: '0.1.14' }).path, root);
  assert.throws(
    () => resolvePluginRoot({ env: { BOUNCER_HOME: root }, runtimeVersion: '0.1.13' }),
    (error) => error.code === 'BOUNCER_PLUGIN_VERSION_MISMATCH',
  );
});

test('launcher-free host candidates → library and CLI auto/--select pick the matching candidate', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-launcher-free-'));
  const root = fixture(home, 'claude', RUNTIME_VERSION, 'assets', 'plugin.json', false);
  assert.ok(!fs.existsSync(path.join(root, 'scripts', 'bouncer')));
  const auto = capture([], { homeDir: home });
  assert.strictEqual(auto.code, 0);
  assert.strictEqual(auto.out, `${root}\n`);
  const selected = capture(['--select'], { homeDir: home, isTTY: true, readInput: () => '1' });
  assert.strictEqual(selected.code, 0);
  assert.strictEqual(selected.out, `${root}\n`);
  // 라이브러리 호출은 CLI 단언 뒤에 둔다: launcher 필수가 되살아나면 호출이 던지기 전에
  // 선택값/exit 단언이 먼저 실패해 Red 지점이 명확해진다.
  assert.strictEqual(resolvePluginRoot({ homeDir: home, env: {}, runtimeVersion: RUNTIME_VERSION }).path, root);
  assert.strictEqual(resolvePluginAssetRoot({ homeDir: home, env: {}, runtimeVersion: RUNTIME_VERSION }), root);
});

test('selected latest plugin with a different version → throws an identifiable mismatch without fallback', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-version-mismatch-'));
  // 하위 후보를 실제 runtime 버전과 일치시켜야 "일치 후보가 있어도 fallback하지 않는다"가 증명된다.
  const matching = fixture(home, 'claude', RUNTIME_VERSION, 'matching', 'plugin.json', false);
  const latest = fixture(home, 'claude', '1.7.0', 'latest', 'plugin.json', false);
  assert.deepStrictEqual(findPluginCandidates({ homeDir: home }).map((c) => c.path), [latest, matching]);
  const isMismatch = (error) => error.code === 'BOUNCER_PLUGIN_VERSION_MISMATCH'
    && error.message.includes('1.7.0')
    && error.message.includes(RUNTIME_VERSION)
    && error.message.includes('compatible npm runtime');
  assert.throws(() => resolvePluginRoot({ homeDir: home, env: {}, runtimeVersion: RUNTIME_VERSION }), isMismatch);
  assert.throws(() => resolvePluginAssetRoot({ homeDir: home, env: {}, runtimeVersion: RUNTIME_VERSION }), isMismatch);
  const auto = capture([], { homeDir: home });
  assert.strictEqual(auto.code, 1);
  assert.strictEqual(auto.out, '');
  assert.match(auto.err, /incompatible with runtime version/);
  assert.ok(auto.err.includes('1.7.0') && auto.err.includes(RUNTIME_VERSION));
  assert.ok(auto.err.includes('install a compatible npm runtime version'));
  const selected = capture(['--select'], {
    homeDir: home,
    isTTY: true,
    readInput: () => '1',
  });
  assert.strictEqual(selected.code, 1);
  assert.strictEqual(selected.out, '');
  assert.match(selected.err, /incompatible with runtime version/);
  assert.ok(selected.err.includes('1.7.0') && selected.err.includes(RUNTIME_VERSION));
});

const NEGATIVE_CONTROLS = [
  {
    label: 'launcher requirement reintroduced',
    file: 'plugin-root.ts',
    anchor: '    for (const dir of REQUIRED_ASSET_DIRS) {',
    // 자산 검증 앞에 launcher stat을 되살린다. 없으면 statSync가 던져 후보가 제외된다.
    replacement: "    fs.statSync(path.join(absolute, 'scripts', 'bouncer'));\n    for (const dir of REQUIRED_ASSET_DIRS) {",
    pattern: 'launcher-free host candidates',
    failing: 'launcher-free host candidates',
  },
  {
    label: 'version check removed',
    file: 'plugin-root.ts',
    anchor: '  assertPluginVersion(candidate, runtimeVersion);\n  return candidate;',
    replacement: '  return candidate;',
    pattern: 'selected latest plugin with a different version',
    failing: 'selected latest plugin with a different version',
  },
];

/**
 * packages/cli를 격리 복사본에 옮겨 source를 mutation한 뒤 복사본에서 rebuild하고,
 * 이 테스트 파일을 복사본의 test/ 에 두어 복사본 dist를 읽게 실행한다.
 * 부모 저장소의 source/dist는 읽기만 한다.
 *
 * @param {object} control - NEGATIVE_CONTROLS 항목(anchor 치환과 실행할 테스트 이름 pattern)
 * @returns {{build: object, run: object}} rebuild와 지정 테스트 실행의 spawnSync 결과
 */
function runNegativeControl(control) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-negative-control-'));
  const copy = path.join(tmp, 'packages', 'cli');
  for (const name of ['src', 'bin', 'vendor', 'package.json', 'tsconfig.json']) {
    fs.cpSync(path.join(repoPackage, name), path.join(copy, name), { recursive: true });
  }
  fs.mkdirSync(path.join(tmp, 'test'));
  fs.copyFileSync(path.join(__dirname, 'plugin-root.test.js'), path.join(tmp, 'test', 'plugin-root.test.js'));
  // tsc와 @types/node 해석을 위해 부모 저장소 node_modules를 읽기 전용 심볼릭 링크로 노출한다.
  fs.symlinkSync(path.join(__dirname, '..', 'node_modules'), path.join(tmp, 'node_modules'));
  const target = path.join(copy, 'src', control.file);
  const source = fs.readFileSync(target, 'utf8');
  // anchor를 못 찾으면 mutation이 적용되지 않은 채 통과하는 skip 성공을 막기 위해 실패시킨다.
  assert.ok(source.split(control.anchor).length === 2, `mutation anchor not found once: ${control.label}`);
  fs.writeFileSync(target, source.replace(control.anchor, () => control.replacement));
  const tsc = path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc');
  const build = spawnSync(process.execPath, [tsc, '-p', path.join(copy, 'tsconfig.json')], { encoding: 'utf8' });
  assert.strictEqual(build.status, 0, `rebuild of the isolated copy failed: ${build.stdout}${build.stderr}`);
  // 부모 test runner의 NODE_TEST_CONTEXT를 물려받으면 자식이 자체 TAP 보고 대신 부모 하위 테스트로
  // 동작해 실패가 exit 0·빈 stdout으로 가려지므로 제거한다.
  const childEnv = { ...process.env, BOUNCER_NEGATIVE_CONTROL: '1', BOUNCER_HOME: '' };
  delete childEnv.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, [
    '--test', '--test-reporter=tap', `--test-name-pattern=${control.pattern}`,
    path.join(tmp, 'test', 'plugin-root.test.js'),
  ], { encoding: 'utf8', env: childEnv });
  fs.rmSync(tmp, { recursive: true, force: true });
  return { build, run };
}

for (const control of NEGATIVE_CONTROLS) {
  // 중첩 실행(복사본 안의 이 파일)이 다시 control을 만들지 않도록 환경 변수로 끈다.
  test(`${control.label} in an isolated copy → the targeted test fails on its assertion and exits nonzero`, {
    skip: process.env.BOUNCER_NEGATIVE_CONTROL === '1',
    timeout: 240000,
  }, () => {
    const { run } = runNegativeControl(control);
    assert.notStrictEqual(run.status, 0);
    // module-load/빌드 실패가 아니라 지정 테스트의 단언 실패여야 목표 Red다.
    assert.match(run.stdout, new RegExp(`^not ok \\d+ - ${control.failing}`, 'm'));
    assert.match(run.stdout, /AssertionError|ERR_ASSERTION/);
  });
}

test('--select with non-TTY input or a TTY → rejects non-TTY input and selects the numbered candidate on a TTY', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  fixture(home, 'claude', RUNTIME_VERSION);
  const second = fixture(home, 'codex', RUNTIME_VERSION);
  const blocked = capture(['--select'], { homeDir: home, isTTY: false });
  assert.strictEqual(blocked.code, 1);
  assert.match(blocked.err, /TTY/);
  const selected = capture(['--select'], { homeDir: home, isTTY: true, readInput: () => '2\n' });
  assert.strictEqual(selected.code, 0);
  assert.strictEqual(selected.out, `${second}\n`);
});

test('--host with unsupported Cursor → rejects it', () => {
  const result = capture(['--host', 'cursor'], {});
  assert.strictEqual(result.code, 1);
  assert.match(result.err, /claude, codex, or antigravity/);
});

test('CLI defaults → cover stdout, stderr, stdin selection, and selection errors', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const candidate = fixture(home, 'claude', RUNTIME_VERSION);
  const writes = [];
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  const originalRead = fs.readFileSync;
  process.stdout.write = (text) => { writes.push(`out:${text}`); return true; };
  process.stderr.write = (text) => { writes.push(`err:${text}`); return true; };
  fs.readFileSync = (target, ...args) => (target === 0 ? '1\n' : originalRead(target, ...args));
  try {
    assert.strictEqual(runBouncerRoot(['--select'], { homeDir: home, isTTY: true, env: {} }), 0);
    assert.ok(writes.includes(`out:${candidate}\n`));
    assert.strictEqual(runBouncerRoot(['--unknown']), 1);
    assert.match(writes.at(-1), /unknown argument/);
    assert.strictEqual(capture(['--select'], { homeDir: home, isTTY: true, readInput: () => '0' }).code, 1);
    assert.strictEqual(capture(['--select'], { homeDir: home, isTTY: true, env: { BOUNCER_HOME: '/bad' } }).code, 1);
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
    fs.readFileSync = originalRead;
  }
});

function launcherFixture(home, output, exitCode = 0) {
  const root = path.join(home, 'installed-bouncer');
  const bin = path.join(home, 'bin');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'bouncer'), [
    '#!/usr/bin/env node',
    "const fs = require('node:fs');",
    "const input = fs.readFileSync(0, 'utf8');",
    'process.stdout.write(JSON.stringify({ args: process.argv.slice(2), input }));',
    `process.stderr.write(${JSON.stringify(output)});`,
    `process.exit(${exitCode});`,
    '',
  ].join('\n'));
  fs.chmodSync(path.join(root, 'scripts', 'bouncer'), 0o755);
  fs.writeFileSync(path.join(bin, 'bouncer-root'), [
    '#!/usr/bin/env node',
    `process.stdout.write(${JSON.stringify(`${root}\n`)});`,
    '',
  ].join('\n'));
  fs.chmodSync(path.join(bin, 'bouncer-root'), 0o755);
  return { root, bin };
}

function runLauncherFixture(args, fixture, input = '') {
  return require('node:child_process').spawnSync(process.execPath, [launcher, ...args], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PATH: `${fixture.bin}${path.delimiter}${process.env.PATH || ''}` },
    input,
    encoding: 'utf8',
  });
}

test('bouncer with a competing installed plugin → runs its own package CLI', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-launcher-'));
  const fixture = launcherFixture(home, 'must not be called', 23);
  const result = runLauncherFixture(['--help'], fixture);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /^usage: bouncer <command> \[options\]/);
  assert.strictEqual(result.stderr, '');
});

test('bouncer-root selects the current installation → bouncer does not re-exec', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-launcher-current-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'bouncer-root'), [
    '#!/usr/bin/env node',
    `process.stdout.write(${JSON.stringify(`${path.join(__dirname, '..')}\n`)});`,
    '',
  ].join('\n'));
  fs.chmodSync(path.join(bin, 'bouncer-root'), 0o755);
  const result = runLauncherFixture(['--help'], { bin });
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /^usage: bouncer <command> \[options\]/);
  assert.strictEqual(result.stderr, '');
});

/**
 * 호스트 설치본이 fixture launcher를 가로채지 못하게 env를 고정한다.
 * PATH에서 bouncer-root를 빼고 BOUNCER_HOME을 fixture로 두면, 자기 실행
 * 분기와 부재 안내만 검사할 수 있다.
 *
 * @param {string} tmp - fixture 플러그인 루트. BOUNCER_HOME으로 넘긴다
 * @returns {NodeJS.ProcessEnv} BOUNCER_HOME과 PATH만 덮은 process.env 복사
 */
function isolatedLauncherEnv(tmp) {
  // 호스트 PATH의 bouncer-root·BOUNCER_HOME이 fixture를 가로채면 자기 실행
  // 분기에 도달하지 않거나 설치된 lib가 보여 부재 안내가 나오지 않는다.
  return {
    ...process.env,
    BOUNCER_HOME: tmp,
    PATH: path.dirname(process.execPath),
  };
}

test('bouncer-root with scripts/lib missing → prints build guidance', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-missing-lib-root-'));
  const packageRoot = path.join(tmp, 'packages', 'cli');
  const binDir = path.join(packageRoot, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.copyFileSync(path.join(repoScripts, 'bouncer'), path.join(binDir, 'bouncer'));
  fs.copyFileSync(path.join(repoScripts, 'bouncer-root'), path.join(binDir, 'bouncer-root'));
  writeAssets(tmp);
  const res = spawnSync(process.execPath, [path.join(binDir, 'bouncer-root'), '--auto'], {
    encoding: 'utf8',
    env: isolatedLauncherEnv(tmp),
  });
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /packages\/cli\/dist is missing; run `npm run build`/);
});

test('bouncer with lib/cli.js missing on the self-exec path → prints build guidance', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-missing-cli-'));
  const packageRoot = path.join(tmp, 'packages', 'cli');
  const binDir = path.join(packageRoot, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.copyFileSync(path.join(repoScripts, 'bouncer'), path.join(binDir, 'bouncer'));
  fs.copyFileSync(path.join(repoScripts, 'bouncer-root'), path.join(binDir, 'bouncer-root'));
  // bouncer-root는 lib가 있어야 --auto로 tmp를 돌려주고, 그 다음 self-exec
  // 분기가 cli.js만 없음을 본다. lib 전체를 빼면 root 해석에서 먼저 죽는다.
  fs.cpSync(path.join(repoPackage, 'dist'), path.join(packageRoot, 'dist'), {
    recursive: true,
    filter: (src) => path.basename(src) !== 'cli.js',
  });
  fs.writeFileSync(path.join(tmp, 'plugin.json'), JSON.stringify({ name: 'bouncer', version: RUNTIME_VERSION }));
  writeAssets(tmp);
  const res = spawnSync(process.execPath, [path.join(binDir, 'bouncer'), '--help'], {
    encoding: 'utf8',
    env: isolatedLauncherEnv(tmp),
  });
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /packages\/cli\/dist is missing; run `npm run build`/);
});

/**
 * 개발 checkout 모양의 tmp root를 만든다: packages/cli/src, build-stamp helper, 두 launcher,
 * 복사한 dist. stamp는 호출자가 정한다.
 *
 * @param {string|null} stamp - packages/cli/dist/.build-stamp 내용. null이면 쓰지 않는다
 * @returns {string} tmp root
 */
function devCheckoutFixture(stamp) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-stale-build-'));
  const packageRoot = path.join(tmp, 'packages', 'cli');
  const binDir = path.join(packageRoot, 'bin');
  fs.mkdirSync(path.join(packageRoot, 'src'), { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  // src 제거 뒤 dist/plugin-root.js가 런타임 version을 읽을 수 있도록 package metadata도 복사한다.
  fs.copyFileSync(path.join(repoPackage, 'package.json'), path.join(packageRoot, 'package.json'));
  fs.writeFileSync(path.join(packageRoot, 'src', 'x.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(packageRoot, 'tsconfig.json'), '{}');
  for (const name of ['bouncer', 'bouncer-root', 'build-stamp.js']) {
    if (fs.existsSync(path.join(repoScripts, name))) {
      fs.copyFileSync(path.join(repoScripts, name), path.join(binDir, name));
    }
  }
  fs.cpSync(path.join(repoPackage, 'dist'), path.join(packageRoot, 'dist'), { recursive: true });
  fs.cpSync(path.join(repoPackage, 'vendor'), path.join(packageRoot, 'vendor'), { recursive: true });
  fs.rmSync(path.join(packageRoot, 'dist', '.build-stamp'), { force: true });
  if (stamp !== null) fs.writeFileSync(path.join(packageRoot, 'dist', '.build-stamp'), stamp);
  fs.writeFileSync(path.join(tmp, 'plugin.json'), JSON.stringify({ name: 'bouncer', version: RUNTIME_VERSION }));
  writeAssets(tmp);
  return tmp;
}

const STALE = /bouncer: stale-build: packages\/cli\/dist does not match packages\/cli\/src; run `npm run build` in /;

for (const [label, stamp] of [['stamp hash differs', `sha256:${'0'.repeat(64)}\n`], ['stamp is missing', null]]) {
  test(`launchers on a checkout where ${label} → stale-build and exit 1`, () => {
    const tmp = devCheckoutFixture(stamp);
    const env = isolatedLauncherEnv(tmp);
    const viaBouncer = spawnSync(process.execPath, [path.join(tmp, 'packages', 'cli', 'bin', 'bouncer'), '--help'], {
      encoding: 'utf8', env,
    });
    assert.strictEqual(viaBouncer.status, 1);
    assert.match(viaBouncer.stderr, STALE);
    const viaRoot = spawnSync(process.execPath, [path.join(tmp, 'packages', 'cli', 'bin', 'bouncer-root'), '--auto'], {
      encoding: 'utf8', env,
    });
    assert.strictEqual(viaRoot.status, 1);
    assert.match(viaRoot.stderr, STALE);
  });
}

test('bouncer-root on a checkout without packages/cli/src → skips the freshness check', () => {
  const tmp = devCheckoutFixture(null);
  fs.rmSync(path.join(tmp, 'packages', 'cli', 'src'), { recursive: true });
  fs.rmSync(path.join(tmp, 'packages', 'cli', 'bin', 'build-stamp.js'), { force: true });
  const res = spawnSync(process.execPath, [path.join(tmp, 'packages', 'cli', 'bin', 'bouncer-root'), '--auto'], {
    encoding: 'utf8',
    env: isolatedLauncherEnv(tmp),
  });
  assert.strictEqual(res.status, 0);
  assert.strictEqual(res.stdout.trim(), tmp);
});

test('candidate missing a required asset → is excluded from findPluginCandidates', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-assets-'));
  const full = fixture(home, 'claude', '1.0.0', 'full');
  const partial = fixture(home, 'claude', '2.0.0', 'partial');
  fs.rmSync(path.join(partial, 'hooks'), { recursive: true });
  const noAgentsDoc = fixture(home, 'codex', '3.0.0');
  fs.rmSync(path.join(noAgentsDoc, 'AGENTS.md'));
  assert.deepStrictEqual(findPluginCandidates({ homeDir: home }).map((c) => c.path), [full]);
});

test('resolvePluginAssetRoot with BOUNCER_HOME and host candidates → prefers HOME and otherwise host', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-asset-root-'));
  const installed = fixture(home, 'claude', RUNTIME_VERSION, 'host', 'plugin.json', false);
  const override = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-asset-home-'));
  fs.writeFileSync(path.join(override, 'plugin.json'), JSON.stringify({ name: 'bouncer', version: RUNTIME_VERSION }));
  writeAssets(override);
  assert.strictEqual(
    resolvePluginAssetRoot({ env: { BOUNCER_HOME: override }, homeDir: home }),
    override,
  );
  assert.strictEqual(resolvePluginAssetRoot({ env: {}, homeDir: home }), installed);
});

test('resolvePluginAssetRoot with an invalid BOUNCER_HOME → throws without falling back', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-asset-bad-home-'));
  assert.throws(
    () => resolvePluginAssetRoot({ env: { BOUNCER_HOME: path.join(home, 'nope') }, homeDir: home }),
    { message: 'BOUNCER_HOME is not a valid Bouncer plugin root' },
  );
});

test('resolvePluginAssetRoot with no valid root at any step → throws the plugin-assets message', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-asset-none-'));
  assert.throws(
    () => resolvePluginAssetRoot({ env: {}, homeDir: home }),
    { message: 'no valid Bouncer plugin roots found' },
  );
});

test('pure command with a failing bouncer-root on PATH → runs the own CLI without resolving a root', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-pure-'));
  const bin = path.join(home, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'bouncer-root'), '#!/usr/bin/env node\nprocess.exit(1);\n');
  fs.chmodSync(path.join(bin, 'bouncer-root'), 0o755);
  const result = runLauncherFixture(['current', '--help'], { bin });
  assert.strictEqual(result.status, 0);
  assert.ok(result.stdout.includes('Show the active blueprint pointer'));
});

test('pure command with an invalid BOUNCER_HOME and no bouncer-root on PATH → still succeeds', () => {
  const result = spawnSync(process.execPath, [launcher, 'project-root', '--help'], {
    encoding: 'utf8',
    env: { ...process.env, BOUNCER_HOME: path.join(os.tmpdir(), 'bouncer-does-not-exist'), PATH: path.dirname(process.execPath) },
  });
  assert.strictEqual(result.status, 0);
});

test('pure command from a copy without scripts/lib → prints the exact build guidance', () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-pure-nolib-')));
  fs.mkdirSync(path.join(tmp, 'packages', 'cli', 'bin'), { recursive: true });
  fs.copyFileSync(launcher, path.join(tmp, 'packages', 'cli', 'bin', 'bouncer'));
  const result = spawnSync(process.execPath, [path.join(tmp, 'packages', 'cli', 'bin', 'bouncer'), 'current'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: path.dirname(process.execPath) },
  });
  assert.strictEqual(result.status, 1);
  assert.strictEqual(
    result.stderr,
    `bouncer: packages/cli/dist is missing; run \`npm run build\` in ${tmp}\n`,
  );
});

test('plugin asset readers in codex-agents and coordinate-next → do not climb two levels from __dirname', () => {
  for (const file of ['codex-agents.ts', 'coordinate-next.ts']) {
    const source = fs.readFileSync(path.join(repoPackage, 'src', file), 'utf8');
    assert.doesNotMatch(source, /__dirname\s*,\s*['"]\.\.(\/\.\.)?['"]/, file);
  }
});
