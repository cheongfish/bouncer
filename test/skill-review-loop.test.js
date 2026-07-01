'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'review-loop', 'SKILL.md'), 'utf8',
);

test('review-loop has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'review-loop');
  assert.ok(data.description.length > 0);
});

test('review-loop is self-contained, honors required:false, and sets review→accepted', () => {
  assert.ok(!/superpowers:/.test(md), 'must not depend on the superpowers plugin');
  assert.ok(/review[\s\S]*accepted/i.test(md));
  assert.ok(/required[\s\S]*false/i.test(md));
});
