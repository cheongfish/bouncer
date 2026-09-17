---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/009-execute-review-cap/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T13:22:49.645+09:00'
bouncer:
  id: EXPLAIN-009
  epic_id: '009'
  blueprint_id: '009'
  status: published
  comprehension:
    - range_from: develop
      range_to: 5d8669d34c923a67710c75800c79ebab71a7ce08
      diff_sha: 94cc22119332407a7a48a0f24d87727157a2b0d5ad85f67c693c8ab6970bf2ed
      quiz_score: 3/3
      disposition: 리뷰 왕복 상한 소유권이 execute에 있고 run은 참조만 한다는 점과 accepted 금지를 확인함
      recorded_at: '2026-08-24T13:23:57+09:00'
---
# Explain

## Background
verify 경로는 실패 뒤 debugger 재호출 1회로 끝이 나는데, 리뷰 경로는
actionable finding이 남으면 "fix and re-review"만 있어 왕복이 끊기지 않았다.
그 숫자도 `/bouncer-run` step 4에만 있어서, `/bouncer-execute`를 단독으로
부르거나 멈춘 주행을 복구할 때는 상한이 없었다. 이번 변경은 리뷰 왕복 상한
2회와 `/bouncer-plan` 에스컬레이션·`accepted` 금지를 execute step 5에 두고,
run은 verify와 같은 형태로 그 숫자를 참조만 하게 맞췄다.

## Intuition
상한의 주인은 execute다. run은 같은 숫자를 되풀이하지 않고 가리키기만 한다.

## Code
- `skills/bouncer-execute/SKILL.md` step 5 (4): `at most **2** review
  round-trips`, 상한 도달 시 `/bouncer-plan`, remaining finding을 `accepted`로
  바꾸지 않음
- `skills/bouncer-run/SKILL.md` step 4: 왕복은 `/bouncer-execute`가 정한 대로
  **2회**, 루프가 별도 상한을 씌우지 않음
- 계약: `test/skill-bouncer-execute.test.js`, `test/skill-bouncer-run.test.js`
- 사용자 문서: `docs/workflow.md` 「알아둘 것」 — 단독 `/bouncer-execute`에도
  같은 2회가 걸림

## Quiz
1. 리뷰 재검 왕복 상한 숫자와 그 본문 소유 스킬은?
   - A) 1회, `/bouncer-run`
   - B) 2회, `/bouncer-execute`
   - C) 2회, `/bouncer-finalize`

2. 상한에 닿았을 때 컨트롤러가 하면 안 되는 처분은?
   - A) 남은 finding을 `accepted`로 바꿔 G8을 통과시킴
   - B) `/bouncer-plan`으로 에스컬레이션
   - C) 포인터를 그 task에 남기고 멈춤

3. `/bouncer-run` step 4의 리뷰 상한 문장이 verify 상한과 맞춰 추가한 소유권
   표현은?
   - A) 루프가 자체적으로 3회 상한을 더 둠
   - B) `scale: light`일 때만 상한을 적용함
   - C) `/bouncer-execute`가 정한 대로 **2회**이며, 루프가 그 위에 별도
     상한을 씌우지 않음

## 이해 상태
- quiz_score: 3/3
- 응답: 1B, 2A, 3C (모두 정답)
- 정답: 1B (2회·`/bouncer-execute`), 2A (`accepted`로 G8 통과 금지), 3C
  (execute 소유 참조·루프 별도 상한 없음)
- disposition: 리뷰 왕복 상한 소유권이 execute에 있고 run은 참조만 한다는 점과
  accepted 금지를 확인함
- range: develop..5d8669d34c923a67710c75800c79ebab71a7ce08
- diff_sha: 94cc22119332407a7a48a0f24d87727157a2b0d5ad85f67c693c8ab6970bf2ed

## Tasks

### Task 001

#### Goal & intent

`/bouncer-execute` step 5의 리뷰 fix 루프에 왕복 상한 2회와 상한 도달 시 `/bouncer-plan` 에스컬레이션을 명시한다. 지금 그 자리에는 "fix within scope and re-review"만 있고, 숫자는 `/bouncer-run` step 4에만 있다. 이 task 이후 상한의 소유권은 execute에 있고 run은 verify 상한과 같은 형태로 그 숫자를 참조한다. 수용 기준은 에픽 Success criteria 1~6, 검증 명령은 `npm run ci`다.

#### Interface

- 제공: `skills/bouncer-execute/SKILL.md` step 5에 리뷰 왕복 상한 문장 — 왕복 2회, 상한 도달 시 `/bouncer-plan` 에스컬레이션, 상한을 이유로 남은 finding을 `accepted`로 바꾸지 않는다는 금지. 그 파일은 영문 본문이므로 step 4의 `at most **1** time`과 같은 형태의 영어로 쓴다. `skills/bouncer-run/SKILL.md` step 4의 리뷰 문장은 execute 소유임을 밝히고 루프가 별도 상한을 씌우지 않는다고 적되, 한국어 `2회` 리터럴과 기존 `/bouncer-plan`·`accepted` 문장은 남는다.
- 거부: 상한 도달을 `review → accepted`로 처리하는 서술은 쓰지 않는다. run 본문에 execute의 named 디스패치 절차나 상한 판단 근거를 복사하지 않는다 — run 계약 테스트가 `resolveSubagentModel`과 `scale: light` 리터럴을 거부한다. 게이트 번호·판정 로직·review frontmatter 계약을 바꾸는 서술도 쓰지 않는다.

#### Touch

- Modify `skills/bouncer-execute/SKILL.md` — step 5 (4)에 리뷰 왕복 상한·에스컬레이션·`accepted` 금지 문장을 넣는다
- Modify `skills/bouncer-run/SKILL.md` — step 4의 리뷰 상한 문장을 verify 문장과 같은 형태의 execute 참조로 바꾼다
- Modify `test/skill-bouncer-execute.test.js` — 새 상한 계약을 고정하는 테스트를 추가한다
- Modify `test/skill-bouncer-run.test.js` — 리뷰 상한 테스트가 소유권 문구까지 확인하도록 넓힌다
- Modify `docs/workflow.md` — 「알아둘 것」에 리뷰 재검 상한이 execute 단독 호출에도 걸린다는 항목을 더한다

#### Constraints

- 스킬 본문 골격을 유지한다: 마지막 섹션은 `## ACQ (AskUserQuestion) gates`이고 이 변경은 ACQ를 추가하지 않는다.
- 기존 verify 상한 서술을 바꾸지 않는다 — execute의 `redispatch the debugger at most **1** time`(step 4)과 run의 `**1회**`(step 4) 둘 다 그대로 둔다.
- 각 스킬 본문의 현행 언어를 따른다: `bouncer-execute`는 영문 절차 문장에 한국어 분기가 섞여 있고, `bouncer-run`은 한국어다. `##`/`###` 제목은 영문이어야 한다 (`test/skill-bouncer-surface.test.js`가 한글 제목을 거부한다).
- 상한은 프로즈 계약이다. `scripts/`에 카운터나 새 게이트를 만들지 않는다.
