'use strict';
const test = require('node:test');
const assert = require('node:assert');
const schema = require('../scripts/lib/schema');

test('OKF required fields are exact', () => {
  assert.deepStrictEqual(schema.OKF_REQUIRED,
    ['type', 'title', 'description', 'resource', 'tags', 'timestamp']);
});

test('id prefix and status enum per type', () => {
  assert.strictEqual(schema.ID_PREFIX['sdd.tasks'], 'TASKS-');
  assert.deepStrictEqual(schema.STATUS_ENUM['sdd.review'],
    ['pending', 'requested', 'addressed', 'accepted']);
  assert.strictEqual(schema.KIND_TO_TYPE.distill, 'sdd.distill');
  assert.strictEqual(schema.TYPES.length, 6);
});
