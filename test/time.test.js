'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { nowIsoKst } = require('../scripts/lib/time');

test('nowIsoKst formats with +09:00 offset', () => {
  // 2026-08-03T00:00:00.000Z == 2026-08-03T09:00:00.000+09:00
  const s = nowIsoKst(new Date('2026-08-03T00:00:00.000Z'));
  assert.strictEqual(s, '2026-08-03T09:00:00.000+09:00');
});

test('nowIsoKst crosses UTC midnight into the next KST calendar day', () => {
  // 2026-08-03T16:00:00.000Z == 2026-08-04T01:00:00.000+09:00
  const s = nowIsoKst(new Date('2026-08-03T16:00:00.123Z'));
  assert.strictEqual(s, '2026-08-04T01:00:00.123+09:00');
});
