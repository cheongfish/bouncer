'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'commands', 'bouncer-init.md'), 'utf8');

test('bouncer-init command has a description and calls scripts/bouncer init', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
  assert.match(body, /scripts\/bouncer/);
  assert.match(body, /bouncer.*init|init/);
  assert.match(body, /idempotent|already exists|no changes/i);
  assert.match(body, /\.bouncer\//);
  assert.match(body, /\/bouncer-plan/);
  assert.doesNotMatch(md, /superpowers/i);
});
