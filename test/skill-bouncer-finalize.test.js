'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { checkDocShape } = require('../scripts/check-doc-shape');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const mainMd = fs.readFileSync(path.join(root, 'skills', 'bouncer-finalize', 'SKILL.md'), 'utf8');
const md = readWorkflowBundle('bouncer-finalize');

function assertShape(document, contract) {
  const result = checkDocShape(document, contract);
  assert.deepStrictEqual(result.errors, [], result.errors.join('; '));
  return result.shape;
}

test('bouncer-finalize conditionally routes four reference contracts while keeping core in SKILL.md', () => {
  const { body } = parseFrontmatter(mainMd);
  assertShape(mainMd, {
    filePath: path.join(root, 'skills', 'bouncer-finalize', 'SKILL.md'),
    links: [
      { href: './references/distill-promotion.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['distill', 'promot'] } },
      { href: './references/explain-quiz.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['explain', 'quiz'] } },
      { href: './references/draft-pr.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['draft', 'pr'] } },
      { href: './references/cleanup-handoff.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['clean'] } },
    ],
  });
  const routes = ['distill-promotion.md', 'explain-quiz.md', 'draft-pr.md', 'cleanup-handoff.md'];
  for (const file of routes) {
    assert.match(
      body,
      new RegExp(`\\]\\(\\.\\/references\\/${file.replace(/\./g, '\\.')}\\)`),
      `${file} must be linked as ./references/${file}`,
    );
  }
  assert.match(body, /validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+finalize/);
  assert.match(body, /finalize\s+--blueprint\s+<pointer\.blueprint>\s+--yes/);
  assert.match(body, /reason: 'verify'/);
  assert.doesNotMatch(body, /full JSON audit once|gh pr create|git worktree remove/);
});

test('bouncer-finalize rejects unrelated conditional routes', () => {
  const routes = [
    { href: './references/distill-promotion.md', triggers: ['distill', 'promot'], source: 'When proposing and promoting Distill, read this reference:' },
    { href: './references/explain-quiz.md', triggers: ['explain', 'quiz'], source: 'When authoring or refreshing explain and running the quiz, read this reference:' },
    { href: './references/draft-pr.md', triggers: ['draft', 'pr'], source: 'When the user chooses to consider a draft PR, read this reference:' },
    { href: './references/cleanup-handoff.md', triggers: ['clean'], source: 'After the remainder choice, when cleaning up the worktree or handing off the next blueprint, read this reference:' },
  ];
  for (const route of routes) {
    const result = checkDocShape(`When publishing a release, read [Reference](${route.href}).`, {
      filePath: path.join(root, 'skills', 'bouncer-finalize', 'SKILL.md'),
      links: [{ href: route.href, resolve: true, referencePreamble: true, conditionalLoad: { triggers: route.triggers } }],
    });
    assert.strictEqual(result.ok, false, route.href);
    assert.match(result.errors.join('; '), /semantic trigger/);
  }
});


test('bouncer-finalize places consent timing in steps 1, 3, 4, and 6', () => {
  const { body } = parseFrontmatter(mainMd);
  assertShape(mainMd, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: {
      required: [1, 2, 3, 4, 5, 6, 7],
      order: true,
      acq: [1, 3, 4, 6],
      acqOptions: [3],
      links: {
        1: ['./references/distill-promotion.md'],
        4: ['./references/draft-pr.md'],
        6: ['./references/cleanup-handoff.md'],
      },
    },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [1, 3, 4, 6], only: true },
  });
  const acqAt = body.indexOf('\n## ACQ (AskUserQuestion) gates\n');
  assert.ok(acqAt > -1);
  const index = body.slice(acqAt);
  assert.match(index, /[Ss]tep\s+1/);
  assert.match(index, /[Ss]tep\s+3/);
  assert.match(index, /[Ss]tep\s+4/);
  assert.match(index, /[Ss]tep\s+6/);
  assert.doesNotMatch(index, /\*\*AskUserQuestion/);
  assert.doesNotMatch(index, /\*\*Options\*\*:/);


  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/spec-authoring\/index\.md/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/explain-diff\/index\.md/);
  assert.match(body, /\.\/references\/distill-promotion\.md/);
});

test('bouncer-finalize wires Distill, finalize gate, remainder finalize, push+PR, and graceful skip', () => {
  const { data, body } = parseFrontmatter(md);
  assertShape(md, { frontmatter: { required: ['name', 'description'], values: { name: 'bouncer-finalize' } } });
  assert.ok(data.description.length > 0);
  assert.match(body, /spec-authoring/);
  assert.match(body, /Distill|\.bouncer\/Distill\.md/);
  assert.match(body, /\bbouncer\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+finalize\b/);
  assert.match(body, /\bbouncer\s+finalize\s+--blueprint\s+<pointer\.blueprint>(?:\s+--yes)?\b/);
  assert.match(body, /\bbouncer\s+finalize\s+--blueprint\s+<pointer\.blueprint>\s+--yes\b/);
  assert.match(body, /--yes|dry-run|dry run/);
  assert.match(body, /gh pr create/);
  assert.match(body, /--title "\[YYMMDD\] \(→ MergeTarget\) \[Type\]/);
  assert.match(body, /no remote|without a remote|no `?gh`?|skip/i);
  assert.match(body, /AskUserQuestion|ACQ/);
  assert.match(body, /worktree 제거|remove.*worktree|worktree cleanup/i);
  assert.match(body, /git worktree remove/);
  assert.match(body, /worktreePathFor/);
  assert.match(body, /rmdir/);
  // Nested-only cleanup: do not rmdir `.worktrees` when a flat path was reused.
  assert.match(body, /basename.*dirname.*dirname.*WORKTREE_PATH.*\.worktrees/);
  assert.match(body, /<type>\/<BP-id>-<slug>/);
  assert.match(body, /commit_type/);
  assert.match(body, /G16/);
  // Distill 승격(spec-authoring) 다음에 explain-diff가 온다.
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/explain-diff\/index\.md/);
  {
    const i = body.indexOf('${BOUNCER_ROOT}/references/spec-authoring/index.md');
    const j = body.indexOf('${BOUNCER_ROOT}/references/explain-diff/index.md');
    assert.ok(i > -1 && j > i);
  }
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
  assert.doesNotMatch(body, /scaffold distill/);
  assert.doesNotMatch(body, /\bG9\b/);
  assert.doesNotMatch(body, /\bG15\b/);
});

test('bouncer-finalize --yes runs verify before staging with no bypass on reason verify', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /`--yes`\s+runs verification commands before staging|스테이징 전에 검증 명령을 실행한다/);
  assert.match(body, /reason: 'verify'/);
  assert.match(
    body,
    /no bypass other than[\s\S]{0,40}fixing the cause and rerunning|원인을 고쳐 다시 실행하는 것 외의 우회 경로가 없다/,
  );
});


test('bouncer-finalize promotes BP explain notes into project Distill', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\.bouncer\/Distill\.md/);
  assert.match(body, /promot|승격|Invariants|Gotchas|Decisions/i);
  assert.match(body, /English/);
});

test('bouncer-finalize fills PR from explain.md and excludes 이해 상태', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /explain\.md/);
  // Distill promotion and PR copy bans — each must appear (either language).
  assert.match(
    body,
    /do not promote `## 이해 상태` to Distill|이해 상태는 Distill로\s*승격하지 않는다/,
  );
  assert.match(
    body,
    /do not move `## 이해 상태`\s*into the PR|이해 상태는 PR에\s*옮기지 않는다/,
  );
  // PR 본문 소스는 explain.md 채움 규칙으로 못 박는다(부재 단언이 아님).
  assert.match(body, /PR body[\s\S]{0,200}explain\.md|explain\.md[\s\S]{0,200}PR body/);
  for (const s of ['## Background', '## Intuition', '## Code']) {
    assert.ok(body.includes(s), `PR fill rule must name ${s}`);
  }
});

// 리뷰 흐름 본문 계약: 섹션 순서·Explain 링크·검증 집계·Mermaid·제외 항목·라벨 미부착.
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

test('bouncer-finalize opens draft PR without a second body-confirm ACQ', () => {
  const { body } = parseFrontmatter(md);
  // 단계 색인에 PR·Next blueprint가 있고, PR body 재확인 게이트는 없다.
  assert.match(body, /\*\*Index:\*\*[\s\S]{0,200}Next blueprint/);
  assert.match(body, /Step\s+4\s+[—-]\s+PR/);
  // 승인 뒤 재확인 없이 생성한다는 규칙
  assert.match(body, /without a further confirmation|without.*second.*confirm|재확인하지 않는다/);
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

test('bouncer-finalize presents one ordered promotion proposal with complete item shape', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /proposal|제안/i);
  assert.match(body, /drop[\s\S]{0,80}replace[\s\S]{0,80}add/i);
  assert.match(body, /bullet|불릿/);
  assert.match(body, /source|출처.*explain|explain.*절/i);
  assert.match(body, /target shard|대상 샤드|shard id/i);
  assert.match(body, /replace[\s\S]{0,240}(old|existing|기존).*bullet|기존 문장[\s\S]{0,240}replace/i);
  assert.match(body, /drop[\s\S]{0,100}replace[\s\S]{0,100}add/i);
});

test('bouncer-finalize uses one three-way consent and keeps the cycle moving on rejection', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /one.*ACQ|단일 ACQ|한 번.*동의/i);
  assert.match(body, /approve|승인/);
  assert.match(body, /revise|수정/);
  assert.match(body, /skip|건너뛰기/);
  assert.match(body, /Never ask per bullet|불릿별 질문.*금지|불릿마다.*묻지 않/i);
  assert.match(body, /rejection|decline|거절.*(?:explain|퀴즈|G16|remainder)/i);
  assert.match(body, /auto[\s\S]{0,180}(?:not|does not|생략하지)|autonomy[\s\S]{0,180}(?:not|does not|생략하지)/i);
  assert.match(body, /light[\s\S]{0,180}(?:not|does not|생략하지)/i);
});

test('bouncer-finalize handles empty proposals and delegates ACQ fallback to the shared contract', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /zero candidates|0건|후보.*없/);
  assert.match(body, /mismatch|불일치/i);
  assert.match(body, /that item as failed/);
  assert.match(body, /other approved entries/);
  assert.match(body, /rules\/acq\.md/);
  assert.doesNotMatch(body, /host ACQ tool is unavailable|render the same choices in chat and wait/i);
  assert.match(body, /audit\.shards/);
  assert.match(body, /distill\s+--all\s+--json/);
  assert.match(body, /payload[^\n]{0,40}`?repoRoot`?/i);
  assert.match(body, /every|each|모든/i);
  assert.match(body, /relative[^\n]{0,20}path|상대 경로/i);
  assert.match(body, /registered relative path|등재.*상대 경로/i);
  assert.match(body, /id\/path pairing|id.*path.*pairing|id.*경로.*짝/i);
  // 한 번의 --all --json payload에서 content를 갈라 currentBody를 채운다.
  // 샤드 파일을 각각 다시 읽는 두 번째 패스는 계약에서 빠진다.
  assert.match(body, /`?content`?[\s\S]{0,200}(?:split|갈라|분해)/i);
  assert.match(body, /# <id>|# `<id>`/);
  assert.match(body, /known[\s\S]{0,80}id|알려진[\s\S]{0,40}id/i);
  assert.match(body, /id[\s\S]{0,80}(?:set|집합)[\s\S]{0,120}(?:mismatch|differ|다르|불일치)/i);
  // 불일치 스킵 전용 문구. `승격하지 않는다`는 이해 상태 금지와 겹친다.
  assert.match(body, /do not proceed with promotion/);
  assert.match(body, /partial map/);
  assert.match(body, /continue with step 2/);
  assert.match(body, /(?:only )?when the two id sets match/i);
  // 매치 성공 뒤에는 add/replace/drop 검색이 전량 `--all --json` 감사를 받는다.
  // 구 문장(검사 전 `Give the complete stdout, the absolute path`)만 금지한다 —
  // 성공 경로의 complete stdout/JSON 핸드오프를 통째로 막지 않는다.
  assert.match(
    body,
    /when the two id sets match[\s\S]{0,280}(?:full JSON audit|complete stdout)[\s\S]{0,160}(?:complete )?(?:shard )?map/i,
  );
  assert.doesNotMatch(
    body,
    /Give the complete stdout, the absolute path[\s\S]{0,180}spec-authoring/,
  );
  assert.doesNotMatch(
    body,
    /read[\s\S]{0,80}(?:every|each|모든)[\s\S]{0,80}shard[\s\S]{0,80}separately|각[\s\S]{0,20}샤드[\s\S]{0,40}따로[\s\S]{0,20}읽/i,
  );
  assert.match(body, /currentBody/);
  assert.match(body, /id[^\n]{0,80}(?:path|currentBody)/i);
  assert.match(body, /aggregate|selection|합산|선택 결과/i);
  assert.match(body, /never[^\n]{0,140}(?:attach|associate|individual shard|개별 샤드)/i);
  assert.doesNotMatch(body, /distill\s+--route/);
  assert.match(body, /single-file/);
  assert.match(body, /absolute path|절대 경로/i);
});

// 상한 초과는 ACQ 정보·replace/drop 우선 검토일 뿐, 게이트·자동 절삭이 아니다.
test('bouncer-finalize surfaces over-limit shards in the promotion ACQ', () => {
  const { body } = parseFrontmatter(md);
  assert.match(
    body,
    /over-limit[\s\S]{0,80}ACQ|ACQ[\s\S]{0,160}over-limit|상한[\s\S]{0,80}초과[\s\S]{0,120}ACQ|ACQ[\s\S]{0,160}초과/,
  );
  assert.match(body, /`replace`[\s\S]{0,60}`drop`[\s\S]{0,20}`add`/);
});

// closed Blueprint 보존·삭제·실패 시 무변경·sibling 후속.
// 스킬은 CLI 삭제 조건을 다시 구현하지 않고 finalize --yes 계약을 가리킨다.
test('bouncer-finalize documents retention cleanup and sibling follow-up after G16', () => {
  const { body } = parseFrontmatter(mainMd);

  // 삭제 대상(일회성)과 보존 대상(증적)을 같은 본문에서 명시한다.
  assert.match(body, /tasks\/<NNN>\/tasks\.md/);
  assert.match(body, /tasks\/<NNN>\/review\.md/);
  assert.match(body, /context-review\.md/);
  assert.match(body, /verification\.md/);
  assert.match(body, /explain\.md/);
  assert.match(body, /index\.md/);
  assert.match(body, /Distill/);

  // 삭제는 remainder commit의 일부이며, G16·verify 실패면 수행하지 않는다.
  assert.match(body, /remainder|잔여|마감 커밋/i);
  assert.match(
    body,
    /G16[\s\S]{0,220}(?:do not delete|삭제|지우|수행하지|무변경)|(?:do not delete|삭제|지우)[\s\S]{0,220}G16/,
  );
  assert.match(
    body,
    /(?:verify|검증)[\s\S]{0,160}(?:failure|실패)[\s\S]{0,160}(?:do not delete|삭제|지우|수행하지|무변경|unchanged)/i,
  );
  assert.match(body, /finalize\s+--yes/);

  // No archive / reopen / retroactive edits — locked in one nearby sentence.
  assert.match(
    body,
    /Do not propose archive[\s\S]{0,160}retroactive|archive[\s\S]{0,80}(?:재개|다시 열)[\s\S]{0,80}소급[\s\S]{0,40}제안하지 않/i,
  );

  // Follow-up via sibling or new Epic; `--set` eligibility from payload / cleanup-handoff.
  assert.match(body, /sibling|형제 Blueprint|형제 blueprint/i);
  assert.match(body, /\/bouncer-plan|new Epic|새 Epic/);
  assert.match(
    body,
    /closed[\s\S]{0,120}(?:reopen|do not reopen|다시 열|재개)|(?:do not reopen|다시 열|재개)[\s\S]{0,120}closed/i,
  );
  assert.match(
    body,
    /`--set`[\s\S]{0,120}(?:finalize payload|cleanup-handoff)|(?:finalize payload|cleanup-handoff)[\s\S]{0,120}`--set`/i,
  );
  assert.match(
    body,
    /do not[\s\S]{0,20}arbitrarily `--set`|임의로\s*`--set`하지 않는다|열린 형제에 임의로/,
  );

  // Final report covers retention, cleanup, and follow-up boundaries.
  assert.match(
    body,
    /\*\*Report\.\*\*[\s\S]{0,900}(?:deletion|preserved|one-off|condensed|삭제|보존|축약|일회성|sibling|형제)/i,
  );
});
