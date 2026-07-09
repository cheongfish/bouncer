'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'verification-adapter', 'SKILL.md'), 'utf8',
);

test('verification-adapter has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'verification-adapter');
  assert.ok(data.description.length > 0);
});

test('verification-adapter injects template, invokes superpowers, asserts, fail-closed', () => {
  assert.ok(/superpowers:verification-before-completion/.test(md));
  assert.ok(/Load|Inject|Invoke|Assert/i.test(md));
  assert.ok(/verification[\s\S]*passed/i.test(md));
  assert.ok(/tasks[\s\S]*verified/i.test(md));
  assert.ok(/fail closed|do not.*transition|no success/i.test(md));
  assert.ok(!/self-contained/i.test(md));
  assert.ok(!/fallback/i.test(md));
  assert.ok(/verification\.md/.test(md));
  assert.ok(/config\.verify|\.sdd\/config\.json/.test(md));
});
