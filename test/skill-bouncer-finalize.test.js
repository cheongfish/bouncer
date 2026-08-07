'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-finalize', 'SKILL.md'), 'utf8');

test('bouncer-finalize wires Distill, finalize gate, remainder finalize, push+PR, and graceful skip', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /spec-authoring/);
  assert.match(body, /Distill|\.bouncer\/Distill\.md/);
  assert.match(body, /scripts\/bouncer"\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+finalize\b/);
  assert.match(body, /scripts\/bouncer"\s+finalize\s+--blueprint\s+<pointer\.blueprint>(?:\s+--yes)?\b/);
  assert.match(body, /scripts\/bouncer"\s+finalize\s+--blueprint\s+<pointer\.blueprint>\s+--yes\b/);
  assert.match(body, /--yes|dry-run|dry run/);
  assert.match(body, /gh pr create/);
  assert.match(body, /--title "\[YYMMDD\] \(→ MergeTarget\) \[Type\]/);
  assert.match(body, /no remote|without a remote|no `?gh`?|skip/i);
  assert.match(body, /AskUserQuestion|ACQ/);
  assert.match(body, /worktree 제거|remove.*worktree|worktree cleanup/i);
  assert.match(body, /git worktree remove/);
  assert.match(body, /<type>\/<BP-id>-<slug>/);
  assert.match(body, /commit_type/);
  assert.match(body, /G16/);
  // task 커밋·퀴즈는 /bouncer-commit — finalize는 PR·정리만.
  assert.doesNotMatch(body, /skills\/explain-diff\/SKILL\.md/);
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
  assert.doesNotMatch(body, /scaffold distill/);
  assert.doesNotMatch(body, /\bG9\b/);
  assert.doesNotMatch(body, /\bG15\b/);
});


test('bouncer-finalize promotes BP explain notes into project Distill', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\.bouncer\/Distill\.md/);
  assert.match(body, /promot|승격|Invariants|Gotchas|Decisions/i);
  assert.match(body, /English/);
});

test('bouncer-finalize fills PR from explain.md and excludes 이해 상태', () => {
  const { body } = parseFrontmatter(md);
  const { PR_TEMPLATE } = require('../scripts/lib/templates');
  assert.match(body, /explain\.md/);
  // Distill 승격·PR 복사 금지를 각각 긍정 문구로 잠근다(한쪽만 남아도 통과하지 않음).
  // 스킬 줄바꿈 wrapping을 허용한다.
  assert.match(body, /이해 상태는 Distill로\s*승격하지 않는다/);
  assert.match(body, /이해 상태는 PR에\s*옮기지 않는다/);
  // PR 본문 소스는 explain.md 채움 규칙으로 못 박는다(부재 단언이 아님).
  assert.match(body, /PR body[\s\S]{0,200}explain\.md|explain\.md[\s\S]{0,200}PR body/);
  for (const s of ['## Background', '## Intuition', '## Code']) {
    assert.ok(body.includes(s), `PR fill rule must name ${s}`);
  }
  // Bouncer 메타는 Explain 경로(스킬 지시 + 템플릿 플레이스홀더).
  assert.match(body, /Explain path|Explain 경로/);
  assert.match(PR_TEMPLATE, /- Explain: <explain path>/);
});

test('bouncer-finalize opens draft PR without a second body-confirm ACQ', () => {
  const { body } = parseFrontmatter(md);
  // 게이트 목록에 PR body confirm이 없다(긍정 문구로 셋만 나열됨을 단언)
  assert.match(body, /Gates in this skill[\s\S]{0,200}Next blueprint/);
  // 승인 뒤 재확인 없이 생성한다는 규칙
  assert.match(body, /without a further confirmation|재확인하지 않는다/);
});

test('bouncer-finalize offers next-blueprint handoff via current --set after confirm', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /current --set/);
  assert.match(body, /next/);
  assert.match(body, /ask|confirm|승낙/i);
});

test('bouncer-finalize next handoff is next blueprint only (task advance lives on commit)', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /current --set/);
  assert.match(body, /Next blueprint|다음.?blueprint/i);
  assert.match(body, /never automatic|자동.*없|자동 전진은 없/i);
  assert.doesNotMatch(body, /AskUserQuestion — Next task|Next task ACQ/i);
});
