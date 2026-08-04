'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-finalize', 'SKILL.md'), 'utf8');

test('bouncer-finalize wires distill, finalize gate, bouncer finalize, push+PR, and graceful skip', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /spec-authoring/);
  assert.match(body, /distill/i);
  assert.match(body, /scaffold distill/);
  assert.match(body, /scripts\/bouncer"\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+finalize\b/);
  assert.match(body, /scripts\/bouncer"\s+finalize\s+--blueprint\s+<pointer\.blueprint>(?:\s+--yes)?\b/);
  assert.match(body, /scripts\/bouncer"\s+finalize\s+--blueprint\s+<pointer\.blueprint>\s+--yes\b/);
  assert.match(body, /--yes|dry-run|dry run/);
  assert.match(body, /commit_intent/);
  assert.match(body, /gh pr create/);
  assert.match(body, /--title "\[YYMMDD\] \(→ MergeTarget\) \[Type\]/);
  assert.match(body, /no remote|without a remote|no `?gh`?|skip/i);
  assert.match(body, /ask the user whether to open a PR|whether to open a PR at all/i);
  assert.match(body, /ask the user whether to remove the execute worktree|worktree cleanup/i);
  assert.match(body, /git worktree remove/);
  assert.match(body, /<type>\/<BP-id>-<slug>/);
  assert.match(body, /commit_type/);
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
});


test('bouncer-finalize promotes BP distill into project Distill', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\.bouncer\/context\/Distill\.md/);
  assert.match(body, /promot|승격|Invariants|Gotchas|Decisions/i);
});
