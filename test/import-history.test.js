'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync: realExec } = require('node:child_process');
const { planImport, applyImport } = require('../scripts/lib/import-history');
const { readDoc } = require('../scripts/lib/frontmatter');
const { validateBlueprint } = require('../scripts/lib/validate');
const { runCli } = require('../scripts/lib/cli');

const US = '\x1f';
const LOG_FORMAT = '%H%x1f%s%x1f%aI%x1f%an';

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-import-'));
}

function logLine({ sha, subject, date = '2026-01-01T00:00:00+09:00', author = 'Dev' }) {
  return [sha, subject, date, author].join(US);
}

function assertLogShape(a, { merges }) {
  assert.strictEqual(a[0], 'log');
  if (merges) assert.ok(a.includes('--merges'), `expected --merges in ${a.join(' ')}`);
  else assert.ok(!a.includes('--merges'), `unexpected --merges in ${a.join(' ')}`);
  assert.ok(a.includes('--reverse'), `expected --reverse in ${a.join(' ')}`);
  assert.ok(
    a.some((x) => x === `--format=${LOG_FORMAT}`),
    `expected --format=${LOG_FORMAT} in ${a.join(' ')}`,
  );
}

/**
 * 주입용 execFileSync. 체크리스트 argv 형태를 강제하고,
 * 그 외 호출은 실패해 실제 저장소 히스토리로 새지 않게 한다.
 */
function makeExec({
  merges = '',
  commits = '',
  filesBySha = {},
  porcelain = '',
  commonDir = '.git',
  onCall,
} = {}) {
  return (cmd, args) => {
    assert.strictEqual(cmd, 'git');
    const a = args.map(String);
    if (typeof onCall === 'function') onCall(a);

    if (a[0] === 'log' && a.includes('--merges')) {
      assertLogShape(a, { merges: true });
      return merges;
    }
    if (a[0] === 'log') {
      assertLogShape(a, { merges: false });
      return commits;
    }
    if (a[0] === 'diff') {
      // merges 파일 목록: git diff --name-only <sha>^1 <sha>
      assert.strictEqual(a[1], '--name-only');
      assert.strictEqual(a.length, 4);
      const parent = a[2];
      const sha = a[3];
      assert.ok(parent.endsWith('^1'), `expected <sha>^1, got ${parent}`);
      assert.strictEqual(parent, `${sha}^1`);
      return filesBySha[sha] || '';
    }
    if (a[0] === 'show') {
      // commits 파일 목록: git show --name-only --format= <sha>
      assert.strictEqual(a[1], '--name-only');
      assert.strictEqual(a[2], '--format=');
      assert.strictEqual(a.length, 4);
      const sha = a[3];
      return filesBySha[sha] || '';
    }
    if (a[0] === 'status' && a.includes('--porcelain')) return porcelain;
    if (a[0] === 'rev-parse' && a.includes('--git-common-dir')) return `${commonDir}\n`;
    throw new Error(`unexpected git args: ${a.join(' ')}`);
  };
}

function seedContextIndex(repo) {
  const abs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '---\nokf_version: "0.1"\n---\n# Epics\n\n');
}

function seedEpicDir(repo, id, name = 'seed') {
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics', `${id}-${name}`), { recursive: true });
}

test('planImport collects two merge commits without fallback', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const sha1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const sha2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const merges = [
    logLine({ sha: sha1, subject: 'Merge PR 1' }),
    logLine({ sha: sha2, subject: 'Merge PR 2' }),
  ].join('\n');
  const fileCalls = [];
  const execFileSync = makeExec({
    merges,
    filesBySha: {
      [sha1]: 'a.ts\n',
      [sha2]: 'b.ts\n',
    },
    onCall: (a) => {
      if (a[0] === 'diff' || a[0] === 'show') fileCalls.push(a.slice());
    },
  });

  const plan = planImport({
    repoRoot: repo,
    epicId: '100',
    deps: { execFileSync },
  });

  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.source, 'merges');
  assert.strictEqual(plan.fellBack, false);
  assert.strictEqual(plan.entries.length, 2);
  assert.strictEqual(plan.total, 2);
  assert.strictEqual(plan.entries[0].sha, sha1);
  assert.strictEqual(plan.entries[1].sha, sha2);
  assert.deepStrictEqual(plan.entries[0].files, ['a.ts']);
  assert.deepStrictEqual(plan.entries[1].files, ['b.ts']);
  assert.deepStrictEqual(fileCalls, [
    ['diff', '--name-only', `${sha1}^1`, sha1],
    ['diff', '--name-only', `${sha2}^1`, sha2],
  ]);
});

test('planImport falls back to commits when merges empty; explicit merges does not', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const sha = 'cccccccccccccccccccccccccccccccccccccccc';
  const commits = logLine({ sha, subject: 'plain commit' });
  const filesBySha = { [sha]: 'c.ts\n' };

  const fileCalls = [];
  const auto = planImport({
    repoRoot: repo,
    epicId: '101',
    deps: {
      execFileSync: makeExec({
        merges: '',
        commits,
        filesBySha,
        onCall: (a) => {
          if (a[0] === 'diff' || a[0] === 'show') fileCalls.push(a.slice());
        },
      }),
    },
  });
  assert.strictEqual(auto.ok, true);
  assert.strictEqual(auto.source, 'commits');
  assert.strictEqual(auto.fellBack, true);
  assert.strictEqual(auto.entries.length, 1);
  assert.deepStrictEqual(auto.entries[0].files, ['c.ts']);
  assert.deepStrictEqual(fileCalls, [
    ['show', '--name-only', '--format=', sha],
  ]);

  const forced = planImport({
    repoRoot: repo,
    source: 'merges',
    epicId: '101',
    deps: { execFileSync: makeExec({ merges: '', commits, filesBySha }) },
  });
  assert.strictEqual(forced.ok, true);
  assert.strictEqual(forced.source, 'merges');
  assert.strictEqual(forced.fellBack, false);
  assert.deepStrictEqual(forced.entries, []);
  assert.strictEqual(forced.total, 0);
});

test('planImport with source commits ignores merges and uses show', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const mergeSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const commitSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const merges = logLine({ sha: mergeSha, subject: 'Merge ignore me' });
  const commits = logLine({ sha: commitSha, subject: 'plain only' });
  const fileCalls = [];
  const plan = planImport({
    repoRoot: repo,
    source: 'commits',
    epicId: '108',
    deps: {
      execFileSync: makeExec({
        merges,
        commits,
        filesBySha: {
          [mergeSha]: 'from-merge.ts\n',
          [commitSha]: 'from-show.ts\n',
        },
        onCall: (a) => {
          if (a[0] === 'diff' || a[0] === 'show' || a[0] === 'log') {
            fileCalls.push(a.slice());
          }
        },
      }),
    },
  });
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.source, 'commits');
  assert.strictEqual(plan.fellBack, false);
  assert.strictEqual(plan.entries.length, 1);
  assert.strictEqual(plan.entries[0].sha, commitSha);
  assert.deepStrictEqual(plan.entries[0].files, ['from-show.ts']);
  assert.ok(fileCalls.some((a) => a[0] === 'log' && !a.includes('--merges')));
  assert.ok(!fileCalls.some((a) => a[0] === 'log' && a.includes('--merges')));
  assert.ok(!fileCalls.some((a) => a[0] === 'diff'));
  assert.deepStrictEqual(
    fileCalls.filter((a) => a[0] === 'show'),
    [['show', '--name-only', '--format=', commitSha]],
  );
});

test('planImport defaults epicId, limit, and epicName', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  // 001·003 만 있으면 구멍 002 가 다음 빈 번호다.
  seedEpicDir(repo, '001');
  seedEpicDir(repo, '003');
  const sha = '9999999999999999999999999999999999999999';
  const plan = planImport({
    repoRoot: repo,
    deps: {
      execFileSync: makeExec({
        merges: logLine({ sha, subject: 'defaults' }),
        filesBySha: { [sha]: '' },
      }),
    },
  });
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.epicId, '002');
  assert.strictEqual(plan.limit, 200);
  assert.strictEqual(plan.epicName, 'imported-history');
  assert.strictEqual(
    plan.epicDir,
    '.bouncer/context/epics/002-imported-history',
  );
});

test('planImport hard-stops when candidates exceed limit', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const lines = [1, 2, 3].map((n) => logLine({
    sha: `${'d'.repeat(39)}${n}`,
    subject: `m${n}`,
  })).join('\n');
  const plan = planImport({
    repoRoot: repo,
    epicId: '102',
    limit: 2,
    deps: { execFileSync: makeExec({ merges: lines }) },
  });
  assert.strictEqual(plan.ok, false);
  assert.strictEqual(plan.error.code, 'IMPORT_LIMIT_EXCEEDED');
  assert.deepStrictEqual(plan.entries, []);
  assert.match(plan.error.message, /3/);
  assert.match(plan.error.message, /2/);
});

test('planImport slug falls back to short sha; same title gets distinct dirs', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const shaKo = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const shaEmpty = 'ffffffffffffffffffffffffffffffffffffffff';
  const shaA = '1111111111111111111111111111111111111111';
  const shaB = '2222222222222222222222222222222222222222';
  const merges = [
    logLine({ sha: shaKo, subject: '한글만제목!!!' }),
    logLine({ sha: shaEmpty, subject: '' }),
    logLine({ sha: shaA, subject: 'same-title' }),
    logLine({ sha: shaB, subject: 'same-title' }),
  ].join('\n');
  const execFileSync = makeExec({
    merges,
    filesBySha: {
      [shaKo]: '', [shaEmpty]: '', [shaA]: '', [shaB]: '',
    },
  });
  const plan = planImport({
    repoRoot: repo,
    epicId: '103',
    deps: { execFileSync },
  });
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.entries[0].slug, shaKo.slice(0, 7));
  assert.strictEqual(plan.entries[1].slug, shaEmpty.slice(0, 7));
  assert.strictEqual(plan.entries[2].slug, 'same-title');
  assert.strictEqual(plan.entries[3].slug, 'same-title');
  // 슬러그가 같아도 blueprintId 가 달라 dir 이 갈린다.
  assert.notStrictEqual(plan.entries[2].blueprintDir, plan.entries[3].blueprintDir);
  assert.strictEqual(plan.entries[2].blueprintDir, '003-same-title');
  assert.strictEqual(plan.entries[3].blueprintDir, '004-same-title');
});

test('planImport numbers blueprints from 001 with oldest first', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const oldSha = '3333333333333333333333333333333333333333';
  const newSha = '4444444444444444444444444444444444444444';
  // --reverse 이므로 스텁도 오래된 것부터.
  const merges = [
    logLine({ sha: oldSha, subject: 'oldest', date: '2025-01-01T00:00:00+09:00' }),
    logLine({ sha: newSha, subject: 'newest', date: '2026-06-01T00:00:00+09:00' }),
  ].join('\n');
  const plan = planImport({
    repoRoot: repo,
    epicId: '104',
    deps: {
      execFileSync: makeExec({
        merges,
        filesBySha: { [oldSha]: '', [newSha]: '' },
      }),
    },
  });
  assert.strictEqual(plan.entries[0].blueprintId, '001');
  assert.strictEqual(plan.entries[0].sha, oldSha);
  assert.strictEqual(plan.entries[1].blueprintId, '002');
  assert.strictEqual(plan.entries[1].sha, newSha);
});

test('planImport records apply refusals without failing the plan', () => {
  const repo = tmpRepo();
  const epicId = '105';
  const epicName = 'imported-history';
  const epicDir = `.bouncer/context/epics/${epicId}-${epicName}`;
  // index 부재 → IMPORT_CONTEXT_INDEX_MISSING
  // epic 선점 → IMPORT_EPIC_DIR_EXISTS
  fs.mkdirSync(path.join(repo, epicDir), { recursive: true });
  // 활성 포인터 → IMPORT_POINTER_ACTIVE
  fs.mkdirSync(path.join(repo, '.git', 'bouncer'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.git', 'bouncer', 'current'),
    JSON.stringify({ blueprint: '.bouncer/context/epics/001-x/blueprints/001-y', base: 'main' }),
  );

  const sha = '5555555555555555555555555555555555555555';
  const plan = planImport({
    repoRoot: repo,
    epicId,
    epicName,
    deps: {
      execFileSync: makeExec({
        merges: logLine({ sha, subject: 'ok' }),
        filesBySha: { [sha]: '' },
        porcelain: ' M README.md\n',
        commonDir: '.git',
      }),
    },
  });

  assert.strictEqual(plan.ok, true);
  const codes = plan.refusals.map((r) => r.code).sort();
  assert.deepStrictEqual(codes, [
    'IMPORT_CONTEXT_INDEX_MISSING',
    'IMPORT_EPIC_DIR_EXISTS',
    'IMPORT_POINTER_ACTIVE',
    'IMPORT_WORKTREE_DIRTY',
  ].sort());
});

test('planImport rejects invalid epicId and source', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const execFileSync = makeExec({ merges: '' });

  const badId = planImport({
    repoRoot: repo,
    epicId: '1',
    deps: { execFileSync },
  });
  assert.strictEqual(badId.ok, false);
  assert.strictEqual(badId.error.code, 'IMPORT_EPIC_ID_INVALID');

  const badSource = planImport({
    repoRoot: repo,
    epicId: '106',
    source: 'prs',
    deps: { execFileSync },
  });
  assert.strictEqual(badSource.ok, false);
  assert.strictEqual(badSource.error.code, 'IMPORT_SOURCE_INVALID');
});

test('planImport passes since..HEAD range to git log', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  let seen = null;
  const execFileSync = makeExec({
    merges: '',
    commits: '',
    onCall: (a) => {
      if (a[0] === 'log' && a.includes('--merges')) seen = a.slice();
    },
  });
  const plan = planImport({
    repoRoot: repo,
    epicId: '107',
    since: 'v1.0.0',
    deps: { execFileSync },
  });
  assert.strictEqual(plan.ok, true);
  assert.ok(seen);
  assert.ok(seen.includes('v1.0.0..HEAD'));
  assert.ok(seen.includes('--reverse'));
  assert.ok(seen.some((x) => x === `--format=${LOG_FORMAT}`));
});

function twoEntryPlan(repo, {
  epicId = '200',
  epicName = 'imported-history',
  refusals = [],
  ok = true,
  error,
  entries,
} = {}) {
  const epicDir = `.bouncer/context/epics/${epicId}-${epicName}`;
  const defaultEntries = [
    {
      sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      subject: 'first change',
      date: '2026-01-01T00:00:00+09:00',
      author: 'Dev A',
      files: ['a.ts'],
      blueprintId: '001',
      slug: 'first-change',
      blueprintDir: '001-first-change',
    },
    {
      sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      subject: 'second change',
      date: '2026-02-01T00:00:00+09:00',
      author: 'Dev B',
      files: ['b.ts', 'c.ts'],
      blueprintId: '002',
      slug: 'second-change',
      blueprintDir: '002-second-change',
    },
  ];
  return {
    ok,
    source: 'commits',
    fellBack: true,
    epicId,
    epicName,
    epicDir,
    total: (entries || defaultEntries).length,
    limit: 200,
    entries: entries !== undefined ? entries : defaultEntries,
    refusals,
    ...(error ? { error } : {}),
  };
}

/** apply 단계용: add/commit 만 허용하고 argv 형태를 고정한다. */
function makeApplyExec({ onCall } = {}) {
  const staged = [];
  const commits = [];
  const execFileSync = (cmd, args) => {
    assert.strictEqual(cmd, 'git');
    const a = args.map(String);
    if (typeof onCall === 'function') onCall(a);
    if (a[0] === 'add') {
      assert.strictEqual(a[1], '--');
      staged.push(...a.slice(2));
      return '';
    }
    if (a[0] === 'commit') {
      assert.strictEqual(a[1], '-m');
      assert.strictEqual(a.length, 3);
      commits.push(a[2]);
      return '';
    }
    throw new Error(`unexpected git args: ${a.join(' ')}`);
  };
  return { execFileSync, staged, commits };
}

test('applyImport writes epic, two blueprints, index line, and commits', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const plan = twoEntryPlan(repo);
  const { execFileSync, staged, commits } = makeApplyExec();
  const deps = { execFileSync };

  const r = applyImport({ repoRoot: repo, plan, message: 'chore: import', deps });
  assert.strictEqual(r.ok, true);
  assert.ok(r.created.includes('.bouncer/context/index.md'));
  assert.strictEqual(r.created.filter((p) => /blueprints\/\d{3}-.*\/index\.md$/.test(p)).length, 2);
  assert.strictEqual(r.committed, true);

  assert.strictEqual(r.created[0], `${plan.epicDir}/index.md`);
  const epic = readDoc(path.join(repo, r.created[0]));
  assert.strictEqual(epic.data.bouncer.status, 'imported');
  assert.ok(!epic.body.includes('## Success criteria'));
  assert.ok(epic.body.includes('## Intent'));
  assert.ok(epic.body.includes('## Blueprints'));

  for (const entry of plan.entries) {
    const bpRel = `${plan.epicDir}/blueprints/${entry.blueprintDir}`;
    const bpAbs = path.join(repo, bpRel);
    assert.ok(fs.existsSync(path.join(bpAbs, 'index.md')));
    assert.ok(!fs.existsSync(path.join(bpAbs, 'tasks')));
    assert.ok(!fs.existsSync(path.join(bpAbs, 'verification.md')));
    assert.ok(!fs.existsSync(path.join(bpAbs, 'review.md')));
    assert.ok(!fs.existsSync(path.join(bpAbs, 'explain.md')));
    const bp = readDoc(path.join(bpAbs, 'index.md'));
    assert.strictEqual(bp.data.bouncer.status, 'imported');
    assert.ok(bp.body.includes('## Source'));
    assert.ok(bp.body.includes(entry.sha));
    assert.ok(bp.body.includes(entry.date));
    assert.ok(bp.body.includes(entry.author));
    assert.ok(bp.body.includes('## Message'));
    assert.ok(bp.body.includes(entry.subject));
    assert.ok(bp.body.includes('## Changes'));
  }

  assert.deepStrictEqual(commits, ['chore: import']);
  assert.ok(staged.includes(`${plan.epicDir}/index.md`));
  assert.ok(staged.includes('.bouncer/context/index.md'));
  assert.ok(!staged.includes('-A'));

  const v = validateBlueprint({
    repoRoot: repo,
    blueprintDir: `${plan.epicDir}/blueprints/${plan.entries[0].blueprintDir}`,
    gate: 'plan',
  });
  assert.strictEqual(v.ok, false);
  assert.deepStrictEqual(v.failures.map((f) => f.code), ['S18']);
});

test('applyImport refuses when plan has refusals or ok is false', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);

  const refused = twoEntryPlan(repo, {
    refusals: [{ code: 'IMPORT_WORKTREE_DIRTY', message: 'dirty' }],
  });
  const { execFileSync } = makeApplyExec();
  const r1 = applyImport({
    repoRoot: repo,
    plan: refused,
    message: 'chore: import',
    deps: { execFileSync },
  });
  assert.strictEqual(r1.ok, false);
  assert.strictEqual(r1.committed, false);
  assert.ok(!fs.existsSync(path.join(repo, refused.epicDir)));

  const bad = twoEntryPlan(repo, {
    ok: false,
    error: { code: 'IMPORT_LIMIT_EXCEEDED', message: 'too many' },
    entries: [],
  });
  const r2 = applyImport({
    repoRoot: repo,
    plan: bad,
    message: 'chore: import',
    deps: { execFileSync },
  });
  assert.strictEqual(r2.ok, false);
  assert.ok(!fs.existsSync(path.join(repo, bad.epicDir)));
});

test('applyImport requires a non-blank message', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const plan = twoEntryPlan(repo);
  const { execFileSync } = makeApplyExec();

  for (const message of [undefined, '', '   ']) {
    const r = applyImport({ repoRoot: repo, plan, message, deps: { execFileSync } });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error.code, 'IMPORT_MESSAGE_REQUIRED');
    assert.ok(!fs.existsSync(path.join(repo, plan.epicDir)));
  }
});

test('applyImport with empty entries is a no-op success', () => {
  const repo = tmpRepo();
  seedContextIndex(repo);
  const plan = twoEntryPlan(repo, { entries: [] });
  const { execFileSync, commits } = makeApplyExec();
  const r = applyImport({
    repoRoot: repo,
    plan,
    message: 'chore: import',
    deps: { execFileSync },
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.committed, false);
  assert.deepStrictEqual(r.created, []);
  assert.deepStrictEqual(commits, []);
  assert.ok(!fs.existsSync(path.join(repo, plan.epicDir)));
});

function initGitRepo(repo) {
  const run = (args) => realExec('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
  run(['init', '-b', 'main']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  // context index 를 첫 커밋에 넣어 apply 차단(IMPORT_WORKTREE_DIRTY)이
  // --message 누락 검사보다 먼저 뜨지 않게 한다.
  seedContextIndex(repo);
  run(['add', 'README', '.bouncer/context/index.md']);
  run(['commit', '-m', 'base']);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  run(['add', 'a.txt']);
  run(['commit', '-m', 'add a']);
  fs.writeFileSync(path.join(repo, 'b.txt'), 'b\n');
  run(['add', 'b.txt']);
  run(['commit', '-m', 'add b']);
}

function captureCli(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('bouncer import dry-run exits 0; limit exceeded and --yes without message exit 2', () => {
  const repo = tmpRepo();
  initGitRepo(repo);

  const dry = captureCli([
    'import', '--repo', repo, '--source', 'commits', '--epic-id', '210',
  ]);
  assert.strictEqual(dry.code, 0, dry.err || dry.out);
  const dryPlan = JSON.parse(dry.out);
  assert.strictEqual(dryPlan.ok, true);
  assert.ok(!fs.existsSync(path.join(repo, dryPlan.epicDir)));

  const over = captureCli([
    'import', '--repo', repo, '--source', 'commits', '--limit', '1', '--epic-id', '211',
  ]);
  assert.strictEqual(over.code, 2);
  const overPlan = JSON.parse(over.out);
  assert.strictEqual(overPlan.ok, false);
  assert.strictEqual(overPlan.error.code, 'IMPORT_LIMIT_EXCEEDED');

  const noMsg = captureCli([
    'import', '--repo', repo, '--source', 'commits', '--epic-id', '212', '--yes',
  ]);
  assert.strictEqual(noMsg.code, 2);
  const noMsgResult = JSON.parse(noMsg.out);
  assert.strictEqual(noMsgResult.ok, false);
  assert.strictEqual(noMsgResult.error.code, 'IMPORT_MESSAGE_REQUIRED');

  // --message alone is still dry-run; message is ignored and nothing is written.
  const msgOnly = captureCli([
    'import', '--repo', repo, '--source', 'commits', '--epic-id', '213',
    '--message', 'should-ignore',
  ]);
  assert.strictEqual(msgOnly.code, 0, msgOnly.err || msgOnly.out);
  const msgOnlyPlan = JSON.parse(msgOnly.out);
  assert.strictEqual(msgOnlyPlan.ok, true);
  assert.ok(Array.isArray(msgOnlyPlan.entries));
  assert.ok(!fs.existsSync(path.join(repo, msgOnlyPlan.epicDir)));
});
