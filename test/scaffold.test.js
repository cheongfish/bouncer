'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
const { readDoc } = require('../scripts/lib/frontmatter');

const TS = '2026-07-01T00:00:00+09:00';

test('scaffoldEpic writes a valid epic index', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const legacyIndex = path.join(repo, 'context/epics/EPIC-999-legacy/index.md');
  fs.mkdirSync(path.dirname(legacyIndex), { recursive: true });
  fs.writeFileSync(legacyIndex, 'legacy content\n');
  const created = scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  assert.strictEqual(CONTEXT_ROOT, '.bouncer/context');
  assert.deepStrictEqual(created, ['.bouncer/context/epics/EPIC-001-auth/index.md']);
  const { data } = readDoc(path.join(repo, created[0]));
  assert.strictEqual(data.type, 'bouncer.epic');
  assert.strictEqual(data.bouncer.id, 'EPIC-001');
  assert.strictEqual(data.bouncer.status, 'draft');
  assert.strictEqual(data.resource, created[0]);
  assert.strictEqual(fs.readFileSync(legacyIndex, 'utf8'), 'legacy content\n');
});

test('scaffoldBlueprint writes all five docs with correct ids and statuses', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  const created = scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  });
  assert.strictEqual(created.length, 5);
  const base = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';
  assert.deepStrictEqual(created, [
    `${base}/index.md`,
    `${base}/tasks.md`,
    `${base}/verification.md`,
    `${base}/review.md`,
    `${base}/distill.md`,
  ]);
  const tasks = readDoc(path.join(repo, `${base}/tasks.md`)).data;
  assert.strictEqual(tasks.resource, `${base}/tasks.md`);
  assert.strictEqual(tasks.bouncer.id, 'TASKS-BP-001');
  assert.strictEqual(tasks.bouncer.status, 'draft');
  assert.deepStrictEqual(tasks.bouncer.affected_paths, []);
  assert.ok(typeof tasks.bouncer.graph.basis === 'string');
  const review = readDoc(path.join(repo, `${base}/review.md`)).data;
  assert.strictEqual(review.bouncer.review.required, true);
  const verify = readDoc(path.join(repo, `${base}/verification.md`)).data;
  assert.strictEqual(verify.bouncer.status, 'pending');
});

// The headings are the skeleton the gates look for; they stay empty on purpose
// so G10/G13/G14 still require an author to fill them in.
test('scaffolded bodies carry the section skeleton the gates require', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';
  const bodyOf = (rel) => readDoc(path.join(repo, rel)).body;

  const tasks = bodyOf(`${base}/tasks.md`);
  for (const heading of [
    '## Goal & intent', '## Interface', '## Touch', '## Do not touch', '## Checklist',
  ]) {
    assert.ok(tasks.includes(heading), `tasks.md missing ${heading}`);
  }
  const verification = bodyOf(`${base}/verification.md`);
  assert.ok(verification.includes('## Command'));
  assert.ok(verification.includes('## Evidence'));
  assert.ok(bodyOf(`${base}/review.md`).includes('## Findings'));
});

test('scaffoldBlueprint renders bodies from .bouncer/templates when present', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fs.mkdirSync(path.join(repo, '.bouncer/templates'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/templates/tasks.md'),
    '# <BP-id> <name> tasks\n\n## Goal & intent\nteam-specific prompt\n',
  );
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';
  const tasks = readDoc(path.join(repo, `${base}/tasks.md`)).body;
  assert.ok(tasks.includes('team-specific prompt'));
  assert.ok(tasks.includes('# BP-001 login tasks'), `placeholders not substituted: ${tasks}`);
});

test('scaffoldEpic renders its body from .bouncer/templates when present', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fs.mkdirSync(path.join(repo, '.bouncer/templates'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/templates/epic.md'),
    '# <EPIC-id> <name>\n\nhouse epic template\n',
  );
  const created = scaffoldEpic({
    repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS,
  });
  const body = readDoc(path.join(repo, created[0])).body;
  assert.ok(body.includes('house epic template'));
  assert.ok(body.includes('# EPIC-001 auth'));
});

test('scaffoldBlueprint leaves graph.basis empty so G4 needs recorded evidence', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';
  const tasks = readDoc(path.join(repo, `${base}/tasks.md`)).data;
  assert.strictEqual(tasks.bouncer.graph.basis, '');
});

test('scaffoldBlueprint rejects a root context epic directory', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  assert.throws(() => scaffoldBlueprint({
    repoRoot: repo, epicDir: 'context/epics/EPIC-001-auth',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  }), /epicDir must be under \.bouncer\/context\/epics/);
  assert.ok(!fs.existsSync(path.join(repo, 'context')));
});

test('scaffoldBlueprint rejects backslash traversal outside the canonical epic', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  assert.throws(() => scaffoldBlueprint({
    repoRoot: repo,
    epicDir: '.bouncer/context/epics/EPIC-001-auth\\..\\..\\escaped',
    blueprintId: 'BP-001', name: 'login', timestamp: TS,
  }), /epicDir must be under \.bouncer\/context\/epics/);
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer')));
});
