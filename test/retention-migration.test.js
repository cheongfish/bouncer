'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');

const {
  auditRetention,
  migrateRetention,
} = require('../scripts/lib/retention-migration');

const EPIC = '090';
const BP_A = `.bouncer/context/epics/${EPIC}-retention-a/blueprints/001-alpha`;
const BP_B = `.bouncer/context/epics/${EPIC}-retention-b/blueprints/002-beta`;
const BP_C = `.bouncer/context/epics/${EPIC}-retention-c/blueprints/003-gamma`;
const BP_D = `.bouncer/context/epics/${EPIC}-retention-d/blueprints/004-delta`;
const BP_E = `.bouncer/context/epics/${EPIC}-retention-e/blueprints/005-epsilon`;

const EXPLAIN_BODY = `# Explain

## Background
Legacy closed blueprint without compacting.

## Intuition
Promote durable design then delete transients.

## Code
scripts/lib/retention-migration.js

## Quiz
What stays after retention apply?

## 이해 상태
pending
`;

const ELIGIBLE_TASK_BODY = `# Tasks

## Goal & intent
장기 intent 를 Explain 으로 승격한다.

## Current behavior
closed Blueprint 는 소급 정리 경로가 없다.

## Target behavior
감사 후 적격 단일 경로만 원자 적용한다.

## Interface
auditRetention 과 migrateRetention.

## Touch
- \`scripts/src/lib/retention-migration.ts\`

## Constraints
- task_commits 를 합성하지 않는다.

## Do not touch
- DO_NOT_TOUCH_MARKER

## Checklist
- [ ] CHECKLIST_MARKER
`;

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function hashTree(repoRoot) {
  const out = {};
  function walk(absDir, relBase) {
    for (const name of fs.readdirSync(absDir).sort()) {
      const abs = path.join(absDir, name);
      const rel = relBase ? `${relBase}/${name}` : name;
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs, rel);
      else {
        out[rel] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
      }
    }
  }
  const context = path.join(repoRoot, '.bouncer/context');
  if (fs.existsSync(context)) walk(context, '.bouncer/context');
  return out;
}

function writeClosedIndex(repo, bp, { epicId, blueprintId }) {
  writeDoc(repo, `${bp}/index.md`, {
    type: 'bouncer.blueprint',
    title: `BP ${blueprintId}`,
    description: 'fixture blueprint',
    resource: `${bp}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: blueprintId,
      epic_id: epicId,
      blueprint_id: blueprintId,
      status: 'closed',
      commit_type: 'feat',
      scale: 'full',
      supersedes: [],
    },
  }, `# BP ${blueprintId}\n`);
}

function writeExplain(repo, bp, { epicId, blueprintId, taskCommits }) {
  const bouncer = {
    id: `EXPLAIN-${blueprintId}`,
    epic_id: epicId,
    blueprint_id: blueprintId,
    status: 'published',
  };
  if (taskCommits !== undefined) bouncer.task_commits = taskCommits;
  writeDoc(repo, `${bp}/explain.md`, {
    type: 'bouncer.explain',
    title: `Explain ${blueprintId}`,
    description: 'fixture explain',
    resource: `${bp}/explain.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer,
  }, EXPLAIN_BODY);
}

function writeTaskBundle(repo, bp, {
  epicId,
  blueprintId,
  number = '001',
  taskBody = ELIGIBLE_TASK_BODY,
  taskId,
  taskEpicId,
  taskBlueprintId,
  commitSha = 'deadbeef',
}) {
  const id = taskId || `TASKS-${number}`;
  writeDoc(repo, `${bp}/tasks/${number}/tasks.md`, {
    type: 'bouncer.tasks',
    title: `Task ${number}`,
    description: 'fixture task',
    resource: `${bp}/tasks/${number}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id,
      epic_id: taskEpicId || epicId,
      blueprint_id: taskBlueprintId || blueprintId,
      status: 'done',
      execution_kind: 'commit',
      affected_paths: ['scripts/src/lib/retention-migration.ts'],
      commit_sha: commitSha,
      depends_on: [],
      parallel_safe: false,
      dependency_gate: 'integrated',
    },
  }, taskBody);
  writeDoc(repo, `${bp}/tasks/${number}/verification.md`, {
    type: 'bouncer.verification',
    title: `Verify ${number}`,
    description: 'fixture verify',
    resource: `${bp}/tasks/${number}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: `VERIFY-${number}`,
      epic_id: epicId,
      blueprint_id: blueprintId,
      status: 'passed',
    },
  }, '# Verification\n\n- ok\n');
  writeDoc(repo, `${bp}/tasks/${number}/review.md`, {
    type: 'bouncer.review',
    title: `Review ${number}`,
    description: 'fixture review',
    resource: `${bp}/tasks/${number}/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: `REVIEW-${number}`,
      epic_id: epicId,
      blueprint_id: blueprintId,
      status: 'approved',
    },
  }, '# Review\n\n- ok\n');
}

function writeContextReview(repo, bp, { epicId, blueprintId }) {
  writeDoc(repo, `${bp}/context-review.md`, {
    type: 'bouncer.context_review',
    title: 'Context review',
    description: 'fixture context-review',
    resource: `${bp}/context-review.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: `CONTEXT-REVIEW-${blueprintId}`,
      epic_id: epicId,
      blueprint_id: blueprintId,
      status: 'passed',
    },
  }, '# Context review\n');
}

function byBlueprint(results) {
  const map = new Map(results.map((row) => [row.blueprint, row]));
  return map;
}

test('auditRetention classifies five closed statuses in path order', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-'));

  // eligible — explain + valid task intent + all four transient leaf kinds
  writeClosedIndex(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeExplain(repo, BP_A, {
    epicId: EPIC,
    blueprintId: '001',
    taskCommits: [{ task: `EPIC-${EPIC}/BP-001/TASK-001`, sha: 'aabbccdd', intent_anchor: 'task-001' }],
  });
  writeTaskBundle(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeContextReview(repo, BP_A, { epicId: EPIC, blueprintId: '001' });

  // blocked-missing-explain — compacted but no explain (priority over already-compacted)
  writeClosedIndex(repo, BP_B, { epicId: EPIC, blueprintId: '002' });

  // blocked-invalid-task — parent id mismatch
  writeClosedIndex(repo, BP_C, { epicId: EPIC, blueprintId: '003' });
  writeExplain(repo, BP_C, { epicId: EPIC, blueprintId: '003' });
  writeTaskBundle(repo, BP_C, {
    epicId: EPIC,
    blueprintId: '003',
    taskEpicId: '001',
    taskBlueprintId: '003',
  });

  // blocked-insufficient-intent — parseable but no durable sections
  writeClosedIndex(repo, BP_D, { epicId: EPIC, blueprintId: '004' });
  writeExplain(repo, BP_D, { epicId: EPIC, blueprintId: '004' });
  writeTaskBundle(repo, BP_D, {
    epicId: EPIC,
    blueprintId: '004',
    taskBody: `# Tasks

## Do not touch
- only execution scope

## Checklist
- [ ] nothing durable
`,
  });

  // already-compacted — explain present, no transients
  writeClosedIndex(repo, BP_E, { epicId: EPIC, blueprintId: '005' });
  writeExplain(repo, BP_E, { epicId: EPIC, blueprintId: '005' });

  const audited = auditRetention({ repoRoot: repo });
  assert.strictEqual(audited.ok, true);
  assert.deepStrictEqual(
    audited.results.map((row) => row.blueprint),
    [BP_A, BP_B, BP_C, BP_D, BP_E],
  );

  const map = byBlueprint(audited.results);
  for (const row of audited.results) {
    assert.ok(Object.prototype.hasOwnProperty.call(row, 'status'));
    assert.ok(Object.prototype.hasOwnProperty.call(row, 'reason'));
    assert.ok(Array.isArray(row.promote));
    assert.ok(Array.isArray(row.delete));
  }

  assert.strictEqual(map.get(BP_A).status, 'eligible');
  assert.deepStrictEqual(map.get(BP_A).promote, [`${BP_A}/explain.md`]);
  assert.deepStrictEqual(map.get(BP_A).delete.sort(), [
    `${BP_A}/context-review.md`,
    `${BP_A}/tasks/001/review.md`,
    `${BP_A}/tasks/001/tasks.md`,
    `${BP_A}/tasks/001/verification.md`,
  ].sort());

  assert.strictEqual(map.get(BP_B).status, 'blocked-missing-explain');
  assert.strictEqual(map.get(BP_C).status, 'blocked-invalid-task');
  assert.strictEqual(map.get(BP_D).status, 'blocked-insufficient-intent');
  assert.strictEqual(map.get(BP_E).status, 'already-compacted');
});

test('auditRetention dry-run does not change any file bytes', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-'));
  writeClosedIndex(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeExplain(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeTaskBundle(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeContextReview(repo, BP_A, { epicId: EPIC, blueprintId: '001' });

  const before = hashTree(repo);
  const audited = auditRetention({ repoRoot: repo });
  assert.strictEqual(audited.ok, true);
  assert.strictEqual(audited.results[0].status, 'eligible');
  assert.deepStrictEqual(hashTree(repo), before);
});

test('migrateRetention promotes Explain then deletes all four transient leaves', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-'));
  const existingCommits = [
    { task: `EPIC-${EPIC}/BP-001/TASK-001`, sha: 'aabbccdd', intent_anchor: 'task-001' },
  ];
  writeClosedIndex(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeExplain(repo, BP_A, {
    epicId: EPIC,
    blueprintId: '001',
    taskCommits: existingCommits,
  });
  writeTaskBundle(repo, BP_A, {
    epicId: EPIC,
    blueprintId: '001',
    commitSha: 'badsha!!',
  });
  writeContextReview(repo, BP_A, { epicId: EPIC, blueprintId: '001' });

  const explainBefore = fs.readFileSync(path.join(repo, `${BP_A}/explain.md`), 'utf8');
  const applied = migrateRetention({ repoRoot: repo, blueprintDir: BP_A });
  assert.strictEqual(applied.ok, true, JSON.stringify(applied));
  assert.strictEqual(applied.status, 'eligible');

  const explainAfter = fs.readFileSync(path.join(repo, `${BP_A}/explain.md`), 'utf8');
  assert.match(explainAfter, /## Tasks/);
  assert.match(explainAfter, /장기 intent 를 Explain 으로 승격한다/);
  assert.match(explainAfter, /#### Interface/);
  assert.doesNotMatch(explainAfter, /DO_NOT_TOUCH_MARKER/);
  assert.doesNotMatch(explainAfter, /CHECKLIST_MARKER/);

  for (const leaf of [
    `${BP_A}/tasks/001/tasks.md`,
    `${BP_A}/tasks/001/verification.md`,
    `${BP_A}/tasks/001/review.md`,
    `${BP_A}/context-review.md`,
  ]) {
    assert.equal(fs.existsSync(path.join(repo, leaf)), false, leaf);
  }
  assert.equal(fs.existsSync(path.join(repo, `${BP_A}/index.md`)), true);

  // 기존 task_commits 바이트 동등 — 잘못된 commit_sha 를 합성하지 않는다.
  const { parseFrontmatter } = require('../scripts/lib/frontmatter');
  const { data } = parseFrontmatter(explainAfter);
  assert.deepStrictEqual(data.bouncer.task_commits, existingCommits);
  assert.notEqual(explainAfter, explainBefore);
});

test('migrateRetention rolls back Explain and deletes on failure', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-'));
  writeClosedIndex(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeExplain(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeTaskBundle(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeContextReview(repo, BP_A, { epicId: EPIC, blueprintId: '001' });

  const before = hashTree(repo);
  const applied = migrateRetention({
    repoRoot: repo,
    blueprintDir: BP_A,
    deps: {
      unlinkSync() {
        throw new Error('injected unlink failure');
      },
    },
  });
  assert.strictEqual(applied.ok, false);
  assert.deepStrictEqual(hashTree(repo), before);
  assert.match(
    fs.readFileSync(path.join(repo, `${BP_A}/explain.md`), 'utf8'),
    /## Background/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(repo, `${BP_A}/explain.md`), 'utf8'),
    /## Tasks/,
  );
});

test('migrateRetention rejects open, escaped, and non-eligible targets without writes', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-'));
  const openBp = `.bouncer/context/epics/${EPIC}-open/blueprints/001-open`;
  writeDoc(repo, `${openBp}/index.md`, {
    type: 'bouncer.blueprint',
    title: 'Open',
    description: 'open fixture',
    resource: `${openBp}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: '001',
      epic_id: EPIC,
      blueprint_id: '001',
      status: 'approved',
      commit_type: 'feat',
      scale: 'full',
      supersedes: [],
    },
  });
  writeExplain(repo, openBp, { epicId: EPIC, blueprintId: '001' });
  writeTaskBundle(repo, openBp, { epicId: EPIC, blueprintId: '001' });
  const before = hashTree(repo);

  assert.strictEqual(migrateRetention({
    repoRoot: repo,
    blueprintDir: openBp,
  }).ok, false);

  assert.strictEqual(migrateRetention({
    repoRoot: repo,
    blueprintDir: path.resolve(repo, BP_A),
  }).ok, false);

  assert.strictEqual(migrateRetention({
    repoRoot: repo,
    blueprintDir: `.bouncer/context/epics/${EPIC}-x/blueprints/../001-alpha`,
  }).ok, false);

  writeClosedIndex(repo, BP_D, { epicId: EPIC, blueprintId: '004' });
  writeExplain(repo, BP_D, { epicId: EPIC, blueprintId: '004' });
  writeTaskBundle(repo, BP_D, {
    epicId: EPIC,
    blueprintId: '004',
    taskBody: `# Tasks

## Checklist
- [ ] only checklist
`,
  });
  const beforeReject = hashTree(repo);
  assert.strictEqual(migrateRetention({
    repoRoot: repo,
    blueprintDir: BP_D,
  }).ok, false);
  assert.deepStrictEqual(hashTree(repo), beforeReject);

  // open 대상 거절도 쓰기 없음 — 위에서 open 호출 직후 해시를 고정하지 않았으므로
  // leaf 존재를 직접 본다.
  void before;
  assert.equal(fs.existsSync(path.join(repo, `${openBp}/tasks/001/tasks.md`)), true);
  assert.equal(fs.existsSync(path.join(repo, `${BP_D}/tasks/001/tasks.md`)), true);
});

test('migrateRetention rejects symlink blueprint dir or explain.md that escape repoRoot', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-symlink-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-outside-'));

  // Blueprint 디렉터리 자체가 저장소 밖을 가리키는 symlink면 lexical 경로는
  // 정본처럼 보여도 realpath 탈출로 거절해야 한다.
  const outsideBp = path.join(outside, '001-alpha');
  writeClosedIndex(outside, '001-alpha', { epicId: EPIC, blueprintId: '001' });
  writeExplain(outside, '001-alpha', { epicId: EPIC, blueprintId: '001' });
  writeTaskBundle(outside, '001-alpha', { epicId: EPIC, blueprintId: '001' });
  writeContextReview(outside, '001-alpha', { epicId: EPIC, blueprintId: '001' });

  const linkParent = path.join(repo, path.dirname(BP_A));
  fs.mkdirSync(linkParent, { recursive: true });
  fs.symlinkSync(outsideBp, path.join(repo, BP_A));

  const escapedDir = migrateRetention({ repoRoot: repo, blueprintDir: BP_A });
  assert.strictEqual(escapedDir.ok, false);
  assert.strictEqual(escapedDir.code, 'INVALID_PATH');
  assert.equal(fs.existsSync(path.join(outsideBp, 'tasks/001/tasks.md')), true);

  // explain.md 만 저장소 밖 파일로 연결된 경우 — 승격 쓰기가 밖으로 나가면 안 된다.
  const repo2 = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-symlink2-'));
  writeClosedIndex(repo2, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeTaskBundle(repo2, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeContextReview(repo2, BP_A, { epicId: EPIC, blueprintId: '001' });
  const outsideExplain = path.join(outside, 'leaked-explain.md');
  writeDoc(outside, 'leaked-explain.md', {
    type: 'bouncer.explain',
    title: 'Explain 001',
    description: 'leaked',
    resource: 'leaked-explain.md',
    tags: ['bouncer'],
    timestamp: '2026-09-17T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001',
      epic_id: EPIC,
      blueprint_id: '001',
      status: 'published',
    },
  }, EXPLAIN_BODY);
  fs.symlinkSync(outsideExplain, path.join(repo2, `${BP_A}/explain.md`));

  const beforeOutside = fs.readFileSync(outsideExplain);
  const escapedExplain = migrateRetention({ repoRoot: repo2, blueprintDir: BP_A });
  assert.strictEqual(escapedExplain.ok, false);
  assert.strictEqual(escapedExplain.code, 'INVALID_PATH');
  assert.deepStrictEqual(fs.readFileSync(outsideExplain), beforeOutside);
});

test('migrateRetention promotes before any transient delete (order lock)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-order-'));
  writeClosedIndex(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeExplain(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeTaskBundle(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeContextReview(repo, BP_A, { epicId: EPIC, blueprintId: '001' });

  const order = [];
  const applied = migrateRetention({
    repoRoot: repo,
    blueprintDir: BP_A,
    deps: {
      unlinkSync(abs) {
        // 삭제 시점 Explain에 ## Tasks 가 없으면 promote-then-delete 가 깨진 것이다.
        const explain = fs.readFileSync(path.join(repo, `${BP_A}/explain.md`), 'utf8');
        assert.match(explain, /## Tasks/);
        assert.match(explain, /장기 intent 를 Explain 으로 승격한다/);
        order.push(`unlink:${path.relative(repo, abs)}`);
        fs.unlinkSync(abs);
      },
    },
  });
  assert.strictEqual(applied.ok, true, JSON.stringify(applied));
  assert.ok(order.length >= 4, `expected deletes, got ${JSON.stringify(order)}`);
  assert.ok(order.every((entry) => entry.startsWith('unlink:')));
});

test('migrateRetention returns ok:false when restoreSnapshots throws after apply failure', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-retention-restore-'));
  writeClosedIndex(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeExplain(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeTaskBundle(repo, BP_A, { epicId: EPIC, blueprintId: '001' });
  writeContextReview(repo, BP_A, { epicId: EPIC, blueprintId: '001' });

  const applied = migrateRetention({
    repoRoot: repo,
    blueprintDir: BP_A,
    deps: {
      unlinkSync() {
        throw new Error('injected unlink failure');
      },
      writeFileSync() {
        throw new Error('injected restore failure');
      },
    },
  });
  assert.strictEqual(applied.ok, false);
  assert.strictEqual(applied.code, 'APPLY_FAILED');
  assert.match(applied.reason, /injected unlink failure/);
  assert.match(applied.reason, /restore also failed|injected restore failure/);
});
