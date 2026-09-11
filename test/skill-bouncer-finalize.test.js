'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const mainMd = fs.readFileSync(path.join(root, 'skills', 'bouncer-finalize', 'SKILL.md'), 'utf8');
const md = readWorkflowBundle('bouncer-finalize');

test('bouncer-finalize remainder.md is the canon for gate, dry-run, scope, and verify', () => {
  const remainder = fs.readFileSync(
    path.join(root, 'skills', 'bouncer-finalize', 'references', 'remainder.md'),
    'utf8',
  );
  assert.match(remainder, /`--yes`\s+runs verification commands before staging|스테이징 전에 검증 명령을 실행한다/);
  assert.match(remainder, /reason: 'verify'/);
  assert.match(
    remainder,
    /no bypass other than[\s\S]{0,40}fixing the cause and rerunning|원인을 고쳐 다시 실행하는 것 외의 우회 경로가 없다/,
  );
  assert.match(remainder, /CLI owns the finalize gate, allowed paths, deletions, status transition/);
  assert.match(remainder, /preserve documents and worktree/);
  assert.match(remainder, /validator code, cause, path, and\n?\s*recovery action/);
  assert.match(remainder, /hard abort — nothing staged/);
});


test('draft PR body follows review-flow sections and omits legacy meta', () => {
  const { body } = parseFrontmatter(md);
  const draftPr = fs.readFileSync(
    path.join(root, 'skills', 'bouncer-finalize', 'references', 'draft-pr.md'),
    'utf8',
  );
  const { PR_TEMPLATE } = require('../scripts/lib/templates');
  const githubTpl = fs.readFileSync(path.join(root, '.github', 'pull_request_template.md'), 'utf8');
  const gitlabTpl = fs.readFileSync(
    path.join(root, '.gitlab', 'merge_request_templates', 'Default.md'),
    'utf8',
  );

  const sectionOrder = [
    '관련 이슈',
    '배경 · 변경 의도',
    '주요 변경 내용',
    '로직 흐름',
    '리뷰 포인트',
    '확인 방법',
  ];
  for (const doc of [PR_TEMPLATE, githubTpl, gitlabTpl, draftPr]) {
    let prev = -1;
    for (const title of sectionOrder) {
      const idx = doc.indexOf(title);
      assert.ok(idx > -1, `missing section ${title}`);
      assert.ok(idx > prev, `section order broken at ${title}`);
      prev = idx;
    }
  }

  // Explain은 실제 열리는 Markdown 링크. 평문 경로·Bouncer 메타 절은 없다.
  assert.match(PR_TEMPLATE, /Explain:.*\[[^\]]+\]\([^)]+\)/);
  assert.match(draftPr, /Explain[\s\S]{0,120}\[[^\]]+\]\([^)]+\)|Markdown link|head branch|commit/);
  assert.match(draftPr, /pushed head|head branch|commit/i);
  for (const doc of [PR_TEMPLATE, githubTpl, gitlabTpl]) {
    assert.doesNotMatch(doc, /## 🚦 Bouncer/);
    assert.doesNotMatch(doc, /Features\s*&\s*Improvements|신규 기능 및 개선/);
    assert.doesNotMatch(doc, /버그 수정 \(Fixes\)|### 🐛/);
    assert.doesNotMatch(doc, /- Epic:|- Blueprint:/);
  }
  assert.match(draftPr, /Bouncer meta|Bouncer 메타|Features\/Fixes/i);
  assert.match(draftPr, /Never emit|넣지 않|출력하지/i);

  // Comprehension fields excluded by instruction only; create command has no --label.
  assert.match(body, /do not move `## 이해 상태`\s*into the PR|이해 상태는 PR에\s*옮기지 않는다/);
  assert.match(draftPr, /Quiz|이해 상태|comprehension|quiz_score/i);
  assert.match(draftPr, /Never copy|옮기지 않|넣지 않|제외/i);
  const createBlock = (draftPr.match(/```bash\n([\s\S]*?)```/) || [])[1] || '';
  assert.match(createBlock, /gh pr create/);
  assert.doesNotMatch(createBlock, /--label/);
  assert.doesNotMatch(createBlock, /pr\.labels/);
  assert.match(draftPr, /라벨|label/i);
  assert.match(draftPr, /붙이지 않|미부착|never attached|Do not pass|No `--label`/i);

  // 검증: 다중 task 번호순 집계 + finalize --yes 최종 결과 우선.
  assert.match(draftPr, /verification|검증/);
  assert.match(draftPr, /번호|number|task/i);
  assert.match(draftPr, /finalize\s+--yes|final verify|최종 검증/);
  assert.match(draftPr, /우선|most recent|최근/i);

  // Mermaid: 조건 충족 시에만, 아니면 제목까지 제거.
  assert.match(draftPr, /[Mm]ermaid|로직 흐름/);
  assert.match(draftPr, /생략|제목까지|remove.*title|조건/i);
  assert.match(githubTpl, /<!--[\s\S]*로직 흐름[\s\S]*-->/);
  assert.match(gitlabTpl, /<!--[\s\S]*로직 흐름[\s\S]*-->/);
  assert.match(githubTpl, /<!--[\s\S]*Explain[\s\S]*-->/);
  assert.match(gitlabTpl, /<!--[\s\S]*Explain[\s\S]*-->/);
});

test('bouncer-finalize offers next-blueprint handoff via current --set after confirm', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /current --set/);
  assert.match(body, /next/);
  assert.match(body, /ask|confirm|승낙/i);
});

test('bouncer-finalize delegates pointer clear and next-blueprint set invariants', () => {
  const { body } = parseFrontmatter(mainMd);
  const handoff = fs.readFileSync(path.join(root, 'skills', 'bouncer-finalize', 'references', 'cleanup-handoff.md'), 'utf8');
  assert.match(body, /rules\/current-pointer\.md/);
  assert.match(handoff, /rules\/current-pointer\.md/);
  assert.match(handoff, /next\.next/);
});

test('bouncer-finalize next handoff is next blueprint only (task advance lives on commit)', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /current --set/);
  assert.match(body, /Next blueprint|다음.?blueprint/i);
  assert.match(body, /never automatic|자동.*없|자동 전진은 없/i);
  assert.doesNotMatch(body, /AskUserQuestion — Next task|Next task ACQ/i);
});

test('bouncer-finalize splits sameEpicPending into --set vs /bouncer-plan', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /sameEpicPending/);
  assert.match(
    body,
    /Do not propose `--set` on draft siblings|draft.*형제[\s\S]{0,80}--set.*(?:propose|제안)/i,
  );
  assert.match(body, /\/bouncer-plan/);
  assert.match(body, /ready: false/);
});

test('bouncer-finalize gates overlap and leftover-worktree warnings on next.next', () => {
  const { body } = parseFrontmatter(md);
  // sharedPaths / leftover-worktree는 next.next가 있을 때만 — draft-only
  // 잔여에서 null 접근이나 가짜 "다음 blueprint" 경고가 나면 안 됨.
  assert.match(
    body,
    /If `next\.next` is non-null[\s\S]+?next\.next\.sharedPaths[\s\S]+?If `next\.next` is `null` but `sameEpicPending`/,
  );
  assert.match(
    body,
    /If `next\.next` is non-null[\s\S]+?\*new\*[\s\S]+?affected_paths[\s\S]+?If `next\.next` is `null` but `sameEpicPending`/,
  );
});

test('bouncer-finalize documents sibling follow-up after G16 and cites remainder for retention', () => {
  const { body } = parseFrontmatter(mainMd);
  const remainder = fs.readFileSync(
    path.join(root, 'skills', 'bouncer-finalize', 'references', 'remainder.md'),
    'utf8',
  );
  assert.match(remainder, /CLI owns the finalize gate, allowed paths, deletions, status transition/);
  assert.match(remainder, /preserve documents and worktree/);
  assert.match(remainder, /validator code, cause, path, and\n?\s*recovery action/);
  assert.match(body, /finalize\s+--yes/);
  assert.match(body, /sibling|형제 Blueprint|형제 blueprint/i);
  assert.match(body, /\/bouncer-plan|new Epic|새 Epic/);
});

test('bouncer-finalize cleans every drive worktree but preserves a blocked drive', () => {
  const { body } = parseFrontmatter(mainMd);
  const handoff = fs.readFileSync(
    path.join(root, 'skills', 'bouncer-finalize', 'references', 'cleanup-handoff.md'), 'utf8',
  );
  assert.match(body, /`worktrees` inventory names them all/);
  assert.match(handoff, /one integration worktree and one worker worktree per prepared task/);
  assert.match(handoff, /remove the worker worktrees first, then the integration one/);
  assert.match(handoff, /Preserve the whole inventory/);
  assert.match(handoff, /stopped as blocked/);
  assert.match(handoff, /Cleanup is for a closed blueprint only/);
});

// explain과 PR은 계획이 아니라 실행을 기술한다.
test('bouncer-finalize audits DAG change, actual paths and agent provenance', () => {
  const explain = fs.readFileSync(
    path.join(root, 'skills', 'bouncer-finalize', 'references', 'explain-quiz.md'), 'utf8',
  );
  const draftPr = fs.readFileSync(
    path.join(root, 'skills', 'bouncer-finalize', 'references', 'draft-pr.md'), 'utf8',
  );
  for (const doc of [explain, draftPr]) {
    assert.match(doc, /DAG/);
    assert.match(doc, /actual[_ ]paths/i);
    assert.match(doc, /scope_revision/);
    assert.match(doc, /integration head/);
  }
  assert.match(explain, /which named agent produced it/);
  assert.match(explain, /worker branch and SHA/);
  assert.match(explain, /ledger's decision log/);
  assert.match(draftPr, /integration verify on the head this PR pushes/);
  assert.match(draftPr, /When the\s*\n?\s*plan and the run match, say nothing/);
});

test('bouncer-finalize uses the shortened context-only sequence', () => {
  const { body } = parseFrontmatter(mainMd);
  assert.doesNotMatch(body, /distill/i);
  assert.match(body, /^1\. \*\*Explain \+ quiz/m);
  assert.match(body, /^2\. \*\*Remainder/m);
  assert.match(body, /^3\. \*\*PR/m);
  assert.match(body, /^4\. \*\*Cleanup/m);
  assert.match(body, /^5\. \*\*Handoff/m);
  assert.doesNotMatch(body, /^6\. /m);
  assert.match(body, /\.\/references\/explain-quiz\.md/);
  assert.match(body, /\.\/references\/remainder\.md/);
  assert.match(body, /\.\/references\/draft-pr\.md/);
  assert.match(body, /\.\/references\/cleanup-handoff\.md/);
  assert.match(body, /`integration`/);
  assert.match(body, /openTasks/);
  assert.match(body, /headVerified/);
  assert.equal(fs.existsSync(path.join(root, 'skills/bouncer-finalize/references/distill-promotion.md')), false);
});
