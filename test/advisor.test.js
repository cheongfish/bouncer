'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { detectPhase } = require('../scripts/lib/advisor');

function fakeDocs(statuses) {
  const wrap = (status, extra) => ({ data: { bouncer: { status, ...(extra || {}) } } });
  const docs = {};
  if (statuses.tasks) docs.tasks = wrap(statuses.tasks);
  if (statuses.verification) docs.verification = wrap(statuses.verification);
  if (statuses.review) docs.review = wrap(statuses.review);
  if (statuses.distill) docs.distill = wrap(statuses.distill);
  return docs;
}
function deps(current, statuses) {
  return {
    readCurrent: () => current,
    loadBlueprintDocs: () => ({ docs: fakeDocs(statuses) }),
  };
}

test('no active pointer means plan phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps(null, {}) });
  assert.strictEqual(r.phase, 'plan');
});

test('tasks ready means execute phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { tasks: 'ready' }) });
  assert.strictEqual(r.phase, 'execute');
});

test('verification failed means verify phase', () => {
  const r = detectPhase({
    repoRoot: '/x',
    deps: deps({ blueprint: 'b' }, { tasks: 'in_progress', verification: 'failed' }),
  });
  assert.strictEqual(r.phase, 'verify');
});

test('verification passed means review phase', () => {
  const r = detectPhase({
    repoRoot: '/x',
    deps: deps({ blueprint: 'b' }, { tasks: 'verified', verification: 'passed' }),
  });
  assert.strictEqual(r.phase, 'review');
});

test('review accepted means finalize phase', () => {
  const r = detectPhase({
    repoRoot: '/x',
    deps: deps(
      { blueprint: 'b' },
      { tasks: 'verified', verification: 'passed', review: 'accepted' },
    ),
  });
  assert.strictEqual(r.phase, 'finalize');
});

test('distill published means finalize phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { distill: 'published' }) });
  assert.strictEqual(r.phase, 'finalize');
});

const { recommendMode } = require('../scripts/lib/advisor');

const CFG = {
  plugin_advisors: {
    ponytail: {
      enabled: true, plan: 'lite', execute: 'full', verify: 'full',
      review: 'review', finalize: 'lite', auto_switch: false,
    },
  },
};

test('recommendMode maps execute phase to /ponytail full', () => {
  const r = recommendMode({ phase: 'execute', config: CFG });
  assert.strictEqual(r.enabled, true);
  assert.strictEqual(r.mode, 'full');
  assert.strictEqual(r.run, '/ponytail full');
  assert.strictEqual(r.auto_switch, false);
  assert.ok(/affected_paths/.test(r.boundary));
});

test('recommendMode maps review phase to /ponytail-review', () => {
  const r = recommendMode({ phase: 'review', config: CFG });
  assert.strictEqual(r.mode, 'review');
  assert.strictEqual(r.run, '/ponytail-review');
});

test('recommendMode reports disabled when advisor config absent', () => {
  const r = recommendMode({ phase: 'plan', config: {} });
  assert.strictEqual(r.enabled, false);
});

test('recommendMode reports disabled when ponytail.enabled is explicitly false', () => {
  const r = recommendMode({
    phase: 'plan',
    config: { plugin_advisors: { ponytail: { enabled: false, plan: 'lite' } } },
  });
  assert.strictEqual(r.enabled, false);
});
