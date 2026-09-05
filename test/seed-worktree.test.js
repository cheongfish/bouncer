// test/seed-worktree.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { seedWorktree, realGit } = require('../scripts/lib/seed-worktree');

const EPIC_REL = '.bouncer/context/epics/001-auth';
const BP_REL = `${EPIC_REL}/blueprints/001-login`;
const INDEX_REL = '.bouncer/context/index.md';
const CONFIG_REL = '.bouncer/config.json';
const COMMITTED_INDEX = '# Epics\ncommitted\n';
const CONFIG_HEAD = '{"verify":"npm test"}\n';
const CONFIG_DIRTY = '{"verify":"npm run ci"}\n';
const CONFIG_OTHER = '{"verify":"npx vitest"}\n';

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

function seed(repo, to, deps) {
  return seedWorktree({ repoRoot: repo, blueprintDir: BP_REL, worktreePath: to, deps });
}

function assertConfigNotMoved(res) {
  if (Array.isArray(res.moved)) {
    assert.ok(!res.moved.includes(CONFIG_REL), 'config must not appear in moved');
  }
  if (Array.isArray(res.restored)) {
    assert.ok(!res.restored.includes(CONFIG_REL), 'config must not appear in restored');
  }
}

test('a fresh worktree forces locked development dependencies before seeding documents', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(wt, 'package-lock.json', '{}\n');
  const calls = [];
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = seed(repo, wt, {
      execFileSync(command, args, options) {
        calls.push({ command, args, options });
      },
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.config, 'missing');
    assertConfigNotMoved(res);
    assert.deepStrictEqual(calls, [{
      command: 'npm',
      // Production host defaults must not omit the CI test runner and other dev tools.
      args: ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
      options: { cwd: wt, stdio: 'inherit' },
    }]);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('a reused worktree with npm’s lock marker does not reinstall dependencies', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(wt, 'package-lock.json', '{}\n');
  write(wt, 'node_modules/.package-lock.json', '{}\n');
  const calls = [];

  const res = seed(repo, wt, {
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
    },
  });

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.config, 'missing');
  assertConfigNotMoved(res);
  assert.deepStrictEqual(calls, []);
});

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
  // 재진입: worktree에 이미 plan 문서가 있어도 base에 옮길 것이 없으면
  // 아무 일도 하지 않고 성공한다. worktree 바이트는 그대로다.
  write(wt, `${BP_REL}/tasks.md`, 'already seeded\n');
  const before = read(wt, `${BP_REL}/tasks.md`);
  const beforeIndex = read(wt, INDEX_REL);

  const res = seed(repo, wt);

  assert.deepStrictEqual(res, { ok: true, moved: [], restored: [], config: 'missing' });
  assert.strictEqual(status(repo), '');
  assert.strictEqual(read(wt, `${BP_REL}/tasks.md`), before);
  assert.strictEqual(read(wt, INDEX_REL), beforeIndex);
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
  assert.strictEqual(res.config, 'missing');
  assertConfigNotMoved(res);
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
  write(repo, CONFIG_REL, CONFIG_HEAD);
  write(repo, 'scripts/keep.js', 'locally edited\n');
  write(repo, '.bouncer/Distill.md', '# Distill\n');
  write(repo, '.bouncer/context/epics/002-other/index.md', 'other epic\n');

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.config, 'copied');
  assert.deepStrictEqual(res.moved, [`${BP_REL}/tasks.md`]);
  assertConfigNotMoved(res);
  assert.strictEqual(read(repo, CONFIG_REL), CONFIG_HEAD);
  assert.strictEqual(read(wt, CONFIG_REL), CONFIG_HEAD);
  assert.strictEqual(read(repo, 'scripts/keep.js'), 'locally edited\n');
  assert.strictEqual(read(repo, '.bouncer/Distill.md'), '# Distill\n');
  assert.strictEqual(read(repo, '.bouncer/context/epics/002-other/index.md'), 'other epic\n');
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

test('an ignored base config copies into an empty destination and stays in the base', () => {
  const repo = makeRepo();
  write(repo, '.gitignore', `${CONFIG_REL}\n`);
  write(repo, CONFIG_REL, CONFIG_HEAD);
  const wt = makeWorktree(repo);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.config, 'copied');
  assertConfigNotMoved(res);
  assert.strictEqual(read(wt, CONFIG_REL), CONFIG_HEAD);
  assert.strictEqual(read(repo, CONFIG_REL), CONFIG_HEAD);
});

test('an existing destination config is preserved even when the bytes differ', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, CONFIG_REL, CONFIG_HEAD);
  write(wt, CONFIG_REL, CONFIG_OTHER);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.config, 'preserved');
  assertConfigNotMoved(res);
  assert.strictEqual(read(wt, CONFIG_REL), CONFIG_OTHER);
  assert.strictEqual(read(repo, CONFIG_REL), CONFIG_HEAD);
});

test('a tracked dirty base config copies HEAD bytes when the destination is absent', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  // worktree는 config 커밋 전에 만들어 dest가 비어 있다. 재사용 checkout이
  // 나중에 추적된 정책을 받는 경우와 같다.
  write(repo, CONFIG_REL, CONFIG_HEAD);
  git(repo, ['add', '--', CONFIG_REL]);
  git(repo, ['commit', '-qm', 'track config']);
  write(repo, CONFIG_REL, CONFIG_DIRTY);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.config, 'copied');
  assertConfigNotMoved(res);
  assert.strictEqual(read(wt, CONFIG_REL), CONFIG_HEAD);
  assert.strictEqual(read(repo, CONFIG_REL), CONFIG_DIRTY);
});

test('a tracked config does not copy dirty base bytes when HEAD cannot be read', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, CONFIG_REL, CONFIG_HEAD);
  git(repo, ['add', '--', CONFIG_REL]);
  git(repo, ['commit', '-qm', 'track config']);
  write(repo, CONFIG_REL, CONFIG_DIRTY);
  const inner = realGit(repo);

  const res = seedWorktree({
    repoRoot: repo,
    blueprintDir: BP_REL,
    worktreePath: wt,
    git: {
      ...inner,
      existsInHead(file) {
        return file === CONFIG_REL ? true : inner.existsInHead(file);
      },
      readHead(file) {
        return file === CONFIG_REL ? null : inner.readHead(file);
      },
    },
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'copy-failed');
  assert.strictEqual(fs.existsSync(path.join(wt, CONFIG_REL)), false);
  assert.strictEqual(read(repo, CONFIG_REL), CONFIG_DIRTY);
});

test('missing config in both trees succeeds without creating a file', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.config, 'missing');
  assertConfigNotMoved(res);
  assert.strictEqual(fs.existsSync(path.join(repo, CONFIG_REL)), false);
  assert.strictEqual(fs.existsSync(path.join(wt, CONFIG_REL)), false);
});

test('a plan conflict still reports config status and does not move the base file', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');
  write(repo, CONFIG_REL, CONFIG_HEAD);
  write(wt, `${BP_REL}/tasks.md`, 'a different brief\n');

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'conflict');
  assert.strictEqual(res.config, 'copied');
  assertConfigNotMoved(res);
  assert.strictEqual(read(wt, CONFIG_REL), CONFIG_HEAD);
  assert.strictEqual(read(repo, CONFIG_REL), CONFIG_HEAD);
  assert.strictEqual(read(repo, `${BP_REL}/tasks.md`), 'brief\n');
});
