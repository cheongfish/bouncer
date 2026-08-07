'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const {
  discoverLegacyIds, planMigration, validateMigration, applyMigration,
  rewriteLegacyTokens,
} = require('../scripts/lib/migrate-ids');
const { validateBlueprint } = require('../scripts/lib/validate');
const { runCli } = require('../scripts/lib/cli');
const { writeCurrent, readCurrent } = require('../scripts/lib/current');

const LEGACY_EPIC = 'EPIC-001-auth';
const LEGACY_BP = 'BP-001-login';
const LEGACY_BP_DIR = `.bouncer/context/epics/${LEGACY_EPIC}/blueprints/${LEGACY_BP}`;
const NEW_BP_DIR = '.bouncer/context/epics/001-auth/blueprints/001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-migrate-'));
}

function gitInitCommit(repo) {
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['add', '-A'], { cwd: repo, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: repo, stdio: 'ignore' });
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writeLegacyTree(repo, {
  bodyExtra = '',
  tasksId = 'TASKS-BP-001',
} = {}) {
  const epicRel = `.bouncer/context/epics/${LEGACY_EPIC}/index.md`;
  const bpRel = `${LEGACY_BP_DIR}/index.md`;
  writeDoc(repo, epicRel, {
    type: 'bouncer.epic',
    title: 'Auth',
    description: 'Epic EPIC-001',
    resource: epicRel,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'draft' },
  }, `# EPIC-001 auth\n\nSee BP-001.\n${bodyExtra}`);

  writeDoc(repo, bpRel, {
    type: 'bouncer.blueprint',
    title: 'Login',
    description: 'BP-001',
    resource: bpRel,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'approved',
    },
  }, '# BP-001 login\n\nEpic EPIC-001 owns this.\n');

  writeDoc(repo, `${LEGACY_BP_DIR}/tasks.md`, {
    type: 'bouncer.tasks',
    title: 'tasks',
    description: 't',
    resource: `${LEGACY_BP_DIR}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: tasksId,
      epic_id: 'EPIC-001',
      blueprint_id: 'BP-001',
      status: 'ready',
      affected_paths: ['src/'],
      graph: { basis: 'manual' },
    },
  }, 'Body mentions EPIC-001 and BP-001 and TASKS-BP-001.\n');

  writeDoc(repo, `${LEGACY_BP_DIR}/verification.md`, {
    type: 'bouncer.verification',
    title: 'v',
    description: 'v',
    resource: `${LEGACY_BP_DIR}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'pending',
    },
  });

  writeDoc(repo, `${LEGACY_BP_DIR}/review.md`, {
    type: 'bouncer.review',
    title: 'r',
    description: 'r',
    resource: `${LEGACY_BP_DIR}/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-BP-001',
      epic_id: 'EPIC-001',
      blueprint_id: 'BP-001',
      status: 'pending',
      review: { required: true },
    },
  });

  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    `---\nokf_version: "0.1"\n---\n# Epics\n\n* [EPIC-001 auth](epics/${LEGACY_EPIC}/index.md) - Epic EPIC-001\n`,
  );
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('rewriteLegacyTokens strips EPIC-/BP- and KIND-BP- prefixes', () => {
  assert.strictEqual(
    rewriteLegacyTokens('See EPIC-001 and BP-002 and TASKS-BP-003.'),
    'See 001 and 002 and TASKS-003.',
  );
  assert.strictEqual(
    rewriteLegacyTokens('epics/EPIC-014-x/blueprints/BP-002-y/tasks.md'),
    'epics/014-x/blueprints/002-y/tasks.md',
  );
});

test('dry-run lists planned renames without changing the tree', () => {
  const repo = mkRepo();
  writeLegacyTree(repo);
  gitInitCommit(repo);

  const r = capture(['migrate', 'ids', '--repo', repo, '--dry-run']);
  assert.strictEqual(r.code, 0, r.err);
  const json = JSON.parse(r.out);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.dryRun, true);
  assert.ok(json.renames.some((x) => x.from.includes(LEGACY_BP) && x.to.includes('001-login')));
  assert.ok(json.renames.some((x) => x.from.includes(LEGACY_EPIC) && x.to.includes('001-auth')));
  assert.ok(fs.existsSync(path.join(repo, LEGACY_BP_DIR)));
  assert.ok(!fs.existsSync(path.join(repo, NEW_BP_DIR)));
});

test('apply renames dirs, rewrites body tokens, and passes S5 sample', () => {
  const repo = mkRepo();
  writeLegacyTree(repo);
  gitInitCommit(repo);

  const plan = planMigration({ repoRoot: repo });
  const result = applyMigration({ repoRoot: repo, plan });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.ok(!fs.existsSync(path.join(repo, `.bouncer/context/epics/${LEGACY_EPIC}`)));
  assert.ok(fs.existsSync(path.join(repo, NEW_BP_DIR)));

  const tasks = fs.readFileSync(path.join(repo, `${NEW_BP_DIR}/tasks.md`), 'utf8');
  assert.match(tasks, /Body mentions 001 and 001 and TASKS-001/);
  assert.doesNotMatch(tasks, /EPIC-001/);
  assert.doesNotMatch(tasks, /BP-001/);
  assert.doesNotMatch(tasks, /TASKS-BP-001/);

  const index = fs.readFileSync(path.join(repo, '.bouncer/context/index.md'), 'utf8');
  assert.match(index, /epics\/001-auth\/index\.md/);
  assert.doesNotMatch(index, /EPIC-001/);

  const structural = validateBlueprint({
    repoRoot: repo,
    blueprintDir: NEW_BP_DIR,
  });
  const s5 = structural.failures.filter((f) => f.code === 'S5');
  assert.deepStrictEqual(s5, [], JSON.stringify(s5));
});

test('apply rewrites the active blueprint pointer path', () => {
  const repo = mkRepo();
  writeLegacyTree(repo);
  gitInitCommit(repo);
  writeCurrent({ repoRoot: repo, blueprint: LEGACY_BP_DIR, base: 'develop' });

  const plan = planMigration({ repoRoot: repo });
  assert.strictEqual(applyMigration({ repoRoot: repo, plan }).ok, true);

  const cur = readCurrent({ repoRoot: repo });
  assert.deepStrictEqual(cur, { blueprint: NEW_BP_DIR, base: 'develop', task: null });
});

test('apply rejects mixed new+legacy trees', () => {
  const repo = mkRepo();
  writeLegacyTree(repo);
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/002-other'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/context/epics/002-other/index.md'), '# x\n');
  gitInitCommit(repo);

  const plan = planMigration({ repoRoot: repo });
  const v = validateMigration({ repoRoot: repo, plan });
  assert.strictEqual(v.ok, false);
  assert.ok(v.reasons.some((r) => /mixed/i.test(r)));

  const applied = applyMigration({ repoRoot: repo, plan });
  assert.strictEqual(applied.ok, false);
  assert.ok(fs.existsSync(path.join(repo, `.bouncer/context/epics/${LEGACY_EPIC}`)));
});

test('apply rejects destination collisions', () => {
  const repo = mkRepo();
  writeLegacyTree(repo);
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/001-auth'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/context/epics/001-auth/index.md'), '# collide\n');
  gitInitCommit(repo);

  const plan = planMigration({ repoRoot: repo });
  const v = validateMigration({ repoRoot: repo, plan });
  assert.strictEqual(v.ok, false);
  assert.ok(v.reasons.some((r) => /collision/i.test(r)));
});

test('apply rejects a dirty worktree by default', () => {
  const repo = mkRepo();
  writeLegacyTree(repo);
  gitInitCommit(repo);
  fs.writeFileSync(path.join(repo, 'dirty.txt'), 'x\n');

  const plan = planMigration({ repoRoot: repo });
  const v = validateMigration({ repoRoot: repo, plan });
  assert.strictEqual(v.ok, false);
  assert.ok(v.reasons.some((r) => /dirty/i.test(r)));

  const r = capture(['migrate', 'ids', '--repo', repo]);
  assert.notStrictEqual(r.code, 0);
  assert.ok(fs.existsSync(path.join(repo, LEGACY_BP_DIR)));
});

test('discover finds only literal EPIC-/BP- directory names', () => {
  const repo = mkRepo();
  writeLegacyTree(repo);
  const d = discoverLegacyIds({ repoRoot: repo });
  assert.strictEqual(d.hasLegacy, true);
  assert.ok(d.epics.some((e) => e.from.endsWith(LEGACY_EPIC)));
  assert.ok(d.blueprints.some((b) => b.from.endsWith(LEGACY_BP)));
});
