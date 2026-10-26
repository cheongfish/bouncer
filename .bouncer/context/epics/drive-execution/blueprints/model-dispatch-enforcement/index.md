---
type: bouncer.blueprint
title: 서브에이전트 모델 설정의 디스패치 반영 보장
description: Enforce configured role models and clarify review recording before revision.
resource: .bouncer/context/epics/drive-execution/blueprints/model-dispatch-enforcement/index.md
tags:
  - bouncer
  - blueprint
  - subagent
  - model
  - dispatch
timestamp: '2026-10-26T14:14:43.304+09:00'
bouncer:
  id: model-dispatch-enforcement
  epic_id: drive-execution
  blueprint_id: model-dispatch-enforcement
  status: approved
  order: 67
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: 역할별 모델 설정의 실제 디스패치 반영과 거절 처리가 수용 기준의 중심이므로 drive-execution에 귀속한다.
  supersedes: []
---
# 서브에이전트 모델 설정의 디스패치 반영 보장

Epic: [drive-execution](../../index.md)

## Intent
역할별 모델 설정이 호출에서 누락되는 문제를 막기 위해 공통 해석 결과와 Claude 호출 훅을 연결함.
모델 거절과 리뷰 기록 순서를 명시하고 완료된 플러그인을 독립 버전으로 갱신함.

## Contract
- 인터페이스:
  - 작업 001: 리뷰가 필요한 plan과 execute discovery·delta 성공 payload는 agent_dispatch: {agent, provider, model}을 제공한다. agent는 bouncer-context-reviewer 또는 bouncer-reviewer, provider와 model은 기존 resolver 값이며 null은 기존 미판별·상속 의미다. skip·실패에는 필드가 없다.
  - 작업 002: Claude PreToolUse Agent 훅은 다섯 Bouncer named 역할만 대상으로 subagent-model 공개 CLI를 호출한다. config와 다른 model 또는 누락 model을 보정하고 변경 사실을 additionalContext로 전달한다. 컨트롤러가 이를 사용자에게 보고한다.
  - 작업 003: 모든 named 역할은 지정 모델 거절 시 호출을 중단한다. provider·역할·설정 모델명·원문 거절 사유·설정 수정 위치를 표시한다. 지원 모델명은 호스트가 검증 가능한 값으로 제공한 경우만 안내하며 임의 별칭이나 대체 모델로 재시도하지 않는다.
  - 작업 003: plan 리뷰의 round 1은 리뷰 완료·병합 후 record 성공을 확인한 다음 문서를 수정한다. stale 기록 거절을 우회하거나 보고의 digest를 바꾸지 않는다.
  - 작업 004: 기능 작업 통합 뒤 plugin 0.1.12로 동기화하고 runtimeCompatibility를 >=0.1.14 <0.2.0으로 맞춘다. runtime 목표는 이미 준비된 0.1.14다.
- 데이터·상태:
  - 기존 subagents.<provider>.<agent> 슬롯과 subagent-model의 한 줄 stdout을 재사용한다. 프로필·추가 중개 LLM·새 config 필드는 없다.
  - agent_dispatch는 호출을 준비하는 설정값이며 실제 호스트 모델을 증명하지 않는다. 문서 target.digest·parts·follow_up 입력에는 넣지 않는다. 이전 payload의 필드 부재는 계속 허용한다.
  - hook은 문서·config·원장에 쓰지 않는다. 수정된 tool_input은 model 외 입력을 그대로 보존하고 allow 권한 결정을 추가하지 않는다.
- 수용 기준:
  1. Epic 성공 기준 9: 새 metadata가 provider별 슬롯·상속과 일치하며 legacy payload 및 snapshot digest가 보존된다.
  2. Epic 성공 기준 10: Claude 훅의 누락·불일치 보정, 전체 입력 보존, 한국어 알림과 관련 호출 실패 차단이 회귀 검사된다.
  3. Epic 성공 기준 11: 모델 거절 중단과 설정 모델명 안내가 공통 지침·plan·run에서 일치하고 record 성공 전 수정 지시가 없다.
  4. Epic 성공 기준 12: plugin manifest/marketplace의 버전과 호환 범위가 일치하고 runtime 0.1.14를 보존한다.
  5. Epic 성공 기준 13: 각 구현은 전용 검증을 실행하고 TASKS-005가 모든 구현 뒤 npm run ci를 실행한다. 생성 dist는 직접 추적하지 않고 한국어 브리프·커밋 규약을 지킨다.
- 검증 명령: 사용자가 확인한 각 task의 전용 명령을 frontmatter에 기록했다. TASKS-005의 npm run ci가 전체 구현 뒤 종단 검증을 수행한다.
- 실패 모드·엣지 케이스:
  - 모델 슬롯 부재·inherit·비문자열은 기존 resolver의 상속 해석을 유지하고 훅은 명시 model을 제거한다. 명시 slug의 호스트 거절은 상속 재시도를 허용하지 않는다.
  - 이미 일치한 모델은 보정하지 않는다. CLI 출력 잡음·빈 값·다중 줄·실행 실패·timeout은 관련 Claude 호출을 차단한다. 비대상 도구와 에이전트는 훅을 통과한다.
  - config가 metadata 생성 후 바뀌면 호출 직전에 다시 해석하고 변경을 알린다. 오래된 metadata를 실제 실행 증적으로 간주하지 않는다.
  - 잘못된 previous·stale 문서·restart 한도·명시적 승인 요구는 현행 CLI 계약을 유지한다.

## Out of scope
- 모델 프로필 설정 계층, 중개 LLM, 실제 실행 모델 추적·비용 집계 변경.
- Codex·Cursor·Antigravity 전용 호출 훅 신설, 역할 본문 및 생성 TOML 변경.
- context-review snapshot 검증 완화, restart 한도 변경, 기존 closed 계획 재개.
- 원격 게시·태그·push·npm 설치·플러그인 설치 캐시 갱신.
- 로컬 요구사항·제안 문서와 config 예제 주석의 일괄 수정.

## One-commit justification
한 PR에서 모델 설정부터 호출과 사용자 보고까지의 계약을 검토한다. metadata·Claude 훅·워크플로 지침·배포 버전은 각각 독립된 커밋으로 나누며 마지막 verification node는 source를 변경하지 않는다.

## Task DAG
TASKS-001 → TASKS-002 → TASKS-003 → TASKS-004 → TASKS-005.
TASKS-003은 TASKS-001에도 직접 의존한다. TASKS-004는 세 구현 task에 의존하며 TASKS-005는 네 commit task 모두에 의존한다. 모든 task는 parallel_safe:false, dependency_gate:integrated다.

## Documents
- [작업 001](tasks/001/tasks.md): 리뷰 디스패치 모델 메타데이터.
- [작업 002](tasks/002/tasks.md): Claude 호출 훅.
- [작업 003](tasks/003/tasks.md): 공통 모델·리뷰 순서 지침.
- [작업 004](tasks/004/tasks.md): plugin 버전과 호환 범위.
- [작업 005](tasks/005/tasks.md): 전체 구현 뒤 종단 검증.
- [계획 리뷰](context-review.md), [최종 리뷰](review.md).
