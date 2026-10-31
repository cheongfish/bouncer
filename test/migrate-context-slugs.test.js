'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createGitTemplate } = require('./helpers/git-fixture');
const { migrateContextSlugs, planContextSlugMigration } = require('../packages/cli/dist/migrate-context-slugs');
const { runCli } = require('../packages/cli/dist/cli');
const { readDoc } = require('../packages/cli/dist/frontmatter');
const { renderDoc } = require('../packages/cli/dist/render');
const { sha256Canonical } = require('../packages/cli/dist/canonical-json');
const { taskBriefHash } = require('../packages/cli/dist/task-brief-hash');
const { computePlanSnapshot } = require('../packages/cli/dist/plan-snapshot');
const { findingFingerprint, findingAutoId } = require('../packages/cli/dist/validate-sections');
const { validateBlueprint } = require('../packages/cli/dist/validate');
const { readEpicRegistry } = require('../packages/cli/dist/epic-registry');
const { resolveTaskCommits } = require('../packages/cli/dist/task-commits');
const { buildStableProvenance } = require('../packages/cli/dist/commit-sha');
const runtimeState = require('../packages/cli/dist/runtime-state');
const { writeCurrent } = require('../packages/cli/dist/current');
const { scaffoldEpic, scaffoldBlueprint, scaffoldExplain } = require('../packages/cli/dist/scaffold');

const TS = '2026-10-20T10:00:00+09:00';
const CTX = '.bouncer/context';
const LEGACY_EPIC = `${CTX}/epics/001-plan-workflow`;
const DOMAIN_EPIC = `${CTX}/epics/114-consumer-epic-registry`;
const RICH_OLD = `${LEGACY_EPIC}/blueprints/001-hash-rewrite`;
const RICH_NEW = `${CTX}/epics/plan-workflow/blueprints/hash-rewrite`;
const SLUG_IDS_NEW = `${CTX}/epics/consumer-epic-registry/blueprints/slug-ids`;
const GATES_NEW = `${CTX}/epics/consumer-epic-registry/blueprints/registry-gates`;
const OLD_TASK_REF = 'EPIC-001/BP-001/TASK-001';
const NEW_TASK_REF = 'plan-workflow/hash-rewrite/001';
const NEW_BLUEPRINTS = [RICH_NEW, SLUG_IDS_NEW, GATES_NEW];
const RESTORE = 'git restore --staged --worktree .bouncer && git clean -fd .bouncer/context';

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

function read(repo, rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}

function data(repo, rel) {
  return readDoc(path.join(repo, rel)).data;
}

// frontmatter를 고쳐 다시 쓴다. scaffold가 만든 문서에 이관 대상 증적을 얹는 데만 쓴다.
function patch(repo, rel, mutate) {
  const doc = readDoc(path.join(repo, rel));
  const body = mutate(doc.data, doc.body);
  fs.writeFileSync(path.join(repo, rel), renderDoc(doc.data, typeof body === 'string' ? body : doc.body));
}

/**
 * 번호 형식 저장소를 만든다: legacy epic 1개(블루프린트 1개, 증적 문서 전부)와
 * domain epic 1개(블루프린트 2개). 등록부는 v1이고, 마지막에 구형 trailer 커밋 1개를 둔다.
 */
function buildFixture(repo) {
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 't@example.com');
  git(repo, 'config', 'user.name', 'tester');
  fs.writeFileSync(path.join(repo, '.gitignore'), '.worktrees/\n');
  scaffoldEpic({
    repoRoot: repo, epicId: '001', name: 'plan-workflow', timestamp: TS, description: 'Plan workflow epic.',
  });
  scaffoldEpic({
    repoRoot: repo, epicId: '114', name: 'consumer-epic-registry', timestamp: TS, description: 'Registry consumers.',
  });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: LEGACY_EPIC, blueprintId: '001', name: 'hash-rewrite', timestamp: TS,
  });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: DOMAIN_EPIC, blueprintId: '002', name: 'slug-ids', timestamp: TS,
  });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: DOMAIN_EPIC, blueprintId: '003', name: 'registry-gates', timestamp: TS,
  });
  scaffoldExplain({ repoRoot: repo, blueprintDir: RICH_OLD, timestamp: TS });
  // scaffold가 비워 둔 affected_paths가 있어야 이관 뒤 기본 validate(S7)를 통과한다.
  const taskBlueprints = [
    RICH_OLD, `${DOMAIN_EPIC}/blueprints/002-slug-ids`, `${DOMAIN_EPIC}/blueprints/003-registry-gates`,
  ];
  for (const bp of taskBlueprints) {
    patch(repo, `${bp}/tasks/001/tasks.md`, (d) => { d.bouncer.affected_paths = ['scripts/src/lib/example.ts']; });
  }

  // 이관이 다시 계산해야 하는 값은 계획 문서가 확정된 뒤에 얹는다(해시가 문서 내용에 의존한다).
  const tasksRel = `${RICH_OLD}/tasks/001/tasks.md`;
  fs.appendFileSync(path.join(repo, tasksRel), [
    '',
    '[epic](../../../../index.md) and',
    '[peer](../../../../../114-consumer-epic-registry/blueprints/003-registry-gates/index.md)',
    '',
    `Path: ${DOMAIN_EPIC}/blueprints/003-registry-gates/index.md`,
    '',
  ].join('\n'));
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'docs/notes.md'),
    '# Notes\n\n[epic](../.bouncer/context/epics/001-plan-workflow/index.md)\n',
  );

  const oldBriefHash = taskBriefHash(read(repo, tasksRel));
  const oldDigest = computePlanSnapshot({ repoRoot: repo, blueprintDir: RICH_OLD }).digest;
  const identity = {
    head: 'a'.repeat(40),
    dirty_digest: 'b'.repeat(64),
    command: 'node --test',
    cwd: '.',
    environment_hash: 'c'.repeat(64),
    scope: { kind: 'task', key: OLD_TASK_REF },
  };
  patch(repo, `${RICH_OLD}/tasks/001/verification.md`, (d) => {
    d.bouncer.status = 'passed';
    d.bouncer.verification = {
      command: 'node --test',
      ran_at: TS,
      exit_code: 0,
      output_tail: 'ok',
      evidence_id: sha256Canonical(identity),
      identity,
      scope: identity.scope,
      reused: false,
      source_digest: 'd'.repeat(64),
    };
  });
  const finding = (ns, file) => {
    const fields = {
      category: 'correctness', brief_clause: 'tasks/001 Interface', file, symbol: 'rewrite',
    };
    const fingerprint = findingFingerprint(fields, ns);
    return {
      id: findingAutoId(fingerprint, ns),
      severity: 'minor',
      status: 'open',
      ...fields,
      fingerprint,
      actionability: 'advisory',
      origin: 'discovery',
      first_seen_round: 1,
      last_seen_round: 1,
    };
  };
  const reviewFinding = finding(undefined, tasksRel);
  patch(repo, `${RICH_OLD}/review.md`, (d) => {
    d.bouncer.review = {
      required: true,
      findings: [reviewFinding],
      rounds: [
        { round: 1, mode: 'discovery', task_brief_hashes: { 'TASKS-001': oldBriefHash } },
        { round: 2, mode: 'delta', previous_finding_ids: [reviewFinding.id] },
      ],
    };
  });
  const contextFinding = finding('context', tasksRel);
  patch(repo, `${RICH_OLD}/context-review.md`, (d) => {
    d.bouncer.status = 'accepted';
    d.bouncer.context_review = {
      rounds: [{
        round: 1,
        mode: 'discovery',
        target: { digest: oldDigest },
        perspectives: [{ name: 'combined', target_digest: oldDigest }],
      }],
      findings: [contextFinding],
      closure_target_digest: oldDigest,
    };
  });
  patch(repo, `${RICH_OLD}/explain.md`, (d, body) => {
    d.bouncer.task_commits = [{ task: OLD_TASK_REF, sha: 'abcd1234', intent_anchor: 'task-001' }];
    return `${body}\n### ${OLD_TASK_REF} · \`abcd1234\`\n`;
  });

  fs.writeFileSync(path.join(repo, '.bouncer/epics.json'), `${JSON.stringify({
    version: 1,
    profile: 'domain-only',
    domainEpicLimit: 5,
    areas: [],
    epics: [
      { slug: 'plan-workflow', id: '001', kind: 'legacy', active: true },
      {
        slug: 'consumer-epic-registry',
        id: '114',
        kind: 'domain',
        active: true,
        approval: { reason: 'registry consumers', approvedAt: TS },
      },
    ],
  }, null, 2)}\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'fixture');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'feat: legacy trailer',
    '-m', `Bouncer-Task: ${OLD_TASK_REF}\nBouncer-Intent: EPIC-001/BP-001`);
  return { oldBriefHash, oldDigest, oldEvidenceId: sha256Canonical(identity), reviewFinding, contextFinding };
}

let facts;
const template = createGitTemplate((dir) => { facts = buildFixture(dir); });
test.after(() => template.dispose());

/** 호출을 세는 seam. git은 실제로 실행하고, fs는 쓰기 계열만 센다. */
function instrument(repo, { failOnMv } = {}) {
  const calls = [];
  const writes = [];
  const counted = (name) => (...args) => {
    writes.push(name);
    return fs[name](...args);
  };
  const deps = {
    runGit(args) {
      calls.push(args);
      if (args[0] === 'mv' && failOnMv !== undefined && calls.filter((c) => c[0] === 'mv').length === failOnMv) {
        throw new Error('simulated git mv failure');
      }
      return { stdout: execFileSync('git', args, { cwd: repo, encoding: 'utf8' }) };
    },
    fs: {
      ...fs,
      writeFileSync: counted('writeFileSync'),
      renameSync: counted('renameSync'),
      mkdirSync: counted('mkdirSync'),
    },
  };
  return { deps, calls, writes, mvCount: () => calls.filter((c) => c[0] === 'mv').length };
}

let migratedCache;
/** 이관을 한 번만 실행하고 읽기 전용 단언이 공유한다. 변경이 필요한 테스트는 새 복사본을 쓴다. */
function migrated() {
  if (!migratedCache) {
    const repo = template.copy();
    migratedCache = { repo, result: migrateContextSlugs({ repoRoot: repo, yes: true }) };
  }
  return migratedCache;
}

function relativeLinks(text) {
  return [...text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
    .map((m) => m[1])
    .filter((target) => !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith('/'));
}

function assertLinksResolve(repo, rel) {
  for (const target of relativeLinks(read(repo, rel))) {
    assert.ok(fs.existsSync(path.resolve(repo, path.dirname(rel), target)), `${rel}: broken link ${target}`);
  }
}

test('dry-run → 계획만 출력하고 git mv·fs 쓰기·등록부 쓰기가 0회다', () => {
  const repo = template.copy();
  const registryBefore = read(repo, '.bouncer/epics.json');
  const spy = instrument(repo);
  const result = migrateContextSlugs({ repoRoot: repo, yes: false, deps: spy.deps });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.deepEqual(result.moved.map((m) => m.to).sort(), [
    `${CTX}/epics/consumer-epic-registry`,
    GATES_NEW,
    RICH_NEW,
    SLUG_IDS_NEW,
    `${CTX}/epics/plan-workflow`,
  ].sort());
  assert.ok(result.rewritten.includes(`${RICH_NEW}/tasks/001/verification.md`));
  assert.equal(spy.mvCount(), 0);
  assert.deepEqual(spy.writes, []);
  assert.equal(git(repo, 'status', '--porcelain'), '');
  assert.equal(read(repo, '.bouncer/epics.json'), registryBefore);
});

test('planContextSlugMigration → 같은 입력에서 쓰지 않고 이동 계획과 별칭을 돌려준다', () => {
  const repo = template.copy();
  const spy = instrument(repo);
  const registry = readEpicRegistry(repo).registry;
  const plan = planContextSlugMigration({ repoRoot: repo, registry, deps: spy.deps });
  assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.epics.length, 2);
  assert.deepEqual(plan.aliases['consumer-epic-registry'].blueprint_aliases, {
    '002': 'slug-ids', '003': 'registry-gates',
  });
  assert.deepEqual(spy.writes, []);
  assert.equal(spy.mvCount(), 0);
});

test('--yes → 번호 디렉터리가 slug로 옮겨지고 이동이 index에 올라간다', () => {
  const { repo, result } = migrated();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.dryRun, false);
  assert.equal(fs.existsSync(path.join(repo, LEGACY_EPIC)), false);
  assert.equal(fs.existsSync(path.join(repo, DOMAIN_EPIC)), false);
  for (const bp of NEW_BLUEPRINTS) assert.ok(fs.existsSync(path.join(repo, bp, 'index.md')), bp);
  const renames = git(repo, 'diff', '--cached', '--name-status').split('\n').filter((line) => line.startsWith('R'));
  assert.ok(renames.length > 0);
});

test('--yes → epic·blueprint frontmatter가 slug id·경로·order로 바뀐다', () => {
  const { repo } = migrated();
  const epic = data(repo, `${CTX}/epics/plan-workflow/index.md`);
  assert.equal(epic.resource, `${CTX}/epics/plan-workflow/index.md`);
  assert.equal(epic.bouncer.id, 'plan-workflow');
  assert.equal(epic.bouncer.epic_id, 'plan-workflow');
  const rich = data(repo, `${RICH_NEW}/index.md`).bouncer;
  assert.deepEqual(
    [rich.id, rich.epic_id, rich.blueprint_id, rich.order],
    ['hash-rewrite', 'plan-workflow', 'hash-rewrite', 1],
  );
  assert.equal(data(repo, `${SLUG_IDS_NEW}/index.md`).bouncer.order, 2);
  assert.equal(data(repo, `${GATES_NEW}/index.md`).bouncer.order, 3);
  const root = data(repo, `${RICH_NEW}/review.md`).bouncer;
  assert.deepEqual(
    [root.id, root.epic_id, root.blueprint_id],
    ['REVIEW-hash-rewrite', 'plan-workflow', 'hash-rewrite'],
  );
  const task = data(repo, `${RICH_NEW}/tasks/001/tasks.md`);
  assert.equal(task.bouncer.id, 'TASKS-001');
  assert.equal(task.bouncer.blueprint_id, 'hash-rewrite');
  assert.equal(task.resource, `${RICH_NEW}/tasks/001/tasks.md`);
});

test('--yes → 상대 링크와 번들 색인이 옮겨진 경로를 가리킨다', () => {
  const { repo } = migrated();
  assertLinksResolve(repo, `${RICH_NEW}/tasks/001/tasks.md`);
  assertLinksResolve(repo, 'docs/notes.md');
  assertLinksResolve(repo, `${CTX}/index.md`);
  const index = read(repo, `${CTX}/index.md`);
  assert.ok(index.split('\n').includes('* [plan-workflow](epics/plan-workflow/index.md) - Plan workflow epic.'));
  assert.ok(index.split('\n').includes(
    '* [consumer-epic-registry](epics/consumer-epic-registry/index.md) - Registry consumers.',
  ));
});

test('--yes → 문서 안의 전체 경로 문자열도 새 경로로 바뀐다', () => {
  const { repo } = migrated();
  const text = read(repo, `${RICH_NEW}/tasks/001/tasks.md`);
  assert.ok(text.includes(`Path: ${GATES_NEW}/index.md`));
  assert.ok(fs.existsSync(path.join(repo, GATES_NEW, 'index.md')));
});

test('--yes → verification의 scope.key와 explain의 task_commits가 새 형식이 된다', () => {
  const { repo } = migrated();
  const evidence = data(repo, `${RICH_NEW}/tasks/001/verification.md`).bouncer.verification;
  assert.equal(evidence.scope.key, NEW_TASK_REF);
  assert.equal(evidence.identity.scope.key, NEW_TASK_REF);
  const explain = data(repo, `${RICH_NEW}/explain.md`).bouncer;
  assert.equal(explain.id, 'EXPLAIN-hash-rewrite');
  assert.equal(explain.task_commits[0].task, NEW_TASK_REF);
  assert.ok(readDoc(path.join(repo, RICH_NEW, 'explain.md')).body.includes(`### ${NEW_TASK_REF} · `));
});

test('--yes → evidence_id가 바뀐 identity의 sha256Canonical과 같다', () => {
  const { repo } = migrated();
  const evidence = data(repo, `${RICH_NEW}/tasks/001/verification.md`).bouncer.verification;
  assert.equal(evidence.evidence_id, sha256Canonical(evidence.identity));
  assert.notEqual(evidence.evidence_id, facts.oldEvidenceId);
  assert.equal(evidence.identity.head, 'a'.repeat(40));
  assert.equal(evidence.identity.dirty_digest, 'b'.repeat(64));
});

test('--yes → finding id와 fingerprint가 원래 함수로 다시 계산한 값과 같다', () => {
  const { repo } = migrated();
  const review = data(repo, `${RICH_NEW}/review.md`).bouncer.review;
  const [finding] = review.findings;
  const expectedFp = findingFingerprint(finding);
  assert.equal(finding.file, `${RICH_NEW}/tasks/001/tasks.md`);
  assert.equal(finding.fingerprint, expectedFp);
  assert.equal(finding.id, findingAutoId(expectedFp));
  assert.notEqual(finding.id, facts.reviewFinding.id);
  // 같은 문서 안의 id 참조도 같이 바뀐다.
  assert.deepEqual(review.rounds[1].previous_finding_ids, [finding.id]);

  const ctx = data(repo, `${RICH_NEW}/context-review.md`).bouncer.context_review;
  const [ctxFinding] = ctx.findings;
  const ctxFp = findingFingerprint(ctxFinding, 'context');
  assert.equal(ctxFinding.fingerprint, ctxFp);
  assert.equal(ctxFinding.id, findingAutoId(ctxFp, 'context'));
});

test('--yes → closure_target_digest·target_digest가 이관된 계획 문서의 digest와 같다', () => {
  const { repo } = migrated();
  const expected = computePlanSnapshot({ repoRoot: repo, blueprintDir: RICH_NEW }).digest;
  assert.notEqual(expected, facts.oldDigest);
  const ctx = data(repo, `${RICH_NEW}/context-review.md`).bouncer.context_review;
  assert.equal(ctx.closure_target_digest, expected);
  assert.equal(ctx.rounds[0].target.digest, expected);
  assert.equal(ctx.rounds[0].perspectives[0].target_digest, expected);
});

test('--yes → task_brief_hash가 이관된 tasks.md의 taskBriefHash와 같다', () => {
  const { repo } = migrated();
  const hashes = data(repo, `${RICH_NEW}/review.md`).bouncer.review.rounds[0].task_brief_hashes;
  const expected = taskBriefHash(read(repo, `${RICH_NEW}/tasks/001/tasks.md`));
  assert.equal(hashes['TASKS-001'], expected);
  assert.notEqual(expected, facts.oldBriefHash);
});

test('--yes → 등록부가 v2가 되고 모든 번호 epic이 legacy_id와 별칭을 가진다', () => {
  const { repo } = migrated();
  const registry = JSON.parse(read(repo, '.bouncer/epics.json'));
  assert.equal(registry.version, 2);
  assert.equal(
    registry.epics.find((e) => e.slug === 'consumer-epic-registry').blueprint_aliases['003'],
    'registry-gates',
  );
  const legacy = registry.epics.find((e) => e.slug === 'plan-workflow');
  assert.equal(legacy.kind, 'legacy');
  assert.equal(legacy.legacy_id, '001');
  assert.deepEqual(legacy.blueprint_aliases, { '001': 'hash-rewrite' });
  assert.equal(registry.epics.every((e) => e.id === undefined), true);
  assert.equal(readEpicRegistry(repo).status, 'ok');
});

test('--yes → 이관한 blueprint마다 기본 validate가 ok이고 결과에 담긴다', () => {
  const { repo, result } = migrated();
  assert.deepEqual(result.validate.map((v) => v.blueprint).sort(), [...NEW_BLUEPRINTS].sort());
  for (const entry of result.validate) {
    assert.equal(entry.ok, true, JSON.stringify(entry));
    assert.equal(validateBlueprint({ repoRoot: repo, blueprintDir: entry.blueprint }).ok, true, entry.blueprint);
  }
  assert.deepEqual(result.aliases['plan-workflow'], {
    legacy_id: '001', blueprint_aliases: { '001': 'hash-rewrite' },
  });
});

test('이관된 저장소를 다시 실행하면 → moved가 비어 있는 성공이다', () => {
  const { repo } = migrated();
  const spy = instrument(repo);
  const again = migrateContextSlugs({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.equal(again.ok, true);
  assert.deepEqual(again.moved, []);
  assert.deepEqual(again.rewritten, []);
  assert.equal(spy.mvCount(), 0);
  assert.deepEqual(spy.writes, []);
});

test('이관 뒤 구형 trailer 커밋 → 새 task ref와 explain task_commits로 연결된다', () => {
  const { repo } = migrated();
  const registry = readEpicRegistry(repo).registry;
  const explainRef = data(repo, `${RICH_NEW}/explain.md`).bouncer.task_commits[0].task;
  const found = resolveTaskCommits({
    repoRoot: repo, base: 'HEAD~1', head: 'HEAD', stableIds: [explainRef], registry,
  });
  assert.equal(explainRef, NEW_TASK_REF);
  assert.equal(found.get(NEW_TASK_REF).sha, git(repo, 'rev-parse', 'HEAD').trim());
  // 등록부 없이는 구형 trailer를 새 ref로 묶을 수 없다 — 별칭이 연결의 근거다.
  const without = resolveTaskCommits({ repoRoot: repo, base: 'HEAD~1', head: 'HEAD', stableIds: [explainRef] });
  assert.equal(without.size, 0);
});

test('dirty 작업 트리 → migrate-dirty-tree로 거절하고 아무것도 바꾸지 않는다', () => {
  const repo = template.copy();
  fs.writeFileSync(path.join(repo, 'stray.txt'), 'x');
  const spy = instrument(repo);
  const result = migrateContextSlugs({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'migrate-dirty-tree');
  assert.equal(typeof result.next, 'string');
  assert.equal(spy.mvCount(), 0);
  assert.deepEqual(spy.writes, []);
  assert.equal(fs.existsSync(path.join(repo, LEGACY_EPIC)), true);
});

function assertInProgressRefusal(repo, kind) {
  const spy = instrument(repo);
  const result = migrateContextSlugs({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'migrate-in-progress');
  assert.ok(result.blockers.some((b) => b.kind === kind && typeof b.path === 'string'), JSON.stringify(result));
  assert.equal(spy.mvCount(), 0);
  assert.deepEqual(spy.writes, []);
  assert.equal(git(repo, 'status', '--porcelain'), '');
}

test('pointer 파일이 있으면 → migrate-in-progress(pointer)로 거절한다', () => {
  const repo = template.copy();
  runtimeState.writeRuntimeCurrent({
    repoRoot: repo, blueprint: RICH_OLD, base: 'main', task: `${RICH_OLD}/tasks/001/tasks.md`,
  });
  assertInProgressRefusal(repo, 'pointer');
});

test('approvals 아래 파일이 있으면 → migrate-in-progress(approval)로 거절한다', () => {
  const repo = template.copy();
  const { approvalsRoot } = runtimeState.runtimePaths({ repoRoot: repo });
  fs.mkdirSync(approvalsRoot, { recursive: true });
  fs.writeFileSync(path.join(approvalsRoot, 'snapshot.json'), '{}');
  assertInProgressRefusal(repo, 'approval');
});

test('.worktrees 아래 coordinator 원장이 있으면 → migrate-in-progress(ledger)로 거절한다', () => {
  const repo = template.copy();
  const ledger = path.join(repo, '.worktrees/001/001/integration', runtimeState.COORDINATOR_LEDGER_REL);
  fs.mkdirSync(path.dirname(ledger), { recursive: true });
  fs.writeFileSync(ledger, '{}');
  assertInProgressRefusal(repo, 'ledger');
});

test('.worktrees 아래 worktree가 있으면 → migrate-in-progress(worktree)로 거절한다', () => {
  const repo = template.copy();
  git(repo, 'worktree', 'add', '-q', '.worktrees/w1', '-b', 'w1');
  assertInProgressRefusal(repo, 'worktree');
});

test('주입한 listInProgress가 항목을 주면 → 같은 코드로 거절하고 blockers에 그대로 담는다', () => {
  const repo = template.copy();
  const spy = instrument(repo);
  const entry = { kind: 'pointer', path: '/somewhere/current' };
  const result = migrateContextSlugs({
    repoRoot: repo, yes: true, deps: { ...spy.deps, listInProgress: () => [entry] },
  });
  assert.equal(result.code, 'migrate-in-progress');
  assert.deepEqual(result.blockers, [entry]);
});

function assertConflict(repo) {
  const spy = instrument(repo);
  const result = migrateContextSlugs({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'migrate-slug-conflict');
  assert.equal(spy.mvCount(), 0);
  assert.deepEqual(spy.writes, []);
  assert.equal(fs.existsSync(path.join(repo, LEGACY_EPIC)), true);
  return result;
}

function commitAll(repo) {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'variant');
}

test('epic slug가 이미 있는 디렉터리와 겹치면 → migrate-slug-conflict로 거절한다', () => {
  const repo = template.copy();
  fs.mkdirSync(path.join(repo, CTX, 'epics/plan-workflow'), { recursive: true });
  fs.writeFileSync(path.join(repo, CTX, 'epics/plan-workflow/note.md'), '# x\n');
  commitAll(repo);
  assertConflict(repo);
});

test('같은 epic 안에서 blueprint slug가 겹치면 → migrate-slug-conflict로 거절한다', () => {
  const repo = template.copy();
  const blueprints = path.join(repo, DOMAIN_EPIC, 'blueprints');
  fs.cpSync(path.join(blueprints, '002-slug-ids'), path.join(blueprints, '004-slug-ids'), { recursive: true });
  commitAll(repo);
  assertConflict(repo);
});

test('slug 규칙을 어기는 이름이면 → migrate-slug-conflict로 거절한다', () => {
  const repo = template.copy();
  fs.mkdirSync(path.join(repo, CTX, 'epics/002-2024'), { recursive: true });
  fs.writeFileSync(path.join(repo, CTX, 'epics/002-2024/index.md'), '# x\n');
  commitAll(repo);
  assertConflict(repo);
});

test('등록부가 깨져 있으면 → S35로 거절하고 아무것도 바꾸지 않는다', () => {
  const repo = template.copy();
  fs.writeFileSync(path.join(repo, '.bouncer/epics.json'), '{}\n');
  commitAll(repo);
  const spy = instrument(repo);
  const result = migrateContextSlugs({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.equal(result.code, 'S35');
  assert.equal(spy.mvCount(), 0);
  assert.deepEqual(spy.writes, []);
});

test('등록부가 없으면 → migrate-registry-missing으로 거절한다', () => {
  const repo = template.copy();
  git(repo, 'rm', '-q', '.bouncer/epics.json');
  git(repo, 'commit', '-q', '-m', 'drop registry');
  const result = migrateContextSlugs({ repoRoot: repo, yes: true });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'migrate-registry-missing');
});

test('git mv가 중간에 실패하면 → ok:false와 되돌리는 명령을 next에 담는다', () => {
  const repo = template.copy();
  const spy = instrument(repo, { failOnMv: 2 });
  const result = migrateContextSlugs({ repoRoot: repo, yes: true, deps: spy.deps });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'migrate-failed');
  assert.equal(result.next, RESTORE);
  assert.match(result.message, /simulated git mv failure/);
});

test('migrate context-slugs CLI → 기본은 dry-run이고 --yes에서 이관하며 알 수 없는 옵션은 exit 2다', () => {
  const repo = template.copy();
  const run = (argv) => {
    const out = [];
    const err = [];
    const code = runCli(argv, { out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join(''), err: err.join('') };
  };
  const dry = run(['migrate', 'context-slugs', '--repo', repo]);
  assert.equal(dry.code, 0);
  assert.equal(JSON.parse(dry.out).dryRun, true);
  assert.equal(fs.existsSync(path.join(repo, LEGACY_EPIC)), true);
  assert.equal(run(['migrate', 'context-slugs', '--repo', repo, '--bogus']).code, 2);
  const yes = run(['migrate', 'context-slugs', '--repo', repo, '--yes']);
  assert.equal(yes.code, 0, yes.out + yes.err);
  assert.equal(JSON.parse(yes.out).ok, true);
  assert.equal(fs.existsSync(path.join(repo, RICH_NEW)), true);
  assert.equal(run(['migrate', 'context-slugs', '--repo', repo, '--yes']).code, 0);
});

test('이관한 저장소에서 새 blueprint를 만들고 승인해 커밋까지 → 모든 단계 키가 slug로 이어진다', () => {
  const repo = template.copy();
  const first = migrateContextSlugs({ repoRoot: repo, yes: true });
  assert.equal(first.ok, true, JSON.stringify(first));
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'migrated');
  const run = (argv) => {
    const out = [];
    const err = [];
    const code = runCli([...argv, '--repo', repo], { out: (s) => out.push(s), err: (s) => err.push(s) });
    return { code, out: out.join(''), err: err.join('') };
  };
  const epicDir = `${CTX}/epics/consumer-epic-registry`;
  const bp = `${epicDir}/blueprints/new-work`;
  const scaffolded = run([
    'scaffold', 'blueprint', '--epic-dir', epicDir, '--name', 'new-work', '--order', '4', '--complexity', 'low',
  ]);
  assert.equal(scaffolded.code, 0, scaffolded.err);
  assert.equal(data(repo, `${bp}/index.md`).bouncer.order, 4);

  // 새 light blueprint는 review_contract: brief 표식과 pending context-review.md로 만들어지고 plan approve는
  // accepted를 요구한다. 이 테스트의 관심사는 slug 키이므로 리뷰 절차 대신 status만 accepted로 맞춘다.
  patch(repo, `${bp}/context-review.md`, (d) => {
    d.bouncer.status = 'accepted';
  });
  const approved = run(['plan', 'approve', '--blueprint', bp]);
  assert.equal(approved.code, 0, approved.out + approved.err);
  // CLI의 `current --set`은 계획 gate까지 돌려 gate를 통과하는 완성 계획을 요구한다. 여기서 보려는 것은
  // 포인터 키이므로 같은 쓰기 함수를 직접 부른다.
  writeCurrent({ repoRoot: repo, blueprint: bp, base: 'main', task: `${bp}/tasks/001/tasks.md` });

  const pointerKey = runtimeState.pointerKeyFromBlueprint(bp).key;
  assert.equal(pointerKey, 'consumer-epic-registry/new-work');
  assert.deepEqual(runtimeState.listNamespacePointers({ repoRoot: repo }).map((e) => e.key), [pointerKey]);
  const branches = runtimeState.branchNamesFor({ repoRoot: repo, blueprint: bp, task: '001' });
  assert.equal(branches.integration, 'feat/consumer-epic-registry--new-work');
  assert.equal(branches.worker, 'bouncer/consumer-epic-registry--new-work--001');
  const coordinator = runtimeState.coordinatorPathsFor({ repoRoot: repo, blueprint: bp, task: '001' });
  const integrationTail = path.join('.worktrees', 'consumer-epic-registry', 'new-work', 'integration');
  assert.ok(coordinator.integrationPath.endsWith(integrationTail));

  const taskDoc = data(repo, `${bp}/tasks/001/tasks.md`).bouncer;
  const provenance = buildStableProvenance({
    epicId: taskDoc.epic_id, blueprintId: taskDoc.blueprint_id, taskId: taskDoc.id,
  });
  assert.equal(provenance.task, 'consumer-epic-registry/new-work/001');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'feat: new work', '-m', provenance.trailers.join('\n'));
  const found = resolveTaskCommits({
    repoRoot: repo,
    base: 'HEAD~1',
    head: 'HEAD',
    stableIds: [provenance.task],
    registry: readEpicRegistry(repo).registry,
  });
  assert.equal(found.get(provenance.task).sha, git(repo, 'rev-parse', 'HEAD').trim());
});
