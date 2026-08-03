'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  runtimePaths, readRuntimeCurrent, writeRuntimeCurrent, ensureWorktreeRoot,
} = require('../scripts/lib/runtime-state');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function linkedRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-runtime-'));
  const primary = path.join(root, 'primary');
  const linked = path.join(root, 'linked');
  fs.mkdirSync(primary);
  git(primary, ['init', '--quiet']);
  fs.writeFileSync(path.join(primary, 'README.md'), 'fixture\n');
  git(primary, ['add', 'README.md']);
  git(primary, ['-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'fixture']);
  git(primary, ['worktree', 'add', '--quiet', '--detach', linked]);
  return { root, primary, linked };
}

test('primary checkout and linked worktree share Git-local runtime paths', () => {
  const { primary, linked } = linkedRepo();
  const primaryPaths = runtimePaths({ repoRoot: primary, execFileSync, platform: 'linux' });
  const linkedPaths = runtimePaths({ repoRoot: linked, execFileSync, platform: 'linux' });

  assert.strictEqual(linkedPaths.commonGitDir, primaryPaths.commonGitDir);
  assert.strictEqual(primaryPaths.currentFile,
    path.join(primaryPaths.commonGitDir, 'bouncer', 'current'));
  assert.strictEqual(primaryPaths.worktreeRoot, path.join(primary, '.worktrees'));
  assert.deepStrictEqual(linkedPaths, primaryPaths);
});

test('worktree root is under the main repository checkout', () => {
  const { primary } = linkedRepo();
  const paths = runtimePaths({
    repoRoot: primary,
    execFileSync,
    platform: 'linux',
  });

  assert.strictEqual(paths.worktreeRoot, path.join(primary, '.worktrees'));
  assert.ok(paths.worktreeRoot.startsWith(`${primary}${path.sep}`));
  assert.ok(!paths.worktreeRoot.startsWith(`${paths.commonGitDir}${path.sep}`));
  assert.strictEqual(fs.existsSync(paths.currentFile), false);
  assert.strictEqual(fs.existsSync(paths.worktreeRoot), false);
});

test('win32 path API keeps worktrees beside the main checkout', () => {
  const exec = () => '.git\n';
  const windows = runtimePaths({
    repoRoot: 'C:\\repo', execFileSync: exec,
    env: {}, platform: 'win32',
  });
  assert.strictEqual(
    windows.worktreeRoot,
    path.win32.join('C:\\repo', '.worktrees'),
  );
});

test('runtime resolution is read-only and reports non-Git directories unavailable', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  const before = fs.readdirSync(repo);
  const paths = runtimePaths({
    repoRoot: repo, execFileSync, env: process.env, platform: process.platform,
  });

  assert.strictEqual(paths.unavailable, true);
  assert.ok(paths.reason);
  assert.deepStrictEqual(fs.readdirSync(repo), before);
});

test('runtime current round-trips across primary and linked worktrees', () => {
  const { primary, linked } = linkedRepo();
  const deps = {
    execFileSync,
    platform: 'linux',
  };
  const value = {
    blueprint: '.bouncer/context/epics/EPIC-001-x/blueprints/BP-001-y',
    base: 'develop',
  };

  const currentFile = writeRuntimeCurrent({ repoRoot: primary, ...value, deps });

  assert.ok(fs.existsSync(currentFile));
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: linked, deps }), value);
});

test('runtime current handles missing, corrupt, and non-Git state', () => {
  const { primary } = linkedRepo();
  const deps = {
    execFileSync,
    platform: 'linux',
  };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  assert.strictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), null);
  fs.mkdirSync(path.dirname(paths.currentFile), { recursive: true });
  fs.writeFileSync(paths.currentFile, '{ invalid');
  assert.strictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), null);

  const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  assert.strictEqual(readRuntimeCurrent({ repoRoot: nonGit, deps }), null);
  assert.throws(
    () => writeRuntimeCurrent({ repoRoot: nonGit, blueprint: 'bp', base: 'main', deps }),
    /Bouncer requires a Git repository for an active blueprint/,
  );
});

test('ensureWorktreeRoot is the explicit worktree directory creation boundary', () => {
  const { primary } = linkedRepo();
  const deps = {
    execFileSync,
    platform: 'linux',
  };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  assert.strictEqual(fs.existsSync(paths.worktreeRoot), false);

  assert.strictEqual(ensureWorktreeRoot({ repoRoot: primary, deps }), paths.worktreeRoot);
  assert.strictEqual(fs.existsSync(paths.worktreeRoot), true);
  assert.strictEqual(paths.worktreeRoot, path.join(primary, '.worktrees'));
});
