---
type: bouncer.explain
title: adversarial-review-tiering explain
description: Explain for adversarial-review-tiering
resource: .bouncer/context/epics/gates-review/blueprints/adversarial-review-tiering/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-27T15:20:29.576+09:00'
bouncer:
  id: EXPLAIN-adversarial-review-tiering
  epic_id: gates-review
  blueprint_id: adversarial-review-tiering
  status: published
  comprehension:
    - range_from: b184d931d90be35121dc89c397385fe35f56a05d
      range_to: cc37d4025d2cc6d4366a38747dd036d7974db6eb
      diff_sha: c570546f2136bcd8cdeae685bd28f5a09c74f1293b070ee6f722d48d33410648
      recorded_at: '2026-10-27T15:21:56.169+09:00'
  task_commits:
    - task: gates-review/adversarial-review-tiering/001
      sha: 9f09a698
      intent_anchor: task-001
    - task: gates-review/adversarial-review-tiering/002
      sha: dd787ac7
      intent_anchor: task-002
    - task: gates-review/adversarial-review-tiering/003
      sha: 7a2a3fd1
      intent_anchor: task-003
    - task: gates-review/adversarial-review-tiering/004
      sha: cec37eb5
      intent_anchor: task-004
    - task: gates-review/adversarial-review-tiering/005
      sha: f9757799
      intent_anchor: task-005
    - task: gates-review/adversarial-review-tiering/007
      sha: 78a768d4
      intent_anchor: task-007
    - task: gates-review/adversarial-review-tiering/008
      sha: cc37d402
      intent_anchor: task-008
---
# Explain

## Background

리뷰어는 "실제 이슈를 모두 라벨만 붙여 보고"하는 기준이어서, 반드시 고칠 것과 취향성 제안이 한 목록에 섞였다.
리뷰어 모델도 역할별로 고정돼 있어서 복잡한 계획과 단순한 계획이 같은 등급으로 검토됐다.
plan 재생 실측에서 Sonnet은 복잡한 계획의 반드시 고칠 `minor`를 약 1/3 놓쳤다.

이 변경은 두 가지를 바꾼다.

- 코드 리뷰어는 적대적 자세로 "반드시 수정할 것만" 보고한다. context-reviewer도 적대적 자세를 얻되 `nit` 보고는 유지한다.
- `review-dispatch`가 리뷰 범위의 규모와 위험으로 `reviewer_tier`(`standard`/`strong`)를 계산해 모델에 적용한다. Claude 훅은 이 상향을 되돌리지 않고, 하향은 허용하지 않는다.

## Code

- `agents/bouncer-reviewer.md`, `agents/bouncer-context-reviewer.md`, `references/review/assets/reviewer-prompt.md`: 적대적 자세와 필수 수정 보고 기준. Codex용 `.codex/agents/*.toml`은 생성 명령으로만 갱신한다.
  Over-engineering rubric 제목은 "advisory 출력 금지" 계약과 맞추려고 "(finding when actionable)"로 고쳤다.
- `packages/cli/src/subagents.ts`, `cli-project-commands.ts`: `bouncer subagent-model --tier <tier>`가 호출 단위 등급을 받는다.
  등급을 주지 않은 호출의 결과는 그대로다. 잘못된 값은 `role-config-invalid`(next `tier`)를 내고, CLI의 빈·잘못된·반복 `--tier`는 exit 2와 빈 stdout이다.
  반복 `--tier`는 `parseFlags`가 마지막 값만 남기므로 원시 argv의 토큰 수로 센다.
- `packages/cli/src/review-dispatch.ts`:
  - `computeReviewerTier`: commit task 수가 `REVIEWER_STRONG_MIN_TASKS`(3) 이상이거나 `review_risk`가 비어 있지 않으면 strong, 아니면 standard다. 사용자는 `review.min_reviewer_tier`로 하한만 올릴 수 있고, 작성자 frontmatter로 등급을 정하는 경로는 없다.
  - `applyReviewerTier`: strong일 때만 호출 단위 tier로 역할을 다시 해석한다. 매핑이 없거나 provider를 모르면 기존 dispatch를 두고 `reviewer_tier_applied: false`와 미적용 사유를 `reasons`에 남긴다.
  - `decideReviewerTier`: `review.min_reviewer_tier`가 `standard`/`strong`이 아니면 성공 payload 없이 `review-min-reviewer-tier-invalid`로 거절한다. 약한 리뷰가 조용히 나가지 않게 하려는 선택이다.
  - payload에는 `reviewer_tier`, `reviewer_tier_applied`가 더해지고 `agent_dispatch` 키 집합은 그대로다.
- `hooks/subagent-model.js`: reviewer·context-reviewer 호출의 모델이 `--tier strong` 매핑 모델과 정확히 같으면 config 모델로 덮어쓰지 않는다. 두 번째 조회가 실패하거나 시간 초과이거나 옛 runtime의 평문이면 기존 덮어쓰기로 돌아가므로 호출을 막지 않는다.
- `rules/subagent-model.md`가 규칙 본문을 갖고, `rules/cli.md`·`skills/bouncer-run/references/agent-dispatch.md`·`skills/bouncer-plan/references/context-review.md`는 참조만 한다.

알려진 한계:

- 테스트 하나는 malformed `review_risk`에서 `ok === false`만 확인하고 S30 코드는 확인하지 않는다.
- strong 매핑이 `inherit`일 때 payload는 tier를 적용했다고 보고하지만 훅은 slot 모델을 되돌려 쓴다. 두 쪽 모두 각자 명세대로 동작하므로 고치려면 설계 결정이 필요하다.
- 훅 시간 초과 테스트는 실제로 20초를 기다린다.

## Quiz

1. commit task가 2개이고 그 범위의 `review_risk`가 `public_interface`다. `review.min_reviewer_tier`는 없다. 계산된 `reviewer_tier`는?
   - a) strong
   - b) standard
   - c) 오류
2. `.bouncer/config.json`에 `review.min_reviewer_tier: "light"`가 있다. review-dispatch는?
   - a) 값을 무시하고 등급을 계산한다
   - b) strong으로 간주한다
   - c) 성공 payload 없이 `review-min-reviewer-tier-invalid`로 거절한다
3. 등급이 strong으로 계산됐지만 해당 provider에 strong 모델 매핑이 없다. 결과는?
   - a) dispatch를 거절한다
   - b) 기존 `agent_dispatch`를 두고 `reviewer_tier_applied: false`와 미적용 사유를 `reasons`에 싣는다
   - c) 모델을 `inherit`로 바꾼다
4. Claude 훅이 reviewer 호출을 받았는데, 호출이 지정한 모델이 config 모델과 다르고 `subagent-model --tier strong` 매핑 모델과 정확히 같다. 훅은?
   - a) config 모델로 되돌린다
   - b) 호출을 막는다(exit 2)
   - c) 호출이 지정한 모델을 그대로 둔다
5. `bouncer subagent-model --agent bouncer-reviewer --tier strong --tier standard`처럼 `--tier`를 두 번 주면?
   - a) 사용법 오류로 exit 2, stdout은 비어 있다
   - b) 마지막 값 `standard`를 쓴다
   - c) 첫 값 `strong`을 쓴다

## Tasks

### gates-review/adversarial-review-tiering/001 · `9f09a698`

#### Goal & intent

코드 리뷰어(`agents/bouncer-reviewer.md`와 inline 프롬프트 `references/review/assets/reviewer-prompt.md`)는 적대적으로 보되 반드시 수정할 것만 보고하고 `advisory`를 내지 않는다. `agents/bouncer-context-reviewer.md`는 적대적 자세만 더하며 `nit`까지 보고하는 기준은 그대로 둔다. 검증 명령은 `node --test test/reviewer-adversarial-brief.test.js test/agents.test.js`.

#### Current behavior

- 입력/상태: `agents/bouncer-reviewer.md:76`("Severity is a label, not a filter, **within that assigned perspective**: report every real issue"), `:177`("Severity is a **label, not a filter**… filtering happens after reporting"), `:197`("Over-engineering findings are `minor` by default"), `:222`(actionability hint `must_fix | advisory`)가 모든 실제 이슈 보고를 요구한다. `references/review/assets/reviewer-prompt.md:113`, `:174`가 같은 기준이다. `agents/bouncer-context-reviewer.md:213`, `:250`도 "label, not a filter"와 같은 actionability 문구를 쓴다.
- 출력: `.codex/agents/bouncer-reviewer.toml:76,177,197,222`와 `bouncer-context-reviewer.toml:213,250`은 Markdown 원본의 생성물이라 같은 문구를 가진다.
- 재현: `rg -n "label, not a filter|must_fix \| advisory" agents references/review .codex/agents`. 기존 동기화 테스트는 `test/agents.test.js:55~62`(`mdToCodexToml(markdown)`와 TOML 완전 일치)이며 `packages/cli/dist`가 필요해 `npm run build` 뒤에만 돈다.
- controller 쪽 `actionability` 사용: `packages/cli/src/templates.ts:291,307`과 `references/context-review/index.md:59`가 `must_fix | advisory` 어휘를 쓴다. controller가 강등할 때 이 값을 `advisory`로 낮추므로 어휘는 유지한다.

#### Target behavior

- 성공: `agents/bouncer-reviewer.md` 도입부에 "Review adversarially. Assume the change is wrong until the snapshot proves otherwise…" 문단이 있고, Discovery 문장과 Calibration이 "must-fix만 보고하고 구체적 실패(입력·경로·brief 조항과 무엇이 깨지는지)를 이름 붙일 수 없으면 finding이 아니다"로 바뀐다. Over-engineering은 Extra scope creep, 코드베이스가 이미 제공하는 기능의 재발명, 실제 품질 결함일 때만 보고한다. 출력 계약의 actionability hint는 `must_fix`이며 `advisory`를 내지 않는다. 빈 Findings는 유효한 결과다.
- `references/review/assets/reviewer-prompt.md`도 같은 규칙을 받는다(Discovery 규칙과 Output의 actionability).
- `agents/bouncer-context-reviewer.md`에는 적대적 자세 문단만 더해지고 Calibration의 보고 기준과 `nit` 보고는 유지된다.
- `.codex/agents/bouncer-reviewer.toml`·`bouncer-context-reviewer.toml`은 Markdown과 완전 일치하도록 재생성된다.
- 보존: severity 정의(`blocker`/`major`/`minor`), delta 모드 문구, controller 강등 규칙 문구는 바뀌지 않는다. `minor`는 "반드시 고쳐야 하지만 영향 범위가 작은 것"으로 남는다.

#### Interface

- 제공: 위 세 문서의 개정 문구. 검증용 테스트 `test/reviewer-adversarial-brief.test.js`.
- 거부: reviewer가 `advisory` actionability finding을 내는 것(문서가 더 이상 지시하지 않는다). context-reviewer의 보고 기준 축소(변경하지 않는다).
- 도메인 용어: "must-fix"는 brief·Contract에 어긋나거나 계약·테스트를 깨거나 오류 경로·보안 구멍이 있거나 회귀를 잡는 테스트 없이 동작을 바꾸는 것이다. 예: 새 분기가 있는데 그 분기를 실행하는 테스트가 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-reviewer.md` | 도입부, `### Discovery`, `## Calibration (severity)`, Over-engineering 루브릭, `## Output contract` | Modify | 모든 실제 이슈 보고 | 적대적 자세 추가, 필수 수정만 보고, `advisory` 제거 | `agents/bouncer-reviewer.md:76,177,197,222` |
| `agents/bouncer-context-reviewer.md` | 도입부 | Modify | 계획 문서 리뷰 자세 | 적대적 자세 문단만 추가 | 사용자 결정: 계획 리뷰는 보고 기준 유지 (`:213,250`는 그대로) |
| `references/review/assets/reviewer-prompt.md` | Discovery rules, Output | Modify | inline fallback 리뷰어 프롬프트 | 같은 규칙으로 맞춤 | `reviewer-prompt.md:113,174` |
| `.codex/agents/bouncer-reviewer.toml` | 생성물 | Modify | Markdown 원본의 TOML 사본 | 재생성 | `test/agents.test.js:55~62` 동기화 계약 |
| `.codex/agents/bouncer-context-reviewer.toml` | 생성물 | Modify | 같음 | 재생성 | 같음 |
| `test/reviewer-adversarial-brief.test.js` | 문서 단언 | Create | 해당 없음 | 개정 문구 단언 | 회귀 방지 |

#### Constraints

- TOML은 손으로 고치지 않는다. 아래 Checklist의 생성 명령으로만 갱신한다.
- `lint:docs`가 고정한 agent 문서 heading 구조(`scripts/lib/doc-shape-contracts.js`의 agent 계약)를 유지한다.
- 기존 단언을 바꿀 수 있는 곳은 없다. `test/agents.test.js`는 수정하지 않는다.
- reviewer 출력 계약의 필드 이름(`actionability`, `origin`, `severity`)은 그대로 둔다.

### gates-review/adversarial-review-tiering/002 · `dd787ac7`

#### Goal & intent

`resolveSubagentRole`이 호출 단위 `tier`를 받아 `model_tiers.<provider>.<tier>`로 모델을 해석하고(slot보다 우선), `bouncer subagent-model --agent <name> --tier <t>`로 노출한다. 이후 task(003 dispatch 계산, 004 훅)가 쓰는 기반이다. 검증 명령은 `node --test test/subagents.test.js test/cli-project-commands.test.js test/cli-help.test.js`.

#### Current behavior

- 입력/상태: `resolveSubagentRole({repoRoot, agentName, provider})`(`packages/cli/src/subagents.ts:100~`)은 slot slug → `roles.<agent>.tier`의 `model_tiers` 매핑 → inherit 순으로 해석한다(`:149` slot, `:153` tier 없음, `:157~167` 등급 매핑). 호출이 등급을 줄 방법이 없다.
- 출력: `cmdSubagentModel`(`packages/cli/src/cli-project-commands.ts:~165`)은 `--agent`·`--provider`·`--json`만 받는다. usage 문구는 `packages/cli/src/cli-usage.ts:24`.
- 재현: `node packages/cli/bin/bouncer subagent-model --agent bouncer-reviewer --tier strong`는 `--tier`를 무시하고 slot 값을 낸다. 기존 테스트: `test/subagents.test.js:20`(dispatch 메타데이터), `test/cli-project-commands.test.js:1385,1402`(subagent-model 출력), `test/cli-help.test.js:88`(usage 문자열 단언), `test/subagents.test.js:510`(문서 계약).
- I/O 관찰 지점: 설정은 `readConfig(repoRoot)`(`subagents.ts:106`)로만 읽고 프로세스 spawn은 없다.

#### Target behavior

- 성공: `resolveSubagentRole`에 `tier`(`strong`|`standard`|`light`)를 주면 slot을 건너뛰고 `model_tiers.<provider>.<tier>`로 해석해 `{ ok: true, tier, model, source: 'tier', effort }`를 낸다. 매핑 값 `inherit`는 `model: null`이다. `effort`는 기존처럼 `roles.<agent>.effort`를 따른다. `resolveSubagentDispatch`와 `resolveSubagentModel`도 `tier`를 받아 같은 규칙을 쓴다.
- 실패 경로: 호출이 준 tier에 매핑이 없으면 `{ ok: false, code: 'tier-unmapped', next: 'model_tiers.<provider>.<tier>' }`다(다른 등급으로 대체하지 않는다). tier가 세 값이 아니면 `{ ok: false, code: 'role-config-invalid', next: 'tier' }`다. provider를 모르면 기존처럼 `source: 'inherit'`다.
- CLI: `--tier`가 있으면 위 결과를 쓰고, 오류 변형은 기존 형식(stderr 한 줄, exit 1)을 따른다. `--tier` 값이 세 값이 아니면 usage 오류로 exit 2다.
- 보존: `tier`를 주지 않으면 해석 결과가 변경 전과 완전히 같다. `resolveSubagentModel`·`resolveSubagentDispatch`의 반환 키는 늘리지 않는다.

#### Interface

- 제공: `resolveSubagentRole(opts: { repoRoot?, agentName?, provider?, tier? }) → RoleResolution`, `resolveSubagentModel`·`resolveSubagentDispatch`의 `tier?` 인자, CLI 플래그 `--tier <strong|standard|light>`(`--agent`와 함께만 의미가 있다).
- 거부 (throw 없음, 오류 변형): 알 수 없는 tier 문자열 → `role-config-invalid`(함수) / exit 2(CLI), 매핑 없는 tier → `tier-unmapped`(함수) / exit 1(CLI). CLI에서 `--tier`가 `--agent` 없이 오거나, 값이 비었거나 반복돼 문자열 하나가 아니거나, `--agent`가 알려진 역할이 아니면 모두 사용법 오류 exit 2(기존 `requireNamedAgent`와 같은 경로)이고 stdout은 비어 있다.
- fallback (miss): `tier` 미지정은 기존 우선순위(slot → roles → inherit)로 돌아간다.
- 도메인 용어: "호출 단위 tier"는 `roles.<agent>.tier`가 아니라 호출 인자로 준 등급이다. 예: `resolveSubagentRole({ agentName: 'bouncer-reviewer', tier: 'strong' })`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/subagents.ts` | `resolveSubagentRole`, `resolveSubagentModel`, `resolveSubagentDispatch` | Modify | slot → roles 등급 → inherit 해석 | `tier` 인자 추가, 지정 시 slot 건너뛰고 매핑으로 해석 | 해석의 단일 진입점 (`subagents.ts:100~167`, 호출 `review-dispatch.ts:708,972,986`) |
| `packages/cli/src/cli-project-commands.ts` | `cmdSubagentModel` | Modify | `--agent`·`--provider`·`--json` 처리 | `--tier` 파싱·검증, `resolveSubagentRole`에 전달 | 훅이 쓰는 CLI 진입점 (`cli-project-commands.ts:165~200`) |
| `packages/cli/src/cli-usage.ts` | `subagent-model` usage | Modify | usage 문자열 | `[--tier <tier>]` 추가 | `cli-usage.ts:24`, `test/cli-help.test.js:88` |
| `test/subagents.test.js` | tier 인자 테스트 | Modify | 역할 해석 단언 | tier 지정 4경로 단언 추가 | 소비자 survey: `test/subagents.test.js:20,510` |
| `test/cli-project-commands.test.js` | `subagent-model --tier` | Modify | CLI 출력 단언 | `--tier` 성공·exit 1·exit 2 단언 추가 | `test/cli-project-commands.test.js:1385,1402` |
| `test/cli-help.test.js` | usage 단언 | Modify | usage 문자열 정규식 | 새 usage 문자열로 갱신 | `test/cli-help.test.js:88` |

#### Constraints

- `tier`를 주지 않는 모든 호출의 결과는 변경 전과 같다(기존 테스트 전부 통과).
- 바꿀 수 있는 기존 단언은 `test/cli-help.test.js:88`의 usage 정규식 하나이며 새 기대값은 `/subagent-model --agent <name> \[--provider <name>\] \[--tier <tier>\] \[--json\]/`이다.
- 설정 원문은 `displayTier`(`subagents.ts:83`)를 거쳐서만 오류 메시지에 싣는다.
- 오류 stderr는 한 줄 계약을 유지한다.

### gates-review/adversarial-review-tiering/003 · `7a2a3fd1`

#### Goal & intent

`review-dispatch plan`과 `review-dispatch execute` 성공 payload에 `reviewer_tier`(`standard`|`strong`)와 `reviewer_tier_applied`(boolean)를 싣고, 계산된 등급을 `agent_dispatch.model`에 적용한다. 사용자는 `review.min_reviewer_tier`로 하한만 올릴 수 있다. 검증 명령은 `node --test test/review-dispatch.test.js test/cli-help.test.js test/context-review-state.test.js`.

#### Current behavior

- 입력/상태: plan 분기는 `agentDispatch = resolveSubagentDispatch({ repoRoot, agentName: 'bouncer-context-reviewer' })`를 한 번 만들고 `perspectives`/`single` 반환에 싣는다(`packages/cli/src/review-dispatch.ts:707~709`, `:738`, `:754`). execute 분기는 `resolveSubagentDispatch({ repoRoot, agentName: 'bouncer-reviewer' })`를 delta와 일반 반환에서 각각 호출한다(`:972`, `:986`). commit task 수는 `commitTasks.tasks.length`(`:714~716`), execute의 위험은 `risk.flags`(`:939`, `:991`)다.
- 출력: payload에 등급 정보가 없다. `agent_dispatch` 모양은 `{ agent, provider, model }`로 고정이다(`review-dispatch.ts:95,116`; `subagents.ts:174`는 키를 더하지 말라고 명시).
- 재현: `node --test test/review-dispatch.test.js`가 plan(`test/review-dispatch.test.js:380~`)과 execute(`:1129`, `:1631`, `:1659`)의 `agent_dispatch` 단언을 가진다. `test/context-review-state.test.js`는 저장된 plan payload를 읽는다.
- I/O 관찰 지점: 설정은 `readConfig`로 읽고(`subagents.ts`), task 문서는 `listTasksDocs`/`readDoc`으로 읽는다(`review-dispatch.ts:1008~`). git은 execute 분기만 `exec`로 부른다.

#### Target behavior

- 성공: 두 분기의 성공 payload(plan의 `single`/`perspectives`, execute의 일반·delta)에 `reviewer_tier`와 `reviewer_tier_applied`가 있고 `reasons`에 등급 근거 한 줄이 더해진다. 규칙: commit task 수 ≥ 3(blueprint 범위 리뷰만) 또는 해당 범위 `review_risk` 합집합이 비어 있지 않으면 `strong`, 아니면 `standard`다. `review.min_reviewer_tier`가 있으면 둘 중 높은 쪽이다. 개수의 출처는 plan이 `commitTasks.tasks.length`, blueprint 범위 execute(`taskId` 없음, delta 포함)가 `listTasksDocs`의 commit task 수(verification 제외)이고, task 범위 execute(`taskId` 있음)는 1로 본다. 위험은 plan이 모든 commit task의 `unionCommitReviewRisk`, execute가 기존 `risk.flags`다. 모든 관점이 같은 등급이다.
- 적용: `reviewer_tier`가 `strong`일 때만 `resolveSubagentRole({ repoRoot, agentName, tier: 'strong' })`를 부르고, 결과가 `ok`이며 `source === 'tier'`이면 `agent_dispatch = { agent, provider, model }`을 그 결과로 바꾸고 `reviewer_tier_applied: true`다(매핑 값이 `inherit`면 `model: null`). `standard`는 호출하지 않고 `agent_dispatch`를 기존 해석 그대로 두며 `reviewer_tier_applied: false`다(역할의 기존 설정이 기본이라 slot을 낮추지 않고, 훅의 strong 전용 통과 규칙과 일치한다). `strong`인데 `tier-unmapped`이거나 provider를 모르면 기존 해석 그대로, `reviewer_tier_applied: false`, `reasons`에 `reviewer tier strong not applied: <code> (fix: <next>)`가 더해진다.
- 실패 경로: reviewer가 있는 경로에서 `review.min_reviewer_tier`가 `standard`/`strong`이 아니면(`light`, 오타, 비문자열) 성공 payload 없이 `{ ok: false, error: 'review config invalid', reason: 'review-min-reviewer-tier-invalid', next: 'review.min_reviewer_tier' }`를 낸다. plan에서 `unionCommitReviewRisk`가 실패(S30)하면 그 실패를 그대로 돌려준다.
- 보존: light 최초 계획 리뷰 `skip` payload에는 reviewer가 없으므로 `reviewer_tier`를 싣지 않고 `review.min_reviewer_tier`도 검사하지 않는다. 기존 필드, `agent_dispatch` 키 집합, 전략·관점 선택 규칙은 바뀌지 않는다.

#### Interface

- 제공: payload 필드 `reviewer_tier: 'standard' | 'strong'`, `reviewer_tier_applied: boolean`. config 키 `review.min_reviewer_tier: 'standard' | 'strong'`(부재 가능). `bouncer config` 도움말과 `docs/configuration.md`의 새 행.
- 거부: `review.min_reviewer_tier`의 `light`·오타·비문자열 → 위 `ok: false`. 작성자 frontmatter에서 등급을 지정하는 경로는 없다.
- throw vs miss: throw는 없다. `tier-unmapped`는 miss이며 기존 해석으로 돌아간다. config 값 오류는 `ok: false`다.
- 도메인 용어: "범위 `review_risk` 합집합"은 plan에서는 모든 commit task의 합집합, execute에서는 기존 `risk.flags`다. 예: task 한 개가 `public_interface`면 `strong`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/review-dispatch.ts` | plan 분기(`agentDispatch`), `classifyExecuteReview`, `unionCommitReviewRisk` | Modify | 역할 설정 모델로 `agent_dispatch`만 구성 | 등급 계산·적용 헬퍼 추가, 두 분기 payload에 필드 추가 | 호출 `review-dispatch.ts:708,972,986`; 타입 `:95,116` |
| `packages/cli/src/cli-config-command.ts` | `review.min_reviewer_tier` 도움말 | Modify | config 키 읽기 전용 도움말 | 새 키 줄 추가 | `cli-config-command.ts:35~44` |
| `docs/configuration.md` | 필드 표 | Modify | 설정 키 문서 | 새 행 추가 | 도움말·문서 일치 계약 (`test/subagents.test.js:510~534`) |
| `test/review-dispatch.test.js` | plan·execute 단언 | Modify | payload 단언 | 경계·적용·거절 단언 추가 | 소비자 survey: `:380~`, `:1129`, `:1631`, `:1659` |
| `test/cli-help.test.js` | config 도움말 단언 | Modify | 도움말 키 단언 | 새 키 단언 추가 | `test/cli-help.test.js`의 config help 테스트 |

#### Constraints

- 기존 payload 단언 중 `assert.deepStrictEqual(json.agent_dispatch, d.agent_dispatch)`(`test/review-dispatch.test.js:1144`, `:1631`, `:1659`)는 값이 같게 유지되어야 한다. `model_tiers`가 없는 config에서는 `agent_dispatch`가 변경 전과 같다.
- 바꿀 수 있는 기존 단언은 없다. 새 필드가 생기므로 payload 전체를 `deepStrictEqual`로 비교하는 곳이 있으면 그 테스트만 새 두 필드를 포함하도록 고친다(파일 `test/review-dispatch.test.js`, 새 기대값 `reviewer_tier: 'standard'`, `reviewer_tier_applied: false`).
- `agent_dispatch` 키를 더하지 않는다.
- 임계값은 상수(`REVIEWER_STRONG_MIN_TASKS = 3`)로 한 곳에 둔다.

### gates-review/adversarial-review-tiering/004 · `cec37eb5`

#### Goal & intent

`hooks/subagent-model.js`가 reviewer·context-reviewer Agent 호출에서, 입력 `model`이 `bouncer subagent-model --tier strong`이 돌려준 모델과 정확히 같을 때는 모델을 덮어쓰지 않는다. 그 밖의 불일치는 변경 전과 같이 config 모델로 덮어쓴다. 검증 명령은 `node --test test/subagent-model-hook.test.js`.

#### Current behavior

- 입력/상태: 훅은 역할을 뽑은 뒤 `runRuntime(['subagent-model','--agent',canonical,'--provider','claude','--repo',cwd,'--json'])`로 한 번 조회하고(`hooks/subagent-model.js:67~68`), `previous !== model`이면 `replacement = { ...input, model }`로 덮어쓴다(`:87~96`). 조회 실패는 종료 2로 차단한다(`fail`, `:122~`).
- 출력: 입력 모델이 config 값과 다르면 항상 덮어쓰고 `additionalContext`로 알린다(`:111~118`). 그래서 `review-dispatch`가 strong으로 올린 모델도 되돌려진다.
- 재현: `test/subagent-model-hook.test.js:68`("mismatched model → config model replaces it")이 불일치 덮어쓰기를 고정한다. `:57,75,83,89,98,103`이 나머지 경로다.
- I/O 관찰 지점: CLI 조회는 `runRuntime`(`hooks/runtime-cli.js`)으로 spawn하며 테스트는 가짜 bin 스크립트를 쓴다(`test/subagent-model-hook.test.js:27~30`).

#### Target behavior

- 성공: 역할이 `reviewer` 또는 `context-reviewer`이고, 입력 `model`이 비어 있지 않은 문자열이며 조회 결과 `model`과 다를 때, 훅이 `subagent-model --agent <canonical> --provider claude --repo <cwd> --tier strong --json`을 한 번 더 조회한다. 응답이 JSON이고 `source`가 `'tier'`, `model`이 입력 `model`과 정확히 같으면 모델 보정을 건너뛴다(`effort` 보정은 기존대로 적용). 안내 메시지는 모델에 대해 내지 않는다.
- 실패 경로(기존 동작 유지): 두 번째 조회가 실패·시간 초과·비JSON·모델 불일치면 첫 조회 결과로 덮어쓴다(차단하지 않는다). 다른 역할(implementer, debugger, coordinator)은 두 번째 조회를 하지 않고 기존처럼 덮어쓴다. 입력 `model`이 config 값과 같으면 기존처럼 변경 없음이다.
- 보존: 첫 조회 실패의 차단(종료 2), 옛 runtime 안내, inherit 처리, 비대상 payload 통과는 변경 전과 같다.

#### Interface

- 제공: 훅 동작 변경(위). 내부 헬퍼 `isStrongTierModel(role, cwd, model)` → boolean(파일 내부, 비공개).
- 거부: 하향 모델(`strong`이 아닌 다른 값)과 strong 매핑이 없는 경우 → 기존 덮어쓰기. 임의 문자열 모델 → 덮어쓰기.
- throw vs miss: throw 없음. 두 번째 조회 실패는 miss이며 덮어쓰기로 돌아간다.
- 도메인 용어: "strong 매핑 모델"은 `model_tiers.claude.strong`이 가리키는 slug다. 예: `claude-opus-5-5`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `hooks/subagent-model.js` | `handle`, `isStrongTierModel`(신규) | Modify | 모든 불일치 모델을 config 값으로 덮어씀 | 리뷰어 두 역할에 한해 strong 일치 시 통과 | 덮어쓰기 지점 (`hooks/subagent-model.js:87~96`) |
| `test/subagent-model-hook.test.js` | 상향 통과·하향 거절·조회 실패 | Modify | 훅 단언 | 세 경로 테스트 추가 | 소비자 survey: `test/subagent-model-hook.test.js:57~103` |

#### Constraints

- 이 task는 CLI `--tier`(TASKS-002)에 `depends_on`을 걸지 않는다. 훅 테스트는 가짜 bin을 쓰고, 훅이 두 번째 조회를 받지 못하면(옛 runtime 포함) 기존 덮어쓰기로 돌아가므로 통합 순서와 무관하게 안전하다. 실제 `--tier` 연동은 TASKS-005 문서와 종단 CI가 확인한다.
- 기존 단언(`test/subagent-model-hook.test.js:57~103`)은 그대로 통과해야 한다. 바꿀 수 있는 기존 단언은 없다.
- 두 번째 조회는 같은 시간 제한(`COMMAND_TIMEOUT_MS`)을 쓴다.
- 이 task가 hooks.json 명령 형태를 바꾸는 `hook-exec-bit` blueprint와 `test/subagent-model-hook.test.js:21`을 함께 건드릴 수 있으므로, 이 task는 해당 단언 줄(등록 명령 비교)을 수정하지 않는다.

### gates-review/adversarial-review-tiering/005 · `f9757799`

#### Goal & intent

controller가 읽는 규칙·워크플로 문서가 `review-dispatch` payload의 `reviewer_tier`와 `reviewer_tier_applied`를 쓰도록 안내하고, 호출 직전 재해석이 등급을 유지하도록 `--tier <payload.reviewer_tier>`를 쓰게 한다. 검증 명령은 `node --test test/reviewer-tier-docs.test.js test/subagents.test.js test/skill-bouncer-surface.test.js`.

#### Current behavior

- 입력/상태: `skills/bouncer-run/references/agent-dispatch.md:333,340`은 "payload의 `agent_dispatch` snapshot으로 reviewer 모델을 고르고 호출 직전 현재 config와 다르면 다시 해석"하라고 한다. `skills/bouncer-plan/references/context-review.md:36~`도 같다. `rules/cli.md:409`(usage 줄), `:450~`(subagent-model 설명), `:463~`(payload 설명)과 `rules/subagent-model.md:12`(1항)는 `--tier`와 `reviewer_tier`를 모른다.
- 출력: 이대로면 재해석이 `bouncer subagent-model --agent <name>`(등급 없음)을 실행해 slot 모델이 돌아오고, 004의 훅이 그 값을 정상 값으로 보아 등급 상향이 사라진다.
- 재현: `rg -n "reviewer_tier|--tier" rules skills` 결과가 비어 있다. 기존 테스트: `test/subagents.test.js:510~534`(cli.md·configuration.md 문서 계약), `test/skill-bouncer-surface.test.js`(워크플로 문서 구조).

#### Target behavior

- 성공: `rules/cli.md`는 usage 줄(`:409`)을 바꾸지 않고(`test/subagents.test.js:524`가 기존 문자열을 단언한다) 바로 아래 설명에 `subagent-model --agent <name> --tier <tier>`를, payload 설명에 `reviewer_tier`/`reviewer_tier_applied`를 서술한다. `rules/subagent-model.md` 1항에 "리뷰어는 payload의 `reviewer_tier_applied`가 true(항상 `strong`)이면 호출 직전 `--tier <reviewer_tier>`로 재해석하고, false이면 기존 `subagent-model --agent <name>`을 쓴다"가 추가된다. `agent-dispatch.md:333,340`과 `context-review.md:36~`가 같은 절차를 가리킨다(규칙 본문은 `rules/subagent-model.md` 하나에 두고 나머지는 참조).
- 실패 경로: 문서 테스트는 네 문서 중 하나라도 `reviewer_tier`/`--tier`를 빠뜨리면 파일 이름을 담아 실패한다.
- 보존: 모델 거절 시 멈추고 보고하는 규칙(`rules/subagent-model.md` 3항)과 `agent_dispatch`가 "호스트 모델의 증명이 아님"이라는 문구는 유지한다.

#### Interface

- 제공: 위 문서 문단 4곳과 테스트 `test/reviewer-tier-docs.test.js`. 새 CLI 계약은 문서화만 하며 구현은 002~004 소유다.
- 거부: 이 문서들은 `reviewer_tier_applied: false`일 때 등급 재해석을 요구하지 않는다(기존 절차 유지).
- 도메인 용어: "등급 유지 재해석"은 호출 직전 `bouncer subagent-model --agent <reviewer> --tier <payload.reviewer_tier>`를 다시 실행하는 것이다. 예: `--tier strong`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/cli.md` | `subagent-model` 설명, payload 설명 | Modify | CLI 계약 문서 | usage 줄 유지, `--tier`와 `reviewer_tier*` 서술 추가 | `rules/cli.md:409,450,463` |
| `rules/subagent-model.md` | 1항 | Modify | 모델 해석 절차 | 리뷰어 등급 유지 재해석 추가 | `rules/subagent-model.md:12` |
| `skills/bouncer-run/references/agent-dispatch.md` | Reviewer per task / final review | Modify | snapshot으로 모델 선택·재해석 | 규칙 참조와 등급 유지 문구 | `agent-dispatch.md:333,340` |
| `skills/bouncer-plan/references/context-review.md` | context-reviewer 해석 단락 | Modify | snapshot으로 모델 선택·재해석 | 같은 참조 | `context-review.md:36~` |
| `test/reviewer-tier-docs.test.js` | 문서 단언 | Create | 해당 없음 | 네 문서가 `reviewer_tier`를 언급하는지 단언 | 회귀 방지 |

#### Constraints

- 규칙 본문은 `rules/subagent-model.md`에만 쓰고 다른 문서는 참조한다(중복 서술 금지).
- `rules/cli.md:409`의 usage 줄은 바꾸지 않는다. `test/subagents.test.js:524`의 기존 단언(`bouncer subagent-model --agent <name> [--provider <name>] [--json]` 포함)을 그대로 통과해야 하며 그 테스트는 수정하지 않는다.
- `lint:docs`가 고정한 workflow·reference 문서 구조(조건부 적재 trigger, 링크)를 깨지 않는다.

### gates-review/adversarial-review-tiering/006

#### Goal & intent

TASKS-001~005가 통합된 상태에서 `npm run ci`가 통과함을 증명한다. 리뷰어 문서 개정, 등급 해석·계산, 훅, 문서 변경이 합쳐진 뒤에도 `check:emit`(Codex TOML 동기화 포함), `lint:docs`, 단위 테스트가 모두 통과해야 한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### gates-review/adversarial-review-tiering/007 · `78a768d4`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/tiers.json` — 기록된 CI 실패를 복구한다.
- Modify `rules/cli.md` — 기록된 CI 실패를 복구한다.
- Modify `skills/bouncer-plan/references/context-review.md` — 기록된 CI 실패를 복구한다.
- Modify `skills/bouncer-run/references/agent-dispatch.md` — 기록된 CI 실패를 복구한다.
- Modify `test/reviewer-adversarial-brief.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

### gates-review/adversarial-review-tiering/008 · `cc37d402`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F1 (major, spec_scope, must_fix) — test/review-dispatch.test.js#execute brief/light security reasons assertions — tasks/003 Constraints — note: Merged with correctness_tests CT-TIER-001 (same file/symbol): existing exact reasons asserts weakened to slice(0,2), forbidden by 003 Constraints; pin provider/env in fixture and restore full deepStrictEqual including the tier reason line.
- F2 (minor, spec_scope, must_fix) — agents/bouncer-reviewer.md#Rubric Over-engineering heading — tasks/001 Checklist — note: Heading still says '(advisory -> finding when actionable)', contradicting Contract 'no advisory output instruction' and the new output contract; also in generated .codex/agents/bouncer-reviewer.toml.

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/review-dispatch.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `agents/bouncer-reviewer.md` — 기록된 리뷰 finding을 수정한다.
- Modify `.codex/agents/bouncer-reviewer.toml` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.