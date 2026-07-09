'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'review-adapter', 'SKILL.md'), 'utf8',
);

test('review-adapter has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'review-adapter');
  assert.ok(data.description.length > 0);
});

test('review-adapter injects template, invokes superpowers, honors required:false, fail-closed', () => {
  assert.ok(/superpowers:requesting-code-review/.test(md));
  assert.ok(/receiving-code-review/.test(md));
  assert.ok(/Load|Inject|Invoke|Assert/i.test(md));
  assert.ok(/review[\s\S]*accepted/i.test(md));
  assert.ok(/required[\s\S]*false/i.test(md));
  assert.ok(/fail closed|do not.*accepted|unresolved/i.test(md));
  assert.ok(!/self-contained/i.test(md));
  assert.ok(!/fallback/i.test(md));
  assert.ok(/Do not touch|Checklist|Interface|tasks\.md/i.test(md));
});
