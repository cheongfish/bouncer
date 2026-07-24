// test/finalize-pure.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { makeAllowed, buildCommitMessage, isUnder } = require('../scripts/lib/finalize');

const BP = 'context/epics/EPIC-001-auth/blueprints/BP-001-login';

test('isUnder treats entries as directories', () => {
  assert.ok(isUnder('src/auth/login.ts', 'src/auth/'));
  assert.ok(isUnder('src/auth/login.ts', 'src/auth'));
  assert.ok(!isUnder('src/authx/login.ts', 'src/auth'));
});

test('allowed set covers affected paths, bp subtree, ancestor indexes', () => {
  const allowed = makeAllowed({ affectedPaths: ['src/auth/'], blueprintDir: BP });
  assert.ok(allowed('src/auth/login.ts'));
  assert.ok(allowed(`${BP}/tasks.md`));
  assert.ok(allowed('context/epics/EPIC-001-auth/index.md'));
  assert.ok(allowed('context/index.md'));
  assert.ok(!allowed('src/payments/charge.ts'));
  assert.ok(!allowed('context/epics/EPIC-002-billing/index.md'));
});

test('commit message follows the template', () => {
  const docs = {
    blueprintIndex: { data: { title: 'Login flow', bouncer: { id: 'BP-001', epic_id: 'EPIC-001' } } },
    tasks: { data: { title: 'Implement login' } },
    verification: { data: { title: 'Login verified' } },
    distill: { data: { resource: `${BP}/distill.md` } },
  };
  const msg = buildCommitMessage(docs);
  assert.ok(msg.startsWith('feat(BP-001): Login flow\n'));
  assert.ok(msg.includes('Epic: EPIC-001'));
  assert.ok(msg.includes('Blueprint: BP-001'));
  assert.ok(msg.includes('Implemented:\n- Implement login'));
  assert.ok(msg.includes('Distilled:\n- ' + `${BP}/distill.md`));
});
