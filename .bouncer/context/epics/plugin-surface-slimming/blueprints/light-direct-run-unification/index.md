---
type: bouncer.blueprint
title: light 실행과 직접 실행 경로 통합
description: Run scale-light blueprints through the same root-driven advance loop and subagent workers as the serial direct run, and drop inline implementation.
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/light-direct-run-unification/index.md
tags:
  - bouncer
  - blueprint
  - light-run
  - direct-run
  - coordinator-ledger
  - drive-metrics
timestamp: '2026-10-30T08:29:43.284+09:00'
bouncer:
  id: light-direct-run-unification
  epic_id: plugin-surface-slimming
  blueprint_id: light-direct-run-unification
  status: closed
  order: 3
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  supersedes: []
---
# light 실행과 직접 실행 경로 통합

Epic: [플러그인 표면 간소화](../../index.md)

## Intent
- light blueprint도 직렬 full 직접 실행과 같은 경로로 돌게 하여 root가 `coordinate advance` 루프를 돌고 구현은 항상 subagent가 맡도록 바꿈.
- 옛 inline light 원장과 구버전 plugin 조합은 명시적인 거절 코드로 막고, light drive의 토큰·승격 사유·repair wave를 집계 스크립트와 digest에서 잴 수 있게 함.

## Contract
- 실행 경로(작업 사이 계약):
  - 원장 `mode: 'light'`는 그대로 쓴다. 의미는 정책뿐이다. 정책은 commit 범위의 `out-of-scope` 차단, baseline 생략, single/combined 리뷰, promote-stop 자격이다.
  - 실행 기계는 full과 같다. worker worktree, full fan-in, `session-open`·`note`를 쓴다.
  - 새로 seed한 light 원장에는 `light_runner: 'subagent'` 표식이 붙는다. 표식이 없고 integrated가 아닌 task가 남은 `mode: 'light'` 원장은 옛 inline 원장(진행 중)이다. 모든 task가 integrated인 표식 없는 원장은 끝난 drive로 보고 지금처럼 읽는다(finalize 가능).

```text
Ledger += light_runner?: 'subagent'            # mode가 light일 때만. 001이 타입과 판별, 002가 seed
DriveRecord += mode?: 'light' | 'full'          # 005. 키 부재는 옛 snapshot
            += promotion?: { reason: string; task: string } | null
```

- 인터페이스:
  - 001 `run preflight`
    - `direct_eligible`이 scale `light`도 받는다. 조건은 delegable, serial shape, `1 <= commit_tasks <= coordinator.direct_max_commit_tasks`이다(기본 3, `0`이면 꺼짐). 새 설정 키는 없다.
    - 옛 inline 원장(진행 중)이 있으면 `reason: 'light-ledger-legacy'`, `delegable: false`를 낸다.
  - 002 `coordinate bootstrap`
    - light 자격은 직렬 사슬이다. 각 commit task는 바로 앞 commit task 하나에만 의존한다. `scoped_terminal`이면 모든 commit task에 의존하는 verification task가 정확히 하나 더 있다.
    - 자격이 없으면 `light-requires-serial`로 거절한다. `light-requires-single-task`는 없어진다.
    - 재개할 원장이 옛 light 원장이면 `light-ledger-legacy`로 거절한다.
  - 002 옛 inline 원장 거절: `coordinate next`·`advance`·`prepare`와 fence를 쓰는 모든 `coordinate` 변경이 `light-ledger-legacy`로 거절한다. 안내(`next`)는 integration worktree의 diff·untracked 파일을 먼저 보존하고, 사용자 승인 뒤 worktree를 폐기하고, 다시 계획(`/bouncer-plan`)한 뒤 실행하라는 것이다.
  - 002 light 원장의 `implement` payload에 `inline`이 없다.
    - light 원장의 task 범위 `dispatch`·`report`·`record`·`uncommit`을 integration cwd에서 부르면 lease 검사보다 먼저 `light-inline-removed`로 거절한다.
    - light `report --outcome accepted`는 그 task에 role `implementer`인 `worker-model` 결정이 현재 attempt 수 이상 있어야 한다. 모자라면 `light-implementer-record-missing`이다. 이 검사는 호환 장치일 뿐 구현 주체를 증명하지 않는다.
    - `light-review-required`는 없어진다.
  - 003 `coordinate promote-stop`의 `diff_sha`와 `bootstrap --promote-light`의 patch는 열린 task의 worker worktree에서 계산한다.
    - 계산 대상은 dispatch `base_head` 대비 커밋과 작업 트리 변경이다.
    - 승격은 그 worker를 `.bouncer/runtime/salvage/`에 보존하고, full 원장을 쓴 뒤 마지막 단계로 지운다. 보존 경로 `salvage`는 응답에만 싣고 `promoted_from`·`PromotionRecord` 키는 그대로다. 제거 실패는 `promote-light-worker-remains`이고, 그 전 단계 실패는 worker를 남긴 채 되돌려 재시도할 수 있다.
    - 기록된 workerPath가 등록된 worker가 아니면 `unassigned-worker-worktree`로 거절한다. prepare 전(workerPath 없음)이면 integration 기준으로 계산한다.
    - light 원장의 `coordinate revise`는 원장을 쓰기 전에 판정한다. 옛 원장이면 `light-ledger-legacy`, 표식 있는 원장이면 `light-scope-revision-requires-promotion`이고, 후자는 promote-stop을 안내한다.
  - 004 light 원장의 리뷰는 blueprint 루트 리뷰 1회다(single/combined).
    - commit task가 1개면 이 리뷰가 task 리뷰이고, 2개 이상이면 유일한 최종 리뷰다.
    - discovery 뒤 accepted가 아니면 리뷰 원인 repair 한 번을 허용한다. repair 뒤에는 delta 없이 `final-review-blocked`로 멈춘다. 남은 finding의 처리는 사용자 결정(deferred 기록 또는 accept-risk)이다.
    - 앞서 정한 "delta 1회"(q6/q9)는 이 BP에서 열지 않고 후속 BP로 미룬다(q11). delta를 열려면 delta 라운드의 dispatch·기록 경로를 바꿔야 하는데, 그 경로는 이 BP의 후보 경로 밖이다.
    - light 리뷰 repair의 `--new-path`는 `light-scope-revision-requires-promotion`으로 거절한다.
  - 005 `drive_record`에 `mode`와 `promotion`이 실린다. `promotion`은 원장 `promotion`(정지 중) 또는 `promoted_from`(승격된 full)에서 읽는다.
    - snapshot과 finalize digest가 같은 `summarizeDriveRecord`를 쓴다.
    - `node scripts/measure-drive-records.js` 출력에 `by_mode`와 `promotions`가 생긴다. `by_mode`는 mode별 drive 수, worker·session 토큰, CI·review repair wave다. `promotions`는 사유별 수다.
  - 006 `/bouncer-run` 문서: light와 full이 같은 시작 ACQ와 같은 D(직접)·A(coordinator) 경로를 쓴다. `light-run.md`는 light 정책 차이만 담는다. 차이는 승격 신호를 promote-stop으로 바꾸는 표, 승격 절차, 구 CLI 감지다.
- 데이터·상태:
  - 원장 `version`은 1이다. 새 표식은 선택 키이고, full 원장과 이미 끝난 원장은 그대로 읽는다.
  - snapshot `version`도 1이다. `mode`·`promotion` 키가 없는 `drive_record`는 계속 유효하다.
- 수용 기준(epic 기준 2의 "light 실행 통합" 조각):
  1. `scale: light`이고 commit task가 1개인 기존 light blueprint 모양은 직접 경로 끝까지 간다. 순서는 bootstrap(표식 포함) → worker prepare → 구현 worker 보고 → `advance` commit·integrate → 종단 verification → 루트 리뷰 1회 → `done`이며, 002·004 테스트가 fixture로 증명한다. 그 과정에 `inline` payload는 없다.
  2. 실행·재개 호환은 `coordinate next`/`advance`가 판정한다.
     - 표식 없는 light 원장에는 `light-ledger-legacy`가 나온다(preflight 001, 그 밖의 명령 002).
     - 구 plugin 흐름처럼 integration cwd에서 task를 변경하면 `light-inline-removed`, implementer 기록 없이 accepted를 내면 `light-implementer-record-missing`이다.
     - full 원장의 기존 직접 실행·coordinator 경로 테스트는 기대값을 바꾸지 않고 통과한다.
  3. light 루트 리뷰는 discovery 1회 뒤 리뷰 원인 repair를 1회만 받는다. 두 번째 repair와 supplement는 `final-review-single-round`, 새 경로는 `light-scope-revision-requires-promotion`이다. repair 뒤에는 delta 없이 `final-review-blocked`다(004).
  4. promote-stop의 다섯 사유는 그대로 기록된다. worker worktree의 변경이 `--promote-light` patch로 옮겨지고 full 원장 `promoted_from.reason`에 남는다(003).
  5. 측정(005):
     - light와 full drive를 섞은 snapshot에서 `by_mode.light`와 `by_mode.full`이 각각 drive 수, `worker_tokens`, `session_tokens`(root-direct-session 포함), `ci_repair_waves`, `review_repair_waves`를 낸다.
     - `promotions`가 사유별 수를 낸다.
     - 같은 원장이면 finalize digest의 `drive_record.mode`·`promotion`이 snapshot 값과 같다.
- 검증 명령: 001 `node scripts/verify-light-preflight.js`, 002 `node scripts/verify-light-worker-path.js`, 003 `node scripts/verify-light-promotion.js`, 004 `node scripts/verify-light-final-review.js`, 005 `node scripts/verify-light-drive-metrics.js`, 006 `node scripts/verify-light-run-docs.js`. 종단 007은 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - 구 plugin과 새 CLI:
    - 구 `light-run.md`는 integration cwd에서 inline으로 구현하고 `report`를 부르므로 `light-inline-removed`에 걸린다.
    - 구 흐름이 worker cwd에서 구현해도 implementer `worker-model` 기록이 없으므로 accepted가 `light-implementer-record-missing`에 걸린다.
    - 옛 inline 원장은 표식이 없어 `light-ledger-legacy`에 걸린다. 세 코드 모두 원장을 쓰기 전에 거절한다.
  - 새 plugin과 구 CLI: 구 CLI는 `payload.inline: true`를 준다. 새 `light-run.md`는 이 값을 보면 구현하지 말고 CLI 버전 불일치로 멈추라고 적는다.
  - 상한을 넘거나 상한이 `0`인 light drive: `direct_eligible`이 false라 시작 ACQ가 coordinator 경로(A)만 권한다.
    - coordinator가 light 원장을 맡아도 범위 개정 시도는 `light-scope-revision-requires-promotion` 안내로 promote-stop에 닿는다.
    - 직접 경로에서 handoff할 때도 원장은 light 그대로다.
  - light 원장의 commit 범위 판정(`scope.ts` light → `out-of-scope`)과 baseline 생략은 바뀌지 않는다.
  - 승격 대상 worker 보존이 실패하면 `worker-salvage-failed`로 멈춘다. 원장, worker, patch 어느 것도 바꾸지 않는다.

## Out of scope
- plan 쪽 선언, `plan inspect` routing, light 문서 축소 규칙, `validate-gates-plan.ts`의 light 단일 task 제약 완화. 후속 BP2의 몫이다. 그래서 이 BP에서 commit task가 2개 이상인 light는 test fixture로만 만든다.
- 2개 이상인 light의 task별 리뷰 기록(`review-record.ts`의 blueprint 모드 `--task` 허용). 후속 BP의 몫이다.
- light 루트 리뷰의 delta 라운드(q6/q9의 "delta 1회"). q11에 따라 후속 BP로 미룬다. `review-record.ts`·`cli-review-dispatch-command.ts`와 그 테스트는 이 BP의 어느 task 범위에도 넣지 않는다.
- 복잡도 문턱 개정과 promote-stop 사유 재정의(`task-split` 포함 다섯 사유 유지)
- light 범위 정책("금지선만 block") 시험. 후속 BP3의 몫이다. `scope.ts`·`commit-guard.ts`는 바꾸지 않는다.
- `rules/planning.md`·`rules/subagent-model.md`의 light 문구, `agents/bouncer-coordinator.md`. light-run.md를 가리키는 포인터는 계속 유효하므로 문구 정리는 BP2로 넘긴다.
- 표식 없는 inline light 원장의 재개·변환 지원, 새 abandon 명령. 폐기는 사용자 승인 뒤 git worktree 제거로 한다.
- `review-dispatch.ts`의 light single/combined 판정 변경. 현재 동작을 그대로 쓴다.
- finalize digest의 `drive_issues` 모양과 `collectWorkerNotes`의 light 생략. 고정 테스트가 후보 경로 밖에 있다.
- #295~#300에서 끝난 retro 이관, revise 합집합, 결합 경로 탐지, full 예상 경로 정책, 실행 기록 보존의 재작업
- 매니페스트 `runtimeCompatibility`·버전 필드·CHANGELOG 수정, 제안서 문서 커밋, `packages/cli/dist`·`scripts/lib` 생성물 편집

## One-commit justification
- 여섯 commit task는 제안서 7장의 첫 결론 하나를 구현한다. 결론은 "경량 경로를 subagent 구현의 직접 실행 하나로 합치고, 옛 경로는 명시적으로 거절하고, 효과를 잰다"이다. 한 PR에서 같은 근거로 리뷰한다.
- 001 → 002 → 003 → 004는 직렬이다.
  - 001·002는 원장 판별을 공유한다.
  - 004가 쓰는 reason `light-scope-revision-requires-promotion`의 hint를 003이 등록한다. 모든 reason 리터럴에 hint를 요구하는 `test/coordinator.test.js:245` 때문에 004는 003 뒤에 둔다.
- 005는 원장 필드만 읽어 처음부터 병렬로 돈다. 006은 CLI 동작이 정해진 뒤 문서를 맞춘다.
