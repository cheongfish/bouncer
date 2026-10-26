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
function fixture(version = '1.2.3') {
  const base = temp();
  const root = path.join(base, 'repo');
  const pluginTree = path.join(base, 'plugin');
  fs.mkdirSync(pluginTree);
  // syncVersions TARGETS가 요구하는 모든 manifest를 만들어 fixture 누락이 목표 Red보다 먼저 터지지 않게 한다.
  const manifests = {
    'package.json': { version },
    'packages/cli/package.json': { version },
    'package-lock.json': { version, packages: { '': { version }, 'packages/cli': { version } } },
    'plugin.json': { version },
    '.claude-plugin/plugin.json': { version },
    '.claude-plugin/marketplace.json': { plugins: [{ name: 'bouncer', version }] },
    '.codex-plugin/plugin.json': { version },
    '.cursor-plugin/plugin.json': { version },
  };
  for (const [rel, data] of Object.entries(manifests)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), JSON.stringify(data));
  }
  fs.writeFileSync(path.join(pluginTree, 'package.json'), JSON.stringify({ version }));
  fs.writeFileSync(path.join(pluginTree, 'plugin.json'), JSON.stringify({ version }));
  fs.writeFileSync(path.join(pluginTree, 'plugin.txt'), 'plugin\n');
  const tarball = path.join(base, 'runtime.tgz');
  fs.writeFileSync(tarball, 'immutable package bytes');
  const integrity = `sha512-${crypto.createHash('sha512').update(fs.readFileSync(tarball)).digest('base64')}`;
  const metadata = path.join(base, 'metadata.json');
  fs.writeFileSync(metadata, JSON.stringify([{ name: '@cheongfish/bouncer', version, integrity }]));
  return { root, tarball, metadata, pluginTree, version, integrity };
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
 * 실제 npm(libnpmpublish)은 게시 시 semver.clean으로 +build metadata를 버린 버전을 저장하므로,
 * 성공 `npm view` 응답의 version도 기본적으로 그 저장 형태를 돌려준다. registryVersion은
 * registry가 정규화 결과와 다른 버전을 응답하는 시나리오를 만들 때만 쓴다.
 *
 * @param {string[]} calls - 실행 순서를 기록할 배열
 * @param {string} integrity - registry가 응답할 dist.integrity
 * @param {{existing?: boolean, failPublish?: boolean, version?: string, registryVersion?: string}} options
 *   - registry 시나리오
 * @returns {(command: string, args: string[], opts: object) => object} deps.run
 */
function npmAndGit(calls, integrity, options = {}) {
  const version = options.version || '1.2.3';
  const stored = options.registryVersion || version.split('+')[0];
  return (command, args, opts) => {
    calls.push(`${command} ${args.join(' ')}`);
    if (command === 'git') {
      const result = spawnSync(command, args, { cwd: opts.cwd, env: opts.env, encoding: 'utf8' });
      return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
    }
    if (args[0] === 'view' && !options.existing && calls.filter((x) => x.startsWith('npm view')).length === 1) {
      return { status: 1, stdout: '', stderr: JSON.stringify({ error: {
        code: 'E404', pkgid: `@cheongfish/bouncer@${version}`,
      } }) };
    }
    if (args[0] === 'publish' && options.failPublish) return { status: 1, stdout: '', stderr: 'denied' };
    return { status: 0, stdout: JSON.stringify({ name: '@cheongfish/bouncer', version: stored,
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

const PUSH = { GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3' };

/** 호출 이력만 기록하고 항상 성공을 돌려주는 deps.run을 만든다. */
function recorder(calls) {
  return { run: (command, args) => { calls.push(`${command} ${args[0]}`); return { status: 0, stdout: '', stderr: '' }; } };
}

test('(j) version metadata drift → throws before the first external call', () => {
  const targets = ['package.json', 'packages/cli/package.json', 'plugin.json', '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json'];
  for (const rel of targets) {
    const input = fixture();
    const file = path.join(input.root, rel);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/1\.2\.3/g, '1.2.9'));
    const calls = [];
    assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: PUSH, deps: recorder(calls) }), Error, rel);
    assert.deepEqual(calls, [], rel);
  }
  const input = fixture();
  const lock = path.join(input.root, 'package-lock.json');
  const data = JSON.parse(fs.readFileSync(lock, 'utf8'));
  data.packages['packages/cli'].version = '1.2.9';
  fs.writeFileSync(lock, JSON.stringify(data));
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: PUSH, deps: recorder(calls) }), Error);
  assert.deepEqual(calls, []);
});

test('(k) E404 with another or missing pkgid and partial summary → no publish', () => {
  for (const error of [
    { code: 'E404', pkgid: '@cheongfish/bouncer@1.2.4', summary: 'no match for @cheongfish/bouncer@1.2.3' },
    { code: 'E404', summary: '@cheongfish/bouncer@1.2.3 is not in this registry' },
  ]) {
    const input = fixture();
    const calls = [];
    assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: PUSH, deps: {
      run: (command, args) => {
        calls.push(`${command} ${args[0]}`);
        return { status: 1, stdout: '', stderr: JSON.stringify({ error }) };
      } } }), /registry lookup failed/);
    assert.deepEqual(calls, ['npm view']);
  }
});

test('(l) top-level exact E404 object → publishes as a new version', () => {
  const input = fixture();
  remoteFor(input.root);
  const calls = [];
  const inner = npmAndGit(calls, input.integrity);
  const result = releaseRuntime({ ...input, mode: 'publish', env: PUSH, deps: { run: (command, args, opts) => {
    if (command === 'npm' && args[0] === 'view' && !calls.some((c) => c.startsWith('npm view'))) {
      calls.push(`${command} ${args.join(' ')}`);
      return { status: 1, stdout: '', stderr: JSON.stringify({ code: 'E404', pkgid: '@cheongfish/bouncer@1.2.3' }) };
    }
    return inner(command, args, opts);
  } } });
  assert.equal(result.npm, 'published');
});

test('(l2) npm 11 exact E404 output → publishes a missing version', () => {
  const input = fixture();
  remoteFor(input.root);
  const calls = [];
  const inner = npmAndGit(calls, input.integrity);
  const output = [
    'npm error code E404',
    'npm error 404 No match found for version 1.2.3',
    "npm error 404  The requested resource '@cheongfish/bouncer@1.2.3' could not be found or you do not have permission to access it.",
  ].join('\n');
  const result = releaseRuntime({ ...input, mode: 'publish', env: PUSH, deps: { run: (command, args, opts) => {
    if (command === 'npm' && args[0] === 'view' && !calls.some((call) => call.startsWith('npm view'))) {
      calls.push(`${command} ${args.join(' ')}`);
      return { status: 1, stdout: '', stderr: output };
    }
    return inner(command, args, opts);
  } } });
  assert.equal(result.npm, 'published');
});

test('(m) tag with build metadata matching every manifest → publishes', () => {
  const input = fixture('1.2.3-alpha.1+build.7');
  remoteFor(input.root);
  const result = releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3-alpha.1+build.7',
  }, deps: { run: npmAndGit([], input.integrity, { version: input.version }) } });
  assert.equal(result.version, '1.2.3-alpha.1+build.7');
  assert.equal(result.plugin, 'pushed');
});

test('(m2) registry stores a version other than the build-stripped tag → throws before Git', () => {
  const input = fixture('1.2.3-alpha.1+build.7');
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3-alpha.1+build.7',
  }, deps: { run: npmAndGit(calls, input.integrity, {
    version: input.version, registryVersion: '1.2.3-alpha.2',
  }) } }),
  /registry package name\/version\/integrity mismatch/);
  assert.deepEqual(calls.map((c) => c.split(' ').slice(0, 2).join(' ')), ['npm view', 'npm publish', 'npm view']);
});

test('(n) numeric prerelease with leading zero → throws before the first external call', () => {
  const input = fixture('1.2.3-01');
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/tags/bouncer--v1.2.3-01',
  }, deps: recorder(calls) }), Error);
  assert.deepEqual(calls, []);
});

test('(o) registry failure matrix → blocks every later external write', () => {
  const good = (input) => JSON.stringify({ name: '@cheongfish/bouncer', version: '1.2.3', dist: { integrity: input.integrity } });
  const cases = [
    { name: 'E401', first: { status: 1, stderr: '{"error":{"code":"E401"}}' }, calls: ['npm view'] },
    { name: 'network', first: { status: 1, stderr: 'ECONNRESET' }, calls: ['npm view'] },
    { name: 'corrupt JSON', first: (i) => ({ status: 0, stdout: `{${good(i)}` }), calls: ['npm view'] },
    { name: 'null JSON', first: { status: 0, stdout: 'null' }, calls: ['npm view'] },
    { name: 'missing name', first: (i) => ({ status: 0, stdout: JSON.stringify({ version: '1.2.3',
      dist: { integrity: i.integrity } }) }), calls: ['npm view'] },
    { name: 'wrong version', first: (i) => ({ status: 0, stdout: JSON.stringify({ name: '@cheongfish/bouncer',
      version: '1.2.4', dist: { integrity: i.integrity } }) }), calls: ['npm view'] },
    { name: 'missing integrity', first: { status: 0, stdout: JSON.stringify({ name: '@cheongfish/bouncer',
      version: '1.2.3' }) }, calls: ['npm view'] },
    { name: 'wrong integrity', first: { status: 0, stdout: JSON.stringify({ name: '@cheongfish/bouncer',
      version: '1.2.3', dist: { integrity: 'sha512-x' } }) }, calls: ['npm view'] },
    { name: 'publish failure', first: { status: 1, stderr: '{"error":{"code":"E404","pkgid":"@cheongfish/bouncer@1.2.3"}}' },
      second: { status: 1, stderr: 'denied' }, calls: ['npm view', 'npm publish'] },
    { name: 'confirmation nonzero', first: { status: 0, stdout: 'ok' }, second: { status: 1, stderr: 'down' },
      skipFirstAssert: true, calls: ['npm view', 'npm view'] },
  ];
  for (const item of cases) {
    const input = fixture();
    const calls = [];
    const results = [item.first, item.second].filter(Boolean).map((r) => (typeof r === 'function' ? r(input) : r));
    // 확인 단계 불일치 시나리오: 첫 조회는 정상, 게시 후 확인 응답이 다른 산출물이면 Git을 막아야 한다.
    if (item.name === 'confirmation nonzero') results[0] = { status: 0, stdout: good(input) };
    let index = 0;
    assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: PUSH, deps: { run: (command, args) => {
      calls.push(`${command} ${args[0]}`);
      const out = results[Math.min(index, results.length - 1)];
      index += 1;
      return { status: 0, stdout: '', stderr: '', ...out };
    } } }), Error, item.name);
    assert.deepEqual(calls, item.calls, item.name);
  }
});

test('(p) publish then mismatched confirmation → stops before any Git call', () => {
  const input = fixture();
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: PUSH, deps: { run: (command, args) => {
    calls.push(`${command} ${args[0]}`);
    if (args[0] === 'view' && calls.length === 1) {
      return { status: 1, stdout: '', stderr: '{"error":{"code":"E404","pkgid":"@cheongfish/bouncer@1.2.3"}}' };
    }
    if (args[0] === 'publish') return { status: 0, stdout: '', stderr: '' };
    return { status: 0, stdout: JSON.stringify({ name: '@cheongfish/bouncer', version: '1.2.3',
      dist: { integrity: 'sha512-other' } }), stderr: '' };
  } } }), /mismatch/);
  assert.deepEqual(calls, ['npm view', 'npm publish', 'npm view']);
});

test('(q) real git fetch failure → no worktree add, commit, or push and no remote branch', () => {
  const input = fixture();
  const bare = remoteFor(input.root);
  const calls = [];
  const inner = npmAndGit(calls, input.integrity, { existing: true });
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: PUSH, deps: { run: (command, args, opts) => {
    // ls-remote만 release ref가 있다고 응답시키고 fetch는 존재하지 않는 ref로 실제 Git에서 실패시킨다.
    if (command === 'git' && args[0] === 'ls-remote') {
      calls.push(`${command} ${args.join(' ')}`);
      return { status: 0, stdout: 'abc\trefs/heads/release\n', stderr: '' };
    }
    return inner(command, args, opts);
  } } }), /git fetch failed/);
  assert.ok(calls.some((call) => call.startsWith('git fetch')));
  for (const verb of ['git worktree add', 'git commit', 'git push']) {
    assert.equal(calls.some((call) => call.startsWith(verb)), false, verb);
  }
  const branch = spawnSync('git', ['ls-remote', '--heads', bare], { cwd: input.root, encoding: 'utf8' });
  assert.equal(branch.stdout, '');
});

test('(r) workflow_dispatch with matching tag → publish rejected before external calls', () => {
  const input = fixture();
  const calls = [];
  assert.throws(() => releaseRuntime({ ...input, mode: 'publish', env: {
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/tags/bouncer--v1.2.3',
  }, deps: recorder(calls) }), /matching/);
  assert.deepEqual(calls, []);
});
