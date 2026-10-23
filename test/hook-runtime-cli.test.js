'use strict';
// 훅 공용 런타임 모듈(hooks/runtime-cli.js)과 두 commit 훅의 spawn 동작을 검증한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const {
  findRuntime, runRuntime, needsCommitCheck, hasBouncerContext, commitFailureMessage,
} = require('../hooks/runtime-cli');

const FIXED = ['commit-guard', '--command-stdin'];

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bouncer-hookrt-${prefix}-`));
}

// 지정한 경로만 일반 파일로 보이는 fs 대역. 그 밖의 경로는 ENOENT.
function fakeFs(files) {
  const set = new Set(files);
  return {
    statSync(file) {
      if (set.has(file)) return { isFile: () => true };
      const e = new Error(`ENOENT: ${file}`);
      e.code = 'ENOENT';
      throw e;
    },
    existsSync: (file) => set.has(file),
  };
}

// ---------- findRuntime ----------

test('findRuntime with absolute BOUNCER_BIN and a PATH bouncer → prefers BOUNCER_BIN', () => {
  const r = findRuntime({
    env: { BOUNCER_BIN: '/opt/pin/bouncer', PATH: '/usr/bin' },
    platform: 'linux',
    fs: fakeFs(['/opt/pin/bouncer', '/usr/bin/bouncer']),
  });
  assert.deepEqual(r, { file: '/opt/pin/bouncer', args: [] });
});

test('findRuntime with relative BOUNCER_BIN → reason BOUNCER_BIN must be absolute', () => {
  const r = findRuntime({
    env: { BOUNCER_BIN: 'rel/bouncer', PATH: '/usr/bin' }, platform: 'linux', fs: fakeFs(['/usr/bin/bouncer']),
  });
  assert.deepEqual(r, { file: null, reason: 'BOUNCER_BIN must be absolute' });
});

test('findRuntime with a missing absolute BOUNCER_BIN → reason BOUNCER_BIN not found, PATH is not used', () => {
  const r = findRuntime({
    env: { BOUNCER_BIN: '/opt/missing/bouncer', PATH: '/usr/bin' },
    platform: 'linux',
    fs: fakeFs(['/usr/bin/bouncer']),
  });
  assert.deepEqual(r, { file: null, reason: 'BOUNCER_BIN not found' });
});

test('findRuntime with empty BOUNCER_BIN → searches PATH', () => {
  const r = findRuntime({
    env: { BOUNCER_BIN: '', PATH: '/usr/bin' }, platform: 'linux', fs: fakeFs(['/usr/bin/bouncer']),
  });
  assert.equal(r.file, '/usr/bin/bouncer');
});

test('findRuntime with only empty or relative PATH entries holding bouncer → finds nothing', () => {
  const r = findRuntime({
    env: { PATH: [':', '.', ':/nowhere'].join('') },
    platform: 'linux',
    fs: fakeFs(['bouncer', './bouncer', 'bouncer/bouncer', './bouncer/bouncer']),
  });
  assert.equal(r.file, null);
});

test('findRuntime on win32 with a .cmd BOUNCER_BIN → wraps it for cmd.exe with verbatim arguments', () => {
  const cmd = 'C:\\a b\\bouncer.cmd';
  const r = findRuntime({
    env: { BOUNCER_BIN: cmd, ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    platform: 'win32',
    fs: fakeFs([cmd]),
  });
  assert.equal(r.file, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(r.args, ['/d', '/s', '/c', '""C:\\a b\\bouncer.cmd" commit-guard --command-stdin"']);
  assert.equal(r.verbatim, true);
});

test('findRuntime on win32 with a .cmd path containing & → reason unsafe runtime path', () => {
  const cmd = 'C:\\a&b\\bouncer.cmd';
  const r = findRuntime({ env: { BOUNCER_BIN: cmd }, platform: 'win32', fs: fakeFs([cmd]) });
  assert.deepEqual(r, { file: null, reason: 'unsafe runtime path' });
});

// ---------- runRuntime / commitFailureMessage ----------

test('runRuntime with timeoutMs → passes it as the spawn timeout with shell false and BOUNCER_HOME', () => {
  let seen;
  const r = runRuntime(FIXED, {
    cwd: '/some/repo',
    input: 'git commit -m x',
    env: { BOUNCER_BIN: process.execPath },
    timeoutMs: 1234,
    spawn: (file, args, options) => {
      seen = { file, args, options };
      return { status: 0, signal: null, stdout: 'o', stderr: '' };
    },
  });
  assert.equal(r.found, true);
  assert.equal(r.status, 0);
  assert.equal(seen.file, process.execPath);
  assert.deepEqual(seen.args, FIXED);
  assert.equal(seen.options.timeout, 1234);
  assert.equal(seen.options.shell, false);
  assert.equal(seen.options.cwd, '/some/repo');
  assert.equal(seen.options.input, 'git commit -m x');
  assert.equal(seen.options.env.BOUNCER_HOME, root);
});

test('runRuntime without timeoutMs → sets no spawn timeout', () => {
  let seen;
  runRuntime(FIXED, {
    cwd: '/r',
    env: { BOUNCER_BIN: process.execPath },
    spawn: (_f, _a, options) => { seen = options; return { status: 0, signal: null }; },
  });
  assert.equal('timeout' in seen, false);
});

test('runRuntime when no runtime exists → found false with the reason and no spawn', () => {
  const r = runRuntime(FIXED, {
    cwd: '/r',
    env: { BOUNCER_BIN: 'rel/bouncer' },
    spawn: () => { throw new Error('must not spawn'); },
  });
  assert.equal(r.found, false);
  assert.equal(r.reason, 'BOUNCER_BIN must be absolute');
});

test('commitFailureMessage given a timed-out run → names timeout and omits the stderr part', () => {
  const msg = commitFailureMessage({
    found: true, status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' }, stderr: '',
  });
  assert.equal(
    msg,
    'commit-safety: bouncer runtime failed (timeout); check that `bouncer commit-guard --help` '
      + 'lists --command-stdin, or set BOUNCER_BIN to a current runtime',
  );
});

test('commitFailureMessage given a signal-killed run → names the signal', () => {
  const msg = commitFailureMessage({ found: true, status: null, signal: 'SIGKILL', stderr: 'x\ny' });
  assert.match(msg, /^commit-safety: bouncer runtime failed \(SIGKILL\): x; check/);
});

// ---------- needsCommitCheck ----------

const noAlias = () => ({ status: 1, stdout: '' });
const neverSpawn = () => { throw new Error('alias lookup must not run'); };

test('needsCommitCheck given commands that cannot commit → false', () => {
  for (const cmd of ['ls -la', 'git status', 'cat .gitignore']) {
    assert.equal(needsCommitCheck(cmd, '/r', { spawn: noAlias }), false, cmd);
  }
});

test('needsCommitCheck given a quote-split commit word (R1 only) → true', () => {
  assert.equal(needsCommitCheck('git c""ommit -m x', '/r', { spawn: noAlias }), true);
});

test('needsCommitCheck given a variable expansion (R2 only) → true', () => {
  assert.equal(needsCommitCheck('echo $X', '/r', { spawn: neverSpawn }), true);
});

test('needsCommitCheck given a nested shell or xargs (R3 only) → true', () => {
  assert.equal(needsCommitCheck('sh build.sh', '/r', { spawn: neverSpawn }), true);
  assert.equal(needsCommitCheck('xargs -n1 echo', '/r', { spawn: neverSpawn }), true);
});

test('needsCommitCheck given a quote-split alias name (R4 only) → true when the alias exists', () => {
  let call;
  const spawn = (file, args) => { call = { file, args }; return { status: 0, stdout: 'alias.ci status\n' }; };
  assert.equal(needsCommitCheck('g""it ci', '/r', { spawn }), true);
  assert.deepEqual(call.args, ['-C', '/r', 'config', '--get-regexp', '^alias\\.']);
});

test('needsCommitCheck with an alias that is not used by the command → false', () => {
  const spawn = () => ({ status: 0, stdout: 'alias.ci status\n' });
  assert.equal(needsCommitCheck('git log', '/r', { spawn }), false);
});

test('needsCommitCheck when the alias lookup fails to spawn → true', () => {
  const spawn = () => ({ error: new Error('ENOENT'), status: null });
  assert.equal(needsCommitCheck('g""it ci', '/r', { spawn }), true);
});

test('needsCommitCheck when the alias lookup exits 1 with empty stdout → false', () => {
  assert.equal(needsCommitCheck('g""it ci', '/r', { spawn: noAlias }), false);
});

// ---------- hasBouncerContext ----------

test('hasBouncerContext with a relative common dir holding bouncer/ → true regardless of process cwd', () => {
  const repo = path.join(os.tmpdir(), 'bouncer-hookrt-nonexistent-repo');
  const files = [path.join(repo, '.git', 'bouncer')];
  const spawn = () => ({ status: 0, stdout: '.git\n' });
  assert.notEqual(process.cwd(), repo);
  assert.equal(hasBouncerContext(repo, { spawn, fs: fakeFs(files) }), true);
});

test('hasBouncerContext with no .bouncer and an empty common dir → false', () => {
  const spawn = () => ({ status: 0, stdout: '.git\n' });
  assert.equal(hasBouncerContext('/r', { spawn, fs: fakeFs([]) }), false);
});

test('hasBouncerContext when git fails → true', () => {
  const spawn = () => ({ status: 128, stdout: '' });
  assert.equal(hasBouncerContext('/r', { spawn, fs: fakeFs([]) }), true);
});

// ---------- 실제 훅 spawn ----------

function gitRepo({ bouncer }) {
  const repo = tmp('repo');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  if (bouncer) fs.mkdirSync(path.join(repo, '.bouncer'));
  return repo;
}

// 호출되면 stdin을 marker에 쓰고 지정한 stdout·stderr·exit를 내는 런타임 대역.
function makeStub({ exit = 0, stderr = '', stdout = '' }) {
  const dir = tmp('stub');
  const marker = path.join(dir, 'marker');
  const bin = path.join(dir, 'bouncer');
  fs.writeFileSync(bin, [
    '#!/bin/sh',
    `cat > '${marker}'`,
    `printf '%s' '${stdout}'`,
    `printf '%s' '${stderr}' >&2`,
    `exit ${exit}`,
    '',
  ].join('\n'), { mode: 0o755 });
  return { bin, marker };
}

// node와 git만 보이는 PATH. 런타임(bouncer)이 PATH에 없는 상태를 만든다.
function barePath() {
  const dir = tmp('bin');
  fs.symlinkSync(process.execPath, path.join(dir, 'node'));
  const git = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  fs.symlinkSync(git, path.join(dir, 'git'));
  return dir;
}

function hookEnv(extra) {
  const base = { ...process.env, HOME: tmp('home'), GIT_CONFIG_NOSYSTEM: '1' };
  delete base.BOUNCER_BIN;
  return { ...base, ...extra };
}

function runClaude(command, cwd, env, rawPayload) {
  const input = rawPayload !== undefined ? rawPayload : JSON.stringify({ tool_input: { command }, cwd });
  const r = spawnSync(process.execPath, [path.join(root, 'hooks/commit-safety.js')], {
    input, encoding: 'utf8', env, cwd: os.tmpdir(),
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function runCursor(command, cwd, env) {
  const r = spawnSync(process.execPath, [path.join(root, 'hooks/cursor-commit-safety.js')], {
    input: JSON.stringify({ command, workspace_roots: [cwd] }), encoding: 'utf8', env, cwd: os.tmpdir(),
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const NOT_FOUND = 'commit-safety: bouncer runtime not found; put the bouncer CLI on PATH or set BOUNCER_BIN '
  + 'to its absolute path';

test('Claude hook given ls in a Bouncer repo → exits 0 without calling the runtime', () => {
  const repo = gitRepo({ bouncer: true });
  const stub = makeStub({});
  const r = runClaude('ls', repo, hookEnv({ BOUNCER_BIN: stub.bin }));
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(stub.marker), false);
});

test('Claude hook given a commit in a git repo without Bouncer context → exits 0 without the runtime', () => {
  const repo = gitRepo({ bouncer: false });
  const stub = makeStub({});
  const r = runClaude('git commit -m x', repo, hookEnv({ BOUNCER_BIN: stub.bin }));
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(stub.marker), false);
});

test('Claude hook given git -C . commit in a repo without Bouncer context → calls the runtime', () => {
  const repo = gitRepo({ bouncer: false });
  const stub = makeStub({});
  const r = runClaude('git -C . commit -m x', repo, hookEnv({ BOUNCER_BIN: stub.bin }));
  assert.equal(r.status, 0);
  assert.equal(fs.readFileSync(stub.marker, 'utf8'), 'git -C . commit -m x');
});

test('Claude hook given a commit outside any git repository → calls the runtime', () => {
  const dir = tmp('nogit');
  const stub = makeStub({});
  const r = runClaude('git commit -m x', dir, hookEnv({ BOUNCER_BIN: stub.bin }));
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(stub.marker), true);
});

test('Claude hook when the runtime exits 1 with a reason → exits 2 and relays the reason', () => {
  const repo = gitRepo({ bouncer: true });
  const stub = makeStub({ exit: 1, stderr: 'blocked: reason-x' });
  const r = runClaude('git commit -m x', repo, hookEnv({ BOUNCER_BIN: stub.bin }));
  assert.equal(r.status, 2);
  assert.equal(r.stderr, 'blocked: reason-x\n');
});

test('Claude hook given git status with no runtime available → exits 0', () => {
  const repo = gitRepo({ bouncer: true });
  const r = runClaude('git status', repo, hookEnv({ PATH: barePath() }));
  assert.equal(r.status, 0);
});

test('Claude hook given a commit with no runtime available → exits 2 with the not-found message', () => {
  const repo = gitRepo({ bouncer: true });
  const r = runClaude('git commit -m x', repo, hookEnv({ PATH: barePath() }));
  assert.equal(r.status, 2);
  assert.equal(r.stderr, `${NOT_FOUND}\n`);
});

test('Claude hook given a relative BOUNCER_BIN → exits 2 and names the reason', () => {
  const repo = gitRepo({ bouncer: true });
  const r = runClaude('git commit -m x', repo, hookEnv({ BOUNCER_BIN: 'relative/bouncer' }));
  assert.equal(r.status, 2);
  assert.ok(r.stderr.endsWith('(BOUNCER_BIN must be absolute)\n'), r.stderr);
});

test('Claude hook when the runtime exits 2 → exits 2 with the runtime-failed message', () => {
  const repo = gitRepo({ bouncer: true });
  const stub = makeStub({ exit: 2, stderr: 'unknown flag' });
  const r = runClaude('git commit -m x', repo, hookEnv({ BOUNCER_BIN: stub.bin }));
  assert.equal(r.status, 2);
  assert.equal(
    r.stderr,
    'commit-safety: bouncer runtime failed (2): unknown flag; check that `bouncer commit-guard --help` '
      + 'lists --command-stdin, or set BOUNCER_BIN to a current runtime\n',
  );
});

test('Claude hook given an unparsable payload → exits 0 without the runtime', () => {
  const stub = makeStub({});
  const r = runClaude('', os.tmpdir(), hookEnv({ BOUNCER_BIN: stub.bin }), 'not-json');
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(stub.marker), false);
});

test('Cursor hook given a commit with no runtime available → denies with the Claude hook message', () => {
  const repo = gitRepo({ bouncer: true });
  const env = hookEnv({ PATH: barePath() });
  const claude = runClaude('git commit -m x', repo, env);
  const cursor = runCursor('git commit -m x', repo, env);
  const res = JSON.parse(cursor.stdout);
  assert.equal(cursor.status, 0);
  assert.equal(res.permission, 'deny');
  assert.equal(res.userMessage, claude.stderr.replace(/\n$/, ''));
});

test('Cursor hook when the runtime writes stdout noise and exits 1 → emits only the deny JSON', () => {
  const repo = gitRepo({ bouncer: true });
  const stub = makeStub({ exit: 1, stdout: 'noise', stderr: 'blocked: reason-x' });
  const r = runCursor('git commit -m x', repo, hookEnv({ BOUNCER_BIN: stub.bin }));
  const res = JSON.parse(r.stdout);
  assert.equal(res.permission, 'deny');
  assert.equal(res.userMessage, 'blocked: reason-x');
  assert.equal(r.stdout.includes('noise'), false);
});

// ---------- 예기치 못한 throw는 차단 ----------

// PATH 앞쪽에 읽기 불가 디렉터리를 둬 statSync가 EACCES를 던지게 하는 env.
function unreadablePathEnv() {
  const locked = tmp('locked');
  fs.chmodSync(locked, 0o000);
  return hookEnv({ PATH: `${locked}${path.delimiter}${barePath()}` });
}

// root는 권한 검사를 우회하므로 EACCES를 만들 수 없다.
const canLock = typeof process.getuid === 'function' && process.getuid() !== 0;

test('Claude hook given a commit and an unreadable PATH entry → exits 2 instead of failing open',
  { skip: !canLock }, () => {
    const repo = gitRepo({ bouncer: true });
    const r = runClaude('git commit -m x', repo, unreadablePathEnv());
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^commit-safety: /);
  });

test('Cursor hook given a commit and an unreadable PATH entry → emits deny JSON', { skip: !canLock }, () => {
  const repo = gitRepo({ bouncer: true });
  const r = runCursor('git commit -m x', repo, unreadablePathEnv());
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).permission, 'deny');
});

test('Claude hook given a non-string cwd → exits 2', () => {
  const stub = makeStub({});
  const r = runClaude('', os.tmpdir(), hookEnv({ BOUNCER_BIN: stub.bin }),
    JSON.stringify({ tool_input: { command: 'git commit -m x' }, cwd: 5 }));
  assert.equal(r.status, 2);
});

test('Cursor hook given a non-string workspace root → emits deny JSON', () => {
  const stub = makeStub({});
  const r = spawnSync(process.execPath, [path.join(root, 'hooks/cursor-commit-safety.js')], {
    input: JSON.stringify({ command: 'git commit -m x', workspace_roots: [5] }),
    encoding: 'utf8',
    env: hookEnv({ BOUNCER_BIN: stub.bin }),
    cwd: os.tmpdir(),
  });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).permission, 'deny');
});
