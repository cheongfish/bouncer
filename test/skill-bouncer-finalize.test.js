'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-finalize', 'SKILL.md'), 'utf8');

test('bouncer-finalize wires explain, finalize gate, bouncer finalize, push+PR, and graceful skip', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /skills\/explain-diff\/SKILL\.md/);
  assert.match(body, /spec-authoring/);
  assert.match(body, /explain/i);
  assert.match(body, /scaffold explain/);
  assert.match(body, /scripts\/bouncer"\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+finalize\b/);
  assert.match(body, /scripts\/bouncer"\s+finalize\s+--blueprint\s+<pointer\.blueprint>(?:\s+--yes)?\b/);
  assert.match(body, /scripts\/bouncer"\s+finalize\s+--blueprint\s+<pointer\.blueprint>\s+--yes\b/);
  assert.match(body, /--yes|dry-run|dry run/);
  assert.match(body, /commit_intent/);
  assert.match(body, /gh pr create/);
  assert.match(body, /--title "\[YYMMDD\] \(→ MergeTarget\) \[Type\]/);
  assert.match(body, /no remote|without a remote|no `?gh`?|skip/i);
  assert.match(body, /AskUserQuestion|ACQ/);
  assert.match(body, /Commit \+ worktree|commit \+.*worktree/i);
  assert.match(body, /worktree 제거|remove.*worktree|worktree cleanup/i);
  assert.match(body, /git worktree remove/);
  assert.match(body, /<type>\/<BP-id>-<slug>/);
  assert.match(body, /commit_type/);
  assert.match(body, /G15/);
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
  assert.doesNotMatch(body, /scaffold distill/);
  assert.doesNotMatch(body, /\bG9\b/);
});


test('bouncer-finalize promotes BP explain notes into project Distill', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\.bouncer\/context\/Distill\.md/);
  assert.match(body, /promot|승격|Invariants|Gotchas|Decisions/i);
});

test('bouncer-finalize fills PR from explain.md and excludes 이해 상태', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /explain\.md/);
  assert.match(body, /이해 상태/);
  assert.match(body, /승격하지 않|옮기지 않|제외/);
  // PR 본문 소스는 긍정 문구로 못 박는다. 지금 finalize:142의
  // "fill its sections from the blueprint and tasks" 문장을 doesNotMatch로
  // 노리면 그 문장이 한 글자만 바뀌어도 단언이 무의미해진다.
  assert.match(body, /PR body[\s\S]{0,200}explain\.md|explain\.md[\s\S]{0,200}PR body/);
  for (const s of ['Background', 'Intuition', 'Code']) {
    assert.ok(body.includes(s), `PR fill rule must name ${s}`);
  }
});

test('bouncer-finalize offers next-blueprint handoff via current --set after confirm', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /current --set/);
  assert.match(body, /next/);
  assert.match(body, /ask|confirm|승낙/i);
});
