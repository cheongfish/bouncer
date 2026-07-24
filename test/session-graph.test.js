'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { planSessionGraph } = require('../scripts/lib/session-graph');

function base(over) {
  return {
    hasBouncer: () => true,
    hasGraphify: () => true,
    sourceDirs: () => ['src', 'test'],
    existingDirs: (dirs) => dirs,
    newestMtime: () => 200,
    graphMtime: () => 100,
    ...over,
  };
}
const plan = (over) => planSessionGraph({ repoRoot: '/r', deps: base(over) });

test('skips when no .bouncer/', () => {
  assert.strictEqual(plan({ hasBouncer: () => false }).action, 'skip-no-bouncer');
});

test('skips when graphify is not on PATH', () => {
  assert.strictEqual(plan({ hasGraphify: () => false }).action, 'skip-no-graphify');
});

test('skips when the graph is fresher than every source dir', () => {
  assert.strictEqual(plan({ newestMtime: () => 100, graphMtime: () => 200 }).action, 'skip-fresh');
});

test('builds when the graph is missing', () => {
  const r = plan({ graphMtime: () => null });
  assert.strictEqual(r.action, 'build');
  assert.deepStrictEqual(r.dirs, ['src', 'test']);
});

test('builds when a source dir is newer than the graph', () => {
  assert.strictEqual(plan({ newestMtime: () => 300, graphMtime: () => 200 }).action, 'build');
});

test('build dirs are limited to source dirs that exist', () => {
  const r = plan({ graphMtime: () => null, existingDirs: () => ['src'] });
  assert.deepStrictEqual(r.dirs, ['src']);
});
