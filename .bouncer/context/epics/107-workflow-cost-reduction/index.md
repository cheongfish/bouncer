---
type: bouncer.epic
title: 워크플로 호출·리뷰 비용 절감
description: Cut repeated sessions, evidence calls, reviews, and finalize extras across plan, run, and finalize while keeping approvals and gates.
resource: .bouncer/context/epics/107-workflow-cost-reduction/index.md
tags:
  - bouncer
  - epic
  - workflow
  - subagent
  - review
  - cost
timestamp: '2026-10-17T14:37:20.630+09:00'
bouncer:
  id: '107'
  epic_id: '107'
  status: approved
  supersedes: []
---
# 107 workflow-cost-reduction

## Intent
- 문제: full 경로가 계획 조사·구현·실패 복구·리뷰·마무리를 여러 새 세션으로 나누면서 같은 코드와 계약을 반복해서 읽고, 리뷰가 관점별 fan-out과 수정·delta 왕복으로 늘어난다.
- 목표: 새 세션의 이력 상속, task별 조사, 실패 왕복, controller 전환, 리뷰 호출과 입력, 보고 작성, 마무리 부가 작업을 줄이고 사용자 승인·게이트 증적·리뷰 독립성은 유지한다.

## Diagram
```mermaid
flowchart LR
  A[계획 조사] --> B[계획 리뷰]
  B --> C[구현]
  C --> D[검증 실패 복구]
  D --> E[최종 리뷰]
  E --> F[마무리와 Retro]
```

## Success criteria
1. coordinator·implementer·reviewer·debugger·evidence agent의 신규 dispatch 규칙이 모델 slug·`inherit`와 무관하게 대화 이력 없이 시작한다고 명시하고, 같은 세션 재사용은 implementer 재작업에만 허용한다. 에이전트별 모델 설정(`bouncer subagent-model`)은 그대로 동작한다.
2. plan evidence 조사는 조사 영역 단위로 위임되고, discovery에서 확보한 `file:line` 4필드 근거가 현재 checkout과 맞으면 위임 없이 재사용된다. intent·Explain 결과는 현재 동작 근거로 쓰이지 않는다.
3. 원인이 task `affected_paths` 안의 파일·줄로 특정되는 검증 실패는 기존 implementer가 먼저 고치고, 같은 실패가 반복되거나 원인이 불명확하면 debugger를 호출한다.
4. direct 실행이 정상 최종 리뷰와 범위 안 재작업 1회를 coordinator 인계 없이 끝내고, `direct_eligible`이면 시작 질문이 직접 실행을 추천한다. root 직접 구현 금지는 유지된다.
5. `/bouncer-plan`이 ID를 자동 배정해 변경 가능하게 보여 주고 light/full·verify를 근거와 함께 추천하며, 미결정 제품 동작·`affected_paths`·최종 승인·외부 작업 동의는 사용자 게이트로 남는다.
6. intent bundle에 과거 근거가 없으면 기록하고 dispatch를 계속하며, task 식별·저장 데이터 무결성 오류는 계속 중단한다.
7. light 실행이 승격 조건으로 멈춘 뒤 `coordinate bootstrap --promote-light`가 integration branch 커밋·base SHA·미커밋 변경(patch)을 보존한 채 같은 blueprint의 full 원장을 만들고, full drive가 그 patch를 implementer 입력으로 재사용한다. 재검증은 full drive의 일반 절차를 따른다.
8. blueprint 최종 리뷰는 reviewer 호출 1회(기본 `combined`, `review_risk`가 있을 때만 `security` 추가)이고 수정 batch와 delta가 없으며, `must_fix`는 note가 있는 `deferred`로 기록되어 진행을 막지 않는다. `review_scope`가 없는 blueprint는 명시적 `migrate review-scope` 후 이 경로를 쓰고, 기존 리뷰 기록은 계속 읽힌다. blocked finding은 사용자 결정을 기다린다.
9. finalize는 미해결 `must_fix`를 경고로 표시하고 PR 초안 본문에 그 목록을 넣는다.
10. 계획 context review는 task 수와 관계없이 `single`이고, 본문만 고친 수정은 delta 없이 닫히며, 구조·계약 변경만 delta 또는 restart로 간다.
11. reviewer rubric에서 게이트가 검사하는 항목과 docstring 형식 검사가 빠지고 nit 등급이 없으며, reviewer는 implementer와 같은 8개 섹션 계약과 변경 경로 중심 입력을 받는다.
12. finding의 id·fingerprint는 생략해도 CLI가 채우고, implementer 보고에서 값이 없는 선택 절(Deviations·Scope impact·Needs planning)은 생략되며, hand-back은 요약과 보고 파일 경로, 값이 있을 때만 Needs planning·Scope impact를 싣는다. CLI가 검사하는 heading은 유지된다.
13. payload·dispatch metadata·fallback 규칙은 각각 한 문서에만 본문이 있고 다른 문서는 그 문서를 링크하며, 그 소유 문서가 `docs/architecture/rule-ownership.md` 소유 표에 기록된다.
14. 자동 Retro는 prepare digest의 `drive_issues`(rework 보고·debugger 호출·repair wave·fan-in 검증 실패·blocked·deferred must_fix 개수) 중 하나라도 양수일 때 실행한다. 원장에 남지 않는 CLI 거절은 집계하지 않고, 모두 0이면 생략 사유 한 줄을 낸다.
15. usage 기록은 호스트별 완료·usage 이벤트에 매핑되고 값이 없으면 missing으로 닫혀 실행을 막지 않는다.
16. `AGENTS.md`에 모델이 작성하는 사용자 대상 메시지를 한국어로 쓴다는 하드룰이 있고, 코드·경로·명령·식별자·CLI 원문은 원문을 유지한다.
17. 각 blueprint에서 `npm run ci`가 통과하고, 바뀐 `agents/*.md`마다 `.codex/agents/*.toml`이 생성 결과와 같으며, CHANGELOG.md `Unreleased`에 변경이 기록된다.

## Out of scope
- root 세션의 직접 구현 허용.
- 사용자 소유 승인(plan 승인, finalize, PR)의 자동화나 생략, 게이트 우회, 검증 증적 수기 작성.
- verification node repair wave(최대 2회) 변경.
- CLI가 출력하는 `reason`·`next`·`cause` 메시지의 한국어화.
- light 실행 리뷰의 1회화.
- Explain·Quiz 선택형 전환과 comprehension 게이트 변경.
- 이미 저장된 리뷰·context-review 기록의 의미 변경.
- 호출 수·입력 토큰·탐지 결함 수 benchmark 측정. 병합 뒤 별도로 수행하며 이 epic의 완료 조건이 아니다.

## Blueprints
* [001 계획·실행 호출 축소](blueprints/001-plan-run-call-reduction/index.md) - worker 이력 차단, 조사 영역 단위 evidence, implementer 1차 수정, direct 종결 범위, plan 질문 게이트, intent 실패 분리, light→full 보존 승격 (`rules/`, `skills/bouncer-plan`, `skills/bouncer-run`, `references/`, `agents/`, `.codex/agents/`, `scripts/src/lib`, `test/`, `benchmarks/acp/`, `docs/configuration.md`, `CHANGELOG.md`)
* [002 리뷰·보고·마무리 정리](blueprints/002-review-report-finalize/index.md) - 최종 리뷰 1회와 must_fix 기록, 계획 리뷰 single, reviewer 입력·rubric, finding 필드 자동화, 보고 축소, 문서 정본 정리, Retro 조건, usage 기록, 한글 하드룰 (`scripts/src/lib`, `references/`, `agents/`, `skills/`, `rules/`, `AGENTS.md`, `test/`, `CHANGELOG.md`)
