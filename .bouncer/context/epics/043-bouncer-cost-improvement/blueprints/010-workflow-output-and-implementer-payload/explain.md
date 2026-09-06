---
type: bouncer.explain
title: 010 explain
description: Explain for 010
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/010-workflow-output-and-implementer-payload/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-06T10:16:19.542+09:00'
bouncer:
  id: EXPLAIN-010
  epic_id: '043'
  blueprint_id: '010'
  status: published
  comprehension:
    - range_from: refactor/010-workflow-output-and-implementer-payload
      range_to: d79c1ff91c8de94174ae7c29dfb19e5c4f70f461
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: 4/4
      disposition: 네 문항 모두 정확히 답해 워크플로 계약 변경의 핵심을 이해함.
      recorded_at: '2026-09-06T10:18:40+09:00'
  task_commits:
    - id: '001'
      sha: d2ff0c8e
    - id: '002'
      sha: 7220f119
    - id: '003'
      sha: 6afea3f9
    - id: '004'
      sha: fcc5bc76
    - id: '005'
      sha: d79c1ff9
---
# Explain

## Background
Bouncer 워크플로는 같은 출력 규칙, 에이전트 지시, gate 설명을 여러 문서에 반복해 두었다. 이 Blueprint는 공통 출력 계약을 `rules/output.md`로 모으고, named implementer에는 역할 문서가 이미 보유한 지시를 다시 보내지 않도록 입력을 줄였다. 계획 단계에서는 context 검색이 초안보다 먼저 과거 제약을 찾게 했으며, context 기여와 초안의 자체 재발견을 측정했다. 마지막으로 진입 스킬에서 상위 규칙과 CLI가 소유한 설명을 덜어내고, 테스트가 문구 대신 승인·포인터·재시도·복구 순서를 확인하게 바꿨다.

## Intuition
공통 계약은 한 곳에 두고, 각 워크플로는 그 계약을 호출하는 순서만 남긴다.

## Code
- `rules/output.md`는 compact/debug 출력과 ACQ·실패 표시 경계를 정의한다.
- `skills/bouncer-execute/SKILL.md`와 `skills/bouncer-execute/references/agent-dispatch.md`는 named implementer 입력과 fallback 가드를 나눈다.
- `references/discovery/index.md`, `references/graphify-runner/index.md`, `skills/bouncer-plan/SKILL.md`는 초안 전 context 검색과 측정 순서를 설명한다.
- `docs/graphify-context-contribution.md`와 `test/graph-search.test.js`는 context 기여·자체 재발견 지표와 고정 기준선을 기록한다.
- `skills/bouncer-init/references/init-result.md`는 초기화 결과 분기를, `skills/bouncer-run/SKILL.md`는 중단 뒤 pointer·worktree 보존과 재개 경로를 설명한다.

## Quiz
1. 여섯 워크플로의 공통 출력 표시 계약을 소유하는 경로는 무엇인가?
   - A) `references/review/assets/reviewer-prompt.md`
   - B) `rules/output.md`
   - C) `.bouncer/config.json`

2. named implementer payload를 축약할 수 있는 전제는 무엇인가?
   - A) Blueprint가 light scale임
   - B) 이전 task가 이미 커밋됨
   - C) 생성된 역할 TOML이 Markdown 원본과 동기화됨

3. context 기여 측정 task가 변경하지 않는 대상은 무엇인가?
   - A) `graph-suggest`의 점수와 confidence 알고리즘
   - B) context 검색을 초안 전으로 옮기는 절차
   - C) 고정 corpus 비교의 지표 기록

4. `/bouncer-run`이 중단될 때 보존하고 `/bouncer-execute`로 재개하도록 명시한 상태는 무엇인가?
   - A) draft PR과 Distill shard
   - B) 실패한 pointer와 execute worktree
   - C) 이전 task의 reviewer prompt

## 이해 상태
정답은 1-B, 2-C, 3-A, 4-B이며 응답도 모두 일치했다. `quiz_score`는 4/4이고, 공통 출력 계약·named payload 축약 조건·측정 범위·중단 복구 상태를 정확히 이해했다.

## Tasks

### Task 001

#### Goal & intent

여섯 진입 워크플로가 `rules/output.md` 하나로 진행·성공·실패 출력을 렌더링한다. 기본 compact 모드는 raw payload를 숨기되 사용자가 판단하거나 복구하는 데 필요한 정보는 모두 남긴다.

#### Interface

- 제공: `compact`는 단계 전 진행 한 문장, 성공 시 outcome·변경 대상·검증·다음 행동, 실패 시 code·원인·관련 경로·복구 행동을 표시한다. 사용자가 `debug`를 요청하면 실행 명령과 raw CLI payload 및 전체 검증 출력을 표시한다.
- 거부: compact라도 ACQ, 권한 요청, gate 실패, scope violation을 생략하지 않으며, 목록 제한이 이 항목들을 자르지 않는다.

#### Do not touch

- `scripts/src/**` — 이 task는 CLI 출력 스키마나 런타임 처리를 바꾸지 않는다.
- `.bouncer/config.json` — 출력 모드를 영구 설정으로 추가하지 않는다.

### Task 002

#### Goal & intent

named `bouncer-implementer`에는 cwd와 현재 task의 여섯 authority 절만 전달하고 역할 문서가 이미 소유한 지시는 반복하지 않는다. 생성 TOML이 원본과 다르거나 named agent를 쓸 수 없으면 축약하지 않는다.

#### Interface

- 제공: named payload는 Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist와 실제 worktree cwd를 담는다. generic/inline fallback payload는 Authority, Hard guards, tests-first, comments, Output contract를 추가로 담는다.
- 거부: `# bouncer-generated` TOML이 Markdown 원본과 동기화되지 않았거나 사용자 소유 TOML인 경우 중복 지시를 제거하지 않는다. implementer에게 prior commit subjects나 관련 없는 Distill shard를 전달하지 않는다.

#### Do not touch

- `agents/bouncer-implementer.md` — 역할 지시의 작성 정본이며 이번 task는 내용을 축약하지 않는다.
- `.codex/agents/bouncer-implementer.toml` — Git-ignored 생성물이며 제품 커밋에 포함하지 않는다.
- `scripts/src/lib/codex-agents.ts` — 기존 생성·사용자 소유 파일 보호 동작을 재설계하지 않는다.
- `agents/bouncer-reviewer.md` — reviewer payload와 rubric은 범위 밖이다.

### Task 003

#### Goal & intent

`/bouncer-commit`이 commit gate를 한 번만 실행하고 그 결과로 승인 여부를 묻는다. gate가 이미 요구하는 `verified`·`passed`·`accepted` 상태를 통과 뒤에 고치라는 도달 불가능한 단계는 제거한다.

#### Interface

- 제공: dry-run 또는 명시적 validate 중 하나만 권위 있는 사전 판정으로 사용하고, 성공 뒤 기존 Commit ACQ와 `bouncer commit --yes`를 수행한다.
- 거부: 열린 task/verification/review status를 commit 단계에서 임의로 닫거나, gate 실패 상태에서 ACQ 또는 commit으로 진행하지 않는다.

#### Do not touch

- `scripts/src/lib/commit-task.ts` — `bouncer commit` 내부 검증과 staging 구현은 바꾸지 않는다.
- `scripts/src/lib/validate-gates.ts` — commit gate 의미와 G-code는 바꾸지 않는다.

### Task 004

#### Goal & intent

context 검색은 스캐폴드 전에 과거 결정·선행 Blueprint·기존 제약을 찾는 discovery 입력이 된다. 현행 추천 알고리즘을 유지한 채 context의 실제 기여와 현재 draft self-hit를 source·test 기준선과 분리해 기록한다.

#### Interface

- 제공: discovery handoff의 Overlap에 스캐폴드 전 context 검색 근거를 포함한다. 고정 corpus 비교는 추가 발견 경로 수, top-k recall, 오추천 수, draft self-hit 비율을 산출하고 context 점수 정책을 유지할지 후속 변경할지 판정 기준을 남긴다.
- 거부: 이 task는 `graph-suggest`의 점수·confidence 계산을 바꾸거나 context 성공 자체를 G4 계획 품질 또는 `affected_paths` 승인으로 간주하지 않는다.

#### Do not touch

- `scripts/src/lib/graph-search.ts` — 이번 task는 점수와 confidence 알고리즘을 바꾸지 않고 현 동작을 측정한다.
- `scripts/src/lib/session-graph.ts` — 그래프 빌드 구현과 출력 위치는 바꾸지 않는다.
- `.bouncer/context/epics/**` — 현재·과거 계획 코퍼스를 측정 결과에 맞춰 소급 수정하지 않는다.

### Task 005

#### Goal & intent

진입 스킬은 자신이 소유한 실행 순서, 조건, 입력·출력, 중단 행동만 설명한다. 상위 규칙과 CLI 내부 처리는 정본을 참조하며, 테스트는 축약된 문장 대신 안전 불변조건을 고정한다.

#### Interface

- 제공: init·plan·execute·run·finalize는 조건부 reference와 공통 rules를 필요한 시점에 읽고, gate 실패를 모두 고친 뒤 재실행한다는 호출자 행동만 남긴다.
- 거부: ACQ 시점, pointer 불변조건, retry 상한, 실패 시 보존·복구 행동을 축약 대상으로 삼거나 CLI가 보장하지 않는 동작을 새로 약속하지 않는다.

#### Do not touch

- `CLAUDE.md` — 신뢰 경계와 gate 권한의 상위 정본은 변경하지 않는다.
- `rules/governance.md` — task·light 계약은 변경하지 않는다.
- `rules/okf.md` — frontmatter와 수명주기 계약은 변경하지 않는다.
- `scripts/src/**` — CLI 내부 동작은 이번 산문 축약의 대상이 아니다.