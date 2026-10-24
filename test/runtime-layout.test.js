'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const packageRoot = path.join(root, 'packages', 'cli');

test('package bouncer with a competing PATH bouncer-root → runs its own CLI', () => {
  const fakePath = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-fake-path-'));
  const fakeRoot = path.join(fakePath, 'bouncer-root');
  fs.writeFileSync(fakeRoot, '#!/usr/bin/env node\nprocess.stdout.write("wrong-root\\n");\n');
  fs.chmodSync(fakeRoot, 0o755);
  const result = spawnSync(process.execPath, [path.join(packageRoot, 'bin', 'bouncer'), '--help'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: fakePath },
  });
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /usage: bouncer/);
  assert.doesNotMatch(result.stdout, /wrong-root/);
});

test('package bouncer copied without source → runs dist without source freshness reads', () => {
  const copyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-tarball-'));
  fs.cpSync(path.join(packageRoot, 'bin'), path.join(copyRoot, 'bin'), { recursive: true });
  fs.cpSync(path.join(packageRoot, 'dist'), path.join(copyRoot, 'dist'), { recursive: true });
  assert.strictEqual(fs.existsSync(path.join(copyRoot, 'src')), false);
  const result = spawnSync(process.execPath, [path.join(copyRoot, 'bin', 'bouncer'), '--help'], {
    encoding: 'utf8',
    cwd: copyRoot,
    env: { ...process.env, PATH: '' },
  });
  assert.strictEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /usage: bouncer/);
});
