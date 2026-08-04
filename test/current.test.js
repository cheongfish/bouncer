'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { execFileSync } = require('node:child_process');
const {
  readCurrent, writeCurrent, clearCurrent, listReadyBlueprints,
} = require('../scripts/lib/current');
const { init } = require('../scripts/lib/init');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-current-'));
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writeBp(repo, {
  epicSlug, bpSlug, epicId, bpId, bpStatus, tasksStatus,
}) {
  const epicDir = `.bouncer/context/epics/${epicSlug}`;
  const bpDir = `${epicDir}/blueprints/${bpSlug}`;
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'e', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: epicId, epic_id: epicId, status: 'approved' },
  });
  writeDoc(repo, `${bpDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${bpDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: bpId, epic_id: epicId, blueprint_id: bpId, status: bpStatus,
    },
  });
  writeDoc(repo, `${bpDir}/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${bpDir}/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${bpId}`, epic_id: epicId, blueprint_id: bpId, status: tasksStatus,
      affected_paths: [],
    },
  });
  return bpDir;
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
    blueprint: '.bouncer/context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
    deps,
  });
  const commonGitDir = path.join(repo, '.git');
  assert.strictEqual(rel, path.join(commonGitDir, 'bouncer', 'current'));
  assert.ok(fs.existsSync(rel));
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer', 'current')), false);
  assert.deepStrictEqual(readCurrent({ repoRoot: repo, deps }), {
    blueprint: '.bouncer/context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
  });
});

test('writeCurrent normalizes backslashes to POSIX', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  writeCurrent({
    repoRoot: repo, blueprint: '.bouncer\\context\\epics\\EPIC-001-x', base: 'main', deps,
  });
  assert.strictEqual(
    readCurrent({ repoRoot: repo, deps }).blueprint,
    '.bouncer/context/epics/EPIC-001-x',
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

// P3 dogfooding: finalize left the pointer in place, so every commit after a
// finished cycle was blocked against that blueprint's affected_paths.
test('clearCurrent removes the active pointer and is safe to repeat', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-clear-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  const deps = {
    execFileSync,
    env: { ...process.env, XDG_STATE_HOME: path.join(root, 'state') },
    platform: 'linux',
  };
  writeCurrent({ repoRoot: root, blueprint: 'b', base: 'develop', deps });
  assert.ok(readCurrent({ repoRoot: root, deps }));

  assert.strictEqual(clearCurrent({ repoRoot: root, deps }), true);
  assert.strictEqual(readCurrent({ repoRoot: root, deps }), null);
  assert.strictEqual(clearCurrent({ repoRoot: root, deps }), false);
});

test('listReadyBlueprints includes approved + ready / in_progress only', () => {
  const repo = tmpRepo();
  const ready = writeBp(repo, {
    epicSlug: 'EPIC-001-a', bpSlug: 'BP-001-ready', epicId: 'EPIC-001', bpId: 'BP-001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const inProg = writeBp(repo, {
    epicSlug: 'EPIC-001-a', bpSlug: 'BP-002-wip', epicId: 'EPIC-001', bpId: 'BP-002',
    bpStatus: 'approved', tasksStatus: 'in_progress',
  });
  writeBp(repo, {
    epicSlug: 'EPIC-001-a', bpSlug: 'BP-003-done', epicId: 'EPIC-001', bpId: 'BP-003',
    bpStatus: 'approved', tasksStatus: 'verified',
  });
  writeBp(repo, {
    epicSlug: 'EPIC-001-a', bpSlug: 'BP-004-draft', epicId: 'EPIC-001', bpId: 'BP-004',
    bpStatus: 'draft', tasksStatus: 'ready',
  });

  const list = listReadyBlueprints({ repoRoot: repo });
  assert.deepStrictEqual(list, [
    { blueprint: inProg, status: 'in_progress' },
    { blueprint: ready, status: 'ready' },
  ].sort((a, b) => a.blueprint.localeCompare(b.blueprint)));
});

test('listReadyBlueprints sorts across epics and skips broken docs', () => {
  const repo = tmpRepo();
  const later = writeBp(repo, {
    epicSlug: 'EPIC-002-z', bpSlug: 'BP-001-z', epicId: 'EPIC-002', bpId: 'BP-001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const earlier = writeBp(repo, {
    epicSlug: 'EPIC-001-a', bpSlug: 'BP-001-a', epicId: 'EPIC-001', bpId: 'BP-001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  // Corrupt frontmatter: skip this blueprint, keep enumerating the rest.
  const brokenDir = '.bouncer/context/epics/EPIC-001-a/blueprints/BP-099-broken';
  fs.mkdirSync(path.join(repo, brokenDir), { recursive: true });
  fs.writeFileSync(path.join(repo, brokenDir, 'index.md'), 'not frontmatter\n');
  fs.writeFileSync(path.join(repo, brokenDir, 'tasks.md'), 'not frontmatter\n');

  const list = listReadyBlueprints({ repoRoot: repo });
  assert.deepStrictEqual(list, [
    { blueprint: earlier, status: 'ready' },
    { blueprint: later, status: 'ready' },
  ]);
});
