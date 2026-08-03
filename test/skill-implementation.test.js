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

test('implementation climbs a minimality ladder before writing code', () => {
  const md = readSkill('implementation');
  assert.match(md, /decision ladder|Understand, then climb/i);
  assert.match(md, /[Rr]euse|Already in this codebase/);
  assert.match(md, /[Ss]tandard library|stdlib/i);
  assert.match(md, /[Nn]ative platform|[Aa]lready-installed dependency/i);
  assert.match(md, /minimum new code|minimum code/i);
  assert.match(md, /escalat|plann?ing/i);
});

test('implementation requires detailed why-comments on non-trivial changes', () => {
  const md = readSkill('implementation');
  assert.match(md, /Detailed comments/i);
  assert.match(md, /\bwhy\b/i);
  assert.match(md, /invariant|trade-?off|ceiling/i);
  assert.match(md, /thorough|상세|Prefer thoroughness/i);
});
