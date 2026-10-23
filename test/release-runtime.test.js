'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { releaseRuntime } = require('../scripts/release-runtime');

const temps = [];
function temp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-runtime-test-'));
  temps.push(dir);
  return dir;
}
test.after(() => temps.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

/**
 * 테스트 저장소를 만들고 일치하는 tarball/metadata/plugin 입력을 반환한다.
 *
 * @returns {{root: string, tarball: string, metadata: string, pluginTree: string, version: string}}
 *   격리된 유효 입력 묶음
 */
function fixture() {
  const base = temp();
  const root = path.join(base, 'repo');
  const pluginTree = path.join(base, 'plugin');
  fs.mkdirSync(path.join(root, 'packages/cli'), { recursive: true });
  fs.mkdirSync(pluginTree);
  fs.writeFileSync(path.join(root, 'packages/cli/package.json'), JSON.stringify({ version: '1.2.3' }));
  fs.writeFileSync(path.join(pluginTree, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  fs.writeFileSync(path.join(pluginTree, 'plugin.txt'), 'plugin\n');
  const tarball = path.join(base, 'runtime.tgz');
  fs.writeFileSync(tarball, 'immutable package bytes');
  const integrity = `sha512-${crypto.createHash('sha512').update(fs.readFileSync(tarball)).digest('base64')}`;
  const metadata = path.join(base, 'metadata.json');
  fs.writeFileSync(metadata, JSON.stringify([{ name: '@cheongfish/bouncer', version: '1.2.3', integrity }]));
  return { root, tarball, metadata, pluginTree, version: '1.2.3', integrity };
}

/**
 * git 명령을 실행하고 테스트 실패 시 원래 오류를 메시지로 노출한다.
 *
 * @param {string[]} args - git 인자
 * @param {string} cwd - 저장소 디렉터리
 * @returns {string} stdout
 */
function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/**
 * 실제 bare remote와 worktree 테스트용 저장소를 초기화한다.
 *
 * @param {string} root - helper가 사용할 저장소 경로
 * @returns {string} bare remote 경로
 */
function remoteFor(root) {
  const bare = `${root}-remote.git`;
  fs.mkdirSync(root, { recursive: true });
  git(['init', '-q'], root);
  git(['config', 'user.name', 'Test'], root);
  git(['config', 'user.email', 'test@example.test'], root);
  fs.writeFileSync(path.join(root, 'README.md'), 'repo\n');
  git(['add', '.'], root);
  git(['commit', '-qm', 'initial'], root);
  git(['init', '--bare', '-q', bare], path.dirname(root));
  git(['remote', 'add', 'origin', bare], root);
  return bare;
}

/**
 * npm 응답만 가짜로 바꾸고 Git은 로컬 bare remote에서 실제 실행한다.
 *
 * @param {string[]} calls - 실행 순서를 기록할 배열
 * @param {{existing?: boolean, failPublish?: boolean}} options - registry 시나리오
 * @returns {(command: string, args: string[], opts: object) => object} deps.run
 */
function npmAndGit(calls, integrity, options = {}) {
  return (command, args, opts) => {
    calls.push(`${command} ${args.join(' ')}`);
    if (command === 'git') {
      const result = spawnSync(command, args, { cwd: opts.cwd, env: opts.env, encoding: 'utf8' });
      return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
    }
    if (args[0] === 'view' && !options.existing && calls.filter((x) => x.startsWith('npm view')).length === 1) {
      return { status: 1, stdout: '', stderr: JSON.stringify({ error: {
        code: 'E404', pkgid: '@cheongfish/bouncer@1.2.3',
      } }) };
    }
    if (args[0] === 'publish' && options.failPublish) return { status: 1, stdout: '', stderr: 'denied' };
    return { status: 0, stdout: JSON.stringify({ name: '@cheongfish/bouncer', version: '1.2.3',
      dist: { integrity } }), stderr: '' };
  };
}

test('(a) manual dry-run → returns without registry or git subprocesses', () => {
  const input = fixture();
  const calls = [];
  const result = releaseRuntime({ ...input, mode: 'dry-run', env: { GITHUB_EVENT_NAME: 'workflow_dispatch' },
    deps: { run: (...args) => { calls.push(args); return { status: 0, stdout: '', stderr: '' }; } } });
  assert.deepEqual(result, { ok: true, mode: 'dry-run', version: '1.2.3', npm: 'dry-run', plugin: 'dry-run' });
  assert.equal(calls.length, 0);
});

test('(b) wrong tag or digest → rejects before external commands', () => {
  const input = fixture();
  const calls = [];
  const deps = { run: (...args) => { calls.push(args); return { status: 0, stdout: '', stderr: '' }; } };
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.4',
  }, deps }), /matching/);
  fs.writeFileSync(input.tarball, 'changed');
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3',
  }, deps }), /integrity/);
  assert.equal(calls.length, 0);
});

test('(c) npm publish failure → runs no Git command', () => {
  const input = fixture();
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3',
  }, deps: { run: (command, args) => {
    calls.push(`${command} ${args[0]}`);
    return args[0] === 'view'
      ? { status: 1, stdout: '', stderr: '{"error":{"code":"E404","pkgid":"@cheongfish/bouncer@1.2.3"}}' }
      : { status: 1, stdout: '', stderr: 'denied' };
  } } }), /npm publish failed/);
  assert.deepEqual(calls, ['npm view', 'npm publish']);
});

test('(d) absent npm version → publishes then confirms before first Git call', () => {
  const input = fixture();
  remoteFor(input.root);
  const calls = [];
  const result = releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3',
  }, deps: { run: npmAndGit(calls, input.integrity) } });
  const publish = calls.findIndex((call) => call.startsWith('npm publish'));
  const confirm = calls.findIndex((call, index) => index > publish && call.startsWith('npm view'));
  const firstGit = calls.findIndex((call) => call.startsWith('git '));
  assert.ok(publish >= 0 && confirm > publish && firstGit > confirm);
  assert.equal(result.plugin, 'pushed');
  assert.equal(git(['--git-dir', `${input.root}-remote.git`, 'rev-list', '--count', 'refs/heads/release'], input.root), '1');
});

test('(e) verified npm version and matching plugin tree → skips commit and push', () => {
  const input = fixture();
  remoteFor(input.root);
  const calls = [];
  const env = { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3' };
  const first = releaseRuntime({ ...input, mode: 'publish', env,
    deps: { run: npmAndGit(calls, input.integrity) } });
  assert.equal(first.plugin, 'pushed');
  const before = git(['rev-parse', 'refs/heads/release'], input.root);
  const retryCalls = [];
  const retry = releaseRuntime({ ...input, mode: 'publish', env,
    deps: { run: npmAndGit(retryCalls, input.integrity, { existing: true }) } });
  assert.equal(retry.npm, 'verified-existing');
  assert.equal(retry.plugin, 'unchanged');
  assert.equal(git(['rev-parse', 'refs/heads/release'], input.root), before);
  assert.equal(retryCalls.some((call) => call.startsWith('npm publish')), false);
  assert.equal(retryCalls.some((call) => call.startsWith('git push')), false);
});

test('(f) verified npm version and changed plugin tree → uses remote tip as parent', () => {
  const input = fixture();
  remoteFor(input.root);
  const env = { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3' };
  releaseRuntime({ ...input, mode: 'publish', env,
    deps: { run: npmAndGit([], input.integrity) } });
  const remote = `${input.root}-remote.git`;
  const previous = git(['--git-dir', remote, 'rev-parse', 'refs/heads/release'], input.root);
  fs.writeFileSync(path.join(input.pluginTree, 'plugin.txt'), 'updated plugin\n');
  const calls = [];
  const result = releaseRuntime({ ...input, mode: 'publish', env,
    deps: { run: npmAndGit(calls, input.integrity, { existing: true }) } });
  const commit = git(['--git-dir', remote, 'rev-list', '--parents', '-n', '1', 'refs/heads/release'], input.root);
  assert.equal(result.plugin, 'pushed');
  assert.ok(commit.split(' ').includes(previous), 'new release commit must retain the prior tip as parent');
});

test('(g) structured E404 for another version → stops without publishing or Git', () => {
  const input = fixture();
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3',
  }, deps: { run: (command, args) => {
    calls.push(`${command} ${args[0]}`);
    return { status: 1, stdout: '', stderr: '{"error":{"code":"E404","pkgid":"@cheongfish/bouncer@1.2.4"}}' };
  } } }), /registry lookup failed/);
  assert.deepEqual(calls, ['npm view']);
});

test('(h) ls-remote error → does not treat stderr as missing release branch', () => {
  const input = fixture();
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3',
  }, deps: { run: (command, args, opts) => {
    calls.push(`${command} ${args[0]}`);
    if (command === 'git' && args[0] === 'ls-remote') {
      return { status: 2, stdout: '', stderr: 'remote unavailable' };
    }
    return npmAndGit([], input.integrity, { existing: true })(command, args, opts);
  } } }), /git ls-remote failed/);
  assert.equal(calls.some((call) => call === 'git fetch'), false);
});

test('(i) rejected remote push → reports failure after local commit', () => {
  const input = fixture();
  const bare = remoteFor(input.root);
  const hook = path.join(bare, 'hooks', 'pre-receive');
  fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3',
  }, deps: { run: npmAndGit(calls, input.integrity) } }), /git push failed/);
  assert.ok(calls.some((call) => call.startsWith('git push')));
  const branch = spawnSync('git', ['ls-remote', '--heads', bare, 'refs/heads/release'],
    { cwd: input.root, encoding: 'utf8' });
  assert.equal(branch.status, 0);
  assert.equal(branch.stdout, '');
});
