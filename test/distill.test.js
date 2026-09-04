'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  readShards,
  routeShards,
  renderShards,
  resolveDistillRoot,
  pathMayIntersect,
} = require('../scripts/lib/distill');
const {
  PROJECT_DISTILL,
  DISTILL_ROOT,
  DISTILL_INDEX,
} = require('../scripts/lib/layout');
const { checkDistillStructural } = require('../scripts/lib/validate-structural');
const { runCli } = require('../scripts/lib/cli');
const { readDoc } = require('../scripts/lib/frontmatter');

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

test('default Distill max_bytes path warns above 6144 and passes below', () => {
  const repo = repoFixture();
  index(repo, ['big', 'small']);
  // 6144 위/아래. config에 distill.max_bytes 를 넣지 않아 DEFAULT를 탄다.
  shard({ id: 'big', paths: ['src/**'], pulls: [], body: 'x'.repeat(8877) }, repo);
  shard({ id: 'small', paths: ['src/**'], pulls: [], body: 'x'.repeat(5842) }, repo);

  const structural = checkDistillStructural({
    repoRoot: repo,
    config: { source_dirs: ['src'], distill: { routing_enabled: false } },
  });
  const s26 = structural.warnings.filter((entry) => entry.code === 'S26');
  assert.ok(s26.some((entry) => /big/.test(entry.message)));
  assert.ok(!s26.some((entry) => /small/.test(entry.message)));
  assert.deepStrictEqual(structural.failures, []);
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

function expectedBulletHashesFromShardFiles(repo) {
  // 기대값은 renderShards 출력이 아니라 샤드 파일을 직접 읽어 뽑는다.
  // 렌더 결과에서 다시 유도하면 읽기·렌더 파이프라인 버그가 자기 자신과
  // 같아져 감사가 비게 된다. 본문 손실은 양쪽이 함께 줄어 이 감사로는
  // 잡히지 않으며, 그 판정은 finalize 승격 동의와 diff 리뷰가 맡는다.
  const index = readDoc(path.join(repo, PROJECT_DISTILL));
  const ids = index.data.distill.shards.map((entry) => entry.id);
  const bodies = ids
    .map((id) => readDoc(path.join(repo, DISTILL_ROOT, `${id}.md`)).body)
    .join('');
  return bulletHashes(bodies);
}

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
  assert.strictEqual(state.routing_enabled, true);
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
    // core는 always-only: paths 키를 두면 미분류 fail-open이 경로 매칭으로 위장된다.
    if (shard.id === 'core') {
      assert.strictEqual(shard.always, true);
      assert.strictEqual(shard.paths, undefined);
    }
  }

  const expected = expectedBulletHashesFromShardFiles(repo);
  // 하한은 렌더 감사가 비어 있지 않음을 보장한다. 본문 다이어트 후 현실적 하한.
  assert.ok(expected.length > 20);

  const rendered = renderShards(state);
  assert.deepStrictEqual(bulletHashes(rendered), expected);

  // 저장소 인덱스가 routing_enabled: true여도 fail-open(전체 렌더)은 플래그
  // 값이 아니라 routingEnabled: false 강제 주입으로 검증한다. 인덱스 값을
  // 그대로 넘기면 라우팅이 켜져 full=true가 깨진다.
  const disabledSelection = routeShards({
    shards: state.shards,
    affectedPaths: ['scripts/src/lib/validate.ts'],
    routingEnabled: false,
    repoRoot: repo,
  });
  assert.strictEqual(disabledSelection.full, true);
  assert.deepStrictEqual(
    bulletHashes(renderShards({ ...state, selection: disabledSelection })),
    expected,
  );

  // 이 단언이 지키는 것은 "렌더·라우팅이 등록된 샤드를 다 싣는가" 하나다.
  // 샤드 본문 자체가 줄면 기대값도 함께 줄어 잡히지 않는다 — 의도된 사각지대.
  const dropped = { ...state, shards: state.shards.slice(1) };
  assert.notDeepStrictEqual(bulletHashes(renderShards(dropped)), expected);
});

function globStaticPrefix(pattern) {
  const wildcard = pattern.search(/[?*]/);
  const prefix = wildcard === -1 ? pattern : pattern.slice(0, wildcard);
  return prefix.replace(/\/+$/, '');
}

function isGitIgnored(repo, target) {
  if (!target) return false;
  // exit 0 = 무시됨, 1 = 아님. --quiet면 stdout이 비어 종료코드로만 판별한다.
  // `.worktrees/`처럼 디렉터리 전용 ignore는 경로가 아직 없으면 `.worktrees`(슬래시
  // 없음)를 파일로 보고 매칭에 실패한다. CI 클린 체크아웃에서도 면제되게 슬래시
  // 붙은 형태를 한 번 더 묻는다.
  const check = (t) =>
    spawnSync('git', ['check-ignore', '--quiet', '--', t], { cwd: repo }).status === 0;
  return check(target) || check(`${target}/`);
}

test('repository Distill shard files stay within locked UTF-8 byte budgets', () => {
  // 2026-09 Distill 대폭 다이어트 이후 상한. frontmatter 포함 파일 전체 UTF-8 바이트.
  // 초과 시 불릿을 합치거나 drop 한 뒤 다시 압축한다 — 단언을 약화해 통과시키지 않는다.
  const repo = path.resolve(__dirname, '..');
  const budgets = {
    core: 1536,
    'validate-gates': 1536,
    'context-layout': 1024,
    'git-worktree': 1536,
    graph: 1280,
    'plugin-skills': 2048,
    'build-ts': 768,
  };
  let total = 0;
  for (const [id, max] of Object.entries(budgets)) {
    const bytes = Buffer.byteLength(
      fs.readFileSync(path.join(repo, DISTILL_ROOT, `${id}.md`)),
      'utf8',
    );
    total += bytes;
    assert.ok(
      bytes <= max,
      `${id}.md must be <= ${max} UTF-8 bytes (got ${bytes})`,
    );
  }
  assert.ok(
    total <= 9728,
    `all registered shards must total <= 9728 UTF-8 bytes (got ${total})`,
  );
});

test('every registered Distill shard glob reaches at least one tracked file', () => {
  const repo = path.resolve(__dirname, '..');
  const index = readDoc(path.join(repo, PROJECT_DISTILL));
  const shards = index.data.distill.shards;
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repo, maxBuffer: 1 << 26 })
    .toString()
    .split('\0')
    .filter(Boolean);
  assert.ok(tracked.length > 0);

  // 라우팅은 글롭이 실제 파일에 닿아야만 샤드를 싣는다. 어느 파일에도 닿지
  // 않는 글롭은 조용히 사장되므로 — `scripts/src/lib/git*.ts`가 그랬다 —
  // 렌더 감사와 별개로 도달성을 따로 잡는다. 판정에는 라우터가 실제로 쓰는
  // pathMayIntersect를 그대로 써서 테스트와 런타임 의미가 갈라지지 않게 한다.
  const unreachable = [];
  for (const shard of shards) {
    for (const pattern of shard.paths || []) {
      if (tracked.some((file) => pathMayIntersect(repo, pattern, file))) continue;
      // `.worktrees/**`처럼 gitignore된 런타임 디렉터리는 추적 파일이 없는 것이
      // 정상이다. 오타로 죽은 글롭과 구분하려고 무시 여부를 git에 직접 묻는다.
      if (isGitIgnored(repo, globStaticPrefix(pattern))) continue;
      unreachable.push(`${shard.id}: ${pattern}`);
    }
  }
  assert.deepStrictEqual(unreachable, []);
});
