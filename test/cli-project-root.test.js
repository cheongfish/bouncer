'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runCli } = require('../scripts/lib/cli');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function linkedRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-project-root-'));
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

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('project-root prints main worktree absolute path from primary and linked', () => {
  const { primary, linked } = linkedRepo();

  const fromPrimary = capture(['project-root', '--repo', primary]);
  assert.strictEqual(fromPrimary.code, 0);
  assert.strictEqual(fromPrimary.err, '');
  const projectRootStdout = fromPrimary.out;
  assert.strictEqual(projectRootStdout, `${primary}\n`);

  const fromLinked = capture(['project-root', '--repo', linked]);
  assert.strictEqual(fromLinked.code, 0);
  assert.strictEqual(fromLinked.err, '');
  assert.strictEqual(fromLinked.out, `${primary}\n`);
});

test('project-root rejects non-Git paths with stderr and exit 1', () => {
  const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-pr-'));
  const r = capture(['project-root', '--repo', nonGit]);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.out, '');
  assert.match(r.err, /git|Git|repository/i);
  // cwd나 빈 줄로 대체하지 않는다.
  assert.doesNotMatch(r.out, /\S/);
});
