'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const {
  installPreCommitHook,
  internalCommitEnv,
} = require('../scripts/lib/pre-commit-hook');
const { writeCurrent } = require('../scripts/lib/current');
const yaml = require('js-yaml');

const LAUNCHER = path.resolve(__dirname, '..', 'scripts', 'bouncer');
const BP = '.bouncer/context/epics/001-x/blueprints/001-y';

function gitEnv(extra) {
  return {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'bouncer-test',
    GIT_AUTHOR_EMAIL: 't@example.com',
    GIT_COMMITTER_NAME: 'bouncer-test',
    GIT_COMMITTER_EMAIL: 't@example.com',
    ...extra,
  };
}

function git(repo, args, extraEnv) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: gitEnv(extraEnv),
  });
}

function tmpRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-pre-commit-'));
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 't@example.com']);
  git(repo, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  git(repo, ['add', 'README']);
  git(repo, ['commit', '-m', 'base']);
  return repo;
}

function hookPath(repo) {
  const common = git(repo, ['rev-parse', '--git-common-dir']).trim();
  return path.join(path.resolve(repo, common), 'hooks', 'pre-commit');
}

function pathWithoutBouncer() {
  return (process.env.PATH || '')
    .split(path.delimiter)
    .filter((dir) => {
      try {
        return !fs.existsSync(path.join(dir, 'bouncer'))
          && !fs.existsSync(path.join(dir, 'bouncer.cmd'));
      } catch (_e) {
        return true;
      }
    })
    .join(path.delimiter);
}

function writeTaskAndPointer(repo) {
  const rel = `${BP}/tasks/001/tasks.md`;
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump({
    type: 'bouncer.tasks',
    title: 't',
    description: 'd',
    resource: rel,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      affected_paths: ['src/in/'],
    },
  })}---\n# Tasks\n`);
  writeCurrent({ repoRoot: repo, blueprint: BP, base: 'main', task: rel });
}

test('installPreCommitHook writes a marked executable hook', () => {
  const repoRoot = tmpRepo();
  const result = installPreCommitHook({ repoRoot, launcherPath: LAUNCHER });
  assert.equal(result.preCommitHook, 'installed');
  const hook = hookPath(repoRoot);
  assert.match(fs.readFileSync(hook, 'utf8'), /^#!\/bin\/sh\n# bouncer-pre-commit v1\n/);
  const mode = fs.statSync(hook).mode & 0o111;
  assert.ok(mode !== 0, 'hook must be executable');
});

test('existing non-bouncer hook is chained and its exit code fails git commit', () => {
  const repoRoot = tmpRepo();
  const hook = hookPath(repoRoot);
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook, '#!/bin/sh\nexit 3\n', { mode: 0o755 });
  const result = installPreCommitHook({ repoRoot, launcherPath: LAUNCHER });
  assert.equal(result.preCommitHook, 'chained');
  const prev = `${hook}.bouncer-prev`;
  assert.ok(fs.existsSync(prev));
  const direct = spawnSync(hook, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: gitEnv(),
  });
  assert.equal(direct.status, 3);
  const commit = spawnSync('git', ['commit', '--allow-empty', '-m', 'x'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: gitEnv(),
  });
  assert.notEqual(commit.status, 0);
});

test('core.hooksPath skips install and returns a warning', () => {
  const repoRoot = tmpRepo();
  git(repoRoot, ['config', 'core.hooksPath', '.githooks']);
  const result = installPreCommitHook({ repoRoot, launcherPath: LAUNCHER });
  assert.equal(result.preCommitHook, 'skipped-hooks-path');
  assert.equal(typeof result.warning, 'string');
  assert.match(result.warning, /hooksPath|\.githooks/);
  assert.ok(!fs.existsSync(hookPath(repoRoot)));
});

test('missing CLI on PATH and missing launcher allows the commit with a warning', () => {
  const repoRoot = tmpRepo();
  const missing = path.join(repoRoot, 'no-such-bouncer');
  assert.equal(
    installPreCommitHook({ repoRoot, launcherPath: missing }).preCommitHook,
    'installed',
  );
  fs.writeFileSync(path.join(repoRoot, 'staged.txt'), 'x\n');
  git(repoRoot, ['add', 'staged.txt']);
  const commit = spawnSync('git', ['commit', '-m', 'x'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: gitEnv({ PATH: pathWithoutBouncer() }),
  });
  assert.equal(commit.status, 0, commit.stderr);
  assert.match(commit.stderr, /bouncer|CLI|not found|warning/i);
});

test('BOUNCER_INTERNAL_COMMIT=1 allows an out-of-scope staged commit', () => {
  const repoRoot = tmpRepo();
  writeTaskAndPointer(repoRoot);
  fs.writeFileSync(path.join(repoRoot, 'out.txt'), 'outside\n');
  git(repoRoot, ['add', 'out.txt']);
  assert.equal(
    installPreCommitHook({ repoRoot, launcherPath: LAUNCHER }).preCommitHook,
    'installed',
  );
  const blocked = spawnSync('git', ['commit', '-m', 'blocked'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: gitEnv(),
  });
  assert.notEqual(blocked.status, 0);
  const allowed = spawnSync('git', ['commit', '-m', 'internal'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: gitEnv(internalCommitEnv()),
  });
  assert.equal(allowed.status, 0, allowed.stderr);
});

test('rewriting a marked hook returns already-installed', () => {
  const repoRoot = tmpRepo();
  assert.equal(
    installPreCommitHook({ repoRoot, launcherPath: LAUNCHER }).preCommitHook,
    'installed',
  );
  assert.equal(
    installPreCommitHook({ repoRoot, launcherPath: LAUNCHER }).preCommitHook,
    'already-installed',
  );
});

test('second install refuses to overwrite an existing pre-commit.bouncer-prev', () => {
  const repoRoot = tmpRepo();
  const hook = hookPath(repoRoot);
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  const prev = `${hook}.bouncer-prev`;
  const savedPrev = '#!/bin/sh\necho saved-user-hook\n';
  const replacement = '#!/bin/sh\necho replacement-non-bouncer\n';
  fs.writeFileSync(prev, savedPrev, { mode: 0o755 });
  fs.writeFileSync(hook, replacement, { mode: 0o755 });
  assert.throws(
    () => installPreCommitHook({ repoRoot, launcherPath: LAUNCHER }),
    (err) => {
      assert.match(String(err && err.message), /bouncer-prev|overwrite/i);
      return true;
    },
  );
  assert.equal(fs.readFileSync(prev, 'utf8'), savedPrev);
  assert.equal(fs.readFileSync(hook, 'utf8'), replacement);
});

test('not a git directory returns skipped-no-git', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-pre-commit-nogit-'));
  const result = installPreCommitHook({ repoRoot, launcherPath: LAUNCHER });
  assert.equal(result.preCommitHook, 'skipped-no-git');
});
