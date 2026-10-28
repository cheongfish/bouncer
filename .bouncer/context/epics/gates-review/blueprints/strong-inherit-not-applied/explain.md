---
type: bouncer.explain
title: strong-inherit-not-applied explain
description: Explain for strong-inherit-not-applied
resource: .bouncer/context/epics/gates-review/blueprints/strong-inherit-not-applied/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-28T13:56:58.709+09:00'
bouncer:
  id: EXPLAIN-strong-inherit-not-applied
  epic_id: gates-review
  blueprint_id: strong-inherit-not-applied
  status: published
  comprehension:
    - range_from: fd04a16884fda83d62468921a8b23d16175488c4
      range_to: b18de9a6707e49056b08470e0b240ca5e5db6c97
      diff_sha: f2033e55844d941d237e6750e5eb4655092e01ec55d9135e1b5412a13acb5d2e
      recorded_at: '2026-10-28T13:57:31.774+09:00'
  task_commits:
    - task: gates-review/strong-inherit-not-applied/001
      sha: b18de9a6
      intent_anchor: task-001
---
# Explain

## Background

`bouncer review-dispatch`는 리뷰 범위가 크거나 위험 표시가 있으면 리뷰어 등급을 `strong`으로 올리고, 이를 적용했는지 `reviewer_tier_applied`로 알린다. 그런데 `model_tiers.<provider>.strong`이 `"inherit"`일 때도 이 값이 `true`로 나갔다. `inherit`은 리뷰어 호출에 모델을 지정하지 않는다는 뜻이라, Claude 훅은 모델 없는 호출을 `subagents` slot 모델로 덮어쓴다. 보고는 "상향 적용"인데 실제 모델은 그대로여서 metrics에 잘못된 등급이 남을 수 있었다.

이제 `inherit` 매핑은 미적용으로 보고한다. 모델 slug 매핑만 적용으로 본다. 훅 계약과 `bouncer init` 예시 기본값은 바꾸지 않았다.

## Code

- `packages/cli/src/review-dispatch.ts`의 `applyReviewerTier`: `resolveSubagentRole` 결과가 `source: 'tier'`이면서 `model === null`이면 `baseDispatch`를 그대로 두고 `applied: false`와 `reviewer tier strong not applied: tier-inherit (fix: model_tiers.<provider>.strong)`을 돌려준다. 이 사유는 `decideReviewerTier`를 거쳐 plan·execute payload의 `reasons`에 실린다. 반환 모양과 `agent_dispatch`의 `{ agent, provider, model }` 키는 그대로다.
- 설계 선택: 판별에 `subagents.ts`의 반환 타입을 늘리지 않고 `role.model === null`을 쓴다. 미적용이 되면 controller는 `--tier` 없이 일반 해석을 하므로, 훅이 없는 provider(Codex·Cursor)에서는 slot이 있을 때 리뷰어가 부모 모델 상속 대신 slot 모델을 쓰게 된다. Claude는 훅이 이미 slot으로 덮어써 실제 모델이 같다.
- `test/review-dispatch.test.js`: 기존 inherit 단언을 "slot 유지 + tier-inherit 사유"로 바꾸고, slot 없는 claude plan과 codex execute 사례를 더했다.
- `docs/configuration.md`의 `review.min_reviewer_tier` 행과 `test/subagents.test.js`의 문서 계약 단언이 같은 판정을 따른다.

## Quiz

1. `model_tiers.claude.strong`이 `"inherit"`이고 리뷰 범위의 commit task가 3개일 때 `review-dispatch plan`의 `reviewer_tier_applied`는?
   - A) `true`, `agent_dispatch.model`은 `null`
   - B) `false`, `reasons`에 `tier-inherit` 사유가 포함됨
   - C) 거절(`ok: false`)
2. 같은 `inherit` 매핑에서 `agent_dispatch`는 어떻게 되는가?
   - A) 기존 해석(slot이 있으면 slot 모델)을 그대로 둔다
   - B) `model`이 항상 `null`로 바뀐다
   - C) provider가 `unknown`으로 바뀐다
3. `model_tiers.claude.strong`이 모델 slug 문자열이면?
   - A) 이전처럼 매핑 모델로 `agent_dispatch`를 바꾸고 적용됨으로 보고한다
   - B) `inherit`과 같이 미적용으로 보고한다
   - C) `tier-unmapped`로 거절한다

## Tasks

### gates-review/strong-inherit-not-applied/001 · `b18de9a6`

#### Goal & intent

`model_tiers.<provider>.strong`이 `"inherit"`일 때 `review-dispatch` plan·execute payload가 `reviewer_tier_applied: false`와 미적용 사유 `tier-inherit`를 내게 한다. provider는 가리지 않는다. 모델 slug 매핑은 지금처럼 적용으로 보고한다. 수용 기준은 epic Success criteria 29이고, 검증 명령은 frontmatter `verify`(`node scripts/check-task.js test/review-dispatch.test.js test/subagents.test.js`)다.

#### Current behavior

- `packages/cli/src/review-dispatch.ts:1087-1110` `applyReviewerTier`: `tier !== 'strong'`이면 바로 미적용(`notApplied: null`)을 돌려준다. strong이면 `resolveSubagentRole({ repoRoot, agentName, tier: 'strong' })`를 부르고, 결과가 `role.ok && role.source === 'tier'`이면 `{ agent, provider: role.provider, model: role.model }`로 바꾸고 `applied: true`다. 이때 `role.model`이 `null`이어도 마찬가지다. 그 밖에는 `baseDispatch`를 그대로 두고 `notApplied`에 `reviewer tier strong not applied: <code> (fix: <next>)`를 싣는다. `code`는 `role.ok`이면 `provider-unknown`, 아니면 `role.code`다.
- `packages/cli/src/subagents.ts:180`: 매핑 값이 `'inherit'`이면 `model: null, source: 'tier'`를 돌려준다. `:153`은 provider를 모를 때 `source: 'inherit'`를 돌려주므로 `source === 'tier'` 분기에는 들어가지 않는다.
- `packages/cli/src/review-dispatch.ts:1148-1155` `decideReviewerTier`: `applied.notApplied`가 있으면 `reasons`에 `[등급 근거, notApplied]` 두 줄을 싣는다. plan(`:763`, `:782`)과 execute(`:1014`, `:1031`) payload는 이 값을 그대로 옮긴다.
- 훅 `hooks/subagent-model.js:123-136`: 리뷰어 호출의 `model`이 strong 매핑 모델과 정확히 같을 때만 그 모델을 둔다. model이 빠진 호출(`agent_dispatch.model: null`)은 slot 모델로 덮어쓴다. 그래서 inherit 매핑에서 `applied: true` 보고와 실제 모델이 어긋난다.
- 기존 단언 `test/review-dispatch.test.js:2560` (`plan with strong tier mapped to inherit → agent_dispatch.model is null and applied`): slot `slot-model` + strong `inherit`에서 `reviewer_tier_applied === true`와 `agent_dispatch.model === null`을 단언한다.
- 재현: `npm run build` 뒤 `node --test test/review-dispatch.test.js`. 위 테스트가 현재 동작에서 통과한다(2026-10-28, HEAD `fd04a168`).
- I/O 결합: `resolveSubagentRole`가 `.bouncer/config.json`을 읽는다(file I/O). 테스트는 `writeConfig`(`test/review-dispatch.test.js:2480`)로 임시 저장소에 config를 쓴다. execute 경로는 `tierExecute`(`:2658`)가 git 커밋을 만들기 때문에 integration tier다(`test/tiers.json:117`).

#### Target behavior

- 성공(inherit 매핑): `role.ok && role.source === 'tier' && role.model === null`이면 `agent_dispatch`는 `baseDispatch` 그대로, `applied: false`, `notApplied`는 `reviewer tier strong not applied: tier-inherit (fix: model_tiers.<role.provider>.strong)`이다. plan·execute(discovery·delta) payload의 `reviewer_tier`는 `strong`, `reviewer_tier_applied`는 `false`, `reasons`는 `[등급 근거, 위 사유]`다. provider가 `claude`든 `codex`든 같다.
- 실제 디스패치 모델 변화(의도된 결과): `rules/subagent-model.md:25-30`에 따라 controller는 `reviewer_tier_applied`가 false이면 `--tier` 없이 `subagent-model --agent <name>`으로 해석한다. 그래서 훅이 없는 provider(Codex·Cursor)에서 slot이 있고 strong이 `inherit`이면, 리뷰어 모델이 부모 세션 모델 상속에서 slot 모델로 바뀐다. 사용자가 2026-10-28에 "모든 provider 적용"을 이 결과를 알고 선택했다. Claude에서는 지금도 훅이 slot 모델로 덮어쓰므로 실제 모델은 그대로다.
- 성공(모델 slug 매핑): `role.model`이 문자열이면 지금처럼 `agent_dispatch`를 매핑 결과로 바꾸고 `applied: true`, 미적용 사유 없음.
- 보존: `tier !== 'strong'` 경로, `tier-unmapped`·`provider-unknown` 사유 문자열, `review-min-reviewer-tier-invalid` 거절, light skip payload에 tier 필드가 없는 것, `agent_dispatch`의 `{ agent, provider, model }` 키 집합.
- 문서: `docs/configuration.md:32` `review.min_reviewer_tier` 행의 "`strong` 등급은 `model_tiers.<provider>.strong` 매핑이 있을 때만 `agent_dispatch.model`에 적용된다"를 "매핑이 `inherit`이 아닌 모델 slug일 때만 적용되고, `inherit`이면 미적용(`tier-inherit`)으로 보고한다"는 뜻으로 고친다. 옛 문구 "매핑이 있을 때만 `agent_dispatch.model`에 적용된다"는 남기지 않는다.

#### Interface

- 제공: `review-dispatch plan`·`execute` 성공 payload의 `reviewer_tier_applied`가 strong `inherit` 매핑에서 `false`가 된다. 새 `reasons` 문자열 `reviewer tier strong not applied: tier-inherit (fix: model_tiers.<provider>.strong)`이 생긴다. 예: `reviewer tier strong not applied: tier-inherit (fix: model_tiers.claude.strong)`.
- 소비자 결과: `skills/bouncer-plan/references/context-review.md:74-76`과 drive-metrics 절차는 `reviewer_tier_applied`가 true일 때만 상향 등급을 기록한다. 따라서 strong `inherit` 설정(`bouncer init` 예시 기본값)에서는 `reviewer_tier: strong`이어도 metrics에 일반 해석의 등급이 기록된다. 이것은 기대한 결과이며 회귀가 아니다.
- 거부: 새 거절은 없다. inherit 매핑은 실패 payload(`ok: false`)가 아니라 성공 payload의 미적용으로 보고한다. `applyReviewerTier`의 반환 모양 `{ agent_dispatch, applied, notApplied }`과 payload 키 집합을 바꾸지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/review-dispatch.ts` | `applyReviewerTier` | Modify | strong 등급을 매핑 결과로 적용하고 미적용 사유를 만든다 | `source === 'tier'`이고 `model === null`이면 `baseDispatch`를 두고 `tier-inherit` 사유로 미적용 처리 | `packages/cli/src/review-dispatch.ts:1095-1101`; `packages/cli/src/subagents.ts:180` |
| `test/review-dispatch.test.js` | `plan with strong tier mapped to inherit → …` | Modify | inherit 매핑을 applied로 단언한다 | 기존 단언을 미적용·사유·`slot-model` 유지로 바꾸고, slot 없는 plan과 codex provider execute 사례를 추가(기존 helper `tierExecute`는 바꾸지 않고 사용) | `test/review-dispatch.test.js:2560`, `:2658`, `:2710` |
| `docs/configuration.md` | `review.min_reviewer_tier` 행 | Modify | strong 적용 조건을 "매핑이 있을 때"로 서술한다 | inherit 매핑은 미적용(`tier-inherit`)으로 보고한다고 고친다 | `docs/configuration.md:32` |
| `test/subagents.test.js` | `model tier docs → item 1, cli.md, configuration.md state the tier/effort contract` | Modify | `docs/configuration.md`의 tier 계약 문구를 단언한다 | 단언 목록에 `tier-inherit`를 더하고 옛 문구 부재를 단언한다 | `test/subagents.test.js:510`, `:534-538` |

#### Constraints

- 기존 단언 변경 범위: `test/review-dispatch.test.js`의 `plan with strong tier mapped to inherit → agent_dispatch.model is null and applied` 한 개만 바꾼다. 새 이름은 `plan with strong tier mapped to inherit → keeps the slot dispatch with a tier-inherit reason`이다. 새 기대값은 `reviewer_tier_applied === false`, `agent_dispatch`가 `{ agent: 'bouncer-context-reviewer', provider: 'claude', model: 'slot-model' }`, `reasons`에 `reviewer tier strong not applied: tier-inherit (fix: model_tiers.claude.strong)`가 포함되는 것이다. 다른 tier 테스트의 단언은 바꾸지 않는다.
- 두 번째 기존 단언 변경: `test/subagents.test.js`의 `model tier docs → item 1, cli.md, configuration.md state the tier/effort contract` 하나다. `docs/configuration.md` 포함 단언 배열(`:535-536`)에 `'tier-inherit'`를 더하고, 옛 문구 `매핑이 있을 때만 \`agent_dispatch.model\`에 적용된다`가 없다는 단언 하나를 더한다. 그 테스트의 다른 단언은 바꾸지 않는다.
- 이 단언은 현재 코드에서 기존 기대값으로 통과한다. 새 기대값은 구현 전에 red이고 구현 후에 green이어야 한다.
- 새 테스트 이름은 `<subject> → <expectation>` 형식을 따른다(`lint:test-names`).
- ts·js 줄은 120자 이내다.
- `subagents.ts`의 반환 타입에 필드를 더하지 않고 `role.model === null`로 판별한다.

### gates-review/strong-inherit-not-applied/002

#### Goal & intent

TASKS-001이 통합된 뒤 `npm run ci`(빌드 산출물 검사, 버전 검사, 커버리지 포함 전체 테스트, unit tier, lint, typecheck, 테스트 이름 lint, audit)가 통과해 epic Success criteria 29의 "종단 `npm run ci` 통과"를 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.