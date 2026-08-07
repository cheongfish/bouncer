'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  listTasksDocs, expectedTasksId, expectedTaskDocIds, isNumberedTasksBasename,
} = require('../scripts/lib/tasks-docs');

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

/** `<bp>/tasks/<NNN>/` 묶음 fixture. 세 문서 파일만 만들어 리졸버 이름 판정을 본다. */
function mkTaskDirs(nnns, { extraDirs = [] } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-tasks-'));
  const abs = path.join(repo, BP);
  fs.mkdirSync(abs, { recursive: true });
  fs.writeFileSync(path.join(abs, 'index.md'), '# index\n');
  for (const nnn of nnns) {
    const dir = path.join(abs, 'tasks', nnn);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ['tasks.md', 'verification.md', 'review.md']) {
      fs.writeFileSync(path.join(dir, name), `# ${name}\n`);
    }
  }
  for (const name of extraDirs) {
    fs.mkdirSync(path.join(abs, 'tasks', name), { recursive: true });
  }
  return repo;
}

test('listTasksDocs: legacy tasks.md alone yields a single legacy entry', () => {
  const repo = mkBp(['tasks.md', 'index.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.strictEqual(result.legacy, true);
  assert.strictEqual(result.mixed, false);
  assert.deepEqual(result.invalidDirs, []);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].dir, null);
  assert.equal(result.entries[0].number, null);
  assert.equal(result.entries[0].tasks.rel, `${BP}/tasks.md`);
  assert.equal(result.entries[0].tasks.id, 'TASKS-001');
  assert.equal(result.entries[0].verification.rel, `${BP}/verification.md`);
  assert.equal(result.entries[0].review.rel, `${BP}/review.md`);
  // 호환 별칭 — consumers 가 아직 entry.rel / entry.id 를 읽는다.
  assert.equal(result.entries[0].rel, `${BP}/tasks.md`);
  assert.equal(result.entries[0].id, 'TASKS-001');
  assert.equal(result.entries[0].basename, 'tasks.md');
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
  assert.ok(result.entries.every((e) => e.dir === null));
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
  assert.deepEqual(result.invalidDirs, []);
});

test('expectedTasksId derives from basename (legacy uses blueprint id)', () => {
  assert.strictEqual(expectedTasksId('tasks.md', '014'), 'TASKS-014');
  assert.strictEqual(expectedTasksId('tasks-002.md', '014'), 'TASKS-002');
});

test('listTasksDocs: tasks/<NNN>/ units yield paired paths and ids', () => {
  const repo = mkTaskDirs(['001', '002']);
  const { entries, invalidDirs } = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].dir, `${BP}/tasks/001`);
  assert.equal(entries[0].tasks.rel, `${BP}/tasks/001/tasks.md`);
  assert.equal(entries[0].verification.id, 'VERIFY-001');
  assert.equal(entries[1].review.id, 'REVIEW-002');
  assert.deepEqual(invalidDirs, []);
});

test('listTasksDocs: non-padded task dirs land in invalidDirs only', () => {
  const repo = mkTaskDirs(['001', '002'], { extraDirs: ['01', 'foo'] });
  const { entries, invalidDirs } = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.equal(entries.length, 2);
  assert.deepEqual(invalidDirs, ['01', 'foo']);
});

test('listTasksDocs: legacy root tasks keep dir null and root verification', () => {
  const repo = mkBp(['tasks-001.md', 'verification.md', 'index.md']);
  const { entries } = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].dir, null);
  assert.equal(entries[0].verification.rel, `${BP}/verification.md`);
});

test('expectedTaskDocIds returns the three task-unit ids', () => {
  assert.deepEqual(expectedTaskDocIds('002'), {
    tasks: 'TASKS-002',
    verification: 'VERIFY-002',
    review: 'REVIEW-002',
  });
});
