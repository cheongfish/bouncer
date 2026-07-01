'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { checkGate } = require('../scripts/lib/validate');

const rels = {
  epicIndex: 'context/epics/EPIC-001-auth/index.md',
  blueprintIndex: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/index.md',
  tasks: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/tasks.md',
  verification: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/verification.md',
  review: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/review.md',
  distill: 'context/epics/EPIC-001-auth/blueprints/BP-001-login/distill.md',
};

function doc(status, extra = {}) {
  return { data: { sdd: { status, ...extra } }, rel: 'x' };
}

test('plan gate passes when all conditions met', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('ready', { graph: { suggested_paths: ['src/'] }, affected_paths: ['src/'] }),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('plan gate flags G3 and G4 and G5', () => {
  const docs = {
    epicIndex: doc('approved'),
    blueprintIndex: doc('approved'),
    tasks: doc('draft', { affected_paths: [] }),
  };
  const failures = [];
  checkGate('plan', docs, rels, failures);
  const codes = failures.map((f) => f.code);
  assert.ok(codes.includes('G3'));
  assert.ok(codes.includes('G4'));
  assert.ok(codes.includes('G5'));
});

test('execute gate: review optional satisfies G8', () => {
  const docs = {
    tasks: doc('verified'),
    verification: doc('passed'),
    review: doc('pending', { review: { required: false, reason: 'docs-only' } }),
  };
  const failures = [];
  checkGate('execute', docs, rels, failures);
  assert.deepStrictEqual(failures, []);
});

test('finalize gate requires distill published', () => {
  const failures = [];
  checkGate('finalize', { distill: doc('draft') }, rels, failures);
  assert.deepStrictEqual(failures.map((f) => f.code), ['G9']);
});
