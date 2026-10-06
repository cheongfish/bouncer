'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runCli } = require('../scripts/lib/cli');
const { writeCurrent } = require('../scripts/lib/current');
const yaml = require('js-yaml');

const BP = '.bouncer/context/epics/001-x/blueprints/001-y';

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

function git(repo, args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'bouncer-test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'bouncer-test',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  });
}

function tmpGit() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-guard-'));
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.email', 't@example.com']);
  git(repo, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'ok.txt'), 'ok\n');
  git(repo, ['add', 'ok.txt']);
  git(repo, ['commit', '-m', 'base']);
  fs.writeFileSync(path.join(repo, 'ok.txt'), 'changed\n');
  git(repo, ['add', 'ok.txt']);
  return repo;
}

test('commit-guard --staged allows when there is no active pointer', () => {
  const repo = tmpGit();
  const r = capture(['commit-guard', '--staged', '--repo', repo]);
  assert.equal(r.code, 0);
  assert.equal(r.out, '');
});

test('commit-guard without --staged exits 2', () => {
  const r = capture(['commit-guard']);
  assert.equal(r.code, 2);
});

test('commit-guard --staged blocks files outside affected_paths', () => {
  const repo = tmpGit();
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
  fs.writeFileSync(path.join(repo, 'out.txt'), 'outside\n');
  git(repo, ['add', 'out.txt']);
  const r = capture(['commit-guard', '--staged', '--repo', repo]);
  assert.equal(r.code, 1);
  assert.match(r.err, /out\.txt|affected_paths/);
  assert.equal(r.out, '');
});

test('commit-guard maps evaluate exceptions to exit 1', () => {
  const { runCommitGuard } = require('../scripts/lib/cli-commit-guard-command');
  let err = '';
  const code = runCommitGuard({
    argv: ['--staged'],
    cwd: os.tmpdir(),
    evaluate: () => {
      throw new Error('boom');
    },
    stderr: (s) => { err += s; },
  });
  assert.equal(code, 1);
  assert.match(err, /commit-guard: internal error, blocking commit: boom/);
});

test('commit-guard --repo is passed to evaluate', () => {
  const { runCommitGuard } = require('../scripts/lib/cli-commit-guard-command');
  let seen;
  const code = runCommitGuard({
    argv: ['--staged', '--repo', '/tmp/guard-repo'],
    cwd: '/cwd',
    evaluate: (opts) => {
      seen = opts.repoRoot;
      return { block: false };
    },
    stderr: () => {},
  });
  assert.equal(code, 0);
  assert.equal(seen, '/tmp/guard-repo');
});
