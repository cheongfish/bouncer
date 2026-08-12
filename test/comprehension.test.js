'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  computeDiffSha,
  resolveComprehensionEntry,
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

/** 완전 엔트리 픽스처. overrides로 필드만 덮어쓴다. */
function okEntry(overrides = {}) {
  return {
    task: '001',
    range_from: 'base-sha',
    range_to: 'head-sha',
    diff_sha: 'digest',
    quiz_score: '2/3',
    disposition: 'ship',
    recorded_at: '2026-08-07T00:00:00+09:00',
    ...overrides,
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

test('resolveComprehensionEntry rejects non-list and empty list', () => {
  assert.deepStrictEqual(
    resolveComprehensionEntry({ diff_sha: 'x' }),
    { ok: false, reason: 'not-a-list' },
  );
  assert.deepStrictEqual(
    resolveComprehensionEntry([]),
    { ok: false, reason: 'missing' },
  );
});

test('resolveComprehensionEntry rejects incomplete required fields', () => {
  for (const incomplete of [
    { range_from: '' },
    { diff_sha: '' },
    { disposition: '' },
    { quiz_score: '' },
    { range_from: '   ' },
  ]) {
    assert.deepStrictEqual(
      resolveComprehensionEntry([okEntry(incomplete)]),
      { ok: false, reason: 'incomplete' },
      `expected incomplete for ${JSON.stringify(incomplete)}`,
    );
  }
});

test('resolveComprehensionEntry returns the last complete entry', () => {
  const ok = okEntry({ task: '001', disposition: 'ok' });
  const ok2 = okEntry({
    task: '002',
    range_from: 'base-2',
    diff_sha: 'digest-2',
    quiz_score: '1/1',
    disposition: 'ship',
  });
  assert.deepStrictEqual(
    resolveComprehensionEntry([{ task: '001', ...ok }, { task: '002', ...ok2 }]).entry.task,
    '002',
  );
  assert.strictEqual(
    resolveComprehensionEntry([{ ...ok, quiz_score: '' }]).reason,
    'incomplete',
  );
  assert.deepStrictEqual(
    resolveComprehensionEntry([ok2]),
    { ok: true, entry: ok2 },
  );
  // quiz_score '0/0'은 빈 값이 아니므로 형식상 통과.
  const zero = okEntry({ quiz_score: '0/0' });
  assert.deepStrictEqual(
    resolveComprehensionEntry([zero]),
    { ok: true, entry: zero },
  );
});
