'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkPrerequisites, prerequisiteFormatIssues } = require('../scripts/lib/plan-prerequisites');

const EPIC = '.bouncer/context/epics/plan-workflow';
const SELF = `${EPIC}/blueprints/drive-plan-quality`;
const PRE = `${EPIC}/blueprints/earlier-plan`;
const PRE2 = `${EPIC}/blueprints/other-plan`;
const SHA = 'a'.repeat(40);
const SHA2 = 'b'.repeat(40);

function mkRepo(docs) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-prereq-'));
  for (const [dir, prerequisites] of Object.entries(docs)) {
    const abs = path.join(repo, dir, 'index.md');
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const lines = ['---', 'bouncer:', '  status: draft'];
    if (prerequisites !== undefined) lines.push(`  prerequisites: ${JSON.stringify(prerequisites)}`);
    fs.writeFileSync(abs, `${lines.join('\n')}\n---\n# x\n`);
  }
  return repo;
}

// Git seam: 호출 argv를 기록하고 명령별 종료 코드를 돌려준다.
function fakeGit({ object = 0, ancestor = 0 } = {}) {
  const calls = [];
  const exec = (args) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return { status: object, stdout: '' };
    if (args[0] === 'merge-base') return { status: ancestor, stdout: '' };
    return { status: 99, stdout: '' };
  };
  return { exec, calls };
}

const entry = (blueprint = PRE, merged_commit = SHA) => ({ blueprint, merged_commit });

test('prerequisites absent or empty → no entries, no issues, and git is never called', () => {
  for (const decl of [undefined, []]) {
    const repo = mkRepo({ [SELF]: decl });
    const git = fakeGit();
    const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: git.exec });
    assert.deepStrictEqual(r, { formatIssues: [], entries: [], cycles: [] });
    assert.deepStrictEqual(git.calls, []);
  }
});

test('merge result commit is an ancestor of HEAD → entry is merged', () => {
  const repo = mkRepo({ [SELF]: [entry()], [PRE]: undefined });
  const git = fakeGit();
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: git.exec });
  assert.deepStrictEqual(r.entries, [
    { blueprint: PRE, merged_commit: SHA, blueprintFound: true, commitState: 'merged' },
  ]);
  assert.deepStrictEqual(git.calls, [
    ['rev-parse', '--verify', '--quiet', `${SHA}^{commit}`],
    ['merge-base', '--is-ancestor', SHA, 'HEAD'],
  ]);
});

test('declared commit is not an ancestor of HEAD even if the blueprint is closed → entry is unmerged', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-prereq-'));
  fs.mkdirSync(path.join(repo, PRE), { recursive: true });
  fs.writeFileSync(path.join(repo, PRE, 'index.md'), '---\nbouncer:\n  status: closed\n---\n# x\n');
  fs.mkdirSync(path.join(repo, SELF), { recursive: true });
  fs.writeFileSync(
    path.join(repo, SELF, 'index.md'),
    `---\nbouncer:\n  prerequisites: ${JSON.stringify([entry()])}\n---\n# x\n`,
  );
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: fakeGit({ ancestor: 1 }).exec });
  assert.strictEqual(r.entries[0].commitState, 'unmerged');
  assert.strictEqual(r.entries[0].blueprintFound, true);
});

test('squash merge result commit differs from worker commits → only the declared result is judged', () => {
  const repo = mkRepo({ [SELF]: [entry(PRE, SHA2)], [PRE]: undefined });
  const git = fakeGit();
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: git.exec });
  assert.strictEqual(r.entries[0].merged_commit, SHA2);
  assert.deepStrictEqual(git.calls.map((c) => c.some((a) => a.startsWith(SHA2))), [true, true]);
});

test('commit object is missing in the repository → entry is object-missing without an ancestry call', () => {
  const repo = mkRepo({ [SELF]: [entry()], [PRE]: undefined });
  const git = fakeGit({ object: 1 });
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: git.exec });
  assert.strictEqual(r.entries[0].commitState, 'object-missing');
  assert.strictEqual(git.calls.length, 1);
});

test('git fails with a status other than 1 → entry is lookup-error, never merged', () => {
  const repo = mkRepo({ [SELF]: [entry(), entry(PRE2, SHA2)], [PRE]: undefined, [PRE2]: undefined });
  const objectFail = checkPrerequisites({
    repoRoot: repo, blueprintDir: SELF, exec: fakeGit({ object: 128 }).exec,
  });
  assert.deepStrictEqual(objectFail.entries.map((e) => e.commitState), ['lookup-error', 'lookup-error']);
  const ancestryFail = checkPrerequisites({
    repoRoot: repo, blueprintDir: SELF, exec: fakeGit({ ancestor: 128 }).exec,
  });
  assert.deepStrictEqual(ancestryFail.entries.map((e) => e.commitState), ['lookup-error', 'lookup-error']);
});

test('referenced blueprint document does not exist → blueprintFound is false', () => {
  const repo = mkRepo({ [SELF]: [entry()] });
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: fakeGit().exec });
  assert.strictEqual(r.entries[0].blueprintFound, false);
});

test('self reference → is a format issue and is not sent to git', () => {
  const repo = mkRepo({ [SELF]: [entry(SELF)] });
  const git = fakeGit();
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: git.exec });
  assert.strictEqual(r.formatIssues.length, 1);
  assert.deepStrictEqual(r.entries, []);
  assert.deepStrictEqual(git.calls, []);
  assert.deepStrictEqual(r.cycles, []);
});

test('same blueprint declared twice → duplicate is a format issue and only the first reaches git', () => {
  const repo = mkRepo({ [SELF]: [entry(PRE, SHA), entry(PRE, SHA2)], [PRE]: undefined });
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: fakeGit().exec });
  assert.strictEqual(r.formatIssues.length, 1);
  assert.match(r.formatIssues[0], /duplicates/);
});

test('malformed sha → format issue is returned and git is not called for it', () => {
  const repo = mkRepo({ [SELF]: [entry(PRE, 'HEAD')], [PRE]: undefined });
  const git = fakeGit();
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: git.exec });
  assert.strictEqual(r.formatIssues.length, 1);
  assert.deepStrictEqual(git.calls, []);
});

test('two blueprints declare each other → cycle path is reported', () => {
  const repo = mkRepo({ [SELF]: [entry(PRE)], [PRE]: [entry(SELF, SHA2)] });
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: fakeGit().exec });
  assert.deepStrictEqual(r.cycles, [[SELF, PRE, SELF]]);
});

test('three blueprint chain without a back edge → no cycle', () => {
  const repo = mkRepo({ [SELF]: [entry(PRE)], [PRE]: [entry(PRE2, SHA2)], [PRE2]: undefined });
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF, exec: fakeGit().exec });
  assert.deepStrictEqual(r.cycles, []);
});

test('prerequisiteFormatIssues with non-array value → returns one issue', () => {
  assert.strictEqual(prerequisiteFormatIssues('x', SELF).length, 1);
  assert.deepStrictEqual(prerequisiteFormatIssues(undefined, SELF), []);
});

test('default exec runs real git without a shell → non-repository directory is lookup-error', () => {
  const repo = mkRepo({ [SELF]: [entry()], [PRE]: undefined });
  // 임시 디렉터리는 git 저장소가 아니므로 rev-parse가 1이 아닌 오류로 끝난다(통과로 접히면 안 된다).
  const r = checkPrerequisites({ repoRoot: repo, blueprintDir: SELF });
  assert.notStrictEqual(r.entries[0].commitState, 'merged');
});
