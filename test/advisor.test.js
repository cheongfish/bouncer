'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { detectPhase } = require('../scripts/lib/advisor');

function fakeDocs(statuses) {
  const wrap = (status, extra) => ({ data: { sdd: { status, ...(extra || {}) } } });
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
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { tasks: 'in_progress', verification: 'failed' }) });
  assert.strictEqual(r.phase, 'verify');
});

test('verification passed means review phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { tasks: 'verified', verification: 'passed' }) });
  assert.strictEqual(r.phase, 'review');
});

test('review accepted means finalize phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { tasks: 'verified', verification: 'passed', review: 'accepted' }) });
  assert.strictEqual(r.phase, 'finalize');
});

test('distill published means finalize phase', () => {
  const r = detectPhase({ repoRoot: '/x', deps: deps({ blueprint: 'b' }, { distill: 'published' }) });
  assert.strictEqual(r.phase, 'finalize');
});
