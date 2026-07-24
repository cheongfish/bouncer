'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('implementation has valid frontmatter identity', () => {
  const md = readSkill('implementation');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*implementation/);
  assert.strictEqual(data.name, 'implementation');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('implementation follows approved tasks → focused change → tests → deviations', () => {
  const md = readSkill('implementation');
  assert.match(md, /approved tasks|tasks\.md|checklist/i);
  assert.match(md, /focused|scope|affected/i);
  assert.match(md, /test/i);
  assert.match(md, /deviation/i);
});
