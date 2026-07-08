'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');
const { init } = require('../scripts/lib/init');

test('advise CLI reports plan phase and its recommendation on a fresh repo', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-advise-'));
  init({ repoRoot: repo, timestamp: '2026-07-08T00:00:00.000Z' });
  let out = '';
  const code = runCli(['advise', '--repo', repo], { out: (s) => { out += s; }, err: () => {} });
  assert.strictEqual(code, 0);
  const res = JSON.parse(out);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.phase, 'plan');
  assert.strictEqual(res.run, '/ponytail lite');
  assert.strictEqual(res.auto_switch, false);
});
