'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('init rejects legacy .sdd/ state with exit 1 and /bouncer-init guidance', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-init-'));
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.sdd/current'), '{"blueprint":"legacy"}\n');
  const { io, buf } = capture();
  const code = runCli(['init', '--repo', repo], io);
  assert.strictEqual(code, 1);
  const combined = `${buf.out}\n${buf.err}`;
  assert.match(combined, /\/bouncer-init/);
});
