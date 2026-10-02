---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/083-drive-context-reduction/blueprints/003-wave-session-split/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-02T11:15:19.878+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '083'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: 9e8f61a4673dc611f08f7798117fe2a72431d373
      range_to: 637d2e0129b3be2984d3d7445135ea5b83f3b5f9
      diff_sha: fc14927f9e55fe70568fbc6c66297f01960256b00470162142e1e36e31dca7b5
      quiz_score: 0/4
      disposition: 4문항 모두 오답. 정답은 1-C(001→003, 002는 003 의존), 2-A(286909a8 / bouncer/083-003-001), 3-C(rules/output.md), 4-B(npm run ci exit 0).
      recorded_at: '2026-10-02T11:20:00+09:00'
  task_commits:
    - task: EPIC-083/BP-003/TASK-001
      sha: 20ad7083
      intent_anchor: task-001
    - task: EPIC-083/BP-003/TASK-003
      sha: 637d2e01
      intent_anchor: task-003
  coordinator:
    integration_branch: feat/083-003-wave-session-split
    tasks:
      - id: '001'
        branch: bouncer/083-003-001
        scope_revision: null
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - CHANGELOG.md
          - agents/bouncer-coordinator.md
          - rules/output.md
          - skills/bouncer-run/SKILL.md
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
          - test/skill-output-contract.test.js
      - id: '002'
        branch: null
        scope_revision: null
        actual_paths: []
      - id: '003'
        branch: bouncer/083-003-003
        scope_revision: r1
        actual_paths:
          - .codex/agents/bouncer-coordinator.toml
          - agents/bouncer-coordinator.md
          - skills/bouncer-run/SKILL.md
          - test/agents.test.js
          - test/skill-bouncer-run.test.js
---
# Explain

## Background
한 coordinator 세션이 blueprint 전체를 붙잡고 문맥이 커지는 문제를 줄이려는 drive다. coordinator는 연 ready wave를 통합한 뒤 남은 task가 있으면 `continue`로 돌아오고, `/bouncer-run`이 새 checkpoint로 다음 세션을 띄운다.

실행은 TASKS-001을 worker 브랜치 `bouncer/083-003-001` SHA `286909a8`에서 받아 integration HEAD로 fan-in했다. 계획 DAG는 `001 → 002`였다. blueprint 최종 리뷰 must_fix F1–F4로 repair wave 1이 TASKS-003을 넣었고 DAG는 `001 → 003`, `002`가 `003`에 의존하도록 바뀌었다(`revision` r1). TASKS-003 worker는 `bouncer/083-003-003` SHA `824c58b9`다. 종단 TASKS-002는 `npm run ci` exit 0으로 integrated가 되었다. integration HEAD는 `637d2e0129b3be2984d3d7445135ea5b83f3b5f9`다.

## Intuition
wave를 닫으면 coordinator가 돌아가고, 남은 task는 다음 세션이 이어 받는다.

## Code
- `agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml` — wave를 닫은 뒤 `continue` 반환. 001과 003이 둘 다 고침. 003은 F1–F4(continue 루프 대기, 디스패치 직전 `completed_tasks` 기준, no-progress 한 줄, 부분 wave는 Drive/Judge에 남김).
- `skills/bouncer-run/SKILL.md` — `continue`면 새 checkpoint로 coordinator를 다시 띄운다. 001·003 공통.
- `rules/output.md`, `test/skill-output-contract.test.js` — 001만. compact `continue` 렌더.
- `test/skill-bouncer-run.test.js`, `test/agents.test.js` — 001과 003.
- `CHANGELOG.md` — 001만.

001 초기 `paths`는 비어 있었고 `actualPaths`가 위 여덟 파일이다. 003은 repair `nextScope`와 `actualPaths`가 같고 `CHANGELOG.md`·`rules/output.md`는 없다.

## Quiz
1. repair wave 1 이후 DAG는?
   - A) `001 ∥ 002` 다음에 `003`
   - B) `001 → 002` 유지, `003`은 `002`와 무관
   - C) `001 → 003`, `002`는 `003`에 의존

2. TASKS-001 worker SHA와 브랜치는?
   - A) `286909a8` / `bouncer/083-003-001`
   - B) `824c58b9` / `bouncer/083-003-003`
   - C) `637d2e01` / `feat/083-003-wave-session-split`

3. TASKS-003 `actualPaths`에 없는 파일은?
   - A) `skills/bouncer-run/SKILL.md`
   - B) `agents/bouncer-coordinator.md`
   - C) `rules/output.md`

4. TASKS-002 종단 검증은?
   - A) `npm test` reused만
   - B) `npm run ci` exit 0
   - C) `npm run ci` 실패로 `verifying` 유지

## 이해 상태
퀴즈 4문항, 응답 B/C/B/C, 정답 C/A/C/B, 점수 0/4.
disposition: 4문항 모두 오답. DAG는 `001 → 003`이고 `002`는 `003`에 의존한다. TASKS-001 worker는 `286909a8` / `bouncer/083-003-001`이다. TASKS-003 `actualPaths`에 `rules/output.md`는 없다. TASKS-002는 `npm run ci` exit 0이다.
range `9e8f61a4..637d2e01`, `diff_sha` `fc14927f…`.

## Tasks

### EPIC-083/BP-003/TASK-001 · `20ad7083`

#### Goal & intent

coordinator가 자기가 연 ready wave를 모두 통합한 뒤 남은 task가 있으면 outcome `continue`로 돌아오고, `/bouncer-run`이 진전을 확인한 뒤 새 checkpoint로 다음 coordinator를 띄우게 지침을 바꾼다.
한 coordinator 세션이 blueprint 전체를 끌고 가며 문맥이 계속 커지는 구조를 wave 경계에서 끊는 것이 목적이다. 수용 기준은 epic Success criteria 5·6·7이고 검증 명령은 `npm test`다.

#### Current behavior

- 기준 상태: 이 task는 blueprint 002가 통합된 트리에서 실행한다. 아래 줄 번호와 단어 수는 계획 시점(002 이전) 값이라 몇 줄 밀릴 수 있다. 절 제목과 인용 문장으로 찾는다.
- `agents/bouncer-coordinator.md`
  - 도입부(:12): "return progress plus a single terminal outcome".
  - `## Hard guards`(:56): "Do not dispatch another coordinator — one coordinator per drive, no nesting."
  - `## Procedure` 4. Integrate(:235-245) 뒤 5. Judge, 6. Close(:250-264)로 이어지며, Close는 "return your terminal outcome so the root run can hand the rest back"(:263)으로 끝난다. 그리고 모든 task가 integrated될 때까지 같은 세션이 prepare→drive→integrate를 반복한다. wave 경계에서 돌아오는 경로가 없다.
  - `## Output contract`(:266-): **Outcome**은 "exactly one of `completed`, `blocked`, or `partial_closed`"(:272).
  - 1. Ground(:192-205)는 이미 `coordinate status` checkpoint에서 재개한다("Resume from recorded state; never reset it").
- `skills/bouncer-run/SKILL.md`
  - Role 절(:24-27): "dispatches `bouncer-coordinator` once".
  - 2단계 ACQ(:86-90): "Whether to hand the remaining tasks to one coordinator", "delegating now closes the blueprint in one flow".
  - 4단계(:107-140): "Dispatch named `bouncer-coordinator` exactly once ... either way it happens once". `coordinate status`를 한 번 받아 payload를 만들고, terminal outcome까지 foreground로 기다린다. blueprint 002가 끝나면 이 단계의 coordinator 문서 Read 지시는 이미 지워져 있다.
  - 5단계(:142-153): `completed`·`blocked`·`partial_closed`만 렌더링한다.
- `rules/output.md:34`: "terminal outcome은 `completed`, `blocked`, `partial_closed` 중 하나만 표시한다."
- 고정 테스트
  - `test/skill-bouncer-run.test.js:22`: 4단계에 `named \`bouncer-coordinator\``, `exactly once`, `rules/subagent-model.md`, generic fallback 문구를 요구한다. :168은 foreground 대기 문구, :176은 print 프로세스 문구를 요구한다.
  - `test/agents.test.js` 'bouncer-coordinator names its closing action'은 `/6\. \*\*Close\*\*/`로 Close 단계를 찾는다. :381: `/(?:do not|never)[\s\S]{0,80}another coordinator|one coordinator per drive/i`. :505-507: Outcome 줄이 `/completed.*blocked.*partial_closed/i`와 `/exactly one/i`에 맞아야 한다.
  - `test/skill-bouncer-surface.test.js:120`: 진입 SKILL 단어 수 합계 < 7795(계획 시점 7681).
  - `test/skill-output-contract.test.js`는 `rules/output.md`의 terminal outcome 줄을 고정한다.
- 재현: `npm run build && node --test test/skill-bouncer-run.test.js test/agents.test.js test/skill-bouncer-surface.test.js test/skill-output-contract.test.js`가 통과한다.

#### Target behavior

- 성공 경로
  - coordinator: 4. Integrate 단계 끝에 wave 경계 문단을 더한다(단계 번호는 그대로, Close는 6번 유지). Integrate가 이번 세션이 prepare로 연 task를 모두 `integrated`로 만든 뒤 `coordinate status`를 받는다. `active_tasks`가 비어 있지 않으면 prepare를 다시 하지 않고 outcome `continue`를 반환한다. 비어 있으면 Close로 간다.
  - `continue` 보고: Progress 줄, 이번 세션에서 integrated된 task id, `checkpoint.ledger` ref(path·sha256·revision).
  - run 4단계: coordinator를 한 번에 하나만 디스패치하고 outcome까지 foreground로 기다린다. `continue`면 `coordinate status`를 다시 받아 `checkpoint.completed_tasks.length`를 디스패치 직전 값과 비교한다. 늘었으면 같은 payload에 새 checkpoint를 넣어 새 coordinator를 디스패치한다.
  - run 5단계: `continue`는 terminal이 아니므로 5단계로 가지 않는다. `interactive`이면 세션마다 `rules/output.md`의 `continue` 줄을 낸다. 그 줄의 남은 task 수는 run이 다시 받은 checkpoint의 `active_tasks.length`다.
- 실패 경로
  - `continue`인데 `completed_tasks` 수가 늘지 않았으면 새 coordinator를 띄우지 않고 `blocked`로 보고한다. 원인은 `no-progress`이고 원장·worktree·pointer를 보존한다.
  - 이번 wave 일부만 integrated이면 coordinator는 `continue`하지 않는다.
- 보존
  - coordinator가 다른 coordinator를 디스패치하지 않는다(no nesting).
  - start ACQ는 drive 전체에 한 번이다. `continue` 뒤 재디스패치는 ACQ를 열지 않는다.
  - foreground 대기, print 프로세스 디스패치, payload 구성(raw 원장·완료 task 문서·과거 대화 미첨부), closing action과 finalize 동의 단계.
  - `blocked`·`partial_closed` 보고 형식.

#### Interface

- 제공
  - coordinator Output contract **Outcome**: "exactly one of `continue`, `completed`, `blocked`, or `partial_closed`"와 `continue`가 non-terminal이라는 문장. **Continue** 항목: 반환 필드(Progress, integrated task id, `checkpoint.ledger` ref).
  - coordinator `## Procedure` 4. Integrate 끝의 wave 경계 문단. 새 번호 단계를 만들지 않는다.
  - coordinator 도입부(:12)와 Close(:263)의 "terminal outcome" 문장: `continue`(non-terminal) 또는 terminal outcome 하나를 돌려준다는 뜻으로 고친다.
  - coordinator Hard guards의 nesting 금지 문장: 다른 coordinator를 디스패치하지 않고, 다음 세션은 root run이 `continue` 뒤에 띄운다.
  - run 4단계의 한 번에 하나 디스패치·`continue` 재디스패치·`no-progress` 중지 문장.
  - `rules/output.md`: `continue` 렌더링 한 줄 형식 `계속: <blueprint> · 통합 <이번 세션 task id 목록> · 남은 task <N>`(N = run이 다시 받은 checkpoint의 `active_tasks.length`)과 terminal outcome 목록에 `continue`가 들어가지 않는다는 문장. run이 직접 내는 no-progress 중단은 기존 중단 줄의 `<task id>` 자리에 blueprint를 쓴다: `중단: <blueprint> · no-progress · 보존: <ledger·worktree 경로> · 복구: <행동>`.
- 거부
  - coordinator는 `continue`를 반환할 때 prepare·dispatch·integrate를 더 하지 않는다.
  - run은 coordinator가 실행 중일 때 다른 coordinator를 띄우지 않는다. `continue`가 아닌 outcome에서 재디스패치하지 않는다.
  - run은 `continue`를 받아도 원장을 직접 읽거나 고치지 않고 `coordinate status`만 부른다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | 도입부 terminal outcome 문장, `## Hard guards` nesting 줄, `## Procedure` 4. Integrate 끝 문단·6. Close 마지막 문장, `## Output contract` Outcome | Modify | 한 세션이 blueprint 전체를 끝까지 drive | wave 경계 `continue` 반환 조건과 보고 필드, nesting 문장 정정 | 세션 경계를 정하는 계약의 정본 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 파일 | Modify | Codex 사본 | 재생성 | `test/agents.test.js` 바이트 일치 |
| `skills/bouncer-run/SKILL.md` | Role 절, 2단계 ACQ Re-ground·Recommend-why, 4. Coordinator dispatch, 5. Report | Modify | coordinator 한 번 디스패치 후 terminal outcome 렌더링 | 한 번에 하나 디스패치, `continue` 재디스패치와 `no-progress` 중지 | 루프를 소유할 controller |
| `rules/output.md` | coordinator 출력 목록 | Modify | 진행·완료·중단 형식과 terminal outcome 목록 | `continue` 한 줄 형식 | run이 `continue`를 렌더링할 형식 |
| `test/skill-bouncer-run.test.js` | `run dispatches exactly one coordinator after start approval`(:22) | Modify | "exactly once" 문구 고정 | 한 번에 하나·`continue` 재디스패치·`no-progress` 문구 고정으로 교체 | 바뀐 계약을 고정 |
| `test/skill-output-contract.test.js` | 'output contract renders coordinator progress and one terminal outcome'(:53) | Modify | 진행·완료·중단 형식과 terminal outcome 줄 고정 | `계속:` 형식과 no-progress 중단 형식 단언 추가 | `rules/output.md` 변경을 고정할 기존 테스트 |
| `test/agents.test.js` | :381 nesting 단언, :505-507 Outcome 단언 | Modify | 세 outcome과 nesting 문구 고정 | `continue` 포함 네 outcome과 wave 경계 조건 단언 | 바뀐 계약을 고정 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 미출시 변경 목록 | `### Changed` 항목 | 저장소 관례 |

#### Constraints

- 진입 SKILL 단어 수 합계를 baseline 7795 미만으로 유지한다. run 스킬은 기존 "exactly once"·"one flow" 문장을 대체하는 방식으로 쓰고, 이 task 시작 시점(blueprint 002 통합 뒤) 대비 순증가를 80단어 이내로 둔다.
- `test/skill-bouncer-run.test.js` :168(foreground)·:176(print 프로세스) 단언이 맞는 문구는 그대로 둔다.
- 역할 문서 heading 이름과 순서를 바꾸지 않는다(`test/agents.test.js:622`).
- 역할 문서·스킬 문장은 영어, `rules/output.md` 렌더링 형식은 기존처럼 한국어다.

### EPIC-083/BP-003/TASK-002

#### Goal & intent

task 001이 통합된 integration worktree에서 전체 CI가 통과해, coordinator·run 계약 변경이 문서 형태 검사, TOML 일치, SKILL 단어 수 baseline, 다른 문서 계약 테스트를 깨지 않았음을 증명한다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-083/BP-003/TASK-003 · `637d2e01`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `skills/bouncer-run/SKILL.md` — 기록된 CI 실패를 복구한다.
- Modify `agents/bouncer-coordinator.md` — 기록된 CI 실패를 복구한다.
- Modify `.codex/agents/bouncer-coordinator.toml` — 기록된 CI 실패를 복구한다.
- Modify `test/skill-bouncer-run.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/agents.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.