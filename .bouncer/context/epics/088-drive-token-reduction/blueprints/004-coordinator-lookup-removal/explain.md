---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/004-coordinator-lookup-removal/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-07T16:33:19.044+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '088'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: fd3065dde7f05de9477d82bf94ebd1a544506682
      range_to: 8a0bca419fda4820cf94c89eda610a72a674c9bf
      diff_sha: e8763f4c5dfd75810e92350a4fa13a63a2fafad846ea9d64026cc4fc602fa897
      recorded_at: '2026-10-07T16:40:00+09:00'
  task_commits:
    - task: EPIC-088/BP-004/TASK-001
      sha: a3835b67
      intent_anchor: task-001
    - task: EPIC-088/BP-004/TASK-002
      sha: 8a0bca41
      intent_anchor: task-002
---
# Explain

## Background

coordinator는 `tasks → verified`를 어떻게 쓰는지, print dispatch `--input`에 무엇을 넣는지, blueprint 리뷰 round의 `task_brief_hashes`·`intent_bundles`가 어디에 붙는지를 플러그인 소스에서 찾았다.

이제 execute 게이트와 `bouncer verify`가 증적 기록 뒤에 lease·pointer commit task를 `ready` → `verified`로 바꾼다. print 입력 순서는 implement·review·final_review 카드에 두고, 두 맵은 `bouncer review record --help` 예시 round 최상위에 둔다.

## Intuition

통과한 verify가 상태를 쓰고, dispatch·리뷰 형식은 카드와 `--help`가 보여 준다.

## Code

- `scripts/src/lib/verification.ts` — `runVerification(..., markTaskVerified)`, `maybeMarkCommitTaskVerified`
- `scripts/src/lib/validate.ts` · `scripts/src/lib/cli-doc-commands.ts` — execute 게이트와 `cmdVerify`만 `markTaskVerified: true`
- `references/coordinator-cards/verify.md` · `skills/bouncer-execute/SKILL.md` — worker cwd에서 `next`의 `argv`만 실행, 손 전환 없음
- `references/coordinator-cards/{implement,review,final_review}.md` — `## Print dispatch input`
- `scripts/src/lib/cli-review-command.ts` — `HELP`·`HELP_ROUND_EXAMPLE`

## Quiz

1. `ready` commit task를 `verified`로 쓰는 호출은?
   - A) coordinator의 terminal·wave `runVerification` 호출
   - B) execute 게이트와 `bouncer verify`만 (`markTaskVerified: true`)
   - C) listing fallback으로 고른 단일 task도 포함해 모든 통과 verify

2. `markTaskVerified`가 true이고 명령이 통과해도 상태를 안 바꾸는 경우는?
   - A) listing fallback이거나 `execution_kind`가 verification이거나 이미 `ready`가 아닐 때
   - B) 재사용 증적(reuse hit)일 때
   - C) lease가 가리키는 commit task가 `ready`일 때

3. Cursor print dispatch(`subagents.dispatch: "print"`)에서 coordinator가 쓰는 입력은?
   - A) `agents/*.md` 본문과 `--input`을 직접 이어 붙인 prompt
   - B) `reviewer-prompt.md`와 `review-rounds.md`를 읽어 조립한 payload
   - C) `--input` 텍스트 파일만 (`bouncer dispatch print`가 identity와 역할 본문을 앞에 붙임)

4. blueprint 리뷰(`review record --task` 생략)에서 `task_brief_hashes`와 `intent_bundles`를 두는 위치는?
   - A) round 최상위 (`target` 안이 아님)
   - B) `target` 객체 안
   - C) `findings` 배열의 각 항목

## Tasks

### EPIC-088/BP-004/TASK-001 · `a3835b67`

#### Goal & intent

execute 게이트나 `bouncer verify`가 통과하면 lease·pointer가 가리키는 commit task의 `tasks.md`가 `ready`에서 `verified`로 바뀐다. coordinator와 standalone execute는 상태를 손으로 고치지 않고, verify 카드에는 `next`의 `argv` 하나만 남는다. 1.5.5 재측정에서 v155-2 coordinator가 이 전환 방법을 찾으려고 쓴 14회의 탐색(`validate-gates.ts` 읽기 포함)을 없애는 것이 목적이다.

#### Current behavior

- `runVerification`(`scripts/src/lib/verification.ts:1193-1310`)은 verify 명령을 실행하거나 원장을 재사용하고 `verification.md` 증적만 쓴다. 결과는 재사용 hit(`:1257-1278`, 항상 `ok: true`)와 새 실행(`:1290-1309`, `ok: execution.ok`) 두 곳에서 돌아온다. `tasks.md`는 쓰지 않는다.
- task 선택은 `entriesForVerify`(`:215-254`)가 맡는다. `taskId`가 없으면 `resolveEffectiveTask`(`current.ts:636`, lease 우선)가 이 blueprint와 맞을 때 그 task를, 아니면 listing 전체를 돌려주고 `entries[0]`을 쓴다. 각 entry에 `.tasks.rel`·`.verification.rel`이 있다.
- 호출부는 넷이다.
  - execute 게이트 `validate.ts:197-201`: `runVerification({ repoRoot, blueprintDir })`. 실패·예외는 G13이 되고, 문서는 그 뒤(`~:216`)에 읽어 G6(`validate-gates.ts:1029-1032`, commit task는 `verified` 기대)을 판정한다.
  - `bouncer verify` `cli-doc-commands.ts:57-78` `cmdVerify`: 같은 인자로 부르고 JSON을 출력한다.
  - `coordinator.ts:1588-1604` `integrateVerificationTask`: verification task를 `verifying`으로 둔 채 `taskId`·`scope: { kind: 'terminal' }`로 부른다.
  - `coordinator.ts:2003-2011` `integrateCommitWave`: `taskId: lastTask`·`scope: { kind: 'wave' }`로 부른다. fan-in은 이미 `verified`를 요구한다(`:830-832`).
- 상태를 손으로 바꾸라는 문장이 두 곳에 있다: `references/coordinator-cards/verify.md:7-8`("After implementation work is complete, set `tasks → verified`…"), `skills/bouncer-execute/SKILL.md:174-175`("Set `tasks → verified` only after the implementation work is complete.").
- frontmatter 쓰기는 `readDoc`(`frontmatter.ts:32`) → `data.bouncer` 수정 → `fs.writeFileSync(file, renderDoc(data, body))` 패턴이다(`verification.ts:1077-1121`). 같은 일을 하는 `writeVerificationTaskStatus`(`coordinator.ts:812-825`)는 coordinator 안에만 있고, `coordinator.ts`가 `verification`을 require하므로 거꾸로 가져오면 순환이 된다.
- `executionKindOf`(`schema.ts:109-117`)는 필드가 없으면 `commit`을 돌려준다. tasks 상태값은 draft·ready·in_progress·verified·verifying·integrated(`schema.ts:34`).
- `task_brief_hash`는 `status`·`commit_sha`를 빼고(`task-brief-hash.ts:8`), `source_digest`는 `.bouncer/`를 뺀다(`verification.ts:799-802`). `computeDirtyDigest`(`:766-788`)는 `.bouncer`를 빼지 않는다.

#### Target behavior

- `runVerification`에 선택 인자 `markTaskVerified?: boolean`이 생긴다. `true`이고 결과가 `ok: true`(새 실행·재사용 모두)이면, 이번 실행이 고른 task가 lease·pointer로 정해진 task이고 `execution_kind`가 `commit`이며 `tasks.md` 상태가 `ready`일 때 그 `bouncer.status`를 `verified`로 쓴다. 증적 기록이 끝난 뒤에 쓴다.
- execute 게이트(`validate.ts`)와 `bouncer verify`(`cli-doc-commands.ts`)만 `markTaskVerified: true`를 넘긴다. coordinator의 두 호출은 넘기지 않아 동작이 그대로다.
- verify 실패, `ready`가 아닌 상태(이미 `verified` 포함), `execution_kind: verification`, lease·pointer로 정해지지 않은 listing fallback task는 상태를 바꾸지 않는다.
- execute 게이트는 같은 실행에서 바뀐 상태로 G6을 판정하므로, `ready`인 commit task는 게이트 한 번으로 G6·G7·G13을 함께 통과한다.
- `references/coordinator-cards/verify.md`의 첫 항목은 "`next`의 `argv`(`bouncer validate --blueprint <dir> --gate execute`)를 worker cwd에서 실행하면 verify 실행, 증적 기록, `ready` → `verified` 전환까지 끝난다. task 상태와 `verification.md`를 손으로 고치지 않는다"는 뜻으로 바뀐다. "Never hand-write" 문구와 `--gate execute`는 남긴다.
- `skills/bouncer-execute/SKILL.md` 4단계는 "`tasks → verified`를 설정하라"는 문장 대신 execute 게이트가 통과하면 CLI가 상태를 바꾼다고 적는다.

#### Interface

- 제공
  - `runVerification(opts)`의 `opts.markTaskVerified?: boolean`(기본 `false`). 반환 타입과 `entriesForVerify`의 반환 모양은 그대로다.
  - 전환 대상 판정: 새 내부 helper가 `resolveEffectiveTask({ repoRoot, deps })`(`current.ts:636`)를 직접 불러, 결과가 있고 이번 blueprint에 속하며 그 task 경로가 이번 실행 entry의 `tasks.rel`과 같을 때만 대상이다. 결과가 `null`이거나 경로가 다르면(listing fallback) 대상이 아니다.
  - `bouncer validate --gate execute`와 `bouncer verify`: 통과 시 위 조건의 `tasks.md` 상태 전환. stdout JSON과 종료 코드는 그대로다.
- 거부
  - 조건에 맞지 않으면 아무것도 쓰지 않는다(오류 아님).
  - `tasks.md`를 읽거나 쓰다 예외가 나면 verify 증적은 남긴 채 그 예외를 던진다. execute 게이트에서는 기존 catch가 G13으로 보고한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/verification.ts` | `runVerification`, 새 내부 helper | Modify | verify 실행·증적 기록 | `markTaskVerified` 인자와 commit task `ready` → `verified` 전환 helper 추가 | `:1193-1310`, `:215-254` |
| `scripts/src/lib/validate.ts` | execute 게이트 | Modify | 게이트 전에 verify 실행 | `markTaskVerified: true` 전달 | `:197-201` |
| `scripts/src/lib/cli-doc-commands.ts` | `cmdVerify` | Modify | `bouncer verify` 실행 | `markTaskVerified: true` 전달 | `:57-78` |
| `references/coordinator-cards/verify.md` | 첫 항목 | Modify | 상태 손 전환 지시 | `argv` 실행으로 전환까지 끝난다고 적음 | `:7-8` |
| `skills/bouncer-execute/SKILL.md` | 4단계 | Modify | 상태 손 전환 지시 | 게이트가 전환한다고 적음 | `:174-175` |
| `test/verification-runner.test.js` | 새 테스트 | Modify | runner 동작 | 전환·no-op 조건 | `writeUnitTasks :598`, `leaseVerifyFixture :1679`, reuse `:1149` |
| `test/cli-verify.test.js` | 새 테스트 | Modify | verify CLI·execute 게이트 | `ready` fixture로 전환과 게이트 한 번 통과 | `setupRepo :32-70`(현재 `verified`로 씀) |
| `test/cli-validate.test.js` | lease execute 게이트 테스트 | Modify | lease 대상이 TASKS-002임을 `ok: false`로 증명 | `ready` 묶음이 이제 verify 통과 시 `verified`로 바뀌므로, 실패 근거를 G6 대신 다른 미완 문서로 두거나 전환 결과(tasks/002만 `verified`, tasks/001 그대로)로 증명 | `:647-668` |
| `test/validate-gates.test.js` | execute 게이트 테스트 | Modify | execute 게이트 G6·G7·G8 판정 | 통과 verify + `ready`로 G6을 기대하는 fixture가 있으면 전환 결과에 맞게 고침 | `:1985-2042` |
| `test/skill-bouncer-execute.test.js` | 새 단언 | Modify | execute 스킬 문구 | "tasks → verified" 지시 없음 | `skill-bouncer-commit.test.js:68` 패턴 |
| `test/agents.test.js` | verify 카드 단언 | Modify | verify 카드 문구 | 손 전환 지시 없음, `--gate execute`·"Never hand-write" 유지 | `:851-857` |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Changed 항목 | epic 기준 6 |

#### Constraints

- 바꾸는 함수에는 `references/implementation/index.md`의 한국어 docstring 계약(Summary, 인자마다 Args, Returns)을 지킨다.
- 상태 쓰기는 증적 기록 뒤에 한다. 그래서 다음 verify는 `dirty_digest`가 달라져 재사용을 놓치고 명령을 다시 실행한다. 지금의 손 전환과 같은 결과라 받아들인다.
- 상태 쓰기는 `verification.ts` 안의 helper로 하고 `coordinator.ts`를 import하지 않는다(순환 방지).
- 테스트는 `scripts/lib`를 import하므로 `npm run build` 뒤에 실행한다.

### EPIC-088/BP-004/TASK-002 · `8a0bca41`

#### Goal & intent

Cursor print dispatch로 도는 coordinator가 implementer·reviewer 입력 파일을 만들고 blueprint 리뷰 round를 기록할 때, `coordinate next`가 준 카드와 `bouncer review record --help`만 보면 되게 한다. 1.5.5 재측정에서 이 형식을 찾으려고 `print-dispatch.ts`, `agents/bouncer-reviewer.md`, `reviewer-prompt.md`, `review-rounds.md`, `review-record.js`를 읽은 탐색(실행당 9~14회)을 없애는 것이 목적이다.

#### Current behavior

- 세 카드 모두 Cursor print dispatch, `bouncer dispatch print`, `--input` 형식을 언급하지 않는다.
- `references/coordinator-cards/implement.md:66-81`과 `review.md:41-48`은 fallback payload가 "`agents/bouncer-<role>.md` 본문 전체를 그대로" 싣는다고 적는다. print dispatch에서는 이 문장 때문에 coordinator가 역할 문서를 읽는다.
- 실제로는 `assemblePrintPrompt`(`scripts/src/lib/print-dispatch.ts:89-100`)가 identity 줄 + 역할 본문(frontmatter 제거, `:213-215`에서 직접 읽음) + `--input` bytes를 이어 붙인다. `rules/cursor-print-dispatch.md:17-27`도 "controller input 파일만 쓰고 직접 조립하지 않는다"고 적는다.
- `final_review.md:30-31`은 reviewer payload를 "모든 commit task brief와 blueprint Contract"로만 적는다. round 키(`task_brief_hashes`, `intent_bundles`)는 `:36-38`에 있다.
- implementer가 받는 항목(`agents/bouncer-implementer.md:14-42`, `implement.md:55-65`): brief 8개 섹션(Goal & intent, Current behavior, Target behavior, Interface, Touch, Do not touch, Constraints, Checklist; 두 behavior 섹션은 없으면 뺌), `task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`, `intent_sections`, drive에서는 `attempt`, `base_head`, `initial_worktree_state`, 있으면 `previous_outcome { outcome, summary }`.
- reviewer가 받는 항목(`references/review/assets/reviewer-prompt.md:21-48` 순서): Mode, Perspective, Strategy, Risk flags(delta는 뒤 셋 비움), Target(base, head, brief revision, `task_brief_hash`/`task_brief_hashes`, `intent_bundle_id`/`intent_bundles`, `intent_bundle_revision`, latest verify), Brief(per-task 여섯 섹션, blueprint 모드는 모든 commit brief와 blueprint Contract), Intent sections, Constraints, delta일 때 previous findings·resolution·revision diff.
- `bouncer review record --help`의 예시(`scripts/src/lib/cli-review-command.ts:26-53` `HELP_ROUND_EXAMPLE`)는 per-task discovery round 하나라 `task_brief_hashes`·`intent_bundles`가 없다. 두 필드는 `scripts/src`에서 검증하지 않고 그대로 복사된다(`review-record.ts:247`). 문서상 모양은 `task_brief_hashes: { "TASKS-001": "<hash>" }`, `intent_bundles: { "TASKS-001": { "id": "...", "revision": 1 } }`(`references/spec-authoring/review-rounds.md:55-59, 73-77`).
- 카드는 `coordinate-next.ts:126-156`이 그대로 응답에 싣는다. 카드 파일에는 doc lint 규칙이 없다(`scripts/check-doc-shape.js ~:700`).

#### Target behavior

- `implement.md`, `review.md`, `final_review.md`에 `## Print dispatch input` 섹션이 생긴다. 내용은 다음과 같다.
  - `.bouncer/config.json`이 `subagents.provider: "cursor"`·`subagents.dispatch: "print"`일 때 적용된다.
  - `bouncer dispatch print`가 identity 줄과 역할 본문을 앞에 붙이므로 `agents/*.md`, `reviewer-prompt.md`, `review-rounds.md`를 읽지 않는다. coordinator는 `--input` 텍스트 파일만 쓴다. cwd는 `--cwd`로 넘긴다.
  - 입력 파일 템플릿을 항목 순서대로 보인다. implement는 drive 메타데이터(`attempt`, `task_brief_hash`, `base_head`, `initial_worktree_state`, 있으면 `previous_outcome`) → bundle 식별자(`intent_bundle_id`, `intent_bundle_revision`) → `intent_sections` → brief 섹션 → "**Brief revision**으로 `attempt`와 `task_brief_hash`를 돌려준다" 순서다. review·final_review는 reviewer-prompt 순서(Mode, Perspective, Strategy, Risk flags, Target, Brief, Intent sections, Constraints, delta 입력)를 따른다. final_review는 Brief에 모든 commit task brief와 blueprint Contract를 싣는다.
- 기존 named·generic fallback 문장(역할 본문 전체를 싣는 규칙)은 print가 아닌 host를 위해 그대로 둔다.
- `bouncer review record --help` 예시 round에 `task_brief_hashes`와 `intent_bundles`가 `round` 최상위 키(`target` 안이 아님, `review-rounds.md:55-59`와 같은 위치)로 TASKS id 키를 써서 들어가고, 한 줄 설명이 blueprint 리뷰 모드(`--task` 생략)에서 이 두 필드를 싣는다고 알린다. 예시는 여전히 첫 번째 ```json 펜스 하나이고 validator를 통과한다.

#### Interface

- 제공
  - 카드 세 개의 `## Print dispatch input` 섹션(텍스트). `coordinate next` 응답의 `card.body`로 나간다.
  - `bouncer review record --help` 출력의 round 예시와 설명 한 줄.
- 거부
  - 새 CLI 플래그나 응답 필드는 없다. `review record`의 검증 규칙은 그대로다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/coordinator-cards/implement.md` | 새 섹션 | Modify | implement 행동 계약 | `## Print dispatch input` 템플릿 | `:55-81` |
| `references/coordinator-cards/review.md` | 새 섹션 | Modify | per-task 리뷰 계약 | 같은 섹션, reviewer 입력 템플릿 | `:41-48` |
| `references/coordinator-cards/final_review.md` | 새 섹션 | Modify | blueprint 리뷰 계약 | 같은 섹션, 모든 brief와 Contract | `:30-38` |
| `scripts/src/lib/cli-review-command.ts` | `HELP_ROUND_EXAMPLE`, `HELP` | Modify | `review record --help` | 두 필드 예시와 설명 한 줄 | `:26-74` |
| `test/review-record.test.js` | help 예시 테스트 | Modify | 예시 기록 검증 | 두 필드 모양 단언 | `:308-317`, `makeBlueprintRepo :57` |
| `test/coordinate-next.test.js` | 카드 테스트 | Modify | 카드 개수·공유 규칙 | 세 카드의 섹션·`bouncer dispatch print`·`--input`·역할 문서 읽지 않음 문장·템플릿 항목 순서 단언 | `:899-1000` |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Changed 항목 | epic 기준 6 |

#### Constraints

- 카드 본문은 `coordinate next` 응답마다 coordinator 문맥에 실리므로 섹션당 20줄 안쪽으로 쓴다. 줄은 약 78자에서 감싼다.
- 기존 카드 테스트(`coordinate-next.test.js` `SHARED_RULES` `:910-940`과 `:942-1000`, `agents.test.js:235-256`, `coordinator.test.js:1395-1418`)가 계속 통과해야 한다. 카드에서 `skills/bouncer-execute/SKILL.md` 경로를 인용하지 않는다.
- `HELP_ROUND_EXAMPLE`은 `cli-review-command.ts:24-25` 주석대로 validator를 통과하는 ```json 펜스 하나로 둔다.
- 바꾸는 TS 함수·상수에는 한국어 docstring 계약을 지킨다. 테스트는 `npm run build` 뒤에 실행한다.