'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');

function capture() {
  const chunks = { out: '', err: '' };
  return { io: { out: (s) => { chunks.out += s; }, err: (s) => { chunks.err += s; } }, chunks };
}

test('profile prints native for a fresh config', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-cli-profile-'));
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    JSON.stringify({ methodology: { profile: 'native' } }),
  );
  const { io, chunks } = capture();
  const code = runCli(['profile', '--repo', repo], io);
  assert.strictEqual(code, 0);
  assert.strictEqual(JSON.parse(chunks.out).profile, 'native');
});

test('profile resolves superpowers from legacy config', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-cli-profile-'));
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    JSON.stringify({ methodology: { verification: 'superpowers', review: 'superpowers' } }),
  );
  const { io, chunks } = capture();
  const code = runCli(['profile', '--repo', repo], io);
  assert.strictEqual(code, 0);
  assert.strictEqual(JSON.parse(chunks.out).profile, 'superpowers');
});
