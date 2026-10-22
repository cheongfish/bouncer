---
type: bouncer.explain
title: doc-quality-gate-removal explain
description: Explain for doc-quality-gate-removal
resource: .bouncer/context/epics/gates-review/blueprints/doc-quality-gate-removal/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-22T13:52:16.060+09:00'
bouncer:
  id: EXPLAIN-doc-quality-gate-removal
  epic_id: gates-review
  blueprint_id: doc-quality-gate-removal
  status: published
  comprehension:
    - range_from: 748e87258a27156e52f17e404d7e67aded4073a3
      range_to: c587e7476a5759059fc741802f69a684df019fed
      diff_sha: 8477d5fd2b3ebaab92f8620f27b01d9999d0be1d872319befdc7c5eff9113c97
      recorded_at: '2026-10-22T14:05:00+09:00'
  task_commits:
    - task: gates-review/doc-quality-gate-removal/001
      sha: e27d81ae
      intent_anchor: task-001
    - task: gates-review/doc-quality-gate-removal/002
      sha: 1c731af6
      intent_anchor: task-002
    - task: gates-review/doc-quality-gate-removal/003
      sha: d6c3e13a
      intent_anchor: task-003
    - task: gates-review/doc-quality-gate-removal/005
      sha: c587e747
      intent_anchor: task-005
---
# Explain

## Background

plan gate는 실행 안전과 무관한 문서 품질까지 판정했다. 절 누락·TODO, Touch가 정당화하지 않는 `affected_paths`, Do not touch 교차, context review 상태, scaffold 주석 잔존, 없는 Touch 경로, epic 등록부 보정이 승인 단계를 막았다. 그래서 실행과 무관한 형식 문제로 계획이 반려됐다. execute G14와 finalize G21도 finding·round 형식 위반만으로 실패했다.

이 변경은 범위·검증 증적·신선도·승인 드리프트·마감 완결성만 gate에 남긴다. 문서 품질 코드(G10·G11·G12·G18·G22·G25·G26–G31)는 plan gate에서 사라지고, plan draft는 G5·G19·G20만 낸다. 삭제한 번호는 결번이며 다른 판정에 재사용하지 않는다.

## Code

- `scripts/src/lib/validate-gates-plan.ts`: 삭제 코드 판정과 전용 helper(`checkRegistryGates`, `checkTouchPathsExist`, 신선도 계산)를 지웠다. `review-risk-missing` 경고는 필수 절 누락과 무관하게 Touch 절이 있으면 낸다. `task-split`, `dag-*` 경고와 남는 G 코드의 message·순서는 그대로다.
- `scripts/src/lib/validate-gates-shared.ts`: `isBlockingReviewFailure`가 `collectFindingFailures` 메시지 중 실질 판정만 고른다. 열린 finding이 accepted review에 남은 경우, 열린 `must_fix`, findings가 배열이 아닌 경우, status·actionability 오류가 실패로 남는다. execute G14와 `checkG21`이 이 함수를 쓴다. 공용 검사기와 `review record`·`accept-risk`의 기록 시점 검증은 그대로다.
- 제한: 이 함수의 정규식은 `s` 플래그가 없어 id·status에 줄바꿈이 있는 손편집 `review.md`는 걸러질 수 있다. rounds가 배열이 아닌 경우의 메시지도 목록에 없다. 둘 다 후속 blueprint 대상이다.
- 설계 선택: `planScaleOf`는 `isLight`만 돌려준다. `GateDeps.planSnapshot` 슬롯과 `pathJustifiedByTouch`·`parseTouchRows`는 쓰는 곳이 없어 지웠다.
- 문서와 주석(`rules/`, `skills/`, `references/`, `docs/`, src 주석, `CHANGELOG.md`)은 삭제 코드를 차단 조건으로 서술하지 않게 고쳤다. context review는 `/bouncer-plan` step 5의 권고 절차로 남는다.
- `.codex/agents/bouncer-context-reviewer.toml`은 `agents/bouncer-context-reviewer.md`에서 생성되는 파일이라 Markdown을 고친 뒤 다시 만들었다.

## Quiz

1. 승인된 blueprint의 `context-review.md` status가 accepted가 아니다. plan gate 결과는?
   - A) G18로 실패한다.
   - B) 이 조건만으로는 실패하지 않는다.
   - C) G10으로 실패한다.
2. accepted review의 finding에 severity 오타만 있다. execute gate G14는?
   - A) G14를 내지 않는다.
   - B) G14로 실패한다.
   - C) 경고로 바뀌어 통과한다.
3. accepted review에 status가 `open`인 finding이 남아 있다. execute gate G14와 finalize G21은?
   - A) 형식 문제라 통과한다.
   - B) 경고만 낸다.
   - C) 계속 실패한다.
4. plan draft 검사가 이제 내는 코드는?
   - A) G5·G10·G11·G12
   - B) G5·G19·G20·G25
   - C) G5·G19·G20

## Tasks

### gates-review/doc-quality-gate-removal/001 · `e27d81ae`

#### Goal & intent

plan gate가 G10·G11·G12·G18·G22·G25·G26–G31을 더 이상 판정하지 않고, plan draft 검사가 G5·G19·G20만 내게 한다. 남는 G1–G3·G5·G19·G20과 S 코드, `task-split`·`dag-*`·`review-risk-missing` 경고는 같은 입력에서 같은 결과를 낸다. 완료 판정은 Checklist의 focused 테스트와 frontmatter `verify`다.

#### Current behavior

- `checkPlanGate`(`scripts/src/lib/validate-gates-plan.ts:503`)가 순서대로 판정한다.
  - `checkRegistryGates`(:443-495, 호출 :523-525)가 `epicRegistry.readEpicRegistry(repoRoot)`(:451)로 `.bouncer/epics.json`을 읽고 G26(:453)·G27(:469)·G28(:473)·G29(:479)·G31(:486)·G30(:490/:493)을 낸다.
  - G22(:533-546)는 `scanLegacyScaffoldComments`로 디스크의 blueprint 문서를 읽는다.
  - G18(:548-605)은 `context-review.md` status·finding(`collectFindingFailures`)·`contextReviewFreshnessFailure`(~:814-880)를 본다. 신선도는 `currentPlanSnapshot`(:787) → `computePlanSnapshot` 또는 `deps.planSnapshot`(`validate-gates-shared.ts:73-74`)이다. `ctx.parseErrors`(:556)는 G18만 쓴다.
  - G10(:610)은 blueprint 단위 절 누락이다.
  - G25는 `checkTouchPathsExist`(:694-760)가 `parseTouchRows` 결과로 `fs.existsSync`(~:743)와 `touchPathEscapesRepo`(:676)를 본다. 호출은 :629-634이다.
- `checkTaskScope`(:908-990)는 G5(:921) 뒤 `task-split` 경고(:926-936)를 낸다. 이어서 G10(:949 누락, :953 TODO)을 판정한다. G10이 통과한 `else` 분기에서만 G11(:962, `pathJustifiedByTouch`)·G12(:967, `pathsOverlap`)·`review-risk-missing` 경고(:972-987)를 낸다.
- `checkPlanDraft`(:1001-)는 task마다 `checkTaskScope`를 돌린다. 그래서 G5·G10·G11·G12·G19·G20을 내고, G10은 :1013에서도 낸다. `review-dispatch.ts:536`이 이 결과를 쓴다.
- `planScaleOf`(:650)의 `sectionKeys`는 G10만 읽는다. `isLight`는 `checkScopedTerminalPolicy`와 G25 skip이 쓴다.
- `GATE_FAILURE_HINTS`(`scripts/src/lib/validate.ts`)에 G18(:61)·G22(:73)·G25(:89)·G26–G31(:96-118) 행이 있다.
- `pathJustifiedByTouch`(`validate-sections.ts:248`)와 `parseTouchRows`(:229)는 이 파일 밖에서 src가 쓰지 않는다. `parseTouchRows`는 `test/validate-gates.test.js:3885`만 직접 부른다.
- 재현 명령: `npm run build` 뒤 `node --test test/validate-gates.test.js`. 지금은 G10·G18·G25·G26–G31 테스트가 해당 코드를 기대하며 통과한다.

#### Target behavior

- 성공 경로: 다음 조건만 어긋난 approved blueprint는 plan gate에서 `ok: true`이고 failures에 해당 코드가 없다.
  - 절 누락·TODO 자리표시
  - Touch가 정당화하지 않는 `affected_paths`
  - Do not touch 교차
  - accepted가 아닌 `context-review.md`
  - scaffold 주석 잔존
  - 없는 Touch 경로, 저장소 밖 Touch 경로
  - 미등록·비활성·legacy epic, attribution·area 누락
- 실패 경로: `affected_paths` 누락·빈 배열은 G5, status는 G1–G3, DAG는 G19, terminal은 G20, 문서 구조는 S 코드로 지금과 같은 message·순서로 실패한다.
- 보존:
  - `task-split`과 `dag-serial-overlap`·`dag-disjoint-edge` 경고는 그대로다.
  - `review-risk-missing`은 Touch 절이 있는 commit task에서 지금과 같은 message로 낸다. 절 누락·TODO 여부와 무관하다.
  - plan draft는 G5·G19·G20만 낸다.

#### Interface

- 제공:
  - `checkPlanGate`·`checkPlanDraft`의 export 이름과 시그니처는 유지한다. 출력 코드 집합만 줄어든다.
  - `GateDeps`에서 `planSnapshot` 슬롯을 뺀다. 다른 src 사용처가 없다(`rg -n "planSnapshot" scripts/src` 기준으로 :790만 호출).
  - `validate-sections`의 `pathJustifiedByTouch`·`parseTouchRows` export를 뺀다.
- 거부:
  - 삭제한 코드 번호를 다른 판정에 다시 쓰지 않는다.
  - `collectFindingFailures`·`CONTEXT_REVIEW_STATUS`·`TODO_RE`·`extractPathCandidates`·`pathsOverlap`·`parseTasksSections`·`scanLegacyScaffoldComments`·`readEpicRegistry`·`computePlanSnapshot` 자체는 다른 소비자가 있으므로 삭제하지 않고 이 파일의 import만 정리한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates-plan.ts` | `checkPlanGate`, `checkTaskScope`, `checkPlanDraft`, `checkRegistryGates`, `checkTouchPathsExist`, `contextReviewFreshnessFailure`, `currentPlanSnapshot`, `planScaleOf` | Modify | plan gate·draft의 G 코드 판정 | 삭제 대상 판정과 전용 helper·import 제거, `review-risk-missing` 조건을 Touch 절 존재로 바꿈 | 삭제 코드가 모두 이 파일에서 나온다 |
| `scripts/src/lib/validate-gates-shared.ts` | `GateDeps.planSnapshot` | Modify | G18 신선도 주입 슬롯 | 슬롯과 주석 제거 | 유일한 호출부가 G18이다 |
| `scripts/src/lib/validate-sections.ts` | `pathJustifiedByTouch`, `parseTouchRows` | Modify | G11·G25 전용 helper | 함수와 export 제거 | 삭제 뒤 src 사용처가 없다 |
| `scripts/src/lib/validate.ts` | `GATE_FAILURE_HINTS` | Modify | G 코드별 `next` 안내 | G18·G22·G25–G31 행과 :51 주석 제거 | 내지 않는 코드의 hint가 남는다 |
| `test/validate-gates.test.js` | G10·G11·G12·G18·G22·G25·G26–G31 테스트, `parseTouchRows` 테스트, review-risk 테스트 | Modify | 삭제 코드 기대 | 삭제 코드 테스트 제거, 통과 fixture와 draft·review-risk 테스트 갱신 | gate 출력 계약을 단언한다 |
| `test/cli-validate.test.js` | G18·G25 CLI 테스트(49-119, 437-525, 528-640, 917-957) | Modify | CLI에서 G18·G25 기대 | 제거하거나 일반 plan 통과로 바꿈 | CLI 출력 계약을 단언한다 |
| `test/validate-hints.test.js` | hint 코드 목록(38-55), G22 `next`(68-159) | Modify | hint 행 존재 단언 | 삭제 행을 목록과 fixture에서 뺌 | hint 표 계약을 단언한다 |
| `test/validate-structural.test.js` | S0+G18 테스트(694-749) | Modify | S0과 G18 동시 단언 | S0 단언만 남김 | G18 단언이 깨진다 |
| `test/review-dispatch.test.js` | `DRAFT_CODES`(:841), G18 부재 단언(1508-1532) | Modify | draft 코드 집합 단언 | `['G5','G19','G20']`로 바꾸고 G18 줄 정리 | draft 출력 계약을 단언한다 |

#### Constraints

- 남는 코드의 message 문자열과 failures 순서를 바꾸지 않는다.
- 삭제 코드 번호는 결번으로 남기고, `validate-gates.ts` 상단 주석 같은 코드 목록 서술은 TASKS-003에서 고친다. 이 task는 삭제하는 함수 안팎의 주석만 정리한다.
- coverage 임계값(lines 94·branches 82·functions 96)을 유지한다. 지운 코드의 테스트를 함께 지워 분모를 맞춘다.
- 테스트 이름은 `npm run lint:test-names` 규칙을 따른다.

### gates-review/doc-quality-gate-removal/002 · `1c731af6`

#### Goal & intent

execute G14와 finalize G21이 finding·round 형식 위반만으로는 실패하지 않게 한다. 다음은 계속 실패한다: 열린 `must_fix`, 열린 finding이 남은 accepted review, 배열이 아닌 findings, enum 밖 status·actionability, actionability 누락, review 부재·미승인, round 부재, stale 판정. `review record`·`accept-risk`의 기록 시점 검증은 바꾸지 않는다. 완료 판정은 Checklist의 focused 테스트와 frontmatter `verify`다.

#### Current behavior

- execute gate(`scripts/src/lib/validate-gates-run.ts:363-378`)는 `collectFindingFailures(...)`가 돌려준 모든 메시지를 `addUnit('G14', message, 'review')`로 낸다. 단, blueprint review 모드, verification task, `review.required: false`는 제외한다. commit gate(`checkCommitGate`, :390-470)는 G14를 계산하지 않는다.
- `checkG21`(`scripts/src/lib/validate-gates-finalize.ts:92-`)의 흐름은 다음과 같다.
  - 자체 판정: `blueprint review missing`(:105), `blueprint review not accepted`(:113), `blueprint review has no rounds`(:116-118)
  - 이어서 `collectFindingFailures(..., roundScope: 'blueprint')`(:120-131)의 모든 메시지를 G21로 낸다.
  - 그 뒤 `lastReviewHead`(`validate-gates-shared.ts:205-213`)로 stale 판정을 한다(:131-153). head가 없으면 일찍 반환한다.
- `collectFindingFailures`(`scripts/src/lib/validate-sections.ts:449`, export :711)의 메시지 구분은 다음과 같다.
  - 실질 판정: `finding <id> open in accepted review`(~:492), `accepted with open must_fix <id>`(~:555)
  - 형식 판정: `missing ## Findings body section`(:465), `findings must be an array`(:468), severity·status·note·필드·category·fingerprint·actionability·origin(:478-529), `collectRoundFailures`(:582-676)의 rounds 형식 전부
  - 메시지를 거르는 옵션은 없다.
- 같은 검사기를 다음도 쓴다: `review-record.ts:404`(record), `review-record.ts:529`(accept-risk), `context-review-projection.ts:142`. G18 호출(`validate-gates-plan.ts:582`)은 TASKS-001이 지운다.
- 재현 명령: `npm run build && node --test test/validate-gates.test.js`. 지금은 G14 형식 테스트(:646, :1176, :1189, :1219, :1252, :1271, :1301, :1398-1439, :3175, :3357, :3538)와 G21 형식 테스트(:3110-3137, :3154, :3567, :3593)가 실패 코드를 기대하며 통과한다.

#### Target behavior

- 성공 경로: severity 오타, note 누락, fingerprint 불일치, rounds 순서·mode·target 형식 오류만 있는 accepted review는 execute gate에서 G14를, finalize gate에서 G21을 내지 않는다.
- 실패 경로: 다음은 지금과 같은 message로 G14·G21이 된다.
  - `<label> finding <id> open in accepted review`
  - `<label> accepted with open must_fix <id>`
  - `<label> findings must be an array`
  - `<label> finding <id> status invalid: <v>`, `<label> finding <id> actionability invalid`, `<label> finding <id> actionability missing`
  - G21 `blueprint review missing`, `blueprint review not accepted`, `blueprint review has no rounds`
  - G21 stale 판정
- 보존:
  - G8(review not accepted) 판정은 그대로다.
  - `review record`·`accept-risk`는 같은 형식 위반 기록을 지금처럼 `ok: false`로 거절한다.
  - `context-review-projection` 결과도 같다.

#### Interface

- 제공: gate 쪽 판별 함수 하나. `validate-gates-shared.ts`에 둔다.
  ```ts
  // collectFindingFailures 메시지 중 gate가 실패로 남길 실질 판정인지
  function isBlockingReviewFailure(message: string): boolean;
  // true:  /^\S+ finding .+ open in accepted review$/
  //        /^\S+ accepted with open must_fix .+$/
  //        /^\S+ findings must be an array$/
  //        /^\S+ finding .+ status invalid: .*$/
  //        /^\S+ finding .+ actionability (invalid|missing)$/
  // id 자리는 `.+`다 — id가 없는 finding은 `(no id)`(공백 포함)로 찍힌다(validate-sections.ts:476)
  ```
  - execute G14 루프와 `checkG21` 루프는 이 함수가 true인 메시지만 낸다.
  - fail-closed 근거: `open in accepted review`는 `rec.status === 'open'`, `accepted with open must_fix`는 `rec.actionability === 'must_fix'` 정확 일치일 때만 나온다(`validate-sections.ts` collectFindingFailures). findings 배열·status·actionability가 깨지면 실질 판정을 할 수 없으므로 이 세 형식 메시지는 실패로 남긴다.
  - 예: `review finding F-1 open in accepted review` → true, `review accepted with open must_fix (no id)` → true, `review finding F-1 severity invalid: high` → false
- 거부: `collectFindingFailures`·`collectRoundFailures`의 시그니처·메시지·반환 순서는 바꾸지 않는다. 형식 메시지를 warning으로 옮기지도 않는다. gate 결과에서 빠질 뿐이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-gates-shared.ts` | 신규 추출 지점: 실질 리뷰 실패 판별 | Modify | gate 공용 helper | `isBlockingReviewFailure` 추가 | run·finalize 두 gate가 같은 기준을 쓴다 |
| `scripts/src/lib/validate-gates-run.ts` | `checkExecuteGate` G14 루프 | Modify | 모든 finding 메시지를 G14로 냄 | 실질 메시지만 냄, :364 주석의 G18 언급 정리 | G14 생성 지점이다 |
| `scripts/src/lib/validate-gates-finalize.ts` | `checkG21` | Modify | 모든 finding 메시지를 G21로 냄 | 실질 메시지만 냄 | G21 생성 지점이다 |
| `test/validate-gates.test.js` | G14·G21 형식 테스트 | Modify | 형식 위반 → G14·G21 기대 | 형식 위반 → 해당 코드 없음으로 바꾸거나 제거, 실질 테스트 유지 | gate 출력 계약을 단언한다 |

#### Constraints

- 실질 메시지의 문자열·순서는 바꾸지 않는다.
- G21 stale 판정은 `blueprint review has no rounds`와 `lastReviewHead` 흐름을 그대로 둔다.
- coverage 임계값을 유지한다. 판별 함수의 true·false 분기를 테스트한다.
- 테스트 이름은 `npm run lint:test-names` 규칙을 따른다.

### gates-review/doc-quality-gate-removal/003 · `d6c3e13a`

#### Goal & intent

TASKS-001·002가 지운 G10·G11·G12·G18·G22·G25·G26–G31과 G14·G21 형식 판정을, 플러그인 문서와 소스 주석이 더 이상 gate 차단 조건으로 서술하지 않게 한다. light의 세 필수 절은 "G10이 요구"가 아니라 작성 규칙으로 서술하고, context review는 `/bouncer-plan` step 5의 권고 절차로 서술한다. CHANGELOG `[Unreleased]`에 `### Removed`를 추가한다. 완료 판정은 Checklist의 잔존 검색과 frontmatter `verify`다.

#### Current behavior

- `rules/planning.md`에서 삭제 코드를 gate 판정으로 서술하는 곳: :72(light는 G18 없음), :74(`G10 requires only` — `test/rule-ownership.test.js:328-331`·`:433-436`이 locator `requires only`를 `## Lightweight cycle`에 고정), :77(G11), :79(G12), :105(G11–G17 unchanged), :107(G18·G10 차이)
- `rules/document-schema.md:171`: closure digest를 "G18 compares"로 서술한다.
- `rules/cli.md`
  - :417: plan draft `failures (G5, G10–G12, G19, G20)`
  - :432: `review record`가 "same finding/round checks as G21 and G14"를 통과한 뒤 기록한다고 서술한다.
- `skills/bouncer-run/references/review-round.md:150`: 저장된 `discovery → delta → delta` 이력이 "passes G21"이라고 서술한다.
- `skills/bouncer-plan/SKILL.md`: :212(G10 requires only), :261(no G18), :265(G10–G12), :297(G18 stale 복구 루프)
- `skills/bouncer-plan/references/context-review.md:124`: G18 비교
- `references/context-review/index.md`: :21·:27·:55·:66·:69(G18, G10–G12), :80(G25)
- `references/spec-authoring/index.md`: :148(G25), :215(G10), :218(G11), :223(G12), :246(G22)
- `agents/bouncer-context-reviewer.md`
  - :145: `### Out of judgment`에서 경로 존재를 "plan gate G25"가 판정한다고 서술한다. `test/skill-context-review.test.js:51-53`이 이 절의 `G25`를 고정한다.
  - :152: G10–G12를 언급한다.
- `docs/workflow.md:145-151`: light의 G18·G10·G11·G12를 서술한다. :12·:58의 G13–G14는 G14가 남으므로 그대로다.
- 소스 주석
  - `scripts/src/lib/validate-gates.ts:4`, `validate-structural.ts:35`
  - `validate-sections.ts`: :14, :21, :28-29, :194, :223, :531
  - `templates.ts`: :4, :59, :157, :171, :197
  - `scaffold.ts:434`, `review-dispatch.ts`(:509, :563), `cli-review-dispatch-command.ts:58`
  - `context-review-store.ts:195`, `context-review-transitions.ts:91`, `context-review-state.ts`(:38, :425), `context-review-contracts.ts:21`, `context-review-projection.ts`(:64-138)
  - `coordinator-repair.ts:831`, `validate-docs.ts`(:94, :111, :137, :154), `scaffold.ts:536`, `cli-review-dispatch-command.ts`(:69, :96)
  - `plan-snapshot.ts`(:21, :32), `path-overlap.ts:9`, `execution-dag.ts:48`, `comprehension.ts:13`, `legacy-comments.ts:11`
- `docs/context-ontology.md:6`: 예시 명령이 `--entity G10`이다.
- `CHANGELOG.md` `[Unreleased]`(:8)에는 `### Fixed`(:10)·`### Changed`(:19)·`### Added`(:25)가 있고 `### Removed`가 없다.

#### Target behavior

- 성공 경로: 아래 잔존 검색이 Do not touch 경로 밖에서 0건이다.
  ```bash
  rg -n --pcre2 "G(1[0-2]|18|22|2[5-9]|3[01])(?![0-9])" rules references skills agents docs scripts/src
  ```
  - `\b`를 쓰지 않는다. `G18이`처럼 한국어 조사가 붙으면 `\b`가 맞지 않아 잔존을 놓친다.
  - 예외 0: `docs/architecture/rule-ownership.md`(Do not touch), TASKS-001·002 소관 파일(`validate-gates-plan.ts`·`validate-gates-run.ts`·`validate-gates-finalize.ts`·`validate.ts`·`validate-gates-shared.ts`)은 그 task가 0건을 만든다
  - 예외 1: "결번" 또는 "removed"와 함께 쓴 이력 서술
  - 예외 2: `GOV-LIGHT-G10` ID
  - 예외 3: `scripts/src/lib/templates.ts`의 `LEGACY_SCAFFOLD_COMMENT_BODIES` 배열(:255-:321) 안 문자열. legacy 주석 판별 정본이라 바꾸지 않는다(Interface 거부)
- 보존
  - `rules/planning.md` `## Lightweight cycle`에 locator 문구 `requires only`가 남는다. `test/rule-ownership.test.js`가 그대로 통과한다.
  - `agents/bouncer-context-reviewer.md` `### Out of judgment`는 경로 존재와 문장 품질을 계속 finding 대상에서 제외한다. `stop-slop` 언급은 유지한다.
- 실패 경로: 문서 형태 검사(`npm run lint:docs`)나 주석 검사(`npm run lint:context-comments`)가 거절하는 문장 형식을 쓰지 않는다.
- CHANGELOG `[Unreleased]`에 `### Removed`가 생기고 다음 두 항목을 적는다.
  - 삭제 코드 목록과 남는 차단 조건
  - G14·G21 형식 메시지 삭제와 기록 시점 검증 유지

#### Interface

- 제공: 문서·주석 서술만 바뀐다. CLI 출력·코드 동작은 바뀌지 않는다.
- 거부: `LEGACY_SCAFFOLD_COMMENT_BODIES`(`templates.ts:255-`) 문자열은 legacy scaffold 주석을 판별하는 정확 일치 정본이다. 그 안의 G10·G11·G12 문구도 바꾸지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/planning.md` | `## Lightweight cycle` | Modify | light 계약과 gate 차이 | 세 절을 작성 규칙으로, G18·G11·G12 서술 삭제 | :72-:107 |
| `rules/document-schema.md` | closure digest 문단 | Modify | G18 비교 서술 | context review 기록 비교로 서술 | :171 |
| `rules/cli.md` | plan draft·`review record` | Modify | draft 코드 목록, 기록 검사 기준 | G5·G19·G20, 공용 finding/round 검사기 기준으로 서술 | :417, :432 |
| `skills/bouncer-run/references/review-round.md` | blueprint final review sequence | Modify | G21 통과 서술 | 읽기 호환으로 서술 | :150 |
| `skills/bouncer-plan/SKILL.md` | step 3 light, step 5, step 8 | Modify | G10·G18·G10–G12 서술 | 작성 규칙·권고 review로 서술, G18 stale 복구 문단 삭제 | :212, :261, :265, :297 |
| `skills/bouncer-plan/references/context-review.md` | closure digest | Modify | G18 비교 서술 | gate 언급 제거 | :124 |
| `references/context-review/index.md` | light·record·digest·경로 존재 | Modify | G18·G10–G12·G25 서술 | gate 언급 제거 | :21-:80 |
| `references/spec-authoring/index.md` | Touch·light·G22 문단 | Modify | G25·G10·G11·G12·G22 서술 | 작성 규칙으로 서술 | :148-:246 |
| `agents/bouncer-context-reviewer.md` | `### Out of judgment` | Modify | G25·G10–G12 서술 | 경로 존재는 finding 대상 아님으로 서술 | :145, :152 |
| `docs/workflow.md` | light 문단 | Modify | G18·G10·G11·G12 서술 | 작성 규칙과 G5 서술 | :145-:151 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 미출시 변경 기록 | `### Removed` 추가 | 프로젝트 규칙 |
| `test/skill-context-review.test.js` | Out of judgment 단언, :11-28 테스트 이름 | Modify | `G25` 문구 고정 | 새 문구 단언, G18 이름 정리 | :51-53 |
| `scripts/src/lib/validate-gates.ts` | 상단 주석 | Modify | 승인 범위 판정 코드 목록 | G5만 남김 | :4 |
| `scripts/src/lib/validate-structural.ts` | 상단 주석 | Modify | G11·G12 언급 | G5로 서술 | :35 |
| `scripts/src/lib/validate-sections.ts` | 상단·절 정의·경로 정규화 주석 | Modify | G10·G11·G12·G18 언급 | 해당 언급 제거 | :14-:531 |
| `scripts/src/lib/templates.ts` | 상단·review·explain·light 템플릿 주석 | Modify | G10·G14/G18 언급 | 작성 규칙·남는 G14로 서술, `LEGACY_SCAFFOLD_COMMENT_BODIES`는 그대로 | :4, :59, :157, :171, :197 |
| `scripts/src/lib/scaffold.ts` | scale 읽기·light 주석 | Modify | G10/G18 계약 서술 | plan gate 서술 정리 | :434, :536 |
| `scripts/src/lib/review-dispatch.ts` | dispatch 주석 | Modify | G10–G12·G18 언급 | G5·G19·G20, light skip으로 서술 | :509, :563 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | fingerprint·help 주석 | Modify | G18 mismatch·통과 언급 | 기록 검증 기준으로 서술 | :58, :69, :96 |
| `scripts/src/lib/context-review-store.ts` | 기록 주석 | Modify | G18 신선도 언급 | review 신선도로 서술 | :195 |
| `scripts/src/lib/context-review-transitions.ts` | projection 주석 | Modify | G18 판정 언급 | 기록 판정으로 서술 | :91 |
| `scripts/src/lib/context-review-state.ts` | 상단·restart 주석 | Modify | plan gate G18 언급 | gate 언급 제거 | :38, :425 |
| `scripts/src/lib/context-review-contracts.ts` | closure digest 주석 | Modify | G18 비교 언급 | gate 언급 제거 | :21 |
| `scripts/src/lib/context-review-projection.ts` | Findings 절 주석 | Modify | G18 요구 언급 | gate 언급 제거 | :64-:138 |
| `scripts/src/lib/coordinator-repair.ts` | 경로 선언 주석 | Modify | G11/G12 오인 언급 | 경로 선언 해석으로 서술 | :831 |
| `scripts/src/lib/validate-docs.ts` | 로더 주석 | Modify | G18 언급 | gate 언급 제거 | :94, :111, :137, :154 |
| `scripts/src/lib/plan-snapshot.ts` | 상단·문서 집합 주석 | Modify | G18과 digest 공유 서술 | context review 기록과 공유로 서술 | :21, :32 |
| `scripts/src/lib/path-overlap.ts` | `pathsOverlap` 주석 | Modify | G12 언급 | scope 충돌 판정으로 서술 | :9 |
| `scripts/src/lib/execution-dag.ts` | 충돌 판정 주석 | Modify | G12 언급 | 경로 중첩 규칙으로 서술 | :48 |
| `scripts/src/lib/comprehension.ts` | 빈 섹션 규칙 주석 | Modify | G10 공유 언급 | section 파서 공유로 서술 | :13 |
| `scripts/src/lib/legacy-comments.ts` | 상단 주석 | Modify | G22 언급 | 반환 의미만 서술 | :11 |
| `docs/context-ontology.md` | 예시 명령 | Modify | `--entity G10` 예시 | 남는 코드(`G5`) 예시로 바꿈 | :6 |

#### Constraints

- 사용자 대면 문서의 기존 언어를 따른다. rules·references·skills·agents는 영어, docs·CHANGELOG·소스 주석은 한국어다.
- 문장만 고치고 절 제목·절 순서는 바꾸지 않는다. `scripts/check-doc-shape.js`가 skill·reference 형태를 검사한다.
- 소스 파일은 주석만 바꾼다. 코드 토큰이 바뀌면 이 task 범위를 벗어난다.
- context review를 없애는 서술을 쓰지 않는다. step 5는 그대로 권고 절차이고, "unresolved finding이 있으면 승인하지 않음"은 skill 규칙으로 남는다.

### gates-review/doc-quality-gate-removal/004

#### Goal & intent

TASKS-001·002·003이 통합된 뒤 `npm run ci` 한 번으로 epic Success criteria 3–8을 확인한다. 이 명령에는 build·emit 검사·coverage 임계값·unit tier·lint·문서 형태·주석 검사·typecheck·테스트 이름·audit이 모두 포함된다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### gates-review/doc-quality-gate-removal/005 · `c587e747`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `.codex/agents/bouncer-context-reviewer.toml` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.