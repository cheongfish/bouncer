---
type: bouncer.blueprint
title: 정리 이후 실행 측정값 보존
description: Persist worker usage snapshots before cleanup and distinguish unavailable direct usage from measured values.
resource: .bouncer/context/epics/drive-execution/blueprints/metrics-retention/index.md
tags:
  - bouncer
  - blueprint
  - drive-execution
  - drive-followups
timestamp: '2026-10-23T08:26:24.776+09:00'
bouncer:
  id: metrics-retention
  epic_id: drive-execution
  blueprint_id: metrics-retention
  status: closed
  order: 65
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
  attribution: 수용 기준이 drive-execution의 정리 이후 실행 측정값 보존에 집중하므로 해당 domain epic에 귀속함
---
# 정리 이후 실행 측정값 보존

Epic: [drive-execution](../../index.md)

## Intent
- drive에서 드러난 R-X1·R-X2의 계약 공백을 닫아 같은 실패와 수작업 반복을 줄이려 함.
- 정리 이후 실행 측정값 보존를 구현 task별 수용 기준과 종단 검증으로 확인함.

## Contract

### 인터페이스·데이터·상태
- snapshot은 Git 공통 디렉터리의 bouncer/metrics-snapshots/<blueprint-path-sha256>.json에 저장한다. version 1, blueprint, recorded_at, ledger_sha256, worker_tokens를 가진다.
- summary는 현재 원장을 우선하고 원장이 없으면 저장 snapshot을 사용한다. source를 ledger/snapshot/unavailable로 표시하여 0 관측과 자료 부재를 구분한다.
- release-main은 기존 정리 허용 판정 뒤 실제 삭제·복원 전에 snapshot을 보존한다. snapshot 실패면 정리를 시작하지 않는다.
- 호스트가 주지 않은 input/output/cost/cache는 기존 null·missing 정책을 유지한다. direct token은 root usage로 추정하지 않고 측정 불가로 보고한다.

### 수용 기준
1. TASKS-001이 R-X2를 담당하며 epic 성공 기준 6를 만족한다.
2. TASKS-002이 R-X1·R-X2를 담당하며 epic 성공 기준 7를 만족한다.
3. epic 성공 기준 8에 따라 각 구현 task는 전용 검증, 종단 TASKS-003은 전체 CI를 수행한다. 검증 명령은 사용자 확인을 받아 task frontmatter에 설정한다.

### 실패 모드·엣지 케이스
- 원장/저장 snapshot 손상은 0으로 접지 않고 오류로 반환한다. 원장이 없는 재실행은 기존 snapshot을 덮어쓰지 않는다.
- 원장과 snapshot이 모두 없으면 기존 worker 숫자 shape는 유지하되 source unavailable을 표시한다. 실제 0은 source ledger/snapshot과 함께 구별된다.
- worker와 coordinator·cache 값을 합산하지 않는다. wall time은 직접 관측값으로 유지한다.

## 근거와 중복 처리
- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`. 현재 checkout이 근거이며 과거 Explain은 현행 코드보다 우선하지 않는다.
- Graphify source는 계획 진입 시 skip-fresh로 재사용했고 test 그래프는 skip-unconfigured다. 그래프 근거는 advisory이며 승인 범위를 정하지 않는다.
- 기존 `final-review-brief-compliance`·`plan-review-perspectives`는 병합·closed 상태다. 새 계획은 그 위의 후속 변경이다.

## 실행 DAG

| Task | 요구사항 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| [TASKS-001](tasks/001/tasks.md) | R-X2 | [] | true | integrated | commit |
| [TASKS-002](tasks/002/tasks.md) | R-X1·R-X2 | [TASKS-001](tasks/001/tasks.md) | false | integrated | commit |
| [TASKS-003](tasks/003/tasks.md) | 전체 CI | TASKS-001, TASKS-002 | false | integrated | verification |

- 다른 blueprint와 공유하는 문서는 PR 병합 후 최신 checkout에서 근거를 다시 확인한다. task DAG는 이 blueprint 내부 순서만 표현한다.
- 종단 task는 사용자 확인을 받은 전체 CI 명령으로 scaffold한다. 구현 task의 변경 경로는 사용자 확인을 받은 각 task의 affected_paths가 정본이다.

## 전용 검증 명령 제안

사용자 확인을 받은 명령이며 task frontmatter에 동일하게 설정한다.

| Task | 제안 명령 |
| --- | --- |
| TASKS-001 | `node --test test/cli-metrics.test.js test/finalize-release-main.test.js test/cli-help.test.js` |
| TASKS-002 | `node scripts/check-doc-shape.js skills/bouncer-run/references/drive-metrics.md skills/bouncer-finalize/SKILL.md` |
| TASKS-003 | `npm run ci` |

## Out of scope
- 호스트 비공개 사용량 추정
- 누락 토큰의 보간
- 원장 상태 변경
- 외부 모니터링 서비스 추가
- 요구사항 원문은 untracked 상태를 유지하며 커밋에 포함하지 않는다.

## One-commit justification
- 각 구현 task는 표의 한 책임만 한 커밋으로 다룬다. 서로 다른 계약은 분리하고 모든 구현 뒤 종단 검증 한 개로 묶는다.

## 요구사항 추적

| 요구사항 | 담당 | 완료 판정 |
| --- | --- | --- |
| R-X1 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-X2 | TASKS-001, TASKS-002 | 해당 task Target behavior와 Checklist |

## 변경 경로 후보와 조사 근거

아래 목록은 조사 근거다. 사용자 확인을 받은 Touch 파일 목록을 각 task의 affected_paths에 기록했다.

| graph | status | query | result |
| --- | --- | --- | --- |
| source | reused | explain summarizeWorkerTokens; explain releaseMain | 최신 그래프의 관련 source 경로를 실제 코드·호출자 rg로 확인 |
| test | skip-disabled | graphify.test_dirs 미설정으로 질의 생략 | 테스트 후보는 rg 검색 및 실제 파일 근거 사용 |

### TASKS-001 — 원장 정리 전 작업자 측정 집계 보존

- `scripts/src/lib/drive-metrics.ts` — grep -l context-review
- `scripts/src/lib/cli-metrics-command.ts` — grep -l context-review
- `scripts/src/lib/finalize-release-main.ts` — grep -l finalize
- `scripts/src/lib/cli-usage.ts` — grep -l scaffold
- `test/cli-metrics.test.js` — grep -l context-review
- `test/finalize-release-main.test.js` — grep -l finalize
- `test/cli-help.test.js` — grep -l perspectives
- `rules/cli.md` — grep -l review_contract
- `skills/bouncer-finalize/references/cleanup-handoff.md` — grep -l finalize

### TASKS-002 — 측정 불가와 보존 집계의 보고 기준 명시

- `skills/bouncer-run/references/drive-metrics.md` — grep -l metrics
- `skills/bouncer-finalize/SKILL.md` — grep -l comprehension
- `CHANGELOG.md`는 Graphify 후보가 아닌 프로젝트 Unreleased 기록 의무로 Touch에 포함한다.


## 최소 변경 검토
- 새 의존성이나 일반화 계층을 추가하지 않는다. 기존 fs·crypto·git과 js-yaml을 재사용한다.
- 기존 파일만 수정하며 새 모듈이나 파일을 만들지 않는다.
- 기존 테스트를 실행하는 것만으로 해당 파일을 변경 경로에 추가하지 않는다. 역할 Markdown의 추적된 TOML만 생성본 수정 범위에 포함한다.
