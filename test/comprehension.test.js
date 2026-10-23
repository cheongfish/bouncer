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

test('module constants are read → DIFF_EXCLUDED_PREFIXES and EXPLAIN_SECTION_DEFS are exported as named constants', () => {
  assert.deepStrictEqual(DIFF_EXCLUDED_PREFIXES, ['.bouncer/context/']);
  assert.deepStrictEqual(EXPLAIN_SECTION_DEFS, ['background', 'code', 'quiz']);
});

test('paths under .bouncer/context/ are in the diff → computeDiffSha ignores them when hashing', () => {
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

test('the same path set in a different order → computeDiffSha returns a stable sha', () => {
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

test('computeDiffSha hits a failure → it returns the failure as a value and never throws', () => {
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

test('comprehension entry is a non-list or an empty list → resolveComprehensionEntry rejects it', () => {
  assert.deepStrictEqual(
    resolveComprehensionEntry({ diff_sha: 'x' }),
    { ok: false, reason: 'not-a-list' },
  );
  assert.deepStrictEqual(
    resolveComprehensionEntry([]),
    { ok: false, reason: 'missing' },
  );
});

test('entry lacks required fields → resolveComprehensionEntry rejects the incomplete entry', () => {
  const fresh = {
    range_from: 'base-sha',
    range_to: 'head-sha',
    diff_sha: 'digest',
    recorded_at: '2026-10-02T00:00:00+09:00',
  };
  assert.deepStrictEqual(resolveComprehensionEntry([fresh]), { ok: true, entry: fresh });
  const legacy = { ...fresh, quiz_score: '', disposition: '' };
  assert.deepStrictEqual(resolveComprehensionEntry([legacy]), { ok: true, entry: legacy });
  for (const incomplete of [{ range_from: '' }, { diff_sha: '' }, { range_from: '   ' }]) {
    assert.deepStrictEqual(resolveComprehensionEntry([{ ...fresh, ...incomplete }]), {
      ok: false,
      reason: 'incomplete',
    });
  }
});

test('several entries exist → resolveComprehensionEntry returns the last complete entry', () => {
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
  // 옛 엔트리의 빈 quiz_score·disposition은 필수 필드가 아니므로 원본 그대로 ok.
  const emptyScore = { ...ok, quiz_score: '' };
  assert.deepStrictEqual(
    resolveComprehensionEntry([emptyScore]),
    { ok: true, entry: emptyScore },
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

// ---- 확인 이후 기록(finalize comprehension) ----
const nodeFs = require('node:fs');
const nodeOs = require('node:os');
const nodePath = require('node:path');
const { spawnSync } = require('node:child_process');
const { runCli } = require('../scripts/lib/cli');

const BP = '.bouncer/context/epics/e/blueprints/b';

function sh(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout.trim();
}

/** base 커밋 뒤 src 변경 커밋 한 개를 가진 실제 저장소와 explain.md를 만든다. */
function makeRecordRepo(explainText) {
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'bouncer-comp-'));
  sh(dir, ['init', '-q']);
  sh(dir, ['config', 'user.email', 't@t']);
  sh(dir, ['config', 'user.name', 't']);
  nodeFs.writeFileSync(nodePath.join(dir, 'a.txt'), 'a\n');
  sh(dir, ['add', '.']);
  sh(dir, ['commit', '-qm', 'base']);
  const base = sh(dir, ['rev-parse', 'HEAD']);
  const commitFile = (name) => {
    nodeFs.writeFileSync(nodePath.join(dir, name), 'x\n');
    sh(dir, ['add', '.']);
    sh(dir, ['commit', '-qm', name]);
    return sh(dir, ['rev-parse', 'HEAD']);
  };
  const head = commitFile('b.txt');
  const explainPath = nodePath.join(dir, BP, 'explain.md');
  if (explainText !== null) {
    nodeFs.mkdirSync(nodePath.dirname(explainPath), { recursive: true });
    nodeFs.writeFileSync(explainPath, explainText);
  }
  const digestFor = (b, h) => ({
    blueprint: { dir: BP },
    range: { base: b, head: h, diff_sha: computeDiffSha({ repoRoot: dir, base: b }).sha },
  });
  return { dir, base, head, commitFile, explainPath, digestFor };
}

const EXPLAIN = [
  '---', 'bouncer:', '  epic_id: e', '  status: draft', '  timestamp: 2026-01-01T00:00:00+09:00',
  '  published: true', '  comprehension: []', '---', '## Background', '본문 유지', '',
].join('\n');
const NOW = new Date('2026-10-23T03:04:05.678Z');
const NOW_KST = '2026-10-23T12:04:05.678+09:00';

function cli(dir, argv) {
  let out = '';
  let err = '';
  const code = runCli(['finalize', 'comprehension', ...argv, '--repo', dir], {
    out: (s) => { out += s; }, err: (s) => { err += s; },
  });
  return { code, out, err };
}

function recordDeps() {
  const { recordComprehension } = require('../scripts/lib/finalize-comprehension');
  return recordComprehension;
}

test('--confirm-quiz 없이 CLI 호출 → exit 1, comprehension-consent-required, 파일 bytes 불변', () => {
  const r = makeRecordRepo(EXPLAIN);
  try {
    const digestPath = nodePath.join(r.dir, 'digest.json');
    nodeFs.writeFileSync(digestPath, JSON.stringify(r.digestFor(r.base, r.head)));
    const before = nodeFs.readFileSync(r.explainPath, 'utf8');
    const res = cli(r.dir, ['--blueprint', BP, '--digest', digestPath]);
    assert.strictEqual(res.code, 1);
    assert.deepStrictEqual(JSON.parse(res.out), { ok: false, reason: 'comprehension-consent-required' });
    assert.strictEqual(nodeFs.readFileSync(r.explainPath, 'utf8'), before);
  } finally {
    nodeFs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('--confirm-quiz와 --refresh 동시 지정 → exit 2, 파일 bytes 불변', () => {
  const r = makeRecordRepo(EXPLAIN);
  try {
    const before = nodeFs.readFileSync(r.explainPath, 'utf8');
    const res = cli(r.dir, ['--blueprint', BP, '--digest', 'x.json', '--confirm-quiz', '--refresh']);
    assert.strictEqual(res.code, 2);
    assert.strictEqual(nodeFs.readFileSync(r.explainPath, 'utf8'), before);
  } finally {
    nodeFs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('확인과 일치하는 digest → CLI가 현재 시각 entry 한 개를 쓰고 본문·타 frontmatter를 유지한다', () => {
  const r = makeRecordRepo(EXPLAIN);
  try {
    const digestPath = nodePath.join(r.dir, 'digest.json');
    nodeFs.writeFileSync(digestPath, JSON.stringify(r.digestFor(r.base, r.head)));
    const res = cli(r.dir, ['--blueprint', BP, '--digest', digestPath, '--confirm-quiz']);
    assert.strictEqual(res.code, 0, res.out + res.err);
    const out = JSON.parse(res.out);
    assert.strictEqual(out.ok, true);
    const text = nodeFs.readFileSync(r.explainPath, 'utf8');
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    const { data, body } = parseFrontmatter(text);
    assert.deepStrictEqual(data.bouncer.comprehension, [out.entry]);
    assert.strictEqual(data.bouncer.status, 'draft');
    assert.strictEqual(data.bouncer.published, true);
    assert.strictEqual(body, '## Background\n본문 유지\n');
  } finally {
    nodeFs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('고정 now와 실제 범위 → 정확한 KST recorded_at·range·diff_sha의 단일 entry, task 필드 없음', () => {
  const r = makeRecordRepo(EXPLAIN);
  try {
    const digest = r.digestFor(r.base, r.head);
    const result = recordDeps()({
      repoRoot: r.dir, blueprintDir: BP, digest, confirmed: true, refresh: false, deps: { now: () => NOW },
    });
    const expected = { range_from: r.base, range_to: r.head, diff_sha: digest.range.diff_sha, recorded_at: NOW_KST };
    assert.deepStrictEqual(result, { ok: true, entry: expected });
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    const written = parseFrontmatter(nodeFs.readFileSync(r.explainPath, 'utf8')).data.bouncer;
    assert.deepStrictEqual(written.comprehension, [expected]);
    assert.strictEqual(written.timestamp.toISOString ? written.timestamp.toISOString() : written.timestamp,
      new Date('2026-01-01T00:00:00+09:00').toISOString());
  } finally {
    nodeFs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('거절 입력들(stale HEAD·잘못된 digest·Explain 없음·확인 없음·refresh 최초) → reason을 돌려주고 bytes 불변', () => {
  const r = makeRecordRepo(EXPLAIN);
  const record = recordDeps();
  const call = (over) => record({
    repoRoot: r.dir, blueprintDir: BP, digest: r.digestFor(r.base, r.head), confirmed: true, refresh: false, ...over,
  });
  try {
    const before = nodeFs.readFileSync(r.explainPath, 'utf8');
    const stale = r.digestFor(r.base, r.head);
    r.commitFile('c.txt');
    assert.deepStrictEqual(call({ digest: stale }), { ok: false, reason: 'comprehension-target-stale' });
    const wrongSha = r.digestFor(r.base, sh(r.dir, ['rev-parse', 'HEAD']));
    wrongSha.range.diff_sha = 'deadbeef';
    assert.deepStrictEqual(call({ digest: wrongSha }), { ok: false, reason: 'comprehension-target-stale' });
    assert.deepStrictEqual(call({ digest: { range: {} } }), { ok: false, reason: 'comprehension-input-invalid' });
    assert.deepStrictEqual(call({ digest: undefined }), { ok: false, reason: 'comprehension-input-invalid' });
    assert.deepStrictEqual(call({ confirmed: false }), { ok: false, reason: 'comprehension-consent-required' });
    const fresh = r.digestFor(r.base, sh(r.dir, ['rev-parse', 'HEAD']));
    assert.deepStrictEqual(call({ digest: fresh, confirmed: false, refresh: true }),
      { ok: false, reason: 'comprehension-input-invalid' });
    assert.strictEqual(nodeFs.readFileSync(r.explainPath, 'utf8'), before);
    nodeFs.rmSync(r.explainPath);
    assert.deepStrictEqual(call({ digest: fresh }), { ok: false, reason: 'comprehension-input-invalid' });
    assert.strictEqual(nodeFs.existsSync(r.explainPath), false);
  } finally {
    nodeFs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('기존 기록 뒤 후속 HEAD에서 --refresh → range_from 유지, range_to·diff_sha·recorded_at 갱신', () => {
  const r = makeRecordRepo(EXPLAIN);
  const record = recordDeps();
  try {
    const first = record({
      repoRoot: r.dir, blueprintDir: BP, digest: r.digestFor(r.base, r.head),
      confirmed: true, refresh: false, deps: { now: () => NOW },
    });
    assert.strictEqual(first.ok, true);
    const head2 = r.commitFile('c.txt');
    const digest2 = r.digestFor(r.base, head2);
    const later = new Date('2026-10-24T00:00:00.000Z');
    const result = record({
      repoRoot: r.dir, blueprintDir: BP, digest: digest2, confirmed: false, refresh: true, deps: { now: () => later },
    });
    assert.deepStrictEqual(result, {
      ok: true,
      entry: {
        range_from: r.base, range_to: head2, diff_sha: digest2.range.diff_sha,
        recorded_at: '2026-10-24T09:00:00.000+09:00',
      },
    });
    assert.notStrictEqual(digest2.range.diff_sha, first.entry.diff_sha);
    // base가 다른 digest로는 refresh할 수 없다.
    const other = record({
      repoRoot: r.dir, blueprintDir: BP, digest: r.digestFor(r.head, head2), confirmed: false, refresh: true,
    });
    assert.deepStrictEqual(other, { ok: false, reason: 'comprehension-target-stale' });
  } finally {
    nodeFs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('쓰기가 실패 → 오류를 전파하고 기존 explain.md bytes는 그대로다', () => {
  const r = makeRecordRepo(EXPLAIN);
  try {
    const before = nodeFs.readFileSync(r.explainPath, 'utf8');
    assert.throws(() => recordDeps()({
      repoRoot: r.dir, blueprintDir: BP, digest: r.digestFor(r.base, r.head), confirmed: true, refresh: false,
      deps: {
        fs: {
          readFileSync: nodeFs.readFileSync,
          writeFileSync: () => { throw new Error('disk full'); },
          renameSync: nodeFs.renameSync,
        },
      },
    }), /disk full/);
    assert.strictEqual(nodeFs.readFileSync(r.explainPath, 'utf8'), before);
  } finally {
    nodeFs.rmSync(r.dir, { recursive: true, force: true });
  }
});
