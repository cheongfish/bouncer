'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readWavesPerSession } = require('../packages/cli/dist/config');

test('automatic and explicit wave limits → preserve the documented contract', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waves-'));
  try {
    fs.mkdirSync(path.join(dir, '.bouncer'));
    for (const [value, expected] of [[undefined, 2], ['auto', 2], [3, 3], [8, 8]]) {
      fs.writeFileSync(path.join(dir, '.bouncer/config.json'), JSON.stringify({ coordinator: { waves_per_session: value } }));
      assert.deepEqual(readWavesPerSession(dir), { ok: true, cap: expected });
    }
    assert.match(fs.readFileSync('docs/configuration.md', 'utf8'), /waves_per_session[^\n]*2/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
