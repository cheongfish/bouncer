'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  listTasksDocs, expectedTasksId, expectedTaskDocIds, isNumberedTasksBasename,
} = require('../packages/cli/dist/tasks-docs');
const { loadModuleGraph, reachable } = require('./helpers/module-graph');

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

test('listTasksDocs: legacy tasks.md → is retained only for the S15 reporter', () => {
  const repo = mkBp(['tasks.md', 'index.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.strictEqual(result.legacy, true);
  assert.strictEqual(result.mixed, false);
  assert.deepEqual(result.legacyFiles, ['tasks.md']);
  assert.equal(result.entries.length, 0);
});

test('listTasksDocs: numbered root tasks → are legacy files, not task entries', () => {
  const repo = mkBp(['tasks-003.md', 'tasks-001.md', 'index.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.strictEqual(result.legacy, true);
  assert.deepStrictEqual(result.legacyFiles, ['tasks-001.md', 'tasks-003.md']);
  assert.deepStrictEqual(result.entries, []);
});

test('listTasksDocs: mixed root legacy files → are reported together', () => {
  const repo = mkBp(['tasks.md', 'tasks-001.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.strictEqual(result.mixed, false);
  assert.deepStrictEqual(result.legacyFiles, ['tasks-001.md', 'tasks.md']);
});

test('listTasksDocs: non-padded root → names are not canonical task entries', () => {
  const repo = mkBp(['tasks-1.md', 'tasks-001.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.deepStrictEqual(result.entries, []);
  assert.deepStrictEqual(result.legacyFiles, ['tasks-001.md']);
  assert.strictEqual(isNumberedTasksBasename('tasks-1.md'), false);
  assert.strictEqual(isNumberedTasksBasename('tasks-001.md'), true);
});

test('listTasksDocs: empty blueprint directory → yields empty list', () => {
  const repo = mkBp(['index.md']);
  const result = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.deepStrictEqual(result.entries, []);
  assert.strictEqual(result.mixed, false);
  assert.strictEqual(result.legacy, false);
  assert.deepEqual(result.invalidDirs, []);
});

test('expectedTasksId → derives from basename (legacy uses blueprint id)', () => {
  assert.strictEqual(expectedTasksId('tasks.md', '014'), 'TASKS-014');
  assert.strictEqual(expectedTasksId('tasks-002.md', '014'), 'TASKS-002');
});

test('listTasksDocs with tasks/<NNN>/ units → yields paired paths and ids', () => {
  const repo = mkTaskDirs(['001', '002']);
  const { entries, invalidDirs } = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].dir, `${BP}/tasks/001`);
  assert.equal(entries[0].tasks.rel, `${BP}/tasks/001/tasks.md`);
  assert.equal(entries[0].verification.id, 'VERIFY-001');
  assert.equal(entries[1].review.id, 'REVIEW-002');
  assert.deepEqual(invalidDirs, []);
});

test('listTasksDocs with non-padded task dirs → land in invalidDirs only', () => {
  const repo = mkTaskDirs(['001', '002'], { extraDirs: ['01', 'foo'] });
  const { entries, invalidDirs } = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.equal(entries.length, 2);
  assert.deepEqual(invalidDirs, ['01', 'foo']);
});

test('listTasksDocs: root evidence → does not revive a legacy task entry', () => {
  const repo = mkBp(['tasks-001.md', 'verification.md', 'index.md']);
  const { entries } = listTasksDocs({ repoRoot: repo, blueprintDir: BP });
  assert.equal(entries.length, 0);
});

test('expectedTaskDocIds → returns the three task-unit ids', () => {
  assert.deepEqual(expectedTaskDocIds('002'), {
    tasks: 'TASKS-002',
    verification: 'VERIFY-002',
    review: 'REVIEW-002',
  });
});

// tasks-docs는 문서 목록만 다루는 하위 계층이라 CLI·coordinator·gate 같은 상위 계층을
// 끌어오면 안 된다. 예전에는 공유 require.cache를 지워 관측했지만, 지금은 소스 의존 그래프의
// 전이 도달 집합으로 같은 실패 모드를 본다(같은 워커의 다른 테스트를 건드리지 않는다).
const UPPER_LAYERS = ['cli*', 'coordinator', 'current', 'verification', 'finalize*', 'validate*'];

/**
 * `from`에서 전이적으로 도달하는 모듈 중 금지 목록에 걸리는 것을 고른다.
 *
 * @param {Map<string, Set<string>>} graph - 모듈 이름(확장자 없는 basename) → 직접 require 대상
 * @param {string} from - 시작 모듈 이름
 * @param {string[]} forbidden - 정확한 모듈 이름, 또는 끝이 `*`이면 접두 일치 패턴
 * @returns {string[]} 도달한 금지 모듈 이름(정렬). 없으면 빈 배열
 */
function forbiddenReach(graph, from, forbidden) {
  const hits = (name) => forbidden.some((rule) => (rule.endsWith('*')
    ? name.startsWith(rule.slice(0, -1))
    : name === rule));
  return [...reachable(graph, from)].filter(hits).sort();
}

test('tasks-docs transitive reach over the source graph → contains no upper-layer module', () => {
  const graph = loadModuleGraph(path.join(__dirname, '..', 'scripts', 'src', 'lib'));
  assert.deepEqual(forbiddenReach(graph, 'tasks-docs', UPPER_LAYERS), []);
});

test('fake graph where tasks-docs reaches coordinator and cli-x → forbiddenReach reports both', () => {
  const graph = new Map([
    ['tasks-docs', new Set(['schema'])],
    ['schema', new Set(['coordinator'])],
    ['coordinator', new Set(['cli-x', 'paths'])],
    ['cli-x', new Set()],
    ['paths', new Set()],
  ]);
  assert.deepEqual(forbiddenReach(graph, 'tasks-docs', UPPER_LAYERS), ['cli-x', 'coordinator']);
});
