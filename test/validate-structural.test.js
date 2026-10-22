'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateBlueprint, checkStructural, loadBlueprintDocs } = require('../scripts/lib/validate');
const { registerFixtureEpic } = require('./helpers/epic-registry');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
}

function writeRaw(repo, rel, content) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function writeDoc(repo, rel, data, body = '# x\n') {
  // blueprint index는 epic 등록부 항목과 attribution을 함께 채운다.
  const bpIndex = /epics\/(\d{3}-[^/]+)\/blueprints\/[^/]+\/index\.md$/.exec(rel);
  if (bpIndex && data && data.type === 'bouncer.blueprint') {
    registerFixtureEpic(repo, bpIndex[1]);
    data = { ...data, bouncer: { attribution: 'fixture', ...data.bouncer } };
  }
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
    return `* [${id} ${slug}](epics/${d}/index.md) - auth epic`;
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
    description: 'auth epic',
    resource: epicRel,
    tags: ['bouncer', 'epic'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id, epic_id: id, status: 'draft' },
  };
}

test('S1: missing OKF field → is reported', () => {
  const repo = mkRepo();
  const t = goodTasks();
  delete t.description;
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S1'));
});

test('S3/S6/S7 on resource, status, affected_paths problems → detect them', () => {
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

test('S4: → rejects child id that is not KIND-\\d{3}', () => {
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

test('S8 with leaf present but blueprint index absent → reports it', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S8'));
});

test('a fully valid numeric blueprint → passes structural checks', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('S5: legacy-prefixed frontmatter → fails on a canonical path', () => {
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

test('S10: legacy-prefixed blueprint path → is not canonical', () => {
  const repo = mkRepo();
  const legacyBp = '.bouncer/context/epics/' + 'EPIC-001-auth/blueprints/' + 'BP-001-login';
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: legacyBp });
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(res.failures.map((f) => f.code), ['S10']);
});

test('S5: legacy-prefixed epic id → fails even when digits match', () => {
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

test('S13 with epic directory missing from bundle context index → reports it', () => {
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

test('S13: bundle context index → lists a missing epic directory', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo, ['001-auth', '099-ghost']);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S13' && /missing epic/.test(f.message)));
});

test('S13: epic description → mismatch is reported as a summary mismatch', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const abs = path.join(repo, '.bouncer/context/index.md');
  fs.writeFileSync(abs, fs.readFileSync(abs, 'utf8').replace('auth epic', 'stale summary'));
  const failures = require('../scripts/lib/epic-index').checkEpicIndexConsistency({ repoRoot: repo });
  assert.ok(failures.some((f) => f.code === 'S13' && /summary mismatch/.test(f.message)));
});

test('S13: malformed or invalid epic frontmatter → reports the source error', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  const epicPath = path.join(repo, '.bouncer/context/epics/001-auth/index.md');
  writeRaw(repo, '.bouncer/context/epics/001-auth/index.md', '# malformed\n');
  writeBundleIndex(repo);
  let failures = require('../scripts/lib/epic-index').checkEpicIndexConsistency({ repoRoot: repo });
  assert.ok(failures.some((f) => f.code === 'S13' && /frontmatter/i.test(f.message)));
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', { ...epicDoc(), description: '   ' });
  failures = require('../scripts/lib/epic-index').checkEpicIndexConsistency({ repoRoot: repo });
  assert.ok(failures.some((f) => f.code === 'S13' && /description/i.test(f.message)));
  assert.ok(fs.existsSync(epicPath));
});

test('S13: legacy-prefixed epic directory alone → fails', () => {
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

test('S13: legacy-only tree → fails without a canonical epic present', () => {
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

test('S0: malformed frontmatter → is collected as a failure, not thrown', () => {
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

test('legacy sdd frontmatter → is rejected with bouncer-init guidance', () => {
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

test('structural check → ignores legacy scope evidence fields', () => {
  const t = goodTasks();
  t.bouncer.scope_evidence = { producer: 'other', basis: [] };
  t.bouncer.graph = { basis: '' };
  const failures = [];
  checkStructural({
    data: t,
    rel: '.bouncer/context/epics/001-auth/blueprints/001-login/tasks/001/tasks.md',
  }, failures);
  assert.deepStrictEqual(failures.filter((f) => f.code === 'S9'), []);
});

test('legacy root context blueprint → is not a canonical validation target', () => {
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
test('S11: a blueprint with no documents → is reported as absent, not as a gate failure', () => {
  const repo = mkRepo();
  for (const gate of [undefined, 'plan', 'execute', 'finalize']) {
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate });
    assert.strictEqual(res.ok, false, `gate ${gate} should fail`);
    assert.deepStrictEqual(res.failures.map((f) => f.code), ['S11'], `gate ${gate} codes`);
    assert.match(res.failures[0].message, /not found|absent|no documents/i);
    assert.strictEqual(res.failures[0].file, BP_REL);
  }
});

test('S11 → does not mask a partially scaffolded blueprint', () => {
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

test('S12: invalid tasks.bouncer.verify → is reported', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.bouncer.verify = 'cd x && npm test';
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S12'));
});

test('S12: unclosed quotes → are reported as invalid verify', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.bouncer.verify = 'node -e "unclosed';
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S12'));
});

test('S12: argv0 outside the default verify allowlist → is reported', () => {
  const repo = mkRepo();
  const t = goodTasks();
  t.bouncer.verify = 'curl https://example.invalid';
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S12'));
});

test('S12 when tasks.bouncer.verify is absent → does not fire', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(!res.failures.some((f) => f.code === 'S12'));
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('S5 with legacy tasks.md → expects TASKS-{blueprint id}', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(!res.failures.some((f) => f.code === 'S5'));
});

test('S5 with tasks-002.md → expects TASKS-002 (not blueprint id)', () => {
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

test('S5: wrong id on numbered tasks file → is rejected', () => {
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

test('S15: legacy root task files → are rejected', () => {
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

test('loadBlueprintDocs: empty tasks listing → falls back to tasks/001 not legacy root', () => {
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

test('S18: imported blueprint → is out of gate scope (plan)', () => {
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

test('S18 imported blueprint without gate → rejected too', () => {
  const repo = mkRepo();
  writeImportedIndexes(repo);
  const r = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(r.ok, false);
  const codes = r.failures.map((f) => f.code);
  assert.deepStrictEqual(codes, ['S18']);
  assert.ok(!codes.some((c) => c.startsWith('G')));
});

test('S19: tasks.md with wrong type → reports expected and actual', () => {
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

test('S19: paths without a location rule → do not emit S19', () => {
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

test('context-review.md with matching type → passes structural checks', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, `${BP_REL}/context-review.md`, contextReviewDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

function contextReviewWithDigest(digest) {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  const doc = contextReviewDoc();
  doc.bouncer.context_review.closure_target_digest = digest;
  writeDoc(repo, `${BP_REL}/context-review.md`, doc);
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  return validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
}

test('context-review closure_target_digest with 64 lowercase hex → passes structural checks', () => {
  assert.deepStrictEqual(contextReviewWithDigest('0123456789abcdef'.repeat(4)), { ok: true, failures: [] });
});

test('context-review closure_target_digest malformed → reports a structural error on the document', () => {
  for (const bad of ['ABCDEF'.repeat(11).slice(0, 64), 'abc123', 12345, '']) {
    const res = contextReviewWithDigest(bad);
    assert.strictEqual(res.ok, false, JSON.stringify(bad));
    assert.ok(
      res.failures.some((f) => f.code === 'S0' && f.file === `${BP_REL}/context-review.md`),
      JSON.stringify(bad),
    );
  }
});

test('S19: context-review.md with bouncer.review type → reports expected and actual', () => {
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

// 파일이 있는데 frontmatter 파싱이 깨지면 loader는 docs.contextReview를
// 비우고 S0만 남긴다. 통합 fixture로 그 S0이 context-review 경로에 하나만 남는지 고정한다.
test('plan gate: existing context-review with backtick-leading note → yields S0', () => {
  const repo = mkRepo();
  const epic = epicDoc();
  epic.bouncer.status = 'approved';
  const bp = blueprintDoc();
  bp.bouncer.status = 'approved';
  const tasks = goodTasks();
  tasks.bouncer.status = 'ready';
  tasks.bouncer.graph = { suggested_paths: ['src/'], basis: 'manual: src/' };
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epic);
  writeDoc(repo, `${BP_REL}/index.md`, bp);
  writeDoc(repo, `${BP_REL}/tasks.md`, tasks, `# Tasks

## Goal & intent
Ship login.

## Interface
api

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] a
`);
  writeRaw(repo, `${BP_REL}/context-review.md`, `---
type: bouncer.context_review
title: Context review
description: d
resource: ${BP_REL}/context-review.md
tags: [bouncer, context_review]
timestamp: '2026-07-01T00:00:00+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '001'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-1
        severity: minor
        status: accepted
        note: \`context-review.md\`가 존재함
---
# Context review

## Findings
(none)
`);
  writeBundleIndex(repo);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL, gate: 'plan' });
  const s0 = res.failures.filter((f) => f.code === 'S0' && f.file === `${BP_REL}/context-review.md`);
  assert.strictEqual(s0.length, 1);
});

test('S20: scale missing or valid values pass; lite → fails', () => {
  assert.deepStrictEqual(codesFor({}), []);
  assert.deepStrictEqual(codesFor({ scale: 'light' }), []);
  assert.deepStrictEqual(codesFor({ scale: 'full' }), []);
  assert.deepStrictEqual(codesFor({ scale: 'lite' }), ['S20']);
});

test('S27 supersedes missing or path arrays → pass; non-array and blank entries fail', () => {
  assert.deepStrictEqual(codesFor({}), []);
  assert.deepStrictEqual(codesFor({ supersedes: [] }), []);
  assert.deepStrictEqual(
    codesFor({ supersedes: ['.bouncer/context/epics/033-x/index.md'] }),
    [],
  );
  assert.deepStrictEqual(codesFor({ supersedes: '033' }), ['S27']);
  assert.deepStrictEqual(codesFor({ supersedes: [''] }), ['S27']);
  assert.deepStrictEqual(codesFor({ supersedes: ['  '] }), ['S27']);
  assert.deepStrictEqual(codesFor({ supersedes: [{}] }), ['S27']);

  const epicFailures = [];
  checkStructural(
    {
      data: {
        ...epicDoc(),
        bouncer: { ...epicDoc().bouncer, supersedes: '033' },
      },
      rel: '.bouncer/context/epics/001-auth/index.md',
    },
    epicFailures,
  );
  assert.deepStrictEqual(epicFailures.map((f) => f.code), ['S27']);

  const epicOk = [];
  checkStructural({ data: epicDoc(), rel: '.bouncer/context/epics/001-auth/index.md' }, epicOk);
  assert.ok(!epicOk.some((f) => f.code === 'S27'));
});

test('draft and approved blueprints → require a complete task unit bundle (S17)', () => {
  for (const status of ['draft', 'approved']) {
    const repo = mkRepo();
    writeDoc(repo, `${BP_REL}/index.md`, {
      ...blueprintDoc(),
      bouncer: { ...blueprintDoc().bouncer, status },
    });
    writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
    writeBundleIndex(repo);
    // verification만 두고 tasks/review를 빼면 열린 blueprint는 S17이어야 한다.
    writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
      type: 'bouncer.verification',
      title: 'Verified',
      description: 'd',
      resource: `${BP_REL}/tasks/001/verification.md`,
      tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending',
      },
    });
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
    assert.strictEqual(res.ok, false, `expected S17 for status=${status}`);
    assert.ok(
      res.failures.some((f) => f.code === 'S17' && /tasks\.md/.test(f.message)),
      `status=${status} failures: ${JSON.stringify(res.failures)}`,
    );
    assert.ok(
      res.failures.some((f) => f.code === 'S17' && /review\.md/.test(f.message)),
      `status=${status} failures: ${JSON.stringify(res.failures)}`,
    );
  }
});

test('closed blueprint allows compact layout without task → leaves or context-review.md', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(),
    bouncer: { ...blueprintDoc().bouncer, status: 'closed', scale: 'full' },
  });
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    ...epicDoc(),
    bouncer: { ...epicDoc().bouncer, status: 'approved' },
  });
  writeBundleIndex(repo);
  writeDoc(repo, `${BP_REL}/explain.md`, {
    type: 'bouncer.explain',
    title: 'Explain',
    description: 'd',
    resource: `${BP_REL}/explain.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'published',
      comprehension: [],
    },
  }, '# Explain\n');
  // closed 축약 — task leaf·context-review 없이 index+explain만 남긴다.
  assert.ok(!fs.existsSync(path.join(repo, `${BP_REL}/tasks/001/tasks.md`)));
  assert.ok(!fs.existsSync(path.join(repo, `${BP_REL}/tasks/001/verification.md`)));
  assert.ok(!fs.existsSync(path.join(repo, `${BP_REL}/tasks/001/review.md`)));
  assert.ok(!fs.existsSync(path.join(repo, `${BP_REL}/context-review.md`)));
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(res.ok, true, JSON.stringify(res.failures, null, 2));
  assert.ok(!res.failures.some((f) => f.code === 'S17'));
});

function writeTasksVerifyFixture(verify, config) {
  const repo = mkRepo();
  const t = goodTasks();
  if (verify !== undefined) t.bouncer.verify = verify;
  writeDoc(repo, `${BP_REL}/tasks.md`, t);
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  if (config !== undefined) {
    writeRaw(repo, '.bouncer/config.json', `${JSON.stringify(config)}\n`);
  }
  return repo;
}

test('S12: project allowlist bun → accepts bun test and rejects npm test', () => {
  const config = { verify: 'npm test', verify_allowlist: ['bun'] };
  const bunRepo = writeTasksVerifyFixture('bun test', config);
  const bunRes = validateBlueprint({ repoRoot: bunRepo, blueprintDir: BP_REL });
  assert.ok(
    !bunRes.failures.some((f) => f.code === 'S12'),
    `bun test should pass S12: ${JSON.stringify(bunRes.failures)}`,
  );

  const npmRepo = writeTasksVerifyFixture('npm test', config);
  const npmRes = validateBlueprint({ repoRoot: npmRepo, blueprintDir: BP_REL });
  assert.ok(
    npmRes.failures.some((f) => f.code === 'S12'),
    'npm test must fail S12 when verify_allowlist is only bun',
  );
});

test('S12: empty verify_allowlist, shell operators, and unclosed quotes → are rejected', () => {
  const emptyRepo = writeTasksVerifyFixture('npm test', {
    verify: 'npm test',
    verify_allowlist: [],
  });
  const emptyRes = validateBlueprint({ repoRoot: emptyRepo, blueprintDir: BP_REL });
  assert.ok(emptyRes.failures.some((f) => f.code === 'S12'));

  const shellRepo = writeTasksVerifyFixture('npm test && rm -rf /', {
    verify: 'npm test',
    verify_allowlist: ['npm'],
  });
  const shellRes = validateBlueprint({ repoRoot: shellRepo, blueprintDir: BP_REL });
  assert.ok(shellRes.failures.some((f) => f.code === 'S12'));

  const quoteRepo = writeTasksVerifyFixture('node -e "unclosed', {
    verify: 'npm test',
    verify_allowlist: ['node'],
  });
  const quoteRes = validateBlueprint({ repoRoot: quoteRepo, blueprintDir: BP_REL });
  assert.ok(quoteRes.failures.some((f) => f.code === 'S12'));
});

test('S12: missing config → uses the default allowlist', () => {
  const repo = writeTasksVerifyFixture('npm test');
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.ok(!res.failures.some((f) => f.code === 'S12'));
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('S12 with broken JSON and unreadable config → fail plan without default fallback', () => {
  const broken = writeTasksVerifyFixture('npm test');
  writeRaw(broken, '.bouncer/config.json', '{not json');
  const brokenRes = validateBlueprint({ repoRoot: broken, blueprintDir: BP_REL });
  assert.strictEqual(brokenRes.ok, false);
  assert.ok(
    brokenRes.failures.some((f) => f.code === 'S12'),
    `broken JSON must fail plan via S12: ${JSON.stringify(brokenRes.failures)}`,
  );

  const unreadable = writeTasksVerifyFixture('npm test', { verify: 'npm test' });
  const unreadablePath = path.join(unreadable, '.bouncer', 'config.json');
  fs.rmSync(unreadablePath);
  // 파일을 디렉터리로 바꿔 EACCES와 같이 readFileSync가 ENOENT가 아닌
  // 읽기 오류를 내게 한다. chmod 000은 root에서 여전히 읽을 수 있다.
  fs.mkdirSync(unreadablePath);
  const unreadableRes = validateBlueprint({ repoRoot: unreadable, blueprintDir: BP_REL });
  assert.strictEqual(unreadableRes.ok, false);
  assert.ok(
    unreadableRes.failures.some((f) => f.code === 'S12'),
    `read error must fail plan via S12: ${JSON.stringify(unreadableRes.failures)}`,
  );
});

test('light open blueprint still → requires the full task unit bundle', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/index.md`, {
    ...blueprintDoc(),
    bouncer: { ...blueprintDoc().bouncer, status: 'approved', scale: 'light' },
  });
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeBundleIndex(repo);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification',
    title: 'Verified',
    description: 'd',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending',
    },
  });
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(res.ok, false);
  assert.ok(res.failures.some((f) => f.code === 'S17'));
});

function taskDagFailures(extra = {}) {
  const failures = [];
  const base = goodTasks();
  const rel = `${BP_REL}/tasks/001/tasks.md`;
  checkStructural({
    data: {
      ...base,
      resource: rel,
      bouncer: { ...base.bouncer, ...extra },
    },
    rel,
  }, failures);
  return failures.filter((f) => f.code === 'S28');
}

test('S28 with absent DAG fields and valid shapes → pass; bad shape and enum fail', () => {
  // 부재는 기존 plan 호환 — S28을 내지 않는다.
  assert.deepStrictEqual(taskDagFailures({}), []);
  assert.deepStrictEqual(taskDagFailures({
    depends_on: [],
    parallel_safe: false,
    dependency_gate: 'integrated',
  }), []);
  assert.deepStrictEqual(taskDagFailures({
    depends_on: ['TASKS-002'],
    parallel_safe: true,
    dependency_gate: 'integrated',
  }), []);

  // integration-verified는 어떤 실행 경로도 만들지 못하는 상태였으므로 enum에서
  // 빠졌다. 계획자가 그 값을 다시 고르면 S28이 여기서 막는다.
  assert.deepStrictEqual(
    taskDagFailures({ dependency_gate: 'integration-verified' }).map((f) => f.message),
    ['dependency_gate "integration-verified" not in enum'],
  );

  assert.ok(taskDagFailures({ depends_on: 'TASKS-002' }).length >= 1);
  assert.ok(taskDagFailures({ depends_on: [123] }).length >= 1);
  assert.ok(taskDagFailures({ depends_on: ['002'] }).length >= 1);
  assert.ok(taskDagFailures({ depends_on: ['TASKS-2'] }).length >= 1);
  assert.ok(taskDagFailures({ parallel_safe: 'yes' }).length >= 1);
  assert.ok(taskDagFailures({ parallel_safe: 1 }).length >= 1);
  assert.ok(taskDagFailures({ dependency_gate: 'done' }).length >= 1);
  assert.ok(taskDagFailures({ dependency_gate: 'Integrated' }).length >= 1);

  // exclusive_resources: 부재·빈 배열·유효 id는 통과. 비배열·빈 문자열·대문자·중복은 거절.
  assert.deepStrictEqual(taskDagFailures({ exclusive_resources: [] }), []);
  assert.deepStrictEqual(taskDagFailures({ exclusive_resources: ['database-schema', 'lock.a'] }), []);
  assert.ok(taskDagFailures({ exclusive_resources: 'database-schema' })
    .some((f) => f.message === 'exclusive_resources must be an array of unique resource ids'));
  assert.ok(taskDagFailures({ exclusive_resources: [''] })
    .some((f) => f.message === 'exclusive_resources must be an array of unique resource ids'));
  assert.ok(taskDagFailures({ exclusive_resources: ['Database'] })
    .some((f) => f.message === 'exclusive_resources must be an array of unique resource ids'));
  assert.ok(taskDagFailures({ exclusive_resources: ['a b'] })
    .some((f) => f.message === 'exclusive_resources must be an array of unique resource ids'));
  assert.ok(taskDagFailures({ exclusive_resources: ['database-schema', 'database-schema'] })
    .some((f) => f.message === 'exclusive_resources must be an array of unique resource ids'));
});

test('S29: verification execution_kind → requires empty scope, fan-in metadata, and executable verify', () => {
  const failuresFor = (extra) => {
    const failures = [];
    const base = goodTasks();
    const rel = `${BP_REL}/tasks/001/tasks.md`;
    checkStructural({ data: { ...base, resource: rel, bouncer: { ...base.bouncer, ...extra } }, rel }, failures);
    return failures.filter((f) => f.code === 'S29');
  };
  assert.deepStrictEqual(failuresFor({
    execution_kind: 'verification', affected_paths: [], depends_on: ['TASKS-002'],
    parallel_safe: false, dependency_gate: 'integrated', verify: 'node --test',
  }), []);
  for (const extra of [
    { execution_kind: 'other' },
    { execution_kind: 'verification', affected_paths: ['src/a'], depends_on: ['TASKS-002'], parallel_safe: false, dependency_gate: 'integrated', verify: 'node --test' },
    { execution_kind: 'verification', affected_paths: [], depends_on: [], parallel_safe: false, dependency_gate: 'integrated', verify: 'node --test' },
    { execution_kind: 'verification', affected_paths: [], depends_on: ['TASKS-002'], parallel_safe: true, dependency_gate: 'integrated', verify: 'node --test' },
    { execution_kind: 'verification', affected_paths: [], depends_on: ['TASKS-002'], parallel_safe: false, dependency_gate: 'integrated', verify: '' },
  ]) assert.ok(failuresFor(extra).length > 0, JSON.stringify(extra));
  assert.ok(failuresFor({ execution_kind: 'commit', status: 'integrated' }).length > 0);
});

test('S30: review_risk must be a unique enum array; absent → is legacy-compatible', () => {
  const failuresFor = (extra) => {
    const failures = [];
    const base = goodTasks();
    const rel = `${BP_REL}/tasks/001/tasks.md`;
    checkStructural({ data: { ...base, resource: rel, bouncer: { ...base.bouncer, ...extra } }, rel }, failures);
    return failures.filter((f) => f.code === 'S30');
  };
  assert.deepStrictEqual(failuresFor({}), []);
  assert.deepStrictEqual(failuresFor({ review_risk: [] }), []);
  assert.deepStrictEqual(failuresFor({
    review_risk: ['public_interface', 'authentication', 'authorization', 'credential'],
  }), []);
  assert.ok(failuresFor({ review_risk: 'public_interface' }).some((f) => /must be an array/.test(f.message)));
  assert.ok(failuresFor({ review_risk: ['mystery'] }).some((f) => /value invalid/.test(f.message)));
  assert.ok(failuresFor({
    review_risk: ['public_interface', 'public_interface'],
  }).some((f) => /duplicate/.test(f.message)));
});

function rootReviewDoc(overrides = {}) {
  return {
    type: 'bouncer.review',
    title: 'Blueprint review',
    description: 'root review',
    resource: `${BP_REL}/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'pending',
    },
    ...overrides,
  };
}

test('root review.md → expects bouncer.review and REVIEW-<blueprint id>', () => {
  const ok = [];
  checkStructural({ data: rootReviewDoc(), rel: `${BP_REL}/review.md` }, ok);
  assert.ok(!ok.some((f) => f.code === 'S19' || f.code === 'S5'), JSON.stringify(ok));

  const wrongType = [];
  checkStructural({
    data: { ...rootReviewDoc(), type: 'bouncer.explain' },
    rel: `${BP_REL}/review.md`,
  }, wrongType);
  assert.ok(wrongType.some((f) => f.code === 'S19'), JSON.stringify(wrongType));

  const wrongId = [];
  checkStructural({
    data: {
      ...rootReviewDoc(),
      bouncer: { ...rootReviewDoc().bouncer, id: 'REVIEW-002' },
    },
    rel: `${BP_REL}/review.md`,
  }, wrongId);
  assert.ok(wrongId.some((f) => f.code === 'S5'), JSON.stringify(wrongId));
});

test('S32 commit_intent and commit_summary as scalars → rejected; must be YAML lists', () => {
  const failuresFor = (extra) => {
    const failures = [];
    const base = goodTasks();
    const rel = `${BP_REL}/tasks/001/tasks.md`;
    checkStructural({ data: { ...base, resource: rel, bouncer: { ...base.bouncer, ...extra } }, rel }, failures);
    return failures.filter((f) => f.code === 'S32');
  };
  assert.deepStrictEqual(failuresFor({}), []);
  assert.deepStrictEqual(failuresFor({ commit_intent: [] }), []);
  assert.deepStrictEqual(failuresFor({ commit_intent: ['한 문장임'] }), []);
  assert.deepStrictEqual(failuresFor({
    commit_intent: ['한 문장임', '두 문장임'],
    commit_summary: ['요약함'],
  }), []);
  assert.ok(failuresFor({ commit_intent: '한 문장임' }).some((f) => /commit_intent.*YAML list/.test(f.message)));
  assert.ok(failuresFor({ commit_summary: '요약함' }).some((f) => /commit_summary.*YAML list/.test(f.message)));
  assert.ok(failuresFor({ commit_intent: ['a', 'b', 'c'] }).length > 0);
  assert.ok(failuresFor({ commit_intent: [1] }).length > 0);
});

test('S31: review_scope other than blueprint → is rejected', () => {
  const failures = [];
  const data = {
    ...blueprintDoc(),
    bouncer: { ...blueprintDoc().bouncer, review_scope: 'task' },
  };
  checkStructural({ data, rel: `${BP_REL}/index.md` }, failures);
  assert.ok(failures.some((f) => (
    f.code === 'S31' && f.message === 'review_scope must be blueprint'
  )), JSON.stringify(failures));
});

// S36: area·attribution은 선택 키다. 부재는 통과하고, 있는 값의 모양만 거절한다.
function s36For(patch) {
  const failures = [];
  const data = {
    ...blueprintDoc(),
    bouncer: { ...blueprintDoc().bouncer, ...patch },
  };
  checkStructural({ data, rel: `${BP_REL}/index.md` }, failures);
  return failures.filter((f) => f.code === 'S36');
}

test('S36: blueprint area or attribution with a wrong shape → is rejected', () => {
  for (const patch of [
    { area: 3 },
    { area: 'A B' },
    { area: '' },
    { attribution: '  ' },
    { attribution: 7 },
    { attribution: 'a\nb' },
  ]) {
    assert.strictEqual(s36For(patch).length, 1, JSON.stringify(patch));
  }
});

test('S36: valid area and attribution or neither key → is not reported', () => {
  assert.deepStrictEqual(s36For({}), []);
  assert.deepStrictEqual(s36For({ area: 'ordering', attribution: '주문 기능 동작이 중심' }), []);
});

// --- slug 형식 경로: S5는 경로 slug와 비교하고, S37이 order·slug·형식 혼용을 본다 ---
const SLUG_EPIC_REL = '.bouncer/context/epics/plan-workflow';
const SLUG_BP_REL = `${SLUG_EPIC_REL}/blueprints/registry-gates`;

function slugEpicDoc(slug = 'plan-workflow') {
  const rel = `.bouncer/context/epics/${slug}/index.md`;
  return {
    type: 'bouncer.epic',
    title: 'Plan workflow',
    description: 'auth epic',
    resource: rel,
    tags: ['bouncer', 'epic'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: slug, epic_id: slug, status: 'draft' },
  };
}

function slugBlueprintDoc(bpRel = SLUG_BP_REL, overrides = {}) {
  const slug = bpRel.split('/').pop();
  const doc = {
    type: 'bouncer.blueprint',
    title: 'Registry gates',
    description: slug,
    resource: `${bpRel}/index.md`,
    tags: ['bouncer', 'blueprint'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: slug, epic_id: 'plan-workflow', blueprint_id: slug, status: 'draft', order: 1, ...overrides,
    },
  };
  // 값이 undefined인 키는 YAML로 쓸 수 없으니 키 자체를 뺀다(부재를 만들기 위한 표기).
  if (doc.bouncer.order === undefined) delete doc.bouncer.order;
  return doc;
}

function slugTasksDoc(bpRel = SLUG_BP_REL) {
  const slug = bpRel.split('/').pop();
  const rel = `${bpRel}/tasks/001/tasks.md`;
  return {
    ...goodTasks(bpRel),
    resource: rel,
    bouncer: {
      id: 'TASKS-001', epic_id: 'plan-workflow', blueprint_id: slug, status: 'ready', affected_paths: ['src/auth/'],
    },
  };
}

function writeSlugBundleIndex(repo, slugs = ['plan-workflow']) {
  const lines = slugs.map((s) => `* [${s}](epics/${s}/index.md) - auth epic`);
  writeRaw(repo, '.bouncer/context/index.md', `---\nokf_version: "0.1"\n---\n# Epics\n\n${lines.join('\n')}\n`);
}

function slugRepo(overrides = {}) {
  const repo = mkRepo();
  writeDoc(repo, `${SLUG_BP_REL}/tasks/001/tasks.md`, slugTasksDoc());
  for (const [kind, id] of [['verification', 'VERIFY-001'], ['review', 'REVIEW-001']]) {
    const leaf = `${SLUG_BP_REL}/tasks/001/${kind}.md`;
    writeDoc(repo, leaf, {
      type: `bouncer.${kind}`,
      title: kind,
      description: kind,
      resource: leaf,
      tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id, epic_id: 'plan-workflow', blueprint_id: 'registry-gates', status: 'pending',
        ...(kind === 'review' ? { review: { required: true } } : {}),
      },
    });
  }
  writeDoc(repo, `${SLUG_BP_REL}/index.md`, slugBlueprintDoc(SLUG_BP_REL, overrides));
  writeDoc(repo, `${SLUG_EPIC_REL}/index.md`, slugEpicDoc());
  writeSlugBundleIndex(repo);
  return repo;
}

function s37Kinds(res) {
  return res.failures.filter((f) => f.code === 'S37').map((f) => /order-missing|order-invalid|order-duplicate|slug-invalid|slug-duplicate|format-mixed/.exec(f.message)?.[0]);
}

test('a fully valid slug blueprint → passes structural checks', () => {
  const repo = slugRepo();
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});

test('S5 on a slug path with a different blueprint_id → fails', () => {
  const repo = slugRepo({ blueprint_id: 'other-gates' });
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S5' && /blueprint_id other-gates != path registry-gates/.test(f.message)));
});

test('S5 on a slug path with a numeric epic_id → fails', () => {
  const repo = slugRepo({ epic_id: '001' });
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S5' && /epic_id 001 != path plan-workflow/.test(f.message)));
});

test('S37 on a slug blueprint without order → reports order-missing', () => {
  const repo = slugRepo({ order: undefined });
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.deepStrictEqual(s37Kinds(res), ['order-missing']);
});

test('S37 on a slug blueprint with a non-positive-integer order → reports order-invalid', () => {
  for (const order of [0, -2, 1.5, '2', true, null]) {
    const repo = slugRepo({ order });
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
    // null은 YAML에서 키는 있으나 값이 없는 형태라 부재가 아니라 잘못된 값이다.
    assert.deepStrictEqual(s37Kinds(res), ['order-invalid'], String(order));
  }
});

test('S37 on a slug blueprint sharing an order with a sibling → reports order-duplicate', () => {
  const repo = slugRepo({ order: 2 });
  writeDoc(repo, `${SLUG_EPIC_REL}/blueprints/other-one/index.md`, slugBlueprintDoc(`${SLUG_EPIC_REL}/blueprints/other-one`, { order: 2 }));
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.deepStrictEqual(s37Kinds(res), ['order-duplicate']);
});

test('S37 on a slug blueprint with gapped sibling orders → passes', () => {
  const repo = slugRepo({ order: 2 });
  writeDoc(repo, `${SLUG_EPIC_REL}/blueprints/other-one/index.md`, slugBlueprintDoc(`${SLUG_EPIC_REL}/blueprints/other-one`, { order: 7 }));
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.deepStrictEqual(s37Kinds(res), []);
});

test('S37 on a slug blueprint whose slug is used by a sibling document → reports slug-duplicate', () => {
  const repo = slugRepo({ order: 1 });
  writeDoc(repo, `${SLUG_EPIC_REL}/blueprints/copied-dir/index.md`, slugBlueprintDoc(
    `${SLUG_EPIC_REL}/blueprints/copied-dir`,
    { order: 2, id: 'registry-gates', blueprint_id: 'registry-gates' },
  ));
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.ok(s37Kinds(res).includes('slug-duplicate'));
});

test('S37 on a slug epic with a blueprint directory that breaks the slug rule → reports slug-invalid instead of S10', () => {
  const repo = mkRepo();
  for (const name of ['a'.repeat(41), 'Bad_Name']) {
    const res = validateBlueprint({ repoRoot: repo, blueprintDir: `${SLUG_EPIC_REL}/blueprints/${name}` });
    assert.deepStrictEqual(res.failures.map((f) => f.code), ['S37'], name);
    assert.match(res.failures[0].message, /slug-invalid/, name);
  }
});

test('S37 on a slug epic with a numeric blueprint directory → reports format-mixed instead of S10', () => {
  const repo = mkRepo();
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: `${SLUG_EPIC_REL}/blueprints/001-login` });
  assert.deepStrictEqual(res.failures.map((f) => f.code), ['S37']);
  assert.match(res.failures[0].message, /format-mixed/);
});

test('S37 on a numeric epic with a slug blueprint directory → reports format-mixed instead of S10', () => {
  const repo = mkRepo();
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: '.bouncer/context/epics/001-auth/blueprints/login' });
  assert.deepStrictEqual(res.failures.map((f) => f.code), ['S37']);
  assert.match(res.failures[0].message, /format-mixed/);
});

test('S13 with a slug epic directory missing from the bundle index → reports it', () => {
  const repo = slugRepo();
  writeRaw(repo, '.bouncer/context/index.md', '---\nokf_version: "0.1"\n---\n# Epics\n\n');
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S13' && /not listed/.test(f.message)));
});

test('S13 with a bundle index linking a missing slug epic → reports it', () => {
  const repo = slugRepo();
  writeSlugBundleIndex(repo, ['plan-workflow', 'ghost-epic']);
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: SLUG_BP_REL });
  assert.ok(res.failures.some((f) => f.code === 'S13' && /missing epic directory: ghost-epic/.test(f.message)));
});

test('numeric and slug epics side by side → both are listed and the numeric blueprint stays valid', () => {
  const repo = mkRepo();
  writeDoc(repo, `${BP_REL}/tasks.md`, goodTasks());
  writeDoc(repo, `${BP_REL}/index.md`, blueprintDoc());
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', epicDoc());
  writeDoc(repo, `${SLUG_EPIC_REL}/index.md`, slugEpicDoc());
  writeRaw(repo, '.bouncer/context/index.md', [
    '---', 'okf_version: "0.1"', '---', '# Epics', '',
    '* [001 auth](epics/001-auth/index.md) - auth epic',
    '* [plan-workflow](epics/plan-workflow/index.md) - auth epic', '',
  ].join('\n'));
  const res = validateBlueprint({ repoRoot: repo, blueprintDir: BP_REL });
  assert.deepStrictEqual(res, { ok: true, failures: [] });
});
