'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateBlueprint } = require('../scripts/lib/validate');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
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
