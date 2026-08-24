---
type: bouncer.blueprint
title: 브리프 주입 축소
description: 포인터가 scale을 나르고 execute 브리프에서 scope_evidence와 중복 진술을 걷어낸다
resource: .bouncer/context/epics/047-context-injection/blueprints/001-brief-injection-slim/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-24T13:32:35.001+09:00'
bouncer:
  id: '001'
  epic_id: '047'
  blueprint_id: '001'
  status: approved
  commit_type: refactor
  scale: full
---
# 001 브리프 주입 축소

Epic: [047](../../index.md)

## Intent
- 문제: execute는 `bouncer.scale` 한 필드 때문에 blueprint `index.md`(평균 451 단어)를 두 지점에서 열고, task 브리프 745 단어에는 구현자의 행동을 바꾸지 않는 `scope_evidence`(≈60 단어)와 같은 변경의 5중 진술이 섞여 있다.
- 완료 조건: 포인터가 `scale`을 나르고, execute 읽기 경로에서 blueprint `index.md`와 `scope_evidence`가 빠지며, `spec-authoring`이 중복 진술을 막는 역할 경계를 갖는다.

## Contract
- 인터페이스: `bouncer current` 응답 객체에 `scale` 키가 추가된다(`blueprint`·`base`·`task`와 같은 최상위 레벨). 값은 blueprint `index.md`의 `bouncer.scale`에서 파생하며 읽기 실패·부재는 `null`이다. 포인터 파일 형식은 바뀌지 않는다.
- 데이터·상태: `scale`의 SSOT는 blueprint `index.md`로 유지된다. 포인터 응답은 파생값이고 `presentCurrent` 호출 시점마다 다시 계산되므로 stale 값을 보관하지 않는다.
- 수용 기준: `skills/bouncer-execute/SKILL.md`의 두 경량 분기가 포인터 값을 근거로 삼고 blueprint `index.md`를 열지 않는다. `scope_evidence`가 주입 제외로 명시된다. `spec-authoring`이 `description`·`commit_intent`·`Checklist`의 경계를 적는다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - blueprint `index.md`가 없거나 파싱 불가 → `scale: null`. 포인터를 지우지 않고 execute는 full 경로로 판정한다.
  - `scale` 값이 `SCALE_ENUM` 밖 → `presentCurrent`는 값을 그대로 노출하고 판정하지 않는다. enum 검사는 S20의 몫이며 여기서 중복 판정하지 않는다.
  - 0.7 시절 `scale` 없는 blueprint → `null`, 곧 full 경로. 기존 "missing scale은 통과" 동작과 같다.
  - `description`을 `## Goal & intent`에서 유도하는 규율이 OKF 필수 필드를 비우면 안 된다 — 값은 계속 존재하고, 사람이 두 번 쓰지 않는다는 규율일 뿐이다.

## Out of scope
- `scope_evidence`를 문서에서 삭제하는 것. G4 입력이자 감사 기록이라 남긴다.
- 포인터 파일(`<git-common-dir>/bouncer/current`) JSON 스키마 변경.
- G4·G5·G10–G12·S20의 판정 내용.
- Distill 샤드 규율 — blueprint 002가 다룬다.

## One-commit justification
<!-- 이 blueprint는 task 세 묶음이며 각 묶음이 한 커밋이다. blueprint는 리뷰 / PR 단위다. -->
- task 001은 런타임 파생값 한 개(`scripts/` + `skills/bouncer-execute`), task 002는 execute 브리프 읽기 계약 한 문장, task 003은 `spec-authoring` 작성 규율이다.
- task 002는 `skills/bouncer-execute/SKILL.md`와 `test/skill-bouncer-execute.test.js`에서 task 001 위에 쌓인다. 되돌리려면 002를 먼저 되돌린다. task 003은 두 task와 파일이 겹치지 않아 독립적이다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 포인터 `scale` 파생값
* [Tasks 002](tasks/002/tasks.md) - `scope_evidence` 주입 제외
* [Tasks 003](tasks/003/tasks.md) - `tasks.md` 중복 축소
* [Verification 001](tasks/001/verification.md) · [002](tasks/002/verification.md) · [003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) · [002](tasks/002/review.md) · [003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
