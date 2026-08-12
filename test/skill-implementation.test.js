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
  assert.match(md, /[Hh]ard rule 9|하드룰 9/);
  assert.match(md, /\bwhy\b/i);
  assert.match(md, /invariant|trade-?off|ceiling/i);
  assert.match(md, /thorough|상세|Prefer thoroughness/i);
});

test('implementation shows good/bad comment contra examples from validate.js', () => {
  const md = readSkill('implementation');
  assert.match(md, /scripts\/lib\/validate\.js/);
  assert.match(md, /\*\*[Bb]ad\*\*|\bBad\b.*restat|나쁜/);
  assert.match(md, /\*\*[Gg]ood\*\*|\bGood\b.*why|좋은/);
  // Real why-fragments from validate.js (not invented samples).
  assert.match(md, /파싱하지 않아야/);
  assert.match(md, /같은 헬퍼를 써야/);
  assert.match(md, /재승인 경로가 없/);
});
