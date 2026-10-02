---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/083-drive-context-reduction/blueprints/002-instruction-read-scope/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-02T09:01:49.525+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '083'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 879682c7c286fe3db00e0938e93381c80ef83175
      range_to: 5a4a1c6aab077fed05e52ea2393ca310fe47040d
      diff_sha: 4eced9a0d09bee84c720b99738e747557410cf421afd19eb5d39ff6b1d1f405c
      quiz_score: 2/3
      disposition: 1·3 정답. 2번은 재읽기 금지가 막는 대상이 아니라, 보존되는 inline fallback 한 번 읽기를 골랐음.
      recorded_at: '2026-10-02T09:39:00+09:00'
  task_commits:
    - task: EPIC-083/BP-002/TASK-001
      sha: 5a4a1c6a
      intent_anchor: task-001
  coordinator:
    integration_branch: feat/083-002-instruction-read-scope
    tasks:
      - id: '001'
        branch: bouncer/083-002-001
        scope_revision: null
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - .codex/agents/bouncer-debugger.toml
          - .codex/agents/bouncer-implementer.toml
          - .codex/agents/bouncer-reviewer.toml
          - CHANGELOG.md
          - agents/bouncer-coordinator.md
          - agents/bouncer-debugger.md
          - agents/bouncer-implementer.md
          - agents/bouncer-reviewer.md
          - skills/bouncer-run/SKILL.md
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
      - id: '002'
        branch: null
        scope_revision: null
        actual_paths: []
---
# Explain

## Background
coordinator가 task마다 `bouncer-execute/SKILL.md`와 자기 역할 문서를 다시 읽어 drive 문맥이 커졌다. 이 drive는 실행 절차를 세 execute 참조 경로로 붙이고, 이미 문맥에 있는 역할·payload 문서를 다시 Read하지 말라고 네 drive 역할 문서에 적었다. run 스킬 4단계의 coordinator 문서 Read 지시도 지웠다. CLI·원장·gate는 그대로다.

실행은 TASKS-001 한 커밋(`b0396acc`, 브랜치 `bouncer/083-002-001`)을 integration HEAD `5a4a1c6a`로 fan-in한 뒤, TASKS-002가 `npm run ci`를 통과해 integrated가 되었다. 스코프 개정과 repair wave는 없다. 종단 검증은 계획 문서 leftover HTML 주석을 지운 뒤 verification-retry로 다시 돌렸다.

## Intuition
실행 절차는 참조 세 파일로 가고, 이미 받은 문서는 다시 열지 않는다.

## Code
- `agents/bouncer-coordinator.md` — Drive가 `skills/bouncer-execute/references/agent-dispatch.md`, `review-round.md`, `verification-recovery.md`를 가리키고 `SKILL.md`는 세션당 한 번만 읽는다.
- `agents/bouncer-implementer.md`, `agents/bouncer-reviewer.md`, `agents/bouncer-debugger.md` — Hard guards에 재읽기 금지 한 항목.
- `.codex/agents/bouncer-{coordinator,implementer,reviewer,debugger}.toml` — 역할 문서 재생성본.
- `skills/bouncer-run/SKILL.md` — 4단계에서 coordinator 역할 문서 Read 지시 삭제. Role 절의 경로 언급은 남김.
- `test/agents.test.js`, `test/skill-bouncer-run.test.js` — 문구 계약.
- `CHANGELOG.md` — Unreleased Changed.

## Quiz
1. coordinator Drive 단계가 worker payload·리뷰 라운드·verify 복구를 안내할 때 가리키는 곳은?
   - A) `skills/bouncer-execute/SKILL.md` 전체만
   - B) `skills/bouncer-execute/references/`의 `agent-dispatch.md`, `review-round.md`, `verification-recovery.md`
   - C) `rules/subagent-model.md`와 `rules/cursor-print-dispatch.md`만

2. 네 drive 역할 문서 Hard guards의 재읽기 금지가 막는 것은?
   - A) 역할 문서를 어떤 경로에서도 처음 읽는 것
   - B) inline fallback이 역할 문서를 한 번 읽는 `rules/subagent-model.md` 4항
   - C) 이미 문맥·prompt에 있는 역할 문서와 payload가 본문을 실은 문서를 다시 Read하는 것

3. `skills/bouncer-run/SKILL.md` 4단계에서 지운 지시는?
   - A) named `bouncer-coordinator`를 한 번만 디스패치하라는 문장
   - B) `read \`agents/bouncer-coordinator.md\` for coordinator authority`
   - C) Role 절의 `agents/bouncer-coordinator.md` 경로 언급

## 이해 상태
정답: 1B, 2C, 3B. 사용자 응답: 1B, 2B, 3B. 1·3 맞음, 2 틀림. `quiz_score` 2/3. disposition: 1·3 정답. 2번은 재읽기 금지가 막는 대상이 아니라, 보존되는 inline fallback 한 번 읽기를 골랐음.

## Tasks

### EPIC-083/BP-002/TASK-001 · `5a4a1c6a`

#### Goal & intent

coordinator 역할 문서가 worker payload·리뷰 라운드·verify 복구 절차를 `skills/bouncer-execute/references/`의 세 참조로 직접 안내하고 `skills/bouncer-execute/SKILL.md`는 세션당 한 번만 읽게 하며, drive 역할 문서 네 개가 이미 문맥에 있는 역할 문서와 payload 문서를 다시 Read하지 않게 적으며, run 스킬은 coordinator 역할 문서를 읽으라고 시키지 않게 한다.
coordinator가 이미 받은 역할 문서와 `bouncer-execute/SKILL.md`를 task마다 다시 읽는 재읽기를 지침에서 막는 것이 목적이다. 수용 기준은 epic Success criteria 3·4·7이고 검증 명령은 `npm test`다.

#### Current behavior

- `agents/bouncer-coordinator.md`
  - `## Procedure` 3. Drive(:211-219)는 "run the task workflow with the returned metadata"라고만 적고 어느 문서인지 경로가 없다. 문서 어디에도 `bouncer-execute`가 나오지 않는다.
  - `## Hard guards`(:44-)와 다른 절에 "이미 문맥에 있는 문서를 다시 Read하지 않는다"는 문장이 없다.
  - `## Worker dispatch`(:110-)는 worker 디스패치를 `rules/subagent-model.md`와 `rules/cursor-print-dispatch.md`로 보낸다.
- `skills/bouncer-execute/references/agent-dispatch.md`(drive·metadata·payload), `review-round.md`(라운드 상한·mode 순서), `verification-recovery.md`(verify 실패 복구)가 이미 나뉘어 있다. `bouncer-execute/SKILL.md` 본문은 이 참조들을 가리키는 얇은 단계와 함께, drive에도 필요한 verify 증적 준비·`tasks → verified`(4단계 :170-175)와 execute gate(6단계 :216)를 담는다. 이 두 단계는 다른 참조나 coordinator 문서에 없다. drive가 쓰지 않는 Preflight·Prepare·ACQ 절도 있다.
- `agents/bouncer-implementer.md` `## Hard guards`(:45-60), `agents/bouncer-reviewer.md` `## Hard guards (read-only)`(:33-44), `agents/bouncer-debugger.md` `## Hard guards (read-only)`(:25-40)에 재읽기 금지가 없다.
- `skills/bouncer-run/SKILL.md` 4단계(:107-108): "Dispatch named `bouncer-coordinator` exactly once per `rules/subagent-model.md`; read `agents/bouncer-coordinator.md` for coordinator authority." Role 절(:32-34)에도 `agents/bouncer-coordinator.md`가 이름으로 나온다.
- `rules/subagent-model.md` 4항: named dispatch는 역할 파일을 로드하고 본문을 싣지 않는다. generic fallback은 payload에 본문을 싣고, inline pass는 역할 문서를 먼저 읽는다. print는 prompt에 본문을 싣는다(`scripts/src/lib/print-dispatch.ts` :99-100).
- 고정 테스트: `test/agents.test.js`가 `agents/*.md` 문구와 `.codex/agents/*.toml` 바이트 일치(:577, :622, :678)를 검사한다. `test/skill-bouncer-run.test.js:70`은 run 스킬에 `agents/bouncer-coordinator.md` 언급을 요구하고, :22는 4단계의 "exactly once"를 요구한다. `test/skill-bouncer-surface.test.js:120`은 진입 SKILL 단어 수 합계가 7795 미만인지 본다(현재 7681).
- 재현: `npm run build && node --test test/agents.test.js test/skill-bouncer-run.test.js test/skill-bouncer-surface.test.js`가 통과한다.

#### Target behavior

- 성공 경로
  - coordinator Drive 단계가 worker payload·리뷰 라운드·verify 실패 복구 절차로 세 참조 경로를 적고, `skills/bouncer-execute/SKILL.md`는 verify 증적·execute gate 단계 때문에 세션에서 처음 한 번만 읽고 이후 task에서 다시 읽지 않는다는 문장을 담는다.
  - 네 역할 문서의 Hard guards에 재읽기 금지 항목이 하나씩 있다. 항목은 (1) 자기 역할 문서가 named 로드·generic fallback payload·print prompt로 이미 문맥에 있으면 다시 Read하지 않는다, (2) dispatch payload가 본문을 실은 문서(task brief 등)를 다시 Read하지 않는다를 담는다.
  - run 스킬 4단계에 coordinator 역할 문서를 읽으라는 지시가 없다.
- 보존
  - inline fallback이 역할 문서를 처음 한 번 읽는 경로(`rules/subagent-model.md` 4항)는 막지 않는다.
  - coordinator가 implementer에게 `references/implementation/index.md`를 읽게 하는 요구(:122-127)는 그대로다.
  - run 스킬 4단계의 "exactly once"와 Role 절의 `agents/bouncer-coordinator.md` 언급은 남는다(blueprint 003이 다룬다).
  - 나머지 역할 문서 문구와 heading 순서.

#### Interface

- 제공
  - coordinator Drive 단계의 참조 안내 문장: `skills/bouncer-execute/references/agent-dispatch.md`, `skills/bouncer-execute/references/review-round.md`, `skills/bouncer-execute/references/verification-recovery.md` 세 경로를 백틱으로 적는다.
  - 네 역할 문서 Hard guards의 재읽기 금지 항목. 영어로, "already in your context" 또는 "already in your prompt"와 "do not Read"(또는 "never re-read")를 함께 담는다.
  - `.codex/agents/bouncer-{coordinator,implementer,reviewer,debugger}.toml` 재생성본.
- 거부
  - "Read the role document"를 무조건 막는 문장은 쓰지 않는다. 금지 대상은 "이미 문맥에 있는" 문서로 한정한다.
  - coordinator가 `skills/bouncer-execute/SKILL.md`를 세션에서 두 번 이상 읽도록 허용하는 예외 문구를 두지 않는다. 반대로 SKILL을 아예 읽지 말라는 문장도 쓰지 않는다(verify·gate 단계의 유일한 출처다).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | `## Hard guards`, `## Procedure` 3. Drive | Modify | coordinator 권한·절차 | 재읽기 금지 항목, execute 참조 세 경로와 SKILL 세션당 1회 열람 문장 | coordinator가 SKILL 전체와 자기 문서를 다시 읽은 직접 지점 |
| `agents/bouncer-implementer.md` | `## Hard guards` | Modify | implementer 금지 사항 | 재읽기 금지 항목 | 감사에서 implementer 문서(9KB)도 두 번 읽혔다 |
| `agents/bouncer-reviewer.md` | `## Hard guards (read-only)` | Modify | reviewer 금지 사항 | 재읽기 금지 항목 | 같은 payload 구조를 받는 drive 역할 |
| `agents/bouncer-debugger.md` | `## Hard guards (read-only)` | Modify | debugger 금지 사항 | 재읽기 금지 항목 | 같은 payload 구조를 받는 drive 역할 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 파일 | Modify | Codex 사본 | 재생성 | `test/agents.test.js` 바이트 일치 |
| `.codex/agents/bouncer-implementer.toml` | 생성 파일 | Modify | Codex 사본 | 재생성 | 같음 |
| `.codex/agents/bouncer-reviewer.toml` | 생성 파일 | Modify | Codex 사본 | 재생성 | 같음 |
| `.codex/agents/bouncer-debugger.toml` | 생성 파일 | Modify | Codex 사본 | 재생성 | 같음 |
| `skills/bouncer-run/SKILL.md` | 4. Coordinator dispatch | Modify | coordinator 디스패치 지시 | coordinator 문서 Read 지시 삭제 | named 디스패치가 이미 로드한 문서를 run이 다시 읽게 한다 |
| `test/agents.test.js` | 신규 test | Modify | 역할 문서 문구 계약 | 참조 경로·SKILL 세션당 1회·재읽기 금지 단언 | 새 문구를 고정한다 |
| `test/skill-bouncer-run.test.js` | 신규 단언 | Modify | run 스킬 문구 계약 | coordinator 문서 Read 지시 부재 단언 | 삭제를 고정한다 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 미출시 변경 목록 | `### Changed` 항목 | 저장소 관례 |

#### Constraints

- 역할 문서의 heading 이름과 순서를 바꾸지 않는다(`test/agents.test.js:622`).
- 역할 문서를 고친 뒤에는 반드시 해당 TOML을 재생성한다.
- 진입 SKILL 단어 수 합계를 늘리지 않는다. run 스킬은 줄이기만 한다.
- 역할 문서 문장은 기존처럼 영어로 쓴다.

### EPIC-083/BP-002/TASK-002

#### Goal & intent

task 001이 통합된 integration worktree에서 전체 CI가 통과해, 역할 문서·run 스킬 변경이 문서 형태 검사(`lint:docs`), TOML 일치, SKILL 단어 수 baseline을 깨지 않았음을 증명한다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.