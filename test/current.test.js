'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readCurrent, writeCurrent } = require('../scripts/lib/current');
const { init } = require('../scripts/lib/init');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-current-'));
}

function tmpGitRepo() {
  const repo = tmpRepo();
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  return repo;
}

function runtimeDeps(repo) {
  return {
    execFileSync,
    env: { ...process.env, XDG_STATE_HOME: path.join(repo, 'state') },
    platform: 'linux',
  };
}

test('readCurrent returns null when absent', () => {
  const repo = tmpRepo();
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('writeCurrent then readCurrent round-trips', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const rel = writeCurrent({
    repoRoot: repo,
    blueprint: 'context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
    deps,
  });
  const commonGitDir = path.join(repo, '.git');
  assert.strictEqual(rel, path.join(commonGitDir, 'bouncer', 'current'));
  assert.ok(fs.existsSync(rel));
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer', 'current')), false);
  assert.deepStrictEqual(readCurrent({ repoRoot: repo, deps }), {
    blueprint: 'context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
  });
});

test('writeCurrent normalizes backslashes to POSIX', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  writeCurrent({
    repoRoot: repo, blueprint: 'context\\epics\\EPIC-001-x', base: 'main', deps,
  });
  assert.strictEqual(
    readCurrent({ repoRoot: repo, deps }).blueprint,
    'context/epics/EPIC-001-x',
  );
});

test('readCurrent returns null when the pointer file is corrupt JSON', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const abs = path.join(repo, '.git', 'bouncer', 'current');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '{ this is not json');
  assert.strictEqual(readCurrent({ repoRoot: repo, deps }), null);
});

test('writeCurrent rejects a non-Git repository', () => {
  const repo = tmpRepo();
  assert.throws(
    () => writeCurrent({ repoRoot: repo, blueprint: 'bp', base: 'main' }),
    /Bouncer requires a Git repository for an active blueprint/,
  );
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
