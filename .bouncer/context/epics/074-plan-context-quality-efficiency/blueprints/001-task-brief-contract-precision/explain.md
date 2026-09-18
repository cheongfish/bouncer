---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/074-plan-context-quality-efficiency/blueprints/001-task-brief-contract-precision/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-18T11:27:19.350+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '074'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: eab113ab7034105e84a9194a582dbff1fed26561
      diff_sha: 23611aa3a40666e02b7db14ca0d41936987f20c733a02920a460c9caa8b43aca
      quiz_score: 3/3
      disposition: all correct — proceed to remainder
      recorded_at: '2026-09-18T11:30:11+09:00'
  task_commits:
    - task: EPIC-074/BP-001/TASK-001
      sha: e38df51f
      intent_anchor: task-001
    - task: EPIC-074/BP-001/TASK-002
      sha: ca9fd640
      intent_anchor: task-002
  coordinator:
    base: 166db0dc2be57d453ff8bfe7643f5b2b54f2102e
    integration_head: eab113ab7034105e84a9194a582dbff1fed26561
    integration_branch: feat/074-001-task-brief-contract-precision
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/074/001/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: e38df51f3bd9d729c218fef4211d54fd746a2b0a
        branch: bouncer/074-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - references/spec-authoring/index.md
          - references/spec-authoring/tasks.md
          - test/skill-spec-authoring.test.js
      - id: '002'
        status: integrated
        sha: ca9fd640be4e597453dceb01dda5946890b22cb2
        branch: bouncer/074-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-context-reviewer.toml
          - agents/bouncer-context-reviewer.md
          - test/agents.test.js
    decisions:
      - task: '001'
        decision: 'Accepted TASKS-001: implementer added seven spec-authoring rules + example + contract tests within affected_paths (references/spec-authoring/index.md, references/spec-authoring/tasks.md, test/skill-spec-authoring.test.js). Discovery review: one advisory EXTRA-001 on coordinator-synced plan indexes (accepted, not staged). Verify npm test exit 0. Worker SHA recorded.'
      - task: '002'
        decision: 'Accepted TASKS-002 after F1 must_fix repair: Cross-document throw/miss finding Checklist-independent; TOML regenerated; agents/bouncer-context-reviewer.md, .codex/agents/bouncer-context-reviewer.toml, test/agents.test.js. Delta certified F1 resolved.'
---
# Explain

## Background
구현자가 task brief에 없는 테스트 seam·실패 분류·기대 red를 스스로 설계하면, 계획
승인이 구현 단계로 설계를 미룬다. 이 Blueprint는 기존 8개 절 안에서 작성 규칙을
늘리고, context reviewer가 Checklist–Interface 불일치를 finding으로 잡게 했다.

Drive는 `parallel_safe` 두 commit task(001→002 순서로 구동)를 통합했다. DAG와
`depends_on`은 계획과 동일했고, scope revision은 없었다. `actual_paths`는 각
task의 초기 `affected_paths`와 같았다.

## Intuition
규칙을 문서에 박고, 같은 계약을 reviewer rubric이 승인 전에 다시 본다.

## Code
- `references/spec-authoring/index.md` — tasks 항목에 seam·throw/miss·`file:line`·
  기대 red·staging·`bouncer.verify` 규칙 7개
- `references/spec-authoring/tasks.md` — 위 규칙을 따르는 예시
- `test/skill-spec-authoring.test.js` — 규칙·예시 계약 테스트
- `agents/bouncer-context-reviewer.md` — `cross_document`·`success_criteria` finding
  조건 확장(throw/miss는 Checklist when-clause와 분리)
- `.codex/agents/bouncer-context-reviewer.toml` — worktree `mdToCodexToml()` 재생성
- `test/agents.test.js` — rubric 문구 단언

Provenance: TASK-001 worker `bouncer/074-001-001` @ `e38df51f` → integration;
TASK-002 worker `bouncer/074-001-002` @ `ca9fd640` → integration head
`eab113ab`. 구현·리뷰는 named `bouncer-implementer` / `bouncer-reviewer`.

## Quiz
1. TASKS-001이 `references/spec-authoring/index.md` tasks 항목에 추가한 규칙과
   가장 가까운 설명은?
   - A) plan gate(G/S)에 `주입` 키워드 lint를 넣고 Interface를 검사한다
   - B) Checklist가 call count·I/O 부재·주입 오류를 단언할 때만 Interface가
     injection parameter 이름·shape를 정의하고, throw와 cache miss/fallback은
     separate lists로 쓰며, red에는 expected failing assertion을 적는다
   - C) light task에도 항상 injection seam과 Context/Done 절을 새로 만든다

2. TASKS-002 Cross-document의 throw/cache-miss finding은 어디에 묶여야 하는가?
   - A) Checklist when-clause와 무관한 별도 조건(`in one list` 혼합)
   - B) Checklist가 call count 등을 단언할 때만 적용되는 when-clause 안
   - C) `success_criteria` 관점의 red-step 검사로만 다룬다

3. Codex TOML(`.codex/agents/bouncer-context-reviewer.toml`)은 어떻게 갱신했는가?
   - A) PATH의 `bouncer init --seed-codex-agents`로 설치 cache에서 일괄 재생성
   - B) TOML을 손으로 편집해 byte를 맞췄다
   - C) worktree에서 `mdToCodexToml()`로 agent 문서만 변환해 해당 TOML만 기록

## 이해 상태
- Q1: 정답 B · 응답 B · 맞음
- Q2: 정답 A · 응답 A · 맞음
- Q3: 정답 C · 응답 C · 맞음
- quiz_score: 3/3 · disposition: all correct — proceed to remainder
- range: develop..eab113ab · recorded_at: 2026-09-18T11:30:11+09:00

## Tasks

### Task 001

#### Goal & intent

`references/spec-authoring/index.md` tasks 항목에 테스트 seam, throw/miss 분리, I/O coupling 관찰 지점, 도메인 용어 정의, 기대 red, staging 순서, focused 명령과 `bouncer.verify` 구분 규칙을 추가하고, `references/spec-authoring/tasks.md` 예시가 그 규칙을 따르게 한다. 완료 판정은 `test/skill-spec-authoring.test.js`의 새 계약 테스트와 `npm test` 통과다.

#### Current behavior

- `references/spec-authoring/index.md:92` **Interface** 규칙은 "제공과 거부를 함께 적는다"만 요구한다. 주입 dependency의 이름·shape, throw와 cache miss·fallback의 분리는 요구하지 않는다.
- `references/spec-authoring/index.md:84` **Current behavior** 규칙은 입력·상태·출력과 재현 경로를 요구하지만 process spawn·파일 I/O·module state 같은 테스트 가능성 결정 지점을 `file:line`으로 적으라는 요구가 없다.
- `references/spec-authoring/index.md:120` **Checklist** 규칙은 "failing test → confirm it fails → implement" 순서만 요구한다. 기대 red 사유가 없어 `Cannot find module` 같은 module 로드 실패도 red로 인정된다. 생성물 검사의 staging 순서와 focused 명령·`bouncer.verify` 역할 구분도 없다.
- `scripts/check-emit.js:58-72`는 `scripts/lib` 아래 untracked 파일이 있으면 실패한다. 신규 `scripts/lib/*.js` 생성물은 `git add` 뒤에야 `npm run check:emit`을 통과한다.
- `references/spec-authoring/tasks.md:45-47` 예시 Interface는 제공/거부 두 줄만 두고, 키 부재·`0`일 때 무제한 대기로 돌아가는 fallback은 Target behavior(`:43`)와 Constraints(`:62`)에만 있다. Interface만 읽으면 throw 조건과 fallback 조건을 구분할 수 없다. `:65-73` Checklist red 단계에는 기대 실패 사유가 없다.
- 재현: `node --test test/skill-spec-authoring.test.js`는 현재 통과하며 위 규칙을 단언하는 테스트는 없다.

#### Target behavior

- 성공: tasks 항목에 아래 Interface의 규칙 문장이 있고, 예시 tasks.md가 그 규칙(throw/fallback 분리, `file:line` 관찰 지점, 기대 red)을 따른다. 새 계약 테스트가 통과한다.
- 실패: 규칙 문장 하나라도 빠지면 새 계약 테스트가 해당 regex로 실패한다.
- 보존: 8개 절 이름·순서, light 3개 절 규칙, 기존 `test/skill-spec-authoring.test.js` 단언(특히 `spec-authoring tasks item carries eight-section rules and full-return signals`의 `full4` regex)이 그대로 통과한다. 새 절(`Context`, `Done`)은 생기지 않는다.

#### Interface

- 제공 — tasks 항목 Section-specific rules에 추가하는 영어 규칙 7개. 기존 불릿과 같은 `- **<절>** (<주제>): ...` 형식으로 쓰고, 백틱 안 영어 어구를 문장에 그대로 넣는다(나머지 표현은 구현자가 정한다):
  1. **Interface** (test seam): Checklist가 `call count`, `absence of I/O`, `injected error`를 단언하면 Interface가 `injection parameter`의 이름과 `shape`를 정의한다. 예시 하나를 함께 둔다: `deps.runGit(args: string[]) → { stdout: string }`.
  2. **Interface** (throw vs miss): 즉시 `throw`하는 입력 오류와 `cache miss` 또는 `fallback`으로 처리하는 상태를 `separate lists`로 쓴다.
  3. **Current behavior** (I/O coupling): 테스트 가능성을 결정하는 `direct process spawn`, `file I/O`, `module state`를 `` `file:line` `` 관찰 지점으로 기록한다.
  4. **Domain terms**: 거부 규칙에 쓰는 `domain term`은 그 용어를 쓰는 절(Interface 등) 안에서 `shape` 하나와 `example` 하나로 정의한다.
  5. **Checklist** (expected red): red 단계는 `expected failing assertion` 또는 failure point를 적는다. brief가 요구하지 않는 한 `module-load failure`는 기대 red가 아니다.
  6. **Checklist** (generated artifacts): 생성물 검사가 staging을 전제로 하면 `npm run build` → `git add <generated path>` → `npm run check:emit` 순서를 적는다. 규칙에 `` `git add` is allowed `` 와 commit·push·branch 금지 유지를 함께 쓴다.
  7. **Checklist** (focused vs verify): focused test와 `check:emit`은 구현 중 검사이고, 최종 완료 명령은 `bouncer.verify`(부재 시 `config.verify`)이며 `execute gate`가 증적을 기록한다.
- 제공 — 예시 `references/spec-authoring/tasks.md`: Current behavior에 `runVerify`의 spawn 대기 지점을 `file:line`으로 적고, Interface를 `거부(throw)`와 `fallback` 목록으로 나눠 키 부재·`0` 무제한 대기를 fallback 목록에 두며, Checklist red 단계에 기대 실패 assertion을 적는다.
- 거부:
  - 새 절 heading(`## Context`, `## Done`) 추가.
  - seam 규칙을 무조건 요구로 쓰는 것. 규칙은 Checklist가 call count·I/O 부재·주입 오류를 단언할 때만 적용된다.
  - `주입`·`runner`·`deps` 같은 문자열을 검사하는 gate나 lint 추가.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/spec-authoring/index.md` | `- **tasks**` Section-specific rules | Modify | 8개 절 작성 규칙 | Interface·Current behavior·Domain terms·Checklist 규칙 7개 추가 | 성공 기준 1~3의 정본 위치 |
| `references/spec-authoring/tasks.md` | `## Current behavior`, `## Interface`, `## Checklist` | Modify | tasks 완성 예시 | 새 규칙을 따르도록 세 절 수정 | 작성자가 읽는 예시가 규칙과 모순되지 않게 함 |
| `test/skill-spec-authoring.test.js` | 신규 추출 지점: seam·throw/miss·red·staging 계약 테스트 | Modify | spec-authoring 문서 계약 테스트 | 새 규칙과 예시를 단언하는 테스트 추가 | 규칙 삭제를 회귀로 잡음 |

#### Constraints

- 규칙 본문은 주변 불릿처럼 영어로 쓴다(한국어 예시 문자열·기존 한국어 불릿 제외).
- 기존 테스트의 slice 경계(`- **tasks**` ~ `- **verification / review**`) 안에 규칙을 넣는다.
- 예시 tasks.md의 frontmatter와 8개 절 heading 순서는 바꾸지 않는다.

### Task 002

#### Goal & intent

`agents/bouncer-context-reviewer.md` rubric이 Checklist가 검사하는 seam을 Interface가 정의하지 않은 경우, Interface가 throw와 cache miss·fallback을 한 목록에 섞은 경우, Checklist red 단계에 기대 실패가 없는 경우를 finding 조건으로 명시하게 한다. 완료 판정은 `test/agents.test.js`의 새 단언과 TOML byte 비교, `npm test` 통과다.

#### Current behavior

- `agents/bouncer-context-reviewer.md:76-85` `cross_document`는 epic → blueprint → tasks 사이 목표·범위 모순과 Mermaid zoom만 예로 든다. 한 task 안의 Checklist와 Interface 불일치는 예시에 없다.
- `agents/bouncer-context-reviewer.md:100-105` `success_criteria`는 epic 성공 기준과 blueprint 수용 기준의 판정 가능성만 본다. Checklist red 단계의 기대 실패 누락은 대상이 아니다.
- `.codex/agents/bouncer-context-reviewer.toml`은 `scripts/lib/codex-agents.js`의 `mdToCodexToml()` 생성물이며, `test/agents.test.js`(`bouncer-context-reviewer judges one perspective and certifies deltas with origin`)가 agent 문서 변환 결과와 byte 단위로 비교한다.
- PATH의 `bouncer`는 설치된 plugin cache(`~/.codex/plugins/cache/chunjae-tools/bouncer/1.4.8/scripts/bouncer`)를 가리킨다. `bouncer init --seed-codex-agents`는 그 cache의 `agents/`를 원본으로 삼고(`scripts/src/lib/codex-agents.ts:26-27` `pluginAgentsDir`) 다섯 TOML을 모두 다시 쓰며, `--no-graphify`가 없으면 Graphify 설치 단계도 실행한다. 이 경로로는 worktree에서 고친 agent 문서가 TOML에 반영되지 않는다.
- 재현: `node --test test/agents.test.js`는 현재 통과하며 새 판정 조건을 단언하는 테스트는 없다.

#### Target behavior

- 성공: `cross_document` 절에 seam 불일치와 throw/miss 혼합이, `success_criteria` 절에 기대 red 누락이 finding 조건으로 있다. TOML이 새 agent 문서와 byte 일치한다.
- 실패: 조건 문장이 빠지거나 TOML을 갱신하지 않으면 `test/agents.test.js`가 실패한다.
- 보존: 네 관점 이름(`cross_document`, `scope`, `korean_quality`, `success_criteria`), Discovery·Delta 규칙, Calibration, Output contract, Out of judgment는 바뀌지 않는다. 두 관점의 범위 문장은 새 조건을 포함하도록 넓히기만 하고 기존 판정 대상을 빼지 않는다. `references/context-review/index.md`에 scope 판정 문장을 복사하지 않는다(기존 `doesNotMatch` 유지).

#### Interface

- 제공 — `### Cross-document contradiction`:
  - 범위 문장을 넓힌다. 문서 사이(epic → blueprint → tasks)뿐 아니라 `inside one task document` Checklist와 Interface 사이의 불일치도 이 관점이 판정한다.
  - 다음 두 경우를 finding 조건으로 추가한다(영어, 백틱 어구를 그대로 포함):
    - Checklist가 `call count`, `absence of I/O`, `injected error`를 단언하는데 Interface가 `does not define` the `injection parameter` 이름·shape.
    - Interface가 `throw`하는 입력 오류와 `cache miss` 또는 `fallback` 상태를 `in one list`로 섞음.
- 제공 — `### Verifiability of success criteria`:
  - 범위 문장을 넓혀 `task Checklist red steps`도 판정 대상에 넣는다.
  - finding 조건: `red step`이 `expected failing assertion` 또는 failure point를 적지 않음.
- 제공 — `.codex/agents/bouncer-context-reviewer.toml`: 수정한 worktree agent 문서를 `mdToCodexToml()`로 변환한 결과.
- 거부:
  - 다섯 번째 관점 또는 새 `category` 값 추가.
  - Checklist가 call count·I/O 부재·주입 오류를 단언하지 않는 task에 seam finding을 요구하는 문장.
  - TOML 수동 편집, 또는 PATH `bouncer init`으로 설치 cache에서 재생성한 TOML.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-context-reviewer.md` | `### Cross-document contradiction`, `### Verifiability of success criteria` | Modify | 네 관점 rubric | seam·throw/miss·기대 red finding 조건 추가 | 성공 기준 4의 정본 위치 |
| `.codex/agents/bouncer-context-reviewer.toml` | `mdToCodexToml()` 생성물 | Modify | Codex named reviewer 역할 본문 | agent 문서 변경을 재생성 | TOML byte 비교 테스트 |
| `test/agents.test.js` | `context-review covers the four judgment scopes` | Modify | reviewer rubric 계약 테스트 | 새 조건 단언 추가 | 조건 삭제를 회귀로 잡음 |

#### Constraints

- 네 관점 이름과 G18이 받는 perspectives 값을 바꾸지 않는다.
- 추가 문장은 주변 rubric처럼 영어로 쓴다.
- TOML은 아래 Checklist의 worktree 로컬 `mdToCodexToml()` 호출로만 갱신한다. PATH의 `bouncer init`은 쓰지 않는다.