'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  isRecord,
  catchMessage,
  catchMessageOrString,
  isEnoentError,
  isFsCode,
  isSkippableFsError,
} = require('../packages/cli/dist/guards');

test('isRecord with arrays, null and primitives → rejects them', () => {
  assert.strictEqual(isRecord({}), true);
  assert.strictEqual(isRecord([]), false);
  assert.strictEqual(isRecord(null), false);
  assert.strictEqual(isRecord('x'), false);
});

test('catchMessage with an Error or null → reads message and keeps TypeError on null', () => {
  assert.strictEqual(catchMessage(new Error('boom')), 'boom');
  assert.throws(() => catchMessage(null), TypeError);
});

test('catchMessageOrString with a non-Error value → falls back to String(error)', () => {
  assert.strictEqual(catchMessageOrString('x'), 'x');
  assert.strictEqual(catchMessageOrString(null), 'null');
  assert.strictEqual(catchMessageOrString(new Error('m')), 'm');
});

test('fs error guards given an error → match on code only', () => {
  assert.strictEqual(isEnoentError({ code: 'ENOENT' }), true);
  assert.strictEqual(isEnoentError({ code: 'EACCES' }), false);
  assert.strictEqual(isEnoentError(null), false);
  assert.strictEqual(isFsCode({ code: 'EPERM' }, 'EPERM'), true);
  assert.strictEqual(isSkippableFsError({ code: 'ELOOP' }), true);
  assert.strictEqual(isSkippableFsError({ code: 'EIO' }), false);
});
