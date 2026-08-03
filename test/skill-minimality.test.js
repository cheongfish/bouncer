'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('minimality has valid frontmatter identity', () => {
  const md = readSkill('minimality');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*minimality/);
  assert.strictEqual(data.name, 'minimality');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('minimality preserves required scope and escalates conflicts to planning', () => {
  const md = readSkill('minimality');
  assert.match(md, /reuse/i);
  assert.match(md, /dependenc/i);
  assert.match(md, /require|test|verification|security|accessib/i);
  assert.match(md, /rationale|record/i);
  assert.match(md, /plann?ing/i);
  assert.match(md, /advisory|not a gate/i);
  assert.doesNotMatch(md, /\/bouncer-plan|superpowers/i);
});

test('minimality ladder covers YAGNI, reuse, stdlib/platform, and shortest surface', () => {
  const md = readSkill('minimality');
  assert.match(md, /YAGNI|need to exist/i);
  assert.match(md, /Already in this codebase|Reuse/i);
  assert.match(md, /standard library|native platform/i);
  assert.match(md, /shortest working|fewest files/i);
  assert.match(md, /Over-engineering/i);
  assert.match(md, /[Ee]xplanatory comments/);
});
