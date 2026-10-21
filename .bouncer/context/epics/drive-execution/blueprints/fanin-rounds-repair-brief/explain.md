---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/drive-execution/blueprints/fanin-rounds-repair-brief/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-16T11:22:26.911+09:00'
bouncer:
  id: EXPLAIN-fanin-rounds-repair-brief
  epic_id: drive-execution
  blueprint_id: fanin-rounds-repair-brief
  status: published
  comprehension:
    - range_from: 86735fb54c0195de1b8d73e4f865e83240971a40
      range_to: 8a8c7c8fa923cc7124ac3c32b07f71632b1e72a2
      diff_sha: b5c8d52d9093df1a87e8cc68d96eaaa2bd0e4a5046cf1454c98604eaa83265ee
      recorded_at: '2026-10-16T11:30:00+09:00'
  task_commits:
    - task: drive-execution/fanin-rounds-repair-brief/001
      sha: a92fa83c
      intent_anchor: task-001
    - task: drive-execution/fanin-rounds-repair-brief/002
      sha: a1f2b864
      intent_anchor: task-002
    - task: drive-execution/fanin-rounds-repair-brief/003
      sha: 8a8c7c8f
      intent_anchor: task-003
---
# Explain

## Background

drive에서 task를 rework하면 worker 브랜치에 attempt별 커밋이 쌓인다. 그런데 통합(fan-in)이 마지막 커밋 하나만 가져와 이전 attempt의 수정이 조용히 사라졌다. 리뷰 쪽에도 어긋남이 있었다. repair wave는 두 번까지 허용하는데 최종 리뷰의 라운드 순서 규칙은 delta 한 번까지만 받아, 두 번째 wave 뒤의 리뷰 기록이 거부됐다. 또 리뷰가 원인인 repair task 문서에는 finding 상세가 빠져 implementer가 일부 지적을 놓쳤다. 이 blueprint는 세 가지를 모두 고친다.

## Intuition

택배 상자 하나에 수정 내용을 처음부터 끝까지 다 담아 보내고, 검수 횟수 규정은 재작업 횟수와 맞추고, 재작업 지시서에는 지적 사항 원문을 그대로 붙이는 것과 같다.

## Code

- `scripts/src/lib/coordinator.ts` `integrateCommitWave`: task마다 `baseHead..item.sha` 범위를 구해 모두 적용한 뒤 통합 커밋 하나로 합친다. 다중 커밋 squash는 `reset --soft` 후 마지막 worker 커밋의 메시지·author를 가져오고, 기존 log/amend 단계가 `Bouncer-Worker-Commit` trailer를 붙인다. 범위 계산 실패는 revoke 없는 `cherry-pick-failed`, 내용 충돌은 `fanin-conflict`로 그 task만 revoke한다.
- `scripts/src/lib/validate-sections.ts`: `REPAIR_WAVE_LIMIT`(2)와 `BLUEPRINT_ROUND_CONTRACT`를 export한다. blueprint 계약은 기존 execute 순서에 `discovery,delta,delta`만 더한다. `collectFindingFailures`의 `roundScope: 'blueprint'`가 계약을 고르고, `review-record.ts`(진행 중 접두 판정 포함)와 `validate-gates.ts`(G21)가 blueprint 범위에서 이를 쓴다. task별 리뷰(G14)는 기존 계약 그대로라 `discovery,delta,delta`를 계속 거부한다. `runtime-state.ts`도 같은 상수로 wave 수를 판정한다.
- `coordinator.ts` `writeRepairDocuments`·`readReviewFindingLines`: 리뷰 원인 repair 문서의 제목과 Goal을 "리뷰 repair"로 쓰고, root `review.md`에서 id별 finding을 읽어 한 줄씩 적는다. 괄호에는 값이 있는 필드만 쓰고 개행은 접는다. `review.md`에 없는 id는 "review.md에서 찾지 못함"으로 표시하며 repair는 그대로 진행한다. CI 원인 repair 문서는 바뀌지 않는다. 한계: finding 줄 포맷은 정규식 단언으로만 검증되고 file·symbol 단독 케이스는 테스트하지 않았다.
- `references/coordinator-cards/final_review.md`: repair task 문서는 CLI가 쓰므로 coordinator가 고쳐 쓰지 않는다는 한 줄을 더했다.

## Quiz

1. worker 브랜치에 통합 기준점 위로 커밋이 2개 쌓인 task를 fan-in하면 어떻게 되는가?
   - A) 마지막 커밋만 적용되고 앞 커밋의 변경은 버려진다.
   - B) 두 커밋의 변경이 모두 적용되고 통합 커밋은 1개이며 trailer는 마지막 worker SHA를 가리킨다.
   - C) 두 커밋이 각각 별도 통합 커밋으로 들어간다.
2. blueprint 최종 리뷰의 라운드 순서에서 이번 변경 뒤 거부되는 것은?
   - A) `discovery,delta,delta`
   - B) `discovery,delta,critical_recovery,delta`
   - C) `discovery,delta,delta,delta`
3. 리뷰 원인 repair 문서를 만들 때 `--review-finding`으로 준 id가 root `review.md`에 없으면?
   - A) 그 id 줄을 "review.md에서 찾지 못함"으로 표시하고 repair는 계속 진행한다.
   - B) `failure-evidence-required`로 repair를 거부한다.
   - C) 그 id를 조용히 빼고 나머지 finding만 문서에 쓴다.
4. task별 리뷰(G14)에서 `discovery,delta,delta`는 이번 변경 뒤 어떻게 판정되는가?
   - A) blueprint 리뷰와 같이 통과한다.
   - B) 기존처럼 `review rounds sequence invalid`로 거부된다.
   - C) 진행 중 접두로만 허용되고 accepted 기록 때만 거부된다.

## Tasks

### drive-execution/fanin-rounds-repair-brief/001 · `a92fa83c`

#### Goal & intent

commit wave fan-in이 task의 worker 커밋을 몇 개든 모두 통합 HEAD에 반영하고, task마다 통합 커밋 1개와 `Bouncer-Worker-Commit: <원장 sha>` trailer를 남긴다(epic Success criteria 1–3). 완료 판정은 아래 Checklist의 회귀 테스트와 `npm run ci`다.

#### Current behavior

- `coordinate record`는 worker HEAD를 그대로 `item.sha`로 저장한다(`scripts/src/lib/coordinator.ts:3902-3906`). 직계 자식 검사는 `rerecord`에만 있다(`coordinator.ts:3930`, `directParent` `:812-820`).
- worker는 prepare 때 통합 HEAD에서 `git worktree add -b <branch> <worker> HEAD`로 갈라진다(`coordinator.ts:2050-2052`). `advance`가 attempt마다 `bouncer commit`을 실행하므로 rework 뒤 worker 브랜치에는 attempt별 커밋이 쌓인다. 102/001 task 003: `b576645f`(attempt 1, 부모 `68107533`) → `557075e7`(attempt 2).
- phase 1이 통합 checkout HEAD를 `baseHead`로 고정해 `ledger.fanin.base_head`에 저장한다(`coordinator.ts:2814-2852`). phase 2는 `worktree add --detach <faninPath> <baseHead>`로 candidate를 만든다(`:2868`).
- wave task마다 `git cherry-pick <item.sha>`를 한 번만 실행한다(`coordinator.ts:2891-2900`). 그래서 범위의 앞 커밋은 버려진다. 실측 결과 통합 커밋 `8ca735f0`에는 `557075e7`의 변경만 들어갔다.
- pick 뒤 `git log -1 --format=%B`로 메시지를 읽고, `git commit --amend --no-verify -m appendWorkerCommitTrailer(picked, pickSha)`로 trailer를 붙인다(`coordinator.ts:2939-2942`, `appendWorkerCommitTrailer` `:743-751`). amend가 실패하면 abort 없이 `cherry-pick-failed`로 끝난다(`:2943-2956`).
- 충돌 분류는 `isCherryPickConflict`(`coordinator.ts:2454-2465`, `ls-files -u` → 오류 문자열)가 abort 전에 한다. 충돌이면 `revokeLease(reason 'fanin-conflict')`, 아니면 `cherry-pick-failed`다(`:2901-2933`).
- light 원장은 `integrateLightCommitWave`(`coordinator.ts:2467-2560`)로 가며 cherry-pick을 하지 않는다.
- `task-commits.ts` `resolveTaskCommits`(`scripts/src/lib/task-commits.ts:82-118`)는 `Bouncer-Task` trailer마다 최신 통합 커밋 하나만 쓴다. 따라서 task당 통합 커밋 1개라는 모델을 유지해야 finalize digest(`finalize-digest.ts:812-835`)가 바뀌지 않는다.
- I/O 결합: git 호출은 모두 주입 seam `deps.execFileSync`(`Exec = (file, args?, options?) => string | Buffer`, `coordinator.ts:177-179`, 폴백 `:3186`)를 거치고 helper `git(exec, cwd, args)`(`:729-731`)가 출력을 trim한다.
- 재현: 기존 테스트 중 한 worker에 커밋 2개를 만들고 통합하는 경우는 없다. e2e fixture `commitInWorker`(`test/coordinator-e2e.test.js:151`)와 `acceptDispatchAndRecord`(`:205`)로 만들 수 있다.

#### Target behavior

- 성공: wave task마다 candidate에서 `git rev-list --reverse <baseHead>..<item.sha>`로 범위 커밋을 구한다(`baseHead`는 phase 1이 고정한 값). 범위 커밋을 순서대로 적용한 뒤 그 task의 통합 커밋이 정확히 1개가 되게 합친다. 메시지는 범위 마지막 커밋(`item.sha`)의 `%B`에 `appendWorkerCommitTrailer(…, item.sha)`를 적용한 것이다.
- 성공(보존): 범위가 커밋 1개이면 git 호출 순서와 결과(cherry-pick → `log -1 --format=%B` → `commit --amend`)가 지금과 같다.
- 실패: 범위 어느 커밋에서든 내용 충돌이 나면 abort 전에 분류해 기존과 같이 그 task만 `fanin-conflict`로 revoke한다. 충돌이 아닌 실패, 합치기·amend 실패는 `cherry-pick-failed`다.
- 실패: 범위가 비면(`item.sha`가 이미 `baseHead`의 조상이면) 기존 `nothing-to-integrate`로 멈추고 candidate를 지운다.
- 보존: 같은 wave의 다음 task는 앞 task 통합 뒤의 candidate HEAD 위에 적용된다. verified resume(`coordinator.ts:2725-2765`), light fan-in, `reportPathsWarning`(최신 attempt 보고와 `item.sha` 비교)는 바뀌지 않는다.

#### Interface

- 제공: commit wave fan-in이 task마다 `<baseHead>..<item.sha>` 범위를 적용하고 통합 커밋 1개를 만든다. 반환 reason 집합(`fanin-conflict`, `cherry-pick-failed`, `nothing-to-integrate`)과 원장 필드는 그대로다.
- 거부: 내용 충돌 범위는 `fanin-conflict`(그 task만 revoke)로, 그 밖의 git 실패는 `cherry-pick-failed`(revoke 없음)로, 빈 범위는 `nothing-to-integrate`로 거부한다.
- 용어 — 범위 커밋: `git rev-list --reverse <baseHead>..<item.sha>`의 출력 순서 그대로의 SHA 목록이다. 예: baseHead `68107533`, item.sha `557075e7` → `[b576645f, 557075e7]`.
- test seam: 기존 `deps.execFileSync(file: string, args: string[], options?) → string | Buffer`를 그대로 쓴다. 새 seam은 만들지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `integrateCommitWave` | Modify | phase 2에서 task마다 `item.sha` 하나를 cherry-pick하고 trailer를 amend한다 | 범위 커밋을 구해 모두 적용하고 task당 통합 커밋 1개로 합친다. 충돌 분류와 revoke 경로를 범위 전체에 적용한다 | 누락의 직접 원인(`:2891-2956`) |
| `test/coordinator-e2e.test.js` | 신규 추출 지점: 다중 worker 커밋 fan-in 회귀 테스트 | Modify | 실제 git으로 fan-in trailer를 검증한다(`:308`) | worker 커밋 2개 task의 통합 내용·커밋 수·trailer를 검증하고, 범위 중간 충돌 시 `fanin-conflict`를 검증한다 | 실제 git 범위 계산이 필요하다 |
| `test/coordinator.test.js` | `integrableDrive`·fan-in stub 테스트 | Modify | stub exec로 cherry-pick 충돌·amend 실패를 검증한다(`:1399`, `:1438`, `:1472`, `:2689`) | 새 `rev-list` 호출을 stub이 처리하도록 맞추고 단일 커밋 경로의 호출 순서 보존을 검증한다 | 호출 순서를 단언하는 stub 테스트가 영향을 받는다 |

#### Constraints

- `coordinate record`·`rerecord`·`bouncer commit`의 동작은 바꾸지 않는다(epic Out of scope).
- 통합 커밋의 `Bouncer-Task`·`Bouncer-Intent` trailer는 마지막 worker 커밋 메시지에서 오고, `Bouncer-Worker-Commit`은 task마다 정확히 한 줄이다.
- 범위에 merge 커밋이 있으면 cherry-pick이 실패하므로 그대로 `cherry-pick-failed`로 둔다. 새 reason은 만들지 않는다.
- 테스트는 `../scripts/lib/...` 빌드를 import하므로 테스트 실행 전 `npm run build`를 한다.

### drive-execution/fanin-rounds-repair-brief/002 · `a1f2b864`

#### Goal & intent

blueprint 최종 리뷰가 repair wave마다 delta 라운드 하나를 기록할 수 있게 한다. task별 리뷰의 라운드 상한은 그대로 둔다(epic Success criteria 4). 완료 판정은 Checklist의 회귀 테스트와 `npm run ci`다.

#### Current behavior

- `EXECUTE_ROUND_CONTRACT.sequences`는 `['discovery', 'discovery,delta', 'discovery,delta,critical_recovery,delta']`다(`scripts/src/lib/validate-sections.ts:100-108`). `CONTEXT_ROUND_CONTRACT`는 `:110-118`에 있다.
- 순서 검사는 `collectRoundFailures`의 한 줄뿐이다(`validate-sections.ts:546`, 메시지 `${findingLabel} rounds sequence invalid`). 계약은 `collectFindingFailures`가 `namespace`로만 고른다(`:441-442`). 이 경로에는 파일 I/O나 가변 모듈 상태가 없다.
- `collectFindingFailures`를 execute 계약으로 부르는 곳은 세 군데다.
  - G21 blueprint 리뷰: `scripts/src/lib/validate-gates.ts:322`
  - G14 task 리뷰: `validate-gates.ts:1140`
  - `review record`: `scripts/src/lib/review-record.ts:347`
- `review-record.ts`는 `blueprintScope = isBlueprintReviewScopeAt(...)`로 범위를 안다(`:281`). 진행 중 순서는 `isAllowedSequencePrefix`(`:86-100`)가 `EXECUTE_ROUND_CONTRACT.sequences`의 접두로 허용한다. 그 밖은 `review-ledger-invalid`다(`:356-366`).
- repair wave 상한 2는 이름 없는 리터럴로 흩어져 있다.
  - `coordinator.ts:3533`의 `>= 2`. TASKS-003이 상수로 바꾼다.
  - `scripts/src/lib/runtime-state.ts:325`의 `> 2`, `:327`의 `!== 2`.
  - 이름 있는 상수는 없다. `validate-sections.ts`는 `./guards`·`./paths`만 import하는 leaf 모듈이라 `runtime-state.ts`가 import해도 순환이 생기지 않는다.
- 문서: `skills/bouncer-run/references/review-round.md:140-141`이 "완전한 순서는 세 가지뿐"이라고 적는다. `docs/workflow.md:121-126`은 리뷰 round 상한을 설명한다.
- 재현: 102/001 drive의 세 번째 라운드 기록이 `review-ledger-invalid`(`review rounds sequence invalid`)로 거부됐다. 기존 테스트는 다음과 같다.
  - `test/validate-gates.test.js:1236`(G14 수렴 계약, helper `convergenceRound` `:1202`)
  - `test/review-record.test.js:252`(접두 허용), `:271`(진행 중 + accepted 거부), fixture `makeFixture` `:72`

#### Target behavior

- 성공: blueprint 범위 root `review.md`의 rounds `discovery,delta,delta`가 `review record`(`--status accepted` 포함)와 G21을 통과한다. 진행 중 접두 `discovery,delta`도 계속 허용된다.
- 실패: blueprint 범위의 `discovery,delta,delta,delta`는 `review rounds sequence invalid`이고, `review record`에서는 `review-ledger-invalid`로 거부된다. `discovery,delta,delta,critical_recovery,delta`처럼 critical_recovery를 섞은 새 조합도 거부된다.
- 보존: blueprint 범위에서도 기존 drive 복구 순서 `discovery,delta,critical_recovery,delta`는 계속 통과한다.
- 보존: task 범위(G14, task `review record`)는 `EXECUTE_ROUND_CONTRACT`를 그대로 써서 `discovery,delta,delta`가 계속 거부되고 `discovery,delta,critical_recovery,delta`는 계속 통과한다. context 계약은 바뀌지 않는다. `runtime-state`의 partial close 판정 결과도 바뀌지 않는다.

#### Interface

- 제공: `validate-sections`가 아래 두 가지를 export한다.
  - `REPAIR_WAVE_LIMIT = 2`
  - `BLUEPRINT_ROUND_CONTRACT`: modes는 `EXECUTE_ROUND_CONTRACT`와 같다(`discovery`·`delta`·`critical_recovery`). sequences는 `EXECUTE_ROUND_CONTRACT.sequences`에 `discovery` 뒤 delta를 `REPAIR_WAVE_LIMIT`개 붙인 순서(`discovery,delta,delta`)를 더한 목록이다. 나머지 필드는 `EXECUTE_ROUND_CONTRACT`와 같다.
- 제공: `collectFindingFailures`에 선택 인자 `roundScope?: 'blueprint'`가 생긴다. 이 값이 있으면 execute namespace에서 `BLUEPRINT_ROUND_CONTRACT`를 쓰고, 없으면 지금과 같다.
- 제공: `isAllowedSequencePrefix`는 범위에 맞는 계약의 sequences로 접두를 판정한다.
- 거부: `roundScope`와 `namespace: 'context'`를 함께 주면 context 계약을 쓴다. `roundScope`는 execute namespace에만 적용된다. 그 밖의 값은 타입이 막는다.
- 용어 — blueprint 범위: `isBlueprintReviewScopeAt`가 참인 blueprint의 root `review.md`이다. 예: `review_scope: blueprint`인 blueprint의 `<bp>/review.md`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-sections.ts` | `EXECUTE_ROUND_CONTRACT`, `collectFindingFailures` | Modify | execute·context round 계약과 순서 검사 | `REPAIR_WAVE_LIMIT`·`BLUEPRINT_ROUND_CONTRACT`를 export하고 `roundScope`로 계약을 고른다 | 순서 거부의 단일 지점(`:546`) |
| `scripts/src/lib/validate-gates.ts` | G21 blueprint 리뷰 검사 | Modify | blueprint root review를 execute 계약으로 검사한다(`:322`) | `roundScope: 'blueprint'`를 넘긴다 | G21이 같은 기록을 거부하지 않게 한다 |
| `scripts/src/lib/review-record.ts` | `isAllowedSequencePrefix`, 기록 검증 | Modify | execute 계약으로 기록과 진행 중 접두를 판정한다(`:86-100`, `:347-366`) | `blueprintScope`일 때 blueprint 계약으로 판정한다 | 102/001에서 거부가 난 지점이다 |
| `scripts/src/lib/runtime-state.ts` | partial close wave 검사 | Modify | 리터럴 2로 wave 수를 판정한다(`:325`, `:327`) | `REPAIR_WAVE_LIMIT`를 쓴다 | 상한을 상수 하나로 모은다 |
| `test/validate-gates.test.js` | G21·G14 순서 테스트 | Modify | G14 수렴 계약을 검증한다(`:1236`) | G21 `discovery,delta,delta` 통과·4라운드 거부, G14 `discovery,delta,delta` 거부를 추가한다 | 범위별 계약 회귀 |
| `test/review-record.test.js` | blueprint 범위 기록 테스트 | Modify | 접두 허용과 accepted 거부를 검증하고 `validate-sections` 빌드를 이미 import한다(`:252`, `:271`) | blueprint 범위 3라운드 accepted 통과, 4라운드 거부, 계약 최대 delta 수 = `REPAIR_WAVE_LIMIT` 단언을 추가한다 | 실제 거부 경로의 회귀와 상한 불일치 재발 방지 |
| `skills/bouncer-run/references/review-round.md` | 완전한 순서 목록 | Modify | 허용 순서 세 가지를 적는다(`:140-141`) | blueprint 최종 리뷰의 `discovery → delta → delta`를 추가한다 | 문서와 계약을 맞춘다 |
| `docs/workflow.md` | 리뷰 round 상한 설명 | Modify | round 상한을 설명한다(`:121-126`) | blueprint 최종 리뷰는 repair wave마다 delta 한 번이라고 적는다 | 문서와 계약을 맞춘다 |

#### Constraints

- `EXECUTE_ROUND_CONTRACT`·`CONTEXT_ROUND_CONTRACT`의 값은 바꾸지 않는다.
- repair wave 상한 값은 2 그대로다. `REPAIR_WAVE_LIMIT`는 값을 모을 뿐이다.
- 기존 오류 메시지 문자열(`review rounds sequence invalid`)과 reason(`review-ledger-invalid`)은 그대로다.
- 테스트는 빌드를 import하므로 실행 전 `npm run build`를 한다.

### drive-execution/fanin-rounds-repair-brief/003 · `8a8c7c8f`

#### Goal & intent

`coordinate repair --review-finding`이 만든 repair `tasks.md`가 finding마다 root `review.md`의 필드를 담고, 제목·Goal이 리뷰 repair를 가리키게 한다. CI 원인 repair 문서는 그대로 둔다(epic Success criteria 5–6). 완료 판정은 Checklist의 회귀 테스트와 `npm run ci`다.

#### Current behavior

- `coordinate repair`의 리뷰 원인 분기는 `scripts/src/lib/coordinator.ts:3534-3615`에 있다.
  - finding id는 모양만 검사한다(빈 배열·빈 문자열·빈 summary → `failure-evidence-required`, `:3542-3546`).
  - root `review.md`는 읽지 않으므로 없는 id도 그대로 `failure.findings`에 들어간다(`:3578`).
  - wave 상한은 리터럴이다(`:3533` `waves.length >= 2`).
- 두 호출 지점은 같은 인자 모양으로 `writeRepairDocuments`를 부른다. 원인도 finding도 넘기지 않는다.
  - 리뷰 원인: `coordinator.ts:3603-3605`
  - CI 원인: `:3659-3661`
- `writeRepairDocuments`(`coordinator.ts:1173-1277`)는 CI 문구를 고정으로 쓴다.
  - title `CI repair wave ${repair.id}`, description `Repairs terminal CI failure.`(`:1197`)
  - Touch 줄 끝 "기록된 CI 실패를 복구한다."(`:1228`)
  - Goal "기록된 terminal CI 실패를 복구한다."(`:1233`)
  - Interface "실패 command…"(`:1237`), Checklist "기록된 terminal CI command를 통과시킨다."(`:1255`)
- finding 스키마(`scripts/src/lib/templates.ts:291-310`, `validate-sections.ts:341-440`)는 다음과 같다.
  - 항상 있는 필드: `id`·`severity`·`status`
  - mode 라운드에서 필수인 필드: `category`·`brief_clause`·`file`·`symbol`·`fingerprint`·`actionability`·`origin`
  - 선택 필드: `note`
  - `line`·`description` 필드는 없다.
- root `review.md` frontmatter는 `readBouncerBlock(file)`(`coordinator.ts:1536-1545`)로 읽는다. ENOENT·YAML 오류는 `null`이다.
- implementer intent bundle은 Goal & intent·Current/Target behavior·Interface·Touch·Constraints만 쓴다(`scripts/src/lib/intent-bundle.ts:168-175`). `parseSections`는 고정 제목만 알아서 새 `##` 제목은 앞 절에 흡수된다. Touch·Interface·Do not touch의 backtick 경로는 경로 선언으로 읽힌다(`templates.ts:139`).
- `taskBriefHashOf`(`coordinator.ts:762`)는 본문과 제목을 해시에 넣는다. repair 문서는 dispatch 전에 써지므로 dispatch·record 해시는 일관된다.
- 문서 I/O: `writeRepairDocuments`의 쓰기는 `:1258-1266`, 롤백은 `:1269-1276`에 있다.
- 기존 테스트(`test/coordinator.test.js`):
  - `:3124`, `:3159`: 리뷰 원인 repair. root `review.md` fixture가 없고 문서 내용은 단언하지 않는다.
  - `:3183`: CI 원인. `bouncer.verify`만 본다.
  - `:481`: 세 번째 repair → `repair-wave-limit`.
  - "CI repair wave" 문구를 단언하는 테스트는 없다.
- 카드 테스트: `test/coordinate-next.test.js:205-225`는 카드 본문이 파일과 정확히 같은지, `:1373-1395`는 정규식을 본다. `test/review-record.test.js:355-375`는 `final_review.md`의 json fence 2개를 본다.

#### Target behavior

- 성공: 리뷰 원인 repair 문서는 아래와 같이 써진다.
  - 제목 `Review repair wave ${repair.id}`, description `Repairs final review findings.`
  - Goal & intent 첫 문장은 "최종 리뷰 finding을 수정한다."이다.
  - 그 뒤에 `--review-finding` 순서대로 finding마다 한 줄 목록이 붙는다. 형식: `- F1 (major, correctness, must_fix) — scripts/lib/x.js#f — tasks/001 Interface — note: …`. 필드는 `id`·`severity`·`category`·`actionability`·`file`·`symbol`·`brief_clause`·`note` 순서다. `actionability`·`note`는 값이 있을 때만 쓴다.
  - Touch·Interface·Checklist 문구는 "기록된 리뷰 finding"을 가리킨다.
- 성공: root `review.md`가 없거나, 읽기·파싱 중 어떤 오류가 나거나, 해당 id가 없으면 그 id 줄을 `- F9 — review.md에서 찾지 못함`으로 쓰고 repair는 지금처럼 진행한다.
- 보존: CI 원인 repair 문서(title·description·본문)는 바이트 단위로 지금과 같다. wave 상한 판정 결과(`repair-wave-limit`)와 supplement 경로도 같다.
- 보존: 문서 쓰기 실패 시 롤백 동작이 같다.

#### Interface

- 제공: `writeRepairDocuments`가 선택 인자 `reviewFindings?: ReviewFindingLine[]`를 받는다. 값이 있으면 리뷰 원인 본문을, 없으면 지금의 CI 본문을 쓴다.
- 제공: `ReviewFindingLine` 모양은 `{ id: string; found: boolean; severity?, category?, actionability?, file?, symbol?, brief_clause?, note?: string }`이다. 예: `{ id: 'F1', found: true, severity: 'major', category: 'correctness', actionability: 'must_fix', file: 'scripts/lib/x.js', symbol: 'f', brief_clause: 'tasks/001 Interface' }`.
- 제공: 리뷰 원인 분기는 `readBouncerBlock(<integrationPath>/<blueprint>/review.md)?.review?.findings`에서 id로 찾아 `ReviewFindingLine[]`를 만든다. 이 읽기를 try/catch로 감싸 `readBouncerBlock`이 다시 던지는 ENOENT 밖의 읽기 오류(권한 오류 등)도 모든 id를 `found: false`로 접는다.
- 제공: wave 상한 판정은 TASKS-002가 export한 `REPAIR_WAVE_LIMIT`를 쓴다.
- 제공: `references/coordinator-cards/final_review.md`의 must_fix repair 항목에 한 줄을 추가한다. 내용은 "repair task 문서는 CLI가 finding 필드로 쓰니 coordinator가 brief를 고쳐 쓰지 않는다"이다.
- 거부: 알 수 없는 id나 읽을 수 없는 `review.md`로 repair를 거부하지 않는다(새 reason 없음). finding 필드 값의 개행은 공백 하나로 접어 한 줄을 유지한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `writeRepairDocuments`, `coordinate repair` 리뷰 분기 | Modify | CI 고정 문구로 repair 문서를 쓰고 리터럴 2로 wave 상한을 판정한다(`:1173-1277`, `:3533-3605`) | finding을 읽어 리뷰 원인 본문을 쓰고 `REPAIR_WAVE_LIMIT`를 쓴다 | brief 누락의 직접 원인 |
| `test/coordinator.test.js` | 리뷰 원인 repair 테스트 | Modify | 리뷰 원인 repair의 원장 기록만 검증한다(`:3124`, `:3159`, `:3183`) | root `review.md` fixture를 넣고 문서 제목·finding 줄·찾지 못함 표시·CI 문서 보존을 단언한다 | 회귀 테스트 |
| `references/coordinator-cards/final_review.md` | must_fix repair 항목 | Modify | repair 절차를 안내한다(`:65-78`) | brief를 고쳐 쓰지 않는다는 한 줄을 추가한다 | role 절차 보강(retro 후보 3) |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 릴리스 노트 | `### Fixed`에 blueprint 전체(fan-in 범위, blueprint 리뷰 라운드 순서, 리뷰 repair brief) 항목을 쓴다 | 프로젝트 규칙: 동작 변경은 CHANGELOG 항목 |

#### Constraints

- 리뷰 finding 목록은 Goal & intent 절 안에 쓴다. 새 `##` 제목을 만들지 않고, Touch·Interface·Do not touch에 finding의 `file` 값을 backtick 경로로 넣지 않는다(G11/G12 경로 선언 오인 방지).
- `review.md` Markdown 본문은 파싱하지 않는다(epic Out of scope).
- CI 원인 문서 바이트는 바꾸지 않는다.
- 카드 추가 줄은 json fence가 아닌 bullet이다(`test/review-record.test.js:355-375`의 fence 2개 계약 유지).
- 테스트는 빌드를 import하므로 실행 전 `npm run build`를 한다.

### drive-execution/fanin-rounds-repair-brief/004

#### Goal & intent

TASKS-001~003이 모두 통합된 integration HEAD에서 `npm run ci`가 exit 0으로 끝남을 증명한다(epic Success criteria 7).

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.
