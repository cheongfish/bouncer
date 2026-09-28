'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runBouncerRoot } = require('../scripts/lib/bouncer-root');
const launcher = path.join(__dirname, '..', 'scripts', 'bouncer');
const repoScripts = path.join(__dirname, '..', 'scripts');

function fixture(home, host, version, marketplace = 'chunjae-tools', metadata = 'plugin.json') {
  const root = host === 'claude' || host === 'codex'
    ? path.join(home, `.${host}`, 'plugins', 'cache', marketplace, 'bouncer', version)
    : host === 'cursor'
      ? path.join(home, '.cursor', 'plugins', 'local', 'bouncer')
      : path.join(home, '.gemini', 'antigravity-ide', 'plugins', 'bouncer');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, metadata), JSON.stringify({ name: 'bouncer', version }));
  fs.writeFileSync(path.join(root, 'scripts', 'bouncer'), '#!/usr/bin/env node\n');
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

test('BOUNCER_HOME wins over --host candidates, which win over all candidates', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const codex = fixture(home, 'codex', '9.0.0');
  const claude = fixture(home, 'claude', '1.0.0');
  const override = fixture(home, 'antigravity', '2.0.0');
  assert.strictEqual(capture(['--host', 'claude'], { homeDir: home }).out, `${claude}\n`);
  assert.strictEqual(
    capture(['--host', 'claude'], { homeDir: home, env: { BOUNCER_HOME: override } }).out,
    `${override}\n`,
  );
  assert.strictEqual(capture([], { homeDir: home }).out, `${codex}\n`);
});

test('auto sorting is strict semver descending then absolute path ascending', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const first = fixture(home, 'claude', '1.2.3', 'aaa');
  fixture(home, 'codex', '1.2.4');
  fixture(home, 'claude', 'not-semver');
  const codex = path.join(home, '.codex', 'plugins', 'cache', 'chunjae-tools', 'bouncer', '1.2.4');
  assert.strictEqual(capture([], { homeDir: home }).out, `${codex}\n`);
  assert.strictEqual(capture(['--host', 'claude'], { homeDir: home }).out, `${first}\n`);
});

test('strict semver ordering does not lose precision for large numeric identifiers', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const newer = fixture(home, 'claude', '9007199254740993.0.0', 'z-marketplace');
  fixture(home, 'codex', '9007199254740992.0.0', 'a-marketplace');
  assert.strictEqual(capture([], { homeDir: home }).out, `${newer}\n`);
});

test('package metadata is an accepted name/version source and participates in ordering', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const packageCandidate = fixture(home, 'claude', '3.0.0', 'package-only', 'package.json');
  fixture(home, 'codex', '2.0.0');
  assert.strictEqual(capture([], { homeDir: home }).out, `${packageCandidate}\n`);
});

test('--select rejects non-TTY input and selects the numbered candidate on a TTY', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  fixture(home, 'claude', '2.0.0');
  const second = fixture(home, 'codex', '1.0.0');
  const blocked = capture(['--select'], { homeDir: home, isTTY: false });
  assert.strictEqual(blocked.code, 1);
  assert.match(blocked.err, /TTY/);
  const selected = capture(['--select'], { homeDir: home, isTTY: true, readInput: () => '2\n' });
  assert.strictEqual(selected.code, 0);
  assert.strictEqual(selected.out, `${second}\n`);
});

test('--host rejects unsupported Cursor', () => {
  const result = capture(['--host', 'cursor'], {});
  assert.strictEqual(result.code, 1);
  assert.match(result.err, /claude, codex, or antigravity/);
});

test('CLI defaults cover stdout, stderr, stdin selection, and selection errors', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-root-'));
  const candidate = fixture(home, 'claude', '1.0.0');
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

test('bouncer delegates to the selected installed plugin with args and streams intact', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-launcher-'));
  const fixture = launcherFixture(home, 'delegated stderr', 23);
  const result = runLauncherFixture(['project-root', '--repo', '/tmp/example'], fixture, 'delegated stdin');
  assert.strictEqual(result.status, 23);
  assert.deepStrictEqual(JSON.parse(result.stdout), {
    args: ['project-root', '--repo', '/tmp/example'],
    input: 'delegated stdin',
  });
  assert.strictEqual(result.stderr, 'delegated stderr');
});

test('bouncer does not re-exec when bouncer-root selects the current installation', () => {
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

test('bouncer-root prints build guidance when scripts/lib is missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-missing-lib-root-'));
  const scriptsDir = path.join(tmp, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.copyFileSync(path.join(repoScripts, 'bouncer'), path.join(scriptsDir, 'bouncer'));
  fs.copyFileSync(path.join(repoScripts, 'bouncer-root'), path.join(scriptsDir, 'bouncer-root'));
  const res = spawnSync(process.execPath, [path.join(scriptsDir, 'bouncer-root'), '--auto'], {
    encoding: 'utf8',
    env: isolatedLauncherEnv(tmp),
  });
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /scripts\/lib is missing; run `npm run build`/);
});

test('bouncer prints build guidance when lib/cli.js is missing on the self-exec path', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-missing-cli-'));
  const scriptsDir = path.join(tmp, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.copyFileSync(path.join(repoScripts, 'bouncer'), path.join(scriptsDir, 'bouncer'));
  fs.copyFileSync(path.join(repoScripts, 'bouncer-root'), path.join(scriptsDir, 'bouncer-root'));
  // bouncer-root는 lib가 있어야 --auto로 tmp를 돌려주고, 그 다음 self-exec
  // 분기가 cli.js만 없음을 본다. lib 전체를 빼면 root 해석에서 먼저 죽는다.
  fs.cpSync(path.join(repoScripts, 'lib'), path.join(scriptsDir, 'lib'), {
    recursive: true,
    filter: (src) => path.basename(src) !== 'cli.js',
  });
  fs.writeFileSync(path.join(tmp, 'plugin.json'), JSON.stringify({ name: 'bouncer', version: '9.9.9' }));
  const res = spawnSync(process.execPath, [path.join(scriptsDir, 'bouncer'), '--help'], {
    encoding: 'utf8',
    env: isolatedLauncherEnv(tmp),
  });
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /scripts\/lib is missing; run `npm run build`/);
});
