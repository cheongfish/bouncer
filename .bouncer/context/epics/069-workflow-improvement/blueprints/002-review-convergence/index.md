---
type: bouncer.blueprint
title: 병렬 리뷰와 delta 인증 기반 리뷰 수렴
description: Execute and plan reviews run parallel perspective discovery on a frozen target, apply one fix batch, and certify only the delta.
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/002-review-convergence/index.md
tags:
  - bouncer
  - blueprint
  - review
  - fingerprint
  - coordinator
timestamp: '2026-09-11T10:25:27.588+09:00'
bouncer:
  id: '002'
  epic_id: '069'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 002 review-convergence

Epic: [069](../../index.md)

## Intent
- 문제: 실행 리뷰는 회차마다 전체 변경분을 다시 판단해 고치지 않은 코드에서도 새 지적을 더하므로, 회차 상한이 무한 실행은 막아도 리뷰를 수렴시키지 못한다.
- 완료 조건: 리뷰는 고정 대상의 관점별 병렬 발견, 한 번의 수정 묶음, 수정분 인증으로 끝나고, 게이트는 지적 정체성·회차 순서·수정분 신규 지적·남은 필수 수정을, 코디네이터 원장은 치명 결함 복구 한도를 강제한다.

## Contract
- 인터페이스:
  - Execute review finding 필드: `category`, `brief_clause`, `file`, `symbol`, `fingerprint`, `actionability`(`must_fix | advisory`), `origin`(`discovery | introduced_by_revision | missed_critical`), `first_seen_round`, `last_seen_round`.
  - Execute review round 필드: `mode`(`discovery | delta | critical_recovery`), `target`(`base`, `head`, `brief_revision`, `verify`), `perspectives: [{ name, target_head }]`(name은 `spec_scope | correctness_tests | minimality_maintainability | security`), `severity_changes`.
  - Round mode 순서: `discovery`, `discovery → delta`, `discovery → delta → critical_recovery → delta`.
  - Fingerprint 정규형: `<category>:<brief_clause>:<file>#<symbol>`. 앞뒤 공백을 지우고 `category`·`brief_clause`는 소문자로, `file`은 POSIX 상대 경로로 정규화한다. Plan context review는 `context:` 접두를 붙인다.
  - Delta 신규 finding 허용: `introduced_by_revision`은 심각도와 무관하게, `missed_critical`은 `blocker`·`major`만 허용한다. 변경하지 않은 코드의 새 `minor`·`nit`는 채택하지 않는다.
  - Reviewer 호출 모드: `discovery`는 관점 하나의 판단 범위만, `delta`는 이전 finding의 해결 여부와 revision diff의 regression만 판단한다.
  - `bouncer coordinate critical-recovery --blueprint <dir> --task <ddd> (--findings <id>... --reason <text> | --outcome <resolved|blocked> --reason <text>)` — task당 시작 한 번과 결과 한 번만 기록한다.
  - Plan context review 관점: `cross_document | scope | korean_quality | success_criteria`, round target은 계획 문서 본문 digest.
- 데이터·상태: 새 필드는 `rounds[]`에 `mode`가 없으면 선택이고, 그런 기존 review 문서는 현재 G14·G18 판정을 그대로 받는다. `mode`가 있으면 finding·round 필드가 필수가 된다. Review target의 실제 Git 일치는 controller가 증언하고 gate는 기록 값의 상호 일치만 검사한다. Coordinator ledger task 항목에 `criticalRecovery`를 추가한다.
- 수용 기준: epic 성공 조건 4, 5, 6, 7, 11.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 같은 fingerprint에 다른 severity가 들어오면 새 finding을 만들지 않고 `severity_changes`에 이전·다음 severity와 근거를 남긴다.
  - Controller는 현재 task 정확성에 영향을 주는 finding을 `advisory`로 낮출 수 없다. `must_fix`가 `resolved` 외 상태로 남은 accepted review는 gate가 거부한다.
  - Revision이 만든 `minor`·`nit`는 delta에서 기록할 수 있다. 추가 fix round가 없으므로 controller는 advisory로 기록하거나, 정확성에 영향이 있으면 must_fix로 두고 blocked로 반환한다.
  - Critical recovery 뒤에도 같은 finding이 남거나 새 `blocker`·`major`가 생기면 추가 dispatch 없이 blocked로 반환한다.
  - Standalone execute에는 start-drive 승인이 없으므로 critical recovery를 자동 실행하지 않는다. 열린 finding을 사용자에게 보고하고 `/bouncer-plan`으로 안내한다.
  - 새 설계, dependency, public Interface, 제품 의미를 바꾸는 scope 확대가 필요한 finding은 자동 recovery 대상이 아니다.

## Out of scope
- Finding 통계와 dispatch 수 계측.
- Reviewer 관점을 늘리는 설정 키. 관점 목록은 이 계약의 enum으로 고정한다.
- 진입 스킬 본문 구조 재편. BP001이 끝낸 reference 배치 위에서 review 절차만 바꾼다.
- Debugger 복구 1회 상한과 terminal CI repair wave 두 번 상한.
- Context review의 `deferred` status.

## One-commit justification
- TASKS-001이 review 문서 계약과 gate를, TASKS-002가 reviewer 계약을, TASKS-003이 execute·run 전이를, TASKS-004가 coordinator recovery 한도를, TASKS-005가 plan context review를 각각 한 커밋으로 닫는다. 다섯 커밋이 합쳐 리뷰 수렴 모델 한 PR이 된다.

## Documents
* [Task 001](tasks/001/tasks.md) - 리뷰 finding 정체성과 수렴 게이트 검사
* [Task 002](tasks/002/tasks.md) - 리뷰어 관점별 탐색과 변경분 인증 계약
* [Task 003](tasks/003/tasks.md) - execute 리뷰 상태 전이
* [Task 004](tasks/004/tasks.md) - 코디네이터 치명 결함 복구 한도
* [Task 005](tasks/005/tasks.md) - 계획 문서 리뷰 병렬 판단과 변경분 인증
* [Context review](context-review.md) - 계획 문서 정합성 판정
