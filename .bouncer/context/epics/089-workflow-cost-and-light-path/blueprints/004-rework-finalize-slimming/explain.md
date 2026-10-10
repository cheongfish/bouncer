---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/089-workflow-cost-and-light-path/blueprints/004-rework-finalize-slimming/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-10T11:27:14.363+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '089'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: 4ad2e9f4dfabbc75a0e2329451644fba5e560d5d
      range_to: e8486dddd53a5041deb33737b3add129a9fa8122
      diff_sha: c5a911c229a7b3fd581b05cb3cdeb63956dabf1f9ecc6b39ebac8aaae817fa11
      recorded_at: '2026-10-10T11:28:33.723+09:00'
  task_commits:
    - task: EPIC-089/BP-004/TASK-001
      sha: 0d9e8ae2
      intent_anchor: task-001
    - task: EPIC-089/BP-004/TASK-002
      sha: 1383d56e
      intent_anchor: task-002
    - task: EPIC-089/BP-004/TASK-003
      sha: e8486ddd
      intent_anchor: task-003
---
# Explain

## Background

최종 리뷰가 "테스트 근거가 부족하다"는 지적만 해도 새 repair task가 만들어졌다. 그러면 dispatch, 구현, 검증, 리뷰를 처음부터 다시 돌고 repair wave 한도(2회)도 소진했다. finalize도 diff 전체와 이력을 다시 읽어 설명과 퀴즈를 만들었다. 이미 있는 증거를 매번 다시 읽는 비용이 컸다.

이번 변경은 두 가지다. 범위 안의 테스트 보완은 새 task 없이 제자리에서 고치고 독립 delta review 한 번으로 닫는다. finalize는 diff 요약과 증거 참조만으로 설명 근거를 얻는다.

## Intuition

교정쇄에서 오탈자만 지적받았을 때 책 전체를 다시 조판하지 않고 해당 쪽만 고쳐 재확인하는 것과 같다. finalize는 책 전체를 다시 읽는 대신 목차와 쪽별 변경량을 보고 필요한 쪽만 펼친다.

## Code

- `scripts/src/lib/coordinator.ts`, `coordinate-next.ts`, `cli-git-commands.ts` — `coordinate repair --kind supplement`와 `--done`, `supplement` 행동, delta `final_review` 연결
- `references/coordinator-cards/supplement.md`, `final_review.md` — supplement 분류 기준과 delta 라운드 규칙
- `scripts/src/lib/finalize-digest.ts` — digest v2의 `diff`(`collectDiffSummary`)와 `evidence`
- `references/explain-diff/index.md`, `skills/bouncer-finalize/references/draft-pr.md` — 새 digest 필드를 쓰는 퀴즈 대상 선정과 PR 본문

## Quiz

1. 최종 리뷰의 어떤 finding이 `coordinate repair --kind supplement`로 접수되는가?
   - A) 제품 동작 결함을 고치는 finding
   - B) 테스트 경로이고, integrated task의 `affected_paths` 안이며, delta 라운드가 아직 없는 finding
   - C) 새 의존성이 필요한 테스트 보강 finding
2. supplement를 진행하던 중 제품 결함을 발견하면 어떻게 하는가?
   - A) 경로를 넓혀 제품 코드까지 함께 고친다
   - B) 테스트만 바꿔서 결함이 드러나지 않게 한다
   - C) `blocked`로 보고하고 멈춘다
3. supplement가 `verified`된 뒤 최종 리뷰는 어떤 형태로 이어지는가?
   - A) `payload.mode: delta`로 한 번 돌고 discovery는 다시 열지 않는다
   - B) discovery 라운드를 처음부터 다시 돈다
   - C) 리뷰를 생략하고 바로 `integrated` 처리한다
4. `git diff --numstat`이 실패하면 `finalize prepare`는 어떻게 동작하는가?
   - A) prepare가 실패하고 중단된다
   - B) `diff: null`로 두고 `unverified`에 `diff-summary-unavailable`을 기록하며 prepare는 성공한다
   - C) 빈 `per_file`을 채워서 정상 요약처럼 낸다

## Tasks

### EPIC-089/BP-004/TASK-001 · `0d9e8ae2`

#### Goal & intent

`coordinate repair --kind supplement`가 최종 리뷰의 범위 내 테스트 보완 finding을 새 task와 repair wave 없이 접수하고, `coordinate next`가 `supplement` 행동(implementer가 integration worktree에서 테스트만 보완)을 낸 뒤 relevant verify와 delta 라운드 하나로 닫는다. 수용 조건은 조건별 거부와 성공 경로, 카드 문구, 기존 repair 경로 불변 테스트 통과다.

#### Current behavior

- `coordinate repair`(`coordinator.ts:2393`)는 wave가 2개면 `repair-wave-limit`·`awaiting_confirmation`(`:2396`)이다. review 원인 분기(`:2403-2470`)는 finding id·summary·decision·`sourceRepairPaths`(`:592`, 아니면 `repair-scope-out-of-bounds`)를 요구하고 모든 task가 integrated여야 한다(`review-repair-requires-integrated`, `:2417`). 동적 commit task(id max+1, `depends_on` integrated leaf, `scope.paths`=repairPaths)를 추가하고 RepairDecision을 쓰고 `terminalFailure`를 세운다. 그래서 repair task가 task별 파이프라인(dispatch → implement → verify → review) 전체를 다시 돈다.
- finding 분류 코드는 없다. 분류는 prose뿐이다: `skills/bouncer-execute/references/review-round.md:61-76`(must_fix 판정, 설계·의존성·공개 인터페이스는 blocked), `references/coordinator-cards/final_review.md`.
- `final_review` 행동은 모든 task가 integrated이고 blueprint 리뷰 모드이며 root `review.md`가 accepted가 아닐 때 나온다(`coordinate-next.ts:440-455`). repair task가 integrated되면 다시 `final_review`로 돌아온다.
- 리뷰 라운드 시퀀스는 `discovery`, `discovery,delta`, 드라이브에서 `discovery,delta,critical_recovery,delta`다(`validate-sections.ts:44-45,89,98-99`). `recordReview`(`review-record.ts`)는 round 번호 순서와 append-only를 강제한다(`:236-247`).
- 문서 표면: `references/coordinator-cards/final_review.md`, `revise.md:18-22`, `report.md:15-24`, `blocked.md:10-14`, `agents/bouncer-coordinator.md:18,83-107,207,231`, `skills/bouncer-execute/references/verification-recovery.md:27-36`.
- 고정하는 테스트: `test/coordinator.test.js:394`·`:2677-2825`, `test/cli-coordinate.test.js:662-690`, `test/coordinate-next.test.js:249-260`·`:993-995`, `test/agents.test.js:247-249`, `test/cli-help.test.js:264-277`, `test/review-record.test.js:96-400`.
- I/O 결합: repair는 원장과 `tasks/<id>/` 문서를 쓰고 실패 시 `rollbackDocuments`한다(`:713-730`). `coordinate next`는 root `review.md` 상태와 `git rev-parse HEAD`를 읽는다.

#### Target behavior

- 성공(접수): `--kind supplement`는 모든 `--paths`가 테스트 경로이고 integrated task의 `affected_paths` 안이며 root `review.md`에 delta 라운드가 아직 없을 때 `ledger.decisions`에 `{ kind: 'supplement', outcome: 'pending', paths, findings }`를 쓰고 새 task·`terminalFailure`·wave 소비 없이 `{ ok: true, kind: 'supplement', paths }`를 낸다. wave 한도 검사(`:2396`)보다 앞에서 처리하므로 wave가 둘 찬 뒤에도 접수된다.
- 성공(전이): 최신 supplement 결정이 `pending`이면 `coordinate next`는 blueprint 범위 `supplement` 행동(`cwd`=integration 경로, `payload.paths`, 카드 `supplement`)을 낸다. implementer가 보완을 마치면 `coordinate repair --kind supplement --done --summary <text>`가 integration의 변경 경로가 `paths` 안임을 확인하고, 해당 경로를 포함한 integrated task의 `verify` 명령을 중복 없이 기존 검증 러너로 실행한다. 통과하면 결정이 `verified`가 되고 `next`는 `final_review`를 `payload.mode: 'delta'`로 낸다. 실패하면 `done`에 두고 `supplement-verify-failed`를 낸다.
- 거부: 경로가 하나라도 테스트 경로가 아니면 `supplement-paths-not-tests`, 승인 범위 밖이면 `repair-scope-out-of-bounds`, delta 라운드가 있으면 `supplement-delta-used`, task가 integrated되지 않았으면 기존 `review-repair-requires-integrated`, 변경 경로가 `paths` 밖이면 `--done`에서 `supplement-paths-exceeded`, pending이 없는데 `--done`이면 `supplement-not-pending`. 모두 기존 repair 경로로 가라는 `next` 힌트를 단다.
- 보존: `--kind`가 없거나 `product`면 기존 동작 전부(wave 한도 2, 동적 task, `terminalFailure`)가 그대로다. 제품 동작 수정, 새 의존성·공개 인터페이스 결정은 `blocked`다. 리뷰 상한(discovery·fix·delta 각 1회)과 `must_fix` 판정 규칙은 바뀌지 않는다. 테스트 파일 변경만으로 supplement가 되지 않는다: coordinator가 finding 성격을 선언하고 CLI는 경로 조건만 검증한다는 문구가 카드에 있다.

#### Interface

- 제공:
  - `coordinate repair --kind <product|supplement>`, `--done`(supplement 전용)과 도움말. `cli-git-commands.ts`의 blueprint action 목록(`:485`)과 card id 목록(`:488`)에 `supplement`를 더한다.
  - delta 라운드 판정은 `review-record.ts`의 읽기 helper가 아니라 root `review.md`의 `bouncer.review.rounds[].mode`를 `readDoc`로 읽어 `delta` 존재 여부만 본다. `review.md`가 없거나 discovery 라운드뿐이면 delta 없음으로 본다.
  - `NextOk.action: 'supplement'`, `CARD_IDS`에 `supplement`와 `references/coordinator-cards/supplement.md`.
  - 실패 reason: `supplement-paths-not-tests`, `supplement-delta-used`와 `COORDINATE_FAILURE_HINTS` 항목.
- 거부: `--kind` 값이 둘 밖 → 사용법 오류(exit 2). `supplement`에 `--failure-command`(verify 실패 원인 repair) 동시 지정 → `repair-cause-ambiguous`.
- 정의: "테스트 경로" = 첫 조각이 `test` 또는 `tests`이거나 파일명이 `*.test.*`·`*.spec.*`이고, 경로 조각에 `fixtures`가 없는 경로. 예: `test/plan-inspect.test.js`는 해당, `test/fixtures/x.js`는 해당 없음.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | repair 분기(`:2393-2470`), `sourceRepairPaths`, `COORDINATE_FAILURE_HINTS` | Modify | repair 접수 | `supplement` 종류 접수·거부 | repair 소유 |
| `scripts/src/lib/coordinate-next.ts` | `blueprintNext` final_review(`:440-455`), `CARD_IDS` | Modify | 다음 행동 | `supplement` 행동과 카드 | 행동 소유 |
| `scripts/src/lib/cli-git-commands.ts` | repair usage | Modify | repair 도움말 | `--kind` 설명 | 도움말 위치 |
| `references/coordinator-cards/supplement.md` | 신규 | Create | 없음 | supplement 행동 규칙(분류 기준, 한도, 금지) | 카드 |
| `references/coordinator-cards/final_review.md` | repair 분류 | Modify | 최종 리뷰 카드 | 세 분류와 supplement 분기 | 분류 정본 |
| `skills/bouncer-execute/references/review-round.md` | `:61-76` | Modify | 리뷰 라운드 규칙 | 분류 문구 정합 | 정합 |
| `agents/bouncer-coordinator.md` | repair 절 | Modify | coordinator 절차 | supplement 한 단락 | 정본 |
| `.codex/agents/bouncer-coordinator.toml` | 생성 파일 | Modify | md 사본 | 재생성 | 바이트 일치 |
| `rules/cli.md` | repair 줄 | Modify | CLI 계약 | `--kind` | CLI 문서 |
| `test/coordinator.test.js` | repair 케이스 | Modify | repair 단언 | supplement 성공·거부·불변 | 계약 고정 |
| `test/coordinate-next.test.js` | 카드 helper, action 목록 | Modify | next 단언 | supplement 행동·카드 | 계약 고정 |
| `test/agents.test.js` | 카드 문구 | Modify | 카드 핀 | 정합 | 문구 고정 |
| `test/cli-coordinate.test.js` | repair CLI | Modify | CLI 단언 | `--kind` 사용법 | 계약 고정 |
| `test/cli-help.test.js` | repair 도움말 | Modify | 도움말 단언 | `--kind` | 도움말 고정 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Added 항목 | 프로젝트 규칙 |

#### Constraints

- supplement는 위험 정보를 숨기지 않는다. 보완 중 제품 동작 결함이 드러나면 `blocked`로 보고한다.
- `skills/*/SKILL.md`는 수정하지 않는다(단어 수 baseline).
- 바뀐 `agents/*.md`는 TOML과 바이트 일치해야 한다.
- 카드와 execute reference 양쪽에 걸리는 규칙(리뷰 상한, debugger 1회)은 그대로 둔다.

### EPIC-089/BP-004/TASK-002 · `1383d56e`

#### Goal & intent

`bouncer finalize prepare` digest에 `diff` 요약과 `evidence` 참조를 더하고 `version`을 2로 올린다. explain-diff는 퀴즈 근거를 digest의 `diff.per_file`·`symbols`에서 고르고, 질문이 겨냥한 파일만 `range.base..range.head` diff로 읽는다. 이해 확인·잔여 처리·PR 동의는 그대로 사용자 소유다. 수용 조건은 digest 필드 테스트, 문서 문자열 테스트, 기존 finalize 테스트 통과다.

#### Current behavior

- `finalize prepare`(`cli-git-commands.ts:67`, usage `:814`)는 `prepareFinalizeDigest`(`finalize-digest.ts:419`)를 부르며 읽기 전용이다. digest는 `blueprint, range{base,head,diff_sha}, git, tasks[], changed_paths, symbols(파일당 10, 전체 60), commits(50), unverified[], out_of_scope, blueprint_review, pr`다(`:54-77`).
- 없는 것: diff 통계 텍스트(경로 목록과 심볼 이름뿐), 리뷰 round/mode/target 참조, 검증 로그 텍스트, repair·delta 이력. 검증은 `evidence_id`, 리뷰는 findings만 있다.
- 크기 요인: `tasks[]`(affected_paths, constraints, findings), 무제한 `changed_paths`, `pr` 섹션의 task 사실 중복.
- `skills/bouncer-finalize/SKILL.md` step 1은 prepare를 한 번 실행해 PR까지 payload를 유지하라 하고, `explain-quiz.md:9-13`은 원장·task 문서·검증 로그를 다시 읽지 말라 한다. 그러나 `references/explain-diff/index.md:46-52` step 3은 "range.base..range.head diff로 퀴즈를 낸다"여서 모델이 전체 diff를 읽는 것이 주된 크기 요인이다. light는 1문항(`:53-55`). `draft-pr.md`는 `pr.sections.*`를 쓰고 task `verification.md` 재열람을 금지한다(`:40`).
- 동의 문구는 prose로만 존재한다: finalize `remainder`·`pr` ACQ와 퀴즈 무응답 시 중단. 코드의 자동 통과 경로는 없다.
- 재현: `node --test test/finalize-digest.test.js test/skill-bouncer-finalize.test.js test/finalize-pr.test.js test/comprehension.test.js`. 고정: `test/skill-bouncer-finalize.test.js:168`("Do not re-read the coordinator ledger, task documents, or verification logs."), `:190`, `:198`, `:153`.
- I/O 결합: `defaultExec`(`finalize-digest.ts:111`)가 `git diff --name-only base..head`, `git diff -U0 base..head`, `git log`을 부르고 task별 `tasks.md`/`verification.md`/`review.md`를 읽는다. 파일 쓰기는 없다.

#### Target behavior

- 성공: digest `version: 2`에 `diff: { files, insertions, deletions, per_file: [{ path, added, deleted }] }`(`git diff --numstat base..head`, `per_file`은 변경 줄 수 내림차순 최대 30개)와 `evidence: { verification: [{ task, evidence_id }], review: { path, rounds, target_digest } | null }`가 추가된다. `rounds`는 root `review.md`의 `bouncer.review.rounds[]` 길이, `target_digest`는 마지막 라운드의 `target_digest`다. `rounds`는 root `review.md`의 `bouncer.review.rounds[]` 길이, `target_digest`는 마지막 라운드의 `target_digest`다. 기존 필드는 삭제하지 않는다.
- 문서: explain-diff step 3은 digest `diff.per_file`·`symbols`에서 질문 대상을 고르고, 그 파일만 `git diff base..head -- <path>`로 읽는다고 쓴다. explain-quiz는 `evidence` 참조로 근거를 인용한다. draft-pr는 `pr.sections.*`와 `evidence`를 쓰고 검증·리뷰 로그를 열지 않는다.
- 실패/없음: numstat 실행이 실패하면 `diff`를 `null`로 두고 `unverified`에 `diff-summary-unavailable`을 더하되 prepare를 실패시키지 않는다. 리뷰 기록이 없으면 `evidence.review: null`, 검증 증거가 없으면 `evidence.verification: []`.
- 보존: 퀴즈 질문 수 규칙(1–10, light 1문항), 사용자 응답 없으면 중단, finalize `remainder`·`pr` ACQ, "bare `/bouncer-finalize` is not consent" 문구, G16 comprehension 형식은 바뀌지 않는다.

#### Interface

- 제공: digest 필드 `diff`, `evidence`와 `version: 2`, `FinalizeDigest` 타입 갱신, `collectDiffSummary(exec, base, head) → Diff | null`(신규 추출 지점).
- 거부: 없음(읽기 전용 digest). `finalize.ts`와 `finalize-pr.ts`는 `version`을 참조하지 않으므로(확인함) 소비자 변경은 없고, `version: 1`을 고정한 테스트 픽스처만 갱신한다.
- throw 대 miss: numstat 실패와 리뷰 기록 부재는 miss(`null`)이고 throw하지 않는다.
- 정의: `per_file.added`/`deleted`는 numstat 열 값이며 바이너리 파일은 `0`/`0`이다. 예: `{ path: 'a.ts', added: 12, deleted: 3 }`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-digest.ts` | `prepareFinalizeDigest`, digest 타입(`:54-77`) | Modify | digest 조립 | `diff`·`evidence`·버전 | digest 소유 |
| `references/explain-diff/index.md` | step 3(`:46-52`) | Modify | 퀴즈 근거 지침 | digest 요약 기반으로 변경 | 정본 |
| `skills/bouncer-finalize/references/explain-quiz.md` | `:9-13` | Modify | 재열람 금지 | 증거 참조 사용 문구 | 정합 |
| `skills/bouncer-finalize/references/draft-pr.md` | `:40` | Modify | PR 초안 지침 | 증거 참조 사용 문구 | 정합 |
| `test/finalize-digest.test.js` | digest 케이스 | Modify | digest 단언 | `diff`·`evidence`·버전·실패 miss | 계약 고정 |
| `test/skill-bouncer-finalize.test.js` | `:168`, `:190`, `:198` | Modify | 문구 핀 | 새 문구 정합 | 문구 고정 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | Changed 항목 | 프로젝트 규칙 |

#### Constraints

- digest는 읽기 전용이다. 파일을 쓰지 않는다.
- 이해 확인, 잔여 처리, PR 동의를 자동 통과시키는 문구를 넣지 않는다. 퀴즈 무응답은 중단이다.
- 기존 digest 필드를 지우지 않는다(소비자 호환).
- 퀴즈 근거로 읽는 diff는 digest `range`의 base..head 안으로 한정한다.

### EPIC-089/BP-004/TASK-003 · `e8486ddd`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/finalize-digest.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/finalize-digest.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.