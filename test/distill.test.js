'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  readShards,
  routeShards,
  renderShards,
} = require('../scripts/lib/distill');
const {
  PROJECT_DISTILL,
  DISTILL_ROOT,
  DISTILL_INDEX,
} = require('../scripts/lib/layout');

function repoFixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-distill-'));
  fs.mkdirSync(path.join(repo, DISTILL_ROOT), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts/src/lib'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  return repo;
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
