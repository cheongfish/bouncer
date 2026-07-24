'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('verification has valid frontmatter identity', () => {
  const md = readSkill('verification');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*verification/);
  assert.strictEqual(data.name, 'verification');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('verification requires real Command and Evidence sections', () => {
  const md = readSkill('verification');
  assert.match(md, /## Command/);
  assert.match(md, /## Evidence/);
  assert.match(md, /real (pass|command)|never.*without.*pass|exit (code|status)/i);
  assert.doesNotMatch(md, /profile|superpowers/i);
});
