'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'commands', 'sdd-plan.md'), 'utf8',
);

test('sdd-plan wires scaffold, both skills, affected_paths confirm, pointer, and plan gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.ok(/sdd-harness scaffold/.test(body));
  assert.ok(/okf-authoring/.test(body));
  assert.ok(/graphify-runner/.test(body));
  assert.ok(/affected_paths/.test(body));
  assert.ok(/\.sdd\/current/.test(body));
  assert.ok(/validate --gate plan/.test(body));
  assert.ok(/approv/i.test(body));
});
