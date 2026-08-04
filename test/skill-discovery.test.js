'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill, readAllGenericSkills } = require('./helpers/read-skill');

test('discovery has valid frontmatter identity', () => {
  const md = readSkill('discovery');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*discovery/);
  assert.strictEqual(data.name, 'discovery');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('discovery clarifies goal, scope, non-goals, and success criteria', () => {
  const md = readSkill('discovery');
  assert.match(md, /goal/i);
  assert.match(md, /scope/i);
  assert.match(md, /non-?goals?/i);
  assert.match(md, /success criteria/i);
  assert.match(md, /confirm/i);
});

test('discovery reads prior art and defines a handoff contract', () => {
  const md = readSkill('discovery');
  assert.match(md, /\.bouncer\/context\/Distill\.md/);
  assert.match(md, /\.bouncer\/context\/epics/);
  assert.match(md, /edge case/i);
  assert.match(md, /failure mode/i);
  assert.match(md, /handoff/i);
});

test('generic skills omit legacy protocol and methodology assumptions', () => {
  assert.doesNotMatch(readAllGenericSkills(), /superpowers/i);
});
