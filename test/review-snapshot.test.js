'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  captureReviewSnapshot,
  loadReviewSnapshot,
  checkReviewSnapshotCurrent,
} = require('../scripts/lib/review-snapshot');

// 실제 Git 저장소를 쓰는 integration 테스트다. 기대 값은 fixture에서 직접 만든 내용과
// 줄 수에서 계산하며 구현의 출력에서 가져오지 않는다.
const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

function gitEnv() {
  const env = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY']) delete env[key];
  return env;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() }).trim();
}

function makeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-review-snapshot-')));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  fs.writeFileSync(path.join(repo, 'keep.txt'), 'one\ntwo\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-qm', 'baseline']);
  return repo;
}

function write(repo, rel, content) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function capture(repo, base, extra = {}) {
  return captureReviewSnapshot({
    repoRoot: repo,
    blueprintDir: BP,
    taskId: '001',
    base,
    head: git(repo, ['rev-parse', 'HEAD']),
    ...extra,
  });
}

function setup() {
  const repo = makeRepo();
  const base = git(repo, ['rev-parse', 'HEAD']);
  return { repo, base };
}

function byPath(result) {
  return Object.fromEntries(result.snapshot.files.map((f) => [f.path, f]));
}

test('committed, staged, unstaged and untracked changes → all count once from the final state', () => {
  const { repo, base } = setup();
  write(repo, 'committed.txt', 'a\nb\n');
  git(repo, ['add', 'committed.txt']);
  git(repo, ['commit', '-qm', 'committed']);
  write(repo, 'staged.txt', 'x\n');
  git(repo, ['add', 'staged.txt']);
  write(repo, 'keep.txt', 'one\nTWO\n');
  write(repo, 'untracked.txt', 'u1\nu2\nu3\n');
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(Object.keys(byPath(result)).sort(), [
    'committed.txt', 'keep.txt', 'staged.txt', 'untracked.txt',
  ]);
  assert.strictEqual(result.snapshot.changed_files, 4);
  // committed 2 + staged 1 + keep.txt(-two +TWO) 2 + untracked 3
  assert.strictEqual(result.snapshot.changed_lines, 8);
  assert.match(result.snapshot_id, /^[0-9a-f]{64}$/);
  assert.strictEqual(result.snapshot_path, `.bouncer/runtime/review-snapshots/${result.snapshot_id}/snapshot.json`);
  assert.ok(fs.existsSync(path.join(repo, result.snapshot_path)));
});

test('same final content captured twice → returns the same id', () => {
  const { repo, base } = setup();
  write(repo, 'keep.txt', 'one\nTWO\n');
  const first = capture(repo, base);
  const second = capture(repo, base);
  assert.strictEqual(second.snapshot_id, first.snapshot_id);
});

test('tracked edit of 500 lines → changed_lines is 500 and not zero', () => {
  const { repo } = setup();
  write(repo, 'big.txt', '');
  git(repo, ['add', 'big.txt']);
  git(repo, ['commit', '-qm', 'empty big']);
  const base = git(repo, ['rev-parse', 'HEAD']);
  write(repo, 'big.txt', `${Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n')}\n`);
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.snapshot.changed_lines, 500);
  assert.strictEqual(result.snapshot.changed_files, 1);
});

test('untracked file added or edited → id changes each time', () => {
  const { repo, base } = setup();
  const clean = capture(repo, base);
  write(repo, 'new.txt', 'a\n');
  const added = capture(repo, base);
  write(repo, 'new.txt', 'b\n');
  const edited = capture(repo, base);
  assert.notStrictEqual(added.snapshot_id, clean.snapshot_id);
  assert.notStrictEqual(edited.snapshot_id, added.snapshot_id);
});

test('same final content with a different index → id differs while lines stay equal', () => {
  const { repo, base } = setup();
  write(repo, 'keep.txt', 'one\nTWO\n');
  const unstaged = capture(repo, base);
  git(repo, ['add', 'keep.txt']);
  const staged = capture(repo, base);
  assert.strictEqual(staged.snapshot.changed_lines, unstaged.snapshot.changed_lines);
  assert.notStrictEqual(staged.snapshot_id, unstaged.snapshot_id);
});

test('staged change reverted in the worktree → succeeds with zero lines and a distinct id', () => {
  const { repo, base } = setup();
  const clean = capture(repo, base);
  write(repo, 'keep.txt', 'one\nTWO\n');
  git(repo, ['add', 'keep.txt']);
  write(repo, 'keep.txt', 'one\ntwo\n');
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.snapshot.changed_lines, 0);
  assert.strictEqual(result.snapshot.changed_files, 0);
  assert.notStrictEqual(result.snapshot_id, clean.snapshot_id);
});

test('delete, rename and mode change → rename is normalized to delete plus add', () => {
  const { repo, base } = setup();
  git(repo, ['mv', 'README', 'RENAMED']);
  fs.unlinkSync(path.join(repo, 'keep.txt'));
  write(repo, 'run.sh', 'echo hi\n');
  fs.chmodSync(path.join(repo, 'run.sh'), 0o755);
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const files = byPath(result);
  assert.strictEqual(files.README.kind, 'deleted');
  assert.strictEqual(files.RENAMED.kind, 'text');
  assert.strictEqual(files.RENAMED.content, 'base\n');
  assert.strictEqual(files['keep.txt'].kind, 'deleted');
  assert.strictEqual(files['run.sh'].mode, '100755');
  assert.strictEqual(result.snapshot.changed_files, 4);
  // README -1, RENAMED +1, keep.txt -2, run.sh +1
  assert.strictEqual(result.snapshot.changed_lines, 5);
});

test('executable bit toggled on a tracked file → id changes', () => {
  const { repo, base } = setup();
  const before = capture(repo, base);
  fs.chmodSync(path.join(repo, 'README'), 0o755);
  const after = capture(repo, base);
  assert.notStrictEqual(after.snapshot_id, before.snapshot_id);
  assert.strictEqual(byPath(after).README.mode, '100755');
});

test('binary file → stored as base64 bytes and counted as a file without lines', () => {
  const { repo, base } = setup();
  const bytes = Buffer.from([0, 1, 2, 255, 254, 0]);
  fs.writeFileSync(path.join(repo, 'logo.bin'), bytes);
  write(repo, 'a.txt', 'one line\n');
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const files = byPath(result);
  assert.strictEqual(files['logo.bin'].kind, 'binary');
  assert.deepStrictEqual(Buffer.from(files['logo.bin'].content, 'base64'), bytes);
  assert.strictEqual(result.snapshot.changed_files, 2);
  assert.strictEqual(result.snapshot.changed_lines, 1);
});

test('symlink pointing outside the repo → stores the link target only and never follows it', () => {
  const { repo, base } = setup();
  const outside = path.join(path.dirname(repo), `${path.basename(repo)}-secret.txt`);
  fs.writeFileSync(outside, 'TOP SECRET\n');
  fs.symlinkSync(outside, path.join(repo, 'link'));
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const link = byPath(result).link;
  assert.strictEqual(link.kind, 'symlink');
  assert.strictEqual(link.mode, '120000');
  assert.strictEqual(link.content, outside);
  assert.ok(!JSON.stringify(result.snapshot).includes('TOP SECRET'));
});

test('file below a symlinked directory → rejected as an unsafe path', () => {
  const { repo, base } = setup();
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-outside-'));
  fs.writeFileSync(path.join(outsideDir, 'x.txt'), 'x\n');
  fs.symlinkSync(outsideDir, path.join(repo, 'dirlink'));
  const result = capture(repo, base, {
    deps: {
      // git은 symlink 조상 아래 경로를 보고하지 않으므로, 보고했다고 가정하는 상황을 주입한다.
      runGit: (args) => {
        const out = execFileSync('git', args, { cwd: repo, env: gitEnv() });
        return args.includes('--others') ? Buffer.from('dirlink/x.txt\0') : out;
      },
    },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'unsafe-path');
});

test('special file names → captured literally with the right path', () => {
  const { repo, base } = setup();
  const names = ["we ird 'q' ü*.txt", 'tab\tname.txt', '[glob]?.txt'];
  for (const n of names) write(repo, n, `${n}\n`);
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const files = byPath(result);
  for (const n of names) assert.strictEqual(files[n].content, `${n}\n`);
});

test('git-ignored files → are not part of the snapshot', () => {
  const { repo, base } = setup();
  git(repo, ['config', 'core.excludesFile', '/dev/null']);
  write(repo, '.gitignore', '*.log\n');
  git(repo, ['add', '.gitignore']);
  git(repo, ['commit', '-qm', 'ignore']);
  write(repo, 'noise.log', 'noise\n');
  write(repo, 'real.txt', 'real\n');
  const result = capture(repo, base);
  const files = byPath(result);
  assert.ok(!('noise.log' in files));
  assert.ok('real.txt' in files);
});

test('plan documents and automatic evidence writes → plan docs are included and evidence keeps the id', () => {
  const { repo, base } = setup();
  write(repo, `${BP}/tasks/001/tasks.md`, '# tasks\n');
  const first = capture(repo, base);
  assert.ok(`${BP}/tasks/001/tasks.md` in byPath(first));

  write(repo, `${BP}/review.md`, '# review\n');
  write(repo, `${BP}/tasks/001/verification.md`, '# v\n');
  write(repo, `${BP}/context-review.md`, '# c\n');
  write(repo, `${BP}/.review.md.123.tmp`, 'tmp\n');
  write(repo, '.bouncer/runtime/other/state.json', '{}\n');
  const afterEvidence = capture(repo, base);
  assert.strictEqual(afterEvidence.snapshot_id, first.snapshot_id);

  write(repo, `${BP}/tasks/001/tasks.md`, '# tasks edited\n');
  const afterPlanEdit = capture(repo, base);
  assert.notStrictEqual(afterPlanEdit.snapshot_id, first.snapshot_id);
});

test('frozen diff and untracked bytes → equal the content collected from the worktree', () => {
  const { repo, base } = setup();
  write(repo, 'keep.txt', 'one\nTWO\n');
  write(repo, 'fresh.txt', 'fresh bytes\n');
  const result = capture(repo, base);
  assert.match(result.snapshot.diff, /-two\n\+TWO/);
  assert.strictEqual(byPath(result)['fresh.txt'].content, 'fresh bytes\n');
  assert.strictEqual(byPath(result)['keep.txt'].content, fs.readFileSync(path.join(repo, 'keep.txt'), 'utf8'));
  const loaded = loadReviewSnapshot({ repoRoot: repo, snapshotId: result.snapshot_id });
  assert.strictEqual(loaded.ok, true, JSON.stringify(loaded));
  assert.deepStrictEqual(loaded.snapshot, result.snapshot);
});

test('capture → leaves source, index and HEAD untouched and only adds the runtime artifact', () => {
  const { repo, base } = setup();
  write(repo, 'keep.txt', 'one\nTWO\n');
  git(repo, ['add', 'keep.txt']);
  write(repo, 'untracked.txt', 'u\n');
  const stateOf = () => ({
    head: git(repo, ['rev-parse', 'HEAD']),
    index: git(repo, ['ls-files', '-s']),
    keep: fs.readFileSync(path.join(repo, 'keep.txt'), 'utf8'),
    untracked: fs.readFileSync(path.join(repo, 'untracked.txt'), 'utf8'),
    branch: git(repo, ['branch', '--show-current']),
  });
  const before = stateOf();
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(stateOf(), before);
  const status = git(repo, ['status', '--porcelain']).split('\n').sort();
  assert.deepStrictEqual(status, ['?? .bouncer/', '?? untracked.txt', 'M  keep.txt'].sort());
});

test('head that is not the current HEAD → rejected with head-mismatch', () => {
  const { repo, base } = setup();
  write(repo, 'later.txt', 'x\n');
  git(repo, ['add', 'later.txt']);
  git(repo, ['commit', '-qm', 'later']);
  const result = captureReviewSnapshot({
    repoRoot: repo, blueprintDir: BP, taskId: '001', base, head: base,
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'head-mismatch');
  assert.ok(result.cause && result.next);
});

test('missing, corrupt or malformed artifacts → rejected without a success result', () => {
  const { repo, base } = setup();
  const result = capture(repo, base);
  const abs = path.join(repo, result.snapshot_path);

  const badId = loadReviewSnapshot({ repoRoot: repo, snapshotId: '../../etc/passwd' });
  assert.strictEqual(badId.ok, false);
  assert.strictEqual(badId.reason, 'invalid-snapshot-id');

  const missing = loadReviewSnapshot({ repoRoot: repo, snapshotId: 'a'.repeat(64) });
  assert.strictEqual(missing.reason, 'snapshot-missing');

  const original = fs.readFileSync(abs, 'utf8');
  fs.writeFileSync(abs, original.replace('"changed_lines":0', '"changed_lines":7'));
  const tampered = loadReviewSnapshot({ repoRoot: repo, snapshotId: result.snapshot_id });
  assert.strictEqual(tampered.ok, false);
  assert.strictEqual(tampered.reason, 'snapshot-corrupt');

  // 같은 id의 손상 파일을 재수집이 조용히 덮어쓰지 않는다.
  const recapture = capture(repo, base);
  assert.strictEqual(recapture.ok, false);
  assert.strictEqual(recapture.reason, 'snapshot-corrupt');
  assert.notStrictEqual(fs.readFileSync(abs, 'utf8'), original);

  fs.writeFileSync(abs, '{not json');
  const truncated = loadReviewSnapshot({ repoRoot: repo, snapshotId: result.snapshot_id });
  assert.strictEqual(truncated.reason, 'snapshot-corrupt');
});

test('file read failure → rejected with read-failed', () => {
  const { repo, base } = setup();
  write(repo, 'a.txt', 'a\n');
  const result = capture(repo, base, {
    deps: { readFile: () => { throw new Error('EIO: boom'); } },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'read-failed');
  assert.match(result.cause, /EIO: boom/);
});

test('artifact persist failure → rejected and no success snapshot is returned', () => {
  const { repo, base } = setup();
  write(repo, 'a.txt', 'a\n');
  const result = capture(repo, base, {
    deps: { persistArtifact: () => { throw new Error('ENOSPC: disk full'); } },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'persist-failed');
  assert.match(result.cause, /ENOSPC/);
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/runtime/review-snapshots')));
});

test('git failure → rejected with git-failed instead of zero lines', () => {
  const { repo, base } = setup();
  const result = capture(repo, base, {
    deps: { runGit: () => { throw new Error('fatal: not a git repository'); } },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'git-failed');
});

test('file edited while it is being read → rejected with changed-during-capture', () => {
  const { repo, base } = setup();
  write(repo, 'a.txt', 'a\n');
  const result = capture(repo, base, {
    deps: {
      readFile: (abs) => {
        const bytes = fs.readFileSync(abs);
        // 읽은 직후 길이가 다른 내용으로 바꿔 lstat 서명이 달라지게 한다.
        fs.writeFileSync(abs, 'changed while reading\n');
        return bytes;
      },
    },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'changed-during-capture');
});

test('index changed while capturing → rejected with changed-during-capture', () => {
  const { repo, base } = setup();
  write(repo, 'a.txt', 'a\n');
  let indexReads = 0;
  const result = capture(repo, base, {
    deps: {
      runGit: (args) => {
        const out = execFileSync('git', args, { cwd: repo, env: gitEnv() });
        if (args.includes('ls-files') && args.includes('-s')) {
          indexReads += 1;
          // 첫 상태 읽기 직후 index를 바꿔 두 번째 읽기가 달라지게 한다.
          if (indexReads === 1) git(repo, ['add', 'a.txt']);
        }
        return out;
      },
    },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'changed-during-capture');
});

test('untracked nested repository → is left out of the snapshot like ignored content', () => {
  const { repo, base } = setup();
  git(repo, ['init', '-q', 'nested']);
  write(repo, 'nested/file.txt', 'x\n');
  git(path.join(repo, 'nested'), ['config', 'user.email', 't@example.com']);
  git(path.join(repo, 'nested'), ['config', 'user.name', 't']);
  git(path.join(repo, 'nested'), ['add', '-A']);
  git(path.join(repo, 'nested'), ['commit', '-qm', 'n']);
  write(repo, 'a.txt', 'a\n');
  const result = capture(repo, base);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(Object.keys(byPath(result)), ['a.txt']);
});

test('conflicted index → rejected as an unsupported state', () => {
  const { repo, base } = setup();
  git(repo, ['checkout', '-q', '-b', 'side']);
  write(repo, 'keep.txt', 'side\n');
  git(repo, ['commit', '-qam', 'side']);
  git(repo, ['checkout', '-q', 'main']);
  write(repo, 'keep.txt', 'main\n');
  git(repo, ['commit', '-qam', 'main']);
  assert.throws(() => git(repo, ['merge', 'side']));
  const result = captureReviewSnapshot({
    repoRoot: repo, blueprintDir: BP, taskId: '001', base, head: git(repo, ['rev-parse', 'HEAD']),
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'unsupported-state');
});

test('current-state check → accepts an unchanged tree and rejects edits, new files, scope and head drift', () => {
  const { repo, base } = setup();
  write(repo, 'keep.txt', 'one\nTWO\n');
  const frozen = capture(repo, base);
  const args = (extra = {}) => ({
    repoRoot: repo,
    snapshotId: frozen.snapshot_id,
    blueprintDir: BP,
    taskId: '001',
    base,
    head: git(repo, ['rev-parse', 'HEAD']),
    ...extra,
  });

  assert.strictEqual(checkReviewSnapshotCurrent(args()).ok, true);

  // 자동 증거를 쓰는 중에도 self-stale이 되지 않는다.
  write(repo, `${BP}/review.md`, '# r\n');
  assert.strictEqual(checkReviewSnapshotCurrent(args()).ok, true);

  const wrongScope = checkReviewSnapshotCurrent(args({ taskId: '002' }));
  assert.strictEqual(wrongScope.reason, 'scope-mismatch');
  const wrongBlueprint = checkReviewSnapshotCurrent(args({ blueprintDir: `${BP}-other` }));
  assert.strictEqual(wrongBlueprint.reason, 'scope-mismatch');

  write(repo, 'keep.txt', 'one\nTHREE\n');
  assert.strictEqual(checkReviewSnapshotCurrent(args()).reason, 'snapshot-stale');
  write(repo, 'keep.txt', 'one\nTWO\n');
  assert.strictEqual(checkReviewSnapshotCurrent(args()).ok, true);

  write(repo, 'extra.txt', 'new\n');
  assert.strictEqual(checkReviewSnapshotCurrent(args()).reason, 'snapshot-stale');
  fs.unlinkSync(path.join(repo, 'extra.txt'));

  git(repo, ['add', 'keep.txt']);
  assert.strictEqual(checkReviewSnapshotCurrent(args()).reason, 'snapshot-stale');
  git(repo, ['reset', '-q', 'keep.txt']);

  git(repo, ['commit', '--allow-empty', '-qm', 'drift']);
  assert.strictEqual(checkReviewSnapshotCurrent(args({ head: base })).reason, 'head-mismatch');
});
