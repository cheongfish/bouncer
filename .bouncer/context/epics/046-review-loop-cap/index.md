---
type: bouncer.epic
title: execute 리뷰 재검 루프 상한
description: execute의 리뷰 fix 루프에 왕복 상한을 두고 그 숫자의 소유권을 execute로 모은다
resource: .bouncer/context/epics/046-review-loop-cap/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-24T12:58:35.149+09:00'
bouncer:
  id: '046'
  epic_id: '046'
  status: approved
---
# 046 review-loop-cap

## Intent
- 문제: `/bouncer-execute` step 5는 actionable finding이 남으면 "fix within scope and re-review"만 적어 재검 횟수에 끝이 없다. 같은 스킬의 verify 경로는 1회 상한 뒤 `/bouncer-plan` 에스컬레이션인데 리뷰 경로만 열려 있고, 실제 숫자는 `/bouncer-run`에만 있어 상한의 소유권이 execute가 아니라 주행 루프에 가 있다.
- 목표: 리뷰 재검 왕복 상한을 execute가 숫자로 갖고, `/bouncer-run`은 verify 상한과 같은 형태로 그 숫자를 참조만 한다.

## Success criteria
1. `skills/bouncer-execute/SKILL.md` step 5가 리뷰 재검 왕복 상한을 숫자 2로 명시하고, 상한에 닿으면 fix 반복이 아니라 `/bouncer-plan` 에스컬레이션이라고 적는다.
2. 같은 본문이 상한 도달을 이유로 남은 finding을 `accepted`로 바꾸지 않는다고 적는다.
3. `skills/bouncer-run/SKILL.md` step 4의 리뷰 상한 문장이 verify 문장과 동일하게 두 절을 갖는다 — `/bouncer-execute` 소유 명시, 그리고 루프가 그 숫자 위에 별도 상한을 씌우지 않는다는 문장. 기존 `/bouncer-plan` 에스컬레이션과 `accepted` 금지 문장은 남는다.
4. `test/skill-bouncer-execute.test.js`가 1·2의 문구를 계약으로 고정하고, `test/skill-bouncer-run.test.js`가 3의 소유권 문구를 확인한다.
5. `docs/workflow.md`가 리뷰 재검 왕복 상한이 `/bouncer-execute` 단독 호출에도 걸린다는 것을 적는다.
6. `npm run ci`가 통과한다.

## Out of scope
- 같은 diff를 여러 리뷰어에게 병렬로 돌리는 fan-out 도입.
- 2차 패스 모델 교체 — `subagents` 설정, `resolveSubagentModel`, `agents/bouncer-reviewer.md` 계약.
- `review` 스킬의 severity 보고 정책과 컨트롤러 disposition 단계.
- `scripts/`의 게이트 판정(G8·G14)과 review frontmatter 스키마.
- `bouncer.scale: light`의 인라인 리뷰 분기.

## Blueprints
* [001 execute 리뷰 재검 상한](blueprints/001-execute-review-cap/index.md) - execute step 5에 리뷰 왕복 2회 상한과 에스컬레이션을 넣고 run의 상한 문장을 execute 참조로 바꾼다 (`skills/bouncer-execute`, `skills/bouncer-run`, 두 스킬 계약 테스트)
