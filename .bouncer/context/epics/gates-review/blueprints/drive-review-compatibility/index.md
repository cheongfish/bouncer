---
type: bouncer.blueprint
title: 리뷰 거절 응답 호환성과 설명 계약 복구
description: Restore legacy review refusals and align documented rejection contracts with runtime behavior.
resource: .bouncer/context/epics/gates-review/blueprints/drive-review-compatibility/index.md
tags:
  - bouncer
  - blueprint
  - gates-review
  - drive-followups
timestamp: '2026-10-23T08:26:23.032+09:00'
bouncer:
  id: drive-review-compatibility
  epic_id: gates-review
  blueprint_id: drive-review-compatibility
  status: closed
  order: 18
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
  attribution: 수용 기준이 gates-review의 리뷰 거절 응답 호환성과 설명 계약 복구에 집중하므로 해당 domain epic에 귀속함
---
# 리뷰 거절 응답 호환성과 설명 계약 복구

Epic: [gates-review](../../index.md)

## Intent
- drive에서 드러난 R-M1·R-M3·R-A1·R-A2·R-A7·R-A8의 계약 공백을 닫아 같은 실패와 수작업 반복을 줄이려 함.
- 리뷰 거절 응답 호환성과 설명 계약 복구를 구현 task별 수용 기준과 종단 검증으로 확인함.

## Contract

### 인터페이스·데이터·상태
- 표식 없는 plan previous 오류는 기존 reason·cause·next를 정확히 보존한다. 표식 있는 previous는 perspectives를 계속 지원한다.
- 표식 없는 perspectives dispatch는 과거 cause로 거절하고, full/light의 정규 dispatch 관점 배열은 순서까지 일치해야 한다.
- 최종 리뷰의 legacy·brief 보안 조건과 accepted 조건을 구분한다. 첫 repair의 새 경로는 final-review-repair-scope, 이미 repair 또는 delta를 쓴 경우는 final-review-single-round다.
- rules/cli.md의 거절 코드 표는 코드가 export하는 식별자와 lint:docs에서 대조한다. 자연어 전체를 정규식으로 고정하지 않는다.

### 수용 기준
1. TASKS-001이 R-M3·R-A7·R-A8를 담당하며 epic 성공 기준 18를 만족한다.
2. TASKS-002이 R-M1·R-A1·R-A2를 담당하며 epic 성공 기준 19를 만족한다.
3. epic 성공 기준 23에 따라 각 구현 task는 전용 검증, 종단 TASKS-003은 전체 CI를 수행한다. 검증 명령은 사용자 확인을 받아 task frontmatter에 설정한다.

### 실패 모드·엣지 케이스
- 잘못된 JSON·다른 blueprint·닫힌 blueprint의 기존 오류 우선순위를 보존한다.
- 비정규 perspectives의 순서 변경·중복·누락·추가를 거절하고 cycle·원장·문서 bytes를 바꾸지 않는다.

## 근거와 중복 처리
- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`. 현재 checkout이 근거이며 과거 Explain은 현행 코드보다 우선하지 않는다.
- Graphify source는 계획 진입 시 skip-fresh로 재사용했고 test 그래프는 skip-unconfigured다. 그래프 근거는 advisory이며 승인 범위를 정하지 않는다.
- 기존 `final-review-brief-compliance`·`plan-review-perspectives`는 병합·closed 상태다. 새 계획은 그 위의 후속 변경이다.

## 실행 DAG

| Task | 요구사항 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| [TASKS-001](tasks/001/tasks.md) | R-M3·R-A7·R-A8 | [] | true | integrated | commit |
| [TASKS-002](tasks/002/tasks.md) | R-M1·R-A1·R-A2 | [] | true | integrated | commit |
| [TASKS-003](tasks/003/tasks.md) | 전체 CI | TASKS-001, TASKS-002 | false | integrated | verification |

- 다른 blueprint와 공유하는 문서는 PR 병합 후 최신 checkout에서 근거를 다시 확인한다. task DAG는 이 blueprint 내부 순서만 표현한다.
- 종단 task는 사용자 확인을 받은 전체 CI 명령으로 scaffold한다. 구현 task의 변경 경로는 사용자 확인을 받은 각 task의 affected_paths가 정본이다.

## 전용 검증 명령 제안

사용자 확인을 받은 명령이며 task frontmatter에 동일하게 설정한다.

| Task | 제안 명령 |
| --- | --- |
| TASKS-001 | `node --test test/review-dispatch.test.js test/context-review-state.test.js` |
| TASKS-002 | `node --test test/doc-shape-cli.test.js` |
| TASKS-003 | `npm run ci` |

## Out of scope
- repair 횟수 및 승인 범위 확대
- execute light 계약 변경
- 기존 승인 문서·과거 Explain 재작성
- 요구사항 원문은 untracked 상태를 유지하며 커밋에 포함하지 않는다.

## One-commit justification
- 각 구현 task는 표의 한 책임만 한 커밋으로 다룬다. 서로 다른 계약은 분리하고 모든 구현 뒤 종단 검증 한 개로 묶는다.

## 요구사항 추적

| 요구사항 | 담당 | 완료 판정 |
| --- | --- | --- |
| R-M1 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-M3 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A1 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A2 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A7 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-A8 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |

## 변경 경로 후보와 조사 근거

아래 목록은 조사 근거다. 사용자 확인을 받은 Touch 파일 목록을 각 task의 affected_paths에 기록했다.

| graph | status | query | result |
| --- | --- | --- | --- |
| source | reused | explain loadDispatch; explain finalReviewGate | 최신 그래프의 관련 source 경로를 실제 코드·호출자 rg로 확인 |
| test | skip-disabled | graphify.test_dirs 미설정으로 질의 생략 | 테스트 후보는 rg 검색 및 실제 파일 근거 사용 |

### TASKS-001 — 구형 계획 리뷰 거절 응답 복구

- `scripts/src/lib/review-dispatch.ts` — grep -l review_contract
- `scripts/src/lib/context-review-store.ts` — grep -l review_contract
- `test/review-dispatch.test.js` — grep -l review_contract
- `test/context-review-state.test.js` — grep -l review_contract

### TASKS-002 — 최종 리뷰 거절 코드 문서 검사 추가

- `rules/cli.md` — grep -l review_contract
- `references/coordinator-cards/final_review.md` — grep -l review_contract
- `scripts/src/lib/coordinator-repair.ts` — grep -l final-review-single-round
- `scripts/check-doc-shape.js` — grep -l context-review
- `test/doc-shape-cli.test.js` — grep -l report
- `CHANGELOG.md`는 Graphify 후보가 아닌 프로젝트 Unreleased 기록 의무로 Touch에 포함한다.


## 최소 변경 검토
- 새 의존성이나 일반화 계층을 추가하지 않는다. 기존 fs·crypto·git과 js-yaml을 재사용한다.
- 기존 파일만 수정하며 새 모듈이나 파일을 만들지 않는다.
- 기존 테스트를 실행하는 것만으로 해당 파일을 변경 경로에 추가하지 않는다. 역할 Markdown의 추적된 TOML만 생성본 수정 범위에 포함한다.
