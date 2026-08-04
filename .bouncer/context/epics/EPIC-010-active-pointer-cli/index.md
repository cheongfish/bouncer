---
type: bouncer.epic
title: EPIC-010 active-pointer-cli
description: Epic EPIC-010
resource: .bouncer/context/epics/EPIC-010-active-pointer-cli/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-04T08:59:20.744+09:00'
bouncer:
  id: EPIC-010
  epic_id: EPIC-010
  status: approved
---
# EPIC-010 active-pointer-cli

## Intent
- 문제: 활성 블루프린트 포인터는 워크플로 전체를 좌우하는 상태다 — 커밋 가드가 그것으로
  `affected_paths`를 강제하고, execute와 finalize는 그것 없이는 시작하지 못한다. 그런데
  포인터를 조회·기록·해제하는 지원되는 표면이 없다. 세 워크플로 스킬이 각자 `node -e`로
  `scripts/lib/current` 내부 모듈을 직접 호출하고, 문서와 스킬은 실제 파일 위치가 아닌
  `.bouncer/current`를 가리킨다. `/bouncer-finalize`가 커밋 후 포인터를 지우는 것은 설계된
  동작인데(남기면 가드가 끝난 블루프린트의 경로를 계속 강제한다), 그 뒤 `/bouncer-execute`는
  포인터가 비었다는 이유로 "먼저 계획하라"고 안내한다. 계획이 끝나 승인·ready 상태로 대기
  중인 블루프린트가 있어도 마찬가지라, 사용자는 다 끝난 계획을 다시 하러 보내진다.
- 목표: 활성 포인터에 CLI 표면 하나를 두고 스킬이 그것만 부르게 한다. 포인터가 비었을 때
  "무엇이 실행 가능한가"는 에이전트의 탐색이 아니라 하네스의 답이 된다.

## Success criteria
1. `bouncer current`가 활성 포인터를 출력하고, 포인터가 없으면 실행 가능한 블루프린트
   후보 목록을 같은 출력에 함께 돌려준다.
2. `bouncer current --set <dir>`는 대상이 plan 게이트를 통과할 때만 포인터를 기록하고,
   통과하지 못하면 기록하지 않은 채 실패 코드를 보고한다.
3. `bouncer current --clear`가 포인터를 제거하며, 포인터가 없어도 실패하지 않는다.
4. `/bouncer-plan`·`/bouncer-execute`·`/bouncer-finalize` 어디에도 `node -e`로
   `scripts/lib/current`를 직접 부르는 블록이 남아 있지 않다.
5. 포인터 파일 위치를 `.bouncer/current`라고 적은 스킬·문서 문장이 남아 있지 않다.
6. 포인터가 비었고 후보가 있을 때 `/bouncer-execute`의 안내가 "다시 계획하라"가 아니라
   "포인터를 그 블루프린트로 지정하라"가 된다.
7. 포인터 파일의 위치와 `{ blueprint, base }` 형식, 커밋 가드 판정, finalize가 커밋 후
   포인터를 지우는 동작이 모두 그대로다. `npm test` 통과.

## Out of scope
- `/bouncer-finalize`가 커밋 후 다음 후보를 통지하는 것. 이 에픽의 후보 열거를 소비하는
  자연스러운 후속이지만 별도 blueprint다.
- 포인터 자동 전진(finalize가 다음 블루프린트로 포인터를 옮기는 것). 사용자가 시작하지도
  않은 블루프린트의 `affected_paths`를 커밋 가드가 즉시 강제하게 되어, `clearCurrent`가
  애초에 막으려던 상황을 되살린다.
- 포인터 파일 위치 이동. Git common directory 아래 그대로 둔다 — 워크트리가 복사 없이
  같은 포인터를 보는 현재 성질을 깨지 않는다.
- 다중 활성 블루프린트나 포인터 큐.
- 커밋 가드·게이트 판정 로직 변경. 이 에픽은 읽고 쓰는 표면만 만든다.
- 워크플로 순서 변경. plan → execute → finalize는 그대로다.

## Blueprints
* [활성 포인터 CLI 명령과 스킬 배선](blueprints/BP-001-current-command/index.md) - `bouncer current` 읽기·`--set`·`--clear`를 만들고 세 워크플로 스킬을 그 명령으로 옮긴다
