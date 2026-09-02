---
type: bouncer.blueprint
title: finalize 인계에 같은 epic의 미완료 blueprint를 포함함
description: nextBlueprint가 ready 후보 밖의 같은 epic 잔여 blueprint도 함께 보고한다
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/010-finalize-pointer-scope/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-25T11:09:18.779+09:00'
bouncer:
  id: '010'
  epic_id: '009'
  blueprint_id: '010'
  status: closed
  commit_type: feat
  scale: full
---
# 010 finalize 포인터 인계 범위

Epic: [009](../../index.md)

## Intent
- 문제: `listReadyBlueprints`는 `approved` + 열린 task를 가진 blueprint만 후보로
  본다. 같은 epic에 아직 `draft`인 blueprint가 남아 있으면 `nextBlueprint`의
  `next`가 `null`이 되고, `/bouncer-finalize` step 6의 인계 ACQ가 통째로 건너뛰어진다.
  사용자는 "이 epic은 끝났다"는 인상만 받고 남은 계획을 스스로 기억해야 한다.
- 완료 조건: finalize 페이로드가 같은 epic의 `closed` 아닌 잔여 blueprint를 상태와
  함께 별도 필드로 싣고, 스킬이 그 필드로 `--set` 제안과 `/bouncer-plan` 안내를 갈라낸다.

## Contract
- 인터페이스: `nextBlueprint({ repoRoot, blueprintDir })`의 반환에 세 번째 필드
  `sameEpicPending`을 더한다. 값은 배열이며 각 원소는
  `{ blueprint, blueprintStatus, ready }` — `blueprint`는 저장소 상대 경로,
  `blueprintStatus`는 blueprint `index.md`의 `bouncer.status` 문자열,
  `ready`는 `listReadyBlueprints` 결과에 그 경로가 있는지의 불리언이다.
  키 이름을 `status`로 하지 않는 이유는 `listReadyBlueprints` entry의 `status`가
  blueprint 상태가 아니라 첫 열린 task의 상태이기 때문이다.
  기존 `next` / `remaining` 필드의 모양과 정렬은 바뀌지 않는다.
- 데이터·상태: 문서 프론트매터 스키마 변경 없음. 새 설정 키 없음. 파일 쓰기 없음 —
  `nextBlueprint`는 지금처럼 순수 계산이다.
- 수용 기준: epic 050 Success criteria 1·2·3.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 잔여가 `draft`뿐이면 `next`는 여전히 `null`이고 `sameEpicPending`만 채워진다.
    이때 `bouncer current --set`을 부르면 plan 게이트 G2가 거절하므로 스킬은
    그 명령을 제안하지 않고 `/bouncer-plan`을 안내해야 한다.
  - `closed` blueprint는 어느 필드에도 들어가지 않는다. finalize 대상 자신도 제외한다.
  - `approved`인데 열린 task가 하나도 없는(전부 `verified`) 형제는 `--set` 후보가
    아니므로 `ready: false`로 실린다.
  - `index.md`가 깨졌거나 읽히지 않는 형제는 그 항목만 건너뛴다 — 형제 하나가
    나머지 목록을 지우지 않는다.
  - `nextBlueprint`가 throw할 때 `finalize`가 쓰는 빈 핸드오프 폴백도 새 필드를
    가져야 한다. 그러지 않으면 스킬이 `undefined`를 순회한다.
  - 같은 epic에 `next` 후보와 `draft` 형제가 동시에 있으면 둘 다 보고된다 —
    `next`가 있다고 잔여 목록을 감추지 않는다. 다만 `next.next.blueprint`와 같은
    항목은 후보로 한 번만 표시하고 잔여 목록에서 다시 적지 않는다.
  - `approved`인데 열린 task가 없어 `ready: false`인 형제는 `--set` 선택지에
    올리지 않는다. `--set` 대상은 언제나 `next.next.blueprint`다.

## Out of scope
- `listReadyBlueprints`의 후보 조건 완화. 이 함수는 `bouncer current`의 `ready`와
  `--set` 자동 선택이 함께 쓰므로, 여기서 넓히면 승인 전 blueprint가 포인터
  후보로 새어 나간다.
- `nextBlueprint`의 정렬 규칙과 `sharedPaths` 계산.
- `/bouncer-commit`의 같은 blueprint 다음 task 인계.
- 포인터를 자동으로 옮기는 경로.

## One-commit justification
- 새 필드 하나와 그 필드를 읽는 스킬 분기, 그리고 두 곳의 테스트가 한 계약이다.
  필드만 넣고 스킬을 그대로 두면 아무 동작도 달라지지 않고, 스킬만 고치면
  존재하지 않는 필드를 읽는다. 함께 리뷰되어야 판정이 선다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
