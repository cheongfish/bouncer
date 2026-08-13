'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  runtimePaths, readRuntimeCurrent, writeRuntimeCurrent, worktreePathFor,
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
  // projectRoot는 checkout 종류와 무관하게 main worktree(정본)다.
  assert.strictEqual(primaryPaths.projectRoot, primary);
  assert.strictEqual(linkedPaths.projectRoot, primary);
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
  assert.strictEqual(windows.projectRoot, 'C:\\repo');
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
    blueprint: '.bouncer/context/epics/001-x/blueprints/001-y',
    base: 'develop',
  };

  const currentFile = writeRuntimeCurrent({ repoRoot: primary, ...value, deps });

  assert.ok(fs.existsSync(currentFile));
  // task 미지정 쓰기는 파일에 키를 넣지 않지만, 읽기는 항상 task: null 로 정규화한다.
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: linked, deps }), {
    ...value,
    task: null,
  });
});

test('writeRuntimeCurrent includes task key only when a string path is given', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  const task = `${blueprint}/tasks-002.md`;

  const withTask = writeRuntimeCurrent({
    repoRoot: primary, blueprint, base: 'develop', task, deps,
  });
  const written = JSON.parse(fs.readFileSync(withTask, 'utf8'));
  assert.strictEqual(written.task, task);
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), {
    blueprint, base: 'develop', task,
  });

  const withoutTask = writeRuntimeCurrent({
    repoRoot: primary, blueprint, base: 'develop', deps,
  });
  const omitted = JSON.parse(fs.readFileSync(withoutTask, 'utf8'));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(omitted, 'task'), false);
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), {
    blueprint, base: 'develop', task: null,
  });
});

test('readRuntimeCurrent treats missing or non-string task as null', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  fs.mkdirSync(path.dirname(paths.currentFile), { recursive: true });

  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  fs.writeFileSync(paths.currentFile, `${JSON.stringify({
    blueprint, base: 'develop',
  }, null, 2)}\n`);
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), {
    blueprint, base: 'develop', task: null,
  });

  fs.writeFileSync(paths.currentFile, `${JSON.stringify({
    blueprint, base: 'develop', task: 2,
  }, null, 2)}\n`);
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), {
    blueprint, base: 'develop', task: null,
  });
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

test('worktreePathFor defaults to nested epic/blueprint path without creating directories', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
    path.join(primary, '.worktrees', '023', '001'),
  );
  assert.strictEqual(fs.existsSync(path.join(primary, '.worktrees')), false);
});

test('worktreePathFor falls back to flat path when nested is missing', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  fs.mkdirSync(path.join(primary, '.worktrees', '001'), { recursive: true });
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
    path.join(primary, '.worktrees', '001'),
  );
});

test('worktreePathFor prefers nested when both nested and flat exist', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  fs.mkdirSync(path.join(primary, '.worktrees', '001'), { recursive: true });
  fs.mkdirSync(path.join(primary, '.worktrees', '023', '001'), { recursive: true });
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
    path.join(primary, '.worktrees', '023', '001'),
  );
});

test('worktreePathFor rejects legacy-prefixed ids and non-Git roots', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  assert.throws(() => worktreePathFor({
    repoRoot: primary,
    blueprint: '.bouncer/context/epics/EPIC-023/blueprints/BP-001',
    deps,
  }));
  const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  assert.throws(
    () => worktreePathFor({ repoRoot: nonGit, blueprint: bp, deps }),
    /Bouncer requires a Git repository for an active blueprint/,
  );
});
