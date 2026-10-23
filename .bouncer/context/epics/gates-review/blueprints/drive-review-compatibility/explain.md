---
type: bouncer.explain
title: drive-review-compatibility explain
description: Explain for drive-review-compatibility
resource: .bouncer/context/epics/gates-review/blueprints/drive-review-compatibility/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T09:08:00.292+09:00'
bouncer:
  id: EXPLAIN-drive-review-compatibility
  epic_id: gates-review
  blueprint_id: drive-review-compatibility
  status: published
  comprehension:
    - range_from: 6c20e0babef5c50e17d3617a3919367bc493c898
      range_to: d3e0dbd2c4287b0ca60e32700b984e3ac4eadb5c
      diff_sha: 480fb337e1dcefc4cac8aab5824064d3db4c506a360c0ed273d8ebfbcd594a19
      recorded_at: '2026-10-23T09:15:00+09:00'
  task_commits:
    - task: gates-review/drive-review-compatibility/001
      sha: c937bc23
      intent_anchor: task-001
    - task: gates-review/drive-review-compatibility/002
      sha: d3e0dbd2
      intent_anchor: task-002
---
# Explain

## Background

표식(`review_contract`)이 없는 구형(legacy) 계획이 계획 리뷰 dispatch에서 새 계약의 거절 응답을 받아, 어떤 조건이 틀렸는지 알 수 없는 문제가 있었다. 또 최종 리뷰의 거절 코드 표가 코드와 어긋나도 문서 검사가 잡지 못했다. 이 변경은 구형 계획에는 구형 계약의 거절 cause를 되돌려 주고, 문서의 거절 표가 실제 코드 목록과 맞는지 `lint:docs`가 검사하게 한다.

## Code

- `scripts/src/lib/review-dispatch.ts`: `checkPreviousShape`·`checkPreviousContent`·`checkPreviousBinding`·`classifyPlanReview`가 previous를 검사한다. 표식 없는 계획에서 previous 전략이 `perspectives`이면 구형 cause로 거절한다. 구형 계약에는 perspectives 전략이 없었기 때문이다. 표식 있는 brief 계약의 세 전략은 그대로 허용한다.
- `scripts/src/lib/context-review-store.ts`: `loadDispatch`가 같은 호환 분기를 쓴다. readDoc 실패, 일반 invalid strategy, 다른 blueprint 거절의 우선순위는 바뀌지 않는다.
- `scripts/check-doc-shape.js`: `checkRejectionTables`가 `| Condition | Reason |` 헤더의 표를 찾아 필수 두 reason이 있는지, 지원하지 않는 코드가 없는지 검사한다. 표가 하나도 없으면 실패한다.
- `scripts/src/lib/coordinator-repair.ts`: `FINAL_REVIEW_REJECTION_REASONS`(`review-contract-invalid` 포함)를 내보낸다. 수동 상수라 `finalReviewGate`에 reason을 추가하면 함께 고쳐야 한다. 이 목록은 빌드 산출물에서 지연 적재하므로 `lint:docs` 전에 `npm run build`가 필요하다.
- `rules/cli.md`, `references/coordinator-cards/final_review.md`: 거절 표와 legacy/brief 설명을 맞췄다. `rules/cli.md:404`의 review-dispatch 요약은 아직 옛 서술이 섞여 있다(후속 작업).

## Quiz

1. 표식 없는 계획에서 previous 전략이 `perspectives`이면 무엇이 일어나는가? (a) 허용 (b) 구형 cause로 거절 (c) 표식을 자동으로 붙임
2. 문서 거절 표 검사에서 표가 문서에 하나도 없으면? (a) 통과 (b) 경고만 (c) 실패
3. 거절 표가 있는 문서의 reason 셀에 지원 목록에 없는 코드가 적히면? (a) `lint:docs`가 실패 (b) 무시 (c) 목록에 자동 추가

## Tasks

### gates-review/drive-review-compatibility/001 · `c937bc23`

#### Goal & intent

- R-M3·R-A7·R-A8를 구형 계획 리뷰 거절 응답 복구로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 18이다.
- 전용 검증: `node --test test/review-dispatch.test.js test/context-review-state.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- scripts/src/lib/review-dispatch.ts:351의 checkPreviousShape가 모든 잘못된 전략에 새 cause를 반환한다. 29364e6c^의 cause는 previous strategy must be single or clustered다.
- scripts/src/lib/context-review-store.ts:248에서 표식 없는 perspectives의 cause가 perspectives dispatch requires review_contract brief로 바뀌었다. 이전 cause는 strategy perspectives has no context review다.
- context-review-store.ts:254의 dispatch 목록 비교는 순서 포함 deep equality다. test/context-review-state.test.js:1869는 round 목록만 검증하여 dispatch 변조를 대신하지 못한다.
- I/O: context-review-store.ts:204에서 dispatch JSON을 읽고 :232에서 index를 읽는다. 거절은 cycle 저장 전에 끝난다.

#### Target behavior

- 성공: 표식 full/light의 정상 perspectives 및 기존 single/clustered payload가 현재 허용 규칙대로 처리된다.
- 실패: legacy previous의 잘못된 전략은 구형 객체와 deepStrictEqual이고, legacy perspectives start의 cause·reason·next도 구형 객체와 같다.
- 실패: marked dispatch의 순서·중복·누락·추가 변조를 각각 거절한다. 정상 round discovery의 순서 무관 집합 계약은 보존한다.

#### Interface

- checkPreviousShape에 현재 계약을 전달하여 legacy/brief 오류 문구를 분리한다. 기존 export와 성공 payload의 shape는 바꾸지 않는다.
- legacy previous 거절: {ok:false,reason:"previous-payload-invalid",cause:"previous strategy must be single or clustered",next:"pass the unmodified JSON that review-dispatch plan printed for this blueprint"}.
- legacy perspectives 거절: {ok:false,reason:"context-review-target-invalid",cause:"strategy perspectives has no context review",next:"rerun review-dispatch plan --blueprint <dir> and pass its JSON"}.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/review-dispatch.ts` | `checkPreviousShape` | Modify | previous 입력 검증 | 표식에 따른 legacy 문구 복원 | scripts/src/lib/review-dispatch.ts:351 |
| `scripts/src/lib/context-review-store.ts` | `loadDispatch` | Modify | dispatch·문서 계약 검증 | legacy cause 복원, 정규 목록 거절 유지 | scripts/src/lib/context-review-store.ts:248 |
| `test/review-dispatch.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | legacy previous 반환 객체 전체·brief 성공 회귀 | test/review-dispatch.test.js:439 |
| `test/context-review-state.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | legacy cause 단언 수정 및 dispatch 목록 변조 시나리오 | test/context-review-state.test.js:1835 |

#### Constraints

- 변경 가능한 기존 단언은 test/context-review-state.test.js의 legacy perspectives cause 1건이다. 나머지 오류 우선순위와 exit code를 유지한다.
- readDoc 실패·일반 invalid strategy·다른 blueprint 거절을 새 호환성 분기보다 뒤로 밀지 않는다.
- epic 성공 기준 18 및 23을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### gates-review/drive-review-compatibility/002 · `d3e0dbd2`

#### Goal & intent

- R-M1·R-A1·R-A2를 최종 리뷰 거절 코드 문서 검사 추가로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 19이다.
- 전용 검증: `node --test test/doc-shape-cli.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- rules/cli.md:497이 두 번째 repair에 두 코드를 함께 서술하지만 coordinator-repair.ts:321은 이미 repair/delta를 쓴 경우 final-review-single-round만 반환한다.
- rules/cli.md:404와 references/coordinator-cards/final_review.md:39,85에 legacy 조건과 brief 조건이 혼재한다.
- scripts/check-doc-shape.js:1008의 기본 대상은 경로 계약도 포함한다. rules/cli.md의 거절 코드 대조는 현재 없다. I/O는 runCli:1042의 문서 읽기다.

#### Target behavior

- 문서의 거절 코드 표가 코드 식별자와 일치하고 legacy/brief의 security·accepted 차이를 설명한다.
- 표의 reason을 존재하지 않는 식별자로 바꾸면 lint가 파일·코드와 함께 실패한다. 정상 표와 그 밖의 자연어는 통과한다.

#### Interface

- 추가: rules/cli.md의 coordinate repair 절에 조건·reason 두 열의 명시적 거절 표를 둔다. 필수 reason은 final-review-single-round와 final-review-repair-scope다.
- lint 입력은 해당 표와 coordinator-repair가 export한 지원 reason 목록이다. 코드 로직이나 영어 문장 전체를 소스 문자열 검색으로 추측하지 않는다.
- 문서 lint는 기존 exit 0/1 계약을 유지한다. 코드 목록 읽기는 명시된 모듈만 사용하고 CLI 전체를 적재하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/cli.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | legacy/brief 조건 및 repair 거절 표 정정 | rules/cli.md:404,497 |
| `references/coordinator-cards/final_review.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | accepted·security·repair 조건 구분 | references/coordinator-cards/final_review.md:39,85 |
| `scripts/src/lib/coordinator-repair.ts` | `finalReviewGate` | Modify | repair 사전 거절 판정 | 지원 reason의 읽기 전용 목록 export | scripts/src/lib/coordinator-repair.ts:312 |
| `scripts/check-doc-shape.js` | `runCli` | Modify | 문서 lint 진입점 | 거절 표 식별자 대조 및 기본 대상 등록 | scripts/check-doc-shape.js:1008 |
| `test/doc-shape-cli.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 올바른 표·알 수 없는 코드·필수 행 누락 검증 | test/doc-shape-cli.test.js:162 |
| `CHANGELOG.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 호환성 복구와 문서 코드 검사 Unreleased 항목 | 프로젝트 기여 규칙: Unreleased |

#### Constraints

- 검사 대상은 지정 거절 표이며 모든 문서의 백틱 단어를 코드로 해석하지 않는다.
- 표식 없는 accepted와 security 정책은 기존대로 유지한다. 새 목록 export가 repair 실행이나 원장 쓰기를 일으키면 안 된다.
- epic 성공 기준 19 및 23을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### gates-review/drive-review-compatibility/003

#### Goal & intent

모든 구현 task가 integrated인 integration checkout에서 전체 CI를 실행하여 리뷰 거절 응답 호환성과 설명 계약 복구의 종단 호환성을 확인한다.

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