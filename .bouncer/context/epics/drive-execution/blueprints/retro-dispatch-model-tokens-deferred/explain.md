---
type: bouncer.explain
title: retro-dispatch-model-tokens-deferred explain
description: Explain for retro-dispatch-model-tokens-deferred
resource: .bouncer/context/epics/drive-execution/blueprints/retro-dispatch-model-tokens-deferred/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-29T23:16:06.881+09:00'
bouncer:
  id: EXPLAIN-retro-dispatch-model-tokens-deferred
  epic_id: drive-execution
  blueprint_id: retro-dispatch-model-tokens-deferred
  status: published
  comprehension:
    - range_from: 7151d2172706462eb9d0a05fd0e46028f387b9d0
      range_to: 52a0c6df4d9c450cff39e07cdc349e2e403580aa
      diff_sha: eeb44347e243359bb66c0d7fda61ae4fa8470b02aaa799cb182f7905858a0e64
      recorded_at: '2026-10-29T23:16:53.069+09:00'
  task_commits:
    - task: drive-execution/retro-dispatch-model-tokens-deferred/001
      sha: 922e1b33
      intent_anchor: task-001
    - task: drive-execution/retro-dispatch-model-tokens-deferred/002
      sha: f95dafe6
      intent_anchor: task-002
    - task: drive-execution/retro-dispatch-model-tokens-deferred/003
      sha: 5a95d7d6
      intent_anchor: task-003
    - task: drive-execution/retro-dispatch-model-tokens-deferred/004
      sha: b731f986
      intent_anchor: task-004
    - task: drive-execution/retro-dispatch-model-tokens-deferred/005
      sha: a5231b44
      intent_anchor: task-005
    - task: drive-execution/retro-dispatch-model-tokens-deferred/006
      sha: 0721ba87
      intent_anchor: task-006
    - task: drive-execution/retro-dispatch-model-tokens-deferred/008
      sha: 52a0c6df
      intent_anchor: task-008
---
# Explain

## Background

직전 drive 회고에서 네 가지 마찰이 나왔다.

- 구현자 worker가 설정한 모델이 아니라 호스트 기본 모델을 상속해 돌았다.
- brief 방식 blueprint 최종 리뷰는 discovery 한 번과 delta 한 번만 허용하는데, delta에서 새로 나온 경미한 must_fix를 이연 기록할 길이 없어 사용자 수용(accept-risk)이나 blocked로만 닫혀야 했다.
- 계획 문서의 체크리스트에 테스트 단계로 도달할 수 없는 항목이 섞여 있어도 계획 리뷰가 걸러내지 못했다.
- worker가 끝났는데 토큰 사용량이 원장에 남지 않아도 다음 기록과 진행이 그대로 이어졌다.

이 변경은 앞의 두 가지를 문서 규칙과 리뷰 기록 검증으로, 마지막 두 가지를 계획 리뷰 기준과 CLI 거절로 막는다.

## Code

- **디스패치 모델 전달** — `skills/bouncer-run/SKILL.md` step 4, `skills/bouncer-run/references/agent-dispatch.md`, `references/coordinator-cards/dispatch.md`에 "구현자 디스패치에도 `subagent-model` 해석값을 그대로 넘긴다"는 문장이 추가됐다. 문장은 테스트가 정확한 부분 문자열로 찾으므로 표현을 바꾸면 `test/skill-bouncer-run.test.js`도 고쳐야 한다.
- **delta 이연** — `packages/cli/src/validate-sections.ts`의 `isBriefDeltaDeferred`가 판정 기준이다. 이연이 인정되려면 `deferred` 상태, 비어 있지 않은 note, severity가 minor 또는 nit, 그리고 first_seen_round와 last_seen_round가 모두 그 delta 라운드이며 이전 라운드에서 이어 온 id가 아니어야 한다. `packages/cli/src/review-record.ts`의 `mergeFindings`는 brief 범위에서 저장된 finding의 `first_seen_round` 변경을 `review-input-invalid`로 거절해, discovery 위반을 delta에서 다시 적어 이연하는 우회를 막는다. 기록(record)과 게이트(G21)는 같은 헬퍼 하나를 쓴다. delta가 이미 저장된 뒤에는 `final-review-single-round`로 거절하고, 남은 finding은 `review accept-risk`나 blocked로 닫는다.
- **계획 리뷰의 체크리스트 판정** — `agents/bouncer-context-reviewer.md`와 `.codex/agents/bouncer-context-reviewer.toml`에 체크리스트 각 항목이 해당 테스트 단계로 도달 가능한지 보라는 기준이 추가됐다.
- **작업자 토큰 기록 강제** — `packages/cli/src/drive-metrics.ts`의 `pendingWorkerTokenKeys`는 `(task, role, perspective)` 키마다 worker-model 수와 채움 수를 세어 `runs > filled`인 키를 미충족으로 낸다. 숫자 tokens 기록과 `worker-tokens --tokens unreported` 기록이 모두 채움으로 센다. `unreported`는 호스트가 값을 주지 않았다는 사실을 남기되 `tokens` 키는 쓰지 않아, 합계가 그 키를 0으로 읽지 않는다. `packages/cli/src/coordinator-commands.ts`의 `workerTokensGuard`는 `coordinate record --task T`에서 T의 키를, `coordinate advance --task T`에서 T의 키와 task 없는 키를, `--task` 없는 `coordinate advance`에서는 task 없는 키만 본다. 미충족이 있으면 `coordinate advance`는 어떤 자동 행동도 실행하기 전에 `worker-tokens-missing`으로 거절한다. `coordinate-advance.ts`는 순환 의존을 피하려고 이 가드를 호출 시점에만 지연 로드한다.

## Quiz

1. brief 방식 blueprint 최종 리뷰에서 delta 라운드 기록으로 `deferred` 이연이 인정되는 finding은?
   - A) discovery 라운드에서 나온 minor must_fix
   - B) delta 라운드가 처음 낸 minor 또는 nit must_fix(note 있음)
   - C) delta 라운드가 처음 낸 major must_fix(note 있음)
2. discovery에서 나온 finding을 delta 입력에서 `first_seen_round`를 delta 번호로 고쳐 다시 기록하면?
   - A) 이연으로 인정된다
   - B) 저장된 값으로 조용히 덮어써진다
   - C) `review-input-invalid`로 거절된다
3. `coordinate worker-tokens --tokens unreported`로 남긴 기록은 어떻게 다뤄지는가?
   - A) 토큰 0으로 합산된다
   - B) 여전히 미충족이라 진행이 거절된다
   - C) 키가 채워진 것으로 보되 `tokens` 값이 없어 합계가 0으로 읽지 않는다
4. `--task` 없이 `coordinate advance`를 실행하면 토큰 누락 검사는 어느 키를 보는가?
   - A) 모든 task의 키
   - B) 검사하지 않는다
   - C) task가 없는 키만
5. 계획 리뷰(context reviewer)에 새로 추가된 판정 기준은?
   - A) 계획 문서의 줄 수가 한도 안인지
   - B) 체크리스트의 각 항목이 해당 테스트 단계로 도달해 확인 가능한지
   - C) 커밋 메시지가 정해진 접두를 쓰는지

## Tasks

### drive-execution/retro-dispatch-model-tokens-deferred/001 · `922e1b33`

#### Goal & intent

구현자 dispatch의 `--model` 값과 Agent 호출 모델이 그 dispatch 직전 `bouncer subagent-model --agent bouncer-implementer`가 출력한 한 줄에서 나오고, coordinator 자신의 `inherit`가 worker 모델로 넘어가지 않게 문서로 고정한다.
수용 기준은 blueprint 수용 기준 1이며 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `measure-scope-env-surface` 첫 세션의 task 001~004 원장 `dispatch.model`이 `inherit`였다. 같은 저장소의 `bouncer subagent-model --agent bouncer-implementer`는 `claude-haiku-5-5`(`--json` `source: tier`, `tier: light`)를 출력한다. 재현: 저장소 루트에서 `bouncer subagent-model --agent bouncer-implementer --json`.
- `skills/bouncer-run/SKILL.md:155-157` step 4는 coordinator 모델 해석과 "`inherit` omits the model argument"만 적고, 이 값이 coordinator 전용이라는 말이 없다.
- `skills/bouncer-run/references/agent-dispatch.md:327-337` Implementer 항목은 `--model <value>` 추가를 요구하지만 `inherit`를 넘겨도 되는 조건은 적지 않는다. coordinator 역할 문서 frontmatter는 `model: inherit`다(`agents/bouncer-coordinator.md:4`).
- `references/coordinator-cards/dispatch.md:15-17`은 `--model <value>`를 agent-dispatch에 위임한다.
- `packages/cli/src/coordinator-commands.ts:1138-1180`의 `coordinateDispatch`는 받은 `--model`을 검증 없이 `dispatch.model`에 기록한다(동작 변경 없음).
- 문서 고정 테스트: `test/skill-bouncer-run.test.js:48-60`(step 4 subagent-model 문단), `test/coordinate-next.test.js:1711-1757`(`DISPATCH_CANON`·`DISPATCH_CANON_ONLY`: 정본 고유 문장이 카드에 다시 들어오면 실패).

#### Target behavior

- 성공: SKILL step 4에 coordinator 모델 출력이 coordinator 전용이라는 문장, agent-dispatch Implementer 항목에 `inherit` 전달 조건 문장, dispatch 카드에 `<value>`의 출처 문장이 생긴다.
- 실패 판정: 세 문장 중 하나가 빠지면 새 테스트가 실패한다. 카드에 `DISPATCH_CANON_ONLY` 문장이 들어가면 기존 테스트가 실패한다.
- 보존: CLI 동작, 기존 `DISPATCH_CANON` 정규식이 맞는 문장, SKILL step 번호와 링크 계약은 바뀌지 않는다.

#### Interface

- 제공: 아래 세 문장(문서 본문, 영어).
  - SKILL step 4: ``That line is the coordinator's model only; each implementer dispatch uses the line `bouncer subagent-model --agent bouncer-implementer` prints, and the coordinator's line is never passed on as a worker model.``
  - agent-dispatch Implementer: ``Pass `inherit` only when that printed line is `inherit`; the coordinator's own `model: inherit` is not the implementer's model.``
  - dispatch 카드: ```<value>` is the line `bouncer subagent-model --agent bouncer-implementer` printed for this dispatch, not the coordinator's own model.``
- 거부: 카드에 agent-dispatch 정본 문장(`DISPATCH_CANON_ONLY`)을 복제하지 않는다. 새 CLI 플래그·검증을 만들지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/SKILL.md` | `4. **Coordinator dispatch.**` | Modify | coordinator 모델 해석과 디스패치 | `inherit` 안내 문장 뒤에 coordinator 전용 문장 추가 | `skills/bouncer-run/SKILL.md:155-157`; `test/skill-bouncer-run.test.js:48` |
| `skills/bouncer-run/references/agent-dispatch.md` | `## Worker model and token records` | Modify | worker 모델·토큰 기록 정본 | Implementer 항목에 `inherit` 전달 조건 문장 추가 | `skills/bouncer-run/references/agent-dispatch.md:327-337`; `test/coordinate-next.test.js:1711` |
| `references/coordinator-cards/dispatch.md` | `--model <value>` 항목 | Modify | dispatch argv 실행 규칙 | `<value>` 출처 문장 추가 | `references/coordinator-cards/dispatch.md:15-17`; `test/coordinate-next.test.js:1746` |
| `test/skill-bouncer-run.test.js` | 신규 추출 지점: 모델 전달 문장 고정 테스트 | Modify | run 스킬 문서 계약 테스트 | 세 문장의 존재를 정확 부분 문자열로 단언 | `test/skill-bouncer-run.test.js:48-60` |

#### Constraints

- 기존 단언은 바꾸지 않는다. 새 테스트만 추가한다.
- 문서 문장은 Interface의 영어 문장을 그대로 쓴다(테스트가 정확 부분 문자열로 찾는다).
- 카드는 정본 링크 문장 구조를 유지하고 agent-dispatch 본문을 복제하지 않는다.

### drive-execution/retro-dispatch-model-tokens-deferred/002 · `f95dafe6`

#### Goal & intent

`review_contract: brief` blueprint의 최종 리뷰 delta 라운드가 남은 `minor`·`nit` `must_fix`를 `deferred`+`note`로 기록하고 문서를 `accepted`로 닫을 수 있게 한다. `review record`와 finalize G21은 같은 판정을 내고, `final-review-single-round`의 안내가 이 경로를 가리키게 한다.
수용 기준은 blueprint 수용 기준 2이며 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `packages/cli/src/validate-sections.ts:520-537` `collectFindingFailures`: `isBlueprintDeferred`는 `roundScope === 'blueprint'`(legacy)에서만 참이다. `blueprint_brief`에서는 `deferred` `must_fix`가 `accepted with open must_fix <id>`로 거절된다(주석 "blueprint_brief는 delta로 인증할 라운드가 있으므로 이 예외를 받지 않는다").
- `packages/cli/src/review-record.ts:400-407`: brief blueprint에 delta가 이미 저장돼 있으면 두 번째 delta를 `final-review-single-round`(next `discovery and one delta are used; report remaining violations as blocked`)로 거절한다. 그래서 delta에서 남은 경미 지적은 `open`으로 저장되고 이연할 기록 경로가 없다.
- `packages/cli/src/coordinator-commands.ts:2035-2042` `final-review-single-round` hint의 `next`는 "Defer the remaining must_fix findings with a note and accept the review"라서 brief blueprint에서는 거절되는 경로를 가리킨다.
- 재현: `test/review-record.test.js:989`(brief discovery deferred must_fix → `accepted with open must_fix`), `test/review-record.test.js:949`(brief 두 번째 delta → `final-review-single-round`), `test/validate-gates.test.js:2779`(G21 brief discovery deferred → `accepted with open must_fix F1`). fixture: `makeFixture({ contract: 'brief' })`(`test/review-record.test.js:73`), `deltaPayload`(`:933`), `briefG21Failures`·`g21ModeRounds`·`convergenceFinding`(`test/validate-gates.test.js:2764`, `:698`, `:627`).
- 관련 문서: `references/coordinator-cards/final_review.md:70-78`·`:160-165`, `rules/cli.md:669-672`·`:709-710`, `skills/bouncer-run/references/review-round.md:83-93`는 delta 라운드가 `accepted` 또는 `final-review-blocked`로 끝난다고만 적는다.

#### Target behavior

- 성공: brief scope에서 `status: deferred`, 비어 있지 않은 `note`, `severity`가 `minor` 또는 `nit`, `actionability: must_fix`, `first_seen_round`와 `last_seen_round`가 모두 `rounds[]` 안 `mode: delta` 라운드의 `round`와 같고 id가 그 delta 라운드의 `previous_finding_ids`에 없는 finding(그 delta에서 처음 나온 finding)은 `accepted with open must_fix`를 내지 않는다. 그 delta 라운드를 `--status accepted`로 기록하면 `ok: true`이고 문서 status는 `accepted`다. G21도 실패를 내지 않는다.
- 실패: brief scope에서 `major`·`blocker` deferred `must_fix`, discovery에서 처음 나온(`first_seen_round` 1) finding의 deferred — delta에서 `severity`를 `minor`로 낮춰 이어 왔어도, `last_seen_round` 1인 deferred, discovery 라운드만 있는 문서의 deferred `must_fix`, note 없는 deferred, id가 delta 라운드 `previous_finding_ids`에 있는 deferred는 지금처럼 거절한다(`review-ledger-invalid` / G21). brief blueprint 최종 리뷰에서 이미 저장된 id의 `first_seen_round`를 다른 값으로 다시 기록하는 입력은 `review-input-invalid`로 거절한다. `first_seen_round`는 caller가 주는 값이고 `mergeFindings`는 id로 통째로 교체하므로, 이 두 규칙이 없으면 discovery `major`를 delta에서 `minor` deferred `first_seen_round: 2`로 다시 적어 거짓 accept를 만들 수 있다. discovery finding은 repair가 고쳐야 할 브리프 위반이므로 이연 대상이 아니다.
- 보존: legacy scope의 discovery deferred 예외, task scope(G14) 거절, `accept-risk` 경로, 두 번째 delta 거절(`final-review-single-round`)은 그대로다. legacy·task scope의 병합은 지금과 같다(`first_seen_round` 불변 검사 없음).
- 기록 시점: 이연은 delta 라운드를 처음 기록하는 `review record` 호출에서만 가능하다. delta가 저장된 뒤에는 두 번째 delta와 repair가 모두 거절되므로(`review-record.ts:400-407`, `coordinator-repair.ts`), 남은 finding은 `review accept-risk`(사용자 승인) 또는 `final-review-blocked`로 닫는다. blueprint 실패 모드의 accept-risk 경로와 같다.
- 안내: `review-record.ts`의 brief 두 번째 delta 거절 `next`와 `coordinator-commands.ts`의 `final-review-single-round` hint `next`가 이 기록 시점과 저장 뒤 경로를 함께 적는다. 문서 세 곳은 Interface의 영어 문장 하나를 그대로 쓴다.

#### Interface

- 제공: brief delta 이연 예외(내부 판정). 도메인 용어 "brief delta 이연 finding": shape `{severity: 'minor'|'nit', status: 'deferred', note: <비공백>, actionability: 'must_fix', first_seen_round: <delta round 번호>, last_seen_round: <delta round 번호>}`, 예 `{id: 'F2', severity: 'minor', status: 'deferred', note: 'follow-up', first_seen_round: 2, last_seen_round: 2}` + `rounds: [{round:1, mode:'discovery'}, {round:2, mode:'delta'}]`.
- 제공: 안내 문구. `review-record.ts` brief 두 번째 delta `next`:
  `discovery and one delta are used; a minor or nit must_fix can be deferred with a note only when the delta round is first recorded; after a stored delta, close remaining findings with review accept-risk after user approval or report them as blocked`
  `coordinator-commands.ts` `final-review-single-round.next`:
  `` Legacy blueprint: defer the remaining must_fix findings with a note and accept the review. Brief blueprint: no repair wave remains; a remaining minor or nit must_fix is deferred with a note only when the delta round is first recorded, and after a stored delta any remaining finding is closed with `review accept-risk` after user approval or stops with `final-review-blocked`. ``
- 제공: 문서 문장(영어, `final_review.md` Marked blueprint 항목과 `Final review order` 3단계, `rules/cli.md` `review accept-risk` 문단, `review-round.md` `4 fix` 행에 같은 문장):
  `` In a brief blueprint, a remaining `minor` or `nit` `must_fix` is recorded as `deferred` with a `note` when the delta round is first recorded with `--status accepted`; once the delta round is stored, any remaining finding is closed with `review accept-risk` after user approval or stops with `final-review-blocked`. ``
- 거부(즉시 거절 목록): `major`·`blocker` deferred `must_fix` in brief, delta 라운드 번호와 다른 `first_seen_round` 또는 `last_seen_round`(심각도 하향으로 discovery finding을 이연하는 경로 포함), id가 그 delta 라운드 `previous_finding_ids`에 있는 deferred, note 공백. 모두 `review-ledger-invalid`(record) / G21(finalize)이며 파일을 바꾸지 않는다.
- 거부(병합 불변): `recordReview`가 `review_contract: brief` blueprint scope 기록일 때만 `mergeFindings`가 검사한다. `normalizeRoundFindings` 뒤 입력 finding의 id가 원장에 있고 저장된 finding의 `first_seen_round`가 정수이면, 입력 값이 그 정수와 `===`로 같지 않을 때(필드 생략·문자열 `'1'` 포함) `review-input-invalid`(cause `finding <id> first_seen_round changed: <stored> -> <incoming>`, 생략은 `undefined`로 적음)로 거절하고 파일을 바꾸지 않는다. 저장된 값이 정수가 아니면 검사하지 않는다. legacy blueprint와 task scope는 검사하지 않는다.
- 새 CLI 플래그·status 값·round mode는 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/validate-sections.ts` | `collectFindingFailures` | Modify | finding·round 형식 판정(record와 G21 공유) | brief delta 이연 예외 추가 | `packages/cli/src/validate-sections.ts:526` |
| `packages/cli/src/review-record.ts` | `recordReview`, `mergeFindings` | Modify | round 기록과 brief 두 번째 delta 거절, finding 병합 | 거절 `next` 문구 교체, brief scope에서 저장된 `first_seen_round` 변경 거절 | `packages/cli/src/review-record.ts:217-237`, `:400-407`; `test/review-record.test.js:959` |
| `packages/cli/src/coordinator-commands.ts` | `final-review-single-round` hint | Modify | 거절 reason별 cause·next | `next` 문구를 legacy·brief로 나눔 | `packages/cli/src/coordinator-commands.ts:2035-2042`; `test/cli-coordinate.test.js:849` |
| `references/coordinator-cards/final_review.md` | Marked blueprint 항목, `Final review order` | Modify | 최종 리뷰 기록 규칙 카드 | delta 라운드에서 minor·nit must_fix를 deferred로 기록하는 규칙 추가 | `references/coordinator-cards/final_review.md:70-78`, `:160-165`; `test/review-record.test.js:607` |
| `rules/cli.md` | `review accept-risk` 문단, 거절 표 아래 문장, `review-input-invalid` 목록 | Modify | review CLI 계약 | Interface 문서 문장 추가, `review-input-invalid` 목록 근처에 brief `first_seen_round` 변경 거절 한 문장 추가 | `rules/cli.md:658`, `:669-672`, `:709-710` |
| `skills/bouncer-run/references/review-round.md` | `4 fix` 행 | Modify | run 리뷰 라운드 정본 | delta가 minor·nit must_fix를 deferred로 닫는 경로 추가 | `skills/bouncer-run/references/review-round.md:83-93` |
| `test/review-record.test.js` | 신규 추출 지점: brief delta 이연 테스트 | Modify | review record 계약 테스트 | 성공 1건·거절 7건·legacy 보존 1건·문서 문장 1건 추가, `:959` next 단언 유지 | `test/review-record.test.js:933`, `:949`, `:989` |
| `test/validate-gates.test.js` | 신규 추출 지점: G21 brief delta 이연 테스트 | Modify | G21 판정 테스트 | 성공 1건·거절 4건 추가 | `test/validate-gates.test.js:2764` |
| `test/cli-coordinate.test.js` | `CLI coordinate repair --review-finding after the final discovery round → final-review-single-round and exit 1` | Modify | coordinate CLI 거절 테스트 | `body.next` 정확 문구 단언 추가 | `test/cli-coordinate.test.js:849-872` |

#### Constraints

- `BRIEF_ROUND_CONTRACT.sequences`(`discovery`, `discovery,delta`)와 `REPAIR_WAVE_LIMIT`는 바꾸지 않는다.
- 기존 단언은 바꾸거나 지우지 않는다. `test/review-record.test.js` 테스트 `brief blueprint second delta after stored delta → is final-review-single-round and leaves bytes unchanged`의 `assert.match(result.next, /discovery and one delta are used/)`는 새 문구의 접두라 그대로 통과한다. 이 테스트에는 `assert.strictEqual(result.next, <Interface의 review-record next 문구>)`만 추가한다.
- `test/cli-coordinate.test.js` 테스트 `CLI coordinate repair --review-finding after the final discovery round → final-review-single-round and exit 1`(`:849`)에는 `assert.strictEqual(body.next, <Interface의 final-review-single-round.next 문구>)`만 추가한다. 이 테스트의 legacy blueprint fixture에서 next 값은 legacy·brief 두 문장을 모두 담은 그 한 문구다.
- `test/review-record.test.js:989`·`test/validate-gates.test.js:2779`(discovery만 있는 brief deferred 거절)은 수정 없이 계속 통과해야 한다.
- record와 G21은 같은 `collectFindingFailures` 호출로 판정한다. review-record.ts에 별도 예외를 복제하지 않는다. `mergeFindings`의 `first_seen_round` 불변 검사는 판정 예외가 아니라 병합 입력 검사다.
- 기존 테스트 중 저장된 id의 `first_seen_round`를 바꿔 다시 기록하는 것이 있으면 그 테스트를 바꾸지 말고 보고한다.
- 카드에는 agent-dispatch 정본 문장(`test/coordinate-next.test.js` `DISPATCH_CANON_ONLY`)을 넣지 않는다.

### drive-execution/retro-dispatch-model-tokens-deferred/003 · `5a95d7d6`

#### Goal & intent

context reviewer가 red 단계뿐 아니라 Checklist의 모든 테스트 단계에 대해, 그 입력이 같은 명령의 앞선 guard를 통과해 목표 분기에 닿는지 판정하게 한다. 막히는 단계는 guard의 `file:line`과 함께 finding이 된다.
수용 기준은 blueprint 수용 기준 3이며 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `measure-scope-env-surface` tasks/003의 Checklist는 verification task의 `coordinate report`로 목표 동작을 시험하라고 했다. 그 입력은 `packages/cli/src/coordinator-commands.ts:1121`(`dispatch-commit-task-required`)이 report 분기 전에 거절해 시험할 수 없었고, 실행 중 CT-002와 repair 2회가 생겼다.
- `agents/bouncer-context-reviewer.md:199-210` `### verifiability`는 "an expected red that cannot be reached"만 본다. 성공 경로 테스트 단계의 도달 가능성은 판정 대상이 아니다.
- `agents/bouncer-context-reviewer.md:150-156` `### Verifiability of success criteria (success_criteria)`(표식 없는 blueprint의 `combined`/`local`/`global` 판정 본문)는 red 단계의 실패 지점 누락만 본다.
- `.codex/agents/bouncer-context-reviewer.toml`은 이 문서의 생성본이며 `test/agents.test.js:57`(`all seven role briefs → keep TOML parity with their Markdown source`)과 `scripts/check-emit.js:108`이 바이트 일치를 검사한다.
- 문서 테스트: `test/skill-context-review.test.js:33`, `:110`(절 본문을 `### <title>`부터 다음 제목 전까지 잘라 키워드를 단언하는 방식).

#### Target behavior

- 성공: 두 절에 Interface 문장이 들어가고 TOML 생성본이 같은 본문을 갖는다.
- 실패 판정: 둘 중 한 절에 문장이 없으면 새 테스트가 실패하고, TOML이 낡으면 `test/agents.test.js` parity 테스트가 실패한다.
- 보존: 절 제목과 순서(`PATH_CONTRACTS` `agents/bouncer-context-reviewer.md`), 관점 판정 범위 분리("Report each omission under one perspective only, never twice"), 기존 키워드 단언이 그대로다.

#### Interface

- 제공: 두 절 끝에 넣는 문장(영어).
  - `### verifiability`: ``Also judge reachability of every Checklist test step, not only the red: its input must pass every guard the same command checks before the target branch. Read the handler the step calls and flag a step whose input an earlier guard refuses (for example a `coordinate report` test on a verification task, refused as `dispatch-commit-task-required` before the report branch), citing that guard as `file:line`.``
  - `### Verifiability of success criteria`: ``Also flag a Checklist test step whose input an earlier guard of the same command refuses before the target branch, citing that guard as `file:line`.``
- 거부: 새 관점·절 제목·rubric 범위를 만들지 않는다. 같은 누락을 `consistency`나 `scope_minimality`에서 다시 보고하라고 적지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-context-reviewer.md` | `### verifiability`, `### Verifiability of success criteria` | Modify | plan 리뷰 판정 범위 | 두 절에 도달 가능성 문장 추가 | `agents/bouncer-context-reviewer.md:150-156`, `:199-210` |
| `.codex/agents/bouncer-context-reviewer.toml` | `developer_instructions` | Modify | Codex 역할 생성본 | Markdown 변경을 재생성해 반영 | `test/agents.test.js:57`; `scripts/check-emit.js:108` |
| `test/skill-context-review.test.js` | 신규 추출 지점: 도달 가능성 문장 테스트 | Modify | context reviewer 문서 계약 테스트 | 두 절 본문에 문장 존재 단언 | `test/skill-context-review.test.js:110` |

#### Constraints

- 기존 단언은 바꾸지 않는다. 새 테스트만 추가한다.
- TOML은 손으로 고치지 않고 `packages/cli/dist/codex-agents`의 `mdToCodexToml`로 생성한다(fixture 설정 `{ roles: {} }`, `scripts/check-emit.js:93`).
- 두 문장은 Interface 문구를 그대로 쓴다.

### drive-execution/retro-dispatch-model-tokens-deferred/004 · `b731f986`

#### Goal & intent

`coordinate worker-tokens --tokens unreported`가 호스트가 토큰을 주지 않은 worker를 명시적으로 기록하게 하고, 원장 decisions에서 토큰 기록이 남지 않은 worker 키를 계산하는 순수 함수를 제공한다. TASKS-005의 거절이 이 함수를 쓴다.
수용 기준은 blueprint 수용 기준 4의 기록·집계 부분이며 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `packages/cli/src/coordinator-commands.ts:121-128` `parseWorkerTokens`는 `/^\d+$/` 문자열과 0 이상 안전 정수만 받는다. `--tokens unreported`는 `tokens-invalid`(exit 1)다.
- `packages/cli/src/coordinator-commands.ts:977-1022` `coordinateWorkerRecord`는 `worker-tokens`를 `{kind, role, tokens, task?, perspective?}`로 덧붙인다. `WorkerTokensDecision` 타입은 `:109-112`.
- `packages/cli/src/coordinator-commands.ts:2196-2199` `tokens-invalid` hint.
- `packages/cli/src/drive-metrics.ts:530-553` `sumWorkerDecisions`: 키 `(task ?? '', role, perspective ?? '')`마다 `runs`(worker-model 수)와 `reported`(숫자 tokens 수)를 세어 `missing = max(0, runs - reported)`.
- `packages/cli/src/cli-git-commands.ts:650`은 `worker-tokens`에 `--tokens` 플래그 존재만 요구하므로 `--tokens unreported`는 core까지 온다.
- `packages/cli/src/cli-usage.ts:17`, `:62`의 help는 `--tokens <n>`만 적는다.
- 재현: `test/cli-coordinate.test.js:1449`(worker-tokens 기록), `:1432`(잘못된 tokens 거절), `test/cli-metrics.test.js:445`, `:469`(summary 합산·missing).
- 원장 measure 사례: delta 리뷰어(98,828 tokens)의 `worker-model`에 tokens가 없고 `worker-tokens`도 없었다.

#### Target behavior

- 성공: `worker-tokens --role reviewer --task 001 --perspective security --tokens unreported`는 `{kind: 'worker-tokens', role: 'reviewer', unreported: true, task: '001', perspective: 'security'}`를 원장과 task decisions에 덧붙이고 `ok: true`(exit 0)다. `tokens` 키는 쓰지 않는다.
- 집계: `metrics summary`는 `unreported` 기록을 `reported`에 더하지 않는다. 같은 키의 토큰 없는 worker-model 하나 + unreported 하나면 `missing: 1`, `total: 0`이다.
- 미충족 키 함수: 숫자 tokens worker-model, 숫자 worker-tokens, unreported worker-tokens를 모두 "채움"으로 세어 `runs > filled`인 키를 돌려준다.
- 실패: `worker-model --tokens unreported`, `worker-tokens --tokens UNREPORTED`·`--tokens -1`은 지금처럼 `tokens-invalid`(exit 1)이고 원장을 바꾸지 않는다. 빈 값 `--tokens ''`는 core에 오기 전 `cli-git-commands.ts` `checkWorkerFlags`가 usage(exit 2, `--tokens requires a value`)로 거절한다.
- 보존: 숫자 tokens 기록 shape, usage exit 2 경로, summary의 기존 합산 결과.

#### Interface

- 제공: CLI 값 `--tokens unreported`(`worker-tokens` 전용, 정확히 소문자 `unreported`).
- 제공: 원장 decision `WorkerTokensDecision = {kind: 'worker-tokens'; role; tokens?: number; unreported?: true; task?; perspective?}` — `tokens`와 `unreported` 중 정확히 하나.
- 제공: `drive-metrics.ts` export `pendingWorkerTokenKeys(decisions: unknown[]): Array<{ task: string | null; role: 'implementer' | 'reviewer' | 'debugger'; perspective: string | null; pending: number }>` — 미충족 키만, 입력 순서상 첫 등장 순. 예: `[{kind:'worker-model', role:'reviewer', model:'m', perspective:'combined'}]` → `[{task: null, role: 'reviewer', perspective: 'combined', pending: 1}]`.
- 제공: help 문구. `cli-usage.ts`의 `coordinate` 개요 줄과 `worker-tokens` usage가 `--tokens <n|unreported>`를 쓰고, `worker-tokens` usage에 문장 `unreported records that the host gave no value; metrics count it as missing.`를 더한다.
- 제공: `tokens-invalid` hint `next` 새 문구: ``Retry with `--tokens <n>` set to the non-negative integer the host reported, `--tokens unreported` on worker-tokens when the host gave none, or omit it for worker-model.`` (cause는 그대로).
- 거부: `worker-model --tokens unreported` → `tokens-invalid`. 대소문자 다른 값(`UNREPORTED`) → `tokens-invalid`. 빈 값(`--tokens ''`) → 기존 usage 경로(exit 2). 모두 원장 바이트 불변.
- 고아·초과 기록: 대응 `worker-model`이 없는 `worker-tokens`는 미충족 키를 만들지 않는다(`pendingWorkerTokenKeys`가 그 키를 내지 않는다).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `coordinateWorkerRecord`, `WorkerTokensDecision`, `tokens-invalid` hint | Modify | worker 기록 명령 | `unreported` 값 분기와 decision shape, hint 문구 | `packages/cli/src/coordinator-commands.ts:109`, `:977-1022`, `:2196` |
| `packages/cli/src/drive-metrics.ts` | 신규 `pendingWorkerTokenKeys` | Modify | worker 토큰 합산 | 미충족 키 함수 추가·export(`sumWorkerDecisions`는 리팩터링하지 않음) | `packages/cli/src/drive-metrics.ts:530-553`, `:840` |
| `packages/cli/src/cli-usage.ts` | `coordinate`, `worker-tokens` usage | Modify | CLI help | `--tokens <n|unreported>` 문구 | `packages/cli/src/cli-usage.ts:17`, `:62`; `test/cli-coordinate.test.js:1477` |
| `test/cli-coordinate.test.js` | 신규 추출 지점: unreported 기록 테스트 | Modify | coordinate CLI 테스트 | 성공 1건·거절 3건·usage 1건 추가 | `test/cli-coordinate.test.js:1449` |
| `test/cli-metrics.test.js` | 신규 추출 지점: unreported 집계·미충족 키 테스트 | Modify | metrics 집계 테스트 | summary missing과 `pendingWorkerTokenKeys` 단언 | `test/cli-metrics.test.js:445` |

#### Constraints

- 기존 단언은 바꾸지 않는다. `test/cli-coordinate.test.js:1462`의 usage 정규식 `/usage: bouncer coordinate worker-tokens/`는 그대로 통과해야 한다.
- `sumWorkerDecisions`의 결과는 기존 입력에 대해 바이트 단위로 같아야 한다(`test/cli-metrics.test.js:445`, `:469` 불변).
- 토큰 값을 추정하거나 0으로 채우지 않는다.

### drive-execution/retro-dispatch-model-tokens-deferred/005 · `a5231b44`

#### Goal & intent

끝난 worker의 토큰 기록(숫자 또는 `unreported`)이 없으면 `coordinate record --task <T>`와 `coordinate advance`가 `worker-tokens-missing`(exit 1)으로 거절하고 원장을 바꾸지 않게 한다. 거절 결과는 미충족 키 목록과 기록 명령 안내를 싣는다.
수용 기준은 blueprint 수용 기준 4의 거절 부분이며 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `packages/cli/src/coordinator-commands.ts:1317-1375` `coordinateRecord`는 worker 경계·`prepared` 상태·accepted report·brief hash·worker commit evidence를 본 뒤 `recorded`로 전이한다. worker 토큰 기록은 보지 않는다.
- `packages/cli/src/cli-git-commands.ts:796-821` `coordinateNextOrAdvance`의 advance 분기는 `advance({repoRoot, blueprint, task, maxSteps})`(`packages/cli/src/coordinate-advance.ts:234`)를 바로 부른다. advance 단위 테스트(`test/coordinate-advance.test.js`)는 `deps.next`·`deps.runArgv` 주입만 쓰고 원장 파일이 없으며 `repoRoot: '/repo'`·`blueprint: 'bp'`처럼 `coordinatorPathsFor`가 throw하는 입력을 쓴다(`test/coordinate-advance.test.js:66`, `packages/cli/src/runtime-state.ts:1073-1080`).
- 의존 경계: `test/dependency-boundaries.test.js:52`는 execution 영역 밖 모듈(`cli-git-commands` 포함)이 `coordinator-commands`를 직접 import하면 실패한다. `coordinate-advance`는 execution 영역이다(`test/helpers/feature-areas.js`).
- 원장 경로는 `coordinatorPathsFor({repoRoot, blueprint}).ledgerFile`(`packages/cli/src/runtime-state.ts:1073`)로 얻는다. `test/cli-coordinate.test.js:851-853`이 같은 방식으로 원장을 읽는다.
- 미충족 키 계산은 TASKS-004의 `pendingWorkerTokenKeys`(`packages/cli/src/drive-metrics.ts`)다.
- measure 사례: 최종 리뷰 delta 리뷰어의 `worker-model`(task 없음)에 토큰 기록이 없었고, 앞 두 세션분은 뒤늦게 backfill됐다.
- 재현 fixture: `preparedCommitDrive`(`test/coordinator.test.js`)와 `workerModelCall`(`test/coordinator.test.js:5560`), CLI는 `preparedDrive`·`coordinateCli`(`test/cli-coordinate.test.js`).

#### Target behavior

- 검사 범위(도메인 용어 "끝난 worker 키"): `record --task T`는 `task === T`인 키. `advance --task T`는 `task === T`인 키와 task 없는 키. `advance`(`--task` 없음)는 task 없는 키만. 다른 task의 키는 병렬 wave에서 아직 실행 중일 수 있어 보지 않는다.
- 검사 시점의 전제: reviewer·debugger `worker-model`은 dispatch 직전에 남지만 coordinator는 그 범위의 worker를 모두 기다린 뒤 `record`·`advance`를 부른다(`agents/bouncer-coordinator.md` `## Worker dispatch`). 검사 범위 안의 미충족 키는 끝난 worker의 것으로 보고 거절한다. 이 변경 전에 시작된 drive의 토큰 없는 기록도 거절되며 `--tokens unreported`로 복구한다(의도한 동작).
- 실패: 검사 범위에 미충족 키가 있으면 `{ ok: false, reason: 'worker-tokens-missing', pending: [{task, role, perspective}], cause, next }`, exit 1. record는 원장 바이트를 바꾸지 않는다. advance는 어떤 argv도 실행하지 않으며 결과 JSON에 `executed` 키가 없다.
- 성공: 같은 키에 숫자 `worker-tokens` 또는 `--tokens unreported` 기록을 더하면 같은 명령이 기존대로 진행한다.
- 보존: 원장이 없거나 읽을 수 없으면 advance guard는 판정하지 않고 기존 advance 경로가 오류를 낸다. `coordinate next`·`status`·`worker-model`·`worker-tokens`·`report`는 거절하지 않는다. 기존 record 거절 reason의 순서는 그대로이고 새 검사는 그 뒤, 원장 쓰기 전에 한다.

#### Interface

- 제공: 거절 reason `worker-tokens-missing`과 hint
  - cause: `A finished worker has a worker-model record but no worker-tokens record (numeric or unreported).`
  - next: `` Record `bouncer coordinate worker-tokens --role <role> [--task <ddd>] [--perspective <name>] --tokens <n>` for each pending key from the host usage, or `--tokens unreported` when the host gave none, then rerun. ``
- 제공: `coordinator-commands.ts` export `workerTokensGuard({ repoRoot, blueprint, task? }) → { ok: true } | { ok: false, reason: 'worker-tokens-missing', pending, cause, next }` — 테스트가 이 이름으로 호출하는 공개 export다. 원장을 읽어 advance 검사 범위(task 없는 키, `task`를 주면 그 task 키 포함)의 미충족 키를 판정한다. `coordinateRecord`는 이미 연 원장 decisions에서 task T 키만 걸러 같은 `pendingWorkerTokenKeys`로 판정한다. 경계 입력은 모두 `{ ok: true }`다(판정할 수 없으면 판정하지 않고 advance가 기존 경로로 진행하거나 실패): 원장 부재, 파싱 실패, 파싱한 원장에 `decisions`가 없거나 배열이 아님, `coordinatorPathsFor` throw(guard 안 `try`/`catch`가 잡는다; git 없는 repo·blueprint 경로 오류는 뒤이은 `next`가 기존 reason으로 낸다).
- 제공: 호출 지점. `coordinate-advance.ts` `advance()`가 `while` 루프 전에 `require('./coordinator-commands')`로 지연 로드한 `workerTokensGuard({ repoRoot: opts.repoRoot, blueprint: opts.blueprint, task: opts.task })`를 한 번 부른다. 실패면 그 결과 객체(`executed` 키 없음)를 그대로 반환하고 `next`·argv를 부르지 않는다. 반환 타입은 `AdvanceOk | AdvanceErr | WorkerTokensGuardFail`이다. `cli-git-commands.ts`는 바꾸지 않으며, 실패 결과는 기존 `compactCoordinateOutput`(실패는 그대로 출력)과 `result.ok ? 0 : 1`로 exit 1이 된다. `coordinate-advance`·`coordinator-commands`는 모두 execution 영역이라 의존 경계 테스트가 그대로 통과한다.
- 제공: `pending[]` 원소 shape `{ task: string | null, role: 'implementer'|'reviewer'|'debugger', perspective: string | null }`. 예: `{ task: null, role: 'reviewer', perspective: 'combined' }`.
- 거부(즉시 거절): 위 실패 조건 하나뿐이다. 새 플래그로 우회하는 경로는 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `coordinateRecord`, `workerTokensGuard`(신규 export), hint 표 | Modify | record 전이와 거절 hint | record 쓰기 전 검사, guard export, `worker-tokens-missing` hint | `packages/cli/src/coordinator-commands.ts:1317-1375`, `:2035` |
| `packages/cli/src/coordinate-advance.ts` | `advance` | Modify | advance 루프와 deps seam | 루프 전 `workerTokensGuard` 호출, 실패 결과 반환, 반환 타입 확장(루프·deps seam은 그대로) | `packages/cli/src/coordinate-advance.ts:234-255`; `test/dependency-boundaries.test.js:52` |
| `test/coordinator.test.js` | 신규 추출 지점: record guard 테스트 | Modify | coordinator core 테스트 | 거절·통과 테스트 추가 | `test/coordinator.test.js:5556-5680` |
| `test/cli-coordinate.test.js` | 신규 추출 지점: advance guard CLI 테스트 | Modify | coordinate CLI 테스트 | advance 거절·통과 테스트 추가 | `test/cli-coordinate.test.js:849` |

#### Constraints

- 기존 단언은 바꾸지 않는다. guard 때문에 깨지는 기존 테스트가 있으면 fixture를 고치지 말고 report Scope impact로 알린다.
- record의 새 검사는 `accepted-report-required` 등 기존 거절 뒤, `item.status` 전이와 `commitWrite()` 전에 둔다.
- guard는 원장을 쓰지 않는다.
- `test/coordinate-advance.test.js`의 기존 테스트는 수정 없이 통과해야 한다(그 입력에서 guard는 `coordinatorPathsFor` throw를 잡아 `{ ok: true }`).

### drive-execution/retro-dispatch-model-tokens-deferred/006 · `0721ba87`

#### Goal & intent

agent-dispatch `## Worker model and token records`와 `rules/cli.md`가 worker 종료 직후 토큰 기록(숫자 또는 `--tokens unreported`)을 요구하고, 빠지면 `coordinate record`·`advance`가 `worker-tokens-missing`으로 거절한다고 같은 계약으로 적게 한다.
수용 기준은 blueprint 수용 기준 4의 문서 부분과 수용 기준 6이며 검증 명령은 frontmatter `verify`다.

#### Current behavior

- `skills/bouncer-run/references/agent-dispatch.md:357-363`: "If the host gives no value, leave it out: it is counted as missing, never estimated." 기록 생략을 허용한다.
- `rules/cli.md:305-320`: `worker-tokens`는 `--tokens <n>`만 적고 `unreported`·`worker-tokens-missing`이 없다. `rules/cli.md:270` coordinate 명령 목록에 `worker-tokens`가 빠져 있다.
- 문서 고정: `test/coordinate-next.test.js:1735`(`/worker-tokens[\s\S]{0,300}counted\s+as\s+missing,\s+never\s+estimated/`), `:1744-1752`(`DISPATCH_CANON_ONLY`의 `/worker-tokens --blueprint/`·`/counted\s+as\s+missing/`가 카드에 있으면 실패). `docs/architecture/rule-ownership.md:72`가 `counted as missing, never estimated` 문구를 agent-dispatch 소유로 등록한다.
- `rules/cli.md:440-444`의 advance 정지·실패 목록(`repeated-failure`, `unclear-result`, `advance-argv-invalid`, 자동 action reason)에 `worker-tokens-missing`이 없다.
- `rules/cli.md`는 `PATH_CONTRACTS`의 `rejectionTable`(`final-review-single-round`, `final-review-repair-do-not-touch`) 계약만 있다(`packages/cli/src/doc-shape-contracts.ts:136-138`).

#### Target behavior

- 성공: agent-dispatch 토큰 문단은 "host가 값을 주지 않으면 `--tokens unreported`로 기록한다; counted as missing, never estimated" 순서로 바뀌고, record·advance 거절 문장이 붙는다. `rules/cli.md` worker-tokens 문단은 `--tokens <n|unreported>`, unreported decision shape, `worker-tokens-missing` 검사 범위를 적는다.
- 실패 판정: 새 문장이 없으면 새 테스트가 실패한다. 기존 정규식(`:1735`)이 깨지면 기존 테스트가 실패한다.
- 보존: `## Worker model and token records` 제목·순서(`AGENT_DISPATCH_HEADINGS`), TASKS-001이 넣은 Implementer 문장, `rules/cli.md` 거절 표.

#### Interface

- 제공: agent-dispatch 토큰 문단 끝 두 문장(영어):
  - `` If the host gives no value, record `--tokens unreported` for that key instead: it is counted as missing, never estimated. ``
  - `` `coordinate record --task <NNN>` and `coordinate advance` refuse with `worker-tokens-missing` while a finished worker key has neither record. ``
- 제공: `rules/cli.md` worker-tokens 문단. 기존 synopsis의 `--tokens <n>`을 `--tokens <n|unreported>`로 바꿔 synopsis가 `` `coordinate worker-tokens --blueprint <dir> --role <implementer|reviewer|debugger> --tokens <n|unreported> --ledger-path <p> --ledger-hash <h> [--task <ddd>] [--perspective <name>]` ``가 되고, 문장 ``A `worker-tokens --tokens unreported` record appends `{kind: worker-tokens, role, unreported: true, task?, perspective?}`.``와 검사 범위 문장 ``The `worker-tokens-missing` check covers these keys: `coordinate record --task <T>` checks the keys of task T, `coordinate advance --task <T>` checks the keys of task T and the keys with no task, and `coordinate advance` without `--task` checks only the keys with no task.``를 더한다.
- 제공: `rules/cli.md` 문장 ``Before running any action, `coordinate advance` refuses with `worker-tokens-missing` (exit 1, no `executed`) while a checked worker key has no token record.``를 advance 정지·실패 목록 문단에 넣고, `rules/cli.md:270` 명령 목록에서 `worker-model` 바로 뒤에 `worker-tokens`를 넣어 `|worker-model|worker-tokens|note|`가 되게 한다.
- 거부: coordinator 카드는 바꾸지 않는다. coordinator는 거절을 CLI `reason`·`next`로만 알게 된다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/agent-dispatch.md` | `## Worker model and token records` 마지막 문단 | Modify | worker 토큰 기록 정본 | 생략 문장을 unreported 기록과 거절 문장으로 교체 | `skills/bouncer-run/references/agent-dispatch.md:357-363`; `test/coordinate-next.test.js:1735`; `docs/architecture/rule-ownership.md:72` |
| `rules/cli.md` | `## Pointer, worktree, and coordinator commands` 명령 목록·worker-tokens 문단·advance 목록 | Modify | coordinate CLI 계약 | `:270` 목록에 `worker-tokens`, `--tokens <n|unreported>`·unreported shape·`worker-tokens-missing` 범위, advance 실패 문장 | `rules/cli.md:270`, `:305-320`, `:440-444` |
| `test/coordinate-next.test.js` | `DISPATCH_CANON`, 신규 추출 지점: cli 규칙 문장 테스트 | Modify | agent-dispatch 정본·카드 문장 고정 | `DISPATCH_CANON` 항목 2개와 `rules/cli.md` 문장 테스트 추가 | `test/coordinate-next.test.js:1711-1757` |

#### Constraints

- 기존 단언은 바꾸지 않는다. `DISPATCH_CANON`에는 항목만 추가한다.
- `counted as missing, never estimated` 문구와 그 앞 300자 안의 `worker-tokens`를 유지한다.
- TASKS-005가 출력하는 reason·hint 문구와 문서 문장이 같은 이름(`worker-tokens-missing`, `--tokens unreported`)을 쓴다.

### drive-execution/retro-dispatch-model-tokens-deferred/007

#### Goal & intent

TASKS-001~006을 모두 통합한 integration HEAD에서 `npm run ci`가 통과해 blueprint 수용 기준 5와 epic 성공 기준 8·20의 종단 조건을 증명한다. 이 task는 source를 바꾸지 않는다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/retro-dispatch-model-tokens-deferred/008 · `52a0c6df`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F1 (minor, spec_scope, must_fix) — test/cli-coordinate.test.js#CLI coordinate advance after worker-tokens fills the key → stops at worker — tasks/005 Checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/cli-coordinate.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.