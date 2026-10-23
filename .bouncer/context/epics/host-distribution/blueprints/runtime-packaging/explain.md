---
type: bouncer.explain
title: runtime-packaging 실행 중단 설명
resource: .bouncer/context/epics/host-distribution/blueprints/runtime-packaging/explain.md
tags:
  - bouncer
  - blueprint
  - runtime
  - execution
---
# runtime-packaging 실행 중단 설명

## 진행된 범위
TASKS-001은 SessionStart lint 복구를, TASKS-002는 runtime 패키지 배치와 개발 도구·테스트 경로 이전을 담당했다. 두 task는 integration worktree에 통합됐다.

TASKS-003은 plugin asset resolver와 runtime/plugin version 경계를 담당한다. 이 task의 focused 검증은 runtime launcher가 안내하는 build 경로 때문에 실패했다. 그 launcher 파일은 최초 brief에서 TASKS-003의 수정 금지 경로였으나, 실패를 고치는 데 필요한 파일이었다.

## TASKS-003 시도 내용
- 지정 focused 검증은 175개 중 172개 통과와 3개 실패로 끝났다.
- 실패 분석은 `packages/cli/bin/bouncer`와 `packages/cli/bin/bouncer-root`의 build guidance가 패키지 분리 뒤의 경로를 올바르게 안내하지 않는다고 분류했다.
- 첫 attempt의 worker는 resolver, version 검사, 관련 테스트 변경을 준비했지만 launcher 두 파일을 수정할 수 없어 통합 커밋을 만들지 않았다.
- 사용자 승인으로 scope revision `r1`이 두 launcher를 affected paths에 추가했다. 기존 blocked lease를 revoke하고 새 attempt도 열었지만, brief의 `Do not touch`에는 두 파일이 그대로 남아 있었다.

## 중단 원인
범위 수정 `r1`은 launcher 두 파일을 TASKS-003의 affected paths에 추가했다. 그러나 Bouncer의 `coordinate revise`는 affected paths와 scope decision만 바꾸며, 같은 brief 안의 `Do not touch` 목록은 갱신하지 않는다.

따라서 새 worker는 같은 파일을 한편으로는 수정해야 하고 다른 한편으로는 수정해서는 안 되는 brief를 받았다. worker는 이 모순을 범위 위반으로 처리해 blocked 보고를 남겼다. 이미 통합된 TASKS-002를 `repair --resume-task`로 고치는 방식도 terminal verification 실패가 아니라는 이유로 허용되지 않았다.

## 재개 조건
TASKS-003의 affected paths와 `Do not touch` 목록을 한 revision에서 함께 갱신하거나, 해당 모순을 해소하는 별도 Bouncer CLI 전이를 제공해야 한다. 그 뒤 blocked lease를 해제하고 새 TASKS-003 attempt를 열어 focused 검증을 다시 실행한다.

이 문서는 실행 상태를 설명할 뿐, 검증 성공 증적이나 blueprint 종료를 기록하지 않는다.
