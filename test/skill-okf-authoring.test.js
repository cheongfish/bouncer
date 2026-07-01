'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'okf-authoring', 'SKILL.md'), 'utf8',
);

test('okf-authoring has valid frontmatter with name + description', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'okf-authoring');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('okf-authoring documents the frontmatter ownership boundary', () => {
  assert.ok(/frontmatter/i.test(md));
  assert.ok(/sdd-harness|scaffold/i.test(md));
});
