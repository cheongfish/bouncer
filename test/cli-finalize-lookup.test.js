'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runCli } = require('../scripts/lib/cli');
const { worktreePathFor } = require('../scripts/lib/runtime-state');
const { computeDiffSha } = require('../scripts/lib/comprehension');

const BLUEPRINT = '.bouncer/context/epics/e/blueprints/b';

// 커밋 1개짜리 임시 git 저장소. 두 조회 명령은 읽기 전용이라 문서 없이도 동작해야 한다.
function makeRepo() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'finalize-lookup-')));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  git('config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git('add', 'a.txt');
  git('commit', '-q', '-m', 'init');
  return dir;
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('worktree-path에 --blueprint를 주면 → worktreePathFor 결과 한 줄과 exit 0', () => {
  const repoRoot = makeRepo();
  const r = capture(['finalize', 'worktree-path', '--blueprint', BLUEPRINT, '--repo', repoRoot]);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.out, `${worktreePathFor({ repoRoot, blueprint: BLUEPRINT })}\n`);
});

test('worktree-path에 --blueprint가 없으면 → exit 2와 usage', () => {
  const r = capture(['finalize', 'worktree-path']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /usage: bouncer finalize worktree-path --blueprint <dir>/);
  assert.strictEqual(r.out, '');
});

test('worktree-path에서 blueprint id를 파싱하지 못하면 → exit 1과 접두 메시지', () => {
  const repoRoot = makeRepo();
  const r = capture(['finalize', 'worktree-path', '--blueprint', 'not/a/blueprint', '--repo', repoRoot]);
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /^finalize worktree-path: /);
  assert.strictEqual(r.out, '');
});

test('diff-sha --base HEAD → computeDiffSha JSON 한 줄과 exit 0', () => {
  const repoRoot = makeRepo();
  const r = capture(['finalize', 'diff-sha', '--base', 'HEAD', '--repo', repoRoot]);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.out, `${JSON.stringify(computeDiffSha({ repoRoot, base: 'HEAD' }))}\n`);
});

test('diff-sha에 없는 ref를 주면 → no-base JSON과 exit 1', () => {
  const repoRoot = makeRepo();
  const r = capture(['finalize', 'diff-sha', '--base', 'no-such-ref', '--repo', repoRoot]);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.out, '{"ok":false,"reason":"no-base"}\n');
});

test('diff-sha에 --base가 없으면 → exit 2와 usage', () => {
  const r = capture(['finalize', 'diff-sha']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /usage: bouncer finalize diff-sha --base <ref>/);
  assert.strictEqual(r.out, '');
});

test('다른 cwd에서 --repo를 주면 → 같은 저장소의 diff-sha와 같은 stdout', () => {
  const repoRoot = makeRepo();
  const other = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'finalize-lookup-cwd-')));
  const expected = `${JSON.stringify(computeDiffSha({ repoRoot, base: 'HEAD' }))}\n`;
  const prev = process.cwd();
  process.chdir(other);
  try {
    const r = capture(['finalize', 'diff-sha', '--base', 'HEAD', '--repo', repoRoot]);
    assert.strictEqual(r.code, 0);
    assert.strictEqual(r.out, expected);
  } finally {
    process.chdir(prev);
  }
});

test('--repo가 git 저장소가 아니면 → not-a-repo JSON과 exit 1', () => {
  const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'finalize-lookup-plain-')));
  const r = capture(['finalize', 'diff-sha', '--base', 'HEAD', '--repo', plain]);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.out, '{"ok":false,"reason":"not-a-repo"}\n');
});
