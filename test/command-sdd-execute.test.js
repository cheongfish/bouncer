'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-execute.md'), 'utf8',
);

test('sdd-execute wires preflight, tasks-as-brief, adapters, and execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/\.sdd\/current/.test(body));
  assert.ok(/worktree/i.test(body));
  assert.ok(/sdd\/<BP|sdd\/\$\{|sdd\//.test(body), 'branch naming convention');
  assert.ok(/superpowers:verification-before-completion/.test(body));
  assert.ok(/superpowers:requesting-code-review/.test(body));
  assert.ok(/verification-adapter/.test(body));
  assert.ok(/review-adapter/.test(body));
  assert.ok(!/verification-loop/.test(body));
  assert.ok(!/review-loop/.test(body));
  assert.ok(/fail closed|install superpowers/i.test(body));
  assert.ok(/Goal & intent|Interface|Touch|Do not touch|Checklist/i.test(body));
  assert.ok(/commit-safety|affected_paths/.test(body));
  assert.ok(/validate --gate execute/.test(body));
});
