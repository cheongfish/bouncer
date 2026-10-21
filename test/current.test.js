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
  baseNamespaceKeys,
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

test('no pointer file → readCurrent returns null', () => {
  const repo = tmpRepo();
  assert.strictEqual(readCurrent({ repoRoot: repo }), null);
});

test('writeCurrent followed by readCurrent → round-trips the pointer', () => {
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

test('writeCurrent with backslash paths → normalizes them to POSIX', () => {
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

test('pointer file with corrupt JSON → readCurrent returns null', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  const abs = path.join(repo, '.git', 'bouncer', 'current');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '{ this is not json');
  assert.strictEqual(readCurrent({ repoRoot: repo, deps }), null);
});

test('writeCurrent in a non-Git repository → rejects', () => {
  const repo = tmpRepo();
  assert.throws(
    () => writeCurrent({ repoRoot: repo, blueprint: 'bp', base: 'main' }),
    /Bouncer requires a Git repository for an active blueprint/,
  );
});

test('legacy .sdd/current → is ignored and init rejects with bouncer-init guidance', () => {
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
test('clearCurrent on an active pointer and again → removes it and is safe to repeat', () => {
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

test('listReadyBlueprints with blueprints in various states → includes approved + ready / in_progress only', () => {
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

test('closed blueprint (finalize --yes lock) → listReadyBlueprints excludes it', () => {
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

test('partial_closed blueprint → listReadyBlueprints excludes it as an unresolved terminal state', () => {
  const repo = tmpRepo();
  writeBp(repo, {
    epicSlug: '001-a', bpSlug: '001-partial', epicId: '001', bpId: '001',
    bpStatus: 'partial_closed', tasksStatus: 'ready',
  });
  assert.deepStrictEqual(listReadyBlueprints({ repoRoot: repo }), []);
});

test('imported blueprint → listReadyBlueprints excludes it', () => {
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

test('blueprints across epics and broken docs → listReadyBlueprints sorts them and skips the broken docs', () => {
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

test('same-epic candidates and ## Blueprints order → nextBlueprint prefers same-epic candidates in that order', () => {
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

test('no candidates remain → nextBlueprint returns null', () => {
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

test('closed blueprint among candidates → nextBlueprint excludes it', () => {
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

test('partial_closed sibling → nextBlueprint excludes it from candidates and history handoff', () => {
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

test('draft sibling and no ready candidates → nextBlueprint sameEpicPending includes the draft sibling', () => {
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

test('closed siblings, other epics and self → nextBlueprint sameEpicPending excludes them', () => {
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

test('ready next candidate alongside pending siblings → nextBlueprint sameEpicPending coexists and sorts by path', () => {
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

test('approved-but-verified siblings → nextBlueprint sameEpicPending marks them ready:false', () => {
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

test('broken siblings → nextBlueprint sameEpicPending skips them without throwing', () => {
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

test('several candidates with affected_paths → nextBlueprint sharedPaths is the intersection in candidate order', () => {
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

test('numbered tasks with ready/in_progress statuses → listReadyBlueprints counts any ready/in_progress task', () => {
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

test('several ready/in_progress tasks → resolvePointerTask auto-selects the first by number order', () => {
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

test('--task that does not match a document → resolvePointerTask fails', () => {
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

test('explicit task path → writeCurrent persists it', () => {
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

test('numbered tasks with affected_paths → nextBlueprint sharedPaths unions them', () => {
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

test('nested worktree key with sibling pointers → resolveCurrent selects the nested key and ignores siblings', () => {
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

test('flat worktree candidates unique or duplicated → resolveCurrent selects the unique one and rejects duplicates', () => {
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

test('base checkout with one or many pointers → resolveCurrent selects the single pointer and rejects many', () => {
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

test('four resolveCurrent variants and the readCurrent wrapper → contracts hold', () => {
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

test('legacy-only read, first write, same-key write and different-key write → read works, first write migrates, same-key is idempotent, different key conflicts', () => {
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

test('namespace write failure → writeCurrent preserves legacy', () => {
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

test('writeCurrent with --replace → deletes the selected key before writing the target', () => {
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

test('legacy delete failure → is CURRENT_MIGRATION_INCOMPLETE and the next same write finishes', () => {
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

test('clearCurrent on a nested worktree → removes only that namespace key', () => {
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

test('blueprint path without three-digit ids → writeCurrent rejects it', () => {
  const repo = tmpGitRepo();
  const deps = runtimeDeps(repo);
  assert.throws(
    () => writeCurrent({ repoRoot: repo, blueprint: 'b', base: 'develop', deps }),
    /Cannot derive epic\/blueprint ids/,
  );
});


// --- coordinator mode -------------------------------------------------------

const { presentCurrent, resolveEffectiveTask } = require('../scripts/lib/current');

const { coordinate } = require('./helpers/coordinator-fence');

const { reviseTaskScope } = require('../scripts/lib/scope');

function committedGitRepo() {
  const repo = tmpGitRepo();
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  // reviseTaskScope는 추적 파일이 있는 경로만 받는다(scope-path-untracked).
  // 아래 테스트가 scope로 쓰는 디렉터리에 추적 파일을 하나씩 둔다.
  for (const rel of ['src/a/keep.txt', 'src/b/keep.txt', 'lib/keep.txt']) {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), 'x\n');
  }
  run(['add', '-A']);
  run(['commit', '--quiet', '-m', 'base']);
  return repo;
}

test('no coordinator ledger → presentCurrent keeps the sequential pointer shape', () => {
  const repo = committedGitRepo();
  const bpDir = writeBp(repo, {
    epicSlug: '061-x', bpSlug: '062-y', epicId: '061', bpId: '062',
    bpStatus: 'approved', tasksStatus: 'ready', affectedPaths: ['src/'],
  });
  writeCurrent({ repoRoot: repo, blueprint: bpDir, base: 'main' });
  assert.deepStrictEqual(presentCurrent(readCurrent({ repoRoot: repo }), { repoRoot: repo }), {
    blueprint: bpDir, base: 'main', task: null, scale: null, effectiveTask: null,
  });
});

test('coordinator ledger present → presentCurrent exposes the ready wave and graph revision', () => {
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
  // 001이 prepared(순차)인 동안 ready는 비어 있다 — invalid config의 maxParallel:1
  // 폴백과 같은 읽기 전용 정책이 in-flight 순차를 열어 두지 않는다.
  assert.deepStrictEqual(shown.coordinator.ready, []);
  assert.strictEqual(shown.coordinator.revision, 'r1');
  assert.strictEqual(typeof shown.coordinator.integrationHead, 'string');
  assert.deepStrictEqual(shown.coordinator.tasks[0].scope, ['src/', 'lib/']);
  assert.strictEqual(shown.coordinator.tasks[0].status, 'prepared');
  assert.strictEqual(shown.coordinator.tasks[0].executionKind, 'commit');
});

test('invalid coordinator config → presentCurrent falls back to maxParallel 1', () => {
  const repo = committedGitRepo();
  const bpDir = writeBp(repo, {
    epicSlug: '078-x', bpSlug: '001-y', epicId: '078', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready', affectedPaths: ['a/'],
  });
  for (const [id, leaf] of [['001', 'a'], ['002', 'b'], ['003', 'c']]) {
    writeDoc(repo, `${bpDir}/tasks/${id}/tasks.md`, {
      type: 'bouncer.tasks', title: `t${id}`, description: 'd', resource: `${bpDir}/tasks/${id}/tasks.md`,
      tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `TASKS-${id}`, epic_id: '078', blueprint_id: '001', status: 'ready',
        parallel_safe: true, affected_paths: [`${leaf}/`],
      },
    });
  }
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '--quiet', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: bpDir });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  // prepare는 invalid를 거절하므로 읽기 전용 폴백만 본다. integration config를
  // 깨뜨린 뒤 presentCurrent의 ready가 한 task만 담는지 확인한다.
  const cfgDir = path.join(boot.integrationPath, '.bouncer');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(
    path.join(cfgDir, 'config.json'),
    `${JSON.stringify({ coordinator: { max_parallel: 0 } }, null, 2)}\n`,
  );
  writeCurrent({
    repoRoot: repo, blueprint: bpDir, base: 'main', task: `${bpDir}/tasks/001/tasks.md`,
  });
  const shown = presentCurrent(readCurrent({ repoRoot: repo }), { repoRoot: repo });
  assert.deepStrictEqual(shown.coordinator.ready, ['001']);
});

test('explicit and legacy-default tasks → listTasksDocs attaches normalized executionKind', () => {
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


test('worker lease and shared pointer → resolveEffectiveTask prefers the worker lease', () => {
  const repo = committedGitRepo();
  const bpDir = writeBp(repo, {
    epicSlug: '092-eff', bpSlug: '001-y', epicId: '092', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready', affectedPaths: ['src/a/'],
  });
  writeDoc(repo, `${bpDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't1', description: 'd', resource: `${bpDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '092', blueprint_id: '001', status: 'ready',
      parallel_safe: true, affected_paths: ['src/a/'],
    },
  });
  writeDoc(repo, `${bpDir}/tasks/002/tasks.md`, {
    type: 'bouncer.tasks', title: 't2', description: 'd', resource: `${bpDir}/tasks/002/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-002', epic_id: '092', blueprint_id: '001', status: 'ready',
      parallel_safe: true, affected_paths: ['src/b/'],
    },
  });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '--quiet', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: bpDir });
  const cfgDir = path.join(boot.integrationPath, '.bouncer');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'config.json'),
    `${JSON.stringify({ coordinator: { max_parallel: 2 } }, null, 2)}\n`);
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: bpDir, cwd: boot.integrationPath,
    deps: { makeLeaseId: (() => { let n = 0; return () => `eff-lease-${++n}`; })() },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker002 = prepared.tasks.find((t) => t.id === '002').workerPath;
  const integration = boot.integrationPath;
  // pointer는 TASKS-001 — worker/002 는 lease로 TASKS-002 를 봐야 한다.
  writeCurrent({
    repoRoot: repo, blueprint: bpDir, base: 'main', task: `${bpDir}/tasks/001/tasks.md`,
  });

  const eff = resolveEffectiveTask({ repoRoot: worker002 });
  assert.strictEqual(eff.source, 'lease');
  assert.strictEqual(eff.id, 'TASKS-002');
  assert.strictEqual(resolveEffectiveTask({ repoRoot: integration }).id, 'TASKS-001');

  const ledgerFile = path.join(integration, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  const task002 = ledger.tasks.find((t) => t.id === '002');
  task002.lease.status = 'revoked';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  assert.strictEqual(resolveEffectiveTask({ repoRoot: worker002 }).reason, 'no-active-lease');
});

test('later lease with path overlap → reviseTaskScope revokes it', () => {
  const repo = committedGitRepo();
  const bpDir = writeBp(repo, {
    epicSlug: '090-lease', bpSlug: '001-y', epicId: '090', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready', affectedPaths: ['src/a/'],
  });
  // 001도 parallel_safe여야 한 wave에 둘이 함께 prepared가 된다.
  writeDoc(repo, `${bpDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't1', description: 'd', resource: `${bpDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '090', blueprint_id: '001', status: 'ready',
      parallel_safe: true, affected_paths: ['src/a/'],
    },
  });
  writeDoc(repo, `${bpDir}/tasks/002/tasks.md`, {
    type: 'bouncer.tasks', title: 't2', description: 'd', resource: `${bpDir}/tasks/002/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-002', epic_id: '090', blueprint_id: '001', status: 'ready',
      parallel_safe: true, affected_paths: ['src/b/'],
    },
  });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '--quiet', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: bpDir });
  // max_parallel 2 so both prepare together with distinct paths
  const cfgDir = path.join(boot.integrationPath, '.bouncer');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'config.json'),
    `${JSON.stringify({ coordinator: { max_parallel: 2 } }, null, 2)}\n`);
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: bpDir, cwd: boot.integrationPath,
    deps: { makeLeaseId: (() => { let n = 0; return () => `L${++n}`; })() },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const first = prepared.tasks.find((t) => t.id === '001');
  const second = prepared.tasks.find((t) => t.id === '002');
  assert.ok(first && second, JSON.stringify(prepared.tasks));
  assert.ok(first.lease.seq < second.lease.seq);
  // 후발(002) scope를 선발(001) 경로와 겹치게 바꾼다 → 후발 revoke
  const revised = reviseTaskScope({
    repoRoot: second.workerPath,
    blueprint: bpDir,
    task: '002',
    paths: ['src/a/'],
    reason: 'overlap with earlier lease',
  });
  assert.strictEqual(revised.ok, true, JSON.stringify(revised));
  assert.deepStrictEqual(revised.revoked, ['002']);
  const ledger = JSON.parse(fs.readFileSync(
    path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8'));
  assert.strictEqual(ledger.tasks.find((t) => t.id === '001').status, 'prepared');
  assert.strictEqual(ledger.tasks.find((t) => t.id === '001').lease.status, 'active');
  assert.strictEqual(ledger.tasks.find((t) => t.id === '002').status, 'pending');
  assert.strictEqual(ledger.tasks.find((t) => t.id === '002').lease.status, 'revoked');
});

// 승인 scope에 이미 있던 `.bouncer/` 경로는 revise가 유지할 수 있어야 한다. 성공 사례가 쓰는
// 경로는 integration HEAD에 커밋돼 있어야 한다 — 아니면 scope-path-untracked가 먼저 막아
// 면제 판정을 검증하지 못한다.
function preparedApprovedBouncerPath(epicSlug, epicId) {
  const repo = committedGitRepo();
  const bpDir = writeBp(repo, {
    epicSlug, bpSlug: '001-y', epicId, bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready',
    affectedPaths: ['.bouncer/epics.json', 'src/a/'],
  });
  fs.writeFileSync(path.join(repo, '.bouncer/epics.json'), '[]\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '--quiet', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: bpDir });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: bpDir, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  return {
    bpDir,
    worker: prepared.tasks.find((t) => t.id === '001').workerPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
}

test('approved .bouncer path kept in next paths → reviseTaskScope succeeds', () => {
  const { bpDir, worker } = preparedApprovedBouncerPath('092-keep', '092');
  const revised = reviseTaskScope({
    repoRoot: worker,
    blueprint: bpDir,
    task: '001',
    paths: ['.bouncer/epics.json', 'src/a/', 'src/b/'],
    reason: 'src/b helper discovered',
  });
  assert.strictEqual(revised.ok, true, JSON.stringify(revised));
  assert.deepStrictEqual(revised.paths, ['.bouncer/epics.json', 'src/a/', 'src/b/']);
});

test('new .bouncer path or child of approved .bouncer path → out-of-bounds and bytes unchanged', () => {
  const { bpDir, worker, ledgerFile } = preparedApprovedBouncerPath('093-reject', '093');
  const docFile = path.join(worker, bpDir, 'tasks/001/tasks.md');
  const before = [fs.readFileSync(ledgerFile, 'utf8'), fs.readFileSync(docFile, 'utf8')];
  for (const added of ['.bouncer/context/x.md', '.bouncer/epics.json/child']) {
    const revised = reviseTaskScope({
      repoRoot: worker,
      blueprint: bpDir,
      task: '001',
      paths: ['.bouncer/epics.json', 'src/a/', added],
      reason: 'must not widen into .bouncer',
    });
    assert.strictEqual(revised.ok, false, added);
    assert.strictEqual(revised.reason, 'scope-path-out-of-bounds', added);
    assert.deepStrictEqual(revised.paths, [added]);
  }
  assert.deepStrictEqual(
    [fs.readFileSync(ledgerFile, 'utf8'), fs.readFileSync(docFile, 'utf8')], before,
  );
});

// RD-002: revise도 손상 lease 원장을 lease-invalid로 거절한다.
test('ledger with malformed lease → reviseTaskScope refuses it', () => {
  const repo = committedGitRepo();
  const bpDir = writeBp(repo, {
    epicSlug: '091-lease-invalid', bpSlug: '001-y', epicId: '091', bpId: '001',
    bpStatus: 'approved', tasksStatus: 'ready', affectedPaths: ['src/a/'],
  });
  writeDoc(repo, `${bpDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't1', description: 'd', resource: `${bpDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '091', blueprint_id: '001', status: 'ready',
      parallel_safe: true, affected_paths: ['src/a/'],
    },
  });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '--quiet', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: bpDir });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: bpDir, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks.find((t) => t.id === '001').workerPath;
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].lease = { id: 'bad', generation: 0, seq: 1, status: 'active' };
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const revised = reviseTaskScope({
    repoRoot: worker,
    blueprint: bpDir,
    task: '001',
    paths: ['src/a/', 'src/b/'],
    reason: 'should refuse invalid lease',
  });
  assert.strictEqual(revised.ok, false);
  assert.strictEqual(revised.reason, 'lease-invalid');
});

test('base 위치와 nested worktree → baseNamespaceKeys는 base에서만 namespace key 목록을 낸다', () => {
  const repo = tmpGitRepo();
  seedCommit(repo);
  const nested = addWorktree(repo, '.worktrees/001/001');
  const deps = runtimeDeps(repo);
  assert.deepStrictEqual(baseNamespaceKeys({ repoRoot: repo, deps }), []);
  writeCurrent({ repoRoot: repo, blueprint: BP_A, base: 'develop', deps });
  writeCurrent({ repoRoot: repo, blueprint: BP_B, base: 'main', deps });
  assert.deepStrictEqual(baseNamespaceKeys({ repoRoot: repo, deps }), ['001/001', '002/003']);
  assert.strictEqual(baseNamespaceKeys({ repoRoot: nested, deps }), null);
});

// --- slug epic: 순서는 epic 본문 목록이 아니라 blueprint frontmatter order, epic 사이는 등록부 배열 순서 ---
function writeSlugBp(repo, epicSlug, bpSlug, { order, bpStatus = 'approved', epicBody } = {}) {
  const epicDir = `.bouncer/context/epics/${epicSlug}`;
  const bpDir = `${epicDir}/blueprints/${bpSlug}`;
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'e', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: epicSlug, epic_id: epicSlug, status: 'approved' },
  }, epicBody);
  writeDoc(repo, `${bpDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${bpDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: bpSlug, epic_id: epicSlug, blueprint_id: bpSlug, status: bpStatus,
      ...(order === undefined ? {} : { order }),
    },
  });
  writeDoc(repo, `${bpDir}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${bpDir}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: epicSlug, blueprint_id: bpSlug, status: 'ready', affected_paths: [],
    },
  });
  return bpDir;
}

function writeRegistryOrder(repo, slugs) {
  const abs = path.join(repo, '.bouncer', 'epics.json');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify({
    version: 2,
    profile: 'domain-only',
    domainEpicLimit: 8,
    areas: [],
    epics: slugs.map((slug) => ({ slug, kind: 'common', active: true })),
  }, null, 2)}\n`);
}

test('slug epic with gapped orders 1, 2 and 5 → nextBlueprint follows order ascending regardless of names', () => {
  const repo = tmpRepo();
  const self = writeSlugBp(repo, 'plan-workflow', 'zeta', { order: 1 });
  const second = writeSlugBp(repo, 'plan-workflow', 'beta', { order: 2 });
  const fifth = writeSlugBp(repo, 'plan-workflow', 'alpha', { order: 5 });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: self });

  assert.strictEqual(res.next.blueprint, second);
  assert.deepStrictEqual(res.remaining.map((r) => r.blueprint), [fifth]);
});

test('slug epic ignores the ## Blueprints list order → nextBlueprint still follows frontmatter order', () => {
  const repo = tmpRepo();
  const epicBody = '# Epic\n\n## Blueprints\n\n* [a](blueprints/alpha/index.md) - a\n* [b](blueprints/beta/index.md) - b\n';
  const self = writeSlugBp(repo, 'plan-workflow', 'zeta', { order: 1, epicBody });
  writeSlugBp(repo, 'plan-workflow', 'alpha', { order: 5, epicBody });
  const second = writeSlugBp(repo, 'plan-workflow', 'beta', { order: 2, epicBody });

  assert.strictEqual(nextBlueprint({ repoRoot: repo, blueprintDir: self }).next.blueprint, second);
});

test('slug epic blueprints with equal or missing order → ties break by path and missing order comes last', () => {
  const repo = tmpRepo();
  const self = writeSlugBp(repo, 'plan-workflow', 'zeta', { order: 1 });
  const tieB = writeSlugBp(repo, 'plan-workflow', 'ccc', { order: 3 });
  const tieA = writeSlugBp(repo, 'plan-workflow', 'bbb', { order: 3 });
  const unordered = writeSlugBp(repo, 'plan-workflow', 'aaa', {});

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: self });

  assert.deepStrictEqual(
    [res.next.blueprint, ...res.remaining.map((r) => r.blueprint)],
    [tieA, tieB, unordered],
  );
});

test('slug epic siblings → sameEpicPending is sorted by order', () => {
  const repo = tmpRepo();
  const self = writeSlugBp(repo, 'plan-workflow', 'zeta', { order: 1 });
  const late = writeSlugBp(repo, 'plan-workflow', 'alpha', { order: 9, bpStatus: 'draft' });
  const early = writeSlugBp(repo, 'plan-workflow', 'beta', { order: 2, bpStatus: 'draft' });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: self });

  assert.deepStrictEqual(res.sameEpicPending.map((p) => p.blueprint), [early, late]);
});

test('slug epics across a v2 registry → nextBlueprint orders other epics by registry array position', () => {
  const repo = tmpRepo();
  writeRegistryOrder(repo, ['zebra-epic', 'mango-epic', 'apple-epic']);
  const self = writeSlugBp(repo, 'mango-epic', 'only', { order: 1 });
  const first = writeSlugBp(repo, 'zebra-epic', 'only', { order: 1 });
  const last = writeSlugBp(repo, 'apple-epic', 'only', { order: 1 });
  const unregistered = writeSlugBp(repo, 'aaa-unregistered', 'only', { order: 1 });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: self });

  // 등록부 순서(zebra → apple)가 이름순(aaa → apple → zebra)을 이기고, 미등록 epic은 뒤로 간다.
  assert.deepStrictEqual(
    [res.next.blueprint, ...res.remaining.map((r) => r.blueprint)],
    [first, last, unregistered],
  );
});

test('slug epics without a registry → nextBlueprint orders other epics by name', () => {
  const repo = tmpRepo();
  const self = writeSlugBp(repo, 'mango-epic', 'only', { order: 1 });
  const zebra = writeSlugBp(repo, 'zebra-epic', 'only', { order: 1 });
  const apple = writeSlugBp(repo, 'apple-epic', 'only', { order: 1 });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: self });

  assert.deepStrictEqual([res.next.blueprint, ...res.remaining.map((r) => r.blueprint)], [apple, zebra]);
});

test('numbered epic with a v2 registry present → nextBlueprint keeps name order between epics', () => {
  const repo = tmpRepo();
  writeRegistryOrder(repo, ['zebra-epic', 'apple-epic']);
  const self = writeBp(repo, {
    epicSlug: '001-main', bpSlug: '001-a', epicId: '001', bpId: '001', bpStatus: 'approved', tasksStatus: 'ready',
  });
  const zebra = writeBp(repo, {
    epicSlug: '003-zebra-epic', bpSlug: '001-x', epicId: '003', bpId: '001', bpStatus: 'approved', tasksStatus: 'ready',
  });
  const apple = writeBp(repo, {
    epicSlug: '002-apple-epic', bpSlug: '001-x', epicId: '002', bpId: '001', bpStatus: 'approved', tasksStatus: 'ready',
  });

  const res = nextBlueprint({ repoRoot: repo, blueprintDir: self });

  assert.deepStrictEqual([res.next.blueprint, ...res.remaining.map((r) => r.blueprint)], [apple, zebra]);
});
