'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { canonicalJson, sha256Canonical } = require('../scripts/lib/canonical-json');

// 통합 전(approval-snapshot 복사본) 코드로 계산한 값을 그대로 고정한다.
const input = { b: [3, { y: null, x: 'é' }], a: 1 };

test('sha256Canonical with a fixed input → keeps the pre-consolidation digest', () => {
  assert.strictEqual(
    sha256Canonical(input),
    'af28eb07700c60662cc70c301ebcfb3b3680449a4ac57d49106906e61f872b9b',
  );
});

test('canonicalJson with differing key insertion order → ignores the order at every depth', () => {
  assert.strictEqual(
    canonicalJson(input),
    canonicalJson({ a: 1, b: [3, { x: 'é', y: null }] }),
  );
  assert.strictEqual(canonicalJson(input), '{"a":1,"b":[3,{"x":"é","y":null}]}');
});
