---
type: bouncer.blueprint
title: 실행 조정과 증적 및 리뷰 전이 책임 분해
description: Split execution preparation and fan-in, digest assembly, verification responsibilities and review transitions while preserving behavior.
resource: .bouncer/context/epics/runtime-architecture/blueprints/workflow-responsibility-split/index.md
tags:
  - bouncer
  - blueprint
  - architecture
  - coordinator
  - verification
  - context-review
  - digest
timestamp: '2026-10-21T16:48:38.084+09:00'
bouncer:
  id: workflow-responsibility-split
  epic_id: runtime-architecture
  blueprint_id: workflow-responsibility-split
  status: closed
  order: 40
  commit_type: refactor
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 실행 조정·digest·검증·리뷰 전이의 동작 보존 책임 분해는 runtime-architecture의 모듈 경계 범위임
  supersedes: []
---
# 실행 조정과 증적 및 리뷰 전이 책임 분해

Epic: [runtime-architecture](../../index.md)

## Intent
- 실행 조정·digest·검증·리뷰 전이에 남은 책임 집중을 나누어 한 변경이 읽고 고쳐야 하는 구현 범위를 줄임.
- 기존 CLI·공개 API·증적·오류와 동시성 계약을 보존하고 의존성 경계 검사와 재현 가능한 전후 측정으로 결과를 확인함.

## Contract
- 인터페이스: `coordinator` facade의 명령 API 3개, `verification`의 기존 export, `finalize-digest`의 기존 export 3개, `context-review-state`의 기존 export를 유지한다. 새 모듈은 기능 내부이며 다른 기능 소비자의 새 공개 경계로 승격하지 않는다.
- 데이터·상태: CLI JSON·exit code·오류 code/reason·원장 bytes·lease/checkpoint·verification v2·digest v2·review state version 1·closure digest 형식과 key 부재/null 의미를 보존한다. 읽기 검증과 TypeScript 정본 타입은 별개로 유지한다.
- 실행 조정: 준비와 fan-in을 분리하고 공통 원장 열기·재확인·checkpoint는 ledger, worker 증적과 blueprint 정책 조회는 worker 정본을 쓴다. prepare·fanin은 commands/facade를 runtime import하지 않는다.
- Digest: 수집 모듈이 원장·문서·등록부·Git 관찰을 소유한다. model은 주어진 값만 검사·조립하며 fs·process·포인터를 조회하지 않는다. 기존 PR 작성 모듈을 재사용한다.
- Verification: execution·identity·evidence를 분리하고 기존 `verification-target`을 유지한다. 공유 계약은 leaf이며 하위 모듈이 verification facade/target을 역참조하지 않는다.
- Context review: 기존 store 위에서 finding·처분·restart 판단과 문서 투영을 순수 모듈로 나눈다. store/state의 타입 사본은 type-only 정본으로 합친다. state가 현재 lock·읽기·쓰기 순서를 조정한다.
- 수용 기준: Epic 10은 TASKS-001·002, 11은 TASKS-003, 12는 TASKS-004, 13은 TASKS-005, 14는 TASKS-006과 종단 verification이 맡는다. Epic 7·8의 전체 CI·순환·생성본 계약은 모든 task에 적용한다.
- 검증 구성: 사용자 `plan.verify_command` 확인에 따라 구현 task별 전용 테스트와 모든 구현 task 뒤 종단 `npm run ci`를 설정한다. 명령은 아래 표 및 각 task frontmatter가 정한다.
- 실패 모드·엣지 케이스:
  - 원장 부재·lease 모양·명령별 validation·fence 검사 순서를 바꾸지 않는다. seed/runner 동안 잠금을 잡지 않고 재잠금 뒤 hash와 HEAD를 다시 확인한다.
  - fan-in verified/base/서로 다른 HEAD 복구 상태를 구분한다. 실패 candidate·worker 증적 복사·새 worktree 정리와 기존 worker 변경 보존을 유지한다.
  - dependency 준비·runner·CAS 실패가 성공 증거나 integrated 상태를 만들지 않는다. scoped_terminal 구현 wave의 전체 검증 생략과 terminal 책임을 유지한다.
  - Digest의 repoRoot pointer와 integration checkoutRoot를 구분한다. unreadable ledger·task 부재·no-base·Intent S33 거절 우선순위를 유지한다.
  - Verification은 원장 부재/손상을 miss로, identity/target/dependency 오류를 기존 throw로 처리한다. reuse 시 now/exec를 생략하고 기록 뒤 task 승격한다.
  - 리뷰의 열린 must_fix·accepted-risk 명시 동의·restart 누적 1회·stale digest 거절을 유지한다. state 쓰기 뒤 문서 실패는 동일 입력의 noop 재투영으로 복구한다.
  - 측정 실패나 환경 불일치는 추정 수치로 대체하지 않는다. 함수 연결 수를 순환 복잡도나 실행 비용으로 해석하지 않는다.

## Task DAG
| Task | 책임 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| TASKS-001 | 공유 실행 helper·타입 정리와 prepare/bootstrap 분리 | [] | true | integrated | commit |
| TASKS-002 | full/light fan-in·복구 분리 | [TASKS-001] | true | integrated | commit |
| TASKS-003 | digest 수집·검사·조립 분리 | [] | true | integrated | commit |
| TASKS-004 | verification 실행·identity·evidence 분리 | [] | true | integrated | commit |
| TASKS-005 | review 순수 전이·투영·타입 정본 | [] | true | integrated | commit |
| TASKS-006 | 경계 검사·영역 목록·전후 측정 | [TASKS-002, TASKS-003, TASKS-004, TASKS-005] | false | integrated | commit |
| TASKS-007 | 통합 후 전체 CI | [TASKS-006] | false | integrated | verification |

TASKS-001·002는 commands와 coordinator 회귀 테스트를 공유하므로 순차 실행한다. TASKS-003·004·005는 각자의 source/test만 변경한다. 공통 FEATURE_AREAS·테스트 계층 목록은 fan-in 뒤 TASKS-006이 한 번 갱신한다. TASKS-007은 TASKS-006을 통해 모든 commit task에 전이적으로 의존한다.

## 검증 명령
| Task | 전용 명령 |
| --- | --- |
| TASKS-001 | `node --test test/coordinator.test.js` |
| TASKS-002 | `node --test test/coordinator.test.js test/coordinator-e2e.test.js` |
| TASKS-003 | `node --test test/finalize-digest.test.js test/finalize-pr.test.js` |
| TASKS-004 | `node --test test/verification-runner.test.js test/cli-verify.test.js` |
| TASKS-005 | `node --test test/context-review-state.test.js` |
| TASKS-006 | `node --test test/workflow-responsibility-boundaries.test.js test/dependency-boundaries.test.js test/cli-project-commands.test.js test/cli-help-static.test.js` |
| TASKS-007 | `npm run ci` |

## 측정 기준
- 기준 HEAD는 `225a6a75bf755422732c0a0da9c97fada1179e45`다. source graph는 이 HEAD의 2,322 nodes·5,703 links이며 plan 진입 graph-sync는 source `skip-fresh`, test `skip-unconfigured`였다. graph는 후보 탐색용이며 완료 판정은 source/test/게이트가 맡는다.
- 전후 snapshot은 같은 Node 24 실행 파일·npm·OS·탐색 suite 정의로 생성한다. 후는 TASKS-001~005가 integrated된 TASKS-006 시작 HEAD다. 기존 source-boundaries와 과거 측정 JSON은 보존한다.
- 새 inventory는 책임별 module 배치·보존 실패 모드·정적 규모·coverage·실행 시간을 담고 `check-report`로 원본 대조한다. 실행 시간 감소를 수용 조건으로 가정하지 않는다.

## Out of scope
- CLI·공개 export의 계약 변경, ledger/evidence/digest/review state의 직렬화 변경, 새로운 reason·G/S 코드·승인 흐름.
- 기존 `coordinator-command-split`·`gate-review-split` 재실행 및 legacy blueprint·증적의 소급 상태 수정.
- 이미 분리된 verification 기본 대상 선택과 review 저장 계층의 재설계.
- Graphify 설치/버전·설정, 측정 도구 수정, 신규 dependency·범용 DI·디렉터리 일괄 이동.
- `symbol-index`와 다른 인접 모듈 분해, 기존 커버리지 임계값 하향, 생성본 직접 수정·추적.

## One-commit justification
- 각 commit task는 한 책임 경계를 이동하는 검토 가능한 단위다. 준비/helper 선행 결과 위에서 fan-in을 분리하고 나머지 세 영역은 독립적으로 분해한다. 경계 검사와 측정이 네 영역의 통합 결과를 확인하므로 한 blueprint의 리뷰·PR 단위로 묶고 마지막 verification node가 전체 CI를 판정한다.

## Documents
- [TASKS-001](tasks/001/tasks.md) — 준비·bootstrap과 실행 공유 helper.
- [TASKS-002](tasks/002/tasks.md) — commit fan-in과 복구.
- [TASKS-003](tasks/003/tasks.md) — digest 수집·조립.
- [TASKS-004](tasks/004/tasks.md) — verification 실행·identity·증적.
- [TASKS-005](tasks/005/tasks.md) — review 순수 전이·투영.
- [TASKS-006](tasks/006/tasks.md) — 경계 검사·영역 목록·실측.
- [TASKS-007](tasks/007/tasks.md) — 통합 전체 CI.
- [Context review](context-review.md), [Review](review.md).
