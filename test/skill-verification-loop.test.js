'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'verification-loop', 'SKILL.md'), 'utf8',
);

test('verification-loop has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'verification-loop');
  assert.ok(data.description.length > 0);
});

test('verification-loop is self-contained and sets the right statuses', () => {
  assert.ok(!/superpowers:/.test(md), 'must not depend on the superpowers plugin');
  assert.ok(/config\.verify|\.sdd\/config\.json/.test(md));
  assert.ok(/verification[\s\S]*passed/i.test(md));
  assert.ok(/tasks[\s\S]*verified/i.test(md));
});
