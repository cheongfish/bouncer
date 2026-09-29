'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { archiveWorkspace } = require('./archive.cjs');

function workspaceIn(root) {
  const workspace = path.join(root, 'work', 'run-1');
  mkdirSync(path.join(workspace, '.git', 'bouncer', 'venv', 'bin'), { recursive: true });
  mkdirSync(path.join(workspace, '.worktrees', '001', 'integration'), { recursive: true });
  mkdirSync(path.join(workspace, 'empty'), { recursive: true });
  writeFileSync(path.join(workspace, 'src.js'), 'export const a = 1;\n');
  writeFileSync(path.join(workspace, '.worktrees', '001', 'integration', '.git'), 'gitdir: /workspace/.git/worktrees/integration\n');
  writeFileSync(path.join(workspace, '.git', 'bouncer', 'venv', 'bin', 'python'), 'x'.repeat(4096));
  symlinkSync('/usr/local/bin/python3', path.join(workspace, '.git', 'bouncer', 'venv', 'bin', 'python3'));
  return workspace;
}

test('a finished workspace is archived without the Graphify venv and removed only after verification', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'bench-archive-'));
  try {
    const workspace = workspaceIn(root);
    const archiveDir = path.join(root, 'archive');
    const result = archiveWorkspace(workspace, archiveDir);
    assert.equal(result.status, 'archived', result.error);
    assert.deepEqual(result.excluded, ['.git/bouncer/venv']);
    assert.equal(existsSync(workspace), false);
    const listing = execFileSync('tar', ['-tzf', result.path], { encoding: 'utf8' });
    assert.match(listing, /run-1\/empty\//);
    assert.doesNotMatch(listing, /venv/);
    const restored = path.join(root, 'restored');
    mkdirSync(restored);
    execFileSync('tar', ['-xzf', result.path, '-C', restored]);
    assert.equal(readFileSync(path.join(restored, 'run-1', 'src.js'), 'utf8'), 'export const a = 1;\n');
    assert.match(readFileSync(path.join(restored, 'run-1', '.worktrees', '001', 'integration', '.git'), 'utf8'),
      /\/workspace\/\.git\/worktrees\/integration/);
    assert.equal(archiveWorkspace(workspace, archiveDir).status, 'missing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an archive that cannot be created leaves the workspace in place', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'bench-archive-'));
  try {
    const workspace = workspaceIn(root);
    const archiveDir = path.join(root, 'archive');
    mkdirSync(archiveDir);
    writeFileSync(path.join(archiveDir, 'run-1.tar.gz'), 'older archive');
    const result = archiveWorkspace(workspace, archiveDir);
    assert.equal(result.status, 'failed');
    assert.match(result.error, /already exists/);
    assert.equal(existsSync(path.join(workspace, 'src.js')), true);
    assert.equal(readFileSync(path.join(archiveDir, 'run-1.tar.gz'), 'utf8'), 'older archive');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
