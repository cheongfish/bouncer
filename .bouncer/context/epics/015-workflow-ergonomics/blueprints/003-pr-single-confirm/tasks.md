---
type: bouncer.tasks
title: finalize PR 본문 확인 ACQ를 없앰
description: 승인 1회 뒤 렌더 출력만 하고 push·draft PR로 직행
resource: .bouncer/context/epics/015-workflow-ergonomics/blueprints/003-pr-single-confirm/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-06T09:12:53.161+09:00'
bouncer:
  id: TASKS-003
  epic_id: '015'
  blueprint_id: '003'
  status: verified
  affected_paths:
    - skills/bouncer-finalize/SKILL.md
    - test/skill-bouncer-finalize.test.js
    - docs/workflow.md
  graph:
    generated_at: '2026-08-06T09:31:32+09:00'
    command: graphify query (source + context graphs)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - skills/bouncer-finalize
      - docs
    basis: 'graph-sync rebuilt the context graph (built: context; source already fresh; failed: none). Source query "finalize PR draft push gh create ACQ confirm templates" returned scripts/src/lib/finalize.ts, scripts/src/lib/templates.ts, scripts/lib/templates.js. Context query returned the 012-finalize-handoff epic index, which owns the current ACQ layout. The finalize/templates modules are suggested but deliberately left out of affected_paths — this blueprint removes a question from the skill prose and changes no commit or PR-body code. skills/ and docs/ were added by hand because config.source_dirs is scripts/hooks/test.'
---
# Tasks

Blueprint: [003](index.md)

## Goal & intent
`/bouncer-finalize` step 4에서 PR 본문 확인 ACQ를 없앤다. "PR 열지" 승인 하나 뒤에는
렌더된 title/body를 출력하고 바로 `git push` + `gh pr create --draft`로 간다.
ACQ 게이트 목록도 셋(Commit+worktree · PR · Next blueprint)으로 줄인다.
검증은 `npm test`.

## Interface
- 제공: step 4 승인 분기 = 렌더 출력 → push → draft PR 생성(추가 질문 없음).
- 제공: 상단 "Gates in this skill" 목록에서 `PR body confirm` 제거.
- 거부: 승인 이후 본문·제목에 대한 재확인 질문. `gh pr create` 실패를 승인
  재요청으로 돌리는 처리.
- 거부: remote/`gh` 부재에서의 PR 시도 — 기존 graceful skip 유지.

## Touch
- Modify `skills/bouncer-finalize/SKILL.md` — 48~50행 게이트 목록에서 PR body
  confirm을 빼고, step 4의 "second ACQ to confirm that content before create"
  문장을 렌더 출력 후 즉시 생성으로 바꾼다.
- Modify `test/skill-bouncer-finalize.test.js` — 남는 ACQ 셋과 "승인 뒤 재확인
  없음" 문구를 단언하고, 기존 PR 본문 소스 단언은 유지한다.
- Modify `docs/workflow.md` — 흐름도의 `(ACQ) draft PR` 줄 옆 설명을 승인 1회로 맞춘다.

## Do not touch
- `scripts/lib/templates.js`·`scripts/src/lib/templates.ts` — `PR_TEMPLATE` 내용 유지.
- `scripts/src/lib/finalize.ts`·`scripts/lib/finalize.js` — 커밋 로직 미변경.
- `skills/explain-diff/SKILL.md` — 001이 같은 흐름의 앞단을 고친다.
- `skills/bouncer-execute/SKILL.md` — 004.

## Constraints
- step 3 Commit+worktree ACQ와 step 6 Next blueprint ACQ 문단은 손대지 않는다.
  이번에 없애는 것은 step 4의 두 번째 질문 하나뿐이다.
- ACQ 옵션 순서 규칙(recommended 먼저 → revise → cancel 마지막)과 Recommend-why
  형식은 그대로 둔다.
- PR 제목 규칙·본문 소스·`## 이해 상태` 제외 규칙 문장을 지우지 않는다 —
  현행 테스트가 이 문구들을 잡고 있다.
- 미리보기 출력 자체는 남긴다. 없애는 것은 질문이지 출력이 아니다.
- 스킬 본문은 영어 유지(사용자에게 보이는 ACQ 문구는 기존처럼 한국어).

## Checklist
- [ ] `test/skill-bouncer-finalize.test.js`에 실패 단언을 먼저 넣는다.
  ```js
  // 게이트 목록에 PR body confirm이 없다(긍정 문구로 셋만 나열됨을 단언)
  assert.match(body, /Gates in this skill[\s\S]{0,200}Next blueprint/);
  // 승인 뒤 재확인 없이 생성한다는 규칙
  assert.match(body, /without a further confirmation|재확인하지 않는다/);
  ```
- [ ] 기존 PR 본문 소스·`이해 상태 제외` 단언이 살아 있는지 확인한다.
- [ ] `skills/bouncer-finalize/SKILL.md` 48~50행 "Gates in this skill"에서
  `PR body confirm (step 4, when opening)`을 삭제한다.
- [ ] step 4의 세 번째 불릿("If the user accepts and remote/`gh` are available,
  show the rendered title + PR body (dry-run) and run a **second ACQ** …")을
  "렌더된 title + body를 출력하고, 추가 확인 없이 push 후 draft PR을 만든다"로
  다시 쓴다.
- [ ] `gh pr create` 실패 시 로컬 커밋 성공을 그대로 보고하고 사유를 전한다는
  문장을 실패 모드로 추가한다.
- [ ] `docs/workflow.md` 흐름도 줄을 맞춘다.
- [ ] `npm test` 통과.
