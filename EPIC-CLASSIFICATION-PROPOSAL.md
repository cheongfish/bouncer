# Epic 기능 분류와 재배치 제안

2026년 10월 20일 기준 (초안, 사용자 승인 전)

이 저장소의 `domain-only` 등록부(공통 epic 0개, `domainEpicLimit` 8)에 도메인 epic 8개를 등록하고, 기존 `legacy` epic 63개를 그 8개에 대응시키는 제안이다. 요구사항은 [소비 프로젝트 Epic 공통화 요구사항](CONSUMER-EPIC-CLASSIFICATION-REQUIREMENTS.md), 후속 작업 계획은 [플러그인 저장소 epic 병합 후속 작업](EPIC-CONSOLIDATION-FOLLOWUP.md)에 있다.

## 근거와 한계

- 대상은 `.bouncer/context/epics/` 아래 epic 63개(`114-consumer-epic-registry` 포함)와 blueprint 222개다. 114는 등록부를 도입한 epic이라 `context-search`로 귀속한다.
- 분류 근거는 epic `description`과 blueprint `description`이다. 코드 변경 범위는 읽지 않았다.
- epic 하나가 여러 영역에 걸치는 경우가 있다. 아래 매핑표는 epic별 주 영역을 정하고, 갈라지는 blueprint는 예외로 적는다.

## 영역 8개

이름은 저장소 도메인에서 가져왔다. 공통 epic slug 8개(`foundation`, `core`, `data`, `integration`, `identity-access`, `interface`, `features`, `quality-ops`)와 목적형 이름(`performance`, `security`, `refactoring` 등)은 `epic add-domain`이 거절하므로 쓰지 않았다.

| slug | 포함 | 제외 |
| --- | --- | --- |
| `host-distribution` | 플러그인 배포 표면: 호스트(Claude·Codex·Cursor·Antigravity) 매니페스트와 launcher, `bouncer init`과 설치, 릴리스·공개 계약·보안 기준선, 빌드 산출물 배포 | 워크플로 단계별 동작 변경 → 해당 단계 영역 |
| `plan-workflow` | `/bouncer-plan`: 발견, spec-authoring, scaffold, task brief·intent bundle·경량 계획, plan gate와 context review의 계획 단계 규칙 | review 심사 자체의 기준·디스패치 → `gates-review` |
| `drive-execution` | `/bouncer-run`: coordinator, DAG·wave·lease, worktree, worker 디스패치와 모델 설정, repair·재시도, 실행 비용 절감, implementer 탐색 | 검증 증적 재사용·gate 판정 → `gates-review` |
| `finalize-closeout` | `/bouncer-finalize`: explain·퀴즈·comprehension, PR 본문, remainder 커밋, 부분 finalize와 복구, 마감 후 정리 | 실행 중 커밋 규칙 → `drive-execution` |
| `context-search` | 컨텍스트 문서 모델: epic·blueprint 식별자와 스키마, 등록부, Distill·정본 컨텍스트, Graphify·ontology 검색, 출처 추적 | 문서를 쓰는 워크플로 단계 동작 → 해당 단계 영역 |
| `gates-review` | 검증과 리뷰: `bouncer validate` gate 코드, verify 증적과 재사용, 리뷰 관점·디스패치·라운드, 코딩·테스트 표준 | gate가 나오는 계획 문서 형식 → `plan-workflow` |
| `runtime-architecture` | CLI·런타임 기반: TypeScript 전환, 모듈 책임 분해, 규칙·스킬 구조, 현재 작업 포인터, 상태 전이 가드, 소스·테스트 위생 | 특정 단계의 기능 → 해당 단계 영역 |
| `benchmark-cost` | 평가와 비용: 벤치마크 하네스, DeepSWE, 토큰·시간 측정 기준선, 비용 절감 계획의 측정 부분 | 특정 단계의 동작을 바꾸는 비용 절감 구현 → 해당 단계 영역 |

### 귀속 규칙

1. 수용 기준의 중심이 어느 워크플로 단계(plan·run·finalize)의 동작이면 그 단계 영역에 귀속한다. 비용 절감이나 신뢰성 개선이라는 목적은 기준이 아니다.
2. 단계를 가로지르는 기반(CLI 모듈, 규칙 구조, 상태 전이)은 `runtime-architecture`, 문서·검색 모델은 `context-search`, 판정(gate·verify·review)은 `gates-review`다.
3. 측정 기준선과 평가 도구만 `benchmark-cost`다.
4. 두 영역에 걸치면 변경 파일이 가장 많이 속한 영역을 고른다. 판정이 안 서면 사용자가 정한다.

### 각 영역이 공통 epic으로 귀속되지 않는 이유

이 저장소는 `domain-only` 프로필이라 공통 epic이 0개다. 8개 영역은 소비 프로젝트 공통 계층(`foundation`·`core` 등)이 아니라 Bouncer 워크플로 자체의 기능 경계다. 예를 들어 `plan-workflow`와 `finalize-closeout`은 범용 `features`로 묶으면 `area` 구분 없이 200개가 넘는 blueprint가 한 epic에 쌓인다. `add-domain --yes`의 `--reason`에는 이 문단을 영역별로 줄여 쓴다.

## legacy epic 매핑

주 영역 기준이다. 혼재 표시(△)는 아래 예외 표를 함께 본다.

| 영역 | epic |
| --- | --- |
| `host-distribution` | 001 product-surface-hosts △, 039 release-security, 079 roadmap-closeout |
| `plan-workflow` | 004 planning-quality-governance △, 062 document-commit-contracts △, 070 task-brief-specificity, 071 code-grounded-intent-provenance, 073 task-intent-bundle-reuse, 074 plan-context-quality-efficiency, 096 plan-review-convergence, 097 intent-fence-guard, 101 plan-review-call-reduction, 102 plan-review-loop-guard, 105 drive-retro-104-followups △ |
| `drive-execution` | 009 agent-orchestration △, 018 task-unit-commits △, 067 task-dag-coordinator, 078 parallel-run-finalize-digest △, 080 execution-token-cost, 083 drive-context-reduction, 084 drive-plan-copy-hygiene, 088 drive-token-reduction, 089 workflow-cost-and-light-path, 090 drive-reliability, 091 drive-observation-cleanup, 098 drive-plan-cost-control, 099 bouncer-improvements-2026-10-14 △, 103 drive-repair-integrity, 104 drive-retro-103-followups, 109 implementer-navigation |
| `finalize-closeout` | 082 explain-index-intent-exit, 085 finalize-runtime-slimming, 086 finalize-output-cleanup, 113 partial-finalize-recovery △ |
| `context-search` | 007 project-distill, 014 numeric-context-ids △, 060 graphify-search-quality, 068 context-runtime-rearchitecture, 072 search-payload-context-retention, 100 graphify-raw-query, 111 context-ontology, 114 consumer-epic-registry |
| `gates-review` | 065 workflow-reliability, 075 adaptive-review-dispatch, 076 verification-reuse-checkpoint-compaction, 095 coding-standards-pr-retro |
| `runtime-architecture` | 006 platform-architecture, 061 structural-audit-remediation △, 063 maintenance △, 064 runtime-policy-pointer-safety, 066 workflow-contract-followup, 069 workflow-improvement △, 077 rules-reorganization, 081 cli-deterministic-procedures, 087 v153-evaluation-remediation △, 092 source-test-hygiene, 106 source-restructuring, 112 workflow-transition-guards |
| `benchmark-cost` | 034 evaluation-benchmarking, 043 bouncer-cost-improvement △, 093 benchmark-contract-stability, 094 deepswe-benchmark, 107 workflow-cost-reduction |

8개 영역의 합이 63개이고 epic마다 한 영역에만 나온다(114 포함).

### 혼재 epic의 blueprint 예외

| epic | blueprint | 귀속 영역 | 이유 |
| --- | --- | --- | --- |
| 001 | 008 instruction-layers, 009 debt-items | `runtime-architecture` | 지시문 층 경계와 감사 부채는 호스트 배포가 아님 |
| 004 | 007 context-review-guard | `gates-review` | 리뷰 심사와 G18 |
| 009 | 003 adaptive-quiz, 005 pr-single-confirm, 013 structured-pr-body | `finalize-closeout` | 퀴즈·PR 본문 |
| 009 | 012 plugin-arm-benchmark | `benchmark-cost` | 벤치마크 프로토콜 |
| 009 | 006 debugger-agent | `gates-review` | verify 실패 조사 |
| 014 | 001~003, 005~009 | `context-search` | 식별자·스키마·코퍼스 |
| 018 | 005~007, 016, 019, 020 | `finalize-closeout` | explain·comprehension·승격·마감 |
| 018 | 018 gate-integrity | `gates-review` | gate 집합과 verify 증적 |
| 043 | 005~008, 010 | `runtime-architecture` | 에이전트 rubric·reference 분리·규칙 블록 구조 |
| 043 | 002 light-plan-contract | `plan-workflow` | 경량 plan |
| 061 | 001 | `gates-review` | 셸 없는 검증, 커밋 스코프 검사 |
| 061 | 002 | `drive-execution` | run 규칙 로딩 |
| 061 | 004 | `host-distribution` | 배포 유지보수 |
| 062 | 004 benchmark-skill-removal | `benchmark-cost` | 벤치마크 스킬 제거 |
| 062 | 003 migrate-ids-removal | `context-search` | 식별자 이관 표면 제거 |
| 062 | 005 explain-task-context | `finalize-closeout` | 마감 시 task 문서 보존 |
| 063 | 001 graphify-query-guidance | `context-search` | 검색 안내 |
| 063 | 002, 003, 004 | `plan-workflow` | context review·발견 안내 |
| 078 | finalize digest 부분 | `finalize-closeout` | 병렬 run은 `drive-execution` |
| 087 | 평가 후속 | `gates-review`/`drive-execution` | blueprint 확인 후 확정 |
| 099 | 001 | `gates-review` | 리뷰 입력 일관성 |
| 099 | 003, 005, 006 | `drive-execution` | repair·dispatch·worker 정리 |
| 105 | verify 출력 tail | `gates-review` | 나머지는 `plan-workflow` |
| 113 | 002 lint-baseline-cleanup | `runtime-architecture` | CI lint 기준선 |

예외 표는 blueprint 설명만 보고 정했다. 확정 전에 `087`과 `069`는 blueprint 단위로 다시 보고, `099`의 `noindex` blueprint 2개(`099/002`, `099/006`)는 문서를 열어 확인해야 한다.

## 병합 방식 권고

후속 작업 문서의 선택지 중 **논리적 병합**을 권한다.

- legacy epic 63개는 `legacy`로 그대로 둔다. 새 blueprint는 도메인 epic에만 만든다. 매핑표는 도메인 epic의 `index.md`에 기록한다.
- 물리적 이관은 이관 도구(REQ-13~15) 개발, trailer·pointer·승인 스냅샷·원장·브랜치 참조 정리가 필요하다. 승인·검증 해시를 건드리지 않는다는 제약도 있어 비용과 위험이 크다.
- 논리적 병합은 코드 변경이 없고 소비 프로젝트에 영향이 없다.
- 이 선택은 `legacy` epic의 새 blueprint를 영구히 막는다는 의미다. 기존 epic에 후속 blueprint를 달던 습관은 도메인 epic으로 바뀐다.

## 진행 중 blueprint

blueprint `status`가 `closed`가 아닌 것의 집계다. 실제 진행 여부가 아니라 문서 상태이며, 과거 epic의 `approved`는 finalize를 거치지 않아 상태가 남은 경우가 많다.

- `draft`: 004/002 `init-rules-scaffold` 1개. `legacy` 아래에서는 승인할 수 없으므로 닫거나 새 도메인 epic에서 다시 계획한다.
- `approved`가 남은 epic: 001(5), 004(5), 006(1), 007(1), 009(7), 014(4), 018(15), 060(3), 106(1), 111(1), 112(1), 113(1), 114(1).
- 최근 epic(106·111·112·113)의 `approved`는 실제로 이어갈 후보일 수 있어, 각각 끝낼지·닫을지·다시 계획할지를 사용자와 정한다.
- 오래된 epic(001~060)의 `approved`는 대부분 이미 코드에 반영됐을 가능성이 크다. `closed` 처리 전에 각 blueprint가 병합됐는지 확인해야 한다.

## 다음 단계와 승인 지점

1. 이 문서의 영역 이름·경계·매핑에 사용자 승인이 필요하다. 이름은 확정 전에 바꿀 수 있다.
2. 승인 후 `bouncer epic add-domain --slug <s> --reason <text> --yes`를 영역마다 한 번씩 8번 실행한다. 등록은 사용자 승인 행위다.
3. 도메인 epic 8개의 `index.md`에 매핑표를 옮긴다.
4. 진행 중 blueprint를 정리한다.

소스코드 책임 분해([소스코드 개편 제안](SOURCE-RESTRUCTURING-PROPOSAL.md))는 이 작업과 분리한다.
