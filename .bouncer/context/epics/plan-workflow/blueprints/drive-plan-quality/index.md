---
type: bouncer.blueprint
title: 계획 영향 범위와 선행 병합 검증 강화
description: Ground plan briefs in consumer evidence and require declared prerequisite merges before approval.
resource: .bouncer/context/epics/plan-workflow/blueprints/drive-plan-quality/index.md
tags:
  - bouncer
  - blueprint
  - plan-workflow
  - drive-followups
timestamp: '2026-10-23T08:26:23.829+09:00'
bouncer:
  id: drive-plan-quality
  epic_id: plan-workflow
  blueprint_id: drive-plan-quality
  status: closed
  order: 34
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
  attribution: 수용 기준이 plan-workflow의 계획 영향 범위와 선행 병합 검증 강화에 집중하므로 해당 domain epic에 귀속함
---
# 계획 영향 범위와 선행 병합 검증 강화

Epic: [plan-workflow](../../index.md)

## Intent
- drive에서 드러난 R-M2·R-P1·R-P2·R-P3·R-P4·R-P5의 계약 공백을 닫아 같은 실패와 수작업 반복을 줄이려 함.
- 계획 영향 범위와 선행 병합 검증 강화를 구현 task별 수용 기준과 종단 검증으로 확인함.

## Contract

### 인터페이스·데이터·상태
- 신규 light는 review_contract: brief와 context-review.md를 포함한 초기 5문서를 만든다. 100줄 예산은 context-review를 제외한 4문서이며 종단 검증 2문서는 별도다.
- 형태·gate 입력 변경은 소비 테스트/fixture, 설명 변경은 같은 서술의 문서를 rg로 찾고 결과를 Touch 근거에 남긴다.
- verifiability는 실제 도달 가능한 expected red와 소비 테스트 누락, consistency는 설명 문서 조사 근거 및 Constraints의 기존 단언 변경 범위를 판정한다.
- 선행 blueprint가 필요한 계획은 병합 근거를 명시한다. closed 상태만으로 병합을 인정하지 않으며 draft·승인·plan gate가 같은 검사를 사용한다.

### 수용 기준
1. TASKS-001이 R-M2를 담당하며 epic 성공 기준 7를 만족한다.
2. TASKS-002이 R-P1·R-P2·R-P3·R-P4를 담당하며 epic 성공 기준 8를 만족한다.
3. TASKS-003이 R-P5를 담당하며 epic 성공 기준 9를 만족한다.
4. TASKS-004이 R-P5를 담당하며 epic 성공 기준 10를 만족한다.
5. epic 성공 기준 11에 따라 각 구현 task는 전용 검증, 종단 TASKS-005은 전체 CI를 수행한다. 검증 명령은 사용자 확인을 받아 task frontmatter에 설정한다.

### 실패 모드·엣지 케이스
- 기존 표식 없는 light의 skip·승인 정책을 바꾸지 않는다.
- 앞선 structural 오류로 expected assertion까지 도달하지 못하는 red는 검증 근거가 아니다.
- 선행 경로 오류·누락·자기참조·중복·순환·미병합 SHA·Git 조회 실패는 승인 쓰기 전에 거절한다.

## 근거와 중복 처리
- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`. 현재 checkout이 근거이며 과거 Explain은 현행 코드보다 우선하지 않는다.
- Graphify source는 계획 진입 시 skip-fresh로 재사용했고 test 그래프는 skip-unconfigured다. 그래프 근거는 advisory이며 승인 범위를 정하지 않는다.
- 기존 `final-review-brief-compliance`·`plan-review-perspectives`는 병합·closed 상태다. 새 계획은 그 위의 후속 변경이다.

## 실행 DAG

| Task | 요구사항 | depends_on | parallel_safe | dependency_gate | execution_kind |
| --- | --- | --- | --- | --- | --- |
| [TASKS-001](tasks/001/tasks.md) | R-M2 | [] | true | integrated | commit |
| [TASKS-002](tasks/002/tasks.md) | R-P1·R-P2·R-P3·R-P4 | [TASKS-001](tasks/001/tasks.md) | false | integrated | commit |
| [TASKS-003](tasks/003/tasks.md) | R-P5 | [] | true | integrated | commit |
| [TASKS-004](tasks/004/tasks.md) | R-P5 | TASKS-002, TASKS-003 | false | integrated | commit |
| [TASKS-005](tasks/005/tasks.md) | 전체 CI | TASKS-001, TASKS-002, TASKS-003, TASKS-004 | false | integrated | verification |

- 다른 blueprint와 공유하는 문서는 PR 병합 후 최신 checkout에서 근거를 다시 확인한다. task DAG는 이 blueprint 내부 순서만 표현한다.
- 종단 task는 사용자 확인을 받은 전체 CI 명령으로 scaffold한다. 구현 task의 변경 경로는 사용자 확인을 받은 각 task의 affected_paths가 정본이다.

## 전용 검증 명령 제안

사용자 확인을 받은 명령이며 task frontmatter에 동일하게 설정한다.

| Task | 제안 명령 |
| --- | --- |
| TASKS-001 | `node scripts/check-doc-shape.js rules/planning.md skills/bouncer-plan/SKILL.md references/spec-authoring/index.md` |
| TASKS-002 | `node --test test/agents.test.js test/skill-bouncer-plan.test.js test/skill-spec-authoring.test.js` |
| TASKS-003 | `node --test test/schema.test.js test/validate-structural.test.js test/plan-prerequisites.test.js` |
| TASKS-004 | `node --test test/validate-gates.test.js test/plan-approve.test.js test/composite-gates.test.js` |
| TASKS-005 | `npm run ci` |

## Out of scope
- 이미 승인·닫힌 blueprint 일괄 변경
- 새 gate로 기존 G25 복원
- 사용자 승인 없는 선행 병합
- 요구사항 원문은 untracked 상태를 유지하며 커밋에 포함하지 않는다.

## One-commit justification
- 각 구현 task는 표의 한 책임만 한 커밋으로 다룬다. 서로 다른 계약은 분리하고 모든 구현 뒤 종단 검증 한 개로 묶는다.

## 요구사항 추적

| 요구사항 | 담당 | 완료 판정 |
| --- | --- | --- |
| R-M2 | [TASKS-001](tasks/001/tasks.md) | 해당 task Target behavior와 Checklist |
| R-P1 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-P2 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-P3 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-P4 | [TASKS-002](tasks/002/tasks.md) | 해당 task Target behavior와 Checklist |
| R-P5 | TASKS-003, TASKS-004 | 해당 task Target behavior와 Checklist |

## 변경 경로 후보와 조사 근거

아래 목록은 조사 근거다. 사용자 확인을 받은 Touch 파일 목록을 각 task의 affected_paths에 기록했다.

| graph | status | query | result |
| --- | --- | --- | --- |
| source | reused | explain approvePlan; explain checkPlanGate | 최신 그래프의 관련 source 경로를 실제 코드·호출자 rg로 확인 |
| test | skip-disabled | graphify.test_dirs 미설정으로 질의 생략 | 테스트 후보는 rg 검색 및 실제 파일 근거 사용 |

### TASKS-001 — 경량 계획 산출물 설명의 현행 계약 반영

- `rules/planning.md` — grep -l review_contract
- `docs/workflow.md` — grep -l review_contract
- `skills/bouncer-plan/SKILL.md` — grep -l review_contract
- `references/spec-authoring/index.md` — grep -l scaffold

### TASKS-002 — 계획 소비자 조사와 리뷰 판정 기준 명시

- `skills/bouncer-plan/SKILL.md` — grep -l review_contract
- `references/spec-authoring/index.md` — grep -l scaffold
- `agents/bouncer-context-reviewer.md` — grep -l review_contract
- `.codex/agents/bouncer-context-reviewer.toml` — grep -l review_contract

### TASKS-003 — 선행 계획 병합 근거의 선언 형식 추가

- `scripts/src/lib/schema.ts` — grep -l review_contract
- `scripts/src/lib/validate-structural.ts` — grep -l review_contract
- `scripts/src/lib/plan-prerequisites.ts` — grep -l plan-prerequisites.ts (003 Touch의 명시적 신규 경로)
- `rules/document-schema.md` — grep -l review_contract
- `test/schema.test.js` — grep -l review_contract
- `test/validate-structural.test.js` — grep -l review_contract
- `test/plan-prerequisites.test.js` — grep -l plan-prerequisites.test.js (003 Touch의 명시적 신규 경로)
- `test/tiers.json` — grep -l scaffold

### TASKS-004 — 승인과 계획 게이트에 선행 병합 판정 연결

- `scripts/src/lib/validate-gates-plan.ts` — grep -l scaffold
- `scripts/src/lib/validate.ts` — grep -l scaffold
- `scripts/src/lib/plan-approve.ts` — grep -l scaffold
- `scripts/src/lib/composite-gates.ts` — grep -l G19
- `test/validate-gates.test.js` — grep -l review_contract
- `test/plan-approve.test.js` — grep -l review_contract
- `test/composite-gates.test.js` — grep -l G19
- `rules/cli.md` — grep -l review_contract
- `skills/bouncer-plan/SKILL.md` — grep -l review_contract
- `CHANGELOG.md`는 Graphify 후보가 아닌 프로젝트 Unreleased 기록 의무로 Touch에 포함한다.


## 최소 변경 검토
- 새 의존성이나 일반화 계층을 추가하지 않는다. 기존 fs·crypto·git과 js-yaml을 재사용한다.
- 신규 파일 `scripts/src/lib/plan-prerequisites.ts`, `test/plan-prerequisites.test.js`은 기존 순수 모듈 경계나 독립 판정 책임을 보존하기 위한 최소 분리이며 각 task Touch가 생성 근거를 소유한다.
- 기존 테스트를 실행하는 것만으로 해당 파일을 변경 경로에 추가하지 않는다. 역할 Markdown의 추적된 TOML만 생성본 수정 범위에 포함한다.
