'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const checker = path.join(root, 'scripts', 'check-distribution.js');

test('clean snapshot runtime tgz → installs locally and globally with working CLI shims', () => {
  const result = spawnSync(process.execPath, [checker, '--smoke'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim());
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.mode, 'smoke');
  assert.ok(report.pluginFiles.length > 0);
  assert.ok(report.runtimeFiles.includes('bin/bouncer'));
});
