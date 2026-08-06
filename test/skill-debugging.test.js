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

test('debugging names the four stages Root cause → Pattern → Hypothesis → Implementation', () => {
  const md = readSkill('debugging');
  assert.match(md, /Root cause/i);
  assert.match(md, /Pattern/i);
  assert.match(md, /Hypothesis/i);
  assert.match(md, /Implementation/i);
});

test('debugging forbids proposing fixes before root-cause investigation', () => {
  const md = readSkill('debugging');
  assert.match(md, /do not propose fixes before root-cause investigation/i);
});

test('debugging escalates after 3 unsuccessful cycles', () => {
  const md = readSkill('debugging');
  assert.match(md, /3(?:\*\*)?\s*(?:failures?|times?|attempts?)[\s\S]{0,120}escalat/i);
});
