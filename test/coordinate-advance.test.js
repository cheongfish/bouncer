'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { advance } = require('../packages/cli/dist/coordinate-advance');

test('advance stop → includes the final status; status failure preserves executed steps', () => {
  const status = { ok: true, checkpoint: { revision: 3 } };
  let calls = 0;
  const opts = { repoRoot: process.cwd(), blueprint: 'missing', deps: {
    next: () => ++calls % 2 ? { ok: true, action: 'prepare', argv: ['bouncer', 'x'] } : { ok: true, action: 'done' },
    runArgv: () => ({ stdout: '{"ok":true}', status: 0 }),
    status: () => status,
  } };
  const success = advance(opts);
  assert.deepEqual(success.status, status);
  opts.deps.status = () => ({ ok: false, reason: 'missing-ledger' });
  const failed = advance(opts);
  assert.equal(failed.reason, 'advance-status-unavailable');
  assert.deepEqual(failed.executed, [{ action: 'prepare', exit: 0 }]);
  opts.deps.next = () => ({ ok: false, reason: 'next-failed' });
  assert.equal(Object.hasOwn(advance(opts), 'status'), false);
});

test('status throws after an executed step → unavailable result retains executed steps', () => {
  let calls = 0;
  const result = advance({ repoRoot: process.cwd(), blueprint: 'missing', deps: {
    next: () => ++calls === 1 ? { ok: true, action: 'prepare', argv: ['bouncer', 'x'] } : { ok: true, action: 'done' },
    runArgv: () => ({ stdout: '{"ok":true}', status: 0 }),
    status: () => { throw new Error('status unavailable'); },
  } });
  assert.equal(result.reason, 'advance-status-unavailable');
  assert.deepEqual(result.executed, [{ action: 'prepare', exit: 0 }]);
});
