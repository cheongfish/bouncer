'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateBlueprint } = require('../scripts/lib/validate');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';
const BP_LEGACY = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const yaml = require('js-yaml');
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writeBundleIndex(repo, epicDirs = ['001-auth']) {
  const lines = epicDirs.map((d) => {
    const m = d.match(/^((?:EPIC-)?\d{3})-(.+)$/);
    const id = m[1];
    const slug = m[2];
    return `* [${id} ${slug}](epics/${d}/index.md) - Epic ${id}`;
  });
  const abs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\nokf_version: "0.1"\n---\n# Epics\n\n${lines.join('\n')}\n`);
}

function goodTasks(bpRel = BP_REL) {
  return {
    type: 'bouncer.tasks',
    title: 'Login tasks',
    description: 'Tasks for 001',
    resource: `${bpRel}/tasks.md`,
    tags: ['bouncer', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      affected_paths: ['src/auth/'],
    },
  };
}

function blueprintDoc(bpRel = BP_REL) {
  return {
    type: 'bouncer.blueprint',
    title: 'Login blueprint',
    description: '001',
    resource: `${bpRel}/index.md`,
    tags: ['bouncer', 'blueprint'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'draft' },
  };
}

function epicDoc(epicRel = '.bouncer/context/epics/001-auth/index.md', id = '001') {
  return {
    type: 'bouncer.epic',
    title: 'Auth epic',
    description: id,
    resource: epicRel,
    tags: ['bouncer', 'epic'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id, epic_id: id, status: 'draft' },
  };
}

test('S1: missing OKF field is reported', () => {
  const repo = mkRepo();
  const t = goodTasks();
  delete t.description;
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S1'));
});

test('S3/S6/S7 detect resource, status, affected_paths problems', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.resource = 'context/wrong/path.md';
  t.bouncer.status = 'bogus';
  t.bouncer.affected_paths = [];
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const codes = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL })
    .failures.map((f) => f.code);
  assert.ok(codes.includes('S3'));
  assert.ok(codes.includes('S6'));
  assert.ok(codes.includes('S7'));
});

test('S4: epic/blueprint require \\d{3}; children require KIND-\\d{3}', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.bouncer.id = 'TASKS-BP-001'; // legacy shape: S4 passes via normalize, covered elsewhere
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    ...goodTasks(),
    bouncer: { ...goodTasks().bouncer, id: 'bogus' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(),
    bouncer: { id: 'BP-001', epic_id: '001', blueprint_id: '001', status: 'draft' },
  });
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  // blueprint id BP-001 normalizes to 001 → S4 ok; tasks id "bogus" → S4
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S4' && /bogus/.test(f.message)));
});

test('S8: leaf present but blueprint index absent', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S8'));
});

test('a fully valid numeric blueprint passes structural checks', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('legacy path + legacy meta (EPIC-/BP-/TASKS-BP-) still passes S5', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_LEGACY}/tasks.md`, {
    type: 'bouncer.tasks',
    title: 'Login tasks',
    description: 'Tasks for BP-001',
    resource: `${BP_LEGACY}/tasks.md`,
    tags: ['bouncer', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-BP-001',
      epic_id: 'EPIC-001',
      blueprint_id: 'BP-001',
      status: 'ready',
      affected_paths: ['src/auth/'],
    },
  });
  writeDoc(repo, `${BP_LEGACY}/index.md`, {
    type: 'bouncer.blueprint',
    title: 'Login blueprint',
    description: 'BP-001',
    resource: `${BP_LEGACY}/index.md`,
    tags: ['bouncer', 'blueprint'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'BP-001', epic_id: 'EPIC-001', blueprint_id: 'BP-001', status: 'draft' },
  });
  writeDoc(repo, '.bouncer/context/epics/EPIC-001-auth/index.md', {
    type: 'bouncer.epic',
    title: 'Auth epic',
    description: 'EPIC-001',
    resource: '.bouncer/context/epics/EPIC-001-auth/index.md',
    tags: ['bouncer', 'epic'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'EPIC-001', epic_id: 'EPIC-001', status: 'draft' },
  });
  writeBundleIndex(repo, ['EPIC-001-auth']);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_LEGACY });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('S5: wrong number after legacy-prefix normalize still fails', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.bouncer.epic_id = 'EPIC-013';
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'S5' && /epic_id/.test(f.message)));
});

test('S13: epic directory missing from bundle context index', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const abs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '---\nokf_version: "0.1"\n---\n# Epics\n\n');
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S13' && /not listed/.test(f.message)));
});

test('S13: bundle context index lists a missing epic directory', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo, ['001-auth', '099-ghost']);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S13' && /missing epic/.test(f.message)));
});

test('S0: malformed frontmatter is collected as a failure, not thrown', () => {
  const repo = mkRepo();
  const abs = path.join(repo, `${BP_REL}/tasks.md`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '# no frontmatter here\n');
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'S0'));
});

test('legacy sdd frontmatter is rejected with bouncer-init guidance', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    type: 'sdd.tasks',
    title: 'Legacy',
    description: 'legacy',
    resource: `${BP_REL}/tasks.md`,
    tags: ['sdd', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    sdd: {
      id: 'TASKS-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      affected_paths: ['src/auth/'],
    },
  });
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => /bouncer-init/.test(f.message)));
});

test('tasks.graph.basis is required when graph is present', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.bouncer.graph = { suggested_paths: ['src/'] };
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => /graph\.basis/.test(f.message)));
});

test('legacy root context blueprint is not a canonical validation target', () => {
  const repo = mkRepo();
  const legacyBp = 'context/epics/001-auth/blueprints/001-login';
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: legacyBp });
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(res.failures.map((f) => f.code), ['S10']);
  assert.match(res.failures[0].message, /must be under \.bouncer\/context\/epics/);
});

// P2: a nonexistent blueprint used to surface as a finalize comprehension
// failure (now G15), which sends the reader looking for a document problem
// instead of a typo.
test('S11: a blueprint with no documents is reported as absent, not as a gate failure', () => {
  const repo = mkRepo();
  for (const gate of [undefined, 'plan', 'execute', 'finalize']) {
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
    assert.strictEqual(res.ok, false, `gate ${gate} should fail`);
    assert.deepStrictEqual(res.failures.map((f) => f.code), ['S11'], `gate ${gate} codes`);
    assert.match(res.failures[0].message, /not found|absent|no documents/i);
    assert.strictEqual(res.failures[0].file, BP_REL);
  }
});

test('S11 does not mask a partially scaffolded blueprint', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${BP_REL}/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'draft',
      affected_paths: ['src/a'],
    },
  });
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  const codes = res.failures.map((f) => f.code);
  assert.ok(!codes.includes('S11'), `S11 should not fire: ${codes.join(',')}`);
  assert.ok(codes.includes('S8'), `expected S8 for the absent index: ${codes.join(',')}`);
});

test('S12: invalid tasks.bouncer.verify is reported', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.bouncer.verify = 'cd x && npm test';
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S12'));
});

test('S12 does not fire when tasks.bouncer.verify is absent', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(!res.failures.some((f) => f.code === 'S12'));
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});
