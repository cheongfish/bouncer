---
type: bouncer.blueprint
title: 승인·집계 저장·리뷰 호환 후속 보강
description: Harden approval and snapshot persistence and align review compatibility documentation.
resource: .bouncer/context/epics/plan-workflow/blueprints/review-compat-followups/index.md
tags:
  - bouncer
  - blueprint
  - plan-workflow
  - compatibility
  - snapshot
timestamp: '2026-10-23T14:25:11.421+09:00'
bouncer:
  id: review-compat-followups
  epic_id: plan-workflow
  blueprint_id: review-compat-followups
  status: closed
  order: 35
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: 승인 전 선행 선언과 task 검증 계약 보강을 중심으로 리뷰 호환 후속 요구사항 전체를 처리하므로 plan-workflow에 귀속함
  supersedes: []
---
# 승인·집계 저장·리뷰 호환 후속 보강

Epic: [plan-workflow](../../index.md)

## Intent
- 승인 전에 발견할 수 있는 선행 선언·검증 명령 오류를 차단하고 집계 snapshot 저장의 경계·실패 처리를 보강함.
- 이월된 문서 모순과 변경 이력 누락을 현행 런타임 계약에 맞춰 정리함.

## Contract

### 인터페이스·데이터·상태
- 잘못된 prerequisites 형식은 plan approve가 쓰기 전에 plan-approve-prerequisite으로 거절하며 cause에 S39를 담는다. 유효한 선행의 기존 존재·순환·병합 G32 판정은 유지한다.
- snapshot은 mkdir 전 기존 조상 경계를 검사하고 temp를 배타 생성한다. 경계·snapshot 읽기 오류는 metrics-snapshot-invalid, 저장 I/O 오류는 metrics-snapshot-write-failed로 돌려준다. snapshot JSON version 1과 summary shape는 유지한다.
- 직접 node scripts/check-doc-shape.js 파일 인자를 가진 task verify는 kind/path contract가 없는 대상을 plan·draft에서 G20으로 거절한다. 계약 정본은 순수 leaf를 checker와 CLI가 공유한다. 기존 argv·allowlist·scoped_terminal 정책은 유지한다.
- reviewer consistency, prerequisites 설명, intent cache, 인계 실패 경계, snapshot 시각 출처, review-dispatch·repair·comprehension synopsis와 CHANGELOG를 실제 동작에 맞춘다.

### 수용 기준
1. TASKS-001은 자기참조·HEAD·짧은 SHA·비정규 경로·중복의 승인 거절과 문서 bytes 보존, 단일 항목 판정을 검증한다(epic 성공 기준 12).
2. TASKS-002는 외부 디렉터리/파일 무변경, I/O 거절 반환, partial merge 저장 순서·실패 보존, 필수 heading 누락 exit 1을 검증한다(epic 성공 기준 13).
3. TASKS-003은 공유 계약 존재 판정과 draft·gate 동일 G20 및 기존 명령 호환을 검증한다(epic 성공 기준 14).
4. TASKS-004~006은 요구사항 2-1~2-3의 모든 문서 모순과 누락을 해소하고 역할 TOML 일치를 확인한다(epic 성공 기준 15).
5. TASKS-007은 사용자 확인된 전체 CI를 한 번 수행하는 terminal verification이며 모든 구현의 통합을 기다린다(epic 성공 기준 16).
6. 요구사항 원본은 변경·stage·커밋 범위에서 제외한다(epic 성공 기준 17).

### 실패 모드·엣지 케이스
- 형식 오류 선언은 Git 조회 대상으로 넘기지 않으며 승인 거절 전후 모든 문서 bytes를 보존한다.
- 미존재 하위 디렉터리 아래 조상 symlink와 기존 temp symlink도 회귀 테스트에 포함한다. EACCES·EISDIR·write/rename 실패는 스택 종료 대신 기존 reason으로 거절한다.
- partial merge fixture는 사전 거절을 통과하고 save seam에 도달해야 한다. snapshot 실패 후 merge/commit은 실행하지 않는다.
- 미계약 문서 입력의 expected red는 다른 structural 오류가 없는 fixture에서 G20까지 도달해야 한다.
- 문서만 정리하는 task는 새 런타임 필드·리뷰 관점·라운드를 만들지 않는다.

## 요구사항 추적

| 원문 항목 | 담당 | 완료 판정 |
| --- | --- | --- |
| 1-1 | TASKS-001 | 승인 reason·S39·쓰기 0회·bytes 보존 및 helper 회귀 |
| 1-2 F-CT-1·SEC-001·F-CT-3·F-CT-5 | TASKS-002 | 경계·I/O·partial merge·heading 음수 회귀 |
| 1-3 | TASKS-003 | 미계약 verify의 plan/draft G20 |
| 2-1 F2·F3 | TASKS-004 | consistency·TOML parity·schema 연결 설명 |
| 2-2 F-CT-1·F-SS-001·F-SS-002·F-SS-1 | TASKS-005, TASKS-006 | cache/throw·인계·recorded_at 출처·CLI function_ref |
| 2-3 review-round·review-dispatch·SS-1·SS-2 | TASKS-006 | repair·전략·security·comprehension·Unreleased 대조 |
| 전체 CI | TASKS-007 | terminal 실행 증적 |

## 실행 DAG

| Task | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- |
| [TASKS-001](tasks/001/tasks.md) | [] | true | integrated | commit |
| [TASKS-002](tasks/002/tasks.md) | [] | true | integrated | commit |
| [TASKS-003](tasks/003/tasks.md) | TASKS-002 | true | integrated | commit |
| [TASKS-004](tasks/004/tasks.md) | [] | true | integrated | commit |
| [TASKS-005](tasks/005/tasks.md) | [] | true | integrated | commit |
| [TASKS-006](tasks/006/tasks.md) | TASKS-001, TASKS-003, TASKS-004, TASKS-005 | false | integrated | commit |
| [TASKS-007](tasks/007/tasks.md) | TASKS-001, TASKS-002, TASKS-003, TASKS-004, TASKS-005, TASKS-006 | false | integrated | verification |

- TASKS-002와 TASKS-003은 doc-shape CLI 테스트 파일을 공유하므로 선후 관계를 둔다.
- rules/cli.md와 CHANGELOG.md는 TASKS-006만 변경한다. 해당 문서는 선행 구현과 TASKS-005의 문서 정리를 반영한다. 독립 준비 task의 변경 파일은 서로 겹치지 않는다.

## 승인된 검증 명령

각 구현은 해당 task만 검증하고 전체 CI는 terminal 하나에 둔다. 아래 명령은 사용자 확인을 받아 각 task frontmatter에 설정했다.

| Task | 명령 |
| --- | --- |
| TASKS-001 | `node --test test/plan-approve.test.js test/plan-prerequisites.test.js` |
| TASKS-002 | `node --test test/cli-metrics.test.js test/finalize-release-main.test.js test/doc-shape-cli.test.js` |
| TASKS-003 | `node --test test/validate-gates.test.js test/cli-validate.test.js test/doc-shape-cli.test.js test/distribution.test.js test/typescript-module-contract.test.js` |
| TASKS-004 | `node --test test/agents.test.js test/skill-context-review.test.js` |
| TASKS-005 | `node scripts/check-doc-shape.js skills/bouncer-run/references/agent-dispatch.md skills/bouncer-run/references/drive-metrics.md` |
| TASKS-006 | `node scripts/check-doc-shape.js rules/cli.md` |
| TASKS-007 | `npm run ci` |

## 근거와 중복 처리
- 조사 HEAD는 `b62eb3cdbe1ba52dc3233e76be9396e9ca647e1b`이며 현재 코드·테스트가 동작의 근거다. intent의 current 결과는 기존 drive-plan-quality·metrics-retention의 의도를 확인하는 참고 자료로만 사용했다. historical 또는 빈 이전 제약은 채택하지 않았다.
- 기존 관련 blueprint는 closed이며 이번 계획으로 재개하거나 상태를 바꾸지 않는다. PR #266의 legacy 거절 응답 복원은 해당 review-dispatch/context-review-store와 보존 Explain으로 확인했다.
- Graphify source는 skip-fresh로 재사용했다. explain(approvePlan), explain(checkPrerequisites), explain(saveWorkerSnapshot) 후보를 실제 호출자 rg와 코드로 확인했다. test 그래프는 skip-unconfigured라 테스트 근거는 rg와 실제 파일을 사용했다.

## 최소 변경 검토
- 새 의존성을 추가하지 않는다. node:fs 배타 생성과 기존 argv parser·순수 계약 정의를 재사용한다.
- 새 source는 doc-shape-contracts.ts 하나다. 개발 checker를 배포에 추가하거나 소비 저장소 스크립트를 require하는 대신 이미 배포되는 scripts/lib의 순수 leaf로 계약 중복을 없앤다.
- generated TOML은 Touch에 포함하고 비추적 scripts/lib 산출물은 빌드만 한다. 문서만 바꾸는 task에 문구를 복사한 테스트를 추가하지 않는다.

## Out of scope
- REQUIREMENTS_REVIEW_COMPAT_FOLLOWUPS.md와 다른 로컬 제안 문서의 변경·stage·커밋. 원문 대신 이 계획과 task brief에 실행에 필요한 수용 기준을 보존한다.
- 기존 closed blueprint 재개, verify 문법·scoped_terminal 정책·summary JSON schema 변경.
- npm wrapper나 Node 옵션을 해석하는 범용 명령 분석기, 새 리뷰 라운드·관점·보안 의존성.

## One-commit justification
- 구현 task는 선행 형식·snapshot·verify 사전 검사·계획 문서·런타임 문서·리뷰 마감 문서라는 한 책임씩 한 커밋으로 묶는다. blueprint는 이월된 리뷰 호환 후속 작업 전체를 한 PR로 검토하는 단위다.
- 마지막 verification task는 source diff나 커밋을 만들지 않고 모든 구현 통합 후 전체 CI 증적만 남긴다.

## 변경 경로 후보와 조사 근거

아래 후보를 제시한 뒤 사용자 확인을 받아 각 구현 task frontmatter affected_paths에 동일한 목록을 기록했다. 신규 leaf 경로는 TASKS-003이 명시한 Create 항목이다. CHANGELOG는 그래프 후보가 아니라 요구사항 2-3의 명시적 산출물이다.

| graph | status | query | result |
| --- | --- | --- | --- |
| source | reused | explain approvePlan; explain checkPrerequisites; explain saveWorkerSnapshot; explain checkPlanDraft; query PATH_CONTRACTS --budget 1000 및 3000 | source graph 최신으로 재사용. explain 경로는 rg로 확인. PATH_CONTRACTS 질의는 두 budget 모두 관련 없는 광범위 결과를 내어 후보로 사용하지 않음 |
| test | skip-disabled | graphify.test_dirs 미설정으로 질의 생략 | 테스트 후보는 rg와 실제 파일 근거 사용 |

### TASKS-001

- `scripts/src/lib/plan-approve.ts` — graphify explain(approvePlan)
- `scripts/src/lib/plan-prerequisites.ts` — graphify explain(checkPrerequisites)
- `test/plan-approve.test.js` — grep -l plan-approve-prerequisite
- `test/plan-prerequisites.test.js` — grep -l checkPrerequisites

### TASKS-002

- `scripts/src/lib/drive-metrics.ts` — graphify explain(saveWorkerSnapshot)
- `test/cli-metrics.test.js` — grep -l saveWorkerSnapshot
- `test/finalize-release-main.test.js` — grep -l saveWorkerSnapshot
- `test/doc-shape-cli.test.js` — grep -l check-doc-shape

### TASKS-003

- `scripts/src/lib/doc-shape-contracts.ts` — grep -l doc-shape-contracts
- `scripts/check-doc-shape.js` — grep -l PATH_CONTRACTS
- `scripts/src/lib/validate-gates-plan.ts` — graphify explain(checkPlanDraft)
- `test/validate-gates.test.js` — grep -l G20
- `test/cli-validate.test.js` — grep -l G20
- `test/doc-shape-cli.test.js` — grep -l check-doc-shape
- `test/distribution.test.js` — grep -l files

### TASKS-004

- `agents/bouncer-context-reviewer.md` — grep -l consistency
- `.codex/agents/bouncer-context-reviewer.toml` — 생성본 쌍
- `rules/document-schema.md` — grep -l prerequisites
- `test/skill-context-review.test.js` — grep -l consistency

### TASKS-005

- `skills/bouncer-run/references/agent-dispatch.md` — grep -l Intent bundle
- `skills/bouncer-run/references/direct-run.md` — grep -l Handoff
- `skills/bouncer-run/references/drive-metrics.md` — grep -l worker_tokens_source

### TASKS-006

- `skills/bouncer-run/references/review-round.md` — grep -l second repair
- `rules/cli.md` — grep -l review-dispatch
- `CHANGELOG.md` — 프로젝트 변경 이력 의무 및 요구사항 2-3 (Graphify 후보 제외)

TASKS-007은 verification node라 변경 경로 후보가 없으며 affected_paths: []를 유지한다.
