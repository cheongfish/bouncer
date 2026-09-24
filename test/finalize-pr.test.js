// test/finalize-pr.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const {
  parseGithubRemote,
  buildPrDraft,
  resolveExplainLinks,
} = require('../scripts/lib/finalize-pr');
const { runCli } = require('../scripts/lib/cli');
const { writeCurrent } = require('../scripts/lib/current');
const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trimEnd();
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

test('parseGithubRemote accepts github SSH/HTTPS and rejects gitlab', () => {
  assert.deepStrictEqual(
    parseGithubRemote('git@github.com:acme/app.git'),
    { owner: 'acme', repo: 'app' },
  );
  assert.deepStrictEqual(
    parseGithubRemote('https://github.com/acme/app.git'),
    { owner: 'acme', repo: 'app' },
  );
  assert.deepStrictEqual(
    parseGithubRemote('ssh://git@github.com/acme/app.git'),
    { owner: 'acme', repo: 'app' },
  );
  assert.strictEqual(parseGithubRemote('https://gitlab.com/acme/app'), null);
  assert.strictEqual(parseGithubRemote('git@github.com:acme'), null);
  assert.strictEqual(parseGithubRemote(''), null);
});

test('parseGithubRemote rejects empty, dot, and path-segment owners/repos', () => {
  // F-SEC-001: GitHub identity만 허용. `.`/`..`/`/`/`\` 는 blob URL 경로 탈출에 쓰인다.
  assert.strictEqual(parseGithubRemote('git@github.com:../app.git'), null);
  assert.strictEqual(parseGithubRemote('git@github.com:acme/..'), null);
  assert.strictEqual(parseGithubRemote('https://github.com/./app'), null);
  assert.strictEqual(parseGithubRemote('https://github.com/acme/.'), null);
  assert.strictEqual(parseGithubRemote('git@github.com:acme/foo\\bar.git'), null);
  assert.strictEqual(parseGithubRemote('ssh://git@github.com/acme%2fevil/app.git'), null);
});

test('buildPrDraft title_prefix uses KST date, capitalized pr_base, and commit types', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'chore' },
    git: { branch: 'feat/login', pr_base: 'develop' },
    commits: [{ sha8: 'abc12345', subject: 'feat: 인사 추가' }],
    tasks: [],
    out_of_scope: [],
    unverified: [],
  };
  const draft = buildPrDraft(digest, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: { pr: { base: 'develop' } },
  });
  assert.strictEqual(draft.title_prefix, '[260924] (→ Develop) [Feat]');
  assert.strictEqual(draft.base, 'develop');
  assert.strictEqual(draft.head, 'feat/login');
  assert.strictEqual(draft.draft, true);
  assert.deepStrictEqual(draft.sections.related, []);
  assert.strictEqual(draft.sections.background, null);
  assert.strictEqual(draft.sections.changes, null);
  assert.strictEqual(draft.sections.flow, null);
});

test('buildPrDraft falls back to blueprint commit_type and fills verification/review_points', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'docs' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'deadbeef', subject: 'WIP without conventional type' }],
    tasks: [
      {
        id: 'TASKS-001',
        verification: { status: 'passed', command: 'npm test' },
        review: {
          required: true,
          findings: [{ id: 'F-1', status: 'accepted', note: 'accepted note' }],
        },
      },
      {
        id: 'TASKS-002',
        verification: { status: 'failed', command: 'npm test' },
        review: {
          required: true,
          findings: [{ id: 'F-2', status: 'deferred', note: 'deferred note' }],
        },
      },
    ],
    out_of_scope: ['payments'],
    unverified: [{ kind: 'terminal-missing' }],
  };
  const draft = buildPrDraft(digest, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: { pr: { draft: false } },
  });
  assert.strictEqual(draft.title_prefix, '[260924] (→ Main) [Docs]');
  assert.strictEqual(draft.draft, false);
  assert.deepStrictEqual(draft.sections.verification, [
    'npm test — passed',
    'npm test — failed',
  ]);
  assert.ok(draft.sections.review_points.includes('payments'));
  assert.ok(draft.sections.review_points.includes('accepted note'));
  assert.ok(draft.sections.review_points.includes('deferred note'));
  assert.ok(draft.sections.review_points.some((p) => /terminal-missing/.test(p)));
});

test('buildPrDraft keeps type order Feat/Fix from commit subjects', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'chore' },
    git: { branch: 'work', pr_base: 'develop' },
    commits: [
      { sha8: 'a', subject: 'feat: one' },
      { sha8: 'b', subject: 'fix(api)!: two' },
      { sha8: 'c', subject: 'feat: three again' },
    ],
    tasks: [],
    out_of_scope: [],
    unverified: [],
  };
  const draft = buildPrDraft(digest, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  assert.strictEqual(draft.title_prefix, '[260924] (→ Develop) [Feat/Fix]');
});

test('buildPrDraft review_points omit Epic/Blueprint stable ids from unverified', () => {
  // F1/F2: Constraints — PR 본문에 Epic/Blueprint id·stable_id를 넣지 않는다.
  // unverified.task는 EPIC-…/BP-…/TASK-… 형태이므로 kind·detail만 남긴다.
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [],
    out_of_scope: ['payments'],
    unverified: [
      { kind: 'verification-not-passed', task: 'EPIC-078/BP-002/TASK-001' },
      { kind: 'review-skipped', task: 'EPIC-001/BP-001/TASK-002' },
      {
        kind: 'finding-deferred',
        task: 'EPIC-078/BP-002/TASK-001',
        detail: 'follow-up later',
      },
    ],
  };
  const draft = buildPrDraft(digest, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  assert.ok(draft.sections.review_points.includes('payments'));
  assert.ok(draft.sections.review_points.includes('verification-not-passed'));
  assert.ok(draft.sections.review_points.includes('review-skipped'));
  assert.ok(draft.sections.review_points.includes('finding-deferred: follow-up later'));
  for (const point of draft.sections.review_points) {
    assert.doesNotMatch(point, /EPIC-/);
    assert.doesNotMatch(point, /BP-/);
  }
});

/**
 * remote·ref·ancestor·explain 조회를 argv로 분기하는 seam.
 *
 * @param {object} opts
 * @param {string} [opts.remoteUrl]
 * @param {boolean} [opts.remoteExists]
 * @param {string} [opts.remoteRef]
 * @param {boolean} [opts.headIsAncestor]
 * @param {string} [opts.head]
 * @param {boolean} [opts.explainTracked]
 * @returns {(args: string[]) => { status: number, stdout: string }}
 */
/**
 * remote·ref·ancestor·explain 조회를 argv로 분기하는 seam.
 * headFail은 explain 추적 확인 뒤 rev-parse HEAD 실패 분기를 연다.
 *
 * @param {object} opts
 * @param {string} [opts.remoteUrl]
 * @param {boolean} [opts.remoteExists]
 * @param {string | null} [opts.remoteRef] - null이면 tracking ref 부재
 * @param {boolean} [opts.headIsAncestor]
 * @param {string} [opts.head]
 * @param {boolean} [opts.headFail] - true면 HEAD rev-parse 실패
 * @param {boolean} [opts.explainTracked]
 * @returns {(args: string[]) => { status: number, stdout: string }}
 */
function makeLinksExec({
  remoteUrl = 'git@github.com:acme/app.git',
  remoteExists = true,
  remoteRef = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  headIsAncestor = true,
  head = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  headFail = false,
  explainTracked = true,
} = {}) {
  return (args) => {
    const key = args.join(' ');
    if (key === 'remote get-url origin') {
      return remoteExists
        ? { status: 0, stdout: `${remoteUrl}\n` }
        : { status: 2, stdout: '' };
    }
    if (args[0] === 'rev-parse' && args[1] === '--verify'
      && typeof args[2] === 'string' && args[2].startsWith('refs/remotes/origin/')) {
      return remoteRef
        ? { status: 0, stdout: `${remoteRef}\n` }
        : { status: 1, stdout: '' };
    }
    if (args[0] === 'merge-base' && args[1] === '--is-ancestor') {
      return { status: headIsAncestor ? 0 : 1, stdout: '' };
    }
    if (key === 'rev-parse HEAD') {
      return headFail
        ? { status: 1, stdout: '' }
        : { status: 0, stdout: `${head}\n` };
    }
    if (args[0] === 'cat-file' && args[1] === '-e') {
      return { status: explainTracked ? 0 : 1, stdout: '' };
    }
    if (args[0] === 'ls-tree') {
      return {
        status: 0,
        stdout: explainTracked ? `${BP}/explain.md\n` : '',
      };
    }
    return { status: 1, stdout: '' };
  };
}

test('resolveExplainLinks returns head-not-pushed when HEAD is not on remote', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-np-'));
  git(repoRoot, ['init', '-b', 'feat/login']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'x\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);
  const result = resolveExplainLinks({
    repoRoot,
    blueprintDir: BP,
    exec: makeLinksExec({ headIsAncestor: false }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reason, 'head-not-pushed');
  assert.deepStrictEqual(result.links, []);
});

test('resolveExplainLinks returns branch and commit kinds when pushed', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-ok-'));
  git(repoRoot, ['init', '-b', 'feat/login']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'x\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);
  const head = git(repoRoot, ['rev-parse', 'HEAD']);
  writeDoc(repoRoot, `${BP}/explain.md`, {
    type: 'bouncer.explain', title: 'Explain', description: 'd',
    resource: `${BP}/explain.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'draft' },
  });
  git(repoRoot, ['add', '-A']);
  git(repoRoot, ['commit', '-m', 'explain']);
  const head2 = git(repoRoot, ['rev-parse', 'HEAD']);

  const pushed = resolveExplainLinks({
    repoRoot,
    blueprintDir: BP,
    exec: makeLinksExec({
      head: head2,
      remoteRef: head2,
      headIsAncestor: true,
      explainTracked: true,
    }),
  });
  assert.strictEqual(pushed.ok, true);
  assert.strictEqual(pushed.reason, null);
  assert.deepStrictEqual(pushed.links.map((l) => l.kind), ['branch', 'commit']);
  // F-SEC-003: owner/repo/branch/explainRel 각 세그먼트를 percent-encode.
  const explainEncoded = BP.split('/').map(encodeURIComponent).concat('explain.md').join('/');
  assert.strictEqual(
    pushed.links[0].url,
    `https://github.com/acme/app/blob/feat/login/${explainEncoded}`,
  );
  assert.strictEqual(
    pushed.links[1].url,
    `https://github.com/acme/app/blob/${head2}/${explainEncoded}`,
  );
  void head;
});

test('resolveExplainLinks rejects blueprintDir that escapes the repo', () => {
  // F-SEC-002: absolute/`..` blueprintDir로 blob URL을 만들지 않는다.
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-esc-'));
  git(repoRoot, ['init', '-b', 'feat/login']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'x\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);

  for (const blueprintDir of [
    '../outside',
    '/tmp/evil',
    `${BP}/../../etc`,
  ]) {
    const result = resolveExplainLinks({
      repoRoot,
      blueprintDir,
      exec: makeLinksExec(),
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.reason, 'invalid-blueprint');
    assert.deepStrictEqual(result.links, []);
  }
});

test('resolveExplainLinks percent-encodes branch segments that need escaping', () => {
  // F-SEC-003: `#` 등은 fragment로 잘리므로 세그먼트 encode가 필수.
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-enc-'));
  git(repoRoot, ['init', '-b', 'feat/fix#1']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'x\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);
  writeDoc(repoRoot, `${BP}/explain.md`, {
    type: 'bouncer.explain', title: 'Explain', description: 'd',
    resource: `${BP}/explain.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'draft' },
  });
  git(repoRoot, ['add', '-A']);
  git(repoRoot, ['commit', '-m', 'explain']);
  const head2 = git(repoRoot, ['rev-parse', 'HEAD']);

  const pushed = resolveExplainLinks({
    repoRoot,
    blueprintDir: BP,
    exec: makeLinksExec({
      head: head2,
      remoteRef: head2,
      headIsAncestor: true,
      explainTracked: true,
    }),
  });
  assert.strictEqual(pushed.reason, null);
  assert.strictEqual(pushed.links.length, 2);
  assert.ok(pushed.links[0].url.includes('/feat/fix%231/'));
  assert.ok(!pushed.links[0].url.includes('/feat/fix#1/'));
});

test('resolveExplainLinks reason codes for remote/host/branch/explain', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-rs-'));
  git(repoRoot, ['init', '-b', 'feat/login']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'x\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);

  assert.strictEqual(
    resolveExplainLinks({
      repoRoot,
      blueprintDir: BP,
      exec: makeLinksExec({ remoteExists: false }),
    }).reason,
    'no-remote',
  );
  assert.strictEqual(
    resolveExplainLinks({
      repoRoot,
      blueprintDir: BP,
      exec: makeLinksExec({ remoteUrl: 'https://gitlab.com/acme/app.git' }),
    }).reason,
    'unsupported-host',
  );
  assert.strictEqual(
    resolveExplainLinks({
      repoRoot,
      blueprintDir: BP,
      exec: makeLinksExec({ explainTracked: false }),
    }).reason,
    'explain-missing',
  );

  // detached HEAD → branch-unresolved
  const detached = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-det-'));
  git(detached, ['init', '-b', 'feat/login']);
  git(detached, ['config', 'user.email', 't@example.com']);
  git(detached, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(detached, 'README'), 'x\n');
  git(detached, ['add', 'README']);
  git(detached, ['commit', '-m', 'base']);
  const sha = git(detached, ['rev-parse', 'HEAD']);
  git(detached, ['checkout', '--detach', sha]);
  assert.strictEqual(
    resolveExplainLinks({
      repoRoot: detached,
      blueprintDir: BP,
      exec: makeLinksExec(),
    }).reason,
    'branch-unresolved',
  );
});

test('CLI finalize links works after tasks/ removed and reports checkout branch', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-cli-'));
  git(repoRoot, ['init', '-b', 'feat/login']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'x\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);

  writeDoc(repoRoot, `${BP}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd',
    resource: `${BP}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      commit_type: 'feat',
    },
  }, '# Blueprint\n\n## Intent\n- x\n');
  writeDoc(repoRoot, `${BP}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'T', description: 'd',
    resource: `${BP}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      execution_kind: 'commit', affected_paths: ['src/'],
    },
  });
  writeDoc(repoRoot, `${BP}/explain.md`, {
    type: 'bouncer.explain', title: 'Explain', description: 'd',
    resource: `${BP}/explain.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'draft' },
  });
  git(repoRoot, ['add', '-A']);
  git(repoRoot, ['commit', '-m', 'plan']);
  writeCurrent({ repoRoot, blueprint: BP, base: git(repoRoot, ['rev-parse', 'HEAD']) });

  // finalize --yes 이후처럼 tasks/만 지운다. links는 문서 유무와 무관하다.
  fs.rmSync(path.join(repoRoot, BP, 'tasks'), { recursive: true, force: true });

  let out = '';
  let err = '';
  const code = runCli(
    ['finalize', 'links', '--blueprint', BP, '--repo', repoRoot],
    { out: (s) => { out += s; }, err: (s) => { err += s; } },
  );
  assert.strictEqual(code, 0, err || out);
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.branch, 'feat/login');
  // remote 없는 fixture → URL 없이 이유 코드.
  assert.strictEqual(parsed.reason, 'no-remote');
  assert.deepStrictEqual(parsed.links, []);
});

test('buildPrDraft skips empty verification commands and falls back finding.id / path', () => {
  // buildVerificationLines: command 없는 verification은 행을 만들지 않는다.
  // buildReviewPoints: note 없으면 finding.id, unverified.path면 kind: path.
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [
      {
        id: 'TASKS-001',
        verification: { status: 'passed', command: null },
        review: {
          required: true,
          findings: [{ id: 'F-NO-NOTE', status: 'accepted' }],
        },
      },
      {
        id: 'TASKS-002',
        verification: null,
        review: null,
      },
    ],
    out_of_scope: [],
    unverified: [
      { kind: 'path-outside-scope', path: 'vendor/leak.js' },
    ],
  };
  const draft = buildPrDraft(digest, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  assert.deepStrictEqual(draft.sections.verification, []);
  assert.ok(draft.sections.review_points.includes('F-NO-NOTE'));
  assert.ok(draft.sections.review_points.includes('path-outside-scope: vendor/leak.js'));
});

test('resolveExplainLinks prefers ledger integrationBranch over checkout', () => {
  // resolveLinksBranch: 원장 integrationBranch가 있으면 그것이 정본이다.
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-ledger-'));
  git(repoRoot, ['init', '-b', 'feat/checkout']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'x\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);
  writeDoc(repoRoot, `${BP}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd',
    resource: `${BP}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      commit_type: 'feat',
    },
  }, '# Blueprint\n\n## Intent\n- x\n');

  const paths = coordinatorPathsFor({ repoRoot, blueprint: BP });
  git(repoRoot, ['branch', 'feat/integ-links']);
  git(repoRoot, ['worktree', 'add', paths.integrationPath, 'feat/integ-links']);
  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(paths.ledgerFile, `${JSON.stringify({
    version: 1,
    blueprint: BP,
    base: git(repoRoot, ['rev-parse', 'HEAD']),
    integrationHead: git(paths.integrationPath, ['rev-parse', 'HEAD']),
    integrationBranch: 'feat/integ-links',
    revision: 'r1',
    tasks: [],
    decisions: [],
  }, null, 2)}\n`);

  const result = resolveExplainLinks({
    repoRoot,
    blueprintDir: BP,
    exec: makeLinksExec({ remoteExists: false }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.branch, 'feat/integ-links');
  assert.strictEqual(result.reason, 'no-remote');

  git(repoRoot, ['worktree', 'remove', '--force', paths.integrationPath]);
});

test('resolveExplainLinks returns head-not-pushed when remote ref or HEAD rev-parse fails', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-links-ref-'));
  git(repoRoot, ['init', '-b', 'feat/login']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'x\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);

  assert.strictEqual(
    resolveExplainLinks({
      repoRoot,
      blueprintDir: BP,
      exec: makeLinksExec({ remoteRef: null }),
    }).reason,
    'head-not-pushed',
  );

  assert.strictEqual(
    resolveExplainLinks({
      repoRoot,
      blueprintDir: BP,
      exec: makeLinksExec({
        headIsAncestor: true,
        explainTracked: true,
        headFail: true,
      }),
    }).reason,
    'head-not-pushed',
  );
});
