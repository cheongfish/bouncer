---
type: bouncer.explain
title: review-contract-deduplication explain
description: Explain for review-contract-deduplication
resource: .bouncer/context/epics/gates-review/blueprints/review-contract-deduplication/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T09:41:49.546+09:00'
bouncer:
  id: EXPLAIN-review-contract-deduplication
  epic_id: gates-review
  blueprint_id: review-contract-deduplication
  status: published
  comprehension:
    - range_from: 1063f623a0e5c7401fb2d421d31a7cfb37b193ff
      range_to: 4fe219636afe71bba4a5588095d6d0a14f15d482
      diff_sha: 8f364c85aea824f9ea31b94b5bfdbc534ad71f102ca4a3709ee50e84e2a17d88
      recorded_at: '2026-10-23T09:55:00+09:00'
  task_commits:
    - task: gates-review/review-contract-deduplication/001
      sha: 2d1be985
      intent_anchor: task-001
    - task: gates-review/review-contract-deduplication/002
      sha: f6bffbba
      intent_anchor: task-002
    - task: gates-review/review-contract-deduplication/003
      sha: 4fe21963
      intent_anchor: task-003
---
# Explain

## Background

리뷰 계약을 판정하는 코드가 여러 곳에 흩어져 있어, 같은 상태를 두고 모듈마다 다른 답을 내거나 같은 상수를 복제해 쓰고 있었다. repair 접수 경계와 다음 작업 선택은 `review.md`의 라운드 존재 여부를 각자 읽었고, `review-contract-invalid` 거절 문구는 분류기·coordinator·CLI에 따로 있었으며, context-review는 plan 관점 이름 목록을 복제하고 관점 개수로 light 여부를 추측했다. 이 변경은 판정 지점을 하나씩으로 모아 같은 입력이 같은 결과를 내게 하고, 오류 정책 차이처럼 의도된 차이는 그대로 둔다.

## Code

- `scripts/src/lib/review-repair-state.ts`(신규): `hasReviewRepairDecision`은 원장 decisions에서 리뷰 원인 repair 존재를 판정하는 순수 predicate다. `reviewRoundExists`는 `review.md`의 `rounds[]`에서 discovery/delta 라운드를 찾는다. 오류 정책은 호출자가 고른다. strict는 파일 없음(ENOENT)만 없음으로 보고 YAML 파손 등은 던진다(repair 접수용). 파손을 없음으로 접으면 끝난 리뷰에 repair가 다시 열리기 때문이다. tolerant는 파일 없음·frontmatter 없음·깨진 YAML을 없음으로 본다(다음 작업 선택용). 이 차이는 의도라 통일하지 않았다. `coordinator-repair.ts`와 `coordinate-next.ts`가 이를 쓴다.
- `scripts/src/lib/schema.ts`: `REVIEW_CONTRACT_INVALID_REASON/CAUSE/MESSAGE`가 거절 상수의 정본이다. CLI는 분류기를 적재하기 전에 거절하므로 `review-dispatch`가 아니라 schema에서 가져온다. `planDeltaPerspectiveOf(scale)`은 delta 라운드의 관점 이름을 고른다(full `combined`, light `verifiability`).
- `scripts/src/lib/review-dispatch.ts`: `readPlanIndex`가 blueprint index를 한 번만 읽는다. 읽기 실패는 `readError`로 보존하고 structural 검사를 먼저 실행한 뒤 `blueprint index unreadable`로 거절한다. 계약별 계산(plan/execute)은 나눠서 한다. 테스트는 `deps.readIndex`로 파일 I/O만 대체한다.
- `scripts/src/lib/context-review-store.ts`·`context-review-state.ts`: `loadDispatch`가 검증한 scale을 내부 필드로만 넘기고, 저장 dispatch JSON과 CLI 출력은 그대로다. 관점 이름 복제 목록과 개수 추측은 사라지고 `PLAN_FULL_PERSPECTIVES`를 쓴다.
- 한계: tolerant 경로는 `readBouncerBlock`에 맡기므로 ENOENT·frontmatter 없음·YAMLException 외의 I/O 오류는 그대로 던진다. `reviewRoundExists`는 discovery/delta 공용이라 `mode` 인자를 추가로 받는다.

## Quiz

1. repair 접수 경계가 `review.md`의 YAML이 깨진 것을 발견하면 어떻게 하는가?
   - A) 라운드가 없다고 보고 repair를 새로 연다.
   - B) 오류를 던져 접수를 멈춘다.
   - C) discovery 라운드가 이미 있다고 본다.
2. light blueprint(`review_contract: brief`)의 delta 리뷰 라운드가 가져야 하는 관점 이름은?
   - A) `verifiability`
   - B) `combined`
   - C) `consistency`
3. plan 리뷰 분류 중 blueprint index를 읽지 못하면 어떻게 되는가?
   - A) 읽기 오류 즉시 거절하고 structural 검사는 건너뛴다.
   - B) legacy 계약으로 보고 그대로 통과시킨다.
   - C) structural 검사를 먼저 실행한 뒤 `blueprint index unreadable`로 거절한다.
4. blueprint의 `review_contract`가 `brief`가 아닌 값이면 거절 메시지는?
   - A) `review-contract-invalid: review_contract must be brief`
   - B) `review-contract-unknown: expected brief`
   - C) `review_contract invalid`

## Tasks

### gates-review/review-contract-deduplication/001 · `2d1be985`

#### Goal & intent

- R-A3·R-A4·R-A6를 리뷰 수정 상태 판독과 거절 상수 통합로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 20이다.
- 전용 검증: `node --test test/review-policy.test.js test/coordinator.test.js test/coordinate-next.test.js test/review-dispatch.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- coordinator-repair.ts:291의 predicate와 coordinate-next.ts:794의 inline 판정이 같다.
- delta reader는 coordinator-repair.ts:242와 coordinate-next.ts:495에 중복되지만 전자는 ENOENT만 흡수하고 후자는 판독 불가를 없음으로 본다.
- CLI는 cli-review-dispatch-command.ts:276,287에서 분류기를 읽기 전에 오류를 반환한다. review-contract-invalid를 분류기에서 import하면 lazy 거절 계약이 깨진다.

#### Target behavior

- 동일 원장에서 repair 사용 여부를 같은 순수 predicate로 판정한다.
- round 판독은 공유 구현을 사용하되 strict/tolerant 정책 인자를 통해 현재의 오류 의미를 보존한다.
- 분류기·coordinator·CLI가 schema의 동일 오류 상수를 사용하고 기존 오류 반환은 그대로다.

#### Interface

- 추가 추출 지점은 신규 review-repair-state.ts다. ledger predicate는 입력 decisions 배열만 읽고 상태를 바꾸지 않는다. review-policy.ts의 순수 상수 경계는 유지한다.
- round reader 입력은 {file:string,error_policy:"strict"|"tolerant"}. strict는 ENOENT만 false, 그 밖은 throw; tolerant는 현재 next가 흡수하던 읽기·파싱 실패를 false로 반환한다.
- 오류 상수는 schema.ts가 export한다. CLI usage 거절 경로는 review-dispatch 모듈을 require하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-repair-state.ts` | `신규 추출 지점: repair 사용 및 round 존재 판독` | Create | 신규 리뷰 상태 판독 모듈 | predicate·정책 인자 있는 reader 추출 | review-policy.ts의 무의존 상수 경계를 보존하기 위한 최소 분리 |
| `scripts/src/lib/coordinator-repair.ts` | `finalReviewGate` | Modify | repair 접수 경계 | strict 공유 reader·상수 사용 | scripts/src/lib/coordinator-repair.ts:312 |
| `scripts/src/lib/coordinate-next.ts` | `rootReviewHasDeltaRound` | Modify | 다음 리뷰 작업 선택 | tolerant 공유 reader·predicate 사용 | scripts/src/lib/coordinate-next.ts:495,794 |
| `scripts/src/lib/schema.ts` | `신규 추출 지점: 거절 오류 상수` | Modify | 스키마 공통 정본 | review-contract-invalid export | scripts/src/lib/schema.ts:99 |
| `scripts/src/lib/review-dispatch.ts` | `classifyExecuteReview` | Modify | 리뷰 분류 | schema 오류 상수 사용 | scripts/src/lib/review-dispatch.ts:563,792 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `blueprintDeltaRefusal` | Modify | CLI 조기 거절 | schema 오류 상수 사용 | scripts/src/lib/cli-review-dispatch-command.ts:287 |
| `test/review-policy.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | predicate와 strict/tolerant 오류 정책 검증 | test/review-policy.test.js |
| `test/coordinator.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | repair 횟수·newPaths 거절과 상태 무변경 회귀 | test/coordinator.test.js:5153 |
| `test/coordinate-next.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | delta·blocked 선택 및 손상 문서 정책 회귀 | test/coordinate-next.test.js:591 |
| `test/review-dispatch.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | CLI exit·stderr 바이트·미적재 계약 보존 | test/review-dispatch.test.js:1240 |
| `scripts/src/lib/review-record.ts` | `review-contract-invalid 거절 지점` | Modify | 리뷰 기록 경계 | schema의 공통 reason 참조 | scripts/src/lib/review-record.ts:55 |
| `scripts/src/lib/validate-gates-finalize.ts` | `checkG21` | Modify | 마감 리뷰 판정 | schema의 공통 오류 문구 참조 | scripts/src/lib/validate-gates-finalize.ts:126 |

#### Constraints

- strict/tolerant 차이는 의도된 유지로 닫는다. A4를 이유로 오류 정책을 통일하지 않는다.
- 새 함수를 구현 완료 기준으로 삼지 않는다. 공개 반환과 I/O 오류 의미가 기준이다. 새 의존성은 추가하지 않는다.
- hint 사전의 reason key는 외부 분류 식별자로 유지하고, 실제 반환 reason과 사용자 오류 문구만 schema의 공통 상수를 참조한다. review-policy.ts에는 fs·schema import를 추가하지 않는다.
- epic 성공 기준 20 및 23을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### gates-review/review-contract-deduplication/002 · `f6bffbba`

#### Goal & intent

- R-A5·R-A10를 리뷰 분류의 단일 읽기와 계약별 계산 분리로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 21이다.
- 전용 검증: `node --test test/review-dispatch.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- review-dispatch.ts:563과 :584가 같은 index를 계약·scale 용도로 두 번 읽는다. 계약 해석 실패는 structural 검사보다 앞선다.
- execute는 :876에서 legacy 관점을 계산한 뒤 :929,933에서 brief 결과로 덮어쓴다. snapshot :868과 risk 합집합 :805는 공통이다.

#### Target behavior

- plan index를 한 번 읽은 값에서 계약과 scale을 얻는다. 깨진 파일과 invalid marker의 기존 오류 우선순위를 유지한다.
- execute는 공통 snapshot과 risk를 만든 뒤 선택된 계약의 관점·reasons만 계산한다. delta와 task scope는 현재 동작을 보존한다.

#### Interface

- classifyPlanReview/classifyExecuteReview의 기존 입력·출력 shape를 유지한다.
- 중복 읽기 검증 seam: 내부 reader에 deps.readIndex(file:string) → {data:unknown}를 주입하고, 기본 구현은 readDoc이다. 기존 호출자는 deps 생략 가능하다.
- 오류를 legacy로 접는 지점은 현재 계약과 동일해야 한다. index 재사용 때문에 structural 오류를 가려서는 안 된다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | `readPlanReviewContract; classifyPlanReview; classifyExecuteReview` | Modify | plan·execute 전략 분류 | index 읽기 공유 및 계약별 선택 계산 | scripts/src/lib/review-dispatch.ts:563,584,876 |
| `test/review-dispatch.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 단일 읽기 seam·실패 우선순위·분류 결과 전체 회귀 | test/review-dispatch.test.js:1152,1526 |

#### Constraints

- Interface의 deps.readIndex는 파일 I/O만 대체한다. 분류 함수 자체를 mock하지 않는다.
- R-M3에서 복원한 legacy previous cause와 light execute invalid marker의 legacy 처리(test/review-dispatch.test.js:1213)를 바꾸지 않는다.
- epic 성공 기준 21 및 23을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### gates-review/review-contract-deduplication/003 · `4fe21963`

#### Goal & intent

- R-A9·R-A11를 계획 리뷰 관점과 delta 기준의 정본 통합로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 22이다.
- 전용 검증: `node --test test/context-review-state.test.js test/schema.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- schema.ts:99,100의 목록과 context-review-state.ts:272의 PERSPECTIVES_ONLY_NAMES가 중복된다.
- context-review-state.ts:305는 expected.length===1로 light를 추론한다. loadDispatch:254는 이미 실제 scale로 목록을 검증한다.
- recordReport:384,411에서 loadDispatch 결과 JSON을 다시 읽어 round 관점을 판정한다.

#### Target behavior

- plan 관점 집합은 schema 상수만 사용하고, delta는 검증된 scale을 기준으로 full combined/light verifiability를 선택한다.
- 공개 dispatch JSON과 저장 payload를 늘리지 않고 loadDispatch의 내부 검증 결과에 scale을 전달한다.
- legacy single/clustered와 기존 cycle의 관점 검증 및 오류 문구는 유지한다.

#### Interface

- 내부 loadDispatch 성공 결과에 검증된 scale을 추가하고 recordReport가 이를 전달한다. 외부 CLI payload에는 추가하지 않는다.
- schema의 delta 선택 helper는 scale:"full"|"light"만 받는다. 잘못된 scale은 기존 loadDispatch 거절에서 처리한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/schema.ts` | `PLAN_FULL_PERSPECTIVES; PLAN_LIGHT_PERSPECTIVES` | Modify | 관점 목록 정본 | delta 관점 선택 정본 제공 | scripts/src/lib/schema.ts:99 |
| `scripts/src/lib/context-review-store.ts` | `loadDispatch` | Modify | dispatch 검증 | 검증된 scale의 내부 전달 | scripts/src/lib/context-review-store.ts:254 |
| `scripts/src/lib/context-review-state.ts` | `checkRoundPerspectives; recordReport` | Modify | round 관점 검증 | 복제 목록·길이 추론 제거 | scripts/src/lib/context-review-state.ts:272,305,411 |
| `test/context-review-state.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | full/light delta 및 기존 cycle 읽기 회귀 | test/context-review-state.test.js:1882,1936 |
| `test/schema.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 관점 정본과 scale별 delta 결과 검증 | test/schema.test.js |
| `CHANGELOG.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 리뷰 계약 정본 통합 Unreleased 기록 | 프로젝트 기여 규칙: Unreleased |

#### Constraints

- dispatch perspectives는 순서 포함 배열, discovery round는 기존 집합 비교다. 두 계약을 합치지 않는다.
- 관점이 하나라는 이유만으로 light로 판단하지 않는다. 검증된 scale 이외의 입력을 정본으로 삼지 않는다.
- epic 성공 기준 22 및 23을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### gates-review/review-contract-deduplication/004

#### Goal & intent

모든 구현 task가 integrated인 integration checkout에서 전체 CI를 실행하여 리뷰 계약 판정의 중복 제거의 종단 호환성을 확인한다.

#### Current behavior

선행 구현 task는 각각 전용 검증을 수행한다. 이 task가 정상 경로에서 첫 전체 CI를 담당한다.

#### Target behavior

- 성공: 실제 실행 증적을 verification runner가 기록한 뒤에만 integrated가 된다.
- 실패: verifying 상태와 원본 증적을 유지하며 coordinator가 원인을 분류한다.

#### Interface

- 제공: 선행 구현이 모두 통합된 뒤 전체 검증을 한 번 실행하여 남기는 증적.
- 거부: source 변경, review 문서 작성, task commit, 실패 증적의 수작업 수정.

#### Touch

Source 변경 경로 없음.

#### Constraints

- 검증 명령은 frontmatter verify 한 곳에서 소유한다. 전체 CI를 구현 task에 복사하지 않는다.
- 환경 오류와 scope 안팎의 코드 오류를 구별한다. 이 task에서 직접 repair하지 않는다.