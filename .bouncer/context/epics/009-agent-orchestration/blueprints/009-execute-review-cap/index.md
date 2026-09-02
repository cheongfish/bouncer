---
type: bouncer.blueprint
title: 리뷰 재검 왕복 상한과 소유권 정리
description: execute step 5에 리뷰 왕복 2회 상한을 넣고 run은 그 숫자를 참조만 하도록 바꾼다
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/009-execute-review-cap/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-24T12:58:35.184+09:00'
bouncer:
  id: '009'
  epic_id: '009'
  blueprint_id: '009'
  status: closed
  commit_type: feat
  scale: full
---
# 009 execute-review-cap

Epic: [009](../../index.md)

## Intent
- 문제: 상한 숫자가 `/bouncer-run` step 4에만 있어, 단일 task로 `/bouncer-execute`를 직접 부르거나 멈춘 주행을 복구할 때는 리뷰 왕복에 끝이 없다.
- 완료 조건: execute 본문이 리뷰 왕복 상한과 에스컬레이션을 갖고, run 본문이 verify 문장과 같은 형태로 그 숫자를 execute 소유로 참조하며, 두 계약 테스트가 그 문구를 고정한다.

## Contract
- 인터페이스: `/bouncer-execute` step 5에 리뷰 왕복 상한 문장이 추가된다. 상한은 왕복 2회이고, 상한에 닿으면 `/bouncer-plan` 에스컬레이션이며, 상한을 이유로 남은 finding을 `accepted`로 바꾸지 않는다. `/bouncer-run` step 4의 리뷰 문장은 자체 규칙에서 execute 참조로 바뀌되 숫자 `2회`는 본문에 남는다. `docs/workflow.md`는 그 상한이 주행뿐 아니라 execute 단독 호출에도 걸린다는 것을 사용자 문서 수준에서 한 항목으로 적는다.
- 데이터·상태: 문서 상태·frontmatter·게이트 판정은 바뀌지 않는다. `review.md`의 `bouncer.review.findings[]` 계약과 status 전이 규칙도 그대로다. 상한 도달은 `review → accepted`가 아니라 미승인 상태로 멈춘 것이다.
- 수용 기준: 에픽 Success criteria 1~6.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 상한 도달 시 `review.md` status를 `accepted`로 찍으면 G8이 통과해 버린다 — 본문이 이를 금지 문장으로 막아야 한다.
  - `/bouncer-run` 계약 테스트는 본문에 `1회`와 `2회`가 모두 있기를 요구한다. run에서 숫자만 지우면 그 테스트가 깨지므로, 숫자는 남기고 소유권 문장만 verify 쪽과 같은 형태로 맞춘다.
  - 두 스킬의 본문 언어가 다르다. `bouncer-run`은 한국어라 `2회` 리터럴이 그대로 쓰이지만, `bouncer-execute`는 영문 절차 본문이고 `회` 문자가 한 번도 없다 — 그 파일의 상한 문장은 step 4의 `at most **1** time`과 짝이 맞는 영어로 쓰고, 계약 테스트도 그 영어 문구를 잡는다.
  - run 본문에는 `resolveSubagentModel`과 `scale: light` 리터럴을 넣을 수 없다(계약 테스트의 doesNotMatch). 상한 문장을 쓸 때 execute의 디스패치 절차를 함께 복사하지 않는다.
  - `bouncer.review.required === false`로 리뷰를 건너뛰는 경로에는 상한이 적용될 자리가 없다 — 그 분기 문장은 건드리지 않는다.

## Out of scope
- fan-out·다중 리뷰어·2차 패스 모델 교체.
- `skills/review/SKILL.md`, `agents/bouncer-reviewer.md`, `skills/review/assets/reviewer-prompt.md`의 루브릭과 출력 계약.
- `scripts/`의 G8·G14 판정과 review 스키마.

## One-commit justification
- 두 스킬 본문과 각각의 계약 테스트가 같은 문구 하나를 서로 가리킨다. execute만 먼저 고치면 run이 같은 숫자를 두 번 선언하는 중간 상태가 남고, 테스트만 먼저 고치면 그 커밋에서 `npm run ci`가 깨진다. `docs/workflow.md` 한 항목도 같은 숫자를 인용하므로 함께 간다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
