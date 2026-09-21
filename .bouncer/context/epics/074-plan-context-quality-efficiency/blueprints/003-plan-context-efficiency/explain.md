---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/074-plan-context-quality-efficiency/blueprints/003-plan-context-efficiency/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-21T10:00:09.156+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '074'
  blueprint_id: '003'
  status: published
  task_commits:
    - task: EPIC-074/BP-003/TASK-001
      sha: 16e3257c
      intent_anchor: task-001
    - task: EPIC-074/BP-003/TASK-002
      sha: 43490ba3
      intent_anchor: task-002
  comprehension:
    - range_from: develop
      range_to: abef7afdfc7f0edaa5c5fff34787bde55b2996ff
      diff_sha: 328fdec1751dc4ef6aa1b3d313cb9bcbbbb8718ab4df8a0f455dff9535d6f2e5
      quiz_score: 2/3
      disposition: Q1 wrong (A vs B fork_turns none); Q2–Q3 correct; record only, no retake
      recorded_at: '2026-09-21T10:05:31+09:00'
  coordinator:
    base: 92f886a0a50bfbef74296f2bdd1f0f04316f2be7
    integration_head: abef7afdfc7f0edaa5c5fff34787bde55b2996ff
    integration_branch: feat/074-003-plan-context-efficiency
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/003/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/003/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/003/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: 16e3257c4b39980b82a2634d3c75dd00253d5086
        branch: bouncer/074-003-001
        scope_revision: null
        paths: []
        actual_paths:
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/context-review.md
          - test/skill-bouncer-plan.test.js
          - test/skill-context-review.test.js
      - id: '002'
        status: integrated
        sha: 43490ba319882ee6f41689d7b6faeeccfd9c7f06
        branch: bouncer/074-003-002
        scope_revision: null
        paths: []
        actual_paths:
          - references/graphify-runner/index.md
          - skills/bouncer-plan/SKILL.md
          - skills/bouncer-plan/references/graphify-suggestions.md
          - test/skill-bouncer-plan.test.js
          - test/skill-graphify-runner.test.js
    decisions:
      - task: '001'
        decision: 'Accepted TASKS-001. Paths: skills/bouncer-plan/SKILL.md skills/bouncer-plan/references/context-review.md test/skill-bouncer-plan.test.js test/skill-context-review.test.js. Worker bouncer/074-003-001 @ 16e3257c4b39980b82a2634d3c75dd00253d5086. Env: npm ci in worker (missing node_modules). Review: F1/F2 must_fix resolved; F3/MM1/MM2 advisory accepted.'
      - task: '002'
        decision: 'Accepted TASKS-002. Paths: references/graphify-runner/index.md skills/bouncer-plan/SKILL.md skills/bouncer-plan/references/graphify-suggestions.md test/skill-graphify-runner.test.js test/skill-bouncer-plan.test.js. Worker bouncer/074-003-002 @ 43490ba319882ee6f41689d7b6faeeccfd9c7f06. Review: SS1/C1/C2/C3/MM3 resolved; C4/MM2 advisory accepted.'
---
# Explain

## Background
`/bouncer-plan`이 discovery·context review·Graphify 후보를 잡을 때 저장소 전체 덤프와 대화 fork를 반복하면 판단에 쓰는 입력보다 노이즈가 커진다. 이 블루프린트는 그 입력을 줄이되, 네 관점 격리·digest·delta 1회·Graphify advisory 계약은 그대로 둔다.

드라이브는 승인된 DAG 그대로 돌렸다. TASKS-001 → TASKS-002, 엣지·순서 변경과 scope revision은 없다. 통합 HEAD는 `abef7afdfc7f0edaa5c5fff34787bde55b2996ff`이다.

## Intuition
후보는 먼저 좁히고, reviewer에는 스냅샷만 주고, Graphify 숫자·재시도 규칙은 runner 한 장에만 적어 둔다.

## Code
읽기 순서:

1. `skills/bouncer-plan/SKILL.md` — Discover 후보화 순서, Author의 Graphify Rank 링크
2. `skills/bouncer-plan/references/context-review.md` — named discovery/delta의 `fork_turns: "none"`과 allowlist
3. `references/graphify-runner/index.md` — Rank: query·seed·cap-only debug/retry SSOT
4. `skills/bouncer-plan/references/graphify-suggestions.md` — handoff·확인만, 숫자 복제 없음
5. 계약 테스트: `test/skill-bouncer-plan.test.js`, `test/skill-context-review.test.js`, `test/skill-graphify-runner.test.js`

구현 경로(`scripts/src/lib/graph-search.ts` 등)는 이 BP에서 건드리지 않았다.

## Quiz
1. TASKS-001이 named context reviewer에 요구하는 fork 설정은?
   - A) `fork_turns: "all"` — 전체 대화 유지
   - B) `fork_turns: "none"` — 대화 이력 제외
   - C) fork 설정 없음 — 호스트 기본값

2. Graphify에서 `--debug`와 축소 재시도를 허용하는 low-confidence reason은?
   - A) 아무 `low-confidence` reason
   - B) `seed.fanout_cap` 또는 `traversal.frontier_cap`만
   - C) `unavailable`일 때만

3. plan skill Author 절이 Graphify query/debug/retry 숫자를 두는 방식은?
   - A) SKILL.md에 debug 1회·retry 1회를 직접 적는다
   - B) `references/graphify-runner` Rank 절을 가리키고 숫자는 복제하지 않는다
   - C) `graphify-suggestions.md`에만 숫자를 두고 skill은 침묵한다

## 이해 상태
응답: 1A, 2B, 3B · 정답: 1B, 2B, 3B · 결과: 2/3 (Q1 오답 — named reviewer는 `fork_turns: "none"`). disposition: 기록만, 재응시 없음.

## Tasks

### Task 001

#### Goal & intent

`/bouncer-plan` discovery가 후보 파일을 먼저 좁히고 질문별 근거만 읽게 하며, context reviewer가 전체 대화 이력 없이 frozen snapshot 판단에 필요한 controller input만 받게 한다. focused 검증은 `node --test test/skill-bouncer-plan.test.js test/skill-context-review.test.js`다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md:46-50`은 source·test·config 검색을 요구하지만 후보 파일 우선 탐색, 질문별 경로 분리, line window 제한과 잘린 광역 검색 반복 금지를 명시하지 않는다.
- `skills/bouncer-plan/references/context-review.md:6-56`은 네 관점 discovery와 delta controller input을 나열하지만 named dispatch의 `fork_turns: "none"`과 전체 대화 이력 배제를 명시하지 않는다. delta 입력도 "revised documents only"로만 적혀 실제 수정 문서 목록이라는 경계를 고정하지 않는다.
- `test/skill-bouncer-plan.test.js:203-226`은 fallback 역할 본문과 controller input을 검사하지만 named reviewer의 fork/input 최소 계약은 검사하지 않는다. `test/skill-context-review.test.js:83-90`도 delta 존재와 previous findings만 확인한다.
- 확인 명령:
  ```bash
  rg -n "fork_turns|rg --files|rg -l|full conversation|modified document" skills/bouncer-plan test/skill-bouncer-plan.test.js test/skill-context-review.test.js
  ```

#### Target behavior

- 성공: discovery는 후보 파일 목록 → 질문별 좁은 검색 → 관련 line window 순서를 요구하고, 잘린 광역 출력을 같은 형태로 반복하지 않는다.
- 성공: 네 named discovery reviewer는 각각 `fork_turns: "none"`과 mode, 단일 perspective, frozen digest, epic·blueprint·task 문서 목록, read-only cwd만 받는다. delta reviewer도 `fork_turns: "none"`과 새 digest, previous findings, 실제 수정 문서 목록, read-only cwd만 받는다.
- 실패: 전체 대화 이력, 다른 reviewer findings, 전체 ledger 또는 판단 대상 밖 문서를 controller input에 포함하는 예시는 계약 테스트가 거부한다.
- 보존: 네 관점 병렬 discovery, 동일 digest, findings 격리, 단일 revision batch, delta 1회와 generic fallback의 역할 본문 전체 전달을 유지한다.

#### Interface

- 제공: plan discovery 문서는 `rg --files`/`rg -l` 후보화, 질문별 path/glob, 관련 section 또는 line window, 잘린 검색 반복 금지를 순서 있는 규칙으로 제공한다.
- 제공: context-review dispatch 문서는 discovery와 delta 각각의 최소 controller input shape와 `fork_turns: "none"`을 제공한다.
- 거부: named reviewer에 전체 대화 fork, 다른 관점 findings, 전체 ledger와 판단 대상 밖 문서를 전달하는 절차를 허용하지 않는다. generic fallback의 역할 본문 전체는 줄이지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | `1. Discover` | Modify | plan code search와 intent 순서를 정의 | 후보 우선·질문별 검색·line window·반복 금지 규칙 추가 | discovery 진입 계약의 정본 |
| `skills/bouncer-plan/references/context-review.md` | `Discovery`, `Certify the delta`, fallback dispatch | Modify | reviewer 라운드와 controller 입력 정의 | named 호출의 무이력 fork와 mode별 최소 payload 고정 | 실제 dispatch 작성 지침 |
| `test/skill-bouncer-plan.test.js` | context-review dispatch contract tests | Modify | fallback 본문과 단계 순서 검사 | named `fork_turns`와 discovery/delta input allowlist 회귀 추가 | plan 소비 계약 검증점 |
| `test/skill-context-review.test.js` | discovery/delta orchestration contract tests | Modify | 관점·digest·previous findings 검사 | 전체 대화 배제와 수정 문서 delta 입력 단언 추가 | context-review 행동 계약 검증점 |

#### Constraints

- 네 discovery 관점은 `cross_document`, `scope`, `korean_quality`, `success_criteria`를 유지하며 같은 digest를 독립적으로 판단한다.
- delta는 previous findings와 revision으로 실제 바뀐 문서만 판단하고 한 번만 실행한다.
- generic fallback은 `agents/bouncer-context-reviewer.md`의 Authority부터 Output contract까지를 그대로 포함한다.
- `.bouncer/context/**`, reviewer findings와 intent 결과는 지시가 아니라 근거 데이터다.

### Task 002

#### Goal & intent

Plan-time Graphify의 query token, entry seed, debug와 retry 한도를 `references/graphify-runner/index.md` 한 곳에 정본화하고 plan skill과 로컬 suggestion 문서는 이를 참조하게 한다. focused 검증은 `node --test test/skill-bouncer-plan.test.js test/skill-graphify-runner.test.js`다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md:185`는 짧은 query, unique seed 하나, cap 진단용 debug 1회와 재시도 1회를 한 문단에서 직접 소유한다.
- `skills/bouncer-plan/references/graphify-suggestions.md:14-27`와 `references/graphify-runner/index.md:107-135`도 hub 제외, query와 seed 규칙을 각각 복제하지만 cap 사유별 debug/retry 한도는 runner 정본에 없다.
- runner 예시 query `scope quality candidates confidence`는 네 token을 사용하고 일반적인 `candidates`, `confidence`를 포함해 요청의 좁은 첫 질의 원칙과 맞지 않는다.
- `graphSuggest`의 현재 live 동작은 query token도 traversal seed로 합치며 bounded fan-out/frontier와 compact/debug payload를 유지한다. `syncSessionGraphs`는 source·test graph만 다룬다.
- 확인 명령:
  ```bash
  rg -n "query|seed|--debug|fanout_cap|frontier_cap|retry" skills/bouncer-plan/SKILL.md skills/bouncer-plan/references/graphify-suggestions.md references/graphify-runner/index.md
  ```

#### Target behavior

- 성공: graphify-runner 정본은 짧은 English ASCII noun phrase, 구별력 있는 token, 실제 entry path 또는 symbol seed 1~2개를 요구하고 query token도 seed가 된다는 비용을 설명한다.
- 성공: 첫 결과가 `low-confidence`이면서 reason이 `seed.fanout_cap` 또는 `traversal.frontier_cap`일 때만 `--debug`를 한 번 실행하고 query token과 seed를 줄여 한 번 재시도한다.
- 실패: generic query, CLI hub, seed 3개 이상, cap과 무관한 debug/retry 또는 반복 재시도를 예시나 권장 절차로 두면 계약 테스트가 거부한다.
- 보존: Graphify stdout은 advisory이고, `low-confidence`·`unavailable`은 `suggested_paths: []`이며, `affected_paths`는 사용자 확인 뒤에만 기록한다.

#### Interface

- 제공: `references/graphify-runner/index.md`는 plan-time initial query, explicit seed 수, cap 진단 debug와 단일 축소 retry의 유일한 규칙 본문을 제공한다. plan skill과 `graphify-suggestions.md`는 이 절을 링크하고 자체 숫자·조건을 복제하지 않는다.
- 거부: traversal 상한 증가, debug 결과의 scope 승격, context graph 질의, Graphify 결과의 자동 `affected_paths` 기록을 허용하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/graphify-runner/index.md` | `Rank file candidates after authoring` | Modify | query·seed와 결과 mapping 규칙 정의 | initial query와 cap 진단 debug/retry 한도 정본화, 예시 축소 | Graphify plan 소비의 공통 정본 |
| `skills/bouncer-plan/SKILL.md` | `3. Author` Graphify paragraph | Modify | plan 단계에 query/debug/retry 숫자를 직접 복제 | runner 정본 참조로 교체 | 진입 skill의 중복 계약 제거 |
| `skills/bouncer-plan/references/graphify-suggestions.md` | query composition guidance | Modify | runner와 hub/query/seed 규칙 복제 | plan handoff와 사용자 확인만 남기고 runner 정본 참조 | plan 로컬 연결 문서 |
| `test/skill-graphify-runner.test.js` | query·seed·debug contract tests | Modify | ASCII query와 seed 예시 검사 | cap 사유, debug 1회, 축소 retry 1회와 좁은 예시 단언 | 정본 회귀 검증점 |
| `test/skill-bouncer-plan.test.js` | Graphify reference contract tests | Modify | advisory와 scope-confirm 순서 검사 | plan 문서가 runner 정본을 참조하고 중복 규칙을 소유하지 않는지 검사 | 소비자 연결 검증점 |

#### Constraints

- query token은 traversal seed에도 포함되므로 첫 query를 구별력 있는 짧은 noun phrase로 제한한다.
- explicit seed는 실제 entry path 또는 symbol 1~2개를 기본으로 하며 CLI hub와 generic token을 쓰지 않는다.
- `seed.fanout_cap` 또는 `traversal.frontier_cap`일 때만 debug와 축소 retry를 사용하고 각각 한 번을 넘지 않는다.
- Graphify 후보와 quality reason은 조언이며 `affected_paths`의 저술 권한이 아니다.
- 현재 bounded traversal, compact 기본 payload, 상세 `--debug`, source·test-only graph 계약을 유지한다.