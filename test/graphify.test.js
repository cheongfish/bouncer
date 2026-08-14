// test/graphify.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { venvBinRel, resolveGraphifyBin, setupGraphify } = require('../scripts/lib/graphify');
const {
  realNewestMtime,
  resolveGraphScopes,
} = require('../scripts/lib/graph-scope');
const { makeAllowed, makeFinalizeAllowed } = require('../scripts/lib/scope');

test('venvBinRel returns POSIX-relative platform paths', () => {
  assert.strictEqual(venvBinRel('win32'), '.bouncer/.venv/Scripts/graphify.exe');
  assert.strictEqual(venvBinRel('linux'), '.bouncer/.venv/bin/graphify');
  assert.strictEqual(venvBinRel('darwin'), '.bouncer/.venv/bin/graphify');
});

test('resolveGraphifyBin prefers an existing config.graphify.bin', () => {
  const repoRoot = '/repo';
  const rel = 'tools/graphify';
  const r = resolveGraphifyBin({
    repoRoot,
    config: { graphify: { bin: rel } },
    platform: 'linux',
    exists: (p) => p === path.join(repoRoot, rel),
    hasOnPath: () => true,
  });
  assert.deepStrictEqual(r, { bin: path.join(repoRoot, rel), source: 'config' });
});

test('resolveGraphifyBin falls through to venv when config bin is missing or absent', () => {
  const repoRoot = '/repo';
  const venvRel = venvBinRel('linux');
  const venvAbs = path.join(repoRoot, venvRel);

  const noBin = resolveGraphifyBin({
    repoRoot,
    config: { graphify: { enabled: true } },
    platform: 'linux',
    exists: (p) => p === venvAbs,
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(noBin, { bin: venvAbs, source: 'venv' });

  const missingBin = resolveGraphifyBin({
    repoRoot,
    config: { graphify: { bin: 'tools/missing' } },
    platform: 'linux',
    exists: (p) => p === venvAbs,
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(missingBin, { bin: venvAbs, source: 'venv' });
});

test('resolveGraphifyBin uses PATH when venv dir exists but the executable does not', () => {
  const repoRoot = '/repo';
  const venvDir = path.join(repoRoot, '.bouncer/.venv/bin');
  const r = resolveGraphifyBin({
    repoRoot,
    config: null,
    platform: 'linux',
    // venv 디렉터리만 있고 실행 파일은 없음 — PATH 후보로 내려가야 한다.
    exists: (p) => p === venvDir,
    hasOnPath: () => true,
  });
  assert.deepStrictEqual(r, { bin: 'graphify', source: 'path' });
});

test('resolveGraphifyBin returns nulls when no candidate exists', () => {
  const r = resolveGraphifyBin({
    repoRoot: '/repo',
    config: { graphify: { bin: 'tools/nope' } },
    platform: 'linux',
    exists: () => false,
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(r, { bin: null, source: null });
});

test('resolveGraphifyBin never throws on malformed config shapes', () => {
  const cases = [
    { config: null },
    { config: { graphify: 'yes' } },
    { config: { graphify: { bin: 42 } } },
    { config: { graphify: { bin: '' } } },
  ];
  for (const over of cases) {
    assert.doesNotThrow(() => {
      const r = resolveGraphifyBin({
        repoRoot: '/repo',
        platform: 'linux',
        exists: () => false,
        hasOnPath: () => false,
        ...over,
      });
      assert.deepStrictEqual(r, { bin: null, source: null });
    });
  }
});

test('setupGraphify reuses an existing venv bin without calling exec', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-setup-'));
  const binRel = venvBinRel('linux');
  fs.mkdirSync(path.join(repo, path.dirname(binRel)), { recursive: true });
  fs.writeFileSync(path.join(repo, binRel), '');
  const calls = [];
  const r = setupGraphify({
    repoRoot: repo,
    platform: 'linux',
    exec: (...args) => { calls.push(args); },
  });
  assert.deepStrictEqual(r, { status: 'reused', bin: binRel });
  assert.strictEqual(calls.length, 0);
});

test('setupGraphify installs via venv → pip → graphify install in order', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-setup-'));
  const binRel = venvBinRel('linux');
  const pipAbs = path.join(repo, '.bouncer/.venv/bin/pip');
  const graphifyAbs = path.join(repo, binRel);
  const calls = [];
  const r = setupGraphify({
    repoRoot: repo,
    platform: 'linux',
    exec: (file, args, opts) => {
      calls.push({ file, args, cwd: opts && opts.cwd });
    },
  });
  assert.deepStrictEqual(r, { status: 'installed', bin: binRel });
  assert.strictEqual(calls.length, 3);
  assert.deepStrictEqual(calls[0], {
    file: 'python3',
    args: ['-m', 'venv', '.bouncer/.venv'],
    cwd: repo,
  });
  assert.deepStrictEqual(calls[1], {
    file: pipAbs,
    args: ['install', 'graphifyy'],
    cwd: repo,
  });
  assert.deepStrictEqual(calls[2], {
    file: graphifyAbs,
    args: ['install'],
    cwd: repo,
  });
});

test('setupGraphify stops after the first failing step and never throws', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-setup-'));
  const calls = [];
  let r;
  assert.doesNotThrow(() => {
    r = setupGraphify({
      repoRoot: repo,
      platform: 'linux',
      exec: (file, args) => {
        calls.push({ file, args });
        throw new Error('no python');
      },
    });
  });
  assert.strictEqual(r.status, 'failed');
  assert.strictEqual(r.bin, null);
  assert.match(r.reason, /venv/);
  assert.match(r.reason, /no python/);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0].args, ['-m', 'venv', '.bouncer/.venv']);
});

test('context freshness watches the Distill index and shard directory lifecycle', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-shard-fresh-'));
  fs.mkdirSync(path.join(repo, '.bouncer/distill'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), 'index');
  fs.writeFileSync(path.join(repo, '.bouncer/distill/core.md'), 'core');

  const context = resolveGraphScopes({ sourceDirs: [], contextDirs: ['.bouncer/context'] })
    .find((scope) => scope.name === 'context');
  // 기존 결정 객체 계약은 index만 노출한다. realNewestMtime이 이 입력을
  // 정본 shard 디렉터리까지 확장해 lifecycle을 계산한다.
  assert.deepEqual(context.watchFiles, ['.bouncer/Distill.md']);

  const graphMtime = Date.now() - 60_000;
  const touch = (rel, mtime) => {
    const abs = path.join(repo, rel);
    fs.utimesSync(abs, new Date(mtime), new Date(mtime));
  };
  touch('.bouncer/Distill.md', graphMtime);
  touch('.bouncer/distill/core.md', graphMtime);
  touch('.bouncer/distill', graphMtime);
  const old = realNewestMtime(repo, [], context.watchFiles);
  assert.ok(old <= graphMtime + 1);

  touch('.bouncer/distill/core.md', graphMtime + 1_000);
  assert.ok(realNewestMtime(repo, [], context.watchFiles) > old);

  const added = path.join(repo, '.bouncer/distill/added.md');
  fs.writeFileSync(added, 'added');
  assert.ok(realNewestMtime(repo, [], context.watchFiles) >= fs.statSync(added).mtimeMs);

  fs.unlinkSync(added);
  assert.ok(realNewestMtime(repo, [], context.watchFiles) >= fs.statSync(path.join(repo, '.bouncer/distill')).mtimeMs);
});

test('registered Distill shards are finalize-only scope allowances', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-shard-scope-'));
  fs.mkdirSync(path.join(repo, '.bouncer/distill'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), [
    '---',
    'distill:',
    '  version: 1',
    '  shards:',
    '    - core',
    '---',
    '## Decisions\n',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, '.bouncer/distill/core.md'), '## Decisions\n\ncore\n');
  fs.writeFileSync(path.join(repo, '.bouncer/distill/unregistered.md'), '## Decisions\n\nnope\n');

  const execute = makeAllowed({
    affectedPaths: ['scripts/src/lib/feature.ts'],
    blueprintDir: '.bouncer/context/epics/001-auth/blueprints/001-login',
  });
  const finalize = makeFinalizeAllowed({
    repoRoot: repo,
    affectedPaths: ['scripts/src/lib/feature.ts'],
    blueprintDir: '.bouncer/context/epics/001-auth/blueprints/001-login',
  });

  assert.strictEqual(execute('.bouncer/distill/core.md'), false);
  assert.strictEqual(execute('.bouncer/distill/unregistered.md'), false);
  assert.strictEqual(finalize('.bouncer/distill/core.md'), true);
  assert.strictEqual(finalize('.bouncer/distill/unregistered.md'), false);
});
