---
type: bouncer.epic
title: 007 project-distill
description: Epic 007
resource: .bouncer/context/epics/007-project-distill/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-03T04:59:09.977Z'
bouncer:
  id: '007'
  epic_id: '007'
  status: approved
---
# 007 project-distill

## Intent
- 문제: 프로젝트 교훈·현재 결정을 다음 plan/execute에 연결하는 Distill이
  생겼지만, 상대 경로만으로는 plugin checkout과 소비 저장소 중 어느 파일인지
  구분되지 않는다.
- 목표: `.bouncer/Distill.md`를 프로젝트 공용 Distill로 두고, 마스터 룰은
  경로 계약만 가리키며, plan/execute는 읽고, finalize는 선별한 항목으로 갱신한다.

## Success criteria
1. 새 저장소 `bouncer init` 후 `.bouncer/Distill.md`가 생기고, 이미 있으면
   덮어쓰지 않는다.
2. plan/execute 스킬이 전역 Distill을 preflight에서 읽도록 명시한다.
3. finalize 스킬이 BP `explain.md` → 전역 Distill 승격(추가·교체·폐기)을 명시한다.
4. `bouncer finalize`가 `.bouncer/Distill.md` 변경을 out-of-scope로
   거부하지 않는다.
5. 마스터 룰은 전역 Distill 경로와 읽기 의무만 담고 본문을 넣지 않는다.
6. `npm test` 통과.
7. `bouncer project-root`가 primary checkout과 linked worktree에서 같은 main
   worktree 절대 경로를 출력한다.
8. 워크플로 스킬은 Distill 경로를 plugin root나 execute worktree cwd에서
   유도하지 않는다.
9. plugin root와 project root가 같은 도그푸드 환경에서도 같은 계약이 성립한다.

## Out of scope
- BP `explain.md`의 comprehension·published 계약 변경.
- 전역 Distill 본문 품질·분량을 게이트가 깊게 검사하는 것.
- 별도 ADR 시스템·learnings 디렉터리·루트 `AGENTS.md` 자동 병합.
- 과거 BP distill 일괄 재작성(시드는 전역 파일 한 곳에만).
- 플러그인 패키징에서 `.bouncer/` 제외, Read 훅 차단, 브랜치별 Distill 분리.

## Blueprints
* [001 global-distill-runtime](blueprints/001-global-distill-runtime/index.md) - 전역 Distill 파일·init/finalize 허용·스킬·마스터 룰을 한 커밋으로 연결한다
* [002 project-root-distill](blueprints/002-project-root-distill/index.md) - `runtime-state`의 main worktree 해석을 `bouncer project-root`로 노출하고 Distill 읽기·쓰기 경로를 그 결과로 통일한다
