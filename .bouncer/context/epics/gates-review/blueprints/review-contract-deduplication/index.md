---
type: bouncer.blueprint
title: 리뷰 계약 판정의 중복 제거
description: Consolidate review policy predicates and schema constants while preserving observable review behavior.
resource: .bouncer/context/epics/gates-review/blueprints/review-contract-deduplication/index.md
tags:
  - bouncer
  - blueprint
  - gates-review
  - drive-followups
timestamp: '2026-10-23T08:26:23.366+09:00'
bouncer:
  id: review-contract-deduplication
  epic_id: gates-review
  blueprint_id: review-contract-deduplication
  status: closed
  order: 19
  commit_type: refactor
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
  attribution: 수용 기준이 gates-review의 리뷰 계약 판정의 중복 제거에 집중하므로 해당 domain epic에 귀속함
---
# 리뷰 계약 판정의 중복 제거

Epic: [gates-review](../../index.md)

## Intent
- drive에서 드러난 R-A3·R-A4·R-A5·R-A6·R-A9·R-A10·R-A11의 계약 공백을 닫아 같은 실패와 수작업 반복을 줄이려 함.
- 리뷰 계약 판정의 중복 제거를 구현 task별 수용 기준과 종단 검증으로 확인함.

## Contract

### 인터페이스·데이터·상태
- repair 사용 판정과 review round 판독을 공유하되 호출자별 기존 오류 정책을 명시적으로 유지한다.
- review-contract-invalid는 분류기를 import하지 않는 schema 계층에서 공유한다. 기존 CLI 거절 문자열·exit code·lazy loading을 보존한다.
- plan은 index를 한 번 읽어 표식과 scale을 사용하고, execute는 선택된 legacy/brief 전략만 계산한다. 외부 반환 객체를 바꾸지 않는다.
- plan 관점 이름과 delta 관점은 schema를 정본으로 쓰고, 검증된 scale을 전달하여 관점 개수로 크기를 추론하지 않는다.

### 수용 기준
1. TASKS-001이 R-A3·R-A4·R-A6를 담당하며 epic 성공 기준 20를 만족한다.
2. TASKS-002이 R-A5·R-A10를 담당하며 epic 성공 기준 21를 만족한다.
3. TASKS-003이 R-A9·R-A11를 담당하며 epic 성공 기준 22를 만족한다.
4. epic 성공 기준 23에 따라 각 구현 task는 전용 검증, 종단 TASKS-004은 전체 CI를 수행한다. 검증 명령은 사용자 확인을 받아 task frontmatter에 설정한다.

### 실패 모드·엣지 케이스
- ENOENT·YAML 오류·권한 오류에서 repair는 strict, next는 기존 tolerant 처리를 유지한다.
- 표식 없는 legacy previous·dispatch 응답과 light execute 정책을 유지한다. 호환성 복구 blueprint 병합 뒤 baseline에서 검증한다.

## 근거와 중복 처리
- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`. 현재 checkout이 근거이며 과거 Explain은 현행 코드보다 우선하지 않는다.
- Graphify source는 계획 진입 시 skip-fresh로 재사용했고 test 그래프는 skip-unconfigured다. 그래프 근거는 advisory이며 승인 범위를 정하지 않는다.
- 기존 `final-review-brief-compliance`·`plan-review-perspectives`는 병합·closed 상태다. 새 계획은 그 위의 후속 변경이다.

## 실행 DAG

| Task | 요구사항 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| [TASKS-001](tasks/001/tasks.md) | R-A3·R-A4·R-A6 | [] | true | integrated | commit |
| [TASKS-002](tasks/002/tasks.md) | R-A5·R-A10 | [TASKS-001](tasks/001/tasks.md) | true | integrated | commit |
| [TASKS-003](tasks/003/tasks.md) | R-A9·R-A11 | [TASKS-001](tasks/001/tasks.md) | true | integrated | commit |
| [TASKS-004](tasks/004/tasks.md) | 전체 CI | TASKS-001, TASKS-002, TASKS-003 | false | integrated | verification |

- 호환성 복구 blueprint를 먼저 병합한 뒤 시작한다. 동일 모듈과 오류 응답을 다루므로 두 blueprint를 병렬 실행하지 않는다.
- 종단 task는 사용자 확인을 받은 전체 CI 명령으로 scaffold한다. 구현 task의 변경 경로는 사용자 확인을 받은 각 task의 affected_paths가 정본이다.

## 전용 검증 명령 제안

사용자 확인을 받은 명령이며 task frontmatter에 동일하게 설정한다.

| Task | 제안 명령 |
| --- | --- |
| TASKS-001 | `node --test test/review-policy.test.js test/coordinator.test.js test/coordinate-next.test.js test/review-dispatch.test.js` |
| TASKS-002 | `node --test test/review-dispatch.test.js` |
| TASKS-003 | `node --test test/context-review-state.test.js test/schema.test.js` |
| TASKS-004 | `npm run ci` |

## Out of scope
- 리뷰 라운드 수 변경
- 새 reviewer 관점 추가
- 리뷰 상태나 저장 payload 마이그레이션
- 요구사항 원문은 untracked 상태를 유지하며 커밋에 포함하지 않는다.

## One-commit justification
- 각 구현 task는 표의 한 책임만 한 커밋으로 다룬다. 서로 다른 계약은 분리하고 모든 구현 뒤 종단 검증 한 개로 묶는다.

## 요구사항 추적

| 요구사항 | 담당 | 완료 판정 |
| --- | --- | --- |
| R-A3 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A4 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A5 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A6 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A9 | [TASKS-003](tasks/003/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A10 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A11 | [TASKS-003](tasks/003/tasks.md) | 해당 task Target behavior와 Checklist |

## 변경 경로 후보와 조사 근거

아래 목록은 조사 근거다. 사용자 확인을 받은 Touch 파일 목록을 각 task의 affected_paths에 기록했다.

| graph | status | query | result |
| --- | --- | --- | --- |
| source | reused | explain classifyExecuteReview; explain loadDispatch; explain checkRoundPerspectives; explain finalReviewGate | 최신 그래프의 관련 source 경로를 실제 코드·호출자 rg로 확인 |
| test | skip-disabled | graphify.test_dirs 미설정으로 질의 생략 | 테스트 후보는 rg 검색 및 실제 파일 근거 사용 |

### TASKS-001 — 리뷰 수정 상태 판독과 거절 상수 통합

- `scripts/src/lib/review-repair-state.ts` — grep -l review-repair-state.ts (001 Touch의 명시적 신규 경로)
- `scripts/src/lib/coordinator-repair.ts` — grep -l final-review-single-round
- `scripts/src/lib/coordinate-next.ts` — grep -l review_contract
- `scripts/src/lib/schema.ts` — grep -l review_contract
- `scripts/src/lib/review-dispatch.ts` — grep -l review_contract
- `scripts/src/lib/cli-review-dispatch-command.ts` — grep -l review_contract
- `test/review-policy.test.js` — grep -l TASKS
- `test/coordinator.test.js` — grep -l review_contract
- `test/coordinate-next.test.js` — grep -l review_contract
- `test/review-dispatch.test.js` — grep -l review_contract
- `scripts/src/lib/review-record.ts` — grep -l review_contract
- `scripts/src/lib/validate-gates-finalize.ts` — grep -l review_contract

### TASKS-002 — 리뷰 분류의 단일 읽기와 계약별 계산 분리

- `scripts/src/lib/review-dispatch.ts` — grep -l review_contract
- `test/review-dispatch.test.js` — grep -l review_contract

### TASKS-003 — 계획 리뷰 관점과 delta 기준의 정본 통합

- `scripts/src/lib/schema.ts` — grep -l review_contract
- `scripts/src/lib/context-review-store.ts` — grep -l review_contract
- `scripts/src/lib/context-review-state.ts` — grep -l perspectives
- `test/context-review-state.test.js` — grep -l review_contract
- `test/schema.test.js` — grep -l review_contract
- `CHANGELOG.md`는 Graphify 후보가 아닌 프로젝트 Unreleased 기록 의무로 Touch에 포함한다.


## 최소 변경 검토
- 새 의존성이나 일반화 계층을 추가하지 않는다. 기존 fs·crypto·git과 js-yaml을 재사용한다.
- 신규 파일 `scripts/src/lib/review-repair-state.ts`은 기존 순수 모듈 경계나 독립 판정 책임을 보존하기 위한 최소 분리이며 각 task Touch가 생성 근거를 소유한다.
- 기존 테스트를 실행하는 것만으로 해당 파일을 변경 경로에 추가하지 않는다. 역할 Markdown의 추적된 TOML만 생성본 수정 범위에 포함한다.
