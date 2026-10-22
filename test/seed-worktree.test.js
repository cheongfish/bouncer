// test/seed-worktree.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { seedWorktree, realGit, seedIntegration, seedCoordinatorWorker, releaseSeedManifest, prepareDependencies, linkLocalEnv } = require('../scripts/lib/seed-worktree');

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

const STAMP = path.join('node_modules', '.bouncer-lock-sha256');

function lockHash(repo) {
  return createHash('sha256').update(fs.readFileSync(path.join(repo, 'package-lock.json'))).digest('hex');
}

// npm marker와 일치하는 lockfile stamp를 함께 써서 "이미 설치된 worktree"를 만든다.
function writeInstalled(root) {
  write(root, 'node_modules/.package-lock.json', '{}\n');
  write(root, STAMP, `${lockHash(root)}\n`);
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

test('seedIntegration → copies an untracked plan without changing the source', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${EPIC_REL}/index.md`, 'epic\n');
  write(repo, `${BP_REL}/tasks/001/tasks.md`, 'brief\n');
  write(repo, CONFIG_REL, CONFIG_DIRTY);
  const before = status(repo);
  const result = seedIntegration({ repoRoot: repo, blueprintDir: BP_REL, integrationPath: wt });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(read(wt, `${BP_REL}/tasks/001/tasks.md`), 'brief\n');
  assert.strictEqual(read(wt, CONFIG_REL), CONFIG_DIRTY);
  assert.ok(result.manifest.some((entry) => entry.path === `${BP_REL}/tasks/001/tasks.md` && /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.strictEqual(status(repo), before);
});

test('seedIntegration → refuses a third document version and leaves source untouched', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks/001/tasks.md`, 'main\n');
  write(wt, `${BP_REL}/tasks/001/tasks.md`, 'third\n');
  const before = read(repo, `${BP_REL}/tasks/001/tasks.md`);
  const result = seedIntegration({ repoRoot: repo, blueprintDir: BP_REL, integrationPath: wt });
  assert.deepStrictEqual(result.reason, 'seed-conflict');
  assert.deepStrictEqual(result.conflicts, [`${BP_REL}/tasks/001/tasks.md`]);
  assert.strictEqual(read(repo, `${BP_REL}/tasks/001/tasks.md`), before);
});

function sha256(body) {
  return createHash('sha256').update(body).digest('hex');
}

// bootstrap이 남긴 manifest를 흉내 낸다. 각 경로의 해시는 seed 순간의 main 바이트다.
function manifestOf(entries) {
  return entries.map(([rel, body]) => ({ path: rel, sha256: sha256(body) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

test('releaseSeedManifest judges each manifest path → leaves everything else alone', () => {
  const repo = makeRepo();
  const epicIndex = `${EPIC_REL}/index.md`;
  write(repo, epicIndex, 'epic committed\n');
  git(repo, ['add', '--', epicIndex]);
  git(repo, ['commit', '-qm', 'epic']);
  const dirtyIndex = `${COMMITTED_INDEX}* EPIC-001\n`;
  const tasks = `${BP_REL}/tasks/001/tasks.md`;
  const review = `${BP_REL}/tasks/001/review.md`;
  const bpIndex = `${BP_REL}/index.md`;
  const gone = `${BP_REL}/tasks/001/verification.md`;
  const other = `${BP_REL}/tasks/002/tasks.md`;
  write(repo, INDEX_REL, dirtyIndex); // tracked, seed 바이트와 같음 → restored
  write(repo, tasks, 'brief\n'); // untracked, 일치 → released
  write(repo, review, 'findings\n'); // staged 새 파일, 일치 → unstage 뒤 released
  git(repo, ['add', '--', review]);
  write(repo, bpIndex, 'edited during drive\n'); // 불일치 → preserved
  write(repo, other, 'outside manifest\n'); // manifest 밖 → 불변
  write(repo, 'scripts/keep.js', 'locally edited\n'); // manifest 밖 source → 불변
  const manifest = manifestOf([
    [INDEX_REL, dirtyIndex], [tasks, 'brief\n'], [review, 'findings\n'], [bpIndex, 'seeded index\n'],
    [gone, 'evidence\n'], [epicIndex, 'epic committed\n'],
  ]);

  const res = releaseSeedManifest({ repoRoot: repo, blueprintDir: BP_REL, manifest });

  assert.deepStrictEqual(res.restored, [INDEX_REL]);
  assert.deepStrictEqual(res.released.sort(), [review, tasks].sort());
  assert.deepStrictEqual(res.preserved, [bpIndex]);
  // 없는 경로와 이미 HEAD blob과 같은 경로는 할 일이 없다.
  assert.deepStrictEqual(res.absent.sort(), [epicIndex, gone].sort());
  assert.strictEqual(read(repo, INDEX_REL), COMMITTED_INDEX);
  assert.strictEqual(fs.existsSync(path.join(repo, tasks)), false);
  assert.strictEqual(fs.existsSync(path.join(repo, review)), false);
  assert.strictEqual(git(repo, ['ls-files', '--', review]), '', 'staged new file must leave the index');
  assert.strictEqual(read(repo, bpIndex), 'edited during drive\n');
  assert.strictEqual(read(repo, other), 'outside manifest\n');
  assert.strictEqual(read(repo, 'scripts/keep.js'), 'locally edited\n');
  assert.strictEqual(read(repo, epicIndex), 'epic committed\n');
  // 비워진 bundle 디렉터리는 남지 않지만 무언가 남은 blueprint 디렉터리는 유지된다.
  assert.strictEqual(fs.existsSync(path.join(repo, `${BP_REL}/tasks/001`)), false);
  assert.strictEqual(fs.existsSync(path.join(repo, BP_REL)), true);

  // 두 번째 실행은 같은 상태로 수렴한다. 앞서 처리한 경로는 모두 absent다.
  const again = releaseSeedManifest({ repoRoot: repo, blueprintDir: BP_REL, manifest });
  assert.deepStrictEqual(again.released, []);
  assert.deepStrictEqual(again.restored, []);
  assert.deepStrictEqual(again.preserved, [bpIndex]);
  assert.deepStrictEqual(again.absent.sort(), [INDEX_REL, epicIndex, gone, review, tasks].sort());
});

test('releaseSeedManifest → never touches a manifest entry outside the seeded plan set', () => {
  const repo = makeRepo();
  write(repo, 'scripts/keep.js', 'locally edited\n');
  write(repo, 'notes.md', 'untracked note\n');
  // 원장은 integration의 일반 파일이다. seed 집합 밖이나 저장소를 벗어나는 경로가
  // 섞여도 해시가 맞는다는 이유로 되돌리거나 지우지 않는다.
  const manifest = manifestOf([
    ['scripts/keep.js', 'locally edited\n'], ['notes.md', 'untracked note\n'],
    [`${BP_REL}/../../../../../notes.md`, 'untracked note\n'],
  ]);

  const res = releaseSeedManifest({ repoRoot: repo, blueprintDir: BP_REL, manifest });

  assert.deepStrictEqual(res.released, []);
  assert.deepStrictEqual(res.restored, []);
  assert.strictEqual(res.preserved.length, 3);
  assert.strictEqual(read(repo, 'scripts/keep.js'), 'locally edited\n');
  assert.strictEqual(read(repo, 'notes.md'), 'untracked note\n');
});

test('releaseSeedManifest → prunes empty directories inside the blueprint tree only', () => {
  const repo = makeRepo();
  const bpIndex = `${BP_REL}/index.md`;
  const tasks = `${BP_REL}/tasks/001/tasks.md`;
  write(repo, bpIndex, 'seeded index\n');
  write(repo, tasks, 'brief\n');

  const res = releaseSeedManifest({
    repoRoot: repo, blueprintDir: BP_REL, manifest: manifestOf([[bpIndex, 'seeded index\n'], [tasks, 'brief\n']]),
  });

  assert.deepStrictEqual(res.released.sort(), [bpIndex, tasks].sort());
  // 비워진 blueprint 디렉터리까지는 지우지만, 다른 blueprint가 쓰는 상위 blueprints/와
  // epic 디렉터리는 비어도 남긴다.
  assert.strictEqual(fs.existsSync(path.join(repo, BP_REL)), false);
  assert.strictEqual(fs.existsSync(path.join(repo, `${EPIC_REL}/blueprints`)), true);
  assert.strictEqual(fs.existsSync(path.join(repo, EPIC_REL)), true);
});

test('releaseSeedManifest → does not prune after releasing the epic or context index', () => {
  const repo = makeRepo();
  git(repo, ['rm', '-q', '--', INDEX_REL]);
  git(repo, ['commit', '-qm', 'drop context index']);
  const epicIndex = `${EPIC_REL}/index.md`;
  // 두 index가 각자 디렉터리의 유일한 파일이라, 정리가 돌면 epic과 context 디렉터리가 사라진다.
  write(repo, epicIndex, 'epic\n');
  write(repo, INDEX_REL, 'context\n');

  const res = releaseSeedManifest({
    repoRoot: repo, blueprintDir: BP_REL, manifest: manifestOf([[epicIndex, 'epic\n'], [INDEX_REL, 'context\n']]),
  });

  assert.deepStrictEqual(res.released.sort(), [epicIndex, INDEX_REL].sort());
  assert.strictEqual(fs.existsSync(path.join(repo, EPIC_REL)), true);
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer/context')), true);
});

test('releaseSeedManifest → reports malformed manifest entries as preserved without throwing', () => {
  const repo = makeRepo();
  const tasks = `${BP_REL}/tasks/001/tasks.md`;
  write(repo, tasks, 'brief\n');
  // 원장은 손으로 바뀔 수 있는 일반 JSON이다. 유효한 항목 뒤의 null이 반쯤 쓴 뒤 throw하게
  // 두면 main이 일부만 되돌려진 채 멈춘다.
  const manifest = [...manifestOf([[tasks, 'brief\n']]), null, { path: 42, sha256: 'x' }, 'bare'];

  let res;
  assert.doesNotThrow(() => { res = releaseSeedManifest({ repoRoot: repo, blueprintDir: BP_REL, manifest }); });

  assert.deepStrictEqual(res.released, [tasks]);
  assert.deepStrictEqual(res.restored, []);
  assert.deepStrictEqual(res.absent, []);
  assert.deepStrictEqual(res.preserved, ['null', '{"path":42,"sha256":"x"}', '"bare"']);
  assert.strictEqual(fs.existsSync(path.join(repo, tasks)), false);
});

test('a fresh worktree → forces locked development dependencies before seeding documents', () => {
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

test('a reused worktree with npm’s lock marker → does not reinstall dependencies', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(wt, 'package-lock.json', '{}\n');
  writeInstalled(wt);
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

test('an untracked plan tree → moves to the worktree and leaves the base clean', () => {
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

test('a tracked dirty context index → overwrites its HEAD copy in the worktree', () => {
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

test('a staged modification of a tracked document → leaves no ghost in the index', () => {
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

test('a staged new document → is unstaged and removed, not checked out', () => {
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

test('nothing to move → is a successful no-op', () => {
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

test('an identical file already in the worktree → is skipped, and the base is still cleaned', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');
  write(wt, `${BP_REL}/tasks.md`, 'brief\n');

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.moved, [`${BP_REL}/tasks.md`]);
  assert.strictEqual(fs.existsSync(path.join(repo, `${BP_REL}/tasks.md`)), false);
});

test('a third version in the worktree → is a conflict and the base is untouched', () => {
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

test('a missing worktree directory → aborts before touching the base', () => {
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

test('a plan document deleted in the base → is restored rather than copied', () => {
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

test('a CRLF checkout → is recognised as the pristine HEAD copy, not a conflict', () => {
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

test('linked worktree seed when Distill is absent → succeeds', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer/Distill.md')), false);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.moved, [`${BP_REL}/tasks.md`]);
  assert.strictEqual(fs.existsSync(path.join(wt, '.bouncer/Distill.md')), false);
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer/Distill.md')), false);
});

test('dirty files outside the plan context set → are left alone', () => {
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

test('emptied plan directories → do not linger in the base', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks.md`, 'brief\n');

  assert.strictEqual(seed(repo, wt).ok, true);
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer/context/epics')), false);
  // Pruning stops at directories that still hold something.
  assert.strictEqual(fs.existsSync(path.join(repo, INDEX_REL)), true);
});

test('an ignored base config → copies into an empty destination and stays in the base', () => {
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

test('an existing destination config → is preserved even when the bytes differ', () => {
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

test('a tracked dirty base config when the destination is absent → copies HEAD bytes', () => {
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

test('a tracked config when HEAD cannot be read → does not copy dirty base bytes', () => {
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

test('missing config in both trees → succeeds without creating a file', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);

  const res = seed(repo, wt);

  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.config, 'missing');
  assertConfigNotMoved(res);
  assert.strictEqual(fs.existsSync(path.join(repo, CONFIG_REL)), false);
  assert.strictEqual(fs.existsSync(path.join(wt, CONFIG_REL)), false);
});

test('a plan conflict still → reports config status and does not move the base file', () => {
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

test('seedCoordinatorWorker → installs locked development dependencies on a fresh fan-in worktree', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks/001/tasks.md`, 'brief\n');
  write(wt, 'package-lock.json', '{}\n');
  const calls = [];

  const res = seedCoordinatorWorker({
    repoRoot: repo,
    blueprintDir: BP_REL,
    worktreePath: wt,
    deps: {
      execFileSync(command, args, options) {
        calls.push({ command, args, options });
      },
    },
  });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(read(wt, `${BP_REL}/tasks/001/tasks.md`), 'brief\n');
  assert.deepStrictEqual(calls, [{
    command: 'npm',
    args: ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
    options: { cwd: wt, stdio: 'inherit' },
  }]);
});

test('seedCoordinatorWorker when the lock marker is already present → skips npm ci', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks/001/tasks.md`, 'brief\n');
  write(wt, 'package-lock.json', '{}\n');
  writeInstalled(wt);
  const calls = [];

  const res = seedCoordinatorWorker({
    repoRoot: repo,
    blueprintDir: BP_REL,
    worktreePath: wt,
    deps: {
      execFileSync(command, args, options) {
        calls.push({ command, args, options });
      },
    },
  });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.deepStrictEqual(calls, []);
});

test('prepareDependencies when lockfile exists without the installer marker → runs npm ci --include=dev', () => {
  const repo = makeRepo();
  write(repo, 'package-lock.json', '{}\n');
  const calls = [];

  const res = prepareDependencies(repo, {
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
    },
  });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.deepStrictEqual(calls, [{
    command: 'npm',
    args: ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
    options: { cwd: repo, stdio: 'inherit' },
  }]);
});

test('prepareDependencies when the lock marker is already present → skips npm ci', () => {
  const repo = makeRepo();
  write(repo, 'package-lock.json', '{}\n');
  writeInstalled(repo);
  const calls = [];

  const res = prepareDependencies(repo, {
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
    },
  });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.deepStrictEqual(calls, []);
});

test('seedCoordinatorWorker → copies the epic and context index into the worker', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks/001/tasks.md`, 'brief\n');
  write(repo, `${EPIC_REL}/index.md`, 'epic\n');
  write(repo, INDEX_REL, '# Epics\nseeded\n');

  const res = seedCoordinatorWorker({ repoRoot: repo, blueprintDir: BP_REL, worktreePath: wt });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(read(wt, `${EPIC_REL}/index.md`), 'epic\n');
  assert.strictEqual(read(wt, INDEX_REL), '# Epics\nseeded\n');
  assert.deepStrictEqual(res.seeded, [BP_REL, `${EPIC_REL}/index.md`, INDEX_REL]);
});

test('seedCoordinatorWorker → skips an index absent on base', () => {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks/001/tasks.md`, 'brief\n');

  const res = seedCoordinatorWorker({ repoRoot: repo, blueprintDir: BP_REL, worktreePath: wt });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(fs.existsSync(path.join(wt, `${EPIC_REL}/index.md`)), false);
  assert.ok(!res.seeded.includes(`${EPIC_REL}/index.md`));
});

test('prepareDependencies when only npm’s marker exists without a stamp → reinstalls', () => {
  const repo = makeRepo();
  write(repo, 'package-lock.json', '{}\n');
  write(repo, 'node_modules/.package-lock.json', '{}\n');
  const calls = [];

  const res = prepareDependencies(repo, { execFileSync(...args) { calls.push(args); } });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(read(repo, STAMP), `${lockHash(repo)}\n`);
});

test('prepareDependencies → records the stamp after install and skips on the next call', () => {
  const repo = makeRepo();
  write(repo, 'package-lock.json', '{}\n');
  const calls = [];
  const deps = { execFileSync(...args) { calls.push(args); } };

  assert.strictEqual(prepareDependencies(repo, deps).ok, true);
  assert.strictEqual(read(repo, STAMP), `${lockHash(repo)}\n`);
  // mock npm은 marker를 만들지 않으므로 marker는 테스트가 npm 대신 채운다.
  write(repo, 'node_modules/.package-lock.json', '{}\n');
  assert.strictEqual(prepareDependencies(repo, deps).ok, true);
  assert.strictEqual(calls.length, 1);
});

test('prepareDependencies when the lockfile changed → reinstalls and refreshes the stamp', () => {
  const repo = makeRepo();
  write(repo, 'package-lock.json', '{}\n');
  writeInstalled(repo);
  write(repo, 'package-lock.json', '{"changed":true}\n');
  const calls = [];

  const res = prepareDependencies(repo, { execFileSync(...args) { calls.push(args); } });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(read(repo, STAMP), `${lockHash(repo)}\n`);
});

test('prepareDependencies when the stamp cannot be written → keeps ok:true and reinstalls next time', () => {
  const repo = makeRepo();
  write(repo, 'package-lock.json', '{}\n');
  write(repo, 'node_modules/.package-lock.json', '{}\n');
  fs.mkdirSync(path.join(repo, STAMP), { recursive: true });
  const calls = [];
  const deps = { execFileSync(...args) { calls.push(args); } };

  assert.strictEqual(prepareDependencies(repo, deps).ok, true);
  assert.strictEqual(prepareDependencies(repo, deps).ok, true);
  assert.strictEqual(calls.length, 2);
});

test('prepareDependencies → treats an unreadable stamp as unknown and reinstalls without throwing', (t) => {
  // root는 chmod 000 파일도 읽으므로 EACCES를 재현할 수 없다.
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('root can read mode 000 files');
    return;
  }
  const repo = makeRepo();
  write(repo, 'package-lock.json', '{}\n');
  writeInstalled(repo);
  const stampAbs = path.join(repo, STAMP);
  fs.chmodSync(stampAbs, 0o000);
  const calls = [];

  try {
    const res = prepareDependencies(repo, { execFileSync(...args) { calls.push(args); } });
    assert.strictEqual(res.ok, true, JSON.stringify(res));
    assert.strictEqual(calls.length, 1);
  } finally {
    fs.chmodSync(stampAbs, 0o644);
  }
});

test('prepareDependencies → reports install failure without writing a stamp', () => {
  const repo = makeRepo();
  write(repo, 'package-lock.json', '{}\n');

  const res = prepareDependencies(repo, { execFileSync() { throw new Error('boom'); } });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'dependency-install-failed');
  assert.strictEqual(fs.existsSync(path.join(repo, STAMP)), false);
});

test('prepareDependencies without a lockfile → does nothing', () => {
  const repo = makeRepo();
  const calls = [];

  const res = prepareDependencies(repo, { execFileSync(...args) { calls.push(args); } });

  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(calls, []);
});

// main checkout에 ignored `.venv`·`.env`가 있는 저장소와 그 worktree를 만든다.
function makeRepoWithLocalEnv() {
  const repo = makeRepo();
  write(repo, '.gitignore', '.venv\n.env\n');
  git(repo, ['add', '.gitignore']);
  git(repo, ['commit', '-qm', 'ignore local env']);
  write(repo, '.venv/bin/pytest', '#!/bin/sh\n');
  write(repo, '.env', 'DATABASE_URL=x\n');
  return { repo, wt: makeWorktree(repo) };
}

test('prepareDependencies in a linked worktree → symlinks the main checkout .venv and .env', () => {
  const { repo, wt } = makeRepoWithLocalEnv();

  const res = prepareDependencies(wt, {});

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(fs.readlinkSync(path.join(wt, '.venv')), path.join(repo, '.venv'));
  assert.strictEqual(fs.readlinkSync(path.join(wt, '.env')), path.join(repo, '.env'));
  assert.strictEqual(read(wt, '.venv/bin/pytest'), '#!/bin/sh\n');
  assert.strictEqual(status(wt), '');
});

test('linkLocalEnv when the worktree already has the path → keeps it', () => {
  const { wt } = makeRepoWithLocalEnv();
  write(wt, '.env', 'LOCAL=1\n');

  assert.deepStrictEqual(linkLocalEnv(wt), ['.venv']);
  assert.strictEqual(fs.lstatSync(path.join(wt, '.env')).isSymbolicLink(), false);
  assert.strictEqual(read(wt, '.env'), 'LOCAL=1\n');
});

test('linkLocalEnv when the path is not ignored → does not link and prints skip reason', () => {
  const repo = makeRepo();
  write(repo, '.env', 'DATABASE_URL=x\n');
  const wt = makeWorktree(repo);
  const lines = [];
  const stderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    lines.push(String(chunk));
    return stderrWrite(chunk, ...rest);
  };

  try {
    assert.deepStrictEqual(linkLocalEnv(wt), []);
    assert.strictEqual(fs.existsSync(path.join(wt, '.env')), false);
    assert.ok(lines.some((line) => line.includes('.env') && line.trim().length > 0));
  } finally {
    process.stderr.write = stderrWrite;
  }
});

test('linkLocalEnv on the main checkout → does nothing', () => {
  const { repo } = makeRepoWithLocalEnv();

  assert.deepStrictEqual(linkLocalEnv(repo), []);
  assert.strictEqual(fs.lstatSync(path.join(repo, '.env')).isSymbolicLink(), false);
});

// `.venv/`처럼 trailing-slash 패턴은 아직 없는 `.venv` 경로에 check-ignore가
// 실패한다. 디렉터리 원본이면 `rel/`로도 물어 링크를 만들고, symlink가
// status에 새지 않도록 info/exclude에 `/rel`을 한 번만 넣는다.
function makeRepoWithSlashIgnoreLocalEnv() {
  const repo = makeRepo();
  write(repo, '.gitignore', '.venv/\n.env\n');
  git(repo, ['add', '.gitignore']);
  git(repo, ['commit', '-qm', 'ignore local env with slash']);
  write(repo, '.venv/bin/pytest', '#!/bin/sh\n');
  write(repo, '.env', 'DATABASE_URL=x\n');
  return { repo, wt: makeWorktree(repo) };
}

function excludePathOf(repo) {
  const rel = git(repo, ['rev-parse', '--git-path', 'info/exclude']).trim();
  return path.isAbsolute(rel) ? rel : path.join(repo, rel);
}

test('linkLocalEnv with .venv/ ignore pattern → links and keeps git status clean', () => {
  const { repo, wt } = makeRepoWithSlashIgnoreLocalEnv();

  assert.deepStrictEqual(linkLocalEnv(wt), ['.venv', '.env']);
  assert.strictEqual(fs.readlinkSync(path.join(wt, '.venv')), path.join(repo, '.venv'));
  assert.strictEqual(fs.readlinkSync(path.join(wt, '.env')), path.join(repo, '.env'));
  assert.strictEqual(status(wt), '');
});

test('linkLocalEnv → writes /.venv to info/exclude only once across two calls', () => {
  const { wt } = makeRepoWithSlashIgnoreLocalEnv();

  assert.deepStrictEqual(linkLocalEnv(wt), ['.venv', '.env']);
  assert.deepStrictEqual(linkLocalEnv(wt), []);
  const lines = fs.readFileSync(excludePathOf(wt), 'utf8').split(/\r?\n/);
  assert.strictEqual(lines.filter((line) => line === '/.venv').length, 1);
});

// worktree.setup 테스트: 실제 git worktree 없이 임시 디렉터리를 main checkout으로
// 지정(deps.mainCheckout)하고, exec는 호출만 기록하는 가짜로 바꾼다.
function makeSetupFixture(config, { lock = true, installed = false } = {}) {
  const main = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-setup-main-')));
  if (config !== undefined) write(main, CONFIG_REL, typeof config === 'string' ? config : JSON.stringify(config));
  const wt = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-setup-wt-')));
  if (lock) write(wt, 'package-lock.json', '{}\n');
  if (installed) writeInstalled(wt);
  const calls = [];
  const deps = {
    mainCheckout: main,
    execFileSync(command, args, options) { calls.push({ command, args, options }); },
  };
  return { wt, deps, calls };
}

const BUILD_CALL = (wt) => ({ command: 'npm', args: ['run', 'build'], options: { cwd: wt, stdio: 'inherit' } });
const NPM_CI_ARGS = ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'];

test('prepareDependencies when worktree.setup is set and the lockfile is missing → runs setup once', () => {
  const { wt, deps, calls } = makeSetupFixture({ worktree: { setup: 'npm run build' } }, { lock: false });

  const res = prepareDependencies(wt, deps);

  assert.deepStrictEqual(res, { ok: true });
  assert.deepStrictEqual(calls, [BUILD_CALL(wt)]);
});

test('prepareDependencies when worktree.setup is set and the stamp matches → skips npm ci and runs setup', () => {
  const { wt, deps, calls } = makeSetupFixture({ worktree: { setup: 'npm run build' } }, { installed: true });

  const res = prepareDependencies(wt, deps);

  assert.deepStrictEqual(res, { ok: true });
  assert.deepStrictEqual(calls, [BUILD_CALL(wt)]);
});

test('prepareDependencies when worktree.setup is set and install is needed → runs npm ci before setup', () => {
  const { wt, deps, calls } = makeSetupFixture({ worktree: { setup: 'npm run build' } });

  const res = prepareDependencies(wt, deps);

  assert.deepStrictEqual(res, { ok: true });
  assert.deepStrictEqual(calls.map((c) => c.args), [NPM_CI_ARGS, ['run', 'build']]);
});

for (const [label, setup] of [
  ['a chained command', 'npm run build && x'],
  ['a cd prefix', 'cd x'],
  ['an empty string', ''],
  ['a non-string value', 42],
  ['an executable outside the allowlist', 'curl x'],
]) {
  test(`prepareDependencies when worktree.setup is ${label} → fails with dependency-install-failed and runs no setup`, () => {
    const { wt, deps, calls } = makeSetupFixture({ worktree: { setup } }, { lock: false });

    const res = prepareDependencies(wt, deps);

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.reason, 'dependency-install-failed');
    assert.match(res.message, /^worktree\.setup/);
    assert.deepStrictEqual(calls, []);
  });
}

test('prepareDependencies when the setup command throws → fails with dependency-install-failed', () => {
  const { wt, deps } = makeSetupFixture({ worktree: { setup: 'npm run build' } }, { lock: false });
  deps.execFileSync = () => { throw new Error('boom'); };

  const res = prepareDependencies(wt, deps);

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'dependency-install-failed');
  assert.match(res.message, /^worktree\.setup/);
});

test('prepareDependencies when npm ci fails → returns the install failure without running setup', () => {
  const { wt, deps } = makeSetupFixture({ worktree: { setup: 'npm run build' } });
  const calls = [];
  deps.execFileSync = (command, args) => { calls.push(args); throw new Error('npm down'); };

  const res = prepareDependencies(wt, deps);

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'dependency-install-failed');
  assert.deepStrictEqual(calls, [NPM_CI_ARGS]);
});

test('prepareDependencies when the config has no worktree key → keeps the existing npm ci call only', () => {
  const { wt, deps, calls } = makeSetupFixture({ verify: 'npm test' });

  const res = prepareDependencies(wt, deps);

  assert.deepStrictEqual(res, { ok: true });
  assert.deepStrictEqual(calls.map((c) => c.args), [NPM_CI_ARGS]);
});

test('prepareDependencies when the main checkout has no config file → makes no setup call', () => {
  const { wt, deps, calls } = makeSetupFixture(undefined, { lock: false });

  const res = prepareDependencies(wt, deps);

  assert.deepStrictEqual(res, { ok: true });
  assert.deepStrictEqual(calls, []);
});

// --- main node_modules 공유 안전성 -------------------------------------------------

const NPM_ARGS = ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'];

// main에 직접 의존성 하나(`left-pad`)까지 설치된 상태를 만든다. worktree의 lock·package.json은
// 같은 bytes로 둔다.
function sharedFixture({ lock = '{"v":1}\n' } = {}) {
  const repo = makeRepo();
  const wt = makeWorktree(repo);
  write(repo, `${BP_REL}/tasks/001/tasks.md`, 'brief\n');
  for (const root of [repo, wt]) {
    write(root, 'package.json', '{"devDependencies":{"left-pad":"1.0.0"}}\n');
    write(root, 'package-lock.json', lock);
  }
  writeInstalled(repo);
  write(repo, 'node_modules/left-pad/package.json', '{}\n');
  const calls = [];
  const deps = { mainCheckout: repo, execFileSync(command, args, options) { calls.push({ command, args, options }); } };
  return { repo, wt, deps, calls };
}

function isLink(root) {
  return fs.lstatSync(path.join(root, 'node_modules')).isSymbolicLink();
}

test('seedCoordinatorWorker when lock bytes match and main is prepared → shares main node_modules without npm', () => {
  const { repo, wt, deps, calls } = sharedFixture();

  const res = seedCoordinatorWorker({
    repoRoot: repo, blueprintDir: BP_REL, worktreePath: wt, deps, affectedPaths: ['src/'],
  });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(isLink(wt), true);
  assert.strictEqual(fs.realpathSync(path.join(wt, 'node_modules')), fs.realpathSync(path.join(repo, 'node_modules')));
  assert.deepStrictEqual(calls, []);
});

test('seedCoordinatorWorker when lock bytes differ from main → installs independently', () => {
  const { repo, wt, deps, calls } = sharedFixture();
  write(wt, 'package-lock.json', '{"v":2}\n');

  const res = seedCoordinatorWorker({
    repoRoot: repo, blueprintDir: BP_REL, worktreePath: wt, deps, affectedPaths: ['src/'],
  });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(fs.existsSync(path.join(wt, 'node_modules')) && isLink(wt), false);
  assert.deepStrictEqual(calls.map((c) => [c.command, c.args]), [['npm', NPM_ARGS]]);
});

test('seedCoordinatorWorker when main has no stamp or lacks a direct package → installs independently', () => {
  const noStamp = sharedFixture();
  fs.rmSync(path.join(noStamp.repo, STAMP));
  const missingPkg = sharedFixture();
  fs.rmSync(path.join(missingPkg.repo, 'node_modules/left-pad'), { recursive: true });

  for (const f of [noStamp, missingPkg]) {
    const res = seedCoordinatorWorker({
      repoRoot: f.repo, blueprintDir: BP_REL, worktreePath: f.wt, deps: f.deps, affectedPaths: ['src/'],
    });
    assert.strictEqual(res.ok, true, JSON.stringify(res));
    assert.strictEqual(fs.existsSync(path.join(f.wt, 'node_modules')) && isLink(f.wt), false);
    assert.strictEqual(f.calls.length, 1);
  }
});

test('seedCoordinatorWorker when the approved scope changes package.json or the lock → installs independently from the start', () => {
  for (const changed of ['package.json', 'package-lock.json']) {
    const { repo, wt, deps, calls } = sharedFixture();

    const res = seedCoordinatorWorker({
      repoRoot: repo, blueprintDir: BP_REL, worktreePath: wt, deps, affectedPaths: ['src/', changed],
    });

    assert.strictEqual(res.ok, true, JSON.stringify(res));
    assert.strictEqual(fs.existsSync(path.join(wt, 'node_modules')) && isLink(wt), false);
    assert.strictEqual(calls.length, 1, changed);
  }
});

test('seedCoordinatorWorker when the scope is unknown → never shares', () => {
  const { repo, wt, deps, calls } = sharedFixture();

  const res = seedCoordinatorWorker({ repoRoot: repo, blueprintDir: BP_REL, worktreePath: wt, deps });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(fs.existsSync(path.join(wt, 'node_modules')) && isLink(wt), false);
  assert.strictEqual(calls.length, 1);
});

test('seedCoordinatorWorker when a real node_modules directory exists → does not replace it with a link', () => {
  const { repo, wt, deps, calls } = sharedFixture();
  writeInstalled(wt);

  const res = seedCoordinatorWorker({
    repoRoot: repo, blueprintDir: BP_REL, worktreePath: wt, deps, affectedPaths: ['src/'],
  });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(isLink(wt), false);
  assert.deepStrictEqual(calls, []);
});

test('prepareDependencies when a shared lock changed → unlinks only the link and installs without touching main', () => {
  const { repo, wt, deps, calls } = sharedFixture();
  assert.strictEqual(prepareDependencies(wt, deps, { affectedPaths: ['src/'] }).ok, true);
  assert.strictEqual(isLink(wt), true);
  const mainStamp = read(repo, STAMP);
  const mainMarker = read(repo, 'node_modules/.package-lock.json');
  write(wt, 'package-lock.json', '{"v":3}\n');
  // npm이 링크 너머로 쓰는지 관찰하려고 호출 시점의 링크 여부를 기록한다.
  const seen = [];
  const spy = {
    mainCheckout: repo,
    execFileSync(command, args, options) {
      seen.push(fs.lstatSync(path.join(options.cwd, 'node_modules'), { throwIfNoEntry: false })?.isSymbolicLink() ?? null);
    },
  };

  const res = prepareDependencies(wt, spy, { affectedPaths: ['src/'] });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.deepStrictEqual(seen, [null]);
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(read(repo, STAMP), mainStamp);
  assert.strictEqual(read(repo, 'node_modules/.package-lock.json'), mainMarker);
  assert.strictEqual(fs.existsSync(path.join(repo, 'node_modules/left-pad/package.json')), true);
});

test('prepareDependencies when the shared link is broken → unlinks it and installs in the worktree', () => {
  const { repo, wt, deps } = sharedFixture();
  assert.strictEqual(prepareDependencies(wt, deps, { affectedPaths: ['src/'] }).ok, true);
  fs.rmSync(path.join(repo, 'node_modules'), { recursive: true });
  const calls = [];

  const res = prepareDependencies(wt, { mainCheckout: repo, execFileSync(...a) { calls.push(a); } }, { affectedPaths: ['src/'] });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(calls.length, 1);
  // 설치 stamp가 worktree 안에 새 실제 디렉터리를 만들며, 사라진 main target은 다시 생기지 않는다.
  assert.strictEqual(isLink(wt), false);
  assert.strictEqual(fs.existsSync(path.join(repo, 'node_modules')), false);
});

test('prepareDependencies from the main checkout itself → never links and keeps its node_modules bytes', () => {
  const { repo, deps, calls } = sharedFixture();
  const stampBefore = read(repo, STAMP);

  const res = prepareDependencies(repo, deps, { affectedPaths: ['src/'] });

  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(isLink(repo), false);
  assert.strictEqual(read(repo, STAMP), stampBefore);
  assert.deepStrictEqual(calls, []);
});
