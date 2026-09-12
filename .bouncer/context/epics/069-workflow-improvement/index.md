---
type: bouncer.epic
title: 워크플로 런타임과 추적성 개선
description: Incremental Bouncer workflow improvements to runtime context cost, review convergence, and execution traceability, delivered as independent blueprints.
resource: .bouncer/context/epics/069-workflow-improvement/index.md
tags:
  - bouncer
  - epic
  - workflow
  - review
  - worktree
  - context-budget
timestamp: '2026-09-11T10:25:27.510+09:00'
bouncer:
  id: '069'
  epic_id: '069'
  status: approved
  supersedes: []
---
# 069 workflow-improvement

## Intent
- 문제: 진입 스킬은 실행하지 않는 분기의 계약까지 매번 적재하고, execute 리뷰는 round마다 판단 범위를 다시 열어 수렴하지 않으며, worktree branch 이름은 실행 경로마다 다른 규칙으로 조합된다.
- 목표: 워크플로의 런타임 컨텍스트 비용, 리뷰 수렴, 실행 추적성을 blueprint 단위로 개선하고, 뒤따르는 개선 결정도 이 epic에 blueprint로 쌓는다.

## Success criteria
1. 여섯 진입 스킬의 번호 단계 수가 BP001 Contract의 스킬별 단계 목록과 같고, 여섯 스킬의 합계 단어 수가 BP001 착수 시점 합계(7,795)보다 작다는 `test/skill-bouncer-surface.test.js`가 통과한다.
2. `bouncer execute prepare`, `bouncer run preflight`, `bouncer plan inspect`가 각 스킬이 소비하는 필드를 JSON으로 반환하고, `bouncer commit` payload가 controller mode·다음 행동·stamp 경로·복구 행동을, `bouncer finalize` payload가 integration 완료 여부를 싣는다는 CLI 테스트가 통과한다.
3. BP001 Contract가 정한 안전 경계 아홉 행이 각각 정본 파일 한 곳에 존재하고 해당 진입 스킬이 그 정본을 참조한다는 `test/workflow-safety-canon.test.js`가 통과한다.
4. Execute review 절차가 고정 target의 관점별 병렬 discovery, 단일 fix batch, delta certification 순서이고 delta certification이 revision이 건드리지 않은 코드의 새 `minor`·`nit`를 채택하지 않는다는 것을 `test/skill-bouncer-execute.test.js`의 절차 순서 단언과 G14 delta origin fixture가 확인한다.
5. Execute gate(G14)가 fingerprint 중복, review target 불일치, 허용되지 않은 round 순서와 delta 신규 finding, 남은 `must_fix`가 있는 accepted review를 거부한다는 `test/validate-gates.test.js`가 통과한다.
6. Drive의 critical recovery는 task당 최대 한 번 기록되고 두 번째 시도를 CLI가 거절하며, standalone `/bouncer-execute` 절차에는 critical recovery 자동 dispatch가 없다는 것을 `test/coordinator.test.js`와 `test/skill-bouncer-execute.test.js`가 확인한다.
7. Plan context review 절차가 같은 계획 snapshot의 관점별 병렬 판단과 수정 뒤 delta 인증으로 바뀌었다는 것을 `test/skill-context-review.test.js`와 G18 fixture가 확인한다.
8. Integration·standalone branch는 `<commit_type>/<epic-id>-<blueprint-id>-<blueprint-slug>`, worker branch는 `bouncer/<epic-id>-<blueprint-id>-<task-id>`로 CLI helper 한 곳에서 계산되고 `git check-ref-format --branch`로 검증된다.
9. 예상 경로에 등록된 worktree는 기존 branch로 재사용되고, 계산한 branch가 예상 worktree에 연결되지 않은 채 이미 존재하면 worktree나 source를 바꾸기 전에 명시적 충돌로 중단된다.
10. Coordinator ledger, finalize payload, explain의 coordinator frontmatter가 실제 integration branch와 worker branch를 기록하고, draft PR push는 branch 이름을 재계산하지 않고 기록된 값을 쓴다.
11. 각 blueprint를 마감할 때 `npm run ci`가 통과한다.
12. 커밋되지 않은 blueprint만 있는 메인 worktree에서 `coordinate bootstrap`이 계획 문서와 `.bouncer/config.json`을 integration에 복사하고 ledger `seedManifest`에 경로와 sha256을 남기며, `coordinate prepare`가 integration 사본만으로 worker를 준비한다는 `test/coordinator.test.js`가 통과한다.
13. `coordinate integrate`가 worker의 terminal 증적을 integration의 같은 task bundle로 가져오고, untracked 계획으로 시작한 drive가 수동 문서 편집 없이 finalize G16의 열린 task 판정을 통과한다는 `test/coordinator-e2e.test.js`가 통과한다.
14. finalize 뒤 `coordinate release`가 manifest와 바이트가 같은 메인 계획 문서만 되돌리고, 그 뒤 메인에서 `git merge <integrationBranch>`가 계획 문서 충돌 없이 끝난다는 `test/coordinator-e2e.test.js`가 통과한다.
15. 영문 식별자·경로·패키지 이름을 담은 한국어 종결 문장을 blueprint Intent, `commit_intent`, `commit_summary`가 모두 받아들이고, 줄바꿈·빈 문장·3문장 이상·한국어 부재·종결형 부재는 계속 거절한다는 `test/finalize-pure.test.js`가 통과한다.

## Out of scope
- 결정 1(Plan 작성 역할의 계층 분리), 결정 2(Plan 비용 계측과 wave 리뷰), 결정 3(Explain task 제목의 SHA 표시), 결정 4(PR의 Explain 병합 후 경로), 결정 5(Explain 인수인계 확장). 이후 이 epic에 blueprint를 추가해 계획한다.
- 결정 6·8의 측정 지표(workflow별 입력 토큰, 읽은 reference 수, dispatch 수, finding 통계). 계측은 benchmark 후속 작업으로 이연한다.
- 승인 뒤 상태 전이, pointer 설정과 plan gate를 묶는 결정적 명령. 결정 6이 검토 대상으로만 남긴 항목이다.
- 이미 제거된 Distill의 preflight와 finalize 단계.
- 기존 branch 이름을 새 규칙으로 바꾸는 migration.
- Blueprint `043/007-shared-rule-blocks`가 정본화한 공통 규칙의 재추출과 새 공통 헤더.

## Blueprints
* [001 진입 스킬 런타임 컨텍스트 최소화](blueprints/001-entry-skill-runtime-context/index.md) - 진입 스킬 본문을 단계 뼈대로 줄이고 CLI preflight payload와 조건부 reference로 옮김 — `skills/bouncer-*`, `scripts/src/lib/`
* [002 병렬 리뷰와 delta 인증 기반 리뷰 수렴](blueprints/002-review-convergence/index.md) - execute·plan 리뷰를 병렬 discovery, 단일 수정, delta 인증으로 바꾸고 gate와 ledger로 고정 — `references/review/`, `agents/`, `scripts/src/lib/validate-*`
* [003 worktree branch 이름 표준화](blueprints/003-worktree-branch-naming/index.md) - integration·standalone·worker branch 이름을 CLI helper 하나로 계산하고 실제 branch를 기록 — `scripts/src/lib/runtime-state.ts`, `coordinator.ts`, `execute-prepare.ts`, `finalize.ts`, finalize reference
* [004 드라이브 계획 문서 흐름과 마감 정리](blueprints/004-drive-document-flow/index.md) - integration을 drive 계획 문서 정본으로 삼아 seed·증적 반환·메인 사본 반환을 잇고 커밋 문장 parser를 완화 — `scripts/src/lib/coordinator.ts`, `seed-worktree.ts`, `finalize.ts`, `templates.ts`, finalize cleanup reference

실행 순서는 001 → 002 → 003이다. 002는 001이 만든 execute review reference를 고치고, 003은 001이 만든 `bouncer execute prepare`의 branch 계산을 교체한다. 004는 003이 기록한 integration branch를 병합 대상으로 쓴다.
