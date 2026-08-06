'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listTasksDocs, expectedTasksId, isNumberedTasksBasename } = require('../scripts/lib/tasks-docs');

const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

function mkBp(names) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-tasks-'));
  const abs = path.join(repo, BP);
  fs.mkdirSync(abs, { recursive: true });
  for (const name of names) {
    fs.writeFileSync(path.join(abs, name), `# ${name}\n`);
  }
  return repo;
}

test('listTasksDocs: legacy tasks.md alone yields a single legacy entry', () => {
  const repo = mkBp(['tasks.md', 'index.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.strictEqual(result.legacy, true);
  assert.strictEqual(result.mixed, false);
  assert.deepStrictEqual(result.entries, [{
    rel: `${BP}/tasks.md`,
    id: 'TASKS-001',
    basename: 'tasks.md',
    number: null,
  }]);
});

test('listTasksDocs: numbered tasks sort ascending and skip gaps', () => {
  const repo = mkBp(['tasks-003.md', 'tasks-001.md', 'index.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.strictEqual(result.legacy, false);
  assert.strictEqual(result.mixed, false);
  assert.deepStrictEqual(
    result.entries.map((e) => e.basename),
    ['tasks-001.md', 'tasks-003.md'],
  );
  assert.deepStrictEqual(
    result.entries.map((e) => e.id),
    ['TASKS-001', 'TASKS-003'],
  );
  assert.deepStrictEqual(
    result.entries.map((e) => e.number),
    [1, 3],
  );
});

test('listTasksDocs: mixing tasks.md and numbered files sets mixed', () => {
  const repo = mkBp(['tasks.md', 'tasks-001.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.strictEqual(result.mixed, true);
  assert.strictEqual(result.legacy, false);
  assert.ok(result.entries.some((e) => e.basename === 'tasks.md'));
  assert.ok(result.entries.some((e) => e.basename === 'tasks-001.md'));
});

test('listTasksDocs: tasks-1.md (non-padded) is excluded', () => {
  const repo = mkBp(['tasks-1.md', 'tasks-001.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.deepStrictEqual(
    result.entries.map((e) => e.basename),
    ['tasks-001.md'],
  );
  assert.strictEqual(isNumberedTasksBasename('tasks-1.md'), false);
  assert.strictEqual(isNumberedTasksBasename('tasks-001.md'), true);
});

test('listTasksDocs: empty blueprint directory yields empty list', () => {
  const repo = mkBp(['index.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.deepStrictEqual(result.entries, []);
  assert.strictEqual(result.mixed, false);
  assert.strictEqual(result.legacy, false);
});

test('expectedTasksId derives from basename (legacy uses blueprint id)', () => {
  assert.strictEqual(expectedTasksId('tasks.md', '014'), 'TASKS-014');
  assert.strictEqual(expectedTasksId('tasks-002.md', '014'), 'TASKS-002');
});
