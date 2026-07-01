'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-init.md'), 'utf8',
);

test('sdd-init command has a description and calls sdd-harness init', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
  assert.ok(/sdd-harness init/.test(body));
  assert.ok(/idempotent|already exists|no changes/i.test(body));
});
