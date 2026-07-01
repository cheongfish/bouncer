'use strict';
const test = require('node:test');
const assert = require('node:assert');

test('js-yaml is available as a dependency', () => {
  const yaml = require('js-yaml');
  assert.deepStrictEqual(yaml.load('a: 1\nb: [x, y]\n'), { a: 1, b: ['x', 'y'] });
});
