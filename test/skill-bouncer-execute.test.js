'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-execute', 'SKILL.md'), 'utf8');

test('bouncer-execute wires worktree, skills, scope, and execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /scripts\/bouncer"\s+current\b/);
  assert.match(body, /worktree/i);
  assert.match(body, /<type>\/<BP-id>-<slug>/);
  assert.match(body, /commit_type/);
  assert.match(body, /\.gitmessage|feat.*fix.*docs|refactor.*test.*chore/);
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

test('bouncer-execute step 2 seeds the worktree with the plan documents', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /seed-worktree/);
  assert.match(body, /--to\s+"\$\{WORKTREE_PATH\}"/);
  // The command reads the base checkout, so it must run before the cwd switch.
  assert.ok(
    body.indexOf('seed-worktree') > body.indexOf('git worktree add'),
    'seed-worktree must be documented after git worktree add',
  );
  assert.match(body, /tasks\.md/);
});

test('bouncer-execute step 3 routes implementation through bouncer-implementer', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /bouncer-implementer/);
  assert.match(body, /resolveSubagentModel/);
  assert.match(body, /inherit/);
  assert.match(body, /controller/i);
  assert.match(body, /commit-safety|git commit/i);
});

test('bouncer-execute step 5 dispatches reviewer-prompt via bouncer-reviewer', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /reviewer-prompt\.md/);
  assert.match(body, /bouncer-reviewer/);
  assert.match(body, /resolveSubagentModel/);
  assert.match(body, /inherit/);
  assert.match(body, /fresh generic|generic.*subagent/i);
  assert.match(body, /controller/i);
  assert.match(body, /## Findings/);
  assert.match(body, /bouncer\.review\.findings/);
  assert.match(body, /review\s*→\s*accepted|set\s*`?review\s*→\s*accepted/i);
  assert.match(body, /required\s*===\s*false|required === false/i);
  assert.match(body, /inline|no subagent/i);
  assert.doesNotMatch(md, /superpowers|profile-aware|verification-adapter|review-adapter/i);
});


test('bouncer-execute preflight reads project Distill', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\.bouncer\/Distill\.md/);
  assert.match(body, /Read/i);
});
