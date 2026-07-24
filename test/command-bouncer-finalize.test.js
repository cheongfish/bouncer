'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'commands', 'bouncer-finalize.md'), 'utf8');

test('bouncer-finalize wires distill, finalize gate, bouncer finalize, push+PR, and graceful skip', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /spec-authoring/);
  assert.match(body, /distill/i);
  assert.match(body, /scripts\/bouncer"\s+validate\s+--blueprint\s+<blueprint dir>\s+--gate\s+finalize\b/);
  assert.match(body, /scripts\/bouncer"\s+finalize\s+--blueprint\s+<blueprint dir>(?:\s+--yes)?\b/);
  assert.match(body, /scripts\/bouncer"\s+finalize\s+--blueprint\s+<blueprint dir>\s+--yes\b/);
  assert.match(body, /--yes|dry-run|dry run/);
  assert.match(body, /gh pr create/);
  assert.match(body, /no remote|without a remote|no `?gh`?|skip/i);
  assert.match(body, /bouncer\//);
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
});
