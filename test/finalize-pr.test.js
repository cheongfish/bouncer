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
} = require('../packages/cli/dist/finalize-pr');
const { runCli } = require('../packages/cli/dist/cli');
const { writeCurrent } = require('../packages/cli/dist/current');
const { coordinatorPathsFor } = require('../packages/cli/dist/runtime-state');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trimEnd();
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

test('github SSH/HTTPS and gitlab remotes → parseGithubRemote accepts github and rejects gitlab', () => {
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

test('empty, dot and path-segment owners/repos → parseGithubRemote rejects them', () => {
  // F-SEC-001: GitHub identity만 허용. `.`/`..`/`/`/`\` 는 blob URL 경로 탈출에 쓰인다.
  assert.strictEqual(parseGithubRemote('git@github.com:../app.git'), null);
  assert.strictEqual(parseGithubRemote('git@github.com:acme/..'), null);
  assert.strictEqual(parseGithubRemote('https://github.com/./app'), null);
  assert.strictEqual(parseGithubRemote('https://github.com/acme/.'), null);
  assert.strictEqual(parseGithubRemote('git@github.com:acme/foo\\bar.git'), null);
  assert.strictEqual(parseGithubRemote('ssh://git@github.com/acme%2fevil/app.git'), null);
});

test('buildPrDraft with KST date, pr_base and commit types → title_prefix uses KST date, capitalized pr_base, and commit types', () => {
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

test('buildPrDraft without commit subject types → falls back to blueprint commit_type and fills verification/review_points', () => {
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

test('commit subjects of Feat and Fix → buildPrDraft keeps the type order', () => {
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

test('pr_base missing → buildPrDraft leaves base and title_prefix null', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: null },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [],
    out_of_scope: [],
    unverified: [],
  };
  const draft = buildPrDraft(digest, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  assert.strictEqual(draft.base, null);
  assert.strictEqual(draft.title_prefix, null);
  assert.strictEqual(draft.title_prefix_template, '[260924] (→ {base}) [Feat]');

  const missing = buildPrDraft(
    { ...digest, git: { branch: 'work' } },
    { now: new Date('2026-09-24T01:00:00Z'), config: {} },
  );
  assert.strictEqual(missing.base, null);
  assert.strictEqual(missing.title_prefix, null);
  assert.strictEqual(missing.title_prefix_template, '[260924] (→ {base}) [Feat]');
});

test('unverified items with Epic/Blueprint stable ids → buildPrDraft review_points omit them', () => {
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
  // unverified finding-* 행은 review_points로 옮기지 않는다(메모는 review.findings 경로만).
  assert.ok(!draft.sections.review_points.includes('finding-deferred: follow-up later'));
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

test('HEAD not on the remote → resolveExplainLinks returns head-not-pushed', () => {
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

test('pushed HEAD → resolveExplainLinks returns branch and commit kinds', () => {
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

test('blueprintDir that escapes the repo → resolveExplainLinks rejects it', () => {
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

test('branch segments that need escaping → resolveExplainLinks percent-encodes them', () => {
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

test('remote/host/branch/explain failures → resolveExplainLinks returns the matching reason codes', () => {
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

test('tasks/ removed → CLI finalize links still works and reports the checkout branch', () => {
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

test('empty verification commands and missing finding.id / path → buildPrDraft skips the empty commands and falls back', () => {
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

test('ledger integrationBranch and a different checkout → resolveExplainLinks prefers the ledger branch', () => {
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

test('remote ref or HEAD rev-parse failure → resolveExplainLinks returns head-not-pushed', () => {
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

test('blueprint_review finding notes → buildPrDraft review_points include them', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [],
    out_of_scope: [],
    unverified: [],
    blueprint_review: {
      findings: [{ id: 'F-ROOT', status: 'accepted', note: 'root finding note' }],
    },
  };
  const draft = buildPrDraft(digest, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  assert.ok(draft.sections.review_points.includes('root finding note'));
});

test('duplicate finding notes and finding-* unverified → buildPrDraft review_points dedupe the notes and skip the unverified', () => {
  const note = 'shared deferred note';
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [
      {
        id: 'TASKS-001',
        verification: { status: 'passed', command: 'npm test' },
        review: {
          required: true,
          findings: [{ id: 'F-1', status: 'deferred', note }],
        },
      },
    ],
    out_of_scope: [],
    unverified: [
      { kind: 'finding-deferred', task: 'EPIC-001/BP-001/TASK-001', detail: note },
      { kind: 'path-outside-scope', path: 'vendor/leak.js' },
    ],
    blueprint_review: {
      findings: [{ id: 'F-ROOT', status: 'deferred', note }],
    },
  };
  const draft = buildPrDraft(digest, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  const deferredHits = draft.sections.review_points.filter(
    (p) => p === note || p === `finding-deferred: ${note}`,
  );
  assert.strictEqual(deferredHits.length, 1);
  assert.strictEqual(deferredHits[0], note);
  assert.ok(draft.sections.review_points.includes('path-outside-scope: vendor/leak.js'));

  const acceptedNote = 'shared accepted note';
  const accepted = buildPrDraft({
    ...digest,
    tasks: [
      {
        id: 'TASKS-001',
        verification: { status: 'passed', command: 'npm test' },
        review: {
          required: true,
          findings: [{ id: 'F-1', status: 'accepted', note: acceptedNote }],
        },
      },
    ],
    unverified: [
      { kind: 'finding-accepted', task: 'EPIC-001/BP-001/TASK-001', detail: acceptedNote },
    ],
    blueprint_review: {
      findings: [{ id: 'F-ROOT', status: 'accepted', note: acceptedNote }],
    },
  }, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  const acceptedHits = accepted.sections.review_points.filter(
    (p) => p === acceptedNote || p === `finding-accepted: ${acceptedNote}`,
  );
  assert.strictEqual(acceptedHits.length, 1);
  assert.strictEqual(acceptedHits[0], acceptedNote);
});

test('an out_of_scope item whose finding note matches → buildPrDraft keeps the item', () => {
  // 중복 제거는 finding 메모끼리만 — out_of_scope와 같은 문자열이면 둘 다 남긴다.
  const shared = 'payments';
  const draft = buildPrDraft({
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [
      {
        id: 'TASKS-001',
        verification: null,
        review: {
          required: true,
          findings: [{ id: 'F-1', status: 'accepted', note: shared }],
        },
      },
    ],
    out_of_scope: [shared],
    unverified: [],
  }, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  assert.deepStrictEqual(
    draft.sections.review_points.filter((p) => p === shared),
    [shared, shared],
  );
});

test('identical command result lines → buildPrDraft verification dedupes them', () => {
  const samePassed = buildPrDraft({
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [
      { id: 'TASKS-001', verification: { status: 'passed', command: 'npm run verify:strict' } },
      { id: 'TASKS-002', verification: { status: 'passed', command: 'npm run verify:strict' } },
      { id: 'TASKS-003', verification: { status: 'passed', command: 'npm run verify:strict' } },
    ],
    out_of_scope: [],
    unverified: [],
  }, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  assert.deepStrictEqual(
    samePassed.sections.verification,
    ['npm run verify:strict — passed'],
  );

  // 같은 명령이라도 passed/failed가 다르면 두 줄 모두 남긴다.
  const mixed = buildPrDraft({
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [
      { id: 'TASKS-001', verification: { status: 'passed', command: 'npm run verify:strict' } },
      { id: 'TASKS-002', verification: { status: 'failed', command: 'npm run verify:strict' } },
    ],
    out_of_scope: [],
    unverified: [],
  }, {
    now: new Date('2026-09-24T01:00:00Z'),
    config: {},
  });
  assert.strictEqual(mixed.sections.verification.length, 2);
  assert.deepStrictEqual(mixed.sections.verification, [
    'npm run verify:strict — passed',
    'npm run verify:strict — failed',
  ]);
});

test('tasks with worker_notes → review_points lists them after findings and before unverified', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [],
    tasks: [{
      id: 'TASKS-001',
      review: { required: true, findings: [{ id: 'F-1', status: 'accepted', note: 'finding note' }] },
      worker_notes: { open_choices: ['a'], known_weaknesses: ['weak'] },
    }],
    out_of_scope: [],
    unverified: [{ kind: 'terminal-missing' }],
  };
  const points = buildPrDraft(digest, { now: new Date('2026-09-24T01:00:00Z'), config: {} })
    .sections.review_points;
  assert.deepStrictEqual(points, [
    'finding note', '구현 선택(TASKS-001): a', '알려진 약점(TASKS-001): weak', 'terminal-missing',
  ]);
});

test('same worker note on two tasks → review_points lists it once with both task ids in first-seen order', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [],
    tasks: [
      { id: 'TASKS-001', worker_notes: { open_choices: ['same'], known_weaknesses: [] } },
      { id: 'TASKS-002', worker_notes: { open_choices: ['same', 'same'], known_weaknesses: [] } },
    ],
    out_of_scope: [],
    unverified: [],
  };
  const points = buildPrDraft(digest, { now: new Date('2026-09-24T01:00:00Z'), config: {} })
    .sections.review_points;
  assert.deepStrictEqual(points, ['구현 선택(TASKS-001, TASKS-002): same']);
});

test('different worker notes → review_points keeps each distinct phrase', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [],
    tasks: [
      { id: 'TASKS-001', worker_notes: { open_choices: ['alpha'], known_weaknesses: [] } },
      { id: 'TASKS-002', worker_notes: { open_choices: ['beta'], known_weaknesses: [] } },
    ],
    out_of_scope: [],
    unverified: [],
  };
  const points = buildPrDraft(digest, { now: new Date('2026-09-24T01:00:00Z'), config: {} })
    .sections.review_points;
  assert.deepStrictEqual(points, [
    '구현 선택(TASKS-001): alpha',
    '구현 선택(TASKS-002): beta',
  ]);
});

test('same note text in open_choices and known_weaknesses → review_points keeps both kinds', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [],
    tasks: [{
      id: 'TASKS-001',
      worker_notes: { open_choices: ['same'], known_weaknesses: ['same'] },
    }],
    out_of_scope: [],
    unverified: [],
  };
  const points = buildPrDraft(digest, { now: new Date('2026-09-24T01:00:00Z'), config: {} })
    .sections.review_points;
  assert.deepStrictEqual(points, [
    '구현 선택(TASKS-001): same',
    '알려진 약점(TASKS-001): same',
  ]);
});

test('blueprint root deferred must_fix → buildPrDraft lists it under unresolved_must_fix and drops only that finding from review_points', () => {
  const digest = {
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [],
    tasks: [{
      id: 'TASKS-001',
      // task 범위 must_fix deferred는 경고 대상이 아니다 — 기존 리뷰 포인트로 남는다.
      review: { required: true, findings: [
        { id: 'F-MF', actionability: 'must_fix', status: 'deferred', note: 'task deferred' },
      ] },
      worker_notes: { open_choices: ['a'], known_weaknesses: [] },
    }],
    out_of_scope: ['payments'],
    unverified: [
      { kind: 'finding-deferred', task: null, detail: 'root must fix' },
      { kind: 'terminal-missing' },
    ],
    blueprint_review: {
      findings: [
        { id: 'F-ROOT', actionability: 'must_fix', status: 'deferred', note: 'root must fix' },
        { id: 'F-ADV', actionability: 'advisory', status: 'deferred', note: 'root advisory' },
        { id: 'F-RISK', actionability: 'must_fix', status: 'accepted', note: 'root accepted' },
        { id: 'F-LEGACY', severity: 'blocker', status: 'deferred', note: 'root legacy' },
      ],
    },
  };
  const draft = buildPrDraft(digest, { now: new Date('2026-09-24T01:00:00Z'), config: {} });
  assert.deepStrictEqual(draft.sections.unresolved_must_fix, ['F-ROOT: root must fix']);
  assert.deepStrictEqual(draft.sections.review_points, [
    'payments',
    'task deferred',
    'root advisory',
    'root accepted',
    'root legacy',
    '구현 선택(TASKS-001): a',
    'terminal-missing',
  ]);
});

test('no blueprint_review → buildPrDraft unresolved_must_fix is empty', () => {
  const draft = buildPrDraft({
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [],
    tasks: [],
    out_of_scope: [],
    unverified: [],
    blueprint_review: null,
  }, { now: new Date('2026-09-24T01:00:00Z'), config: {} });
  assert.deepStrictEqual(draft.sections.unresolved_must_fix, []);
});

test('outside_scope terminal failure in the digest → PR keeps the failed line with its evidence id and a separate warning, never passed', () => {
  const evidence = 'e'.repeat(64);
  const draft = buildPrDraft({
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [
      { id: 'TASKS-001', verification: { status: 'passed', command: 'node --test test/a.test.js' } },
      {
        id: 'TASKS-002',
        verification: {
          status: 'failed', command: 'npm test',
          outside_scope: { kind: 'outside_scope', reason: 'vendor drift', evidence_id: evidence },
        },
      },
    ],
    out_of_scope: [],
    unverified: [{ kind: 'terminal-outside-scope', task: 'EPIC-1/BP-1/TASK-2', detail: `vendor drift (evidence ${evidence})` }],
  }, { now: new Date('2026-09-24T01:00:00Z'), config: {} });
  assert.deepStrictEqual(draft.sections.verification, [
    'node --test test/a.test.js — passed',
    `npm test — failed (outside_scope, evidence ${evidence})`,
  ]);
  assert.ok(draft.sections.review_points.includes(`terminal-outside-scope: vendor drift (evidence ${evidence})`));
  assert.ok(!draft.sections.verification.some((line) => line === 'npm test — passed'));
});

test('failed verification without a classification → PR line carries no outside_scope suffix', () => {
  const draft = buildPrDraft({
    ok: true,
    blueprint: { commit_type: 'feat' },
    git: { branch: 'work', pr_base: 'main' },
    commits: [{ sha8: 'abc12345', subject: 'feat: x' }],
    tasks: [{ id: 'TASKS-002', verification: { status: 'failed', command: 'npm test' } }],
    out_of_scope: [],
    unverified: [{ kind: 'terminal-missing' }],
  }, { now: new Date('2026-09-24T01:00:00Z'), config: {} });
  assert.deepStrictEqual(draft.sections.verification, ['npm test — failed']);
});

// ---- finalize pr-body: 보존 digest + 요약 파일 → Markdown 초안 ----

const SUMMARY_MD = [
  '## 배경 · 변경 의도',
  '',
  '- 문제: 초안이 비어 있었다.',
  '- 의도: digest에서 만든다.',
  '',
  '## 주요 변경 내용',
  '',
  '| 파일 | 변경 |',
  '| --- | --- |',
  '| `a.ts` | 렌더러 추가 |',
  '',
].join('\n');

const ZERO_ISSUES = {
  rework_reports: 0, debugger_calls: 0, repair_waves: 0,
  fanin_verification_failures: 0, blocked: 0, deferred_must_fix: 0,
};

function prBodyDigest(over = {}) {
  return {
    ok: true,
    version: 2,
    blueprint: { dir: BP, stable_id: 'BP-1', title: 't', intent: [], commit_type: 'feat', scale: null },
    range: { base: 'a'.repeat(40), head: 'b'.repeat(40), diff_sha: null },
    git: { branch: 'work', pr_base: null },
    tasks: [{
      id: 'TASKS-001',
      verification: { status: 'passed', command: 'node --test a', exit_code: 0, evidence_id: 'v1' },
    }],
    out_of_scope: [],
    unverified: [],
    blueprint_review: null,
    pr: { sections: { related: [] } },
    warnings: [],
    drive_issues: { ...ZERO_ISSUES },
    ...over,
  };
}

// 임시 디렉터리에 입력 파일을 쓰고 CLI를 실행한다. 반환값은 종료 코드와 두 스트림이다.
function runPrBody({ digest, summary = SUMMARY_MD, flow, rawDigest, extra = [], omit = [] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-prbody-'));
  try {
    const digestFile = path.join(dir, 'digest.json');
    const summaryFile = path.join(dir, 'summary.md');
    fs.writeFileSync(digestFile, rawDigest !== undefined ? rawDigest : JSON.stringify(digest));
    if (summary !== null) fs.writeFileSync(summaryFile, summary);
    const argv = ['finalize', 'pr-body'];
    if (!omit.includes('digest')) argv.push('--digest', digestFile);
    if (!omit.includes('summary')) argv.push('--summary', summaryFile);
    if (flow !== undefined) {
      const flowFile = path.join(dir, 'flow.mmd');
      fs.writeFileSync(flowFile, flow);
      argv.push('--flow', flowFile);
    }
    argv.push(...extra);
    let out = '';
    let err = '';
    const code = runCli(argv, { out: (s) => { out += s; }, err: (s) => { err += s; } });
    return { code, out, err };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('minimal passed digest → pr-body prints only summary sections and the verification line', () => {
  const r = runPrBody({ digest: prBodyDigest() });
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.err, '');
  assert.strictEqual(r.out, [
    '## 배경 · 변경 의도',
    '',
    '- 문제: 초안이 비어 있었다.',
    '- 의도: digest에서 만든다.',
    '',
    '## 주요 변경 내용',
    '',
    '| 파일 | 변경 |',
    '| --- | --- |',
    '| `a.ts` | 렌더러 추가 |',
    '',
    '## 변경 그림',
    '',
    '<TODO: 작성 필요>',
    '',
    '## 변경 전후',
    '',
    '<TODO: 작성 필요>',
    '',
    '## 되돌리기 · 영향 범위',
    '',
    '<TODO: 작성 필요>',
    '',
    '## 확인 방법',
    '',
    '- node --test a — passed',
    '',
  ].join('\n'));
});

test('same verify command in two tasks → pr-body lists it once', () => {
  const task = (id) => ({
    id, verification: { status: 'passed', command: 'node --test a', exit_code: 0, evidence_id: id },
  });
  const r = runPrBody({ digest: prBodyDigest({ tasks: [task('TASKS-001'), task('TASKS-002')] }) });
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.out.split('node --test a — passed').length - 1, 1);
});

test('failed outside_scope verification, deferred must_fix and drive issues → pr-body keeps each visible', () => {
  const finding = {
    id: 'F-1', status: 'deferred', actionability: 'must_fix', note: '나중에 고친다',
  };
  const digest = prBodyDigest({
    tasks: [{
      id: 'TASKS-001',
      verification: {
        status: 'failed', command: 'npm test', exit_code: 1, evidence_id: 'e1',
        outside_scope: { kind: 'outside_scope', reason: 'vendor drift', evidence_id: 'e1' },
      },
    }],
    out_of_scope: ['vendor 변경은 이 PR 밖이다'],
    unverified: [{ kind: 'terminal-outside-scope', detail: 'vendor drift (evidence e1)' }],
    blueprint_review: { findings: [finding] },
    warnings: [{ kind: 'must-fix-deferred', id: 'F-1', note: '나중에 고친다' }],
    drive_issues: { ...ZERO_ISSUES, rework_reports: 2, deferred_must_fix: 1 },
    pr: { sections: { related: ['Explain: [explain.md](https://example.test/e.md)'] } },
  });
  const r = runPrBody({ digest });
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.out, [
    '## 관련 이슈',
    '',
    '- Explain: [explain.md](https://example.test/e.md)',
    '',
    '## 배경 · 변경 의도',
    '',
    '- 문제: 초안이 비어 있었다.',
    '- 의도: digest에서 만든다.',
    '',
    '## 주요 변경 내용',
    '',
    '| 파일 | 변경 |',
    '| --- | --- |',
    '| `a.ts` | 렌더러 추가 |',
    '',
    '## 변경 그림',
    '',
    '<TODO: 작성 필요>',
    '',
    '## 변경 전후',
    '',
    '<TODO: 작성 필요>',
    '',
    '## 리뷰 포인트',
    '',
    '- 미해결 must_fix: F-1: 나중에 고친다',
    '- vendor 변경은 이 PR 밖이다',
    '- terminal-outside-scope: vendor drift (evidence e1)',
    '- 실행 이슈: rework_reports 2, deferred_must_fix 1',
    '',
    '## 되돌리기 · 영향 범위',
    '',
    '<TODO: 작성 필요>',
    '',
    '## 확인 방법',
    '',
    '- npm test — failed (outside_scope, evidence e1)',
    '',
  ].join('\n'));
  assert.ok(!r.out.includes('npm test — passed'));
});

test('flow file given → pr-body adds a mermaid 로직 흐름 section before review points', () => {
  const digest = prBodyDigest({ out_of_scope: ['밖'] });
  const withFlow = runPrBody({ digest, flow: 'flowchart TD\n  A --> B\n' });
  assert.strictEqual(withFlow.code, 0, withFlow.err);
  assert.ok(withFlow.out.includes([
    '## 변경 그림',
    '',
    '```mermaid',
    'flowchart TD',
    '  A --> B',
    '```',
    '',
    '## 변경 전후',
    '',
    '<TODO: 작성 필요>',
    '',
    '## 리뷰 포인트',
  ].join('\n')));
  assert.ok(!withFlow.out.includes('로직 흐름'));
  const without = runPrBody({ digest });
  assert.ok(without.out.includes('## 변경 그림\n\n<TODO: 작성 필요>'));
  assert.ok(without.out.includes('## 변경 전후\n\n<TODO: 작성 필요>'));
  assert.ok(!without.out.includes('```mermaid'));
});

test('no flow file → pr-body keeps mandatory sections in contract order with write-needed markers', () => {
  const r = runPrBody({ digest: prBodyDigest() });
  assert.strictEqual(r.code, 0, r.err);
  const picture = r.out.indexOf('## 변경 그림');
  const beforeAfter = r.out.indexOf('## 변경 전후');
  const review = r.out.indexOf('## 리뷰 포인트');
  const revert = r.out.indexOf('## 되돌리기 · 영향 범위');
  const verify = r.out.indexOf('## 확인 방법');
  const changes = r.out.indexOf('## 주요 변경 내용');
  assert.ok(changes >= 0 && picture > changes);
  assert.ok(beforeAfter > picture);
  assert.ok(revert > beforeAfter);
  assert.ok(verify > revert);
  if (review >= 0) {
    assert.ok(review > beforeAfter && review < revert);
  }
  assert.ok(r.out.includes('## 변경 그림\n\n<TODO: 작성 필요>'));
  assert.ok(r.out.includes('## 변경 전후\n\n<TODO: 작성 필요>'));
  assert.ok(r.out.includes('## 되돌리기 · 영향 범위\n\n<TODO: 작성 필요>'));
});

test('same inputs twice → pr-body output is byte-identical', () => {
  const digest = prBodyDigest({ out_of_scope: ['밖'] });
  assert.strictEqual(runPrBody({ digest, flow: 'graph TD\n A-->B' }).out,
    runPrBody({ digest, flow: 'graph TD\n A-->B' }).out);
});

test('invalid JSON, wrong version or missing range → pr-body exits 1 with stderr only', () => {
  const bad = [
    runPrBody({ rawDigest: '{not json' }),
    runPrBody({ digest: prBodyDigest({ version: 1 }) }),
    runPrBody({ digest: prBodyDigest({ range: undefined }) }),
    runPrBody({ digest: prBodyDigest({ tasks: [{ id: 'T', verification: { status: 5 } }] }) }),
  ];
  for (const r of bad) {
    assert.strictEqual(r.code, 1);
    assert.strictEqual(r.out, '');
    assert.match(r.err, /^finalize pr-body: /);
  }
});

test('summary missing a required heading or its body → pr-body exits 1', () => {
  for (const summary of [
    '## 배경 · 변경 의도\n\n본문\n',
    '## 배경 · 변경 의도\n\n본문\n\n## 주요 변경 내용\n\n',
    '내용만 있다\n',
  ]) {
    const r = runPrBody({ digest: prBodyDigest(), summary });
    assert.strictEqual(r.code, 1, summary);
    assert.strictEqual(r.out, '');
    assert.match(r.err, /^finalize pr-body: /);
  }
});

test('unreadable summary file → pr-body exits 1', () => {
  const r = runPrBody({ digest: prBodyDigest(), summary: null });
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /^finalize pr-body: /);
});

test('missing --digest or --summary → pr-body exits 2 as a usage error', () => {
  const noDigest = runPrBody({ digest: prBodyDigest(), omit: ['digest'] });
  assert.strictEqual(noDigest.code, 2);
  assert.strictEqual(noDigest.err, 'finalize: --digest is required\n');
  const noSummary = runPrBody({ digest: prBodyDigest(), omit: ['summary'] });
  assert.strictEqual(noSummary.code, 2);
  assert.strictEqual(noSummary.err, 'finalize: --summary is required\n');
});
