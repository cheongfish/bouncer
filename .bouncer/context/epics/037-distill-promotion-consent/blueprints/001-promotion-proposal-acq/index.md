---
type: bouncer.blueprint
title: 001 승격 제안과 단일 동의
description: 샤드 인벤토리 노출과 finalize 승격 제안·동의 절차
resource: .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-14T16:25:12.612+09:00'
bouncer:
  id: '001'
  epic_id: '037'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
---
# 001 promotion-proposal-acq

Epic: [037](../../index.md)

## Intent
- 문제: finalize 1단계는 후보를 찾은 뒤 곧바로 Distill에 쓴다. 사람이 볼 기회가 없고, 샤드 저장소에서는 어느 파일에 넣을지도 규정되어 있지 않다.
- 완료 조건: 후보가 동작과 대상 샤드가 붙은 목록으로 제시되고, 한 번의 동의 뒤에만 쓰이며, 거절해도 사이클이 끝까지 진행된다.

## Contract
- 인터페이스:
  - `bouncer distill --all --json`의 `audit`에 `shards` 배열을 더한다. 각 항목은 `{ id, path, always, pathsKnown, pullsKnown }`에 선언된 경우의 `paths`·`pulls`를 더한 형태이고 본문(`raw` / `body` / `content`)은 싣지 않는다. 선택 결과가 아니라 등재된 전체 샤드를 담는다.
  - `/bouncer-finalize` 1단계는 후보 목록을 `drop` → `replace` → `add` 순으로 정렬해 한 번에 제시하고, 승인·수정·건너뛰기 세 갈래의 단일 ACQ를 받는다.
  - `spec-authoring` 승격 절은 항목마다 동작·불릿 문장·출처(explain의 절)·대상 샤드를 산출하고, 동의 신호를 받은 뒤에만 파일을 쓴다.
  - 마스터 룰 7에 승격이 동의 절차를 거친다는 한 문장을 더한다.
- 데이터·상태:
  - 제안 항목: 동작(`add` | `replace` | `drop`), 불릿 문장, 출처 한 줄, 대상 샤드 id. `replace`는 대체될 기존 문장을 함께 갖는다.
  - 대상 샤드 판단은 에이전트 몫이고 CLI는 판단하지 않는다. 확신이 낮으면 `always` 샤드로 보낸다.
  - 새 설정 키도 새 문서 필드도 만들지 않는다. 동의 여부는 세션 안에서만 유효하며 어디에도 기록하지 않는다.
- 수용 기준: epic 성공 조건 1–8을 그대로 따른다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 후보 0건 — ACQ를 띄우지 않고 승격할 것이 없다고만 보고한다.
  - 수정 선택 — 반영해 다시 제시한다. 승인이나 건너뛰기 없이 쓰기로 넘어가지 않는다.
  - 샤드 인덱스가 없거나 무효 — 단일 파일 fallback이므로 대상 표시는 파일 하나이고 배치 판단은 하지 않는다.
  - 배치 확신 부족 — `always` 샤드로 보낸다. 라우팅에서 빠지는 것보다 항상 실리는 편이 안전하다.
  - ACQ 도구를 쓸 수 없는 환경 — 같은 목록을 대화에 그대로 렌더하고 응답을 기다린다. `/bouncer-finalize`의 기존 ACQ 규칙과 같은 처리이고, 응답 없이 승격으로 넘어가지 않는다.
  - `drop` 대상 문구가 현재 Distill과 일치하지 않음 — 그 항목만 실패로 보고하고 나머지는 진행한다.
  - 목록이 길어도 임의로 자르지 않는다. 정렬만 유지하고 생략은 보고한다.

## Out of scope
- 게이트 신설, `routing_enabled` 변경, 샤드 재분할, 폐기 자동 판단.
- `makeFinalizeAllowed` 변경 — 등재된 샤드 경로는 이미 화이트리스트에 있다.
- 다른 ACQ(Draft PR, 다음 blueprint)의 문구·순서 변경.

## One-commit justification
- 2개 task document가 각각 하나의 구현 커밋이며, 이 Blueprint는 배치 근거(CLI)와 그것을 쓰는 절차(프로즈)를 잇는 단일 PR·리뷰 단위다. CLI가 먼저 들어가야 프로즈가 존재하는 필드를 가리킨다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 샤드 인벤토리를 `distill --json`에 싣기
* [Tasks 002](tasks/002/tasks.md) - finalize 승격 제안과 단일 동의 절차
* [Context review](context-review.md) - 계획 문서 정합성 판정
