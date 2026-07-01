'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-execute.md'), 'utf8',
);

test('sdd-execute wires worktree, both loops, commit-safety, and the execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/\.sdd\/current/.test(body));
  assert.ok(/worktree/i.test(body));
  assert.ok(/sdd\/<BP|sdd\/\$\{|sdd\//.test(body), 'branch naming convention');
  assert.ok(/verification-loop/.test(body));
  assert.ok(/review-loop/.test(body));
  assert.ok(/commit-safety|affected_paths/.test(body));
  assert.ok(/validate --gate execute/.test(body));
});
