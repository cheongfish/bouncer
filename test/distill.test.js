'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  readShards,
  routeShards,
  renderShards,
  resolveDistillRoot,
} = require('../scripts/lib/distill');
const {
  PROJECT_DISTILL,
  DISTILL_ROOT,
  DISTILL_INDEX,
} = require('../scripts/lib/layout');
const { checkDistillStructural } = require('../scripts/lib/validate-structural');
const { runCli } = require('../scripts/lib/cli');

function tmpRoot() {
  // runtimePaths는 git-common-dir을 path.resolve하므로, symlink된 tmpdir에서는
  // mkdtemp 문자열과 main worktree 절대 경로가 한 글자도 어긋난다.
  return fs.realpathSync(os.tmpdir());
}

function repoFixture() {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-distill-'));
  fs.mkdirSync(path.join(repo, DISTILL_ROOT), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts/src/lib'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  return repo;
}

function initBareGit(repo) {
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: repo, stdio: 'ignore' });
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  execFileSync('git', ['add', 'README'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: repo, stdio: 'ignore' });
}

function addLinkedCheckout(primary) {
  const linked = path.join(tmpRoot(), `bouncer-distill-linked-${crypto.randomBytes(6).toString('hex')}`);
  execFileSync('git', ['worktree', 'add', '--detach', linked, 'HEAD'], {
    cwd: primary,
    stdio: 'ignore',
  });
  return fs.realpathSync(linked);
}

function write(rel, content, repo) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function shard({ id, paths, pulls = [], always = false, body }, repo) {
  const pathMetadata = paths === undefined
    ? []
    : paths.length
      ? ['  paths:', ...paths.map((value) => `    - ${value}`)]
      : ['  paths: []'];
  write(`${DISTILL_ROOT}/${id}.md`, [
    '---',
    'distill:',
    `  id: ${id}`,
    `  always: ${always}`,
    ...pathMetadata,
    pulls.length ? '  pulls:' : '  pulls: []',
    ...pulls.map((value) => `    - ${value}`),
    '---',
    body,
    '',
  ].join('\n'), repo);
}

function index(repo, ids = ['core', 'ts', 'docs']) {
  write(PROJECT_DISTILL, [
    '---',
    'distill:',
    '  version: 1',
    '  shards:',
    ...ids.map((id) => `    - ${id}`),
    '---',
    '# Project Distill',
    '인덱스 요약',
    '',
  ].join('\n'), repo);
}

function captureCli(argv) {
  const output = { out: '', err: '' };
  const code = runCli(argv, {
    out: (value) => { output.out += value; },
    err: (value) => { output.err += value; },
  });
  return { code, ...output };
}

test('resolveDistillRoot prefers a Distill file on the linked checkout', () => {
  const primary = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-distill-primary-')));
  initBareGit(primary);
  const linked = addLinkedCheckout(primary);
  write(PROJECT_DISTILL, '# linked distill\n', linked);
  assert.strictEqual(resolveDistillRoot({ repoRoot: linked }), linked);
});

test('resolveDistillRoot falls back to main worktree, then the given root', () => {
  const primary = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-distill-primary-')));
  initBareGit(primary);
  // tracked면 worktree add가 linked에도 체크아웃해 1단계(파일 존재)에 걸린다.
  write(PROJECT_DISTILL, '# main distill uncommitted\n', primary);
  const linkedNoDistill = addLinkedCheckout(primary);
  assert.strictEqual(resolveDistillRoot({ repoRoot: linkedNoDistill }), primary);

  const nonGit = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-distill-nongit-')));
  assert.strictEqual(resolveDistillRoot({ repoRoot: nonGit }), nonGit);
});

test('layout keeps Project Distill and shard roots in one contract', () => {
  assert.strictEqual(DISTILL_INDEX, PROJECT_DISTILL);
  assert.strictEqual(DISTILL_ROOT, '.bouncer/distill');
});

test('readShards falls back to the exact single-file content for an invalid index', () => {
  const repo = repoFixture();
  const content = '---\ntitle: legacy\n---\n## Decisions\n\nkeep all\n';
  write(PROJECT_DISTILL, content, repo);

  const result = readShards({ repoRoot: repo });
  assert.strictEqual(result.mode, 'legacy');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.content, content);
  assert.strictEqual(renderShards(result), content);
});

test('readShards loads only a versioned non-empty shard index', () => {
  const repo = repoFixture();
  index(repo);
  shard({ id: 'core', always: true, body: '# Core\n\nalways\n' }, repo);
  shard({ id: 'ts', paths: ['scripts/src/lib/**'], pulls: ['core'], body: '# TypeScript\n' }, repo);
  shard({ id: 'docs', paths: ['docs/**'], body: '# Docs\n' }, repo);

  const result = readShards({ repoRoot: repo });
  assert.strictEqual(result.mode, 'sharded');
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.shards.map((entry) => entry.id), ['core', 'ts', 'docs']);
  assert.strictEqual(result.shards[1].paths[0], 'scripts/src/lib/**');
});

test('routeShards includes always, path matches, and transitive pulls', () => {
  const repo = repoFixture();
  index(repo);
  shard({ id: 'core', always: true, body: 'core' }, repo);
  shard({ id: 'ts', paths: ['scripts/src/lib/**'], pulls: ['core'], body: 'ts' }, repo);
  shard({ id: 'docs', paths: ['docs/**'], body: 'docs' }, repo);
  const state = readShards({ repoRoot: repo });

  const selected = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/src/lib/distill.ts'],
    routingEnabled: true,
    repoRoot: repo,
  });
  assert.deepStrictEqual(selected.ids, ['core', 'ts']);
  assert.strictEqual(selected.full, false);

  const directory = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/src/lib'],
    routingEnabled: true,
    repoRoot: repo,
  });
  assert.deepStrictEqual(directory.ids, ['core', 'ts']);
});

test('routeShards keeps an always shard valid when paths is omitted', () => {
  const repo = repoFixture();
  index(repo);
  shard({ id: 'core', always: true, body: 'core' }, repo);
  shard({ id: 'ts', paths: ['scripts/src/lib/**'], body: 'ts' }, repo);
  shard({ id: 'docs', paths: ['docs/**'], body: 'docs' }, repo);

  const state = readShards({ repoRoot: repo });
  assert.strictEqual(state.shards[0].paths, undefined);
  assert.strictEqual(state.shards[0].pathsKnown, true);

  const selected = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/src/lib/distill.ts'],
    routingEnabled: true,
    repoRoot: repo,
  });
  assert.strictEqual(selected.full, false);
  assert.deepStrictEqual(selected.ids, ['core', 'ts']);

  const noMatch = routeShards({
    shards: state.shards,
    affectedPaths: ['unrelated/file.txt'],
    routingEnabled: true,
    repoRoot: repo,
  });
  assert.strictEqual(noMatch.full, true);
  assert.deepStrictEqual(noMatch.ids, ['core', 'ts', 'docs']);
});

test('routeShards fails open when disabled or when no path matches', () => {
  const repo = repoFixture();
  index(repo);
  shard({ id: 'core', always: true, body: 'core' }, repo);
  shard({ id: 'ts', paths: ['scripts/src/lib/**'], body: 'ts' }, repo);
  shard({ id: 'docs', paths: ['docs/**'], body: 'docs' }, repo);
  const state = readShards({ repoRoot: repo });

  for (const options of [
    { routingEnabled: false, affectedPaths: ['scripts/src/lib/distill.ts'] },
    { routingEnabled: true, affectedPaths: ['unrelated/file.txt'] },
  ]) {
    const selected = routeShards({ ...options, shards: state.shards, repoRoot: repo });
    assert.strictEqual(selected.full, true);
    assert.deepStrictEqual(selected.ids, ['core', 'ts', 'docs']);
  }
});

test('routeShards fails open when a shard has uncertain path metadata', () => {
  const repo = repoFixture();
  index(repo, ['uncertain', 'ts']);
  write(`${DISTILL_ROOT}/uncertain.md`, [
    '---',
    'distill:',
    '  id: uncertain',
    '  paths: docs/**',
    '  pulls: []',
    '---',
    'uncertain',
    '',
  ].join('\n'), repo);
  shard({ id: 'ts', paths: ['scripts/**'], body: 'ts' }, repo);

  const state = readShards({ repoRoot: repo });
  assert.strictEqual(state.shards[0].pathsKnown, false);

  const selected = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/a.ts'],
    routingEnabled: true,
    repoRoot: repo,
  });
  assert.strictEqual(selected.full, true);
  assert.deepStrictEqual(selected.ids, ['uncertain', 'ts']);
});

test('routeShards fails open when an always shard has uncertain path metadata', () => {
  const repo = repoFixture();
  index(repo, ['always-uncertain', 'ts', 'docs']);
  write(`${DISTILL_ROOT}/always-uncertain.md`, [
    '---',
    'distill:',
    '  id: always-uncertain',
    '  always: true',
    '  paths: docs/**',
    '  pulls: []',
    '---',
    'always uncertain',
    '',
  ].join('\n'), repo);
  shard({ id: 'ts', paths: ['scripts/**'], body: 'ts' }, repo);
  shard({ id: 'docs', paths: ['docs/**'], body: 'docs' }, repo);

  const state = readShards({ repoRoot: repo });
  assert.strictEqual(state.shards[0].pathsKnown, false);

  const selected = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/a.ts'],
    routingEnabled: true,
    repoRoot: repo,
  });
  assert.strictEqual(selected.full, true);
  assert.deepStrictEqual(selected.ids, ['always-uncertain', 'ts', 'docs']);
});

test('routeShards fails open for unknown and cyclic pulls', () => {
  for (const cyclic of [false, true]) {
    const repo = repoFixture();
    index(repo, ['core', 'ts']);
    shard({
      id: 'core',
      paths: ['scripts/**'],
      pulls: cyclic ? ['ts'] : [],
      body: 'core',
    }, repo);
    shard({
      id: 'ts',
      paths: ['scripts/**'],
      pulls: cyclic ? ['core'] : ['missing'],
      body: 'ts',
    }, repo);
    const state = readShards({ repoRoot: repo });
    const selected = routeShards({
      shards: state.shards,
      affectedPaths: ['scripts/a.ts'],
      routingEnabled: true,
      repoRoot: repo,
    });
    assert.strictEqual(selected.full, true);
    assert.deepStrictEqual(selected.ids, ['core', 'ts']);
  }
});

test('renderShards preserves selected shard order and ignores the index summary', () => {
  const repo = repoFixture();
  index(repo);
  shard({ id: 'core', always: true, body: 'core body' }, repo);
  shard({ id: 'ts', paths: ['scripts/**'], body: 'ts body' }, repo);
  shard({ id: 'docs', paths: ['docs/**'], body: 'docs body' }, repo);
  const state = readShards({ repoRoot: repo });
  const selected = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/a.ts'],
    routingEnabled: true,
    repoRoot: repo,
  });

  const rendered = renderShards({ ...state, selection: selected });
  assert.match(rendered, /core body/);
  assert.match(rendered, /ts body/);
  assert.doesNotMatch(rendered, /인덱스 요약/);
  assert.doesNotMatch(rendered, /docs body/);
});

test('repository routing is enabled only after a clean full-mode preflight', () => {
  const repo = path.resolve(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(repo, '.bouncer/config.json'), 'utf8'));
  const state = readShards({
    repoRoot: repo,
    runtimePaths: { projectRoot: repo },
  });

  assert.strictEqual(config.distill.routing_enabled, true);

  // 전량 소비를 먼저 관찰한 결과가 같은 인덱스의 모든 shard를 포함해야
  // 선택 라우팅 활성화를 “파일이 존재한다”는 사실만으로 통과시키지 않는다.
  // linked checkout에서는 CLI가 main worktree의 runtime 경로를 사용하므로,
  // 이 저장소의 dogfood 증적은 이미 고정한 local runtime으로 직접 확인한다.
  const fullObservation = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/src/lib/validate.ts'],
    routingEnabled: false,
    repoRoot: repo,
  });
  assert.strictEqual(fullObservation.full, true);
  assert.deepStrictEqual(fullObservation.ids, state.ids);
  assert.strictEqual(renderShards({ ...state, selection: fullObservation }), renderShards(state));

  const structural = checkDistillStructural({ repoRoot: repo, config });
  assert.strictEqual(structural.ok, true);
  assert.deepStrictEqual(structural.warnings, []);
  assert.deepStrictEqual(structural.failures, []);

  const cases = [
    [['scripts/src/lib/validate.ts'], ['core', 'validate-gates', 'build-ts']],
    [['docs'], ['core', 'plugin-skills']],
    [
      ['scripts/src/lib/validate.ts', 'docs/configuration.md'],
      ['core', 'validate-gates', 'plugin-skills', 'build-ts'],
    ],
  ];
  for (const [affectedPaths, ids] of cases) {
    const selection = routeShards({
      shards: state.shards,
      affectedPaths,
      routingEnabled: config.distill.routing_enabled,
      repoRoot: repo,
    });
    assert.strictEqual(selection.full, false);
    assert.deepStrictEqual(selection.ids, ids);
  }
});

test('repository route fail-open keeps full content and reports only stderr', () => {
  const repo = repoFixture();
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  write('unrelated.txt', 'known unrelated path\n', repo);
  write('.bouncer/config.json', JSON.stringify({ distill: { routing_enabled: true } }), repo);
  index(repo, ['source']);
  shard({ id: 'source', paths: ['src/**'], pulls: [], body: 'source body' }, repo);

  const result = captureCli(['distill', '--repo', repo, '--for', 'unrelated.txt', '--json']);
  const payload = JSON.parse(result.out);
  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.full, true);
  assert.deepStrictEqual(payload.ids, ['source']);
  assert.strictEqual(payload.content, 'source body\n');
  assert.strictEqual(result.err, 'distill: no-match; using all shards\n');
});

test('byte threshold warns without truncating the routed result', () => {
  const repo = repoFixture();
  index(repo, ['source']);
  shard({ id: 'source', paths: ['src/**'], pulls: [], body: 'x'.repeat(20) }, repo);
  const config = {
    source_dirs: ['src'],
    distill: { routing_enabled: false, max_bytes: 1 },
  };
  const structural = checkDistillStructural({ repoRoot: repo, config });
  const state = readShards({ repoRoot: repo });
  const selection = routeShards({
    shards: state.shards,
    affectedPaths: ['src/index.ts'],
    routingEnabled: false,
    repoRoot: repo,
  });
  const rendered = renderShards({ ...state, selection });
  const resultBytes = Buffer.byteLength(rendered, 'utf8');

  assert.ok(structural.warnings.some((entry) => entry.code === 'S26'));
  assert.deepStrictEqual(structural.failures, []);
  assert.strictEqual(resultBytes, 21);
  assert.ok(resultBytes > config.distill.max_bytes);
  assert.strictEqual(rendered, state.shards[0].body);
});

function bulletHashes(markdown) {
  let current = null;
  const blocks = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (/^#/.test(line)) {
      if (current) blocks.push(current);
      current = null;
      continue;
    }
    if (line.startsWith('- ')) {
      if (current) blocks.push(current);
      current = line;
    } else if (current) {
      current += `\n${line}`;
    }
  }
  if (current) blocks.push(current);
  return blocks
    .map((block) => crypto.createHash('sha256')
      .update(block.replace(/\n+$/, '') + '\n')
      .digest('hex'))
    .sort();
}

const ORIGINAL_BULLET_HASHES = [
  'c3a6556380e2bb4b944dffb8cf612dfd8502f7a56bb447a41217fa03287b4aa6',
  'a37a016323d7f3c234639bb7cf535348269d883a9ecb6871c6f01f7015f29be6',
  '28dd26b30b494dd4564bbdcc1fea8f08e1beff4313979062e2fb3288172baeb4',
  '04124b36e01acc90404f9b6e9c14665fee8bb8bf03ac26effe5925915c7f36a3',
  '40359f0f48b2384d028a53d5039dc8283b37452cdb78ca0577157c12373a4367',
  '6b4c525e2631a40517949e60be0e5574748e20ce566651f733d42c2fb1fe70c8',
  '1e6cc8236303563c3603d22892864f883b07b1f986d8af6932b2f7ce9606a621',
  '4f6a8cb9e47ba7abb808567943ef49a878a072802f722a73d163c9914edd496c',
  '4fca8477e31dfc32d931c8d7cc206f00d0960d8b8fc7893bea3ad493cbdbcc91',
  '399cb98633ae5abdef00f45488353c50256fca0324ffbccc24219c0373bf9be5',
  '38416b1040c3fb27659c3ce8e6f7db839eede332a120273db685d172bc5dc5e2',
  'ed1c8c8ee624cb792e05fd84ab4e98123b08730e54439c8c8a05a82ffb71a86d',
  'f85fd8872df3022ddcab9f6546620278bccdb0776452caffd8daa4169df18d05',
  'a8552a881c231292c76661eea6c78ad82562c5a64d0cc934b1fdf691ce8f61d7',
  '73874595cd75bc85ee44255c79c7275129a48dd08da01f925fc415b223133167',
  'caa211e43f56b4e8872c6289d710e4b0eaf231f11513db91e858d9f89a501fc3',
  '7160010e89c56fb4838ae5af1f76dd5f03bcefb35b90656ea8738d46894fd1ec',
  '0e1968dcfe5d5fa79e6f0fdbc3264d4381ae391b6a8cb35bbcce791007ed45f0',
  '0a27217686d31a626261a5ac76c8cee8e510f940541cdbde423d901bd8efbb3e',
  'deb80ebdc3fcfcca85a90a7dc7203c0246818a97125d44edd2e2cec380ac5d24',
  '5c3167b46a1b5ec9862474203d1a3128347d064a8f691b67fa84c9728974ba34',
  'a301252f382f396cc4062af353ac268b15ecc6e664d2995e516ba7342388c86a',
  '53a9896a8510dad47a3b34b9d74084e0ceeba3492196f93ab66c729a95dbf3fc',
  '2ae4023d646735f15697bc23aad48d3a80adfd5fd3f7e8b098814bcb83cf9d4d',
  '114c3296c38adb8bf2ab68a08f84a52251aee7c601a4b11ac306cea753c1b788',
  '622f00ad669681ccd553273a88ae7c735e357ba4d05cdfd00fa414d9d38a2e11',
  'a7e73cece0e0f9c11af5c2293ee876cda69dc2c0fdb1056492a31a5a361d4d0a',
  '30ffa005c372516fec178cf85b14fa3094081598aea9cdb169b09c579284c7de',
  '6ce79d1fd8b9e87843870c1fd597baca58f36eca356081f72146c5840045ef94',
  '88a63d0d0c2fcf552dfedc6a1c054af180e43cf6a7230ed2327f348ee21d5e78',
  '4f5433a6bb512c1c6b7e2b8ce4b769acc01d828f5d337aeeb06641d558a1cdb2',
  '42e7d68bb26d7c1e3bad2720d8ca1b35dc66d418075ad4179b8607953a04064e',
  'ae4e2df6791cf23f8a313197334914aab69e20705bf26dbffb01c201c75ccbd0',
  '7fe2c1f40f845096839af2d092e8ea8f7b578a7ab3c8f39ba5b88d40cdc9ffeb',
  '569f232c8b41141586693873fb51e6b7e8be27fdfae2df1064cc11f8347fd918',
  '68dc8c80fa8df0911e85d077af954ec345a3d2f35be1f7662bec251e81735006',
  '3a050b904b6c35e887e59896a3d79a08e9cacef601dbc3cace3d4172beef24ed',
  '5a42427dc243686e0023e795899978fdb7094b5be9dc775df407a1a5c8bce413',
  '1f2fed4389738278fa08b869e6f2435a88a62ce38cd8f78dac3422e1785c5109',
  'd52a8ae4637ba585516c3df467f5788f56989e8199285c265e53a6efe163761f',
  '271c66af13b239fb8f07d090ca6f50ba8ff0aa0c3f95ad58805b8e052a86eadf',
  '36473e4690de050b1b6adb687fc20677d1181fd0321438873b4cd7d70422cc90',
  '4801e566c41ea02d5037601ef09bb78fc479d88239d69be1ba3a19c5d852a28a',
  'a3c8a15de1d1a7e67dcacd38fb61cacc9948764ce2630b5212c4343a09293aac',
  '4596c26f464fb62c7e2a65f4b1f69fb02edf0a90d7004efc3aff4beb18310ea9',
  '8a2a8b7c6c6492478b270f9a187bbc493bd12e80db4396e58ae069be18157276',
  '503c307e8c66a2940425992920011233d1423ceb4a70f08e2800f83c8ddd347e',
  'd75a679ffe0ee2c7d1ae80f3611c371dc4cfd7f794d4d5def3697a100c78e175',
  'b9017f1fc87eae394022622ea0ea5e0d18d0d1051c7ee1cecbf61b0887136a0f',
  'bf84e19945ae450b7e62734adf58125a98b944e182817e4748b47f45b71b5964',
  '39e6e969e76869e05607c944e6305c915d02cabee0b0e1023afe9bc131321d94',
  '52b06fc402216408336c4193301a6c0eb031a10ebca4a322d4debb4aa188a2a9',
  'c54cbcd849b7afda34abcb61d5cf92bf81a92cdc3b5f4101685babe2c71aef53',
  'a63be6dedd93d08f25f183521f3b550fe8d75abe8f2cd1393bf1bf8da36f53d1',
  'ed7df64225d8d05bbdc097a1a88aabf08885a4157a45e7843eec5fae264c1e8c',
  '67a3e1ef9556d39a55c1705baa8dc40e6f586e4b716605971d81d4d62be77ae9',
  '4737cb56222fdee9bf1a35745ba45829ecfd662578cfaee8382c063302d9c633',
  '3231ed3b378e7eaa4048d7326041863ffc09ea0f61e2a679dbb5a04c89580f3a',
  'da8d18934162de22bc70bb7faaac29a13e93e8afdcd15318cd4b38338c2c287f',
  'dadd210ab4f49b859cc5108ea81519b8ccf2fffa17457d5d7a8421d4a0101532',
  'de6e847a45c1e060b4eafc082c3dbde2cca8d110e1d10b61c9aeb8dd1719e462',
  '9157d45d5d9e76a04ec25664588db823c177102506283a593da28392f45a514c',
  '9ee79c54a738c49274cbe4127a7141f0c704ae46bace2b94646a8e1e79097d4d',
  '8a42f44efbc5cd0e98f0e32f9e3cfe4e3af3459bfc35b1b9918e50f638198d7e',
  '2d136f2a58c5e4986de9aa431a00bcccd77b32cfcfeec2afaea86522c61ad783',
  'e1ed0e5d33acd24b9c95444b0d1c67907bb9cc3afa7103d2ad98e189e61343ce',
  '8728ed485325b2b98bba59de11c424cfcc00a03e59c6950d00928af562e49efb',
  '588d07141d4b4d11ca329c9705b03b00192f06ce26334e2cba5ad4ab3a33a9a8',
  '64c094503f92c2e37517822cfa169e4826c0c87faea6496b54f3d84b74af1bab',
  'aefc0f77f28ea773a1b7fa224e375583530321e9768dd1ee344395e7d286863d',
  '7aae8f36aaf032a95cf3d574ce991d74b5d62a4ec77d5eff4db4b12bb3d0ce9c',
  '55bbaefa03a3ba01cea27be0ea973b0eb5955be7344092f988f91c2f16745dbe',
  '259c5f18761e7ec16016f6f0bb2e57cad004a5c2e0d1f86f868ddac36d8a5ce9',
  '2015e4f3de1fbfcea6262e8ee757f8f40ca3cf820c49d1c86419147c9e87c546',
  '3ed91246e2b7766837f445cc6411cc3797bd7872e6d387f560bf131f2c85a7cd',
  'af466c53318f03af1670cea62c2802d74998cebcfd2aec72ff185cda0ca2485d',
  'dcf13144f1589ad39a1786e00898c0bfe6a20ad2217b1eece7f72c6e881a9cc2',
  'bba23bf42728b1c283978d9057edb561eff40a5a69120efc9cd0e374794a9716',
  'f133dd77189d1bdbc98e52bac86a782b62a7c4604c9c9005c3f665986d72aa2b',
  'eb1f926de47d92dc9cb7a34b4353817f7aef73161c4064de73a0a0981b697716',
  '578569c20041378cbaeef68fab15c3e22f8091efe173ca6abda2c1ef4cef56c9',
  'a8f981a45fef5d3140257cd5e98ad49c7f0b8f8a5f20d3da507dd8e1a9292695',
  '6d0b2f80dcf236250252c6fc86ebd34f869c9026236080534ba253b098e8b1dd',
  '6e0adf8215853ed6d92a98383b953b49cdda7c203c0e4e6802a22906f8f1c647',
  'bcd4a90324ddefbc9d64ac9a8fc31973e067769a0fc4810c2bff6a2a6db181bd',
  'e48699f9b02c4776516baa000b77abb4258e9e349fb0e81bd590315926cdaba4',
  '190756b4b2170a8fef24b8e61b9f7c0235c3086346db805c2d216416e650076a',
  'ad0d8fb7d6f9e2545347385d4c9460de8da10b55563f975f52500dfcab269c0a',
  '2bfbcae6f77b407ae62f9aba158f604a6cb5e49d08602923c9314e39c248ff54',
  '8d88dbeb156a6c098152e258926831cec0c2767fdefc3eee17acbd8e8506b8e9',
  'f74d4d9f67d4868fdfb6807bf8c7c4c07e9b0084fdb2577cacbde950170e93ef',
  'e45ba05175edb710854cf797aca93b4903ffa6bea6d39bd6f7482c733b83840e',
  'f94c37f38a856b89f6f92ac4e1117b62a9caeded7c6df02ab15309cae5bd199a',
  '968c9803cc6b33ce4814768da5cf74950bd3fcb5dd48941c1c3206895924f775',
  '0440d732ab430251d0ec4a2b6f7622cd5717ed8b69e42a7db73d8c6f6678027c',
  '55f34b05e54b230443cf3eb5d6ac0fc94b10db9d7476946cb1729abeb53948d0',
  '81002fa0592d643244ba2cb54b29ca0234e86f5138aead05d9dd334ddf087a47',
  '315fa0b32e75ca14f8d0b6d43db1e7669b20acd16a2de044c738bac837371779',
  '08f0bedc76e6a1ef0f8aa568cf751deb7c856cf71c8d4fe5e6cd9303965043d3',
  'dba2e022f1a9f9f7051cfe8adabb6b6394a65f1479ca6172c10d4ec3c9bc38a1',
  '073dea06c6a419f45f8c063826b32cedf78a6d6c5d5d6b8f14343b50d266ef58',
  '159d07bd818ff3fb06689229add67dfb94da09b4a4fb0ebeb238743949046c6e',
  '23f02ba729e1be14f9fb1e4addbf29f77f42a29ebe88d44b11bdd6c098f85bec',
  '11a8cc0ae1170dcd21099207795c04a965aac839d924a2a28040ba74060710b3',
  '4458a3012574c29e7e6556f5e7d99d759fd2266f9ea86602f061e3b396b550b1',
  '1353c5e99799c603d8baa3945c38df579a9bf537054a75e6a9c35fedaa373e36',
  'f075e694fa78385ad119c963af35e435d926a1a900424f3a7af32a0187547e07',
  '2da6318857ad0c461c0147b895d15540d507b0dfdbe9b80a7e795e83014a0c29',
  // 샤딩 브랜치 스냅샷 이후 develop에서 합류한 Distill 불릿(core 샤드로 배치).
  '39ba82e381547bd43103bb57f56a944a0e816212642ef689987b92ce516c3c69',
  '45e5abef97032f16baa4a7ce4ad5873576c99ed42c10657552f7d2d0c7f5ca72',
  '14e82b8c89106931bbb81d0eeeeedb72b62fe944048f238fbccb8530495c3141',
  // 039/001 finalize: build-ts strict 기본값·vendor·ci·coverage 승격 (strict:false 유예 제거).
  'd3e3009a0c1d85f0d64bdbe1b76b2cb77cc1ad4371674846f8fb95589e0d9d44',
  'b82b050700a6e05d8b5249a3d24bee3f2dbec0f89e555b98ade12185aca2df89',
  '3d45893edf47844fc9f86533a0d23564428bcbafe486e2d41aca542124b2968a',
  '50aeac9315bf9743ed5dada751bc32fc176c7a34e6af5b450f18083a1e69a9bc',
  // 043/002 finalize: light 계약 승격. scale 판독 지점과 G18 면제 불릿을 교체하고
  // scaffold/게이트 계약·템플릿 fallback·측정 결론을 더했다.
  '2e5a905ac83af55192c6d670043926baa6f21ddcc85009209f52f654115169db',
  '33c5acba30d8067e31bdbe47e65b93640bcedac71e6882ba9bc2524cedcfc682',
  '6a8da7d54655626b6c355c7465648bf11bcbccbf63759e5375c2893a89718b85',
  '8b6dbcef258da639a88e18cbef630c5e43343df1a7d7d70bbc2440cfd4dece64',
  '9841932093d955c3398f24b888a0ba96baa71fa88b068288617ab26f485e92b0',
  '99f846a3c3d7826e40af163084cbe2947bd4e7ab832754a79f11a7b09cc14b96',
  'd22b833c851ef3e4a2370769c05d220f745bb31de09440baf664362732084df8',
];

test('repository Distill shards preserve every original bullet and remain fully renderable', () => {
  const repo = path.resolve(__dirname, '..');
  const state = readShards({
    repoRoot: repo,
    // 연결 worktree는 설계상 main checkout을 가리키므로, 이 감사는 현재 worktree를
    // 명시적인 runtime 경로로 고정해 샤드 파일 자체를 읽는다.
    runtimePaths: { projectRoot: repo },
  });

  assert.strictEqual(state.mode, 'sharded');
  assert.strictEqual(state.valid, true);
  assert.strictEqual(state.routing_enabled, false);
  assert.deepStrictEqual(state.ids, [
    'core',
    'validate-gates',
    'context-layout',
    'git-worktree',
    'graph',
    'plugin-skills',
    'build-ts',
  ]);
  for (const shard of state.shards) {
    assert.match(shard.body, /## Invariants/);
    assert.match(shard.body, /## Gotchas/);
    assert.match(shard.body, /## Decisions/);
    assert.strictEqual(shard.pathsKnown, true);
    assert.strictEqual(shard.pullsKnown, true);
  }

  const rendered = renderShards(state);
  assert.deepStrictEqual(bulletHashes(rendered), [...ORIGINAL_BULLET_HASHES].sort());

  const disabledSelection = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/src/lib/validate.ts'],
    routingEnabled: state.routing_enabled,
    repoRoot: repo,
  });
  assert.strictEqual(disabledSelection.full, true);
  assert.deepStrictEqual(
    bulletHashes(renderShards({ ...state, selection: disabledSelection })),
    [...ORIGINAL_BULLET_HASHES].sort(),
  );
});
