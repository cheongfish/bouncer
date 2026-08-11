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
  assert.strictEqual(rel, path.join(commonGitDir, 'bouncer', 'current'));
  assert.ok(fs.existsSync(rel));
  assert.strictEqual(fs.existsSync(path.join(repo, '.bouncer', 'current')), false);
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
    repoRoot: repo, blueprint: '.bouncer\\context\\epics\\001-x', base: 'main', deps,
  });
  assert.strictEqual(
    readCurrent({ repoRoot: repo, deps }).blueprint,
    '.bouncer/context/epics/001-x',
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
  writeCurrent({ repoRoot: root, blueprint: 'b', base: 'develop', deps });
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
  assert.deepStrictEqual(res, { next: null, remaining: [] });
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
