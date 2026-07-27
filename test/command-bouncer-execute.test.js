'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'commands', 'bouncer-execute.md'), 'utf8');

test('bouncer-execute wires worktree, skills, scope, and execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(md, /\.bouncer\/current/);
  assert.match(body, /worktree/i);
  assert.match(body, /bouncer\/<BP|bouncer\/\$\{|bouncer\//);
  assert.match(body, /runtime-state/);
  assert.match(body, /ensureWorktreeRoot/);
  assert.doesNotMatch(body, /\.bouncer\/worktrees/);
  assert.doesNotMatch(body, /already gitignored|ignored in-repo worktree/i);
  assert.match(body, /implementation/);
  assert.match(body, /verification/);
  assert.match(body, /review/);
  assert.match(body, /minimality/);
  assert.match(body, /debugging/);
  assert.match(body, /Goal & intent|Interface|Touch|Do not touch|Checklist/i);
  assert.match(body, /commit-safety|affected_paths/);
  assert.match(body, /scripts\/bouncer"\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+execute\b/);
  assert.match(body, /harness.*record|validate.*configured verify command/i);
  assert.doesNotMatch(md, /superpowers|profile-aware|verification-adapter|review-adapter/i);
});
