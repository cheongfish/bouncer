---
type: bouncer.epic
title: 012 finalize-handoff
description: Epic 012
resource: .bouncer/context/epics/012-finalize-handoff/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-04T18:03:35.506+09:00'
bouncer:
  id: '012'
  epic_id: '012'
  status: approved
---
# 012 finalize-handoff

## Intent
- 문제: 승인된 블루프린트가 여러 개 대기 중일 때, 마감이 끝나면 포인터는 지워지고
  워크플로는 거기서 끊긴다. 다음 대상이 무엇인지는 문서에 이미 다 적혀 있는데도 —
  에픽 `## Blueprints` 순서, 블루프린트 승인 상태, tasks 상태 — 사용자가 직접 열거하고
  경로를 복사해 포인터를 지정해야 한다. 하네스가 답할 수 있는 질문을 사람에게 미룬다.
- 목표: 마감이 끝나는 자리에서 다음 후보를 계산해 보여주고, 확인 한 번으로 포인터를
  옮긴다. 새 상태 파일도, 새 진입점도 만들지 않는다.

## Success criteria
1. 마감 대상과 같은 에픽에 `approved` + tasks `ready`/`in_progress` 블루프린트가 남아
   있으면, `/bouncer-finalize`가 다음 후보 하나와 남은 후보 목록을 사용자에게 보고한다.
2. 사용자가 승낙하면 포인터가 그 블루프린트로 기록되고, 거절하면 포인터는 비어 있는
   상태로 남는다 — 마감이 커밋 후 포인터를 지우는 현행 동작은 그대로다.
3. 후보가 하나도 없으면 마감은 지금과 동일하게 끝난다. 후보 없음은 오류가 아니다.
4. 다음 후보의 `affected_paths`가 방금 마감한 블루프린트의 것과 겹치면, 그 사실과
   겹치는 경로가 경고로 함께 출력된다. 경고는 전진을 막지 않는다.
5. 후보 순서는 에픽 `## Blueprints` 목록을 따른다. 목록에 없는 실행 가능 블루프린트도
   후보에서 빠지지 않고 뒤에 붙는다.
6. 다음 후보 계산은 부수효과가 없고, 문서 하나가 깨져 있어도 나머지 후보 열거가
   무너지지 않는다.
7. 새 CLI 명령, 새 설정 키, 포인터 파일 형식·위치 변경이 없다. `npm test` 통과.

## Out of scope
- 공개 CLI `bouncer next`. 계산은 내부 함수로 두고 마감 명령의 반환 필드로 흘려보낸다 —
  `advise`와 역할이 겹쳐 보이는 표면을 늘리지 않는다.
- 여러 블루프린트를 이어서 자동 실행하는 배치/드라이버 스킬. 목표는 무인 실행이 아니라
  명령 반복 제거다.
- 포인터 큐, 다중 활성 포인터, 워크트리별 포인터 키잉. 파생 가능한 상태를 파일에
  복제하지 않는다.
- base 브랜치 연쇄 자동화. 다음 후보가 이번 커밋 위에서 갈라져야 하는 경우는 경고로
  알리고 판단은 사용자에게 남긴다.
- `.bouncer/context/index.md`의 에픽 목록이 실제 디렉터리와 어긋난 문제. 성격이 다른
  문서 정합성 작업이다.
- 커밋 가드·게이트 판정 로직, 포인터 파일 위치와 `{ blueprint, base }` 형식.
- `advisor.detectPhase`와 Ponytail 모드 추천 경로.

## Blueprints
* [다음 후보 계산과 마감 인계](blueprints/001-next-blueprint-handoff/index.md) - `nextBlueprint`를 `scripts/src/lib/current.ts`에 더해 `finalize` 반환에 싣고, `skills/bouncer-finalize/SKILL.md`에 확인 기반 포인터 전진 단계를 추가한다
