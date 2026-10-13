'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyzeDriveShape, pathOverlapRatio } = require('../scripts/lib/dag-shape');

// 열린 commit task 한 건을 만든다. 경로는 id별로 달라 서로 충돌하지 않는다.
function task(id, over = {}) {
  return {
    id,
    depends_on: [],
    dependency_gate: 'integrated',
    parallel_safe: true,
    status: 'pending',
    affected_paths: [`src/${id}.ts`],
    exclusive_resources: [],
    execution_kind: 'commit',
    review_risk: [],
    open: true,
    ...over,
  };
}

const serial4 = [
  task('001'), task('002', { depends_on: ['001'] }),
  task('003', { depends_on: ['002'] }), task('004', { depends_on: ['003'] }),
];
const twoIndependentSafe = [task('001'), task('002')];
const diamond = [
  task('001'), task('002', { depends_on: ['001'] }), task('003', { depends_on: ['001'] }),
  task('004', { depends_on: ['002', '003'] }),
];

test('four chained tasks → serial', () => {
  assert.equal(analyzeDriveShape(serial4, { maxParallel: 2 }).drive_shape, 'serial');
});

test('two independent parallel-safe tasks with maxParallel 2 → parallel', () => {
  const shape = analyzeDriveShape(twoIndependentSafe, { maxParallel: 2 });
  assert.equal(shape.drive_shape, 'parallel');
  assert.equal(shape.max_wave_width, 2);
  assert.equal(shape.parallel_safe_tasks, 2);
});

test('two independent parallel-safe tasks with maxParallel 1 → serial', () => {
  assert.equal(analyzeDriveShape(twoIndependentSafe, { maxParallel: 1 }).drive_shape, 'serial');
});

test('one of two independent tasks is parallel_safe false → serial', () => {
  const tasks = [task('001'), task('002', { parallel_safe: false })];
  const shape = analyzeDriveShape(tasks, { maxParallel: 2 });
  assert.equal(shape.drive_shape, 'serial');
  assert.equal(shape.parallel_safe_tasks, 1);
});

test('diamond dependency → mixed with width 2', () => {
  const shape = analyzeDriveShape(diamond, { maxParallel: 2 });
  assert.equal(shape.drive_shape, 'mixed');
  assert.equal(shape.max_wave_width, 2);
});

test('predecessor missing from the task list → unknown', () => {
  const tasks = [task('002', { depends_on: ['001'] })];
  assert.equal(analyzeDriveShape(tasks, { maxParallel: 2 }).drive_shape, 'unknown');
});

test('only verification tasks → null with zero counts', () => {
  const tasks = [task('001', { execution_kind: 'verification' })];
  const shape = analyzeDriveShape(tasks, { maxParallel: 2 });
  assert.equal(shape.drive_shape, null);
  assert.equal(shape.commit_tasks, 0);
  assert.equal(shape.max_wave_width, 0);
});

test('verification node and its edge → ignored by the simulation', () => {
  const tasks = [
    task('001'), task('002'),
    task('003', { execution_kind: 'verification', depends_on: ['001', '002'] }),
    task('004', { depends_on: ['003'] }),
  ];
  const shape = analyzeDriveShape(tasks, { maxParallel: 2 });
  assert.equal(shape.commit_tasks, 3);
  assert.equal(shape.drive_shape, 'mixed');
});

test('closed predecessor → treated as integrated and not counted', () => {
  const tasks = [
    task('001', { open: false, status: 'closed' }),
    task('002', { depends_on: ['001'] }),
  ];
  const shape = analyzeDriveShape(tasks, { maxParallel: 2 });
  assert.equal(shape.commit_tasks, 1);
  assert.equal(shape.drive_shape, 'serial');
});

test('review_risk → sorted union of open commit tasks, non-array read as empty', () => {
  const tasks = [
    task('001', { review_risk: ['b_risk', 'a_risk'] }),
    task('002', { review_risk: ['a_risk', 'c_risk'] }),
    task('003', { review_risk: 'oops' }),
    task('004', { open: false, status: 'integrated', review_risk: ['z_risk'] }),
  ];
  assert.deepEqual(
    analyzeDriveShape(tasks, { maxParallel: 2 }).review_risk,
    ['a_risk', 'b_risk', 'c_risk'],
  );
});

test('pathOverlapRatio → counts a-paths overlapping b over the smaller side', () => {
  assert.equal(pathOverlapRatio(['src/a.ts', 'src/b.ts'], ['src/a.ts']), 1);
  assert.equal(pathOverlapRatio(['src/a.ts', 'src/b.ts'], ['src/c.ts', 'src/a.ts', 'src/d.ts']), 0.5);
  assert.equal(pathOverlapRatio(['src'], ['src/a.ts']), 1);
  assert.equal(pathOverlapRatio(['./src/'], ['src/a.ts']), 1);
});

test('pathOverlapRatio with an empty side → 0', () => {
  assert.equal(pathOverlapRatio([], ['src/a.ts']), 0);
  assert.equal(pathOverlapRatio(['src/a.ts'], []), 0);
});
