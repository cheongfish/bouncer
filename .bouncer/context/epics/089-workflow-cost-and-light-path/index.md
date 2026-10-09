---
type: bouncer.epic
title: 일상 과제 절차 비용 절감과 light 경로 개편
description: Cut planning, coordination, and closing round-trips for everyday tasks and rebuild the light path into a single-session implementation with one independent reviewer.
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/index.md
tags:
  - bouncer
  - epic
  - light
  - coordinator
  - plan
  - token-cost
timestamp: '2026-10-09T21:12:43.023+09:00'
bouncer:
  id: '089'
  epic_id: '089'
  status: approved
  supersedes: []
---
# 089 일상 과제 절차 비용 절감과 light 경로 개편

## Intent
- 문제: 작은 과제에서도 plan의 질문·문서 왕복, run coordinator의 조회→모델→명령 왕복, 재작업·finalize의 문맥 재주입이 구현보다 큰 모델 비용을 만든다. light는 문서만 줄었을 뿐 run에서 coordinator와 worker 계층을 그대로 거친다.
- 목표: 결정적 연쇄는 CLI가 진행하고 모델에는 판단 대상만 전달한다. light는 plan → run → finalize 세 단계를 유지한 채 run 세션의 직접 구현과 독립 reviewer 1세션으로 처리하고, full은 대규모·복잡 작업에 남긴다.

## Success criteria
1. `bouncer coordinate advance`는 `coordinate next`가 판단 없이 실행하라고 한 행동만 이어서 진행하고, `judge`·worker 위임·`blocked`·오류·같은 실패 코드 연속 재발·결과 불명확에서 멈춰 이유와 다음 행동을 돌려준다. 테스트가 허용 전이와 각 정지 사유를 고정한다.
2. 판단 지점의 응답은 현재 task, 해당 계약 카드, 판단 대상 보고서만 싣는다. 완료 task 본문, 원장 전체, 지난 보고서 본문, 누적 stdout이 응답에 없고, 필요한 원본은 경로 포인터로 항목을 지정해 읽는다. 테스트가 키 집합으로 고정한다.
3. coordinator 역할 문서의 Procedure는 `coordinate advance` 호출과 반환된 정지 지점 처리의 반복이고, 바뀐 `agents/*.md`마다 `.codex/agents/*.toml`이 생성 결과와 바이트 단위로 같다.
4. `/bouncer-plan`은 서로 독립인 범위·요구·위험 질문을 한 메시지로 묶고, 승인·동의 항목은 따로 묻는다. light 선언은 scaffold 전에, 작성된 계획의 최종 승인은 작성 뒤에 받으며, 선언이 최종 승인을 대신하지 않는다.
5. `bouncer plan inspect`는 light 선택 근거가 되는 기계 신호(task 수·의존, 위험 경로 분류, 접촉 모듈 수)를 낸다. 신호는 추천 근거로만 쓰이고, 선언이 없으면 full이며, 신호가 없다고 light가 선택되지 않는다.
6. plan context review의 후속 라운드는 변경 문서와 관련 근거만 받을 수 있는 조건과 전체 재검토가 필요한 조건(계약·범위·`affected_paths`·DAG 변경, task 추가·삭제)이 CLI와 reference에서 같고, G18 stale 판정은 그대로다.
7. light blueprint는 `/bouncer-run`에서 coordinator 없이 run 세션이 CLI가 배정한 integration worktree에서 단일 task를 직접 구현하고, 독립 reviewer 1세션이 사양·범위, 정확성, 회귀·테스트, 위험 변경 관점을 함께 검토한다. 구현 세션은 자기 결과를 승인하지 않고, 검증·commit 범위·원장·재개 계약은 full과 같은 CLI 작성 주체를 쓴다.
8. light 실행 중 새 보안 위험, 범위 밖 변경, task 분할, 인터페이스 의미 변경, reviewer의 범위 확대 요구가 나오면 CLI가 현재 task·diff·검증·review 상태와 사유를 원장에 남기고 멈춘다. 멈춘 light 상태는 더 이상 변경 명령을 받지 않고, run preflight는 이를 위임 불가로 보고한다.
9. 범위 내 테스트 보완 finding은 기존 task 권한 안에서 수정 → 관련 검증 → 독립 delta review로 닫히고, 제품 동작 수정과 범위·인터페이스 변경은 각각 기존 repair·계획 경계를 따른다. 테스트 파일 변경만으로 보완으로 분류하지 않는다.
10. finalize는 최종 diff 요약, 검증·review 증거 참조, explain에 필요한 항목만 받고 전체 이력을 다시 읽지 않는다. 이해 확인·잔여 처리·PR 동의는 자동 통과되지 않는다.
11. 각 blueprint는 `npm run ci`를 통과하고 `CHANGELOG.md` `[Unreleased]`에 항목을 남긴다.

## Out of scope
- 벤치마크 실험, 기준선, 기대값, 측정 수치와 벤치마크 하네스·환경 검사.
- reviewer 수 축소와 저렴한 모델로의 교체.
- light 실행 중 full로 승격할 때 integration 변경을 full worker 구조로 옮기는 절차. 이번 범위는 상태 보존과 중단까지다.
- full → light 하향 전환.
- 게이트(G/S) 약화, 추가 생략, 검증 증거의 수기 작성.
- light quiz 정책 변경, finalize 사용자 동의의 자동화.
- 088의 `coordinate next`·카드 계약, 083의 wave 세션 분할, 081의 CLI 이전 계약 재설계. 이 에픽은 그 위에 얹는다.

## Blueprints
* [001 coordinator 연쇄 실행과 판단 문맥 제한](blueprints/001-coordinator-auto-advance/index.md) - `coordinate advance`를 추가하고 판단 응답의 문맥을 제한한다 (coordinator CLI, coordinator 역할 문서)
* [002 plan 왕복 축소와 light 선택 신호](blueprints/002-plan-roundtrip-reduction/index.md) - plan 질문·승인 순서, `plan inspect` light 신호, context review 후속 조건을 정리한다 (plan 스킬, plan inspect, review dispatch)
* [003 light run 경로](blueprints/003-light-run-path/index.md) - light를 run 세션 직접 구현과 reviewer 1세션 경로로 바꾸고 위험 신호에서 상태를 보존해 멈춘다 (run 스킬, 실행 규칙, light 원장 상태)
* [004 재작업과 finalize 축소](blueprints/004-rework-finalize-slimming/index.md) - 범위 내 테스트 보완의 delta review 경로와 finalize 입력 축소를 정한다 (재작업 분류, finalize digest)
