'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readCurrent, writeCurrent } = require('../scripts/lib/current');
const { init } = require('../scripts/lib/init');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-current-'));
}

test('readCurrent returns null when absent', () => {
  const repo = tmpRepo();
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('writeCurrent then readCurrent round-trips', () => {
  const repo = tmpRepo();
  const rel = writeCurrent({
    repoRoot: repo,
    blueprint: 'context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
  });
  assert.strictEqual(rel, '.bouncer/current');
  assert.ok(fs.existsSync(path.join(repo, '.bouncer', 'current')));
  assert.deepStrictEqual(readCurrent({ repoRoot: repo }), {
    blueprint: 'context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
  });
});

test('writeCurrent normalizes backslashes to POSIX', () => {
  const repo = tmpRepo();
  writeCurrent({ repoRoot: repo, blueprint: 'context\\epics\\EPIC-001-x', base: 'main' });
  assert.strictEqual(readCurrent({ repoRoot: repo }).blueprint, 'context/epics/EPIC-001-x');
});

test('readCurrent returns null when the pointer file is corrupt JSON', () => {
  const repo = tmpRepo();
  const abs = path.join(repo, '.bouncer', 'current');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '{ this is not json');
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('legacy .sdd/current is ignored and init rejects with bouncer-init guidance', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.sdd/current'), '{"blueprint":"legacy"}\n');
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
  const result = init({ repoRoot: repo, timestamp: '2026-07-24T00:00:00.000Z' });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /bouncer-init/);
});
