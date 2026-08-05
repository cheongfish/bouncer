// test/seed-worktree.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { seedWorktree } = require('../scripts/lib/seed-worktree');

const EPIC_REL = '.bouncer/context/epics/EPIC-001-auth';
const BP_REL = `${EPIC_REL}/blueprints/BP-001-login`;
const INDEX_REL = '.bouncer/context/index.md';
const COMMITTED_INDEX = '# Epics\ncommitted\n';

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

function write(repo, rel, body) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// A real repository, not a fake git port: the whole point of this command is
// which git verb undoes which kind of dirty state, and only a real index tells
// `git checkout HEAD --` apart from `git rm --cached`.
function makeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-seed-')));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  write(repo, INDEX_REL, COMMITTED_INDEX);
  write(repo, 'scripts/keep.js', 'committed\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'baseline']);
  return repo;
}

// A real `git worktree add` destination, because it is not empty: every tracked
// file is already there as its HEAD blob, which is exactly the state the copy
// step has to tell apart from someone else's edit.
function makeWorktree(repo) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-wt-')), 'wt');
  git(repo, ['worktree', 'add', '-q', '--detach', dir, 'HEAD']);
  return fs.realpathSync(dir);
}

function status(repo) {
  return git(repo, ['status', '--porcelain']).trim();
}

function seed(repo, to) {
  return seedWorktree({ repoRoot: repo, blueprintDir: BP_REL, worktreePath: to });
}

test('an untracked plan tree moves to the worktree and leaves the base clean', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${EPIC_REL}/index.md`, 'epic\n');
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.moved.sort(), [`${EPIC_REL}/index.md`, `${BP_REL}/tasks.md`].sort());
  assert.deepStrictEqual(res.restored, []);
  assert.strictEqual(read(wt, `${BP_REL}/tasks.md`), 'brief\n');
  assert.strictEqual(read(wt, `${EPIC_REL}/index.md`), 'epic\n');
  assert.strictEqual(fs.existsSync(path.join(repo, `${BP_REL}/tasks.md`)), false);
  assert.strictEqual(status(repo), '');
});

test('a tracked dirty context index overwrites its HEAD copy in the worktree', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  const dirty = `${COMMITTED_INDEX}* EPIC-001\n`;
  write(repo, INDEX_REL, dirty);
  // The worktree already holds this path — as the committed version.
  assert.strictEqual(read(wt, INDEX_REL), COMMITTED_INDEX);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.restored, [INDEX_REL]);
  assert.strictEqual(read(wt, INDEX_REL), dirty);
  assert.strictEqual(read(repo, INDEX_REL), COMMITTED_INDEX);
  assert.strictEqual(status(repo), '');
});

test('a staged modification of a tracked document leaves no ghost in the index', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  const dirty = `${COMMITTED_INDEX}* EPIC-001\n`;
  write(repo, INDEX_REL, dirty);
  // `git checkout -- <path>` restores from the index, which now holds the dirty
  // blob, so it would report success and leave a staged `M` behind.
  git(repo, ['add', '--', INDEX_REL]);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.restored, [INDEX_REL]);
  assert.strictEqual(read(wt, INDEX_REL), dirty);
  assert.strictEqual(read(repo, INDEX_REL), COMMITTED_INDEX);
  assert.strictEqual(status(repo), '');
});

test('a staged new document is unstaged and removed, not checked out', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/verification.md`, 'evidence\n');
  write(repo, `${BP_REL}/review.md`, 'findings\n');
  // `git checkout HEAD -- <path>` fails with "pathspec did not match" here;
  // this is the dominant real state because agents stage plan documents.
  git(repo, ['add', '--', `${BP_REL}/verification.md`, `${BP_REL}/review.md`]);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.moved.sort(), [`${BP_REL}/review.md`, `${BP_REL}/verification.md`]);
  assert.deepStrictEqual(res.restored, []);
  assert.strictEqual(read(wt, `${BP_REL}/verification.md`), 'evidence\n');
  assert.strictEqual(status(repo), '');
});

test('nothing to move is a successful no-op', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);

  assert.deepStrictEqual(seed(repo, wt), { ok: true, moved: [], restored: [] });
  assert.strictEqual(status(repo), '');
});

test('an identical file already in the worktree is skipped, and the base is still cleaned', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');
  write(wt, `${BP_REL}/tasks.md`, 'brief\n');

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.moved, [`${BP_REL}/tasks.md`]);
  assert.strictEqual(fs.existsSync(path.join(repo, `${BP_REL}/tasks.md`)), false);
});

test('a third version in the worktree is a conflict and the base is untouched', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  const dirty = `${COMMITTED_INDEX}* EPIC-001\n`;
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');
  write(repo, INDEX_REL, dirty);
  // Matches neither the base copy nor HEAD: someone else's work.
  write(wt, `${BP_REL}/tasks.md`, 'a different brief\n');

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'conflict');
  assert.deepStrictEqual(res.conflicts, [`${BP_REL}/tasks.md`]);
  assert.strictEqual(read(wt, `${BP_REL}/tasks.md`), 'a different brief\n');
  // Nothing copied, nothing removed: the whole run aborts before any git verb.
  assert.strictEqual(read(repo, `${BP_REL}/tasks.md`), 'brief\n');
  assert.strictEqual(read(repo, INDEX_REL), dirty);
  assert.strictEqual(read(wt, INDEX_REL), COMMITTED_INDEX);
});

test('a missing worktree directory aborts before touching the base', () => {
  const repo = makeRepo();
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');

  const res = seedWorktree({
    repoRoot: repo,
    blueprintDir: BP_REL,
    worktreePath: path.join(os.tmpdir(), 'bouncer-absent-worktree'),
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'missing-worktree');
  assert.strictEqual(read(repo, `${BP_REL}/tasks.md`), 'brief\n');
});

test('a plan document deleted in the base is restored rather than copied', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  fs.rmSync(path.join(repo, INDEX_REL));
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  // Nothing to carry over, but the base still owes git the deleted file back.
  assert.deepStrictEqual(res.moved, [`${BP_REL}/tasks.md`]);
  assert.deepStrictEqual(res.restored, [INDEX_REL]);
  assert.strictEqual(read(repo, INDEX_REL), COMMITTED_INDEX);
  assert.strictEqual(status(repo), '');
});

test('a CRLF checkout is recognised as the pristine HEAD copy, not a conflict', () => {
  const repo = makeRepo();
  git(repo, ['config', 'core.autocrlf', 'true']);
  const wt = makeWorktree(repo);
  // The worktree holds the smudged bytes; the stored blob keeps LF.
  assert.ok(read(wt, INDEX_REL).includes('\r\n'));
  const dirty = `${COMMITTED_INDEX}* EPIC-001\n`;
  write(repo, INDEX_REL, dirty);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.restored, [INDEX_REL]);
  assert.strictEqual(read(wt, INDEX_REL), dirty);
});

test('dirty files outside the plan context set are left alone', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');
  write(repo, '.bouncer/config.json', '{"verify":"npm test"}\n');
  write(repo, 'scripts/keep.js', 'locally edited\n');
  write(repo, '.bouncer/Distill.md', '# Distill\n');
  write(repo, '.bouncer/context/epics/EPIC-002-other/index.md', 'other epic\n');

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.moved, [`${BP_REL}/tasks.md`]);
  assert.strictEqual(read(repo, '.bouncer/config.json'), '{"verify":"npm test"}\n');
  assert.strictEqual(read(repo, 'scripts/keep.js'), 'locally edited\n');
  assert.strictEqual(read(repo, '.bouncer/Distill.md'), '# Distill\n');
  assert.strictEqual(read(repo, '.bouncer/context/epics/EPIC-002-other/index.md'), 'other epic\n');
  assert.strictEqual(fs.existsSync(path.join(wt, '.bouncer/config.json')), false);
  assert.strictEqual(fs.existsSync(path.join(wt, '.bouncer/Distill.md')), false);
});

test('emptied plan directories do not linger in the base', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');

  assert.strictEqual(seed(repo, wt).ok, true);
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer/context/epics')), false);
  // Pruning stops at directories that still hold something.
  assert.strictEqual(fs.existsSync(path.join(repo, INDEX_REL)), true);
});
