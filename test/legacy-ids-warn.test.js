'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  discoverLegacyIds, legacyIdsWarnings,
} = require('../scripts/lib/migrate-ids');

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-legacy-warn-'));
}

test('legacyIdsWarnings is empty when no legacy dirs exist', () => {
  const repo = mkRepo();
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/001-auth'), { recursive: true });
  const d = discoverLegacyIds({ repoRoot: repo });
  assert.strictEqual(d.hasLegacy, false);
  assert.deepStrictEqual(legacyIdsWarnings(d), []);
});

test('legacyIdsWarnings mentions migrate-ids skill and dry-run CLI', () => {
  const repo = mkRepo();
  fs.mkdirSync(
    path.join(repo, '.bouncer/context/epics', 'EPIC-014-x', 'blueprints', 'BP-001-y'),
    { recursive: true },
  );
  const d = discoverLegacyIds({ repoRoot: repo });
  assert.strictEqual(d.hasLegacy, true);
  const lines = legacyIdsWarnings(d);
  assert.ok(lines.length >= 1);
  const text = lines.join('');
  assert.match(text, /legacy/i);
  assert.match(text, /migrate-ids|migrate ids/i);
  assert.match(text, /--dry-run/);
  assert.ok(lines.every((l) => l.endsWith('\n')));
});

test('SessionStart legacy hook prints warnings and exits 0', () => {
  const repo = mkRepo();
  fs.mkdirSync(
    path.join(repo, '.bouncer/context/epics', 'EPIC-001-auth', 'blueprints', 'BP-001-login'),
    { recursive: true },
  );
  const hook = path.join(__dirname, '../hooks/session-legacy-ids.js');
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd: repo }),
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  assert.match(result.stderr, /legacy/i);
  assert.match(result.stderr, /migrate/i);
  assert.strictEqual(result.stdout, '');
});

test('SessionStart legacy hook is silent with no legacy dirs and exits 0', () => {
  const repo = mkRepo();
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/001-auth'), { recursive: true });
  const hook = path.join(__dirname, '../hooks/session-legacy-ids.js');
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd: repo }),
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, '');
  assert.strictEqual(result.stdout, '');
});

test('SessionStart legacy hook swallows errors and still exits 0', () => {
  const hook = path.join(__dirname, '../hooks/session-legacy-ids.js');
  // Non-existent cwd still must not block the session.
  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd: path.join(os.tmpdir(), 'bouncer-missing-repo-xyz') }),
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0);
});
