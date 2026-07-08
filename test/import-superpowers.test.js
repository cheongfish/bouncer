'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseSuperpowers } = require('../scripts/lib/import-superpowers');

const PLAN = `# Widget Implementation Plan

**Goal:** Build a widget.

**Architecture:** Two files.

---

### Task 1: Core

- [ ] Step 1: do the thing

### Task 2: Wire

- [ ] Step 1: wire it
`;

const SPEC = `# Widget design

Some design prose describing the widget.
`;

test('parseSuperpowers splits a plan into blueprint body and tasks body', () => {
  const r = parseSuperpowers(PLAN);
  assert.strictEqual(r.title, 'Widget');
  assert.strictEqual(r.hasTasks, true);
  assert.ok(r.blueprintBody.includes('**Goal:**'));
  assert.ok(!r.blueprintBody.includes('### Task'));
  assert.ok(r.tasksBody.startsWith('# Tasks'));
  assert.ok(r.tasksBody.includes('### Task 1: Core'));
  assert.ok(r.tasksBody.includes('### Task 2: Wire'));
});

test('parseSuperpowers defaults title to Imported when markdown has no level-1 heading', () => {
  const r = parseSuperpowers('Some prose with no heading.\n');
  assert.strictEqual(r.title, 'Imported');
});

test('parseSuperpowers on a spec with no tasks uses a stub tasks body', () => {
  const r = parseSuperpowers(SPEC);
  assert.strictEqual(r.title, 'Widget');
  assert.strictEqual(r.hasTasks, false);
  assert.ok(r.blueprintBody.includes('design prose'));
  assert.strictEqual(r.tasksBody, '# Tasks\n\n- [ ] TODO\n');
});

const { suggestedPathsFrom } = require('../scripts/lib/import-superpowers');

test('suggestedPathsFrom keeps only source-dir file paths, stripping line refs', () => {
  const text = [
    'Touch `src/lib/foo.js` and `test/foo.test.js:12-20`.',
    'Also `docs/notes.md`, `bareword`, and `src/lib/foo.js` again.',
  ].join('\n');
  const got = suggestedPathsFrom(text, ['src', 'test']);
  assert.deepStrictEqual(got, ['src/lib/foo.js', 'test/foo.test.js']);
});

test('suggestedPathsFrom defaults sourceDirs to src and test', () => {
  const got = suggestedPathsFrom('`src/a.js` `lib/b.js`', []);
  assert.deepStrictEqual(got, ['src/a.js']);
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { importSuperpowers } = require('../scripts/lib/import-superpowers');
const { readDoc } = require('../scripts/lib/frontmatter');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-import-'));
}

test('importSuperpowers scaffolds docs, injects bodies, seeds graph, preserves frontmatter', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  const planText = `# Widget Implementation Plan

**Goal:** Build a widget touching \`src/widget.js\` and \`test/widget.test.js\`.

---

### Task 1: Core

- [ ] Step 1: do the thing
`;
  fs.writeFileSync(path.join(repo, 'docs/plan.md'), planText);

  const res = importSuperpowers({
    repoRoot: repo,
    planPath: 'docs/plan.md',
    epicId: 'EPIC-001',
    epicName: 'widgets',
    blueprintId: 'BP-001',
    name: 'core',
    timestamp: '2026-07-08T00:00:00.000Z',
  });

  assert.strictEqual(res.ok, true);
  const base = 'context/epics/EPIC-001-widgets/blueprints/BP-001-core';
  assert.strictEqual(res.blueprintDir, base);
  assert.ok(res.created.includes(`${base}/tasks.md`));

  const bp = readDoc(path.join(repo, `${base}/index.md`));
  assert.strictEqual(bp.data.type, 'sdd.blueprint');
  assert.strictEqual(bp.data.sdd.status, 'draft'); // frontmatter preserved, no transition
  assert.ok(bp.body.includes('**Goal:**'));
  assert.ok(!bp.body.includes('### Task'));

  const tasks = readDoc(path.join(repo, `${base}/tasks.md`));
  assert.strictEqual(tasks.data.sdd.id, 'TASKS-BP-001'); // frontmatter preserved
  assert.ok(tasks.body.includes('### Task 1: Core'));
  assert.deepStrictEqual(tasks.data.sdd.graph.suggested_paths, ['src/widget.js', 'test/widget.test.js']);
  assert.deepStrictEqual(tasks.data.sdd.affected_paths, []); // left for user confirmation
  assert.deepStrictEqual(res.proposed_affected_paths, ['src/widget.js', 'test/widget.test.js']);

  // source file untouched
  assert.strictEqual(fs.readFileSync(path.join(repo, 'docs/plan.md'), 'utf8'), planText);
});

test('importSuperpowers reuses an existing epic dir when given', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/spec.md'), '# Thing design\n\nProse.\n');
  const { scaffoldEpic } = require('../scripts/lib/scaffold');
  scaffoldEpic({ repoRoot: repo, epicId: 'EPIC-002', name: 'auth', timestamp: '2026-07-08T00:00:00.000Z' });

  const res = importSuperpowers({
    repoRoot: repo,
    specPath: 'docs/spec.md',
    epicDir: 'context/epics/EPIC-002-auth',
    blueprintId: 'BP-003',
    name: 'login',
    timestamp: '2026-07-08T00:00:00.000Z',
  });
  assert.strictEqual(res.blueprintDir, 'context/epics/EPIC-002-auth/blueprints/BP-003-login');
  assert.ok(!res.created.some((r) => r.endsWith('EPIC-002-auth/index.md'))); // epic not re-created
});
