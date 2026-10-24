'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isStrictSemver, syncVersions } = require('../scripts/sync-versions');

const files = [
  'package.json',
  'packages/cli/package.json',
  'package-lock.json',
  'plugin.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
];

/**
 * 각 metadata의 필수 구조를 가진 임시 저장소를 만든다.
 *
 * @returns {string} fixture root
 */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-version-sync-'));
  const values = {
    'package.json': { version: '2.3.4-rc.1+build.7' },
    'packages/cli/package.json': { version: '2.3.4-rc.1+build.7' },
    'package-lock.json': {
      version: '2.3.4-rc.1+build.7',
      packages: {
        '': { version: '2.3.4-rc.1+build.7' },
        'packages/cli': { version: '2.3.4-rc.1+build.7' },
        'node_modules/example': { version: '9.8.7', integrity: 'sha512-keep' },
      },
    },
    'plugin.json': { version: '2.3.4-rc.1+build.7' },
    '.claude-plugin/plugin.json': { version: '2.3.4-rc.1+build.7' },
    '.claude-plugin/marketplace.json': {
      plugins: [{ name: 'bouncer', version: '2.3.4-rc.1+build.7' }],
    },
    '.codex-plugin/plugin.json': { version: '2.3.4-rc.1+build.7' },
    '.cursor-plugin/plugin.json': { version: '2.3.4-rc.1+build.7' },
  };
  for (const [rel, data] of Object.entries(values)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }
  return root;
}

function remove(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test('strict SemVer 2.0 → accepts prerelease and build metadata', () => {
  assert.strictEqual(isStrictSemver('1.2.3-alpha.1+build.5'), true);
  assert.strictEqual(isStrictSemver('1.2.3'), true);
});

test('ranges, v prefixes, and leading zeroes → reject as versions', () => {
  for (const value of ['^1.2.3', 'v1.2.3', '01.2.3', '1.2.3-01', '1.2.3-alpha.01']) {
    assert.strictEqual(isStrictSemver(value), false, value);
  }
});

test('metadata drift → check reports fields without writing files', () => {
  const root = fixture();
  try {
    const file = path.join(root, 'packages/cli/package.json');
    const before = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, JSON.stringify({ version: '0.0.1' }));
    const drifted = fs.readFileSync(file, 'utf8');
    assert.throws(() => syncVersions({ root, mode: 'check' }), /packages\/cli\/package.json:version: drift/);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), drifted);
    assert.notStrictEqual(drifted, before);
  } finally {
    remove(root);
  }
});

test('valid drift → write synchronizes targets and preserves unrelated metadata', () => {
  const root = fixture();
  try {
    const cli = path.join(root, 'packages/cli/package.json');
    fs.writeFileSync(cli, JSON.stringify({ version: '0.0.1', dependency: 'keep' }));
    const result = syncVersions({ root, mode: 'write' });
    assert.deepStrictEqual(result.changed, ['packages/cli/package.json']);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(cli, 'utf8')), {
      version: '2.3.4-rc.1+build.7', dependency: 'keep',
    });
    const snapshots = files.map((rel) => fs.readFileSync(path.join(root, rel), 'utf8'));
    assert.deepStrictEqual(syncVersions({ root, mode: 'write' }).changed, []);
    assert.deepStrictEqual(files.map((rel) => fs.readFileSync(path.join(root, rel), 'utf8')), snapshots);
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
        .packages['node_modules/example'],
      { version: '9.8.7', integrity: 'sha512-keep' },
    );
  } finally {
    remove(root);
  }
});

test('invalid root version and damaged JSON → stop before writing metadata', () => {
  const root = fixture();
  try {
    const cli = path.join(root, 'packages/cli/package.json');
    fs.writeFileSync(cli, JSON.stringify({ version: '0.0.1' }));
    const before = fs.readFileSync(cli, 'utf8');
    const manifest = path.join(root, 'plugin.json');
    const rootPackage = path.join(root, 'package.json');
    fs.writeFileSync(rootPackage, JSON.stringify({ version: '>=1.0.0' }));
    assert.throws(() => syncVersions({ root, mode: 'write' }), /invalid strict SemVer/);
    fs.writeFileSync(rootPackage, JSON.stringify({ version: '1.2.3' }));
    fs.writeFileSync(manifest, '{broken');
    assert.throws(() => syncVersions({ root, mode: 'write' }), /invalid JSON/);
    assert.strictEqual(fs.readFileSync(cli, 'utf8'), before);
  } finally {
    remove(root);
  }
});

test('missing required version field → stop before writing other targets', () => {
  const root = fixture();
  try {
    const cli = path.join(root, 'packages/cli/package.json');
    fs.writeFileSync(cli, JSON.stringify({ version: '0.0.1' }));
    const cursor = path.join(root, '.cursor-plugin/plugin.json');
    fs.writeFileSync(cursor, JSON.stringify({ name: 'cursor' }));
    assert.throws(() => syncVersions({ root, mode: 'write' }), /version: required field missing/);
    assert.strictEqual(JSON.parse(fs.readFileSync(cli, 'utf8')).version, '0.0.1');
  } finally {
    remove(root);
  }
});
