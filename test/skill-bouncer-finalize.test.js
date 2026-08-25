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
  assert.match(body, /worktreePathFor/);
  assert.match(body, /rmdir/);
  // Nested-only cleanup: do not rmdir `.worktrees` when a flat path was reused.
  assert.match(body, /basename.*dirname.*dirname.*WORKTREE_PATH.*\.worktrees/);
  assert.match(body, /<type>\/<BP-id>-<slug>/);
  assert.match(body, /commit_type/);
  assert.match(body, /G16/);
  // Distill 승격(spec-authoring) 다음에 explain-diff가 온다.
  assert.match(body, /skills\/explain-diff\/SKILL\.md/);
  {
    const i = body.indexOf('skills/spec-authoring/SKILL.md');
    const j = body.indexOf('skills/explain-diff/SKILL.md');
    assert.ok(i > -1 && j > i);
  }
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
  assert.doesNotMatch(body, /scaffold distill/);
  assert.doesNotMatch(body, /\bG9\b/);
  assert.doesNotMatch(body, /\bG15\b/);
});

test('bouncer-finalize --yes runs verify before staging with no bypass on reason verify', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /`--yes`는 스테이징 전에 검증 명령을 실행한다/);
  assert.match(body, /reason: 'verify'/);
  assert.match(body, /원인을 고쳐 다시 실행하는 것 외의 우회 경로가 없다/);
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

test('bouncer-finalize splits sameEpicPending into --set vs /bouncer-plan', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /sameEpicPending/);
  assert.match(body, /draft.*형제[\s\S]{0,80}--set.*제안하지 않는다/);
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

test('bouncer-finalize handles empty proposals, drop mismatches, and missing ACQ tools', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /zero candidates|0건|후보.*없/);
  assert.match(body, /mismatch|불일치/i);
  assert.match(body, /that item as failed/);
  assert.match(body, /other approved entries/);
  assert.match(body, /host ACQ tool is unavailable|ACQ.*(?:missing|unavailable|없)/i);
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
  assert.match(body, /상한[\s\S]{0,80}초과[\s\S]{0,120}ACQ|ACQ[\s\S]{0,160}초과/);
  assert.match(body, /`add`[\s\S]{0,60}`replace`[\s\S]{0,20}`drop`/);
});
