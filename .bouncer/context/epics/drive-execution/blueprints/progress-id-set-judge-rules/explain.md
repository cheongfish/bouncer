---
type: bouncer.explain
title: progress-id-set-judge-rules explain
description: Explain for progress-id-set-judge-rules
resource: .bouncer/context/epics/drive-execution/blueprints/progress-id-set-judge-rules/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-28T16:04:07.065+09:00'
bouncer:
  id: EXPLAIN-progress-id-set-judge-rules
  epic_id: drive-execution
  blueprint_id: progress-id-set-judge-rules
  status: published
  comprehension:
    - range_from: bd0a9c0119a5982a07ecf1cf672225c939e38163
      range_to: b7ce55c9a926fa060f05af8c2f00711cd78eb8cf
      diff_sha: c1acc0b189d24e96b6f80012ff8ee304c44ef8aeab655afba34be18df86f0894
      recorded_at: '2026-10-28T16:05:55.672+09:00'
  task_commits:
    - task: drive-execution/progress-id-set-judge-rules/001
      sha: 44fb85d1
      intent_anchor: task-001
    - task: drive-execution/progress-id-set-judge-rules/002
      sha: b7ce55c9
      intent_anchor: task-002
---
# Explain

## Background

`/bouncer-run`은 coordinator가 `continue`로 돌아올 때마다 `completed_tasks` 개수가 늘었는지로 진행 여부를 판단했다. 그런데 verification 실패 뒤 `--resume-task`로 이미 통합된 task가 다시 열리면, 한 task가 새로 통합되는 동안 다른 task가 빠져 개수가 그대로일 수 있다. 이 경우 정상 진행인데도 `no-progress`로 멈췄다(#287).

같은 드라이브에서 coordinator가 rework 요약에 식별자(mode, code, field 이름)를 기억에 의존해 적거나, brief의 금지 조항을 깬 편차를 Open choice로 받아들이면서 rework가 연쇄로 이어졌다(#283). implementer도 provider나 env에 따라 출력이 달라지는 테스트를 단언 완화로 통과시키려는 경향이 있었다. 이 변경은 두 문제를 규칙으로 막는다.

## Code

- `skills/bouncer-run/SKILL.md` step 4: 기준선을 디스패치 직전 `completed_tasks`의 id 집합으로 잡는다. 집합에 기준선에 없는 id가 있으면 개수가 같아도 진행으로 보고 새 coordinator를 디스패치한다. 없으면 기존처럼 recovery 재디스패치 한 번 뒤 `no-progress`로 멈춘다. 상태 표의 행과 stop cause 이름은 그대로다.
- `agents/bouncer-coordinator.md` (judge 단계): rework 요약에 식별자를 쓸 때는 report·card·CLI 출력에서 복사한다. brief의 금지 조항(Do not touch 경로, Constraint, 기존 단언 변경 금지)을 깨는 편차는 Open choice로 수락하지 않고 rework나 `blocked`로 기록한다. 이미 깨진 금지는 `revise` 카드보다 이 규칙이 앞서며, `--release-do-not-touch`는 사용자가 명시적으로 승인한 뒤에만 쓴다.
- `agents/bouncer-implementer.md` (red/green 단계): provider나 env에 따라 기대 출력이 달라지면 fixture에서 provider와 env를 고정하고 정확한 단언을 유지한다. 단언을 느슨하게 바꾸지 않는다.
- `.codex/agents/bouncer-coordinator.toml`, `.codex/agents/bouncer-implementer.toml`: 위 두 역할 문서에서 `mdToCodexToml`로 다시 생성한 결과다. 손으로 고치지 않는다.
- `test/skill-bouncer-run.test.js`, `test/agents.test.js`: 새 규칙 문구를 단언하는 테스트를 추가했다. 기존 단언은 바꾸지 않았다.

한계: 세 규칙은 모두 역할 문서의 문장이라 모델이 따르는지는 테스트가 아니라 이후 드라이브 관찰로 확인해야 한다. CLI 코드는 바뀌지 않았다.

## Quiz

1. `/bouncer-run`이 coordinator `continue`를 받았다. 디스패치 직전 `completed_tasks`는 {001, 002}였고, 지금은 {001, 003}이다(002는 `--resume-task`로 다시 열림). 개수는 둘 다 2다. 어떻게 처리하는가?
   - A) 개수가 같으므로 `no-progress`로 멈춘다.
   - B) 기준선에 없는 003이 있으므로 진행으로 보고 새 coordinator를 디스패치한다.
   - C) recovery 재디스패치를 한 번만 하고 그 뒤 멈춘다.
2. coordinator가 rework 요약에 어떤 모드의 이름을 적어야 한다. 규칙에 맞는 방법은?
   - A) 확실히 기억하면 기억대로 적는다.
   - B) 비슷한 이름이면 Open choice로 남긴다.
   - C) report, card, CLI 출력에서 그대로 복사한다.
3. worker가 brief의 Do not touch 경로를 이미 수정했고, 그 편차를 Open choice로 받아달라고 한다. coordinator가 따르는 규칙은?
   - A) rework로 기록하고, 복구가 안 되면 `blocked`로 기록한다. `--release-do-not-touch`는 사용자가 명시적으로 승인한 뒤에만 쓴다.
   - B) 변경이 작으면 Open choice로 수락한다.
   - C) `revise` 카드에 따라 곧바로 `--release-do-not-touch`로 풀어 준다.
4. 테스트의 기대 출력이 provider나 env에 따라 달라진다. implementer는 어떻게 해야 하는가?
   - A) 단언을 느슨하게 바꿔 어느 환경에서도 통과하게 한다.
   - B) fixture에서 provider와 env를 고정하고 정확한 단언을 유지한다.
   - C) 그 테스트를 건너뛰고 보고에 적는다.

## Tasks

### drive-execution/progress-id-set-judge-rules/001 · `44fb85d1`

#### Goal & intent

bouncer-run step 4가 디스패치 직전 `checkpoint.completed_tasks`의 id 집합을 baseline으로 잡고, 그 집합에 없던 id가 하나라도 생기면 진행으로 판별하게 한다. 개수가 같아도(`--resume-task`로 task가 다시 열린 경우) 진행으로 본다. 수용 기준은 epic Success criteria 17의 run step 4 부분이고, 검증 명령은 `node --test test/skill-bouncer-run.test.js`다.

#### Current behavior

- 입력: coordinator가 `continue`를 반환하면 root가 `coordinate status --write-input`으로 새 checkpoint를 받는다.
- 상태: `skills/bouncer-run/SKILL.md:188`이 "`completed_tasks.length` immediately before this dispatch"를 baseline으로 정한다. `skills/bouncer-run/SKILL.md:215`는 "If `completed_tasks.length` grew"일 때 새 coordinator를 디스패치하고, `:218`은 "If it did not grow"일 때 `no-progress`로 멈춘다.
- 출력: #287에서 `--resume-task 002`로 002가 다시 열리고 005가 통합되자 `completed_tasks`가 001·002·003에서 001·003·005로 바뀌었다. 개수 3이 그대로라 이 규칙으로는 정상 진행이 `no-progress`로 읽힌다.
- 불일치: 같은 step의 표 `skills/bouncer-run/SKILL.md:208`은 "new integrated task"(새로 통합된 task)를 진행 조건으로 쓰는데, 본문 `:215`는 개수 증가를 조건으로 써서 둘이 다르다.
- I/O 관찰 지점: 해당 없음: 문서 규칙만 바꾸고 process·file·module state를 다루지 않는다.
- 재현: `rg -n "completed_tasks.length" skills/bouncer-run/SKILL.md` → 188·215 두 줄. `node --test test/skill-bouncer-run.test.js`는 현재 통과하며, step 4 baseline 문구를 단언하는 테스트는 없다(`rg -n "completed_tasks|no-progress" test/skill-bouncer-run.test.js` 결과 없음).

#### Target behavior

- 성공: step 4 본문이 baseline을 "the set of `completed_tasks` ids immediately before this dispatch"로 정하고, "an id missing from the baseline"이 생기면 새 coordinator를 디스패치한다. 개수가 같아도 새 id가 있으면 진행이라는 문장이 있다.
- 실패: 새 id가 없으면(id 집합이 같거나 hash만 바뀜) 지금처럼 `blocked` cause `no-progress`로 멈춘다.
- 보존: recovery re-dispatch 1회 예외, 두 번째 `continue`에 새 id가 없으면 `no-progress`, `completed`·`blocked`·`partial_closed`에서 재디스패치하지 않는 규칙, 표의 행·열 구조는 그대로 둔다.
- 판단 근거: `skills/bouncer-run/SKILL.md` 안에 `completed_tasks.length`가 남지 않는다. 아래 Checklist의 새 테스트가 통과한다.

#### Interface

- 제공: run step 4의 진행 판별 규칙 = "디스패치 직전 `completed_tasks` id 집합(baseline)에 없던 id가 현재 `completed_tasks`에 하나 이상 있음". 예: baseline `{TASKS-001, TASKS-002, TASKS-003}`, 현재 `{TASKS-001, TASKS-003, TASKS-005}` → `TASKS-005`가 새 id이므로 진행.
- 거부: baseline에 없던 id가 하나도 없는 checkpoint(id 집합 동일, 또는 id가 빠지기만 함)는 진행이 아니며 `no-progress`로 멈춘다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/SKILL.md` | step 4 baseline·재디스패치 문장 | Modify | `completed_tasks.length` 증가로 진행을 판별 | baseline을 id 집합으로, 조건을 "baseline에 없던 id"로 바꿈 | `skills/bouncer-run/SKILL.md:188`, `:215`, `:218`; 표 `:208`과 맞춤. 제목·단계 구조는 doc-shape 계약(`packages/cli/src/doc-shape-contracts.ts:46` workflow)이 고정하므로 문장만 교체한다 |
| `test/skill-bouncer-run.test.js` | step 4 진행 판별 단언 | Modify | step 4 baseline 문구 단언 없음 | id 집합 baseline 단언과 `completed_tasks.length` 부재 단언 추가 | 기존 `readRunSkill` 헬퍼 `test/skill-bouncer-run.test.js:43` 재사용 |

#### Constraints

- step 4의 표 행·열과 stop cause 이름(`no-progress`, `worker-state-unknown`, `worker-report-missing`)을 바꾸지 않는다.
- `test/subagents.test.js:668`이 같은 SKILL의 "When named agents are unavailable" 문단을 단언하므로 그 문단은 건드리지 않는다.
- 기존 테스트의 단언을 바꾸거나 약화하지 않는다. 새 테스트만 추가한다.
- 영어 본문을 유지한다(SKILL 본문은 영어).

### drive-execution/progress-id-set-judge-rules/002 · `b7ce55c9`

#### Goal & intent

coordinator 역할 문서 Judge 단계에 두 규칙을 넣는다. (1) rework 요약에 쓰는 식별자(모드·코드·필드 이름)는 report·card·CLI 출력 원문에서 복사하고 기억으로 쓰지 않는다. (2) brief의 금지 항목(Do not touch, Constraints, 기존 단언 변경 금지)을 어긴 편차는 Open choice로 수락하지 않고 rework로 돌리거나, rework로 복원할 수 없으면 `blocked`로 올린다. worker가 이미 어긴 금지 항목에 대해서는 이 규칙이 `revise` 카드보다 우선한다. coordinator는 사용자가 명시적으로 승인한 경우에만 그 항목을 `--release-do-not-touch`로 푼다. `report` 카드가 `scope_revision`을 허용하는 대상은 Contract 조건을 좁힌 Open choice(Contract 불일치)뿐이고, 이 규칙의 대상은 brief 금지 항목 위반이라 둘은 겹치지 않는다. implementer 역할 문서 Tests first 단계에는 출력이 provider·env에 따라 달라지면 단언을 약화하지 말고 provider·env를 고정한 fixture로 정확 단언을 유지하라는 규칙을 넣는다. 두 생성본 TOML을 재생성한다. 수용 기준은 epic Success criteria 17의 역할 문서 부분이고, 검증 명령은 `node --test test/agents.test.js`다.

#### Current behavior

- 입력: coordinator는 Judge(`agents/bouncer-coordinator.md:310`)에서 `judge`·`blocked` 응답마다 판정 하나를 기록한다. implementer는 Tests first(`agents/bouncer-implementer.md:111`)에서 "do not weaken assertions to force a pass"(`:115`)만 안내받는다.
- 상태: coordinator 문서에 식별자 복사 규칙과 금지 위반 편차 처리 규칙이 없다(`rg -n -i "verbatim|from memory|Open choice" agents/bouncer-coordinator.md` 결과 없음). implementer 문서에 provider·env fixture 안내가 없다(`rg -n -i "fixture|provider" agents/bouncer-implementer.md` 결과 없음).
- 출력: #283에서 005 attempt 2의 rework 요약이 mode를 `normal`로 적어(실제 `discovery`) attempt 3이 더 필요했다. 003 worker는 env에 따라 마지막 줄이 달라지는 fixture 때문에 기존 `deepStrictEqual` 두 곳을 `slice(0, 2)`로 약화했고, coordinator가 이를 편차로 수락했다. 최종 리뷰 F1(must_fix)이 잡았고 008이 복원했다.
- 생성본: `.codex/agents/bouncer-coordinator.toml`·`.codex/agents/bouncer-implementer.toml`은 `mdToCodexToml(<md>)`와 바이트 단위로 같아야 한다(`test/agents.test.js:56`).
- I/O 관찰 지점: 해당 없음: 문서와 그 생성본만 바꾸고 process·module state를 다루지 않는다.
- 재현: `npm run build` 뒤 `node --test test/agents.test.js`는 현재 통과한다. 새 규칙을 단언하는 테스트는 없다.

#### Target behavior

- 성공: coordinator Judge 단계 문단에 식별자 복사 규칙과 금지 위반 편차 규칙이 있고, implementer Tests first 단계에 provider·env 고정 fixture 규칙이 있다. 두 TOML이 새 md에서 재생성되어 parity 테스트가 통과한다.
- 실패: 해당 없음: 런타임 동작 변경이 없다. 판단 근거는 아래 Checklist 테스트와 parity 테스트다.
- 보존: 두 문서의 제목 골격(Authority → Hard guards → 절차 → Output contract, `scripts/check-doc-shape.js`가 검사)과 단계 번호, 기존 문장은 그대로 둔다. Worker dispatch 본문 20줄 상한(`test/agents.test.js:110`)이 걸린 절은 건드리지 않는다.

#### Interface

- 제공: coordinator Judge 규칙 두 문장, implementer Tests first 규칙 한 문장, 재생성된 TOML 두 개. 금지 항목(brief prohibition)은 task brief의 Do not touch 경로, Constraints 항목, 기존 단언 변경 금지 문장을 말한다. 예: Constraints "기존 단언을 바꾸지 않는다"를 어기고 `deepStrictEqual`을 `slice(0, 2)` 비교로 바꾼 편차.
- 거부: 금지 항목을 어긴 편차를 Open choice로 수락하는 판정. 그 편차는 `rework` 판정이 되고, rework로 복원할 수 없으면 `blocked`가 된다. worker가 이미 어긴 Do not touch 항목이나 Constraint를 사용자의 명시적 승인 없이 `coordinate revise --release-do-not-touch`(`references/coordinator-cards/revise.md:17-20`)로 풀어 수락하는 판정도 거부한다. 이 경우에 한해 이 규칙이 `revise` 카드의 "Judge each entry, then rerun with `--release-do-not-touch`" 지시보다 우선한다. 사용자가 명시적으로 해제를 승인하면(AGENTS.md hard rule 3) 기존 카드 절차대로 푼다. 계획된 범위 확장(worker가 어기기 전에 coordinator가 판단하는 revise)은 이 규칙의 대상이 아니다. `references/coordinator-cards/report.md:37-41`의 Contract 불일치 규칙(`rework` 또는 `scope_revision`, never `accepted`)은 Contract 조건을 좁힌 Open choice가 대상이라 이 규칙과 충돌하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | Procedure step 5 `Judge` | Modify | `judge`·`blocked` 응답마다 판정 하나를 기록 | 식별자 복사·금지 위반 편차 규칙 두 문장 추가 | `agents/bouncer-coordinator.md:310-315`(Judge는 `card`를 따름); 같은 판정을 다루는 관련 문서 `references/coordinator-cards/report.md:37-41`(Contract 불일치 Open choice → `rework`/`scope_revision`, never `accepted`)와 대상이 다름(카드는 Contract 불일치, 이 규칙은 brief 금지 항목 위반)을 확인했고, `revise.md:17-20`의 해제 지시와는 "이미 어긴 항목은 사용자 승인 뒤에만 해제"라는 우선 문장으로 경계를 정함, 두 카드 자체는 Do not touch; 제목 계약 `packages/cli/src/doc-shape-contracts.ts:55` |
| `agents/bouncer-implementer.md` | Procedure step 5 `Tests first` | Modify | 단언 약화 금지만 안내 | provider·env 고정 fixture로 정확 단언 유지 문장 추가 | `agents/bouncer-implementer.md:111-121`; 제목 계약 `packages/cli/src/doc-shape-contracts.ts:49` |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 본문 | Modify | coordinator md의 Codex 생성본 | 새 md에서 재생성 | parity `test/agents.test.js:56` |
| `.codex/agents/bouncer-implementer.toml` | 생성본 본문 | Modify | implementer md의 Codex 생성본 | 새 md에서 재생성 | parity `test/agents.test.js:56` |
| `test/agents.test.js` | 새 규칙 단언 | Modify | 새 규칙 단언 없음 | coordinator 두 규칙·implementer 한 규칙 단언 추가 | 기존 `agentsDir` 읽기 패턴 `test/agents.test.js:384` |

#### Constraints

- 역할 문서 본문과 제목은 영어로 쓴다(`test/agents.test.js:45`가 한글 제목을 거절한다). 새 제목은 만들지 않는다.
- 기존 테스트 단언(`test/agents.test.js:383` untrailered 경로, `test/cli-help.test.js:362` `--help` 문장, `test/salvage-report-docs.test.js:13`)을 바꾸거나 약화하지 않는다.
- TOML은 손으로 고치지 않고 `mdToCodexToml` 출력으로만 쓴다.
- `.codex/agents/`의 다른 다섯 TOML은 바꾸지 않는다.

### drive-execution/progress-id-set-judge-rules/003

#### Goal & intent

TASKS-001·TASKS-002가 모두 통합된 뒤 `npm run ci`를 한 번 실행해, run step 4 문구·역할 문서 규칙·TOML parity·doc-shape lint·전체 테스트가 함께 통과함을 증명한다(epic Success criteria 8·17).

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.