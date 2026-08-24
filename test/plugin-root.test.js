'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runBouncerRoot } = require('../scripts/lib/bouncer-root');

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
