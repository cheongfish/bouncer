// test/finalize-digest.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { prepareFinalizeDigest } = require('../scripts/lib/finalize-digest');
const { writeCurrent, clearCurrent } = require('../scripts/lib/current');
const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
const { runCli } = require('../scripts/lib/cli');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trimEnd();
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function taskBody(constraints = '- keep greet pure') {
  return `# Tasks

## Goal & intent
greet helper

## Current behavior
none

## Target behavior
greet exists

## Interface
greet()

## Touch
- \`src/\`

## Do not touch
- \`vendor/\`

## Constraints
${constraints}

## Checklist
- [ ] done
`;
}

/**
 * 두 commit task fixture. verification passed, 커밋 파일은 affected_paths 안,
 * verification task 없음. TASKS-001은 review.required:false, TASKS-002는 deferred finding.
 *
 * @returns {{ repoRoot: string, blueprintDir: string, base: string }}
 */
function buildStandaloneFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-'));
  git(repoRoot, ['init', '-b', 'work']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'base\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);
  // plan 커밋 전 HEAD는 rangeBase로 다시 잡는다 — 여기서 SHA를 두지 않는다.

  writeDoc(repoRoot, `${BP.split('/blueprints/')[0]}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd',
    resource: `${BP.split('/blueprints/')[0]}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repoRoot, `${BP}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd',
    resource: `${BP}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      commit_type: 'feat', scale: 'full',
    },
  }, '# Blueprint\n\n## Intent\n- digest input\n\n## Out of scope\n- payments\n');

  const taskMeta = (id, title) => ({
    type: 'bouncer.tasks', title, description: 'd',
    resource: `${BP}/tasks/${id}/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${id}`, epic_id: '001', blueprint_id: '001', status: 'verified',
      execution_kind: 'commit',
      affected_paths: ['src/'],
      // trailer가 정본이므로 문서 SHA는 가짜 — trailer 우선을 검증한다.
      commit_sha: 'deadbeef',
    },
  });

  writeDoc(repoRoot, `${BP}/tasks/001/tasks.md`, taskMeta('001', 'Greet'), taskBody());
  writeDoc(repoRoot, `${BP}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${BP}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'passed',
      verification: {
        command: 'true', exit_code: 0, evidence_id: 'e1', reused: false,
      },
    },
  });
  writeDoc(repoRoot, `${BP}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${BP}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture', findings: [] },
    },
  });

  writeDoc(repoRoot, `${BP}/tasks/002/tasks.md`, taskMeta('002', 'Helper'), taskBody('- no network'));
  writeDoc(repoRoot, `${BP}/tasks/002/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${BP}/tasks/002/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-002', epic_id: '001', blueprint_id: '001', status: 'passed',
      verification: {
        command: 'true', exit_code: 0, evidence_id: 'e2', reused: false,
      },
    },
  });
  writeDoc(repoRoot, `${BP}/tasks/002/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${BP}/tasks/002/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-002', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: {
        required: true,
        findings: [{
          id: 'F-1', severity: 'minor', status: 'deferred', note: 'follow-up later',
        }],
      },
    },
  });

  // plan docs를 먼저 커밋해 base..HEAD에 넣지 않는다 — changed_paths는 코드만.
  git(repoRoot, ['add', '-A']);
  git(repoRoot, ['commit', '-m', 'plan']);
  // pointer base는 plan 커밋 — task 코드 커밋만 digest 범위에 들어간다.
  const rangeBase = git(repoRoot, ['rev-parse', 'HEAD']);
  writeCurrent({ repoRoot, blueprint: BP, base: rangeBase });

  fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'src/greet.js'), 'function greet() {\n  return "hi";\n}\n');
  git(repoRoot, ['add', 'src/greet.js']);
  git(repoRoot, [
    'commit', '-m',
    'feat: greet\n\nBouncer-Task: EPIC-001/BP-001/TASK-001\nBouncer-Intent: EPIC-001/BP-001\n',
  ]);

  fs.writeFileSync(path.join(repoRoot, 'src/helper.js'), 'const helper = 1;\n');
  git(repoRoot, ['add', 'src/helper.js']);
  git(repoRoot, [
    'commit', '-m',
    'feat: helper\n\nBouncer-Task: EPIC-001/BP-001/TASK-002\nBouncer-Intent: EPIC-001/BP-001\n',
  ]);

  return { repoRoot, blueprintDir: BP, base: rangeBase };
}

test('prepareFinalizeDigest fills trailer commits, unverified, symbols, and refuses afterClose', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  const before = git(repoRoot, ['status', '--porcelain']);

  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.strictEqual(d.version, 1);
  assert.strictEqual(d.tasks[0].commit.source, 'trailer');
  assert.deepStrictEqual(
    d.unverified.map((u) => u.kind).sort(),
    ['finding-deferred', 'review-skipped', 'terminal-missing'],
  );
  assert.ok(d.symbols.some((s) => s.names.includes('greet')));
  assert.ok(d.pr);
  assert.match(d.pr.title_prefix, /^\[\d{6}\] \(→ Main\) \[Feat\]$/);
  assert.strictEqual(d.pr.base, 'main');
  assert.strictEqual(d.pr.head, 'work');
  assert.strictEqual(d.pr.draft, true);
  assert.deepStrictEqual(d.pr.sections.related, []);
  assert.strictEqual(d.pr.sections.background, null);
  assert.ok(d.pr.sections.verification.some((line) => /true — passed/.test(line)));
  assert.ok(d.pr.sections.review_points.includes('payments'));
  assert.ok(d.pr.sections.review_points.includes('follow-up later'));
  assert.strictEqual(git(repoRoot, ['status', '--porcelain']), before);

  // --yes 이후: tasks/ 삭제
  fs.rmSync(path.join(repoRoot, blueprintDir, 'tasks'), { recursive: true, force: true });
  const afterClose = { repoRoot, blueprintDir };
  assert.strictEqual(prepareFinalizeDigest(afterClose).reason, 'task-documents-missing');
});

test('prepareFinalizeDigest drive fixture prefers trailer integration SHA over worker commit_sha', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  const paths = coordinatorPathsFor({ repoRoot, blueprint: blueprintDir });

  // worktree를 먼저 만든다. ledger mkdir이 integration 디렉터리를 선점하면
  // `git worktree add`가 거절한다.
  git(repoRoot, ['branch', 'feat/integ']);
  git(repoRoot, ['worktree', 'add', paths.integrationPath, 'feat/integ']);

  const integHead = git(paths.integrationPath, ['rev-parse', 'HEAD']);
  const task1Sha = git(paths.integrationPath, [
    'log', '-1', '--format=%H', '--grep', 'Bouncer-Task: EPIC-001/BP-001/TASK-001',
  ]);
  assert.ok(/^[0-9a-f]{40}$/.test(task1Sha));

  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(paths.ledgerFile, `${JSON.stringify({
    version: 1,
    blueprint: blueprintDir,
    base: git(repoRoot, ['rev-parse', 'HEAD~2']),
    integrationHead: integHead,
    integrationBranch: 'feat/integ',
    revision: 'r1',
    tasks: [
      {
        id: '001',
        status: 'integrated',
        sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        actualPaths: ['src/greet.js'],
        branch: 'bouncer/001-001-001',
      },
      {
        id: '002',
        status: 'integrated',
        sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        actualPaths: ['src/helper.js'],
        branch: 'bouncer/001-001-002',
      },
    ],
    decisions: [],
  }, null, 2)}\n`);

  // Interface write-absence: prepare는 porcelain·원장 바이트를 바꾸지 않는다.
  const beforePorcelain = git(repoRoot, ['status', '--porcelain']);
  const beforeLedger = fs.readFileSync(paths.ledgerFile);

  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.ok(d.coordinator);
  assert.strictEqual(d.coordinator.integrationBranch, 'feat/integ');
  assert.strictEqual(d.tasks[0].commit.source, 'trailer');
  assert.strictEqual(d.tasks[0].commit.sha, task1Sha.toLowerCase());
  assert.notStrictEqual(d.tasks[0].commit.sha, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.deepStrictEqual(d.tasks[0].actual_paths, ['src/greet.js']);

  assert.strictEqual(git(repoRoot, ['status', '--porcelain']), beforePorcelain);
  assert.deepStrictEqual(fs.readFileSync(paths.ledgerFile), beforeLedger);

  git(repoRoot, ['worktree', 'remove', '--force', paths.integrationPath]);
});

test('prepareFinalizeDigest returns no-base when base cannot be resolved', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  // pointer·원장 base가 없으면 resolveDigestBase가 null → no-base.
  clearCurrent({ repoRoot });
  const result = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'no-base');
});

test('prepareFinalizeDigest falls back to tasks.md commit_sha when trailer is missing', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-digest-sha-'));
  git(repoRoot, ['init', '-b', 'work']);
  git(repoRoot, ['config', 'user.email', 't@example.com']);
  git(repoRoot, ['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repoRoot, 'README'), 'base\n');
  git(repoRoot, ['add', 'README']);
  git(repoRoot, ['commit', '-m', 'base']);

  writeDoc(repoRoot, `${BP.split('/blueprints/')[0]}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd',
    resource: `${BP.split('/blueprints/')[0]}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repoRoot, `${BP}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd',
    resource: `${BP}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
      commit_type: 'feat', scale: 'full',
    },
  }, '# Blueprint\n\n## Intent\n- digest input\n');

  writeDoc(repoRoot, `${BP}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Greet', description: 'd',
    resource: `${BP}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      execution_kind: 'commit',
      affected_paths: ['src/'],
      commit_sha: 'c0ffeeee',
    },
  }, taskBody());
  writeDoc(repoRoot, `${BP}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${BP}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'passed',
      verification: {
        command: 'true', exit_code: 0, evidence_id: 'e1', reused: false,
      },
    },
  });
  writeDoc(repoRoot, `${BP}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${BP}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture', findings: [] },
    },
  });

  git(repoRoot, ['add', '-A']);
  git(repoRoot, ['commit', '-m', 'plan']);
  const rangeBase = git(repoRoot, ['rev-parse', 'HEAD']);
  writeCurrent({ repoRoot, blueprint: BP, base: rangeBase });

  // trailer 없음 — digest는 tasks.md commit_sha로 폴백해야 한다.
  fs.mkdirSync(path.join(repoRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'src/greet.js'), 'function greet() {}\n');
  git(repoRoot, ['add', 'src/greet.js']);
  git(repoRoot, ['commit', '-m', 'feat: greet without trailer']);

  const d = prepareFinalizeDigest({ repoRoot, blueprintDir: BP });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.strictEqual(d.tasks.length, 1);
  assert.strictEqual(d.tasks[0].commit.source, 'commit_sha');
  assert.strictEqual(d.tasks[0].commit.sha8, 'c0ffeeee');
  assert.strictEqual(d.tasks[0].commit.sha, 'c0ffeeee');
});

test('prepareFinalizeDigest rejects missing blueprint and unreadable ledger', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  assert.strictEqual(
    prepareFinalizeDigest({ repoRoot, blueprintDir: 'no/such/bp' }).reason,
    'blueprint-not-found',
  );

  const paths = coordinatorPathsFor({ repoRoot, blueprint: blueprintDir });
  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(paths.ledgerFile, '{ broken');
  const broken = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(broken.ok, false);
  assert.strictEqual(broken.reason, 'coordinator-ledger');
  assert.strictEqual(broken.code, 'UNREADABLE_LEDGER');
});

test('prepareFinalizeDigest accepts now for deterministic pr.title_prefix', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  const d = prepareFinalizeDigest({
    repoRoot,
    blueprintDir,
    now: new Date('2026-09-24T01:00:00Z'),
  });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.strictEqual(d.pr.title_prefix, '[260924] (→ Main) [Feat]');
});

test('CLI finalize prepare prints digest JSON', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  let out = '';
  let err = '';
  const code = runCli(
    ['finalize', 'prepare', '--blueprint', blueprintDir, '--repo', repoRoot],
    { out: (s) => { out += s; }, err: (s) => { err += s; } },
  );
  assert.strictEqual(code, 0, err || out);
  const parsed = JSON.parse(out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.tasks[0].commit.source, 'trailer');
});

test('prepareFinalizeDigest uses base_branch when pr.base is absent', () => {
  // resolvePrBase: pr.base 부재 시 root.base_branch 폴백(main 직전 분기).
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  fs.mkdirSync(path.join(repoRoot, '.bouncer'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, '.bouncer', 'config.json'),
    `${JSON.stringify({ base_branch: 'develop' }, null, 2)}\n`,
  );
  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.strictEqual(d.git.pr_base, 'develop');
  assert.strictEqual(d.pr.base, 'develop');
});

test('prepareFinalizeDigest treats CURRENT_AMBIGUOUS as no-base', () => {
  // resolveDigestBase catch: pointer 충돌은 base 부재와 같다.
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  const otherBp = '.bouncer/context/epics/002-other/blueprints/001-x';
  writeDoc(repoRoot, `${otherBp}/index.md`, {
    type: 'bouncer.blueprint', title: 'Other', description: 'd',
    resource: `${otherBp}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '002', blueprint_id: '001', status: 'approved',
      commit_type: 'feat',
    },
  }, '# Blueprint\n\n## Intent\n- x\n');
  writeCurrent({ repoRoot, blueprint: otherBp, base: git(repoRoot, ['rev-parse', 'HEAD']) });
  // 두 pointer가 공존하면 readCurrent가 CURRENT_AMBIGUOUS를 throw한다.
  const result = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'no-base');
});

test('prepareFinalizeDigest absorbs broken verification/review and skips broken tasks.md', () => {
  // readVerification/readReview catch + tasks.md 파싱 실패 continue.
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  fs.writeFileSync(
    path.join(repoRoot, blueprintDir, 'tasks/001/verification.md'),
    '---\n: not-yaml\n---\n',
  );
  fs.writeFileSync(
    path.join(repoRoot, blueprintDir, 'tasks/001/review.md'),
    '---\n{broken\n---\n',
  );
  fs.writeFileSync(
    path.join(repoRoot, blueprintDir, 'tasks/002/tasks.md'),
    '---\n: broken-tasks\n---\n',
  );
  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  // 깨진 tasks.md(002)는 목록에서 빠지고, 001은 verification/review null.
  assert.strictEqual(d.tasks.length, 1);
  assert.strictEqual(d.tasks[0].id, 'TASKS-001');
  assert.strictEqual(d.tasks[0].verification, null);
  assert.strictEqual(d.tasks[0].review, null);
});

test('prepareFinalizeDigest records path-outside-scope and finding-accepted', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  // affected_paths(src/) 밖 변경 → path-outside-scope.
  fs.mkdirSync(path.join(repoRoot, 'vendor'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'vendor/leak.js'), 'module.exports = 1;\n');
  git(repoRoot, ['add', 'vendor/leak.js']);
  git(repoRoot, ['commit', '-m', 'chore: leak outside scope']);

  // TASKS-002 finding을 accepted로 바꿔 finding-accepted 분기를 탄다.
  writeDoc(repoRoot, `${blueprintDir}/tasks/002/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${blueprintDir}/tasks/002/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-002', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: {
        required: true,
        findings: [{
          id: 'F-1', severity: 'minor', status: 'accepted', note: 'accepted later',
        }],
      },
    },
  });

  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.ok(d.unverified.some((u) => u.kind === 'path-outside-scope' && u.path === 'vendor/leak.js'));
  assert.ok(d.unverified.some((u) => u.kind === 'finding-accepted' && u.detail === 'accepted later'));
});

test('prepareFinalizeDigest clears terminal-missing when a verification task passed', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  writeDoc(repoRoot, `${blueprintDir}/tasks/003/tasks.md`, {
    type: 'bouncer.tasks', title: 'Terminal verify', description: 'd',
    resource: `${blueprintDir}/tasks/003/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-003', epic_id: '001', blueprint_id: '001', status: 'verified',
      execution_kind: 'verification',
      affected_paths: ['src/'],
    },
  }, taskBody());
  writeDoc(repoRoot, `${blueprintDir}/tasks/003/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${blueprintDir}/tasks/003/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-003', epic_id: '001', blueprint_id: '001', status: 'passed',
      verification: {
        command: 'true', exit_code: 0, evidence_id: 'e3', reused: false,
      },
    },
  });

  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.ok(d.tasks.some((t) => t.execution_kind === 'verification'));
  assert.ok(!d.unverified.some((u) => u.kind === 'terminal-missing'));
});

test('prepareFinalizeDigest reports verification-not-passed for failed commit verify', () => {
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  writeDoc(repoRoot, `${blueprintDir}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${blueprintDir}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'failed',
      verification: {
        command: 'false', exit_code: 1, evidence_id: 'e1', reused: false,
      },
    },
  });
  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.ok(d.unverified.some(
    (u) => u.kind === 'verification-not-passed' && /TASK-001/.test(u.task),
  ));
});

test('prepareFinalizeDigest returns no-base when exec cannot resolve HEAD or base', () => {
  const { repoRoot, blueprintDir, base } = buildStandaloneFixture();
  const failHead = prepareFinalizeDigest({
    repoRoot,
    blueprintDir,
    exec: (args) => {
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return { status: 1, stdout: '' };
      }
      return { status: 0, stdout: `${base}\n` };
    },
  });
  assert.strictEqual(failHead.ok, false);
  assert.strictEqual(failHead.reason, 'no-base');

  const failBase = prepareFinalizeDigest({
    repoRoot,
    blueprintDir,
    exec: (args) => {
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return { status: 1, stdout: '' };
      }
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return { status: 0, stdout: `${base}\n` };
      }
      return { status: 0, stdout: '' };
    },
  });
  assert.strictEqual(failBase.ok, false);
  assert.strictEqual(failBase.reason, 'no-base');
});

test('prepareFinalizeDigest keeps going when blueprint index YAML is broken', () => {
  // index 파싱 실패는 blueprint-not-found가 아니다 — 디렉터리는 있다.
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  fs.writeFileSync(path.join(repoRoot, blueprintDir, 'index.md'), '---\n: broken\n---\n');
  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  assert.strictEqual(d.blueprint.title, '');
  assert.deepStrictEqual(d.blueprint.intent, []);
});

test('prepareFinalizeDigest falls back to bare id when stable provenance cannot be built', () => {
  // epic_id 형식이 깨지면 buildStableProvenance throw → id만 싣는다.
  const { repoRoot, blueprintDir } = buildStandaloneFixture();
  writeDoc(repoRoot, `${blueprintDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Greet', description: 'd',
    resource: `${blueprintDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: 'bad', blueprint_id: '001', status: 'verified',
      execution_kind: 'commit',
      affected_paths: ['src/'],
      commit_sha: 'deadbeef',
    },
  }, taskBody());
  const d = prepareFinalizeDigest({ repoRoot, blueprintDir });
  assert.strictEqual(d.ok, true, JSON.stringify(d));
  const task1 = d.tasks.find((t) => t.id === 'TASKS-001');
  assert.ok(task1);
  assert.strictEqual(task1.stable_id, 'TASKS-001');
});
