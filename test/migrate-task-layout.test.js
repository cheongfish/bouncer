'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { migrateTaskLayout } = require('../scripts/lib/migrate-task-layout');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

function write(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

// 번호 문서 두 개 + blueprint 루트 증적 한 벌인 구 레이아웃.
function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-layout-'));
  for (const n of ['001', '002']) {
    write(repo, `${BP}/tasks-${n}.md`, {
      type: 'bouncer.tasks',
      title: n,
      description: n,
      resource: `${BP}/tasks-${n}.md`,
      tags: [],
      timestamp: '2026-01-01T00:00:00+09:00',
      bouncer: {
        id: `TASKS-${n}`, epic_id: '001', blueprint_id: '001', status: 'ready',
      },
    });
  }
  for (const kind of ['verification', 'review']) {
    write(repo, `${BP}/${kind}.md`, {
      type: `bouncer.${kind}`,
      title: kind,
      description: kind,
      resource: `${BP}/${kind}.md`,
      tags: [],
      timestamp: '2026-01-01T00:00:00+09:00',
      bouncer: {
        id: `${kind === 'review' ? 'REVIEW' : 'VERIFY'}-001`,
        epic_id: '001',
        blueprint_id: '001',
        status: 'pending',
        ...(kind === 'review' ? { review: { required: true } } : {}),
      },
    });
  }
  return repo;
}

test('dry-run plans old files without changing disk', () => {
  const repoRoot = fixture();
  const r = migrateTaskLayout({ repoRoot, dryRun: true, deps: { isWorktreeDirty: () => false } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.plan.map((p) => p.to).sort(), [
    `${BP}/tasks/001/review.md`,
    `${BP}/tasks/001/tasks.md`,
    `${BP}/tasks/001/verification.md`,
    `${BP}/tasks/002/tasks.md`,
  ]);
  assert.ok(fs.existsSync(path.join(repoRoot, `${BP}/tasks-001.md`)));
});

test('apply rewrites resources and creates pending leafs', () => {
  const repoRoot = fixture();
  const r = migrateTaskLayout({ repoRoot, deps: applyDeps(repoRoot) });
  assert.equal(r.ok, true);
  for (const leaf of ['tasks.md', 'verification.md', 'review.md']) {
    assert.ok(fs.existsSync(path.join(repoRoot, `${BP}/tasks/002/${leaf}`)));
  }
  const raw = fs.readFileSync(path.join(repoRoot, `${BP}/tasks/001/tasks.md`), 'utf8');
  assert.match(raw, new RegExp(`resource: ${BP}/tasks/001/tasks\\.md`));
});

test('dirty and mixed repositories are rejected before moves', () => {
  const repoRoot = fixture();
  assert.equal(migrateTaskLayout({ repoRoot, deps: { isWorktreeDirty: () => true } }).ok, false);
  assert.ok(fs.existsSync(path.join(repoRoot, `${BP}/tasks-001.md`)));
  fs.mkdirSync(path.join(repoRoot, `${BP}/tasks/001`), { recursive: true });
  assert.equal(migrateTaskLayout({ repoRoot, deps: { isWorktreeDirty: () => false } }).ok, false);
});

const BP2 = '.bouncer/context/epics/001-auth/blueprints/002-signup';

// blueprint id를 id로 쓰던 레거시 blueprint. 세 문서가 모두 tasks/001로 접힌다.
function legacyFixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-layout-legacy-'));
  write(repo, `${BP2}/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 't', resource: `${BP2}/tasks.md`,
    tags: [], timestamp: '2026-01-01T00:00:00+09:00',
    bouncer: { id: 'TASKS-002', epic_id: '001', blueprint_id: '002', status: 'verified' },
  });
  for (const kind of ['verification', 'review']) {
    write(repo, `${BP2}/${kind}.md`, {
      type: `bouncer.${kind}`, title: kind, description: kind, resource: `${BP2}/${kind}.md`,
      tags: [], timestamp: '2026-01-01T00:00:00+09:00',
      bouncer: {
        id: `${kind === 'review' ? 'REVIEW' : 'VERIFY'}-002`,
        epic_id: '001', blueprint_id: '002', status: 'pending',
        ...(kind === 'review' ? { review: { required: true } } : {}),
      },
    });
  }
  return repo;
}

function applyDeps(repoRoot) {
  return {
    isWorktreeDirty: () => false,
    move: (from, to) => fs.renameSync(path.join(repoRoot, from), path.join(repoRoot, to)),
  };
}

function readIds(repoRoot, unit) {
  return ['tasks', 'verification', 'review'].map((kind) => yaml.load(
    fs.readFileSync(path.join(repoRoot, `${unit}/${kind}.md`), 'utf8').split('---')[1],
  ).bouncer.id);
}

test('legacy blueprint ids are renumbered to the unit, not left at the blueprint id', () => {
  const repoRoot = legacyFixture();
  assert.equal(migrateTaskLayout({ repoRoot, deps: applyDeps(repoRoot) }).ok, true);
  assert.deepEqual(
    readIds(repoRoot, `${BP2}/tasks/001`),
    ['TASKS-001', 'VERIFY-001', 'REVIEW-001'],
  );
});

test('a destination that already exists aborts before any move', () => {
  const repoRoot = fixture();
  write(repoRoot, `${BP}/tasks/002/tasks.md`, {
    type: 'bouncer.tasks', title: 'squatter', description: 'x', resource: 'x',
    tags: [], timestamp: '2026-01-01T00:00:00+09:00', bouncer: {},
  });
  const r = migrateTaskLayout({ repoRoot, deps: applyDeps(repoRoot) });
  assert.equal(r.ok, false);
  assert.ok(r.warnings.some((w) => w.startsWith('collision:')), r.warnings.join('\n'));
  assert.ok(fs.existsSync(path.join(repoRoot, `${BP}/tasks-001.md`)));
});

test('the active pointer follows its task document, and other blueprints do not', () => {
  const { writeCurrent, readCurrent } = require('../scripts/lib/current');
  const { execFileSync } = require('node:child_process');
  const gitInit = (dir) => execFileSync('git', ['init', '--quiet'], { cwd: dir });
  const repoRoot = fixture();
  gitInit(repoRoot);
  writeCurrent({
    repoRoot, blueprint: BP, base: 'develop', task: `${BP}/tasks-002.md`,
  });
  const moved = migrateTaskLayout({ repoRoot, deps: applyDeps(repoRoot) });
  assert.deepEqual(moved.pointer, {
    from: `${BP}/tasks-002.md`, to: `${BP}/tasks/002/tasks.md`,
  });
  assert.equal(readCurrent({ repoRoot }).task, `${BP}/tasks/002/tasks.md`);

  const other = legacyFixture();
  gitInit(other);
  writeCurrent({
    repoRoot: other, blueprint: BP, base: 'develop', task: `${BP}/tasks-001.md`,
  });
  const untouched = migrateTaskLayout({ repoRoot: other, deps: applyDeps(other) });
  assert.equal(untouched.pointer, null);
  assert.equal(readCurrent({ repoRoot: other }).task, `${BP}/tasks-001.md`);
});
