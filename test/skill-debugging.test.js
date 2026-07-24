'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('debugging has valid frontmatter identity', () => {
  const md = readSkill('debugging');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*debugging/);
  assert.strictEqual(data.name, 'debugging');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('debugging follows reproduce → isolate → failing test → minimum fix → verify', () => {
  const md = readSkill('debugging');
  assert.match(md, /reproduce/i);
  assert.match(md, /isolate|root cause|cause/i);
  assert.match(md, /failing|regression/i);
  assert.match(md, /minimum|minimal/i);
  assert.match(md, /verif/i);
});
