'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-finalize.md'), 'utf8',
);

test('sdd-finalize wires distill, finalize gate, harness finalize, push+PR, and graceful skip', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/okf-authoring/.test(body));
  assert.ok(/distill/i.test(body));
  assert.ok(/validate --gate finalize/.test(body));
  assert.ok(/sdd-harness.*finalize|harness.*finalize/.test(body));
  assert.ok(/--yes|dry-run|dry run/.test(body));
  assert.ok(/gh pr create/.test(body));
  assert.ok(/no remote|without a remote|no `?gh`?|skip/i.test(body));
});
