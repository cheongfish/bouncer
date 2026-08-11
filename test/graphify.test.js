// test/graphify.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { venvBinRel, resolveGraphifyBin } = require('../scripts/lib/graphify');

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
