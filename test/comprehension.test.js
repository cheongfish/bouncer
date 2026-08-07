'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  computeDiffSha,
  findComprehensionEntry,
  DIFF_EXCLUDED_PREFIXES,
  EXPLAIN_SECTION_DEFS,
} = require('../scripts/lib/comprehension');

// Fake git: argv is the args after `git`. Callers inject this so unit tests
// never spawn a real process.
function fakeExec(files) {
  return (args) => {
    if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
      return { status: 0, stdout: 'true\n', stderr: '' };
    }
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      return { status: 0, stdout: 'abc123\n', stderr: '' };
    }
    if (args[0] === 'diff' && args.includes('--name-only')) {
      return { status: 0, stdout: `${files.join('\n')}\n`, stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `unexpected: ${args.join(' ')}` };
  };
}

function failing(reason) {
  return (args) => {
    if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
      if (reason === 'not-a-repo') return { status: 128, stdout: '', stderr: 'not a git repo' };
      return { status: 0, stdout: 'true\n', stderr: '' };
    }
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      if (reason === 'no-base') return { status: 128, stdout: '', stderr: 'unknown revision' };
      return { status: 0, stdout: 'abc\n', stderr: '' };
    }
    if (args[0] === 'diff') {
      return { status: 1, stdout: '', stderr: 'diff failed' };
    }
    return { status: 1, stdout: '', stderr: 'fail' };
  };
}

test('DIFF_EXCLUDED_PREFIXES and EXPLAIN_SECTION_DEFS are named constants', () => {
  assert.deepStrictEqual(DIFF_EXCLUDED_PREFIXES, ['.bouncer/context/']);
  assert.deepStrictEqual(
    EXPLAIN_SECTION_DEFS,
    ['background', 'intuition', 'code', 'quiz', 'understanding'],
  );
});

test('computeDiffSha ignores .bouncer/context/ paths when hashing', () => {
  const repoRoot = '/tmp/unused';
  const base = 'develop';
  const a = computeDiffSha({
    repoRoot, base, exec: fakeExec(['src/a.ts', '.bouncer/context/x.md']),
  });
  const b = computeDiffSha({
    repoRoot, base, exec: fakeExec(['src/a.ts']),
  });
  assert.strictEqual(a.ok, true);
  assert.strictEqual(b.ok, true);
  assert.strictEqual(a.sha, b.sha);
});

test('computeDiffSha is order-stable for the same path set', () => {
  const a = computeDiffSha({
    repoRoot: '/x', base: 'develop',
    exec: fakeExec(['z.ts', 'a.ts', 'm.ts']),
  });
  const b = computeDiffSha({
    repoRoot: '/x', base: 'develop',
    exec: fakeExec(['a.ts', 'm.ts', 'z.ts']),
  });
  assert.strictEqual(a.sha, b.sha);
});

test('computeDiffSha failures are values, never thrown', () => {
  assert.deepStrictEqual(
    computeDiffSha({ repoRoot: '/x', base: 'nope', exec: failing('no-base') }),
    { ok: false, reason: 'no-base' },
  );
  assert.deepStrictEqual(
    computeDiffSha({ repoRoot: '/x', base: 'develop', exec: failing('not-a-repo') }),
    { ok: false, reason: 'not-a-repo' },
  );
  assert.deepStrictEqual(
    computeDiffSha({ repoRoot: '/x', base: 'develop', exec: failing('exec-failed') }),
    { ok: false, reason: 'exec-failed' },
  );
});

test('findComprehensionEntry rejects non-list and empty list', () => {
  assert.deepStrictEqual(
    findComprehensionEntry({ diff_sha: 'x' }, '001'),
    { ok: false, reason: 'not-a-list' },
  );
  assert.deepStrictEqual(
    findComprehensionEntry([], '001'),
    { ok: false, reason: 'missing' },
  );
});

test('findComprehensionEntry rejects duplicate task and incomplete fields', () => {
  assert.deepStrictEqual(
    findComprehensionEntry([
      {
        task: '001', range_from: 'a', range_to: 'b', diff_sha: 'x',
        quiz_score: '1/1', disposition: 'ok', recorded_at: 't',
      },
      {
        task: '001', range_from: 'c', range_to: 'd', diff_sha: 'y',
        quiz_score: '1/1', disposition: 'ok', recorded_at: 't',
      },
    ], '001'),
    { ok: false, reason: 'duplicate' },
  );
  for (const incomplete of [
    { range_from: '' },
    { diff_sha: '' },
    { disposition: '' },
    { range_from: '   ' },
  ]) {
    assert.deepStrictEqual(
      findComprehensionEntry([{
        task: '001',
        range_from: 'sha',
        range_to: 'head',
        diff_sha: 'abc',
        quiz_score: '1/1',
        disposition: 'ok',
        recorded_at: 't',
        ...incomplete,
      }], '001'),
      { ok: false, reason: 'incomplete' },
      `expected incomplete for ${JSON.stringify(incomplete)}`,
    );
  }
});

test('findComprehensionEntry returns the matching complete entry', () => {
  const entry = {
    task: '002',
    range_from: 'base-sha',
    range_to: 'head-sha',
    diff_sha: 'digest',
    quiz_score: '2/3',
    disposition: 'ship',
    recorded_at: '2026-08-07T00:00:00+09:00',
  };
  assert.deepStrictEqual(
    findComprehensionEntry([
      {
        task: '001', range_from: 'a', range_to: 'b', diff_sha: 'x',
        quiz_score: '1/1', disposition: 'ok', recorded_at: 't',
      },
      entry,
    ], '002'),
    { ok: true, entry },
  );
  // resolveTaskUnit.number 는 숫자이므로 pad 정규화로 맞춰야 한다.
  assert.deepStrictEqual(
    findComprehensionEntry([entry], 2),
    { ok: true, entry },
  );
});
