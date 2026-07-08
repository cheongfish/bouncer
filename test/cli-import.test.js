'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runCli } = require('../scripts/lib/cli');

function tmpRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-cli-import-'));
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/plan.md'),
    '# X Implementation Plan\n\nTouch `src/x.js`.\n\n### Task 1: A\n\n- [ ] Step 1\n');
  return repo;
}
function capture() {
  const chunks = { out: '', err: '' };
  return { io: { out: (s) => { chunks.out += s; }, err: (s) => { chunks.err += s; } }, chunks };
}

test('import-superpowers CLI returns ok and writes docs', () => {
  const repo = tmpRepo();
  const { io, chunks } = capture();
  const code = runCli([
    'import-superpowers', '--repo', repo,
    '--epic', 'EPIC-001', '--epic-name', 'x',
    '--blueprint', 'BP-001', '--name', 'core',
    '--plan', 'docs/plan.md', '--timestamp', '2026-07-08T00:00:00.000Z',
  ], io);
  assert.strictEqual(code, 0);
  const res = JSON.parse(chunks.out);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.suggested_paths, ['src/x.js']);
});

test('import-superpowers CLI errors (exit 2) when neither --spec nor --plan given', () => {
  const repo = tmpRepo();
  const { io } = capture();
  const code = runCli([
    'import-superpowers', '--repo', repo,
    '--epic', 'EPIC-001', '--epic-name', 'x', '--blueprint', 'BP-001', '--name', 'core',
  ], io);
  assert.strictEqual(code, 2);
});
