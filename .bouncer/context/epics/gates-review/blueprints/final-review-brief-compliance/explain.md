---
type: bouncer.explain
title: final-review-brief-compliance explain
description: Explain for final-review-brief-compliance
resource: .bouncer/context/epics/gates-review/blueprints/final-review-brief-compliance/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T06:34:10.092+09:00'
bouncer:
  id: EXPLAIN-final-review-brief-compliance
  epic_id: gates-review
  blueprint_id: final-review-brief-compliance
  status: published
  comprehension:
    - range_from: 28fc8b0f2ffe5678767a2009ed44a315d1da806e
      range_to: 14073673b99ad86bee95f0a1a4aed0d1e93ab23c
      diff_sha: 9196b42536c2f839b9b5ed5fcfdcdc633cd84b7a43a32f85a70e6b69925a5f01
      recorded_at: '2026-10-23T06:40:00+09:00'
  task_commits:
    - task: gates-review/final-review-brief-compliance/001
      sha: da932fa5
      intent_anchor: task-001
    - task: gates-review/final-review-brief-compliance/002
      sha: fe219ac2
      intent_anchor: task-002
    - task: gates-review/final-review-brief-compliance/003
      sha: 825fcb74
      intent_anchor: task-003
    - task: gates-review/final-review-brief-compliance/004
      sha: '14073673'
      intent_anchor: task-004
---
# Explain

## Background

최종 리뷰는 blueprint 전체 diff를 여러 관점으로 훑으며 취향성 지적까지 `must_fix`로 올리는 경향이 있었다. 한 번 기록되면 수정 라운드가 없어, 막히지 않은 `must_fix`는 `deferred`로 넘기는 것이 사실상 유일한 출구였다.

이번 변경은 새 blueprint에 `review_contract: brief` 표식을 붙이면 최종 리뷰의 기준을 "승인된 브리프를 이행했는가"로 좁힌다. 브리프 위반은 수정 1회와 delta 라운드 1회로 닫을 수 있다. 표식이 없는 blueprint와 이미 저장된 단일 라운드 리뷰는 기존 동작을 그대로 유지한다.

## Code

- `scripts/src/lib/schema.ts` — `REVIEW_CONTRACT_ENUM`, `reviewContractOf`가 표식을 읽는다. `scaffold.ts`는 새 blueprint에 `brief`를 쓴다.
- `scripts/src/lib/review-dispatch.ts`, `cli-review-dispatch-command.ts` — `classifyExecuteReview`가 표식을 먼저 해석한다. 값이 `null`이면 `review-contract-invalid`로 거절하며, `--task` 범위 리뷰도 예외가 아니다. 거절 문구가 두 파일에 있는 것은 사용법 거절 경로가 분류기를 `require`하지 않아야 해서 둔 의도적 중복이다.
- `scripts/src/lib/review-record.ts`, `validate-sections.ts`, `validate-gates-finalize.ts` — 표식 blueprint의 `must_fix` finding은 `brief_clause`를 가져야 한다(`BRIEF_CLAUSE_PATTERN`). 거절은 문서를 쓰기 전에 끝나 저장 바이트가 바뀌지 않는다. 계약이 잘못된 경우 G21이 직접 실패한다.
- `scripts/src/lib/coordinator-repair.ts`, `coordinate-next.ts` — `finalReviewGate`가 최종 리뷰 뒤 repair를 한 번만 허용한다. 첫 repair가 `newPaths`를 선언하면 `final-review-repair-scope`, 두 번째 repair는 `final-review-single-round`로 거절된다.
- 문서 쪽(`review-round.md`, `final_review.md`, `references/review/*`, 에이전트 정의)은 같은 규칙을 안내한다.
- 알려진 한계: `rules/cli.md`의 repair 절이 두 번째 repair도 `final-review-repair-scope`로 거절된다고 쓰는데 실제 코드는 `final-review-single-round`만 낸다. 리뷰 원인 repair 판정과 delta 라운드 읽기 함수가 두 곳에 중복돼 있고, `review-contract-invalid` 문구 리터럴이 여러 파일에 복제돼 있다.

## Quiz

1. 표식이 `null`인 blueprint에서 `--task` 범위 리뷰를 dispatch하면?
   - (1) 기존 규칙대로 통과한다
   - (2) `review-contract-invalid`로 거절된다
   - (3) 표식을 `brief`로 간주하고 진행한다

2. 표식 blueprint에서 `brief_clause` 없이 `must_fix` finding을 기록하려 하면?
   - (1) 문서를 쓰기 전에 거절되어 저장 내용이 바뀌지 않는다
   - (2) 기록되지만 advisory로 강등된다
   - (3) 기록된 뒤 G21에서만 실패한다

3. 표식 blueprint의 최종 리뷰 뒤 두 번째 repair를 시도하면?
   - (1) 항상 `final-review-repair-scope`로 거절된다
   - (2) `final-review-single-round`로 거절된다
   - (3) delta 라운드 없이 허용된다

4. 표식이 없는 기존 blueprint의 최종 리뷰는?
   - (1) 새 규칙으로 자동 전환된다
   - (2) 기존 단일 라운드 규칙을 그대로 따른다
   - (3) `review-contract-invalid`로 막힌다

## Tasks

### gates-review/final-review-brief-compliance/001 · `da932fa5`

#### Goal & intent

blueprint frontmatter `bouncer.review_contract: brief`를 새 리뷰 계약의 단일 표식으로 도입하고, 이 표식이 있는 blueprint의 최종 리뷰(task 없는 `review-dispatch execute`) 관점을 브리프 이행 판정 두 관점으로 고정한다.
같은 표식 blueprint는 task 없는 `--mode delta` 분류를 받아 TASKS-003의 수정 뒤 delta 라운드가 쓸 입력을 낸다.
완료 판정은 아래 Checklist 테스트와 `node --test test/review-dispatch.test.js test/scaffold.test.js test/validate-structural.test.js test/schema.test.js` 통과다.

#### Current behavior

- scaffold: `scripts/src/lib/scaffold.ts:507-532`가 blueprint frontmatter를 `id … scale, review_scope: 'blueprint', verification_policy: 'scoped_terminal', [area], [attribution], supersedes` 순서로 쓴다. full·light 같은 경로다.
- 값 검사: `review_scope`는 구조 검사 S31(`scripts/src/lib/validate-structural.ts:203-211`), `scale`은 S20(`:195-201`)이 거절한다. `verification_policy`는 `scripts/src/lib/schema.ts:67-89`의 `verificationPolicyOf()`가 `'legacy' | 값 | null`로 해석한다. 사용 중인 최고 S 코드는 S37이고 S38은 비어 있다.
- 관점 선택: `scripts/src/lib/review-dispatch.ts:720-730`이 blueprint `index.md`를 `readDoc`으로 읽어 `scale`만 본다. `:810-819`가 small 또는 light면 `['combined']`, 아니면 `['spec_scope','correctness_tests','minimality_maintainability']`를 고르고 `risk.flags`가 비어 있지 않으면 어떤 값이든 `security`를 붙인다(`public_interface`만 있어도 붙음). task 없는 호출은 `unionCommitReviewRisk`(`:873-906`)로 commit task `review_risk` 합집합을 쓴다. delta는 `:837-850`에서 `single`/`['combined']`이고 security를 붙이지 않는다.
- delta 거절: `scripts/src/lib/cli-review-dispatch-command.ts:254-257`이 `--mode delta`에 `--task`가 없으면 파일을 읽기 전에 사용법 오류를 내고, `cmdReviewDispatch`가 exit 2를 돌려준다(`:285-288`). 분류기 모듈은 그 뒤에야 `require`된다(`:291`).
- 재현: `test/review-dispatch.test.js:1062`('task 없는 execute에 --mode delta → usage exit 2'), `:986`(public_interface → security), `:890`(parallel 3관점), `:1432`(blueprint 범위 risk 합집합).
- I/O 결합: 분류기는 `readDoc`·`fs.existsSync`로 repoRoot 아래 문서를 직접 읽고(`review-dispatch.ts:722,748,754,877,887`), git은 주입된 `exec`(`:690`)와 `deps.runGit`(`:795-798`)만 쓴다. 테스트는 임시 repo fixture(`writePlanTree` `test/review-dispatch.test.js:207-226`, `makeRepo` `:245`)를 쓴다.

#### Target behavior

- 성공:
  - 새 full `scaffold blueprint`는 `verification_policy` 바로 뒤에 `review_contract: brief`를 쓴다. `--scale light` scaffold는 쓰지 않는다.
  - 표식 blueprint, task 없음, discovery → `strategy: 'parallel'`, `perspectives`는 `['spec_scope','correctness_tests']`. diff 크기와 무관하다. commit task `review_risk` 합집합에 `authentication`·`authorization`·`credential` 중 하나가 있으면 `security`를 끝에 더한다.
  - 표식 blueprint, task 없음, `--mode delta` → exit 0, `strategy: 'single'`, `perspectives: ['combined']`(현행 delta 분기 그대로).
  - `reasons`의 첫 줄은 `review_contract brief — brief-compliance perspectives`이고, 둘째 줄은 security를 더하면 `review_risk <flags> adds security reviewer`, 아니면 `review_risk has no authentication/authorization/credential — no security reviewer`다.
- 실패:
  - `review_contract`가 `brief`가 아닌 값(빈 문자열·null 포함)이면 구조 검사 `S38 review_contract must be brief`.
  - `review_contract`와 `scale: light`가 함께 있으면 `S38 review_contract is not allowed on a light blueprint`.
  - `review_contract`가 있는데 `review_scope`가 `blueprint`가 아니면 `S38 review_contract requires review_scope blueprint`.
  - 표식이 없는 blueprint에서 task 없는 `--mode delta` → 지금과 같은 메시지로 exit 2, stdout 없음, 분류기 모듈 미적재.
  - task 없는 `--mode delta`에서 blueprint index를 읽지 못하면 → 지금과 같은 `--task` 사용법 메시지로 exit 2(legacy 출력 보존). 표식이 `null`이면 → exit 2, 메시지 `review-contract-invalid: review_contract must be brief`. 두 경우 모두 stdout 없음, 분류기 모듈 미적재.
  - 분류기(discovery)에서 표식이 `null`이면 `ok:false`, error `review-contract-invalid: review_contract must be brief`.
  - blueprint `index.md`를 읽지 못하면 지금처럼 `blueprint index unreadable` ok:false.
- 보존:
  - 표식 없는 blueprint(light 포함)와 task 범위(`--task`) 리뷰의 관점·security 판정은 바이트 단위로 같은 출력이다.
  - plan 스냅샷 구조 해시(`scripts/src/lib/plan-snapshot-contract.ts:55-58`의 `{scale, review_scope}`)에 표식을 넣지 않는다.

#### Interface

- 제공:
  - frontmatter 키 `bouncer.review_contract` — 허용 값 `brief` 하나. 예: `review_contract: brief`. 부재는 legacy다.
  - `schema.ts`: `REVIEW_CONTRACT_ENUM = ['brief']`, `reviewContractOf(bouncer: unknown): 'brief' | 'legacy' | null` — 비객체·키 부재는 `'legacy'`, 허용 값은 그대로, 그 밖은 `null`. `verificationPolicyOf`와 같은 모양이다.
  - 구조 코드 `S38`.
  - `review-dispatch execute --blueprint <dir> --mode delta`(task 없음)를 표식 blueprint에서 받음.
  - 브리프 security 위험 집합(domain term): `authentication`·`authorization`·`credential`. `public_interface`는 이 집합에 없다.
- 거부:
  - 즉시 거절(throw 아님, 반환): `S38` 구조 실패 2종, 표식이 `brief`가 아닌 blueprint의 task 없는 delta(exit 2, Target behavior의 메시지).
  - fallback 없음: 표식 해석이 `null`이면 dispatch는 legacy로 접지 않고 `review-contract-invalid`로 거절한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/schema.ts` | `verificationPolicyOf` | Modify | blueprint 정책 키 enum·해석기 | `REVIEW_CONTRACT_ENUM`·`reviewContractOf` 추가·export | 소비자(dispatch·record·coordinator·gate)가 같은 판정을 쓰는 단일 해석기 |
| `scripts/src/lib/scaffold.ts` | `scaffoldBlueprint` frontmatter 블록 | Modify | 새 blueprint 키 기록(:507-532) | full이면 `verification_policy` 뒤 `review_contract: 'brief'`, light면 쓰지 않음 | 새 계획만 새 계약을 받게 하는 진입점 |
| `scripts/src/lib/validate-structural.ts` | S31 인접 블록 | Modify | blueprint 키 값 구조 검사(:195-211) | S38 추가(값 검사, light 동시 사용 거절) | 잘못된 표식을 legacy로 오인하지 않게 거절 |
| `scripts/src/lib/review-dispatch.ts` | `classifyExecuteReview` | Modify | 실행 리뷰 관점 선택(:720-850) | 표식 읽기, 브리프 관점·security 조건 분기 | R-R1·R-R2의 판정 지점 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `parseReviewDispatchArgs`, `cmdReviewDispatch` | Modify | task 없는 delta 사용법 거절(:254-257), 분류기 지연 적재(:285-291) | parser 거절을 `cmdReviewDispatch`의 분류기 적재 전 단계로 옮겨 blueprint index 표식을 확인, 표식 없으면 같은 메시지로 exit 2; HELP 문구 | 사용법 거절이 분류기를 적재하지 않는 계약 유지 |
| `rules/document-schema.md` | `review_scope`·`verification_policy` 절 | Modify | blueprint 키·S 코드 서술(:57-58, :94-99) | `review_contract` 키와 S38 서술 | 키 계약의 정본 문서 |
| `test/review-dispatch.test.js` | `writePlanTree`, delta 사용법 테스트(:1062) | Modify | 관점·delta 계약 테스트 | 표식 fixture 옵션, 브리프 관점·security·delta 테스트 추가, :1062는 표식 없는 경우로 유지 | 계약 변경을 고정 |
| `test/scaffold.test.js` | verification_policy 테스트(:967) | Modify | 새 blueprint frontmatter 단언 | `review_contract: brief` 단언 추가 | scaffold 출력 변경 |
| `test/validate-structural.test.js` | S31 테스트(:1128) | Modify | 구조 코드 단언 | S38 테스트 추가 | 새 구조 코드 |
| `test/schema.test.js` | `verificationPolicyOf` 테스트(:98) | Modify | 정책 해석기 단언 | `reviewContractOf` 단언 추가 | 새 해석기 |

#### Constraints

- 표식이 없는 blueprint의 dispatch 출력(strategy·perspectives·reasons·exit code)은 바뀌지 않는다. 기존 테스트 기대값을 바꾸지 않는다(새 테스트만 추가).
- 분류기는 표식을 먼저 해석해 `null`이면 light 여부와 무관하게 `review-contract-invalid`로 거절한다. 값이 `brief`인 표식과 light·`review_scope`의 조합은 plan gate의 S38만 막고, 분류기의 light 분기(`single`/`['combined']`)는 그 뒤에 그대로 적용된다.
- task 범위(`--task`) 리뷰는 표식과 무관하게 현행 규칙이다.
- 사용법 거절 경로는 `review-dispatch` 모듈을 `require`하지 않는다. 표식 확인은 `readDoc`과 `schema.reviewContractOf`만 쓴다.
- 경로명·diff 내용으로 위험을 추측하지 않는다(현행 원칙).

### gates-review/final-review-brief-compliance/002 · `fe219ac2`

#### Goal & intent

`review_contract: brief` blueprint의 root `review.md`가 `discovery` 또는 `discovery,delta` 순서만 받고, `must_fix` finding은 브리프 섹션을 가리키는 `brief_clause`를 가져야 하며 `deferred`로 닫을 수 없게 한다.
`bouncer review record`와 finalize G21이 같은 계약(`roundScope: 'blueprint_brief'`)으로 판정한다. 표식이 없는 blueprint는 지금 계약 그대로다.
완료 판정은 Checklist 테스트와 `node --test test/review-record.test.js test/validate-gates.test.js` 통과다.

#### Current behavior

- 범위 판정: `scripts/src/lib/review-record.ts:67-79` `isBlueprintReviewScopeAt`이 `index.md`의 `review_scope === 'blueprint'`만 boolean으로 본다.
- delta 거절: `review-record.ts:343-350`이 blueprint 범위의 `mode: 'delta'` 입력을 파일을 읽기 전에 `final-review-single-round`로 거절한다(`test/review-record.test.js:448`).
- record 판정: `review-record.ts:403-413`이 `collectFindingFailures({ roundScope: blueprintScope ? 'blueprint' : undefined })`를 부르고, 진행 중 접두 순서만 `isAllowedSequencePrefix`(`:90-105`)로 허용한다. accept-risk(`:463-560`)도 `roundScope: 'blueprint'`(`:537`)를 쓴다.
- finding 검사: `scripts/src/lib/validate-sections.ts:451-484`가 mode 계약에서 `brief_clause`를 포함한 필드의 비어 있음만 검사한다. 값 형식 검사는 없다. 예시 값은 `tasks/001 Interface`(`references/coordinator-cards/final_review.md:168`).
- deferred 예외: `validate-sections.ts:495-513`이 `roundScope === 'blueprint'`면 `deferred`(+note) `must_fix`와 accepted_risk `must_fix`를 accepted 문서에 허용한다.
- 라운드 계약: `validate-sections.ts:101-125` — `EXECUTE_ROUND_CONTRACT`(`discovery`, `discovery,delta`, `discovery,delta,critical_recovery,delta`), `BLUEPRINT_ROUND_CONTRACT`(+`discovery,delta,delta`). 선택은 `:516-520`. `roundScope` 타입은 `'blueprint'`뿐이다(`:402-417`).
- G21: `scripts/src/lib/validate-gates-finalize.ts:92-162`가 `isBlueprintReviewMode`일 때 `roundScope: 'blueprint'`(`:129`)로 `collectFindingFailures`를 부르고 `isBlockingReviewFailure`(`scripts/src/lib/validate-gates-shared.ts:236-249`)로 거른다.
- I/O 결합: record는 `fs.readFileSync`+`parseFrontmatter`로 index를 읽고 `writeReviewDocAtomically`(`:423`)로 쓴다. G21은 `docs.blueprintIndex`(이미 읽힌 문서)와 `deps.exec`·`deps.readCoordinatorLedger`(`validate-gates-finalize.ts:138,146`)를 쓴다.
- 테스트: `test/review-record.test.js:209,219,236`(deferred must_fix), `:323,:332`(accept-risk), `:448`(delta 거절), `:460`(discovery,delta,delta 읽기), `:599`(card fence); `test/validate-gates.test.js:2412-2456`(G21 순서·must_fix), `:2805`.

#### Target behavior

- 성공:
  - 표식 blueprint에서 저장된 rounds가 `[discovery]`일 때 `mode: 'delta'` 입력을 받아 `discovery,delta`로 기록한다. 이전 finding을 `resolved`로 닫고 문서를 `accepted`로 기록할 수 있다.
  - 표식 blueprint의 `must_fix` finding `brief_clause`가 브리프 조항 참조면 통과한다.
  - G21은 표식 blueprint의 accepted `discovery` 또는 `discovery,delta` 리뷰를 통과시킨다.
- 실패:
  - 표식 blueprint에 delta가 이미 저장된 뒤의 새 delta → `final-review-single-round`, 문서 바이트 불변. `next`는 "discovery and one delta are used; report remaining violations as blocked"의 뜻을 담는다.
  - 표식 blueprint의 `must_fix` `brief_clause`가 브리프 조항 참조가 아님 → `review finding <id> must_fix brief_clause is not a brief section` 메시지로 record `review-ledger-invalid`.
  - 표식 blueprint의 accepted 문서에 `deferred` `must_fix` → `accepted with open must_fix`(record와 G21 모두).
  - 표식 blueprint 라운드 순서 `discovery,delta,delta` → record에서 `review rounds sequence invalid`. G21은 라운드 순서 형식을 `isBlockingReviewFailure`로 걸러 record에 맡긴다(현행 원칙).
- 보존:
  - 표식 없는 blueprint: delta 거절, deferred 예외, `discovery,delta,delta` 읽기, accept-risk 동작이 그대로다.
  - 표식 blueprint에서도 `accepted_risk: true`+note `must_fix`(사용자 승인 뒤 `review accept-risk`)는 accepted를 허용한다.
  - task 범위(G14) 판정은 바뀌지 않는다.

#### Interface

- 제공:
  - `collectFindingFailures`의 `roundScope?: 'blueprint' | 'blueprint_brief'`. `blueprint_brief`는 `BRIEF_ROUND_CONTRACT`(`sequences: ['discovery', 'discovery,delta']`)를 쓰고 deferred `must_fix` 예외가 없으며 `must_fix` 조항 검사를 켠다.
  - 브리프 조항 참조(domain term): 대소문자 무시, `tasks/<NNN> <섹션>` 또는 `contract`로 시작하고 그 뒤는 끝이거나 공백. `<섹션>`은 브리프 8섹션 `goal & intent`·`current behavior`·`target behavior`·`interface`·`touch`·`do not touch`·`constraints`·`checklist`. 예: `tasks/001 Checklist`, `tasks/002 Target behavior`, `Contract 실패 모드`.
  - `review-record.ts` 범위 판정이 `'task' | 'blueprint' | 'blueprint_brief'`를 돌려주는 형태(신규 추출 지점: blueprint index의 review_scope·review_contract 해석).
- 거부:
  - 즉시 거절(반환): 위 실패 4종. throw 없음.
  - `review_contract`가 `null`(TASKS-001 `reviewContractOf` 기준 잘못된 값)이면 record와 accept-risk는 `review-contract-invalid`로 거절하고 문서를 쓰지 않는다. G21은 legacy로 접지 않고 `collectFindingFailures` 필터를 거치지 않는 직접 실패 `review-contract-invalid: review_contract must be brief`로 남긴다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-sections.ts` | `collectFindingFailures`, `BLUEPRINT_ROUND_CONTRACT` | Modify | finding·라운드 계약 판정(:101-125, :402-520) | `blueprint_brief` 범위, `BRIEF_ROUND_CONTRACT`, must_fix 조항 검사, deferred 예외 제외 | record와 G21이 공유하는 단일 판정 |
| `scripts/src/lib/review-record.ts` | `isBlueprintReviewScopeAt`, `recordReview`, `isAllowedSequencePrefix`, `acceptReviewRisk` | Modify | 범위 판정·delta 거절·record 판정(:67-105, :329-424, :463-560) | 표식 해석, 표식이면 delta 1회 허용·두 번째 거절, `blueprint_brief` 전달 | R-F7·R-F8 기록 지점 |
| `scripts/src/lib/validate-gates-finalize.ts` | G21 블록 | Modify | 최종 리뷰 gate(:92-162) | `reviewContractOf(docs.blueprintIndex 의 bouncer)`가 `brief`면 `roundScope: 'blueprint_brief'`, `null`이면 필터를 거치지 않고 `review-contract-invalid: review_contract must be brief`를 직접 add | 기록과 마감이 같은 답 |
| `test/review-record.test.js` | blueprint 범위 테스트(:209-460) | Modify | record 계약 테스트 | 표식 fixture와 delta·조항·deferred 테스트 추가 | 계약 고정 |
| `test/validate-gates.test.js` | G21 테스트(:2412-2456) | Modify | G21 판정 테스트 | 표식 blueprint 순서·deferred·accepted_risk 테스트 추가 | 계약 고정 |

#### Constraints

- 표식 없는 blueprint와 task 범위의 기존 테스트 기대값을 바꾸지 않는다.
- `REPAIR_WAVE_LIMIT`와 `BLUEPRINT_ROUND_CONTRACT`의 값은 바꾸지 않는다(legacy 저장본 읽기).
- 조항 검사는 표식 blueprint의 `actionability: must_fix`에만 건다. advisory와 context review namespace에는 걸지 않는다.
- fingerprint 계산식(`<category>:<brief_clause>:<file>#<symbol>`)은 바꾸지 않는다.
- 거절은 문서를 쓰기 전에 끝나 저장 바이트가 바뀌지 않는다.

### gates-review/final-review-brief-compliance/003 · `825fcb74`

#### Goal & intent

`review_contract: brief` blueprint에서 최종 discovery가 저장된 뒤 리뷰 원인 `coordinate repair --review-finding`을 한 번 받고, 그 repair와 terminal 재검증이 통합되면 `coordinate next`가 delta 최종 리뷰(`review-dispatch execute … --mode delta`)를 낸다.
delta 뒤에도 root review가 accepted가 아니면 `final-review-blocked`이고, 두 번째 리뷰 원인 repair·supplement는 `final-review-single-round`로 거절한다. 표식이 없는 blueprint는 지금 동작 그대로다.
완료 판정은 Checklist 테스트와 `node --test test/coordinator.test.js test/coordinate-next.test.js test/cli-coordinate.test.js` 통과다.

#### Current behavior

- 표식 판정 헬퍼: `scripts/src/lib/coordinator-worker.ts:90-108` `isBlueprintReviewModeAt`이 `readDoc`으로 `index.md`를 읽어 `review_scope === 'blueprint'`만 본다(ENOENT·YAMLException은 false). validate-docs를 require하면 순환이 생겨 조건식을 복제한다(`:96-97`).
- repair 거절: `scripts/src/lib/coordinator-repair.ts:1140-1143`이 `(kind === 'supplement' || Array.isArray(reviewFindings)) && finalReviewDiscoveryStored(...)`면 원장을 쓰기 전에 `final-review-single-round`를 낸다. `supplementDone`도 잠금 안에서 같은 거절(`:375-377`). `finalReviewDiscoveryStored`는 `:269-283`, `rootReviewHasDelta`는 `:242-260`.
- 리뷰 원인 repair 경로(현재 discovery 뒤 도달 불가): `coordinator-repair.ts:1230-1321` — wave 상한(`repair-wave-limit`), 원인 모호, 증거·decision·`sourceRepairPaths`(`repair-scope-out-of-bounds`), `checkRepairIntake`(`newPaths` 포함), 전부 integrated 요구, terminal을 `depends_on: [repairId]`·`pending`으로 되돌리고 `RepairDecision`(`kind: 'repair'`, `failure.command: 'review'`)을 `decisions`·`repairWaves`에 넣는다.
- 재검증: repair task가 pending이라 `allIntegrated`가 false가 되고, prepare·integrate 뒤 terminal이 `verification_node`로 다시 돈다(`scripts/src/lib/coordinate-next.ts:713-723`).
- next 결정: `coordinate-next.ts:748-788` — 모두 integrated + 리뷰 모드 + root review 미accepted에서 discovery가 저장돼 있으면(`rootReviewHasDiscoveryRound` `:472-480`) `blocked`/`final-review-blocked`, 아니면 pending supplement면 `supplement`, 아니면 `final_review`(argv `bouncer review-dispatch execute --blueprint --base --head`, judge `review-round`).
- reason 문구: `coordinate-next.ts:113-117`(`final-review-blocked`), `scripts/src/lib/coordinator-commands.ts:1727-1731`(`final-review-single-round`).
- I/O 결합: 원장은 `withLedgerLock`+`support.openLedgerFenced`, 쓰기는 `commitWrite`(`coordinator-repair.ts:1316`)와 문서 롤백(`:1311-1320`). git은 주입된 `exec`(`coordinate-next.ts:752`). 테스트 seam은 `deps.runVerification`(`coordinator-repair.ts:406`), `deps.appendHandoff`(`:53`).
- 테스트: `test/coordinator.test.js:5094`(discovery 뒤 repair·supplement 거절), `:5105`, `:5118`(CI repair 허용), `:3834`(리뷰 repair가 terminal 재개); `test/coordinate-next.test.js:539`, `:553`(final-review-blocked), `:254`(reason 목록); `test/cli-coordinate.test.js:784`.

#### Target behavior

- 성공(표식 blueprint):
  - discovery 저장, delta 없음, 리뷰 원인 repair decision 없음 → `repair --review-finding`이 기존 경로(`:1230-1321`)로 접수된다.
  - 그 repair와 terminal이 integrated, root review에 discovery만 있고 미accepted, 원장에 리뷰 원인 repair decision 있음 → `action: 'final_review'`, argv 끝에 `--mode delta`, `judge: { kind: 'review-round' }`.
- 실패(표식 blueprint):
  - 리뷰 원인 repair decision이 이미 있거나 root review에 delta가 있음 → 리뷰 원인 repair `final-review-single-round`, 원장·문서 바이트 불변.
  - 리뷰 원인 repair에 `newPaths`가 비어 있지 않음 → 새 reason `final-review-repair-scope`(승인된 `affected_paths` 밖), 원장 불변. coordinator는 이를 `blocked`로 보고하고 `/bouncer-plan`을 안내한다.
  - discovery 저장 뒤 supplement 접수·`--done` → 지금처럼 `final-review-single-round`.
  - delta 저장 뒤 미accepted → `final-review-blocked`.
  - discovery 저장, 리뷰 원인 repair 없음, 미accepted → `final-review-blocked`(action·reason은 현행, cause·next는 Interface의 표식용 문구).
- 보존:
  - 표식 없는 blueprint의 repair·supplement 거절, next 분기, reason 문구 의미가 그대로다.
  - CI 원인 `repair --failure-command`, wave 상한(`repair-wave-limit`), `review-repair-requires-integrated`는 표식과 무관하게 그대로다.
  - ledger 형식(decision kind·필드)은 바뀌지 않는다.

#### Interface

- 제공:
  - `coordinator-worker.ts`: 신규 추출 지점 — 표식 판정 `reviewContractAt(root, blueprint): 'brief' | 'legacy' | null`(index ENOENT·YAMLException은 `isBlueprintReviewModeAt`처럼 `'legacy'`; `review_scope !== 'blueprint'`면 `'legacy'`; 그 밖은 TASKS-001 `schema.reviewContractOf(bouncer)` 결과 그대로).
  - 리뷰 원인 repair decision(domain term): `ledger.decisions` 항목 중 `kind === 'repair'`이고 `failure.command === 'review'`. 예: `{ kind: 'repair', wave: 1, failure: { command: 'review', … } }`.
  - `coordinate next` `final_review` payload의 argv: `['bouncer','review-dispatch','execute','--blueprint',bp,'--base',base,'--head',head,'--mode','delta']`.
  - 새 reason 소유: `final-review-repair-scope`는 repair 거절이라 `coordinator-commands.ts` reason 표에만 둔다. `review-contract-invalid`는 next가 내는 blocked reason이자 repair 거절이라 `coordinate-next.ts` `NEXT_FAILURE_HINTS`와 `coordinator-commands.ts` reason 표 양쪽에 둔다.
  - 표식 적용 조건: `reviewContractAt`은 `review_scope !== 'blueprint'`면 `'legacy'`다. S38(TASKS-001)이 `review_scope: blueprint` 없는 표식을 plan gate에서 거절하므로 dispatch와 coordinator가 같은 blueprint를 다르게 읽는 경우는 승인된 계획에 없다.
  - `final-review-blocked`의 cause·next 문구: 표식 blueprint에서 discovery 뒤 리뷰 원인 repair가 아직 없으면 "open must_fix가 브리프 위반이면 `coordinate repair --review-finding`을 한 번 연다"를, delta 뒤면 `the one review repair and delta are used`를 포함해 사용자 결정을 기다린다는 뜻을 담는다. 표식 없는 blueprint 문구는 그대로다.
- 거부:
  - 즉시 거절(반환 `{ ok:false, reason }`, throw 없음): `final-review-single-round`, `final-review-repair-scope`, `review-contract-invalid`(`reviewContractAt`이 `null`인 blueprint의 리뷰 원인 repair·supplement·최종 리뷰 next; next는 `action: 'blocked'`, `reason: 'review-contract-invalid'`).
  - fallback 없음: review.md YAML 파손은 지금처럼 오류로 올린다(없음으로 접지 않음).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator-worker.ts` | `isBlueprintReviewModeAt` | Modify | 리뷰 모드 판정(:90-108) | 옆에 `reviewContractAt` 추가·export | coordinator 모듈이 validate-docs 없이 같은 표식 판정 |
| `scripts/src/lib/coordinator-repair.ts` | `coordinateRepair`, `supplementDone`, `finalReviewDiscoveryStored` | Modify | 최종 리뷰 뒤 repair·supplement 거절(:269-283, :375-377, :1140-1143) | 표식이면 리뷰 원인 repair 1회 허용, `newPaths` 거절, 두 번째 거절; 표식 `null`이면 리뷰 원인 repair·supplement를 `review-contract-invalid`로 거절 | R-F1·R-F2·R-F8 접수 지점 |
| `scripts/src/lib/coordinate-next.ts` | `rootReviewHasDiscoveryRound`, 최종 리뷰 분기 | Modify | final_review·blocked·supplement 결정(:748-788), reason 문구(:90-117 `NEXT_FAILURE_HINTS`) | 표식이면 delta `final_review` 분기와 delta 뒤 blocked, 표식용 `final-review-blocked` 문구, `NEXT_FAILURE_HINTS`에 `review-contract-invalid` 추가 | R-F3·R-F4·R-F5 전이 |
| `scripts/src/lib/coordinator-commands.ts` | reason 표 | Modify | reason cause·next(:1727-1731) | `final-review-repair-scope`·`review-contract-invalid` 추가, `final-review-single-round` 문구에 표식 blueprint 경우 추가 | 거절 안내 정본 |
| `test/coordinator.test.js` | 최종 리뷰 repair 테스트(:5094-5118) | Modify | repair 거절·허용 테스트 | 표식 fixture와 1회 허용·두 번째 거절·newPaths 거절 추가 | 계약 고정 |
| `test/coordinate-next.test.js` | final-review-blocked 테스트(:539-553), reason 목록(:254) | Modify | next 분기 테스트 | 표식 delta 분기·delta 뒤 blocked 추가, reason 목록 갱신 | 계약 고정 |
| `test/cli-coordinate.test.js` | repair CLI 테스트(:784) | Modify | CLI 거절 exit 1 | 표식 blueprint 1회 허용 CLI 케이스 추가 | CLI 경계 |

#### Constraints

- 거절은 원장·task 문서를 쓰기 전에 끝나 바이트가 바뀌지 않는다(현행 원칙).
- 리뷰 원인 repair 접수 순서는 현행 검사 순서(wave 상한 → 원인 모호 → 증거 → 경로 → intake → integrated)를 바꾸지 않고, 표식 판정은 그 앞에 둔다.
- 표식 없는 blueprint의 기존 테스트 기대값을 바꾸지 않는다.
- 새 action 이름·ledger 필드를 만들지 않는다. delta는 기존 `final_review` action의 argv로만 표현한다.
- `critical_recovery`를 최종 리뷰 경로에 넣지 않는다.

### gates-review/final-review-brief-compliance/004 · `14073673`

#### Goal & intent

코디네이터·reviewer가 읽는 문서가 TASKS-001~003의 실제 계약을 서술하게 한다. 표식(`review_contract: brief`) blueprint와 표식 없는(legacy) blueprint의 최종 리뷰 규칙을 나눠 쓴다.
완료 판정은 Checklist의 문자열 단언과 `node --test test/agents.test.js test/review-record.test.js test/coordinator.test.js test/distribution.test.js` 통과다.

#### Current behavior

- `skills/bouncer-run/references/review-round.md:65-80`: 3단계는 "decide must_fix or advisory from the brief, evidence, and changed range"이고, 4단계는 blueprint review mode에 fix step이 없으며 `must_fix`는 `deferred`+note로 넘기고 discovery 뒤 repair·supplement·delta는 `final-review-single-round`로 거절된다고 쓴다. 관점 선택은 `:76-83`.
- `references/coordinator-cards/final_review.md:38-41`은 delta 라운드가 없다고 쓰고, `:54-74`는 discovery 뒤 분류(비blocked `must_fix` → deferred+accepted, blocked → open/requested)와 accept-risk를 쓴다. `:118-127`의 상태 표와 "Final review order"는 discovery 한 라운드로 끝난다고 쓴다. JSON fence 예시는 하나(`:129-179`, `brief_clause: "tasks/001 Interface"` `:168`)이고 `test/review-record.test.js:599`가 그 fence를 실제 record로 재생한다.
- `references/review/index.md:109-115`와 `agents/bouncer-reviewer.md:69-92`는 관점 선택(`parallel` → 비security 3관점, risk_flags 비어 있지 않으면 security)과 security 사용 조건 "non-empty `risk_flags`"를 쓴다. `references/review/assets/reviewer-prompt.md:23-30,127-130`도 같은 조건을 쓴다.
- `agents/bouncer-coordinator.md:152-158`은 최종 리뷰 test-evidence `must_fix`를 supplement 뒤 "the one delta round"로 닫는다고 써 단일 라운드 서술과 어긋난다.
- `.codex/agents/*.toml`은 `scripts/src/lib/codex-agents.ts:35-56` `mdToCodexToml(md)`의 바이트 동일 사본이어야 하고, `test/agents.test.js:44,71,130`과 `test/distribution.test.js:241-245`가 검사한다. 재생성 npm 스크립트는 없어 이전 task들은 TOML을 직접 맞췄다(커밋 `aca3e9ee`).
- 고정 문자열: `test/agents.test.js:281`이 reviewer.md·review/index.md·reviewer-prompt.md·cards/review.md·cards/final_review.md에 8섹션 목록 문자열 "Goal & intent, Current behavior, Target behavior, Interface, Touch, Do not touch, Constraints, Checklist"를 요구한다. `test/coordinator.test.js:1882`가 review-round.md·final_review.md에 `review-dispatch execute`, `ok: false`, target mismatch, risk_flags, agent-dispatch 링크를 요구한다. `scripts/check-doc-shape.js:784-801`이 coordinator·reviewer의 H2 순서를, `:747-749`가 review/index.md H2를 고정한다. `test/agents.test.js:160`은 coordinator "Worker dispatch" 본문 20줄 이하를 고정한다.
- `rules/cli.md:361-365`은 "non-empty review_risk still appends security"를, `:468-470`은 최종 리뷰가 단일 라운드라는 accept-risk 근거를, `:488-494`는 supplement `--done` 뒤 "the one delta round"를 쓴다.
- `CHANGELOG.md:8-17`은 `## [Unreleased]` → `### Added` → `### Fixed` 구조이고 항목은 `- **제목** — 본문` 한국어다.

#### Target behavior

- 표식 blueprint 서술(새로 추가):
  - 관점: `spec_scope`·`correctness_tests` 두 개, `security`는 `review_risk`가 `authentication`·`authorization`·`credential` 중 하나일 때만. 판정 기준은 승인된 브리프 8섹션과 blueprint Contract 이행이고, 새 설계·리팩터링 의견은 advisory다.
  - `must_fix`는 브리프 위반(Do not touch·`affected_paths` 밖 변경, Interface 제공·거부 위반, Constraints 위반, Checklist 미수행 또는 브리프보다 느슨한 단언, Contract 실패 모드 미이행, 열린 security 관점의 해당 위험 결함)에만 쓰고 `brief_clause`는 `tasks/<NNN> <섹션>`(섹션은 브리프 8섹션 이름) 또는 `Contract`로 시작한다. 그렇지 않은 reviewer `must_fix`는 controller가 advisory로 낮추고 `severity_changes`에 `no-brief-clause` 또는 `not-brief-violation`을 남긴다.
  - 순서: discovery → `must_fix`가 있으면 위반 finding 전부를 한 번의 `coordinate repair --review-finding`으로(승인 경로 안, `newPaths` 없음) → terminal 재검증 → `coordinate next`의 delta `final_review`(`combined` 1명) → accepted, 또는 남으면 `final-review-blocked`. 두 번째 수정은 없고 `final-review-repair-scope`·`final-review-single-round`는 blocked로 보고한다. advisory는 `accepted` 또는 `deferred`+note로 남기고 최종 보고에 경고로 싣는다.
- legacy 서술(보존): 표식 없는 blueprint의 단일 discovery 라운드·deferred `must_fix` 규칙 문장은 "표식 없는 blueprint" 조건을 붙여 남긴다.
- coordinator.md `:152-158`의 supplement 문장은 legacy에서 discovery 전 supplement만 해당하도록 고치고 "the one delta round"를 표식 blueprint 흐름 참조로 바꾼다.
- `.codex/agents/bouncer-reviewer.toml`·`bouncer-coordinator.toml`은 고친 Markdown의 `mdToCodexToml` 결과와 바이트 동일하다.
- CHANGELOG `[Unreleased]`에 `### Changed` 항목 하나를 추가한다.
- 실패 기준: 위 고정 문자열·H2 순서·20줄 제한·fence 1개가 깨지면 이 task의 verify가 실패한다.

#### Interface

- 제공: 문서 문장만 바뀐다. 새 CLI·필드는 없다. 문서가 인용하는 이름은 `review_contract: brief`, `brief_clause`, `severity_changes`, `no-brief-clause`, `not-brief-violation`, `final-review-repair-scope`, `review-contract-invalid`, `final-review-single-round`, `final-review-blocked`, `--mode delta`다. 표식은 full blueprint에만 있고 light에는 없다(S38).
- 거부: TASKS-001~003이 구현하지 않은 동작(두 번째 수정, `critical_recovery`, 표식 없는 blueprint의 delta)을 허용된다고 쓰지 않는다. `skills/bouncer-run/references/direct-run.md`는 고치지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/review-round.md` | 3·4단계 | Modify | 리뷰 라운드 절차(:60-83) | 표식 blueprint 관점·must_fix·수정·delta 절차 추가, legacy 문장에 조건 | run 리뷰 절차 정본 |
| `references/coordinator-cards/final_review.md` | 분류 블록·상태 표·Final review order | Modify | 최종 리뷰 카드(:38-127) | 표식 흐름 서술 추가, legacy 서술 조건화, JSON fence는 1개 유지 | 코디네이터가 매 최종 리뷰에 읽는 카드 |
| `references/review/index.md` | Discovery 관점 선택 | Modify | reviewer 절차(:109-115, :133-135) | security 조건과 브리프 기준 must_fix 서술 | reviewer 하위 skill |
| `references/review/assets/reviewer-prompt.md` | `{{RISK_FLAGS}}`·security 항목 | Modify | reviewer 프롬프트(:23-30, :127-130) | security 사용 조건 문구를 dispatch 결과 기준으로 맞춤 | 같은 조건이 세 문서에 있음 |
| `agents/bouncer-reviewer.md` | Discovery·perspectives | Modify | reviewer 역할 브리프(:64-92, :204-218) | 두 관점·security 조건·`brief_clause` 형식 서술 | reviewer가 읽는 정본 |
| `agents/bouncer-coordinator.md` | 최종 리뷰 supplement 문장 | Modify | coordinator 역할 브리프(:152-158) | legacy 조건과 표식 흐름 참조로 교정 | 단일 라운드 서술과 모순 제거 |
| `.codex/agents/bouncer-reviewer.toml` | 전체 | Modify | reviewer Codex 사본 | `mdToCodexToml` 재생성 | 바이트 동일 테스트 |
| `.codex/agents/bouncer-coordinator.toml` | 전체 | Modify | coordinator Codex 사본 | `mdToCodexToml` 재생성 | 바이트 동일 테스트 |
| `rules/cli.md` | `review-dispatch execute` 주석, `review accept-risk`·`coordinate repair` 절 | Modify | CLI 계약 서술(:361-365, :401, :468-470, :488-494) | 표식 blueprint의 task 없는 delta·두 관점·security 조건, 수정 1회와 `final-review-repair-scope` 서술, legacy 문장 조건화 | CLI 정본 문서가 실제 거절 규칙과 같아야 함 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 이력 | `### Changed` 항목 추가 | 프로젝트 규칙 |

#### Constraints

- `test/agents.test.js:281`의 8섹션 목록 문자열, `test/coordinator.test.js:1882`가 요구하는 문자열, `scripts/check-doc-shape.js`의 H2 순서, coordinator "Worker dispatch" 20줄 제한, final_review.md JSON fence 1개를 유지한다.
- `.codex/agents/*.toml`은 손으로 다시 쓰지 않고 `mdToCodexToml` 출력으로 만든다.
- 사용자 대면 문장이 아닌 역할 브리프·참조 문서는 기존 언어(영어)를 따르고, CHANGELOG 항목은 한국어로 쓴다.

### gates-review/final-review-brief-compliance/005

#### Goal & intent

TASKS-001~004가 모두 통합된 뒤 `npm run ci`를 한 번 실행해 표식·관점 선택·record·coordinator 전이·문서 변경이 함께 빌드·린트·전체 테스트·커버리지를 통과함을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.