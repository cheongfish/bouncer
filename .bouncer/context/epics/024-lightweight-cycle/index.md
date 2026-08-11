---
type: bouncer.epic
title: 좁은 범위 작업의 경량 사이클
description: 공용 유지보수 epic·인라인 디스패치·최소 퀴즈로 한 사이클의 왕복을 줄임
resource: .bouncer/context/epics/024-lightweight-cycle/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-10T16:57:46.678+09:00'
bouncer:
  id: '024'
  epic_id: '024'
  status: approved
---
# 024 lightweight-cycle

## Intent
- 문제: 오탈자 수정이나 한 줄짜리 문구 교정에도 epic 신설부터 시작해 네임드
  에이전트를 두 번 왕복하고 diff 규모와 무관한 퀴즈를 치른다. 규모에 비해 준비
  비용이 커서 작은 작업이 루프 밖으로 새어 나간다.
- 목표: 사용자가 좁은 범위를 선언하면 epic 신설·서브에이전트 왕복·퀴즈 규모
  셋만 줄이고, 문서 종류와 게이트는 그대로 둔 채 같은 사이클을 돌린다.

## Success criteria
1. `docs/governance.md`에 경량 사이클 절이 있고, 줄어드는 셋(새 epic 신설,
   네임드 에이전트 왕복, 퀴즈 문항 수)과 그대로인 것(task/verification/review/
   explain 문서, G1~G16 판정, Distill 승격)을 각각 명시한다.
2. 경량 여부는 사용자 선언으로만 정해지며, diff 크기나 경로 수로 자동 판정하는
   규칙이 어느 문서에도 없다.
3. `/bouncer-plan`이 경량 선언을 받으면 새 epic id를 뽑지 않고 공용 유지보수
   epic 아래에 blueprint만 스캐폴드하는 분기를 갖는다.
4. `/bouncer-execute`가 경량 선언에서 인라인 구현·리뷰를 정당한 경로로 허용하고,
   그 경로에서도 G6·G7·G8·G13·G14 판정 문구가 달라지지 않는다.
5. `skills/explain-diff`가 경량 사이클에서 문항 수 1을 고를 근거를 갖는다.
   1~10 범위와 3지선다·정답 위치 분산 규칙은 그대로다.
6. 인라인 리뷰가 자기 diff를 자기가 판정하는 구조라는 한계가 지침에 적혀 있다.
7. `npm test`가 통과한다.

## Out of scope
- 신규 `quick` 모드, 신규 CLI 하위 명령, 게이트 분기. 기존 수단으로 부족한
  이유를 확인하기 전에는 코드를 늘리지 않는다.
- 게이트 완화와 옵트아웃. 작은 작업일수록 탈출구를 쓰게 되므로 만들지 않는다.
- 문서 종류 축소. 히스토리를 커밋·`explain.md`·Distill 셋 다에 남기기로 한 이상
  tasks / verification / review / explain은 전부 남는다.
- 경량 여부의 자동 판정. plan 시점에는 diff가 없어 근거가 없다.
- 이 저장소에 실제 공용 유지보수 epic을 미리 만드는 일. 첫 경량 작업이 생길 때
  만든다.
- `bouncer-implementer` / `bouncer-reviewer` / `bouncer-debugger`의 계약과
  read-only 경계 변경.
- graphify 설치·실행 경로, `context_dirs` 경량화.

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (docs/governance.md).
     한 줄 목적에는 무엇이 바뀌는지(what)와 어디를 건드리는지(where)를
     함께 적는다. 기존 라인은 소급 수정하지 않는다. -->
* [001 lightweight-cycle-guidance](blueprints/001-lightweight-cycle-guidance/index.md) - 경량 사이클 정의를 문서화하고 plan의 공용 epic 분기·execute의 인라인 허용·explain-diff의 최소 문항 근거를 프로즈로 배선한다 (`docs/`, `skills/`, `test/`)
