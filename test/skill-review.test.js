'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('review has valid frontmatter identity', () => {
  const md = readSkill('review');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*review/);
  assert.strictEqual(data.name, 'review');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('review requires Findings and actionable disposition', () => {
  const md = readSkill('review');
  assert.match(md, /## Findings/);
  assert.match(md, /severity/i);
  assert.match(md, /blocker|major|minor|nit/i);
  assert.match(md, /resolved|accepted/i);
  assert.match(md, /Do not touch|Checklist|Interface/i);
  assert.doesNotMatch(md, /profile|superpowers/i);
});
