---
type: bouncer.epic
title: 마감된 blueprint 잠금
description: 마감된 blueprint를 closed로 잠가 task 추가를 막고 후속 작업은 새 blueprint에서 시작하게 한다
resource: .bouncer/context/epics/022-blueprint-closure/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-08T13:17:04.339+09:00'
bouncer:
  id: '022'
  epic_id: '022'
  status: approved
---
# 마감된 blueprint 잠금

## Intent
- 문제: `/bouncer-finalize`가 끝나도 blueprint status는 `approved`로 남는다.
  PR이 닫힌 뒤에도 같은 blueprint에 task를 덧붙일 수 있고, 그러면 이미 확정된
  `diff_sha`·comprehension 기록과 어긋난 채 「BP = 리뷰되고 머지된 하나의 단위」가 깨진다.
- 목표: 마감된 blueprint를 `closed`로 잠가 task 추가 경로를 막고, 후속 작업이
  새 blueprint로 가게 한다.

## Success criteria
1. blueprint status 어휘가 `closed`를 받아들이고, `closed`인 문서가 스키마 검사를 통과한다.
2. `bouncer finalize --yes`가 G16 통과 후 대상 blueprint `index.md`의 status를
   `approved`에서 `closed`로 바꾸고, 그 파일 변경을 finalize 커밋에 포함한다.
3. `--yes` 없는 finalize dry-run은 어떤 문서도 수정하지 않고 예정된 전이만 결과에 담는다.
4. 이미 `closed`인 blueprint에 finalize를 다시 돌려도 status를 재기록하지 않는다.
5. `bouncer scaffold task --blueprint <closed blueprint>`가 exit 2로 거절하고,
   새 blueprint를 만들라는 안내를 stderr로 낸다.
6. `bouncer validate --gate plan`이 `closed` blueprint를 G2에서 미승인(`draft`)과
   구분되는 사유로 보고하고, `bouncer current --set`이 포인터를 쓰지 않는다.
7. `listReadyBlueprints`와 `nextBlueprint`가 `closed` blueprint를 후보에서 제외한다.
8. `npm test`가 통과한다.

## Out of scope
- 실제 PR 머지 감지. `gh`로 PR 상태를 조회하지 않고, finalize 완료를 마감 시점으로 본다.
- 잠금을 되돌리는 `bouncer reopen` 류의 명령. 해제는 `index.md` status를 손으로
  `approved`로 돌리는 것뿐이고 문서로만 안내한다.
- epic status를 `closed`로 옮기는 전이. epic은 blueprint가 더 붙을 수 있으므로 열어 둔다.
- 잠긴 blueprint에 열린 task가 남아 있는 상태를 잡는 전용 구조 코드(S) 신설.
- `superseded` 어휘의 의미 정리나 제거.
- 새 blueprint가 원 blueprint를 참조하는 규칙을 스킬 프로즈로 강제하는 일.
  `explain.md` 작성 관례로 남긴다.
- worktree 디렉터리 이름 규칙, 좁은 범위 작업의 경량 경로, graphify 설치·실행 경로.

## Blueprints
* [001 closed-status](blueprints/001-closed-status/index.md) - blueprint status에 `closed`를 신설해 finalize가 자동 전이하고 잠긴 blueprint의 task 추가를 스캐폴드·plan 게이트에서 막는다 (`scripts/src/lib/`, `scripts/lib/`, `docs/`, `test/`)
