'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { resolveProfile, VALID_PROFILES } = require('../scripts/lib/profile');

test('default is native when no methodology present', () => {
  assert.strictEqual(resolveProfile({}), 'native');
  assert.strictEqual(resolveProfile(null), 'native');
  assert.strictEqual(resolveProfile({ methodology: {} }), 'native');
});

test('explicit methodology.profile wins', () => {
  assert.strictEqual(resolveProfile({ methodology: { profile: 'superpowers' } }), 'superpowers');
  assert.strictEqual(resolveProfile({ methodology: { profile: 'native' } }), 'native');
});

test('legacy config without profile but superpowers engines resolves to superpowers', () => {
  const legacy = { methodology: { verification: 'superpowers', review: 'superpowers' } };
  assert.strictEqual(resolveProfile(legacy), 'superpowers');
});

test('unknown profile falls back to native', () => {
  assert.strictEqual(resolveProfile({ methodology: { profile: 'bogus' } }), 'native');
});

test('VALID_PROFILES lists native and superpowers', () => {
  assert.deepStrictEqual([...VALID_PROFILES].sort(), ['native', 'superpowers']);
});
