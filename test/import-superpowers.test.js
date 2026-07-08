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
