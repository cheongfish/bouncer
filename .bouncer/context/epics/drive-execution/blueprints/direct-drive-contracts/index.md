---
type: bouncer.blueprint
title: 직접 실행과 구현 입력 전달 절차 명확화
description: Specify direct drive judgments, file payload delivery, handoff ordering and intent bundle reuse.
resource: .bouncer/context/epics/drive-execution/blueprints/direct-drive-contracts/index.md
tags:
  - bouncer
  - blueprint
  - drive-execution
  - drive-followups
timestamp: '2026-10-23T08:26:24.297+09:00'
bouncer:
  id: direct-drive-contracts
  epic_id: drive-execution
  blueprint_id: direct-drive-contracts
  status: closed
  order: 64
  commit_type: docs
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
  attribution: 수용 기준이 drive-execution의 직접 실행과 구현 입력 전달 절차 명확화에 집중하므로 해당 domain epic에 귀속함
---
# 직접 실행과 구현 입력 전달 절차 명확화

Epic: [drive-execution](../../index.md)

## Intent
- drive에서 드러난 R-D1·R-D2·R-D3·R-D4·R-C1·R-C2·R-C3의 계약 공백을 닫아 같은 실패와 수작업 반복을 줄이려 함.
- 직접 실행과 구현 입력 전달 절차 명확화를 구현 task별 수용 기준과 종단 검증으로 확인함.

## Contract

### 인터페이스·데이터·상태
- D1은 기존 task 범위 advance 안내로 충족한다. 이를 유지하면서 accepted 판정·report/record 보충 인자·cwd·fresh fence의 관계를 예시로 명시한다.
- handoff는 root-direct metrics end → session-open → coordinator metrics start → status --write-input → dispatch 순서다. 각 변경 뒤 최신 checkpoint를 사용한다.
- 파일 payload는 원문 UTF-8 bytes와 SHA-256 및 읽을 cwd를 전달한다. implementer는 해시를 확인하고 전체를 읽은 뒤 작업하며 named/fallback의 입력 의미는 동일하다.
- C1은 기존 note 구현·fence·checkpoint로 충족한다. bundle은 최초 호출 후 재선택을 최대 1회만 하고, 여전히 ambiguous면 no-symbols로 진행한다.
- bundle 재사용은 brief hash와 함수 집합·좌표·blob·Explain hash가 모두 유효할 때만 가능하다. miss는 유효 이전 revision+1, 이전 기록 없음은 1이다.

### 수용 기준
1. TASKS-001이 R-D1·R-D2·R-D4를 담당하며 epic 성공 기준 3를 만족한다.
2. TASKS-002이 R-D3를 담당하며 epic 성공 기준 4를 만족한다.
3. TASKS-003이 R-C1·R-C2·R-C3를 담당하며 epic 성공 기준 5를 만족한다.
4. epic 성공 기준 8에 따라 각 구현 task는 전용 검증, 종단 TASKS-004은 전체 CI를 수행한다. 검증 명령은 사용자 확인을 받아 task frontmatter에 설정한다.

### 실패 모드·엣지 케이스
- stale Brief revision·scope 밖 변경·verify 미통과는 accepted로 기록하지 않는다.
- 파일 누락·hash 불일치·다른 task 입력은 읽기 전 거절하고 작업하지 않는다.
- handoff 중 실패는 그 단계에서 멈추며 상태를 보존한다. direct 모드로 되돌아가지 않는다.

## 근거와 중복 처리
- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`. 현재 checkout이 근거이며 과거 Explain은 현행 코드보다 우선하지 않는다.
- Graphify source는 계획 진입 시 skip-fresh로 재사용했고 test 그래프는 skip-unconfigured다. 그래프 근거는 advisory이며 승인 범위를 정하지 않는다.
- 기존 `final-review-brief-compliance`·`plan-review-perspectives`는 병합·closed 상태다. 새 계획은 그 위의 후속 변경이다.
- R-D1은 direct-run.md:20,28, R-C1은 coordinator-commands.ts:783 및 test/coordinator.test.js:5530으로 기존 충족 처리한다. 나머지 절차의 부족한 부분만 수정한다.

## 실행 DAG

| Task | 요구사항 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| [TASKS-001](tasks/001/tasks.md) | R-D1·R-D2·R-D4 | [] | true | integrated | commit |
| [TASKS-002](tasks/002/tasks.md) | R-D3 | [] | true | integrated | commit |
| [TASKS-003](tasks/003/tasks.md) | R-C1·R-C2·R-C3 | [TASKS-002](tasks/002/tasks.md) | false | integrated | commit |
| [TASKS-004](tasks/004/tasks.md) | 전체 CI | TASKS-001, TASKS-002, TASKS-003 | false | integrated | verification |

- 다른 blueprint와 공유하는 문서는 PR 병합 후 최신 checkout에서 근거를 다시 확인한다. task DAG는 이 blueprint 내부 순서만 표현한다.
- 종단 task는 사용자 확인을 받은 전체 CI 명령으로 scaffold한다. 구현 task의 변경 경로는 사용자 확인을 받은 각 task의 affected_paths가 정본이다.

## 전용 검증 명령 제안

사용자 확인을 받은 명령이며 task frontmatter에 동일하게 설정한다.

| Task | 제안 명령 |
| --- | --- |
| TASKS-001 | `node --test test/skill-bouncer-run.test.js` |
| TASKS-002 | `node --test test/agents.test.js` |
| TASKS-003 | `node scripts/check-doc-shape.js skills/bouncer-run/references/agent-dispatch.md rules/cli.md` |
| TASKS-004 | `npm run ci` |

## Out of scope
- 새 handoff CLI
- intent 재시도 횟수 runtime 저장
- note 수정·삭제
- 직접 구현·리뷰 허용
- 요구사항 원문은 untracked 상태를 유지하며 커밋에 포함하지 않는다.

## One-commit justification
- 각 구현 task는 표의 한 책임만 한 커밋으로 다룬다. 서로 다른 계약은 분리하고 모든 구현 뒤 종단 검증 한 개로 묶는다.

## 요구사항 추적

| 요구사항 | 담당 | 완료 판정 |
| --- | --- | --- |
| R-D1 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-D2 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-D3 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-D4 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-C1 | [TASKS-003](tasks/003/tasks.md) | 해당 task Target behavior와 Checklist |
| R-C2 | [TASKS-003](tasks/003/tasks.md) | 해당 task Target behavior와 Checklist |
| R-C3 | [TASKS-003](tasks/003/tasks.md) | 해당 task Target behavior와 Checklist |

## 변경 경로 후보와 조사 근거

아래 목록은 조사 근거다. 사용자 확인을 받은 Touch 파일 목록을 각 task의 affected_paths에 기록했다.

| graph | status | query | result |
| --- | --- | --- | --- |
| source | reused | explain resolveTaskIntentBundle | 최신 그래프의 관련 source 경로를 실제 코드·호출자 rg로 확인 |
| test | skip-disabled | graphify.test_dirs 미설정으로 질의 생략 | 테스트 후보는 rg 검색 및 실제 파일 근거 사용 |

### TASKS-001 — 직접 실행 판정 예시와 인계 순서 명시

- `skills/bouncer-run/references/direct-run.md` — grep -l metrics
- `references/coordinator-cards/report.md` — grep -l report
- `references/coordinator-cards/record.md` — grep -l report
- `skills/bouncer-run/references/drive-metrics.md` — grep -l metrics

### TASKS-002 — 파일 기반 구현 payload 전달 계약 명시

- `skills/bouncer-run/references/agent-dispatch.md` — grep -l perspectives
- `references/coordinator-cards/implement.md` — grep -l snapshot
- `agents/bouncer-implementer.md` — grep -l scaffold
- `.codex/agents/bouncer-implementer.toml` — grep -l scaffold

### TASKS-003 — 의도 묶음 재선택 한도와 재사용 조건 명시

- `skills/bouncer-run/references/agent-dispatch.md` — grep -l perspectives
- `rules/cli.md` — grep -l review_contract
- `CHANGELOG.md`는 Graphify 후보가 아닌 프로젝트 Unreleased 기록 의무로 Touch에 포함한다.


## 최소 변경 검토
- 새 의존성이나 일반화 계층을 추가하지 않는다. 기존 fs·crypto·git과 js-yaml을 재사용한다.
- 기존 파일만 수정하며 새 모듈이나 파일을 만들지 않는다.
- 기존 테스트를 실행하는 것만으로 해당 파일을 변경 경로에 추가하지 않는다. 역할 Markdown의 추적된 TOML만 생성본 수정 범위에 포함한다.
