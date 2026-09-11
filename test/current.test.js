'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { execFileSync } = require('node:child_process');
const {
  readCurrent, writeCurrent, clearCurrent, listReadyBlueprints, nextBlueprint,
  resolveCurrent, CurrentSelectionError,
} = require('../scripts/lib/current');
const { init } = require('../scripts/lib/init');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-current-'));
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writeBp(repo, {
  epicSlug, bpSlug, epicId, bpId, bpStatus, tasksStatus,
  affectedPaths = [], epicBody,
}) {
  const epicDir = `.bouncer/context/epics/${epicSlug}`;
  const bpDir = `${epicDir}/blueprints/${bpSlug}`;
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'e', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: epicId, epic_id: epicId, status: 'approved' },
  }, epicBody);
  writeDoc(repo, `${bpDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${bpDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: bpId, epic_id: epicId, blueprint_id: bpId, status: bpStatus,
    },
  });
  writeDoc(repo, `${bpDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${bpDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: epicId, blueprint_id: bpId, status: tasksStatus,
      affected_paths: affectedPaths,
    },
  });
  return bpDir;
}

function tmpGitRepo() {
  const repo = tmpRepo();
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  return repo;
}

function runtimeDeps(repo) {
  return {
    execFileSync,
    env: { ...process.env, XDG_STATE_HOME: path.join(repo, 'state') },
    platform: 'linux',
  };
}

test('readCurrent returns null when absent', () => {
  const repo = tmpRepo();
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('writeCurrent then readCurrent round-trips', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const rel = writeCurrent({
    repoRoot: repo,
    blueprint: '.bouncer/context/epics/001-x/blueprints/001-y',
    base: 'develop',
    deps,
  });
  const commonGitDir = path.join(repo, '.git');
  assert.strictEqual(rel, path.join(commonGitDir, 'bouncer', 'pointers', '001', '001.json'));
  assert.ok(fs.existsSync(rel));
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer', 'current')), false);
  assert.strictEqual(fs.existsSync(path.join(commonGitDir, 'bouncer', 'current')), false);
  assert.deepStrictEqual(readCurrent({ repoRoot: repo, deps }), {
    blueprint: '.bouncer/context/epics/001-x/blueprints/001-y',
    base: 'develop',
    task: null,
  });
});

test('writeCurrent normalizes backslashes to POSIX', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  writeCurrent({
    repoRoot: repo, blueprint: '.bouncer\\context\\epics\\001-x\\blueprints\\001-y', base: 'main', deps,
  });
  assert.strictEqual(
    readCurrent({ repoRoot: repo, deps }).blueprint,
    '.bouncer/context/epics/001-x/blueprints/001-y',
  );
});

test('readCurrent returns null when the pointer file is corrupt JSON', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const abs = path.join(repo, '.git', 'bouncer', 'current');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '{ this is not json');
  assert.strictEqual(readCurrent({ repoRoot: repo, deps }), null);
});

test('writeCurrent rejects a non-Git repository', () => {
  const repo = tmpRepo();
  assert.throws(
    () => writeCurrent({ repoRoot: repo, blueprint: 'bp', base: 'main' }),
    /Bouncer requires a Git repository for an active blueprint/,
  );
});

test('legacy .sdd/current is ignored and init rejects with bouncer-init guidance', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.sdd'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.sdd/current'), '{"blueprint":"legacy"}\n');
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
  const result = init({ repoRoot: repo, timestamp: '2026-07-24T00:00:00.000Z' });
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /bouncer-init/);
});

// P3 dogfooding: finalize left the pointer in place, so every commit after a
// finished cycle was blocked against that blueprint's affected_paths.
test('clearCurrent removes the active pointer and is safe to repeat', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-clear-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  const deps = {
    execFileSync,
    env: { ...process.env, XDG_STATE_HOME: path.join(root, 'state') },
    platform: 'linux',
  };
  writeCurrent({
    repoRoot: root,
    blueprint: '.bouncer/context/epics/001-x/blueprints/001-y',
    base: 'develop',
    deps,
  });
  assert.ok(readCurrent({ repoRoot: root, deps }));

  assert.strictEqual(clearCurrent({ repoRoot: root, deps }), true);
  assert.strictEqual(readCurrent({ repoRoot: root, deps }), null);
  assert.strictEqual(clearCurrent({ repoRoot: root, deps }), false);
});

test('listReadyBlueprints includes approved + ready / in_progress only', () => {
  const repo = tmpRepo();
  const ready = writeBp(repo, {
    epicSlug: '001-a', bpSlug: '001-ready', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const inProg = writeBp(repo, {
    epicSlug: '001-a', bpSlug: '002-wip', epicId: '001', bpId: '002',
    bpStatus: 'approved', tasksStatus: 'in_progress',
  });
  writeBp(repo, {
    epicSlug: '001-a', bpSlug: '003-done', epicId: '001', bpId: '003',
    bpStatus: 'approved', tasksStatus: 'verified',
  });
  writeBp(repo, {
    epicSlug: '001-a', bpSlug: '004-draft', epicId: '001', bpId: '004',
    bpStatus: 'draft', tasksStatus: 'ready',
  });

  const list = listReadyBlueprints({ repoRoot: repo });
  assert.deepStrictEqual(list, [
    {
      blueprint: inProg,
      status: 'in_progress',
      tasks: [{ id: 'TASKS-001', path: `${inProg}/tasks/001/tasks.md`, status: 'in_progress' }],
    },
    {
      blueprint: ready,
      status: 'ready',
      tasks: [{ id: 'TASKS-001', path: `${ready}/tasks/001/tasks.md`, status: 'ready' }],
    },
  ].sort((a, b) => a.blueprint.localeCompare(b.blueprint)));
});

test('listReadyBlueprints excludes a closed blueprint (finalize --yes lock)', () => {
  // 회귀 고정: closed는 approved 필터를 그냥 안 타는 값일 뿐이라 오늘도 통과하지만,
  // 001의 finalize 잠금 도입 이후에도 계속 빠져야 한다는 계약을 테스트로 못박는다.
  const repo = tmpRepo();
  writeBp(repo, {
    epicSlug: '001-a', bpSlug: '001-closed', epicId: '001', bpId: '001',
    bpStatus: 'closed', tasksStatus: 'ready',
  });
  const list = listReadyBlueprints({ repoRoot: repo });
  assert.deepStrictEqual(list, []);
});

test('listReadyBlueprints excludes partial_closed as an unresolved terminal state', () => {
  const repo = tmpRepo();
  writeBp(repo, {
    epicSlug: '001-a', bpSlug: '001-partial', epicId: '001', bpId: '001',
    bpStatus: 'partial_closed', tasksStatus: 'ready',
  });
  assert.deepStrictEqual(listReadyBlueprints({ repoRoot: repo }), []);
});

test('listReadyBlueprints excludes an imported blueprint', () => {
  // imported도 approved가 아니므로 별도 분기 없이 빠져야 한다.
  // current.ts에 status 분기를 넣지 않는 계약의 회귀 고정.
  const repo = tmpRepo();
  writeBp(repo, {
    epicSlug: '001-a', bpSlug: '001-imported', epicId: '001', bpId: '001',
    bpStatus: 'imported', tasksStatus: 'ready',
  });
  const list = listReadyBlueprints({ repoRoot: repo });
  assert.deepStrictEqual(list, []);
});

test('listReadyBlueprints sorts across epics and skips broken docs', () => {
  const repo = tmpRepo();
  const later = writeBp(repo, {
    epicSlug: '002-z', bpSlug: '001-z', epicId: '002', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const earlier = writeBp(repo, {
    epicSlug: '001-a', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  // Corrupt frontmatter: skip this blueprint, keep enumerating the rest.
  const brokenDir = '.bouncer/context/epics/001-a/blueprints/099-broken';
  fs.mkdirSync(path.join(repo, brokenDir), { recursive: true });
  fs.writeFileSync(path.join(repo, brokenDir, 'index.md'), 'not frontmatter\n');
  fs.mkdirSync(path.join(repo, brokenDir, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, brokenDir, 'tasks/001/tasks.md'), 'not frontmatter\n');

  const list = listReadyBlueprints({ repoRoot: repo });
  assert.deepStrictEqual(list, [
    {
      blueprint: earlier,
      status: 'ready',
      tasks: [{ id: 'TASKS-001', path: `${earlier}/tasks/001/tasks.md`, status: 'ready' }],
    },
    {
      blueprint: later,
      status: 'ready',
      tasks: [{ id: 'TASKS-001', path: `${later}/tasks/001/tasks.md`, status: 'ready' }],
    },
  ]);
});

test('nextBlueprint prefers same-epic candidates in ## Blueprints order', () => {
  const repo = tmpRepo();
  const epicBody = [
    '# Epic',
    '',
    '## Blueprints',
    '',
    '* [a](blueprints/001-a/index.md) - first',
    '* [b](blueprints/002-b/index.md) - second',
    '* [c](blueprints/003-c/index.md) - third',
    '',
  ].join('\n');
  const finalized = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready', epicBody,
  });
  writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '002-b', epicId: '001', bpId: '002',
    bpStatus: 'approved', tasksStatus: 'ready', epicBody,
  });
  writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '003-c', epicId: '001', bpId: '003',
    bpStatus: 'approved', tasksStatus: 'ready', epicBody,
  });
  // Other epic — lexicographically earlier epic dir, but same-epic wins.
  writeBp(repo, {
    epicSlug: 'A-other', bpSlug: '001-x', epicId: '099', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  // 같은 에픽 우선 + ## Blueprints 순서를 따른다
  assert.strictEqual(res.next.blueprint, '.bouncer/context/epics/E-1/blueprints/002-b');
  assert.strictEqual(res.next.sameEpic, true);
  // 마감 대상 자신은 후보가 아니다
  assert.ok(!res.remaining.some((r) => r.blueprint === finalized));
});

test('nextBlueprint returns null when no candidates remain', () => {
  const repo = tmpRepo();
  const only = writeBp(repo, {
    epicSlug: 'E-solo', bpSlug: '001-only', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  // 후보 없음은 null
  assert.deepStrictEqual(nextBlueprint({ repoRoot: repo, blueprintDir: only }), {
    next: null,
    remaining: [],
    sameEpicPending: [],
  });
});

test('nextBlueprint excludes a closed blueprint from candidates', () => {
  const repo = tmpRepo();
  const epicBody = [
    '# Epic',
    '',
    '## Blueprints',
    '',
    '* [a](blueprints/001-a/index.md) - first',
    '* [b](blueprints/002-b/index.md) - second',
    '',
  ].join('\n');
  const finalized = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready', epicBody,
  });
  writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '002-b', epicId: '001', bpId: '002',
    // 002가 이미 finalize --yes로 잠긴 상태 — next 후보에 나오면 안 된다.
    bpStatus: 'closed', tasksStatus: 'ready', epicBody,
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  assert.deepStrictEqual(res, { next: null, remaining: [], sameEpicPending: [] });
});

test('nextBlueprint excludes a partial_closed sibling from candidates and history handoff', () => {
  const repo = tmpRepo();
  const epicBody = '# Epic\n\n## Blueprints\n\n* [a](blueprints/001-a/index.md) - first\n* [b](blueprints/002-b/index.md) - second\n';
  const active = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready', epicBody,
  });
  writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '002-b', epicId: '001', bpId: '002',
    bpStatus: 'partial_closed', tasksStatus: 'ready', epicBody,
  });
  assert.deepStrictEqual(nextBlueprint({ repoRoot: repo, blueprintDir: active }), {
    next: null, remaining: [], sameEpicPending: [],
  });
});

test('nextBlueprint sameEpicPending includes a draft sibling when no ready candidates remain', () => {
  const repo = tmpRepo();
  const finalized = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const draft = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '002-b', epicId: '001', bpId: '002',
    bpStatus: 'draft', tasksStatus: 'ready',
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  assert.strictEqual(res.next, null);
  assert.deepStrictEqual(res.sameEpicPending, [{
    blueprint: draft,
    blueprintStatus: 'draft',
    ready: false,
  }]);
});

test('nextBlueprint sameEpicPending excludes closed siblings, other epics, and self', () => {
  const repo = tmpRepo();
  const finalized = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '002-closed', epicId: '001', bpId: '002',
    bpStatus: 'closed', tasksStatus: 'ready',
  });
  writeBp(repo, {
    epicSlug: 'E-other', bpSlug: '001-x', epicId: '099', bpId: '001',
    bpStatus: 'draft', tasksStatus: 'ready',
  });
  const draft = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '003-draft', epicId: '001', bpId: '003',
    bpStatus: 'draft', tasksStatus: 'ready',
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  assert.deepStrictEqual(res.sameEpicPending.map((e) => e.blueprint), [draft]);
  assert.ok(!res.sameEpicPending.some((e) => e.blueprint === finalized));
  assert.ok(!res.sameEpicPending.some((e) => e.blueprintStatus === 'closed'));
  assert.ok(!res.sameEpicPending.some((e) => e.blueprint.includes('E-other')));
});

test('nextBlueprint sameEpicPending coexists with a ready next candidate and sorts by path', () => {
  const repo = tmpRepo();
  const finalized = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const readySibling = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '002-b', epicId: '001', bpId: '002',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const draftSibling = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '003-c', epicId: '001', bpId: '003',
    bpStatus: 'draft', tasksStatus: 'ready',
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  assert.strictEqual(res.next.blueprint, readySibling);
  assert.deepStrictEqual(res.sameEpicPending, [
    { blueprint: readySibling, blueprintStatus: 'approved', ready: true },
    { blueprint: draftSibling, blueprintStatus: 'draft', ready: false },
  ]);
});

test('nextBlueprint sameEpicPending marks approved-but-verified siblings ready:false', () => {
  const repo = tmpRepo();
  const finalized = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const verified = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '002-b', epicId: '001', bpId: '002',
    bpStatus: 'approved', tasksStatus: 'verified',
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  assert.strictEqual(res.next, null);
  assert.deepStrictEqual(res.sameEpicPending, [{
    blueprint: verified,
    blueprintStatus: 'approved',
    ready: false,
  }]);
});

test('nextBlueprint sameEpicPending skips broken siblings without throwing', () => {
  const repo = tmpRepo();
  const finalized = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
  });
  const draft = writeBp(repo, {
    epicSlug: 'E-1', bpSlug: '004-ok', epicId: '001', bpId: '004',
    bpStatus: 'draft', tasksStatus: 'ready',
  });
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/E-1/blueprints/002-missing'), { recursive: true });
  const brokenDir = path.join(repo, '.bouncer/context/epics/E-1/blueprints/003-broken');
  fs.mkdirSync(brokenDir, { recursive: true });
  fs.writeFileSync(path.join(brokenDir, 'index.md'), 'this is not parseable frontmatter\n');

  assert.doesNotThrow(() => nextBlueprint({ repoRoot: repo, blueprintDir: finalized }));
  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  assert.deepStrictEqual(res.sameEpicPending, [{
    blueprint: draft,
    blueprintStatus: 'draft',
    ready: false,
  }]);
});

test('nextBlueprint sharedPaths is the affected_paths intersection in candidate order', () => {
  const repo = tmpRepo();
  const finalized = writeBp(repo, {
    epicSlug: 'E-share', bpSlug: '001-a', epicId: '001', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
    affectedPaths: [
      'scripts/src/lib/session-graph.ts',
      'scripts/src/lib/cli.ts',
    ],
  });
  writeBp(repo, {
    epicSlug: 'E-share', bpSlug: '002-b', epicId: '001', bpId: '002',
    bpStatus: 'approved', tasksStatus: 'ready',
    affectedPaths: [
      'scripts/src/lib/other.ts',
      'scripts/src/lib/session-graph.ts',
      'docs/workflow.md',
    ],
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  // affected_paths 교집합이 sharedPaths로
  assert.deepStrictEqual(res.next.sharedPaths, ['scripts/src/lib/session-graph.ts']);
});

test('listReadyBlueprints: any numbered task ready/in_progress counts', () => {
  const repo = tmpRepo();
  const epicDir = '.bouncer/context/epics/001-multi';
  const bpDir = `${epicDir}/blueprints/001-m`;
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'e', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${bpDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${bpDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
    },
  });
  writeDoc(repo, `${bpDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't1', description: 'd', resource: `${bpDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'draft',
      affected_paths: ['a.js'],
    },
  });
  writeDoc(repo, `${bpDir}/tasks/002/tasks.md`, {
    type: 'bouncer.tasks', title: 't2', description: 'd', resource: `${bpDir}/tasks/002/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-002', epic_id: '001', blueprint_id: '001', status: 'in_progress',
      affected_paths: ['b.js'],
    },
  });
  const list = listReadyBlueprints({ repoRoot: repo });
  assert.deepStrictEqual(list, [{
    blueprint: bpDir,
    status: 'in_progress',
    tasks: [{ id: 'TASKS-002', path: `${bpDir}/tasks/002/tasks.md`, status: 'in_progress' }],
  }]);
});

test('resolvePointerTask auto-selects first ready/in_progress by number order', () => {
  const { resolvePointerTask } = require('../scripts/lib/current');
  const repo = tmpRepo();
  const epicDir = '.bouncer/context/epics/001-pick';
  const bpDir = `${epicDir}/blueprints/001-p`;
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'e', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${bpDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${bpDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
    },
  });
  writeDoc(repo, `${bpDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't1', description: 'd', resource: `${bpDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      affected_paths: ['a.js'],
    },
  });
  writeDoc(repo, `${bpDir}/tasks/002/tasks.md`, {
    type: 'bouncer.tasks', title: 't2', description: 'd', resource: `${bpDir}/tasks/002/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-002', epic_id: '001', blueprint_id: '001', status: 'ready',
      affected_paths: ['b.js'],
    },
  });
  writeDoc(repo, `${bpDir}/tasks/003/tasks.md`, {
    type: 'bouncer.tasks', title: 't3', description: 'd', resource: `${bpDir}/tasks/003/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-003', epic_id: '001', blueprint_id: '001', status: 'in_progress',
      affected_paths: ['c.js'],
    },
  });

  const auto = resolvePointerTask({ repoRoot: repo, blueprintDir: bpDir });
  assert.deepStrictEqual(auto, {
    ok: true,
    task: `${bpDir}/tasks/002/tasks.md`,
    id: 'TASKS-002',
  });
});

test('resolvePointerTask fails when --task does not match a document', () => {
  const { resolvePointerTask } = require('../scripts/lib/current');
  const repo = tmpRepo();
  const epicDir = '.bouncer/context/epics/001-miss';
  const bpDir = `${epicDir}/blueprints/001-m`;
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'e', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${bpDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${bpDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved',
    },
  });
  writeDoc(repo, `${bpDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't1', description: 'd', resource: `${bpDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      affected_paths: ['a.js'],
    },
  });

  const missing = resolvePointerTask({
    repoRoot: repo, blueprintDir: bpDir, task: '002',
  });
  assert.strictEqual(missing.ok, false);
  assert.ok(Array.isArray(missing.available));
  assert.deepStrictEqual(missing.available.map((t) => t.id), ['TASKS-001']);

  const badForm = resolvePointerTask({
    repoRoot: repo, blueprintDir: bpDir, task: 'TASK-001',
  });
  assert.strictEqual(badForm.ok, false);
});

test('writeCurrent persists an explicit task path', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  const task = `${blueprint}/tasks/002/tasks.md`;
  writeCurrent({
    repoRoot: repo, blueprint, base: 'develop', task, deps,
  });
  assert.deepStrictEqual(readCurrent({ repoRoot: repo, deps }), {
    blueprint, base: 'develop', task,
  });
});

test('nextBlueprint sharedPaths unions affected_paths across numbered tasks', () => {
  const repo = tmpRepo();
  const epicSlug = 'E-union';
  const epicDir = `.bouncer/context/epics/${epicSlug}`;
  const finalized = `${epicDir}/blueprints/001-a`;
  const candidate = `${epicDir}/blueprints/002-b`;
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'e', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  for (const [bpDir, bpId] of [
    [finalized, '001'],
    [candidate, '002'],
  ]) {
    writeDoc(repo, `${bpDir}/index.md`, {
      type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${bpDir}/index.md`,
      tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: bpId, epic_id: '001', blueprint_id: bpId, status: 'approved',
      },
    });
  }
  // finalized: 두 task 문서의 합집합
  writeDoc(repo, `${finalized}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${finalized}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      affected_paths: ['shared/a.js'],
    },
  });
  writeDoc(repo, `${finalized}/tasks/002/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${finalized}/tasks/002/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-002', epic_id: '001', blueprint_id: '001', status: 'verified',
      affected_paths: ['shared/b.js'],
    },
  });
  writeDoc(repo, `${candidate}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${candidate}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '002', status: 'ready',
      affected_paths: ['shared/b.js', 'other.js'],
    },
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: finalized });
  assert.deepStrictEqual(res.next.sharedPaths, ['shared/b.js']);
});

const BP_A = '.bouncer/context/epics/001-x/blueprints/001-y';
const BP_B = '.bouncer/context/epics/002-z/blueprints/003-w';
const BP_C = '.bouncer/context/epics/003-q/blueprints/001-dup';

function gitCommit(repo, message) {
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', [
    '-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '-m', message,
  ], { cwd: repo });
}

function addWorktree(repo, rel) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  execFileSync('git', ['worktree', 'add', '--quiet', '--detach', abs], { cwd: repo });
  return abs;
}

function seedCommit(repo) {
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  gitCommit(repo, 'fixture');
}

function pointerBody(blueprint, base, task = null) {
  return { blueprint, base, task };
}

function nsFile(repo, epicId, bpId) {
  return path.join(repo, '.git', 'bouncer', 'pointers', epicId, `${bpId}.json`);
}

function legacyFile(repo) {
  return path.join(repo, '.git', 'bouncer', 'current');
}

function writeNsFile(repo, blueprint, base, task) {
  const { parsePathIds } = require('../scripts/lib/paths');
  const { epicId, blueprintId } = parsePathIds(blueprint);
  const abs = nsFile(repo, epicId, blueprintId);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const data = { blueprint, base };
  if (typeof task === 'string') data.task = task;
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`);
  return abs;
}

test('resolveCurrent selects the nested worktree key and ignores sibling pointers', () => {
  const repo = tmpGitRepo();
  seedCommit(repo);
  const nestedA = addWorktree(repo, '.worktrees/001/001');
  addWorktree(repo, '.worktrees/002/003');
  const deps = runtimeDeps(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_A, base: 'develop', deps });
  writeCurrent({ repoRoot: repo, blueprint: BP_B, base: 'main', task: `${BP_B}/tasks/001/tasks.md`, deps });

  const selected = resolveCurrent({ repoRoot: nestedA, deps });
  assert.strictEqual(selected.status, 'selected');
  assert.strictEqual(selected.source, 'namespace');
  assert.strictEqual(selected.key, '001/001');
  assert.deepStrictEqual(selected.current, pointerBody(BP_A, 'develop', null));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(selected.current, 'scale'), false);
  assert.strictEqual(typeof selected.current.task === 'string' || selected.current.task === null, true);

  assert.deepStrictEqual(readCurrent({ repoRoot: nestedA, deps }), pointerBody(BP_A, 'develop', null));
});

test('resolveCurrent selects a unique flat worktree candidate and rejects duplicates', () => {
  const repo = tmpGitRepo();
  seedCommit(repo);
  const flat = addWorktree(repo, '.worktrees/001');
  const deps = runtimeDeps(repo);
  writeNsFile(repo, BP_A, 'develop');
  const unique = resolveCurrent({ repoRoot: flat, deps });
  assert.strictEqual(unique.status, 'selected');
  assert.strictEqual(unique.source, 'namespace');
  assert.deepStrictEqual(unique.current, pointerBody(BP_A, 'develop', null));

  writeNsFile(repo, BP_C, 'main');
  const dup = resolveCurrent({ repoRoot: flat, deps });
  assert.strictEqual(dup.status, 'ambiguous');
  assert.deepStrictEqual(dup.candidates, [
    pointerBody(BP_A, 'develop', null),
    pointerBody(BP_C, 'main', null),
  ]);
  assert.throws(
    () => readCurrent({ repoRoot: flat, deps }),
    (err) => err instanceof CurrentSelectionError
      && err.code === 'CURRENT_AMBIGUOUS'
      && Array.isArray(err.candidates)
      && err.candidates.length === 2,
  );
});

test('resolveCurrent at the base checkout selects a single pointer and rejects many', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_A, base: 'develop', deps });
  const one = resolveCurrent({ repoRoot: repo, deps });
  assert.strictEqual(one.status, 'selected');
  assert.strictEqual(one.source, 'namespace');
  assert.strictEqual(one.key, '001/001');
  assert.deepStrictEqual(one.current, pointerBody(BP_A, 'develop', null));
  assert.deepStrictEqual(readCurrent({ repoRoot: repo, deps }), pointerBody(BP_A, 'develop', null));

  writeCurrent({ repoRoot: repo, blueprint: BP_B, base: 'main', deps });
  const many = resolveCurrent({ repoRoot: repo, deps });
  assert.strictEqual(many.status, 'ambiguous');
  assert.deepStrictEqual(many.candidates, [
    pointerBody(BP_A, 'develop', null),
    pointerBody(BP_B, 'main', null),
  ]);
  assert.throws(
    () => readCurrent({ repoRoot: repo, deps }),
    (err) => err instanceof CurrentSelectionError && err.code === 'CURRENT_AMBIGUOUS',
  );
});

test('resolveCurrent four variants and readCurrent wrapper contracts', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);

  const empty = resolveCurrent({ repoRoot: repo, deps });
  assert.deepStrictEqual(empty, { status: 'empty' });
  assert.strictEqual(readCurrent({ repoRoot: repo, deps }), null);

  writeCurrent({ repoRoot: repo, blueprint: BP_A, base: 'develop', task: `${BP_A}/tasks/001/tasks.md`, deps });
  const selected = resolveCurrent({ repoRoot: repo, deps });
  assert.strictEqual(selected.status, 'selected');
  assert.deepStrictEqual(selected.current, pointerBody(BP_A, 'develop', `${BP_A}/tasks/001/tasks.md`));
  assert.ok(selected.source === 'namespace' || selected.source === 'legacy');
  assert.ok(selected.key === '001/001' || selected.key === null);

  writeCurrent({ repoRoot: repo, blueprint: BP_B, base: 'main', deps });
  const ambiguous = resolveCurrent({ repoRoot: repo, deps });
  assert.strictEqual(ambiguous.status, 'ambiguous');
  assert.deepStrictEqual(ambiguous.candidates, [
    pointerBody(BP_A, 'develop', `${BP_A}/tasks/001/tasks.md`),
    pointerBody(BP_B, 'main', null),
  ]);
  try {
    readCurrent({ repoRoot: repo, deps });
    assert.fail('readCurrent should throw CURRENT_AMBIGUOUS');
  } catch (err) {
    assert.ok(err instanceof CurrentSelectionError);
    assert.strictEqual(err.code, 'CURRENT_AMBIGUOUS');
    assert.deepStrictEqual(err.candidates, ambiguous.candidates);
  }

  const broken = nsFile(repo, '009', '009');
  fs.mkdirSync(path.dirname(broken), { recursive: true });
  fs.writeFileSync(broken, '{ invalid');
  const invalid = resolveCurrent({ repoRoot: repo, deps });
  assert.strictEqual(invalid.status, 'invalid');
  assert.ok(invalid.issues.some((i) => i.path === broken && typeof i.reason === 'string'));
  assert.ok(Array.isArray(invalid.candidates));
  invalid.candidates.forEach((c) => {
    assert.strictEqual(typeof c.blueprint, 'string');
    assert.strictEqual(typeof c.base, 'string');
    assert.ok(c.task === null || typeof c.task === 'string');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(c, 'scale'), false);
  });
  try {
    readCurrent({ repoRoot: repo, deps });
    assert.fail('readCurrent should throw CURRENT_INVALID');
  } catch (err) {
    assert.ok(err instanceof CurrentSelectionError);
    assert.strictEqual(err.code, 'CURRENT_INVALID');
    assert.deepStrictEqual(err.issues, invalid.issues);
    assert.deepStrictEqual(err.candidates, invalid.candidates);
  }
});

test('legacy-only read, first write migrates, same-key is idempotent, different key conflicts', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const legacy = legacyFile(repo);
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, `${JSON.stringify({
    blueprint: BP_A, base: 'develop', task: `${BP_A}/tasks/001/tasks.md`,
  }, null, 2)}\n`);

  const fromLegacy = resolveCurrent({ repoRoot: repo, deps });
  assert.strictEqual(fromLegacy.status, 'selected');
  assert.strictEqual(fromLegacy.source, 'legacy');
  assert.strictEqual(fromLegacy.key, null);
  assert.deepStrictEqual(fromLegacy.current, pointerBody(BP_A, 'develop', `${BP_A}/tasks/001/tasks.md`));
  assert.deepStrictEqual(readCurrent({ repoRoot: repo, deps }), fromLegacy.current);

  const written = writeCurrent({
    repoRoot: repo, blueprint: BP_A, base: 'develop', task: `${BP_A}/tasks/002/tasks.md`, deps,
  });
  assert.strictEqual(written, nsFile(repo, '001', '001'));
  assert.strictEqual(fs.existsSync(legacy), false);
  assert.deepStrictEqual(readCurrent({ repoRoot: repo, deps }), pointerBody(
    BP_A, 'develop', `${BP_A}/tasks/002/tasks.md`,
  ));

  fs.writeFileSync(legacy, `${JSON.stringify({
    blueprint: BP_A, base: 'develop', task: `${BP_A}/tasks/002/tasks.md`,
  }, null, 2)}\n`);
  const again = writeCurrent({
    repoRoot: repo, blueprint: BP_A, base: 'main', deps,
  });
  assert.strictEqual(again, nsFile(repo, '001', '001'));
  assert.strictEqual(fs.existsSync(legacy), false);
  assert.deepStrictEqual(readCurrent({ repoRoot: repo, deps }), pointerBody(BP_A, 'main', null));

  fs.writeFileSync(legacy, `${JSON.stringify({ blueprint: BP_B, base: 'trunk' }, null, 2)}\n`);
  assert.throws(
    () => writeCurrent({ repoRoot: repo, blueprint: BP_A, base: 'main', deps }),
    (err) => err instanceof CurrentSelectionError && err.code === 'CURRENT_INVALID',
  );
  assert.ok(fs.existsSync(legacy));
  assert.ok(fs.existsSync(nsFile(repo, '001', '001')));
  const conflict = resolveCurrent({ repoRoot: repo, deps });
  assert.strictEqual(conflict.status, 'invalid');
});

test('writeCurrent preserves legacy when the namespace write fails', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const legacy = legacyFile(repo);
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  const body = { blueprint: BP_A, base: 'develop' };
  fs.writeFileSync(legacy, `${JSON.stringify(body, null, 2)}\n`);
  const before = fs.readFileSync(legacy);
  const boom = new Error('injected namespace write failure');
  assert.throws(() => writeCurrent({
    repoRoot: repo,
    blueprint: BP_A,
    base: 'main',
    deps: {
      ...deps,
      fs: {
        ...fs,
        writeFileSync() { throw boom; },
      },
    },
  }), boom);
  assert.deepStrictEqual(fs.readFileSync(legacy), before);
  assert.strictEqual(fs.existsSync(nsFile(repo, '001', '001')), false);
});

test('writeCurrent --replace deletes the selected key before writing the target', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_A, base: 'develop', deps });
  const oldKey = nsFile(repo, '001', '001');
  const newKey = nsFile(repo, '002', '003');
  const origRm = fs.rmSync;
  const gatedFs = {
    ...fs,
    rmSync(p, ...rest) {
      if (p === oldKey) {
        const err = new Error('injected replace unlink failure');
        err.code = 'EACCES';
        throw err;
      }
      return origRm.call(fs, p, ...rest);
    },
  };
  assert.throws(
    () => writeCurrent({
      repoRoot: repo,
      blueprint: BP_B,
      base: 'main',
      replace: true,
      replaceKey: '001/001',
      deps: { ...deps, fs: gatedFs },
    }),
    (err) => err instanceof CurrentSelectionError
      && err.code === 'CURRENT_INVALID'
      && Array.isArray(err.issues)
      && err.issues.some((i) => i.path === oldKey && typeof i.reason === 'string'),
  );
  assert.ok(fs.existsSync(oldKey));
  assert.strictEqual(fs.existsSync(newKey), false);
});

test('legacy delete failure is CURRENT_MIGRATION_INCOMPLETE and the next same write finishes', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const legacy = legacyFile(repo);
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, `${JSON.stringify({ blueprint: BP_A, base: 'develop' }, null, 2)}\n`);

  const origRm = fs.rmSync;
  let denyLegacy = true;
  const gatedFs = {
    ...fs,
    rmSync(p, ...rest) {
      if (denyLegacy && p === legacy) {
        const err = new Error('injected legacy unlink failure');
        err.code = 'EACCES';
        throw err;
      }
      return origRm.call(fs, p, ...rest);
    },
  };

  assert.throws(
    () => writeCurrent({
      repoRoot: repo, blueprint: BP_A, base: 'develop', deps: { ...deps, fs: gatedFs },
    }),
    (err) => err instanceof CurrentSelectionError && err.code === 'CURRENT_MIGRATION_INCOMPLETE',
  );
  assert.ok(fs.existsSync(legacy));
  assert.ok(fs.existsSync(nsFile(repo, '001', '001')));
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(legacy, 'utf8')),
    JSON.parse(fs.readFileSync(nsFile(repo, '001', '001'), 'utf8')),
  );

  denyLegacy = false;
  writeCurrent({
    repoRoot: repo, blueprint: BP_A, base: 'main', task: `${BP_A}/tasks/001/tasks.md`,
    deps: { ...deps, fs: gatedFs },
  });
  assert.strictEqual(fs.existsSync(legacy), false);
  assert.deepStrictEqual(
    readCurrent({ repoRoot: repo, deps }),
    pointerBody(BP_A, 'main', `${BP_A}/tasks/001/tasks.md`),
  );
});

test('clearCurrent on a nested worktree removes only that namespace key', () => {
  const repo = tmpGitRepo();
  seedCommit(repo);
  const nestedA = addWorktree(repo, '.worktrees/001/001');
  const deps = runtimeDeps(repo);
  writeCurrent({ repoRoot: repo, blueprint: BP_A, base: 'develop', deps });
  writeCurrent({ repoRoot: repo, blueprint: BP_B, base: 'main', deps });
  assert.strictEqual(clearCurrent({ repoRoot: nestedA, deps }), true);
  assert.strictEqual(fs.existsSync(nsFile(repo, '001', '001')), false);
  assert.ok(fs.existsSync(nsFile(repo, '002', '003')));
  assert.deepStrictEqual(
    readCurrent({ repoRoot: repo, deps }),
    pointerBody(BP_B, 'main', null),
  );
});

test('writeCurrent rejects a blueprint path without three-digit ids', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  assert.throws(
    () => writeCurrent({ repoRoot: repo, blueprint: 'b', base: 'develop', deps }),
    /Cannot derive epic\/blueprint ids/,
  );
});


// --- coordinator mode -------------------------------------------------------

const { presentCurrent } = require('../scripts/lib/current');
const { coordinate } = require('../scripts/lib/coordinator');
const { reviseTaskScope } = require('../scripts/lib/scope');

function committedGitRepo() {
  const repo = tmpGitRepo();
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  run(['add', 'README']);
  run(['commit', '--quiet', '-m', 'base']);
  return repo;
}

test('presentCurrent keeps the sequential pointer shape when no coordinator ledger exists', () => {
  const repo = committedGitRepo();
  const bpDir = writeBp(repo, {
    epicSlug: '061-x', bpSlug: '062-y', epicId: '061', bpId: '062',
    bpStatus: 'approved', tasksStatus: 'ready', affectedPaths: ['src/'],
  });
  writeCurrent({ repoRoot: repo, blueprint: bpDir, base: 'main' });
  assert.deepStrictEqual(presentCurrent(readCurrent({ repoRoot: repo }), { repoRoot: repo }), {
    blueprint: bpDir, base: 'main', task: null, scale: null,
  });
});

test('presentCurrent exposes the coordinator ready wave and graph revision', () => {
  const repo = committedGitRepo();
  const bpDir = writeBp(repo, {
    epicSlug: '063-x', bpSlug: '064-y', epicId: '063', bpId: '064',
    bpStatus: 'approved', tasksStatus: 'ready', affectedPaths: ['src/'],
  });
  // 002는 sequential 이라 첫 wave에 열리지 않는다 — prepare 뒤의 ready set이 된다.
  writeDoc(repo, `${bpDir}/tasks/002/tasks.md`, {
    type: 'bouncer.tasks', title: 't2', description: 'd', resource: `${bpDir}/tasks/002/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-002', epic_id: '063', blueprint_id: '064', status: 'ready',
      affected_paths: ['src/'],
    },
  });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '--quiet', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: bpDir });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: bpDir, cwd: boot.integrationPath,
  });
  writeCurrent({
    repoRoot: repo, blueprint: bpDir, base: 'main', task: `${bpDir}/tasks/001/tasks.md`,
  });
  reviseTaskScope({
    repoRoot: prepared.tasks[0].workerPath,
    blueprint: bpDir,
    task: '001',
    paths: ['src/', 'lib/'],
    reason: 'lib helper reuse discovered during implementation',
  });

  const shown = presentCurrent(readCurrent({ repoRoot: repo }), { repoRoot: repo });
  assert.strictEqual(shown.task.id, 'TASKS-001');
  assert.deepStrictEqual(shown.coordinator.ready, ['002']);
  assert.strictEqual(shown.coordinator.revision, 'r1');
  assert.strictEqual(typeof shown.coordinator.integrationHead, 'string');
  assert.deepStrictEqual(shown.coordinator.tasks[0].scope, ['src/', 'lib/']);
  assert.strictEqual(shown.coordinator.tasks[0].status, 'prepared');
  assert.strictEqual(shown.coordinator.tasks[0].executionKind, 'commit');
});

test('listTasksDocs attaches normalized executionKind to explicit and legacy-default tasks', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-current-'));
  const blueprint = '.bouncer/context/epics/070-x/blueprints/071-y';
  for (const [id, execution] of [['001', ''], ['002', '  execution_kind: verification\n']]) {
    const rel = `${blueprint}/tasks/${id}/tasks.md`;
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), `---\nbouncer:\n  id: TASKS-${id}\n${execution}---\n`);
  }
  const { listTasksDocs } = require('../scripts/lib/tasks-docs');
  assert.deepStrictEqual(
    listTasksDocs({ repoRoot: repo, blueprintDir: blueprint }).entries.map((e) => e.executionKind),
    ['commit', 'verification'],
  );
});
