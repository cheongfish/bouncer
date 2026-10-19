---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/107-workflow-cost-reduction/blueprints/002-review-report-finalize/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-17T21:17:26.401+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '107'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: ae8368007ae180f7f83720d0f18c4e4c8d0edcfb
      range_to: f584a29783d7e5a9e3db9942f64276b0f972588e
      diff_sha: ef1ea52a70c4e84d5130a2d681d470d162e2630268f9813323450bd43c1933dc
      recorded_at: '2026-10-17T21:40:00+09:00'
  task_commits:
    - task: EPIC-107/BP-002/TASK-001
      sha: 3411168f
      intent_anchor: task-001
    - task: EPIC-107/BP-002/TASK-002
      sha: 2d1763e0
      intent_anchor: task-002
    - task: EPIC-107/BP-002/TASK-003
      sha: 8996346b
      intent_anchor: task-003
    - task: EPIC-107/BP-002/TASK-004
      sha: 062d557b
      intent_anchor: task-004
    - task: EPIC-107/BP-002/TASK-005
      sha: 8c2f8937
      intent_anchor: task-005
    - task: EPIC-107/BP-002/TASK-006
      sha: 8803f8c5
      intent_anchor: task-006
    - task: EPIC-107/BP-002/TASK-007
      sha: 4491e39d
      intent_anchor: task-007
    - task: EPIC-107/BP-002/TASK-008
      sha: e4b0f35d
      intent_anchor: task-008
    - task: EPIC-107/BP-002/TASK-009
      sha: 2608b5ff
      intent_anchor: task-009
    - task: EPIC-107/BP-002/TASK-010
      sha: f584a297
      intent_anchor: task-010
---
# Explain

## Background

blueprint 최종 리뷰는 수정과 delta 재검토를 오가며 호출을 늘렸고, 계획 리뷰도 같은 입력을 반복해서 읽었다. 이 변경은 최종 리뷰를 discovery 한 라운드로 끝내고, 고치지 않고 넘기는 must_fix는 note를 붙여 `deferred`로 기록해 finalize 경고와 PR로 넘기게 한다. 사용자 승인과 게이트는 그대로 두고 반복 입력과 중복 규칙만 줄이는 것이 목표다.

## Intuition

최종 리뷰는 "한 번 찍는 사진"이 된다. 사진에 찍힌 결함은 다시 찍지 않고 꼬리표(note)를 달아 마감 서류에 붙인다.

## Code

- 최종 리뷰 단일 라운드: `scripts/src/lib/review-record.ts`, `coordinate-next.ts`, `validate-sections.ts`. discovery 뒤 root delta는 `final-review-single-round`로 거절하고, 수락되지 않은 상태는 `final-review-blocked`로 멈춘다.
- 레거시 전환: `scripts/src/lib/migrate-review-scope.ts`와 `bouncer migrate review-scope`. `run preflight`는 `review_scope`가 없는 blueprint를 `legacy-review-scope`로 막고 이 명령을 안내한다.
- finding 정규화: `validate-sections.ts`의 `findingAutoId`, `normalizeFinding`, `normalizeRoundFindings`. id를 생략하면 fingerprint에서 결정적으로 만든다. 설계상 id 충돌은 조용히 병합하지 않고 거절한다.
- 계획 리뷰: `review-dispatch.ts`, `context-review-state.ts`. 새 dispatch는 single만 만들고, 기록된 legacy round는 계속 읽는다. `closure_target_digest`를 런타임과 frontmatter에 함께 저장한다. re-close의 기준은 처음 리뷰한 payload다.
- 보고·dispatch: `agents/bouncer-reviewer.md`, `agents/bouncer-implementer.md`, `skills/bouncer-run/references/agent-dispatch.md`, `references/coordinator-cards/`. 필수 파일 증적은 유지하고 빈 선택 절과 중복 hand-back 본문을 줄였다. dispatch 공통 규칙은 `agent-dispatch.md`가 정본이다.
- 마무리: `scripts/src/lib/finalize.ts`, `finalize-digest.ts`. digest에 `warnings`, `drive_issues`, `repair_waves`가 생기고 PR 본문의 `unresolved_must_fix`는 같은 판정 함수를 쓴다.
- 알려진 한계: migrate 쓰기 도중 실패하는 롤백 경로는 테스트가 없다. 한국어 검사는 Hangul 존재 여부만 본다.

## Quiz

1. blueprint 최종 리뷰에 discovery 라운드가 이미 저장된 뒤 새 delta 라운드를 기록하려 하면 어떻게 되는가?
   - A) 허용되고 수정 후 재검토로 이어진다.
   - B) `final-review-single-round`로 기록 전에 거절된다.
   - C) 경고만 남기고 기록된다.
2. `review_scope: blueprint` 최종 리뷰에서 note가 있는 `deferred` must_fix가 남아 있으면?
   - A) task 범위(G14)처럼 accepted를 거절한다.
   - B) 아무 표시 없이 무시한다.
   - C) accepted를 허용하고 finalize 경고와 PR의 `unresolved_must_fix`로 전달한다.
3. `review_scope`가 없는 레거시 blueprint에 `run preflight`를 실행하면?
   - A) `legacy-review-scope`로 막고 `bouncer migrate review-scope`를 안내한다.
   - B) 실행 중에 자동으로 blueprint 범위로 전환한다.
   - C) 기존 task 리뷰 방식으로 그대로 진행한다.
4. review 입력에서 finding의 `id` 키를 생략하면?
   - A) 입력이 거절된다.
   - B) fingerprint에서 `F-` + sha256 앞 8hex로 결정적으로 만든다.
   - C) 무작위 id가 부여된다.
5. 계획 리뷰 dispatch의 `clustered` 전략은 어떻게 바뀌었는가?
   - A) 완전히 삭제되어 옛 round를 읽을 수 없다.
   - B) 기본 전략으로 유지된다.
   - C) 새 dispatch는 single만 만들고, 기록된 legacy round는 계속 읽힌다.

## Tasks

### EPIC-107/BP-002/TASK-001 · `3411168f`

#### Goal & intent

blueprint 최종 리뷰를 discovery 한 라운드로 끝내고 note가 있는 deferred must_fix는 경고로 넘기며 blocked는 사용자 결정까지 멈추게 함.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `scripts/src/lib/coordinate-next.ts:676`은 accepted가 아닌 root 리뷰를 final_review로 보내고 `:695`에서 discovery 이력이 있으면 delta를 만든다.
- `scripts/src/lib/validate-sections.ts:449`은 execute 범위와 무관하게 accepted의 unresolved must_fix를 거절한다. `:389`은 deferred note를 이미 요구한다.
- `scripts/src/lib/review-record.ts:329`은 저장 이력에 새 round를 붙이고 `:359`에서 검증한다. `validate-sections.ts:120`의 역사적 blueprint 시퀀스는 discovery와 두 delta를 허용한다.
- I/O 결합: `scripts/src/lib/coordinator.ts:3483`·`:3519`는 supplement·review repair로 원장과 task를 쓰며, supplement done은 `:3275`에서 별도 진입한다. 거절은 이 쓰기보다 앞서야 한다. `cli-review-dispatch-command.ts:267`은 classifier 로드 전 argv를 검증한다.

#### Target behavior

- 성공: blueprint G21·root record는 note가 있는 deferred must_fix를 accepted에 허용한다. reviewer 호출과 dispatch는 discovery 한 번이며 필요 시 combined와 security 관점은 기존 위험 규칙을 따른다.
- 실패: final discovery가 저장된 뒤 review-finding·supplement intake와 done은 final-review-single-round로 거절한다. blocked 분류 finding이 open으로 남은 requested 리뷰는 final-review-blocked로 멈추고 accepted로 만들지 않는다.
- 보존: task G14·task/light delta, 기존 저장 discovery,delta,delta 읽기·G21 통과, failure-command CI repair와 wave 상한을 유지한다. 새 root delta record는 final-review-single-round로 거절한다.

#### Interface

- `coordinate next`: 최종 리뷰 뒤 delta를 내지 않음. blocked reason은 `final-review-blocked`이며 cause와 사용자 결정 next를 함께 제공함.
- `review-dispatch execute --mode delta`에 task가 없으면 exit 2. task 지정 delta는 기존 계약 유지.
- 최종 리뷰 이후 판정은 blueprint review 모드의 root discovery round 존재로 정의함. 기존 이력은 읽되 새 delta와 리뷰 원인 repair를 추가하지 않음.
- blocked 분류는 기존 finding status open과 문서 status requested로 기록한다. discovery가 이미 있는데 accepted가 아니면 final-review-blocked로 반환하며 새 review status enum을 만들지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinate-next.ts` | `nextAction` | Modify | 현재 최종 리뷰 action | 최종 리뷰 action·blocked 판정 | `scripts/src/lib/coordinate-next.ts:676` |
| `scripts/src/lib/validate-sections.ts` | `collectFindingFailures` | Modify | 현재 blueprint accepted 정책과 역사적 sequence 보존 | blueprint accepted 정책과 역사적 sequence 보존 | `scripts/src/lib/validate-sections.ts:449` |
| `scripts/src/lib/coordinator.ts` | `coordinateRepair` | Modify | 현재 리뷰 원인 repair 진입 | 리뷰 원인 repair 진입·done 거절 | `scripts/src/lib/coordinator.ts:3275` |
| `scripts/src/lib/review-record.ts` | `recordReview` | Modify | 현재 새 root delta 거절 | 새 root delta 거절·scope별 record 검증 | `scripts/src/lib/review-record.ts:329` |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `cmdReviewDispatch` | Modify | 현재 task 없는 delta usage 거절 | task 없는 delta usage 거절 | `scripts/src/lib/cli-review-dispatch-command.ts:267` |
| `test/coordinate-next.test.js` | `최종 리뷰 fixture` | Modify | 기존 회귀·문서 계약 검증 | delta 기대를 single·blocked로 전환 | `test/coordinate-next.test.js:476` |
| `test/review-record.test.js` | `root round fixture` | Modify | 기존 회귀·문서 계약 검증 | scope별 deferred·새 delta·기존 기록 검증 | `test/review-record.test.js:209` |
| `test/validate-gates.test.js` | `G14·G21 fixtures` | Modify | 기존 회귀·문서 계약 검증 | 역사적 sequence와 G14 보존 | `test/validate-gates.test.js:2830` |
| `test/coordinator.test.js` | `repair·supplement fixtures` | Modify | 기존 회귀·문서 계약 검증 | intake·done 사전 거절과 CI repair 보존 | `test/coordinator.test.js:3218` |
| `test/cli-coordinate.test.js` | `review repair CLI` | Modify | 기존 회귀·문서 계약 검증 | CLI 거절 검증 | `test/cli-coordinate.test.js:705` |
| `test/review-dispatch.test.js` | `execute dispatch CLI` | Modify | 기존 회귀·문서 계약 검증 | task 없는 delta exit2 | `test/review-dispatch.test.js:970` |
| `references/coordinator-cards/final_review.md` | `최종 리뷰 절차` | Modify | 현재 수정 | 수정·delta 분기 제거와 blocked 기록 | `references/coordinator-cards/final_review.md:90` |
| `skills/bouncer-run/references/review-round.md` | `최종 리뷰 분기` | Modify | 현재 single 라운드와 레거시 읽기 분리 | single 라운드와 레거시 읽기 분리 | `skills/bouncer-run/references/review-round.md:1` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-002 · `2d1763e0`

#### Goal & intent

review_scope 없는 blueprint를 실행 전에 차단하고 전용 migrate 명령으로 최종 리뷰 범위를 전환함.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `scripts/src/lib/cli-project-commands.ts:314`는 retention·task-layout migration만 받는다. `:397`은 도움말이다.
- `scripts/src/lib/scaffold.ts:427`·`:441`은 신규 blueprint에 review_scope와 root pending review를 만든다. 기존 task-layout migration은 `migrate-task-layout.ts:73`에서 root 리뷰를 task로 옮기는 별도 계약이다.
- I/O 결합: `scripts/src/lib/run-preflight.ts:185`는 status·scale만 읽고 `:393`에서 task를 수집한다. `:60`·`:80` 결과 타입에는 next가 없다. `cli-project-commands.ts:240`이 preflight JSON을 출력한다.

#### Target behavior

- 성공: 명시적 migrate review-scope는 review_scope: blueprint와 scaffold와 같은 metadata의 root pending review.md를 만든다. 이미 전환됐고 root review가 있으면 noop으로 원문을 보존한다.
- 실패: preflight는 포인터·경로·문서 유효성 확인 뒤 legacy를 ok:false, reason legacy-review-scope와 실행 가능한 migrate next로 반환한다. legacy 판정은 delegation·ledger 재개 판정보다 앞선다.
- 보존: task evidence·리뷰 내용·저장 delta·pointer는 삭제하거나 옮기지 않는다. flat layout은 task-layout migration을 먼저 안내하고, review_scope가 없는데 root review가 이미 있으면 덮어쓰지 않고 충돌로 거절한다.

#### Interface

- `bouncer migrate review-scope --blueprint <dir>`; blueprint 누락·알 수 없는 옵션은 exit2, 경로 이탈·문서 충돌은 기존 migration JSON 실패/exit1 규약을 따른다.
- 기존 legacy read 판정 함수 3곳은 유지한다. migration만 exact review_scope를 쓴다. 쓰기 전 검증하고 실패 시 부분 변경을 남기지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/migrate-review-scope.ts` | `신규 추출 지점: 리뷰 범위 migration` | Create | 신규 산출물 | root 리뷰 생성·idempotency | Blueprint Contract의 신규 산출물 |
| `scripts/src/lib/cli-project-commands.ts` | `cmdMigrate` | Modify | 현재 명령 라우팅 | 명령 라우팅·도움말 | `scripts/src/lib/cli-project-commands.ts:314` |
| `scripts/src/lib/run-preflight.ts` | `runPreflight` | Modify | 현재 legacy refusal reason | legacy refusal reason·next | `scripts/src/lib/run-preflight.ts:357` |
| `test/migrate-review-scope.test.js` | `신규 추출 지점: migration 회귀` | Create | 신규 산출물 | 성공·noop·충돌·부분 쓰기 거절 | Blueprint Contract의 신규 산출물 |
| `test/run-preflight.test.js` | `성공 fixture` | Modify | 기존 회귀·문서 계약 검증 | 신규 scope와 legacy 거절 fixture 분리 | `test/run-preflight.test.js:36` |
| `test/cli-help.test.js` | `migration help` | Modify | 기존 회귀·문서 계약 검증 | 공개 도움말 검증 | `test/cli-help.test.js:50` |
| `test/cli-project-commands.test.js` | `migration argv` | Modify | 기존 회귀·문서 계약 검증 | 옵션·출력 규약 | `test/cli-project-commands.test.js:1100` |
| `docs/workflow.md` | `리뷰 범위 설명` | Modify | 현재 legacy 실행 차단 | legacy 실행 차단·명시적 전환 | `docs/workflow.md:121` |
| `skills/bouncer-run/SKILL.md` | `preflight 분기` | Modify | 현재 migration next 안내 | migration next 안내 | `skills/bouncer-run/SKILL.md:73` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-003 · `8996346b`

#### Goal & intent

계획 리뷰를 single로 통일하고 구조·계약이 같은 본문 수정은 현재 digest로 close 인증함.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `scripts/src/lib/review-dispatch.ts:632`는 commit task 3개까지 single, `:660`은 그보다 크면 clustered를 선택한다.
- `scripts/src/lib/plan-snapshot.ts:187`은 task의 Interface·Touch·affected_paths·depends_on을 scope_parts로 해시한다. `review-dispatch.ts:245`는 이 값을 follow-up 분류에서 제외한다.
- I/O 결합: `scripts/src/lib/context-review-state.ts:1111`은 dispositions를 읽어 close하고 `:1176` transition key에는 target digest가 없다. `:682`가 frontmatter를 투영하며 `validate-gates.ts:1049`·`:1497` G18은 마지막 round digest만 비교한다.

#### Target behavior

- 성공: 모든 full 최초 dispatch는 single. route는 구조·scope가 같으면 close, 구조가 같은 scope 변경이면 delta, 구조 변경이면 restart를 반환한다. digest가 이미 같으면 기존 reuse를 유지한다.
- close와 accepted record는 runtime closure와 context_review frontmatter에 closure_target_digest를 쓰고 현재 snapshot을 인증한다. close idempotency key는 target digest를 포함한다.
- 실패: close는 현재 구조·계약이 baseline과 다르면 인증하지 않는다. 이미 닫힌 cycle의 본문 수정은 구조·계약이 같을 때 재close할 수 있고, 다른 변경은 route의 delta/restart를 따른다.
- 보존: 과거 clustered payload·closed 문서는 계속 읽힌다. closure digest 없는 legacy는 마지막 round digest를 사용한다. restart 상한·accepted-risk 명시 동의는 유지한다.

#### Interface

- route `next_action`에 `close` 추가. `closure_target_digest`는 64 lowercase hex이며 runtime closure와 `bouncer.context_review`가 같은 값을 갖는다.
- G18은 유효한 closure digest를 우선 비교하고 부재 시 기존 round fallback. malformed digest는 구조 오류로 거절하며 현재 내용으로 자동 인증하지 않는다.
- restart는 이전 closure를 archive하고 새 cycle closure를 비운다. nonce나 시간값으로 최신성 검사를 우회하지 않는다.
- 구조와 scope가 함께 바뀌면 restart가 우선한다. affected_paths·depends_on은 기존 구조 digest에도 포함되므로 이 변경은 restart다. scope_parts의 해시 공식을 바꾸지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | `classifyPlanReview` | Modify | 현재 single | single·follow-up scope 분류 | `scripts/src/lib/review-dispatch.ts:632` |
| `scripts/src/lib/context-review-state.ts` | `routeFollowUp·closeCycle` | Modify | 현재 close 전이 | close 전이·현재 digest 저장·projection | `scripts/src/lib/context-review-state.ts:1365` |
| `scripts/src/lib/validate-gates.ts` | `G18 최신성` | Modify | 현재 closure digest 우선 비교 | closure digest 우선 비교 | `scripts/src/lib/validate-gates.ts:1049` |
| `scripts/src/lib/validate-docs.ts` | `context_review 구조 검사` | Modify | 현재 closure_target_digest shape 검증 | closure_target_digest shape 검증 | `scripts/src/lib/validate-docs.ts:272` |
| `scripts/src/lib/cli-context-review-command.ts` | `route 도움말` | Modify | 현재 close action 계약 | close action 계약 | `scripts/src/lib/cli-context-review-command.ts:141` |
| `test/review-dispatch.test.js` | `plan strategy fixtures` | Modify | 기존 회귀·문서 계약 검증 | 대형 single·close/delta/restart 분류 | `test/review-dispatch.test.js:658` |
| `test/context-review-state.test.js` | `dispatch constructor·close` | Modify | 기존 회귀·문서 계약 검증 | closure·noop·재close·restart fixture | `test/context-review-state.test.js:72` |
| `test/validate-gates.test.js` | `G18 snapshot fixture` | Modify | 기존 회귀·문서 계약 검증 | fresh·stale·legacy fallback | `test/validate-gates.test.js:784` |
| `test/validate-structural.test.js` | `context_review schema` | Modify | 기존 회귀·문서 계약 검증 | digest shape 거절 | `test/validate-structural.test.js:1` |
| `test/skill-context-review.test.js` | `계획 리뷰 문서 계약` | Modify | 기존 회귀·문서 계약 검증 | single·close 경로 | `test/skill-context-review.test.js:1` |
| `skills/bouncer-plan/references/context-review.md` | `계획 리뷰 절차` | Modify | 현재 cluster dispatch 제거 | cluster dispatch 제거·close 안내 | `skills/bouncer-plan/references/context-review.md:33` |
| `references/context-review/index.md` | `계획 리뷰 rubric` | Modify | 현재 single 판단과 후속 경로 | single 판단과 후속 경로 | `references/context-review/index.md:1` |
| `rules/document-schema.md` | `context_review metadata` | Modify | 현재 closure digest 소유와 호환성 | closure digest 소유와 호환성 | `rules/document-schema.md:151` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-004 · `062d557b`

#### Goal & intent

record와 close가 같은 fingerprint 공식을 쓰고 생략된 finding id를 안정적으로 생성함.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `scripts/src/lib/validate-sections.ts:276`의 findingFingerprint는 category·clause·파일·공백을 정규화하고 context namespace를 지원한다.
- `scripts/src/lib/review-record.ts:183`은 fingerprint가 비었을 때만 채우고 `:197`은 id로 merge한다. `:29`·`:392` 결과에는 개수만 있다.
- I/O 결합: `scripts/src/lib/context-review-state.ts:834`는 id를 필수로 요구하고 `:480`은 raw report를 fold한다. `:937`·`:1007`은 입력 원문 bytes로 immutable report와 transition hash를 만든다. close `:1146`는 raw finding을 복제한다.

#### Target behavior

- 성공: execute·context record는 supplied fingerprint와 무관하게 공식을 적용한다. 누락 id는 canonical fingerprint 문자열의 sha256 앞 8hex로 F-/CR- id를 만든다. explicit nonempty string id는 보존한다.
- record 결과 finding_ids는 이번 입력의 정규화된 id를 순서 유지·중복 제거 배열로 반환하고 noop에서도 같다. 같은 fingerprint·누락 id는 round를 넘어 같은 id를 쓴다.
- close·fold·noop projection도 정규화한다. 기존 immutable report 원문·sha·입력 transition hash는 유지하고 파생 projection에서 정규화해 과거 잘못된 fingerprint를 복구한다.
- 실패: 명시된 null·빈 문자열·공백 id와 비문자열 id는 기존 invalid input으로 거절한다. 서로 다른 fingerprint가 같은 자동 id로 충돌하면 merge하지 않고 거절한다. explicit id가 다른 동일 fingerprint는 기존 중복 거절을 유지한다.

#### Interface

- 공유 정규화 책임은 기존 findingFingerprint 소유 모듈에 둔다. id 생략은 key 부재만 뜻한다. execute F-<8hex>, context CR-<8hex>.
- fingerprint 덮어쓰기 외 severity·status·note·accepted_risk·explicit id는 변경하지 않는다. close disposition은 정규화 후 id에 적용한다.
- validator는 수기 조작된 잘못된 fingerprint를 계속 거절한다. 입력 보정은 record/close 경계에 한정한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-sections.ts` | `findingFingerprint` | Modify | 현재 공식 공유 | 공식 공유·id 유도 책임 | `scripts/src/lib/validate-sections.ts:276` |
| `scripts/src/lib/review-record.ts` | `recordReview·mergeFindings` | Modify | 현재 저장 전 정규화 | 저장 전 정규화·finding_ids | `scripts/src/lib/review-record.ts:183` |
| `scripts/src/lib/context-review-state.ts` | `recordReport·foldReports·closeCycle` | Modify | 현재 fold | fold·close·noop 정규화 | `scripts/src/lib/context-review-state.ts:834` |
| `scripts/src/lib/cli-review-command.ts` | `record 도움말` | Modify | 현재 생략 id와 결과 계약 | 생략 id와 결과 계약 | `scripts/src/lib/cli-review-command.ts:220` |
| `scripts/src/lib/cli-context-review-command.ts` | `record 도움말` | Modify | 현재 자동화 입력 계약 | 자동화 입력 계약 | `scripts/src/lib/cli-context-review-command.ts:274` |
| `test/review-record.test.js` | `EXAMPLE_FINDING` | Modify | 기존 회귀·문서 계약 검증 | id 생략·fingerprint 덮어쓰기 회귀 | `test/review-record.test.js:21` |
| `test/context-review-state.test.js` | `roundFile·withFingerprint` | Modify | 기존 회귀·문서 계약 검증 | 과거 raw·중복·noop·close 복구 | `test/context-review-state.test.js:21` |
| `test/validate-gates.test.js` | `fingerprint 무결성` | Modify | 기존 회귀·문서 계약 검증 | 수기 오류 거절 유지 | `test/validate-gates.test.js:586` |
| `references/review/index.md` | `finding 입력` | Modify | 현재 자동화 필드 저술 계약 | 자동화 필드 저술 계약 | `references/review/index.md:63` |
| `references/context-review/index.md` | `finding 입력` | Modify | 현재 context id | context id·fingerprint 자동화 | `references/context-review/index.md:1` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-005 · `8c2f8937`

#### Goal & intent

reviewer가 구현 브리프 8개 섹션으로 판단하고 게이트 중복·docstring 형식·nit 출력을 제외함.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `agents/bouncer-reviewer.md:37`·`references/review/index.md:52`·prompt `:35`·final_review 카드 `:53`은 6개 섹션만 열거한다.
- `agents/bouncer-reviewer.md:71`·`:152`·`:198`은 nit 출력을 지시하며 `:125`–`:131`은 docstring 검사를 요구한다.
- I/O 결합: `scripts/src/lib/intent-bundle.ts:177` reviewer/debugger 공유 Explain projection은 4섹션으로 별도다. `test/agents.test.js:130`이 Markdown→TOML byte parity를 검사하고 `scripts/check-doc-shape.js:796`이 필수 heading을 고정한다.

#### Target behavior

- 성공: 문서 brief allowlist는 Goal & intent·Current behavior·Target behavior·Interface·Touch·Do not touch·Constraints·Checklist다. 없는 optional behavior 절은 생략한다.
- 새 reviewer 출력 severity는 blocker·major·minor만 쓴다. actionability는 기존 must_fix·advisory다. 기존 nit enum·저장 기록은 유지하고 과거 예시는 legacy로 표시한다.
- reviewer의 docstring 형식 요구와 Comments and docstrings 체크를 제거한다. implementer coding-standards와 테스트 신뢰성 판단은 유지한다.
- 게이트가 검사하는 항목 절에 package.json의 npm run ci 구성 명령 9개를 정확히 나열한다. 공유 intent sections 코드는 바꾸지 않는다.

#### Interface

- named·fallback·inline·print brief 문서에 같은 8개 allowlist 적용. 이 변경은 Explain intent_sections의 4섹션 projection과 별개다.
- reviewer 역할의 Authority·Hard guards (read-only)·Review modes·Output contract heading을 유지한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-reviewer.md` | `review rubric` | Modify | 현재 8섹션 | 8섹션·nit·docstring·CI 중복 제외 | `agents/bouncer-reviewer.md:37` |
| `.codex/agents/bouncer-reviewer.toml` | `생성본` | Modify | 현재 role mirror 재생성 | role mirror 재생성 | `.codex/agents/bouncer-reviewer.toml:8` |
| `references/review/index.md` | `review brief·schema` | Modify | 현재 8섹션 | 8섹션·새 출력 범위 | `references/review/index.md:52` |
| `references/review/assets/reviewer-prompt.md` | `review prompt` | Modify | 현재 입력 | 입력·출력 rubric 일치 | `references/review/assets/reviewer-prompt.md:35` |
| `references/coordinator-cards/review.md` | `task review 입력` | Modify | 현재 입력 allowlist | 입력 allowlist | `references/coordinator-cards/review.md:53` |
| `references/coordinator-cards/final_review.md` | `final review 입력` | Modify | 현재 입력 allowlist | 입력 allowlist | `references/coordinator-cards/final_review.md:53` |
| `references/spec-authoring/review-rounds.md` | `nit 예시` | Modify | 현재 과거 호환 예시 명시 | 과거 호환 예시 명시 | `references/spec-authoring/review-rounds.md:98` |
| `test/agents.test.js` | `agent parity` | Modify | 기존 회귀·문서 계약 검증 | 생성본·새 reviewer 문서 계약 | `test/agents.test.js:130` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-006 · `8803f8c5`

#### Goal & intent

필수 파일 증적은 유지하면서 빈 선택 절과 중복 hand-back 본문을 줄임.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `agents/bouncer-implementer.md:107`은 파일·hand-back에 같은 전체 Output contract를 요구하고 `:140`은 빈 값도 none으로 채우게 한다.
- `scripts/src/lib/coordinator.ts:216`·`:270`·`:278`은 Brief revision·Open choices·Known weaknesses만 필수 파싱한다. optional H2 생략은 이미 가능하다.
- I/O 결합: report_path가 있으면 파일을 쓰고 controller가 payload.report로 읽는다. `coordinator.ts:2550`은 Changed files의 backtick 경로를 읽는다. `agent-dispatch.md:148`은 모든 worker hand-back에 전체 Output contract를 요구한다.

#### Target behavior

- 성공: 파일 보고는 Changed files·검증·Red run·필수 절을 유지한다. 빈 Deviations·Scope impact·Needs planning만 생략한다.
- Open choices·Known weaknesses가 비면 - none. Brief revision은 실제 attempt·task_brief_hash 두 줄을 유지하며 none으로 대체하지 않는다.
- report_path가 주어진 hand-back은 요약·보고 경로와 값이 있는 Needs planning·Scope impact만 담는다. report_path 없는 기존 독립 호출은 전체 inline 보고 계약을 유지한다.
- 실패: 필수 heading·revision 누락은 기존 CLI reason으로 거절한다. parser를 완화하지 않는다.

#### Interface

- file Output contract와 hand-back contract를 역할 문서에서 구분한다. reviewer는 상세 파일 보고를 계속 읽는다.
- 공통 agent-dispatch는 implementer의 축약 hand-back 예외를 참조한다. 다른 worker의 출력 계약은 유지한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-implementer.md` | `Output contract` | Modify | 현재 선택 절 | 선택 절·hand-back 축소 | `agents/bouncer-implementer.md:107` |
| `.codex/agents/bouncer-implementer.toml` | `생성본` | Modify | 현재 role mirror 재생성 | role mirror 재생성 | `.codex/agents/bouncer-implementer.toml:107` |
| `references/implementation/index.md` | `Return` | Modify | 현재 짧은 hand-back | 짧은 hand-back·파일 보고 | `references/implementation/index.md:59` |
| `references/coordinator-cards/report.md` | `파일 보고 확인` | Modify | 현재 선택 절 생략 허용 | 선택 절 생략 허용 | `references/coordinator-cards/report.md:6` |
| `references/coordinator-cards/record.md` | `파일 보고 기록` | Modify | 현재 필수 증적 보존 | 필수 증적 보존 | `references/coordinator-cards/record.md:11` |
| `skills/bouncer-run/references/agent-dispatch.md` | `worker report` | Modify | 현재 implementer hand-back 예외 | implementer hand-back 예외 | `skills/bouncer-run/references/agent-dispatch.md:148` |
| `test/agents.test.js` | `role output 계약` | Modify | 기존 회귀·문서 계약 검증 | 필수·선택 절·생성 parity | `test/agents.test.js:130` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-007 · `4491e39d`

#### Goal & intent

payload·metadata·fallback·모델·토큰 기록 규칙을 agent-dispatch 한 곳에 두고 action 카드는 단계 입력과 정본 링크로 줄임.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `skills/bouncer-run/references/agent-dispatch.md:4`·`:12`·`:43`·`:81`·`:104`는 identity·metadata·named·fallback·review 입력을 이미 소유하지만 모델·토큰 기록은 카드에 있다.
- `references/coordinator-cards/dispatch.md:6`·`:37`·`:47`, implement `:38`–`:87`, review `:12`·`:45`, final_review `:11`, verify `:15`·`:26`은 같은 규칙을 반복한다.
- I/O 결합: `test/coordinate-next.test.js:1294`의 SHARED_RULES와 `:1373`은 카드 본문을 이어 붙여 중복 문장을 요구한다. `test/coordinator.test.js:1723`도 같은 구조다. 카드 body는 coordinate next의 실제 입력이므로 링크는 실행 분기에서 읽혀야 한다.
- `skills/bouncer-run/references/verification-recovery.md:4`–`:23`에도 debugger fallback이 복제돼 있고 `test/subagents.test.js:566`은 이 소유를 고정한다. run SKILL `:118`의 same coordinator brief는 shared rule의 축약 payload 금지와 충돌한다.

#### Target behavior

- 성공: 공통 payload·metadata·fallback·worker-model/worker-tokens 기록 본문은 agent-dispatch만 소유한다. implementer 최초 모델은 coordinate dispatch --model, 재시도는 attempt를 다시 열지 않는 현재 동작을 보존한다.
- 카드는 phase별 입력·next·print template과 정본 링크를 유지한다. report_path는 metadata 바깥이라는 계약과 stale 보고 처리·brief freeze를 정본에서 보존한다.
- verification-recovery·subagent-model·coordinator·run SKILL은 정본을 조건부로 읽는 링크를 사용한다. 모델 resolve·inherit 재시도·whole-role fallback·실제 cwd·foreground 경계를 축약하지 않는다.
- usage 이벤트 대응표는 drive-metrics의 소유다. agent-dispatch는 모델·worker token 기록 명령만 소유하고 이벤트별 타이밍은 링크한다. light integration cwd와 full task cwd를 유지한다.

#### Interface

- rule-ownership 표에 payload·metadata·fallback·worker model/token 기록 소유 행을 추가한다.
- 테스트는 정본의 문장과 각 카드의 live link를 독립 검증한다. 카드와 정본을 이어 붙여 존재만 검사하지 않는다.
- coordinator fallback은 전체 역할 본문과 run step4 입력을 명시하며 same brief라는 라벨만으로 대체하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/agent-dispatch.md` | `dispatch 정본` | Modify | 현재 payload | payload·metadata·fallback·모델·토큰 단일 소유 | `skills/bouncer-run/references/agent-dispatch.md:4` |
| `skills/bouncer-run/references/verification-recovery.md` | `recovery 입력` | Modify | 현재 debugger payload 복제 제거 | debugger payload 복제 제거 | `skills/bouncer-run/references/verification-recovery.md:4` |
| `references/coordinator-cards/dispatch.md` | `dispatch 입력` | Modify | 현재 정본 링크 | 정본 링크·단계 입력 | `references/coordinator-cards/dispatch.md:6` |
| `references/coordinator-cards/implement.md` | `implement 입력` | Modify | 현재 정본 링크 | 정본 링크·print 입력 | `references/coordinator-cards/implement.md:38` |
| `references/coordinator-cards/review.md` | `review 입력` | Modify | 현재 정본 링크 | 정본 링크·단계 입력 | `references/coordinator-cards/review.md:12` |
| `references/coordinator-cards/final_review.md` | `final review 입력` | Modify | 현재 정본 링크 | 정본 링크·단계 입력 | `references/coordinator-cards/final_review.md:11` |
| `references/coordinator-cards/verify.md` | `verify 입력` | Modify | 현재 정본 링크 | 정본 링크·단계 입력 | `references/coordinator-cards/verify.md:15` |
| `references/coordinator-cards/report.md` | `보고 판단` | Modify | 현재 stale 공통 규칙 링크 | stale 공통 규칙 링크 | `references/coordinator-cards/report.md:6` |
| `references/coordinator-cards/record.md` | `보고 기록` | Modify | 현재 stale 공통 규칙 링크 | stale 공통 규칙 링크 | `references/coordinator-cards/record.md:14` |
| `rules/subagent-model.md` | `모델·fallback 계약` | Modify | 현재 정본 참조로 본문 이관 | 정본 참조로 본문 이관 | `rules/subagent-model.md:30` |
| `agents/bouncer-coordinator.md` | `Worker dispatch` | Modify | 현재 정본 진입 링크 | 정본 진입 링크 | `agents/bouncer-coordinator.md:139` |
| `.codex/agents/bouncer-coordinator.toml` | `생성본` | Modify | 현재 role mirror 재생성 | role mirror 재생성 | `.codex/agents/bouncer-coordinator.toml:139` |
| `skills/bouncer-run/SKILL.md` | `coordinator fallback` | Modify | 현재 전체 역할 | 전체 역할·정본 참조 | `skills/bouncer-run/SKILL.md:118` |
| `docs/architecture/rule-ownership.md` | `소유 표` | Modify | 현재 공통 규칙 소유 행 | 공통 규칙 소유 행 | `docs/architecture/rule-ownership.md:39` |
| `test/coordinate-next.test.js` | `SHARED_RULES` | Modify | 기존 회귀·문서 계약 검증 | 정본·소비 카드 링크 분리 검사 | `test/coordinate-next.test.js:1294` |
| `test/coordinator.test.js` | `card concatenation` | Modify | 기존 회귀·문서 계약 검증 | 정본 검사로 전환 | `test/coordinator.test.js:1723` |
| `test/subagents.test.js` | `fallback owner` | Modify | 기존 회귀·문서 계약 검증 | 새 소유·whole-role 유지 | `test/subagents.test.js:566` |
| `test/doc-shape-cli.test.js` | `conditional live links` | Modify | 기존 회귀·문서 계약 검증 | 이관 카드 링크 검증 | `test/doc-shape-cli.test.js:192` |
| `test/skill-bouncer-surface.test.js` | `dispatch owner` | Modify | 기존 회귀·문서 계약 검증 | symbol-selection 소유 이동 | `test/skill-bouncer-surface.test.js:406` |
| `test/skill-bouncer-run.test.js` | `model check order` | Modify | 기존 회귀·문서 계약 검증 | 정본 참조와 dispatch 순서 유지 | `test/skill-bouncer-run.test.js:44` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-008 · `e4b0f35d`

#### Goal & intent

원장 정리 전에 drive_issues를 보존하고 blueprint deferred must_fix를 경고·PR 전용 절로 전달함.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `scripts/src/lib/finalize-digest.ts:91`의 v2 digest에는 warnings·drive_issues가 없다. `:616`은 원장을 한 번 읽고 `:898`은 blueprint root finding을 모은다.
- `scripts/src/lib/finalize-pr.ts:223`은 accepted/deferred를 severity와 무관하게 review_points에 넣는다. `:16` sections에는 unresolved_must_fix가 없다.
- I/O 결합: `finalize-digest.ts:937` body가 `:978` buildPrDraft 입력이고 `:983`의 drive는 PR 입력 밖이다. `finalize.ts:1023`·`:1037`은 ledger/docs를 읽고 `:1129`에서 dry-run을 반환한다. prepare의 integration checkout과 실제 finalize cwd를 구분해야 한다.
- `coordinator.ts:109` report, `:84` worker-model, `:144` fanin-verification-failed가 집계 가능한 원장 event다. `execution-contracts.ts:69`의 decisions와 repairWaves에 같은 repair가 중복된다. finalize SKILL `:100`은 Retro를 무조건 실행한다.

#### Target behavior

- 성공: prepare 반환의 top-level drive_issues는 아래 6개 정수 counter다. PR 입력과 본문에는 이 실행 통계를 넣지 않는다.
- rework_reports는 report/outcome rework 수, debugger_calls는 role debugger worker-model event 수(worker-tokens 제외), repair_waves는 repairWaves의 고유 wave 수(없으면 decisions repair 고유 wave), fanin_verification_failures는 해당 decision 수다.
- blocked는 report/outcome blocked와 critical-recovery/outcome blocked event 수다. deferred_must_fix는 현재 root review의 actionability must_fix·status deferred 고유 id 수다. 없는 ledger/event는 0이고 원장은 수정하지 않는다.
- blueprint root deferred must_fix만 warnings에 kind·id·note를 넣고 dry-run도 같은 조건을 따른다. task scope는 경고를 추가하지 않는다.
- PR sections.unresolved_must_fix에 root 경고 항목을 싣고 같은 finding만 review_points·unverified 경유 중복에서 뺀다. 기존 out_of_scope·다른 finding·worker notes 순서는 보존한다.
- 성공한 finalize·release-main 뒤 보존한 drive_issues의 값 중 하나라도 양수면 Retro를 실행한다. 모두 0이면 retro 생략 — 수정 문제 없음 한 줄이다. 기존 사용자 승인·PR 거절 경계는 유지한다.
- readReview는 현재 버리는 actionability를 원문에 있을 때 보존한다. legacy 부재를 severity에서 추정하지 않는다. warning 판정은 actionability를 사용한다.

#### Interface

- `drive_issues: {rework_reports, debugger_calls, repair_waves, fanin_verification_failures, blocked, deferred_must_fix}`; 각 값은 0 이상 정수.
- `warnings: Array<{kind: "must-fix-deferred", id: string, note: string}>`; blueprint에서 해당 finding이 없으면 []. legacy task 결과에는 새 경고를 생성하지 않는다.
- `pr.sections.unresolved_must_fix`는 경고의 id·note를 사용자에게 표시하는 문자열 배열이다. warnings·drive_issues 외 기존 digest v2 필드는 유지한다.
- CLI 거절은 원장 event가 아니므로 집계하지 않는다. report와 debugger 모델 기록을 대화 기록으로 추정하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-digest.ts` | `prepareFinalizeDigest` | Modify | 현재 원장 집계 | 원장 집계·root 경고·PR 입력 분리 | `scripts/src/lib/finalize-digest.ts:616` |
| `scripts/src/lib/finalize-pr.ts` | `buildPrDraft·buildReviewPoints` | Modify | 현재 미해결 절 | 미해결 절·finding 중복 제거 | `scripts/src/lib/finalize-pr.ts:223` |
| `scripts/src/lib/finalize.ts` | `finalize dry-run` | Modify | 현재 blueprint 경고 전달 | blueprint 경고 전달 | `scripts/src/lib/finalize.ts:1129` |
| `test/finalize-digest.test.js` | `full ledger fixture` | Modify | 기존 회귀·문서 계약 검증 | counter·경고·원장 보존 | `test/finalize-digest.test.js:286` |
| `test/finalize-pr.test.js` | `root deferred fixtures` | Modify | 기존 회귀·문서 계약 검증 | 새 절·정확한 중복 제거 | `test/finalize-pr.test.js:626` |
| `test/finalize.test.js` | `dry-run fixture` | Modify | 기존 회귀·문서 계약 검증 | scope별 warnings | `test/finalize.test.js:1` |
| `test/finalize-pure.test.js` | `digest pure assertions` | Modify | 기존 회귀·문서 계약 검증 | 기존 drive shape 보존 | `test/finalize-pure.test.js:1083` |
| `test/skill-bouncer-finalize.test.js` | `finalize 단계` | Modify | 기존 회귀·문서 계약 검증 | Retro 조건·생략 한 줄 | `test/skill-bouncer-finalize.test.js:26` |
| `skills/bouncer-finalize/SKILL.md` | `Retro 분기` | Modify | 현재 prepare counter 보존 후 조건 실행 | prepare counter 보존 후 조건 실행 | `skills/bouncer-finalize/SKILL.md:100` |
| `skills/bouncer-finalize/references/draft-pr.md` | `PR sections` | Modify | 현재 unresolved_must_fix 표시 | unresolved_must_fix 표시 | `skills/bouncer-finalize/references/draft-pr.md:41` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-009 · `2608b5ff`

#### Goal & intent

호스트 완료·usage 대응표를 drive-metrics에 두고 usage 이벤트가 없는 호출을 hand-back 직후 missing으로 닫음.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `skills/bouncer-run/references/drive-metrics.md:26`은 호스트와 무관하게 task-notification을 기다리며 `:36`은 미보고 종료를 예외로 다룬다.
- 다른 네 진입점은 run SKILL `:142`, subagent-model `:53`–`:65`, coordinator `:140`–`:157`, cursor-print-dispatch `:47`–`:51`이다. task007이 카드의 worker token 중복은 정본으로 옮긴다.
- I/O 결합: `scripts/src/lib/drive-metrics.ts:267`은 재종료를 거절하고 `:271`–`:279`는 token 없는 종료를 null/not-reported로 저장한다. Cursor print wrapper `print-dispatch.ts:370`은 usage를 직접 반환하지 않으며 `:150`–`:168`에서 읽는 raw stream-json result는 stdout artifact에 남는다.

#### Target behavior

- 성공: drive-metrics 표에 Claude Code task-notification usage, Codex 결과 JSON usage, Cursor print stdout artifact의 최종 result JSON usage, 이벤트 없는 호스트를 구분한다.
- 완료 보고 본문을 먼저 받고 해당 호스트가 제공하는 최종 usage만 읽는다. usage 이벤트가 없는 호스트·JSON에 usage 없는 완료는 즉시 token flag 없는 metrics end로 missing 종료한다.
- 나머지 네 진입점과 agent-dispatch는 표 링크만 사용한다. 한 번 닫힌 session을 뒤늦은 이벤트로 다시 닫거나 추정 토큰을 쓰지 않는다.
- 보존: CLI metrics schema·집계·print wrapper JSON은 바꾸지 않는다. Codex key를 추정하지 않고 실제 제공된 usage만 현재 CLI가 받는 토큰 값으로 전달한다.

#### Interface

- usage 대응표 정본: skills/bouncer-run/references/drive-metrics.md. metrics end의 token flags는 실제 호스트 값이 있을 때만 사용한다.
- 완료 알림만 있고 report 본문이 없으면 계속 기다린다는 foreground 계약을 유지한다. usage 부재는 report 미완료와 구분한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/drive-metrics.md` | `host 대응표` | Modify | 현재 완료 | 완료·usage별 종료 규칙 | `skills/bouncer-run/references/drive-metrics.md:26` |
| `skills/bouncer-run/SKILL.md` | `metrics 종료` | Modify | 현재 정본 링크 | 정본 링크 | `skills/bouncer-run/SKILL.md:142` |
| `rules/subagent-model.md` | `foreground 완료` | Modify | 현재 보고 완료 유지 | 보고 완료 유지·usage 링크 | `rules/subagent-model.md:53` |
| `agents/bouncer-coordinator.md` | `Worker dispatch` | Modify | 현재 host usage 링크 | host usage 링크 | `agents/bouncer-coordinator.md:140` |
| `.codex/agents/bouncer-coordinator.toml` | `생성본` | Modify | 현재 role mirror 재생성 | role mirror 재생성 | `.codex/agents/bouncer-coordinator.toml:140` |
| `rules/cursor-print-dispatch.md` | `print result` | Modify | 현재 raw artifact usage 링크 | raw artifact usage 링크 | `rules/cursor-print-dispatch.md:47` |
| `skills/bouncer-run/references/agent-dispatch.md` | `worker token 기록` | Modify | 현재 대응표 링크 | 대응표 링크·타이밍 중복 제거 | `skills/bouncer-run/references/agent-dispatch.md:1` |
| `test/skill-bouncer-run.test.js` | `Claude-only wait assertion` | Modify | 기존 회귀·문서 계약 검증 | 단일 정본 링크 검사 | `test/skill-bouncer-run.test.js:55` |
| `test/subagents.test.js` | `foreground paragraph` | Modify | 기존 회귀·문서 계약 검증 | report 완료·host 표 링크 | `test/subagents.test.js:638` |
| `test/agents.test.js` | `generated parity` | Modify | 기존 회귀·문서 계약 검증 | coordinator mirror 일치 | `test/agents.test.js:130` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-010 · `f584a297`

#### Goal & intent

사용자에게 보이는 모델 작성 메시지를 한국어로 통일하고 BP002 전체 변경을 Unreleased에 기록함.
최종 완료 검증은 `npm run ci`이며, 성공 여부와 증적은 execute gate가 기록한다.

#### Current behavior

- `AGENTS.md:3`–`:4`는 프로젝트·사용자 지시 우선 계약이고 `:18`까지 hard rule 4개만 있다.
- `rules/acq.md:40`–`:41`은 commit-intent gate 외에는 영어 Recommend-why를 허용한다. `docs/architecture/rule-ownership.md:11`은 네 경계라고 쓴다.
- I/O 결합: `rules/acq.md:15`–`:26`의 gate id·HTML JSON·옵션 문자·Recommended 표시는 기계 판독 대상이다. `test/master-rules.test.js:428`은 AGENTS 6135 bytes 상한을 검사한다. CHANGELOG `:8`–`:27`은 Unreleased에 한국어 제목과 epic/bp locator를 쓴다.

#### Target behavior

- 성공: AGENTS 5번에 확정한 한국어 규칙 원문을 추가한다. 모델 메시지의 채팅·ACQ·진행·보고에 적용하고 코드·경로·명령·식별자·CLI 출력 원문과 사용자·프로젝트 우선권을 유지한다.
- rules/acq는 모든 Recommend-why를 한국어로 쓰게 하고 plain English is fine을 삭제한다. 표시 예시 설명·선택지는 한국어로 쓰되 gate 식별자·JSON key·추천 마커는 유지한다.
- rule-ownership은 다섯 경계로 갱신한다. Unreleased에는 final review·migration·context close·finding 자동화·rubric/보고·정본·Retro/경고·usage·언어 규칙을 빠짐없이 기록한다.
- 실패: 문서 검사와 ACQ parser가 기존 기계 식별자를 읽지 못하면 완료하지 않는다. CLI reason/next/cause 원문을 번역하지 않는다.

#### Interface

- 5번 원문: 사용자에게 보이는 모델 작성 메시지(채팅·ACQ 표시·진행·결과 보고)는 한국어로 쓴다. 코드·경로·명령·식별자·CLI 출력 원문은 그대로 둔다. 프로젝트·사용자 지시가 다르면 그 지시를 따른다.
- AskUserQuestion — <gate-id>, HTML acq JSON, A/B/C, (Recommended)는 기계 계약으로 그대로 둔다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | `Hard rules` | Modify | 현재 한국어 5번 추가 | 한국어 5번 추가 | `AGENTS.md:18` |
| `rules/acq.md` | `Recommend-why` | Modify | 현재 영어 허용 삭제 | 영어 허용 삭제·한국어 예시 | `rules/acq.md:40` |
| `docs/architecture/rule-ownership.md` | `경계 개수` | Modify | 현재 다섯 경계 | 다섯 경계·관련 locator 정합 | `docs/architecture/rule-ownership.md:11` |
| `CHANGELOG.md` | `Unreleased` | Modify | 현재 14개 결정 전체 변경 기록 | 14개 결정 전체 변경 기록 | `CHANGELOG.md:8` |
| `test/master-rules.test.js` | `master rules 계약` | Modify | 기존 회귀·문서 계약 검증 | 5번·기존 크기 상한 검사 | `test/master-rules.test.js:428` |
| `test/acq-gate-ids.test.js` | `ACQ parser` | Modify | 기존 회귀·문서 계약 검증 | 한국어 문구·기계 형식 보존 | `test/acq-gate-ids.test.js:120` |

#### Constraints

- 기존 저장 기록·task/light 경로는 Target behavior에서 명시한 범위 외에는 바꾸지 않는다.
- TypeScript 변경은 npm run build로 scripts/lib 생성물을 갱신한다. 생성 JS는 비추적 빌드 산출물이므로 커밋 범위에 추가하지 않는다.
- agents Markdown 변경은 mdToCodexToml 생성기로 대응 TOML을 갱신한다. docs shape heading·읽기 전용 reviewer 경계를 유지한다.
- 사용자 승인·affected_paths·상태 전이는 controller와 게이트 소유다. implementer는 commit·push·branch·증적 성공 상태를 직접 쓰지 않는다.

### EPIC-107/BP-002/TASK-011

#### Goal & intent

모든 구현 task가 통합된 결과에서 전체 CI와 최종 리뷰 진입 계약을 확인함.

#### Current behavior

기존 task011은 commit scaffold이며 검증 전용 종단 node로 작성되지 않았다.

#### Target behavior

선행 10개 구현 task가 integrated가 된 뒤 전체 CI를 한 번 실행하고 verification 증적만 남긴다. 실패는 일반 fan-in repair 절차로 돌려 source 수정을 구현 task에서 수행한다.

#### Interface

- 제공: source diff·commit 없이 실행되는 종단 verification node다.
- 거부: source 변경·task review·commit SHA를 만들지 않는다.

#### Touch

Source 변경 경로 없음.

#### Constraints

- depends_on의 모든 노드는 integrated가 되어야 한다.
- 검증 명령은 frontmatter verify만 사용하고 verification.md 증적은 execute gate가 기록한다.
- 실패한 소스를 이 node에서 직접 수정하지 않는다.