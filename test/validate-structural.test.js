'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateBlueprint, checkStructural, loadBlueprintDocs } = require('../scripts/lib/validate');
const { checkDistillStructural } = require('../scripts/lib/validate-structural');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
}

function writeRaw(repo, rel, content) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeDistillIndex(repo, declarations, routingEnabled = false) {
  writeRaw(repo, '.bouncer/Distill.md', [
    '---',
    'distill:',
    '  version: 1',
    `  routing_enabled: ${routingEnabled}`,
    '  shards:',
    ...declarations.map((id) => `    - ${id}`),
    '---',
    '# Project Distill',
    '',
  ].join('\n'));
}

function writeDistillShard(repo, id, { paths, pulls, always = false, body = '# shard\n' } = {}) {
  const lines = ['---', 'distill:', `  id: ${id}`, `  always: ${always}`];
  if (paths !== undefined) {
    if (paths.length === 0) lines.push('  paths: []');
    else {
      lines.push('  paths:');
      for (const value of paths) lines.push(`    - ${value}`);
    }
  }
  if (pulls !== undefined) {
    if (pulls.length === 0) lines.push('  pulls: []');
    else {
      lines.push('  pulls:');
      for (const value of pulls) lines.push(`    - ${value}`);
    }
  }
  lines.push('---', body, '');
  writeRaw(repo, `.bouncer/distill/${id}.md`, lines.join('\n'));
}

function distillWarnings(repo, { sourceDirs = ['src'], routingEnabled = false, maxBytes } = {}) {
  const config = {
    source_dirs: sourceDirs,
    distill: {
      routing_enabled: routingEnabled,
      ...(maxBytes === undefined ? {} : { max_bytes: maxBytes }),
    },
  };
  return checkDistillStructural({ repoRoot: repo, config });
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const yaml = require('js-yaml');
  // 레거시 경로로 쓰인 fixture만 새 묶음으로 접는다. 이미 tasks/<NNN>/tasks.md인
  // 경로는 그대로 둬야 레이아웃 자체를 검증하는 테스트가 왜곡되지 않는다.
  const legacyTasks = /\/tasks(?:-\d{3})?\.md$/.test(rel) && !/\/tasks\/\d{3}\/tasks\.md$/.test(rel);
  if (data && data.type === 'bouncer.tasks' && legacyTasks) {
    const number = /tasks-(\d{3})\.md$/.exec(rel)?.[1] || '001';
    const bp = rel.replace(/\/tasks(?:-\d{3})?\.md$/, '');
    rel = `${bp}/tasks/${number}/tasks.md`;
    if (/\/tasks(?:-\d{3})?\.md$/.test(data.resource || '')) data.resource = rel;
    for (const [kind, id] of [['verification', `VERIFY-${number}`], ['review', `REVIEW-${number}`]]) {
      const leaf = `${bp}/tasks/${number}/${kind}.md`;
      const leafAbs = path.join(repo, leaf);
      if (fs.existsSync(leafAbs)) continue;
      writeDoc(repo, leaf, {
        type: `bouncer.${kind}`,
        title: kind,
        description: kind,
        resource: leaf,
        tags: ['bouncer'],
        timestamp: '2026-07-01T00:00:00+09:00',
        bouncer: {
          id, epic_id: '001', blueprint_id: '001', status: 'pending',
          ...(kind === 'review' ? { review: { required: true } } : {}),
        },
      });
    }
  }
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writeBundleIndex(repo, epicDirs = ['001-auth']) {
  const lines = epicDirs.map((d) => {
    const m = d.match(/^(\d{3})-(.+)$/);
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

test('S4: rejects child id that is not KIND-\\d{3}', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    ...goodTasks(),
    bouncer: { ...goodTasks().bouncer, id: 'bogus' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(),
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'draft' },
  });
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
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

test('S5: legacy-prefixed frontmatter fails on a canonical path', () => {
  const repo = mkRepo();
  const tasks = goodTasks();
  tasks.bouncer.id = 'TASKS-BP-001';
  tasks.bouncer.epic_id = 'EPIC-001';
  tasks.bouncer.blueprint_id = 'BP-001';
  writeDoc(repo, `${BP_REL}/tasks.md`, tasks);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'S5' && /epic_id/.test(f.message)));
  assert.ok(res.failures.some((f) => f.code === 'S5' && /blueprint_id/.test(f.message)));
  assert.ok(res.failures.some((f) => f.code === 'S5' && /id TASKS-BP-001/.test(f.message)));
});

test('S10: legacy-prefixed blueprint path is not canonical', () => {
  const repo = mkRepo();
  const legacyBp = '.bouncer/context/epics/' + 'EPIC-001-auth/blueprints/' + 'BP-001-login';
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: legacyBp });
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(res.failures.map((f) => f.code), ['S10']);
});

test('S5: legacy-prefixed epic id fails even when digits match', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, {
    ...goodTasks(),
    bouncer: {
      ...goodTasks().bouncer,
      epic_id: 'EPIC-001',
    },
  });
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

test('S13: legacy-prefixed epic directory alone fails', () => {
  const repo = mkRepo();
  // 정본 blueprint로 validate가 S10 early-return 없이 진행하게 두고,
  // 옆에 구형 EPIC- 디렉터리·index 링크만 남겨 S13이 거절하는지 본다.
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const legacyEpic = '.bouncer/context/epics/' + 'EPIC-002-other';
  writeDoc(repo, `${legacyEpic}/index.md`, {
    ...epicDoc(),
    bouncer: { ...epicDoc().bouncer, id: 'EPIC-002', epic_id: 'EPIC-002' },
  });
  const abs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(
    abs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n' +
      '* [001 auth](epics/001-auth/index.md) - auth\n' +
      '* [EPIC-002 other](epics/' + 'EPIC-002-other' + '/index.md) - other\n',
  );
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'S13' && /legacy-prefixed epic directory/.test(f.message)));
  assert.ok(res.failures.some((f) => f.code === 'S13' && /legacy-prefixed epic link/.test(f.message)));
});

test('S13: legacy-only tree fails without a canonical epic present', () => {
  const repo = mkRepo();
  const legacyEpic = '.bouncer/context/epics/' + 'EPIC-001-auth';
  writeDoc(repo, `${legacyEpic}/index.md`, epicDoc());
  const abs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(
    abs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n* [EPIC-001 auth](epics/' +
      'EPIC-001-auth' +
      '/index.md) - auth\n',
  );
  const { checkEpicIndexConsistency } = require('../scripts/lib/epic-index');
  const failures = checkEpicIndexConsistency({ repoRoot: repo });
  assert.ok(failures.some((f) => f.code === 'S13' && /legacy-prefixed epic directory/.test(f.message)));
  assert.ok(failures.some((f) => f.code === 'S13' && /legacy-prefixed epic link/.test(f.message)));
});

test('S0: malformed frontmatter is collected as a failure, not thrown', () => {
  const repo = mkRepo();
  const abs = path.join(repo, `${BP_REL}/tasks/001/tasks.md`);
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
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'sdd.tasks',
    title: 'Legacy',
    description: 'legacy',
    resource: `${BP_REL}/tasks/001/tasks.md`,
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

function writeTasksWithBasis(basis) {
  const repo = mkRepo();
  const t = goodTasks();
  t.bouncer.graph = { suggested_paths: ['src/'], basis };
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  return validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
}

test('S9: legacy non-empty string basis passes', () => {
  const res = writeTasksWithBasis('manual: src/');
  assert.ok(!res.failures.some((f) => f.code === 'S9'));
});

test('S9: empty basis array is rejected', () => {
  const res = writeTasksWithBasis([]);
  assert.ok(res.failures.some((f) => f.code === 'S9' && /graph\.basis/.test(f.message)));
});

test('S9: basis entry with bogus status is rejected', () => {
  const res = writeTasksWithBasis([{
    graph: 'source', status: 'bogus', query: 'q', result: 'r',
  }]);
  assert.ok(res.failures.some((f) => f.code === 'S9' && /graph\.basis/.test(f.message)));
});

test('S9: basis entry with empty query is rejected', () => {
  const res = writeTasksWithBasis([{
    graph: 'source', status: 'updated', query: '', result: 'r',
  }]);
  assert.ok(res.failures.some((f) => f.code === 'S9' && /graph\.basis/.test(f.message)));
});

test('S9: valid basis entry array passes', () => {
  const res = writeTasksWithBasis([{
    graph: 'source', status: 'updated', query: 'q', result: 'r',
  }]);
  assert.ok(!res.failures.some((f) => f.code === 'S9'));
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
// failure (historically G15, now G16 on finalize), which sends the reader
// looking for a document problem instead of a typo.
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

test('S5: legacy tasks.md expects TASKS-{blueprint id}', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(!res.failures.some((f) => f.code === 'S5'));
});

test('S5: tasks-002.md expects TASKS-002 (not blueprint id)', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.resource = `${BP_REL}/tasks/002/tasks.md`;
  t.bouncer.id = 'TASKS-002';
  writeDoc(repo, `${BP_REL}/tasks/002/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(!res.failures.some((f) => f.code === 'S5'), JSON.stringify(res.failures));
});

test('S5: wrong id on numbered tasks file is rejected', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.resource = `${BP_REL}/tasks/002/tasks.md`;
  // 파일 번호는 002인데 id가 blueprint id 기준 TASKS-001이면 어긋남.
  t.bouncer.id = 'TASKS-001';
  writeDoc(repo, `${BP_REL}/tasks/002/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S5' && /TASKS-002/.test(f.message)));
});

test('S15: legacy root task files are rejected', () => {
  const repo = mkRepo();
  const legacy = { ...goodTasks(), resource: `${BP_REL}/tasks.md` };
  const abs = path.join(repo, `${BP_REL}/tasks.md`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${require('js-yaml').dump(legacy)}---\n# x\n`);
  const numbered = goodTasks();
  numbered.resource = `${BP_REL}/tasks-001.md`;
  numbered.bouncer.id = 'TASKS-001';
  writeDoc(repo, `${BP_REL}/tasks-001.md`, numbered);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S15'));
});

test('loadBlueprintDocs: empty tasks listing falls back to tasks/001 not legacy root', () => {
  const repo = mkRepo();
  // tasks/ 묶음이 없는 blueprint — 대표 경로가 레거시 루트 basename이면 안 된다.
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const { rels } = loadBlueprintDocs({ repoRoot: repo, blueprintDir: BP_REL });
  const files = [rels.tasks];
  // /\/tasks\.md$/ 단독은 정본 …/tasks/001/tasks.md에도 걸리므로 루트 basename만 거절한다.
  assert.ok(!files.some((f) => /\/tasks\.md$/.test(f) && !/\/tasks\/\d{3}\/tasks\.md$/.test(f)));
  assert.strictEqual(rels.tasks, `${BP_REL}/tasks/001/tasks.md`);
});

function writeImportedIndexes(repo) {
  const epic = epicDoc();
  epic.bouncer.status = 'imported';
  const bp = blueprintDoc();
  bp.bouncer.status = 'imported';
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epic);
  writeDoc(repo, `${BP_REL}/index.md`, bp);
  writeBundleIndex(repo);
}

test('S18: imported blueprint is out of gate scope (plan)', () => {
  const repo = mkRepo();
  writeImportedIndexes(repo);
  const r = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  assert.strictEqual(r.ok, false);
  const codes = r.failures.map((f) => f.code);
  assert.deepStrictEqual(codes, ['S18']);
  assert.ok(!codes.some((c) => c.startsWith('G')));
  assert.ok(r.failures.some((f) => (
    f.code === 'S18'
    && f.message === 'imported document is out of gate scope'
    && f.file === `${BP_REL}/index.md`
  )));
});

test('S18: imported blueprint rejected without gate too', () => {
  const repo = mkRepo();
  writeImportedIndexes(repo);
  const r = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(r.ok, false);
  const codes = r.failures.map((f) => f.code);
  assert.deepStrictEqual(codes, ['S18']);
  assert.ok(!codes.some((c) => c.startsWith('G')));
});

test('S19: tasks.md with wrong type reports expected and actual', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.type = 'bouncer.review';
  t.resource = `${BP_REL}/tasks/001/tasks.md`;
  // review status enum에 맞춰 S6을 피하되, 경로 기대 type(tasks)과의 불일치는 남긴다.
  t.bouncer = {
    id: 'REVIEW-001',
    epic_id: '001',
    blueprint_id: '001',
    status: 'pending',
    review: { required: true },
  };
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  const s19 = res.failures.filter((f) => f.code === 'S19');
  const codes = res.failures.map((f) => f.code);
  assert.ok(codes.includes('S19'));
  assert.strictEqual(s19.length, 1);
  const msg = s19[0].message;
  assert.match(msg, /bouncer\.tasks/);
  assert.match(msg, /bouncer\.review/);
});

test('S19: paths without a location rule do not emit S19', () => {
  const outside = {
    type: 'bouncer.tasks',
    title: 't',
    description: 'd',
    resource: 'docs/notes.md',
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      affected_paths: ['src/'],
    },
  };
  const unknownBase = {
    ...outside,
    resource: `${BP_REL}/notes.md`,
  };
  for (const [data, rel] of [[outside, 'docs/notes.md'], [unknownBase, `${BP_REL}/notes.md`]]) {
    const failures = [];
    checkStructural({ data, rel }, failures);
    assert.ok(
      !failures.some((f) => f.code === 'S19'),
      `unexpected S19 on ${rel}: ${JSON.stringify(failures)}`,
    );
  }
});

function codesFor(scaleFields) {
  const failures = [];
  const data = {
    ...blueprintDoc(),
    bouncer: { ...blueprintDoc().bouncer, ...scaleFields },
  };
  checkStructural({ data, rel: `${BP_REL}/index.md` }, failures);
  return failures.map((f) => f.code);
}

function contextReviewDoc(bpRel = BP_REL) {
  return {
    type: 'bouncer.context_review',
    title: 'Context review',
    description: 'Context review for 001',
    resource: `${bpRel}/context-review.md`,
    tags: ['bouncer', 'context_review'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'CTXREVIEW-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'pending',
      context_review: { findings: [] },
    },
  };
}

test('context-review.md with matching type passes structural checks', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, `${BP_REL}/context-review.md`, contextReviewDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('S19: context-review.md with bouncer.review type reports expected and actual', () => {
  const repo = mkRepo();
  const doc = contextReviewDoc();
  doc.type = 'bouncer.review';
  // review enum·접두에 맞춰 S4/S6을 피하되, 경로 기대 type과의 불일치는 남긴다.
  doc.bouncer = {
    id: 'REVIEW-001',
    epic_id: '001',
    blueprint_id: '001',
    status: 'pending',
    review: { required: true },
  };
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, `${BP_REL}/context-review.md`, doc);
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  const s19 = res.failures.filter((f) => f.code === 'S19');
  assert.ok(res.failures.map((f) => f.code).includes('S19'));
  assert.strictEqual(s19.length, 1);
  assert.match(s19[0].message, /bouncer\.context_review/);
  assert.match(s19[0].message, /bouncer\.review/);
});

test('S20: scale missing or valid values pass; lite fails', () => {
  assert.deepStrictEqual(codesFor({}), []);
  assert.deepStrictEqual(codesFor({ scale: 'light' }), []);
  assert.deepStrictEqual(codesFor({ scale: 'full' }), []);
  assert.deepStrictEqual(codesFor({ scale: 'lite' }), ['S20']);
});

test('Distill structural checks ignore the single-file fallback and disabled routing', () => {
  const repo = mkRepo();
  writeRaw(repo, '.bouncer/Distill.md', '# legacy\n');
  writeDistillShard(repo, 'orphan', { paths: [], pulls: [] });

  const result = distillWarnings(repo, { routingEnabled: false });
  assert.deepStrictEqual(result.failures, []);
  assert.deepStrictEqual(result.warnings, []);
});

test('Distill structural checks report orphan, empty non-always, missing pulls, cycle, and source gaps', () => {
  const repo = mkRepo();
  writeDistillIndex(repo, ['a', 'b']);
  writeDistillShard(repo, 'a', { paths: [], pulls: ['missing'] });
  writeDistillShard(repo, 'b', { paths: ['docs/**'], pulls: ['a'] });
  writeDistillShard(repo, 'orphan', { paths: ['src/**'], pulls: [] });
  writeDistillShard(repo, 'a', { paths: [], pulls: ['missing', 'b'] });

  const result = distillWarnings(repo, { routingEnabled: false });
  const codes = result.warnings.map((entry) => entry.code);
  assert.ok(codes.includes('S21'), `orphan warning missing: ${JSON.stringify(result)}`);
  assert.ok(codes.includes('S22'), `empty warning missing: ${JSON.stringify(result)}`);
  assert.ok(codes.includes('S23'), `pull warning missing: ${JSON.stringify(result)}`);
  assert.ok(codes.includes('S24'), `cycle warning missing: ${JSON.stringify(result)}`);
  assert.ok(codes.includes('S25'), `source gap warning missing: ${JSON.stringify(result)}`);
  assert.deepStrictEqual(result.failures, []);
});

test('enabled Distill routing rejects every remaining structural warning', () => {
  const repo = mkRepo();
  writeDistillIndex(repo, ['source'], false);
  writeDistillShard(repo, 'source', { paths: ['docs/**'], pulls: [] });

  const result = distillWarnings(repo, { routingEnabled: true });
  assert.ok(result.warnings.length > 0);
  assert.deepStrictEqual(result.failures.map((entry) => entry.code), result.warnings.map((entry) => entry.code));
});

test('config-disabled Distill routing overrides an enabled index and stays fail-open', () => {
  const repo = mkRepo();
  writeDistillIndex(repo, ['source'], true);
  writeDistillShard(repo, 'source', { paths: ['docs/**'], pulls: [] });

  const result = checkDistillStructural({
    repoRoot: repo,
    config: {
      source_dirs: ['src'],
      distill: { routing_enabled: false },
    },
  });

  assert.strictEqual(result.routingEnabled, false);
  assert.ok(result.warnings.some((entry) => entry.code === 'S25'));
  assert.deepStrictEqual(result.failures, []);
});

test('Distill byte threshold is a warning, not a content limit', () => {
  const repo = mkRepo();
  writeDistillIndex(repo, ['source']);
  writeDistillShard(repo, 'source', { paths: ['src/**'], pulls: [], body: 'x'.repeat(20) });

  const result = distillWarnings(repo, { maxBytes: 1 });
  assert.ok(result.warnings.some((entry) => entry.code === 'S26'));
  assert.deepStrictEqual(result.failures, []);
});

test('public validation rejects active Distill structural warnings', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  writeRaw(repo, '.bouncer/config.json', `${JSON.stringify({
    source_dirs: ['src'],
    distill: { routing_enabled: true },
  })}\n`);
  writeDistillIndex(repo, ['source']);
  writeDistillShard(repo, 'source', { paths: ['docs/**'], pulls: [] });

  const result = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });

  assert.strictEqual(result.ok, false);
  assert.ok(result.failures.some((entry) => entry.code === 'S25'));
});

test('public validation stays fail-open when config disables enabled index routing', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  writeRaw(repo, '.bouncer/config.json', `${JSON.stringify({
    source_dirs: ['src'],
    distill: { routing_enabled: false },
  })}\n`);
  writeDistillIndex(repo, ['source'], true);
  writeDistillShard(repo, 'source', { paths: ['docs/**'], pulls: [] });

  const result = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });

  assert.strictEqual(result.ok, true);
  assert.ok(!result.failures.some((entry) => entry.code === 'S25'));
});
