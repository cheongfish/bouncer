---
type: bouncer.explain
title: complexity-declaration explain
description: Explain for complexity-declaration
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/complexity-declaration/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-31T13:32:03.668+09:00'
bouncer:
  id: EXPLAIN-complexity-declaration
  epic_id: plugin-surface-slimming
  blueprint_id: complexity-declaration
  status: published
  comprehension:
    - range_from: 4bd9b695f2c993dfd391d1190b4232c5470310c5
      range_to: 11ccb020b0da1eb1175f457ffac2190e7a7dc41e
      diff_sha: d091268046c506d35d5ac36b16a9d86fee8d9ca15f8b3753f9142fb1c442a4dc
      recorded_at: '2026-10-31T13:33:21.541+09:00'
  task_commits:
    - task: plugin-surface-slimming/complexity-declaration/001
      sha: c40c39a2
      intent_anchor: task-001
    - task: plugin-surface-slimming/complexity-declaration/002
      sha: 306f3684
      intent_anchor: task-002
    - task: plugin-surface-slimming/complexity-declaration/003
      sha: 2902f0a3
      intent_anchor: task-003
    - task: plugin-surface-slimming/complexity-declaration/004
      sha: aa502278
      intent_anchor: task-004
    - task: plugin-surface-slimming/complexity-declaration/006
      sha: 11ccb020
      intent_anchor: task-006
---
# Explain

## Background

`scale: light`는 문서 축약, plan quiz 축소, context review skip, light 원장·승격(`promote-stop`, `--promote-light`)까지 한 축으로 묶었다. 그 결과 “짧은 계획”과 “약한 리뷰”가 같은 스위치에 걸려, full과 light가 제품·문서·실행 경로를 둘로 갈랐다.

이번 변경은 그 축을 끊는다. 새 계획은 `bouncer.complexity`(`low`|`standard`, 기본 `standard`)로 리뷰 강도만 고른다. `scale`은 선언 가능한 값이 `full`뿐이고, 닫히지 않은 `scale: light`와 `mode: light` 원장은 `light-mode-removed` 등으로 거절한다. 이미 닫힌 light 문서는 수정 없이 읽힌다.

자동으로 complexity를 추론하거나 routing 문턱을 바꾸는 일은 이 blueprint 밖이다. `plan inspect`의 `low-candidate`/`standard-candidate`는 이름만 바뀌고 판정 조건은 그대로다.

## Code

선언·해석의 정본은 `packages/cli/src/schema.ts`다. `complexityOf`, `COMPLEXITY_ENUM`, `SCALE_DECLARABLE_ENUM`, `planPerspectivesOf`, `planDeltaPerspectiveOf`가 여기 있다. `reviewContractOf`는 scale로 brief를 접지 않는다. low 최종 리뷰도 `review_contract: brief`를 그대로 읽어 repair·delta 상한을 탄다.

scaffold(`packages/cli/src/scaffold.ts`, `cli-doc-commands.ts`)는 `--scale light`와 허용 밖 `--complexity`를 첫 파일 전에 거절한다. `*-light.md` 템플릿 분기는 없고, blueprint front matter에 `complexity`를 `scale` 바로 뒤에 쓴다. 구조 검사 S20은 닫히지 않은 `scale: light`와 허용 밖 complexity를 막고, S38은 complexity 키가 있으면 `review_contract: brief`를 요구한다(`validate-structural.ts`).

plan 쪽: G20의 light 1-commit 강제와 `planScaleOf`가 빠진다(`validate-gates-plan.ts`). `plan approve`는 모든 blueprint에 context-review `accepted`를 요구한다. routing 추천 문자열만 `low-candidate`/`standard-candidate`로 바뀐다(`plan-inspect.ts`). plan 구조 해시는 `complexity === 'low'`일 때만 blueprint에 `complexity`, task에 정렬된 `review_risk`를 싣는다(`plan-snapshot-contract.ts`) — standard·기존 계획 digest는 그대로다.

리뷰: 표식 blueprint의 discovery는 low면 `verifiability`, commit task에 `review_risk`가 있으면 `risk_security`를 붙인다. low delta는 risk가 있어도 `verifiability` 하나다. skip 전략은 없다. execute 리뷰에서 low는 diff 크기와 무관하게 single/`combined`이고, 리뷰어 등급은 task 수 문턱을 보지 않는다(`review-dispatch.ts`). context-review는 같은 관점 목록으로 dispatch를 대조한다. low+`review_risk`인데 perspectives를 `verifiability`만으로 줄이면 `context-review-target-invalid`다(`context-review-store.ts`, `test/context-review-state.test.js`).

원장·승격: bootstrap은 항상 full 원장(mode/light_runner 키 없음)을 만든다(`coordinator-prepare.ts`). `isRemovedLightLedger`는 `mode === 'light'`면 true다. fence·preflight·revise·repair 등이 쓰기 전에 `light-mode-removed`로 거절한다. `coordinate promote-stop`과 `bootstrap --promote-light`는 CLI 첫 동작에서 exit 2다(`cli-git-commands.ts`). `direct_eligible`은 scale/complexity를 보지 않고 직렬·commit 수 상한만 본다(`run-preflight.ts`).

문서·벤치마크: plan ACQ `plan.complexity`, run 문서에서 light 전용 경로·검증 스크립트 제거, ACP responder에 `plan.complexity` 게이트가 들어간다. `benchmarks/acp/responder.cjs`의 `bouncerCli`는 제거된 `scripts/bouncer` 대신 `packages/cli/bin/bouncer`를 가리킨다 — spawn이 옛 래퍼를 가정하면 같은 방식으로 깨질 수 있다.

검증 증적(digest `evidence.verification`): 001 `cc76057b…`, 002 `3d50e8f1…`, 003 `770e887d…`, 004 `f2a4bba7…`, 005 `7dca20f5…`. 최종 리뷰는 discovery 뒤 델타 1회로 `CT-001-CTX-RISK-DISPATCH`를 resolved 처리했다(`evidence.review`, rounds 2).

## Quiz

1. 새 blueprint를 `scaffold blueprint --scale light`로 만들면?
   - A) `scale: light` 문서를 만들고 plan 리뷰를 skip한다
   - B) 파일을 쓰기 전에 거절하고 complexity low 선언을 안내한다
   - C) 문서는 만들되 S20만 실패한다

2. blueprint `bouncer`에 `complexity` 키가 없으면?
   - A) 구조 검사 S20이 실패한다
   - B) `complexityOf`가 `standard`로 읽는다
   - C) `null`이라 execute 분류기가 전부 거절한다

3. 표식 blueprint가 `complexity: low`이고 commit task에 `review_risk`가 있을 때 discovery 관점은?
   - A) `verifiability`만
   - B) `verifiability`, `risk_security`
   - C) standard와 같은 4관점

4. 같은 조건에서 delta round 관점은?
   - A) `combined`
   - B) `verifiability`, `risk_security`
   - C) `verifiability`만 (risk가 있어도 고정)

5. `mode: light` 원장이 남아 있을 때 `run preflight`는?
   - A) task가 모두 integrated면 통과한다
   - B) `delegable: false`, reason `light-mode-removed`
   - C) `promotion-stopped`로 막는다

6. `coordinate promote-stop`을 호출하면?
   - A) light를 full 원장으로 승격한다
   - B) CLI가 exit 2로 제거 안내를 내고 쓰지 않는다
   - C) core가 `promote-reason-invalid`만 검사한다

## Tasks

### plugin-surface-slimming/complexity-declaration/001 · `c40c39a2`

#### Goal & intent

CLI 쪽 변경 전부를 한 commit으로 낸다. 선언(`complexity`), 구조 검사, plan gate와 routing, 리뷰 강도와 리뷰어 등급, light 원장과 승격 경로 제거가 같은 파일과 같은 테스트를 나눠 쓰고, 어느 한 조각만 합치면 `npm run ci`가 깨지기 때문이다. 완료 조건은 아래와 같다.

- 새 blueprint가 `complexity: standard`로 시작하고 `--complexity low`가 low를 쓰며 `--scale light`는 거절된다.
- 닫히지 않은 `scale: light`는 구조 검사가, 새 bootstrap은 `light-mode-removed`가 거절하고 닫힌 light 문서는 그대로 읽힌다.
- 직렬 commit task 여러 개가 plan gate를 통과한다.
- 같은 입력에서 low와 standard의 리뷰 전략이 갈린다.
- `mode: light` 원장은 task 상태와 관계없이 `light-mode-removed`와 복구 안내로 거절된다.
- `promote-stop`과 `--promote-light`는 exit 2다.

검증 명령은 `node scripts/verify-complexity-declaration.js`(관련 테스트 파일 전체 실행)이고, 완료 전 `npm run ci`도 통과해야 한다.

#### Current behavior

- 선언: `SCALE_ENUM = ['light', 'full']`(`schema.ts:62`). `scaffold blueprint --scale light|full`이 `requireScale`(`scaffold.ts:140`)와 `templateNameFor`(`:155`)로 `*-light.md` 템플릿(`templates.ts:192`·`:201`·`:213`)을 고르고, `scaffoldTask`는 blueprint scale을 상속한다(`:333`). CLI 검사 `cli-doc-commands.ts:172`, 사용법 `cli-usage.ts:9`. 구조 검사 S20은 scale enum만(`validate-structural.ts:196`), S38은 `review_contract`만 본다(`:222`). plan 구조 해시는 blueprint는 `scale`·`review_scope`만, task는 경로·의존·실행 종류 등만 읽고 `review_risk`는 읽지 않는다(`plan-snapshot-contract.ts:56`~`:67`).
- plan gate: G20이 light에 commit task 1개와 빈 `depends_on`을 요구한다(`validate-gates-plan.ts:465`~`:475`). `planScaleOf`(`:595`), `checkScopedTerminalPolicy`의 `isLight`(`:344`·`:578`·`:812`). `plan approve`는 표식 없는 light만 context review를 건너뛴다(`plan-approve.ts:196`~`:204`). routing `recommendation`은 `light-candidate`|`full-candidate`(`plan-inspect.ts:89`·`:913`~`:921`).
- 리뷰: `classifyPlanReview`는 표식 없는 light를 `skip`으로 보내고(`review-dispatch.ts:658`~`:668`), 표식 light는 `PLAN_LIGHT_PERSPECTIVES`(`schema.ts:105`)를 쓴다(`:754`). `planDeltaPerspectiveOf(scale)`(`schema.ts:117`), `reviewContractOf`의 light 접기(`:149`). `context-review-store.ts:196`·`:259`·`:265`·`:293`과 `context-review-state.ts:286`·`:411`이 scale로 관점을 대조한다. execute는 light를 크기 문턱 없이 `single`/`['combined']`로 보내고(`review-dispatch.ts:983`~`:993`) 최종 brief 관점을 끈다(`:873`). 리뷰어 등급은 commit task 3개 이상(`REVIEWER_STRONG_MIN_TASKS`, `:52`, `computeReviewerTier` `:1054`~`:1067`)이면 strong이다.
- 원장: bootstrap은 `scale: light`이고 `isLightEligible`(`coordinator-prepare.ts:141`)을 통과하면 `mode: 'light'`·`light_runner: 'subagent'` 원장을 만들고 아니면 `light-requires-serial`이다(`:1246`~`:1264`). 재개 시 `light-ledger-legacy`·`ledger-mode-mismatch`(`:1270`~`:1280`). `isLegacyLightLedger`(`coordinator-ledger.ts:430`)가 fence(`:117`), `coordinate next`(`coordinate-next.ts:590`), revise(`cli-git-commands.ts:770`), `run preflight`(`run-preflight.ts:430`)에서 옛 inline 원장을 거절한다. light 전용 분기: `light-inline-removed`(`coordinator-commands.ts:1663`), `light-implementer-record-missing`(`:1209`), `light-scope-revision-requires-promotion`(`cli-git-commands.ts:776`, `coordinator-repair.ts:315`~`:321`), 최종 리뷰 상한(`coordinate-next.ts:802`~`:815`), baseline 생략(`coordinator-prepare.ts:936`), fan-in `light` 인자(`coordinator-fanin.ts:130`). `direct_eligible`은 scale이 full|light일 때만 true다(`run-preflight.ts:455`).
- 승격: `coordinatePromoteStop`(`coordinator-commands.ts:827`, `PROMOTE_STOP_REASONS` `:87`), CLI 핸들러 `cli-git-commands.ts:723`, `promoteLightBootstrap`(`coordinator-prepare.ts:271`)과 지원 함수 `worktreeDiffSha`·`openPromoteTask`·`promoteFingerprintTarget`(`:188`~`:230`), 플래그 `cli-git-commands.ts:888`, 계약 `coordinator-command-contracts.ts:11`, `seedIntegration`의 `allowOverwrite`(`seed-worktree.ts:748`·`:818`). `promotion-stopped` 거절이 `coordinator-commands.ts:456`·`:778`·`:1649`, `coordinator-prepare.ts:902`, `coordinate-next.ts:695`, `coordinator-repair.ts:435`, `run-preflight.ts:76`·`:239`에 있고 hint 표(`coordinator-commands.ts:1956`~`:2001`)에 `promote-*`·`promotion-*` 키가 있다.
- 브랜치: integration 브랜치가 남아 있고 그 브랜치의 worktree가 없으면 `resolveWorktreeBranch`(`runtime-state.ts:192`~`:206`)가 `branch-conflict`를 낸다(bootstrap `coordinator-prepare.ts:1222`과 prepare가 공유).
- 재현: `rg -n "scale: 'light'|scale: light|mode = 'light'|mode: 'light'|promote|light-candidate|skip" test`로 영향 테스트를 모으고 `node --test test/scaffold.test.js test/schema.test.js test/validate-structural.test.js test/review-dispatch.test.js test/coordinator.test.js`로 현재 기준선(통과)을 확인한다. 이번 조사는 소스를 읽어 확인했고 red/green은 구현 시점이 기준이다.

#### Target behavior

- 성공
  - 선언
    - `scaffold blueprint`는 `bouncer.complexity`를 `scale` 바로 뒤에 쓴다. 기본 `standard`, `--complexity low`는 `low`이고 `--scale full`은 받는다. `scale: full`은 계속 쓴다.
    - `*-light.md` 템플릿과 `templateNameFor`의 light 분기가 없다. 생성 문서는 5개(index, context-review, review, tasks/001/{tasks,verification})다. `scaffoldTask`는 scale을 상속하지 않는다.
    - `schema.complexityOf(bouncer)`는 `low`|`standard`|`null`을 돌려준다(부재·비객체는 `standard`, 허용 밖은 `null`). plan 구조 해시는 `complexity === 'low'`일 때만 blueprint 구조에 `complexity: 'low'`를, 각 task 구조에 정렬된 `review_risk`를 싣는다. 그래서 low 계획은 `review_risk`를 바꾸면 digest가 달라지고, standard·부재 blueprint와 기존 계획의 구조 해시·digest는 한 글자도 바뀌지 않는다.
    - 구조 검사: 허용 밖 `complexity`는 S20, `complexity`가 `review_contract: brief` 없이 있으면 S38이다.
  - plan gate와 routing
    - G20은 scale을 보지 않는다. `isLight`·`planScaleOf`가 없어지고 직렬 commit task 여러 개 + terminal 1개가 통과한다.
    - `plan approve`는 모든 blueprint에 context review `accepted`를 요구한다.
    - routing `recommendation`은 `low-candidate`|`standard-candidate`다. 판정 조건(tasks>=2, dependencies>0, modules>=3, riskPaths>0이면 `standard-candidate`)과 `reasons`는 그대로다.
    - 닫힌(`closed`·`partial_closed`) blueprint의 `scale: light`는 S20을 통과한다. `drive-execution/worker-lint-check/index.md`는 `status`만 `closed`로 바뀐다.
  - 리뷰 강도
    - plan 리뷰(표식 blueprint): low는 `['verifiability']`, 어느 commit task든 `review_risk`가 비어 있지 않으면 `['verifiability', 'risk_security']`, standard는 4관점이다. delta 관점은 low `verifiability`, standard `combined`다. low의 delta는 `review_risk`가 있어도 `verifiability` 한 관점으로 고정한다(의도: delta는 지난 지적이 풀렸는지 확인하는 라운드이고 `risk_security`는 전체 라운드가 맡는다). `context-review-store`·`context-review-state`가 같은 값으로 dispatch와 round를 대조한다. 표식 없는 blueprint는 complexity와 무관하게 지금의 full 경로(`single`)를 타고 `skip` 전략은 없다.
    - execute 리뷰: low는 task 범위와 최종 범위 모두 `single`/`['combined']`이고 reasons에 `blueprint complexity is low — single combined reviewer regardless of diff size`가 있다. brief 관점(`spec_scope`·`correctness_tests`)은 쓰지 않는다. `review_risk`가 비어 있지 않으면 `security`가 붙는 규칙은 low에도 그대로다. standard는 지금과 같다(크기 문턱 3 파일·200줄).
    - 리뷰어 등급: low는 task 수 문턱을 평가하지 않는다(risk 없음 reasons는 `reviewer tier standard — complexity low (no task-count threshold) and review_risk empty`). `review_risk`와 `review.min_reviewer_tier: strong`은 low에도 strong을 만든다. standard는 한 글자도 바뀌지 않는다.
    - `reviewContractOf`는 scale로 접지 않는다. low 최종 리뷰도 `review_contract: brief`를 그대로 읽어 repair 1회와 delta 1회를 받는다.
  - 원장과 승격 제거
    - bootstrap은 scale과 무관하게 `mode`·`light_runner` 키 없는 full 원장을 만든다(응답 `mode`는 `full`, 직렬이 아닌 DAG도 받는다). 단 `scale: light` blueprint는 아래 실패 항목대로 거절한다.
    - `direct_eligible`은 `reason === null`, `drive_shape === 'serial'`, `1 <= commit_tasks <= coordinator.direct_max_commit_tasks`(기본 3, `config.ts:290`~`:313`)일 때 true다. scale·complexity를 보지 않는다.
    - 최종 리뷰 상한은 `review_contract`로만 갈린다. `brief`면 repair 한 번과 delta 한 번, 그 밖에는 discovery 뒤 `final-review-blocked`다. baseline과 fan-in 보고 검사는 모든 원장에 적용된다.
    - 명령 목록, 사용법, 계약 타입, hint 표에 승격 항목이 없다. `seedIntegration`은 `allowOverwrite`를 받지 않는다.
- 실패
  - 선언
    - `--scale light`는 파일을 쓰기 전에 exit 2와 `scaffold blueprint: --scale light was removed; declare --complexity low instead`를 낸다. 허용 밖 `--complexity`는 `scaffold blueprint: --complexity must be one of low|standard, got "bogus"` 형식 exit 2다. 허용 밖 `--scale`과 값 없는 플래그도 exit 2다.
    - `scaffoldBlueprint({ scale: 'light' })`와 허용 밖 `complexity` 라이브러리 호출은 첫 파일 전에 throw한다.
    - S20 `complexity "<값>" not in enum for bouncer.blueprint`, S38 `complexity requires review_contract brief`. `scale: light`이고 status가 `closed`·`partial_closed`가 아니면 S20 `scale "light" was removed; replan with /bouncer-plan and declare complexity low (closed blueprints keep reading it)`다. 이 메시지는 승인된 문서를 재승인 없이 고쳐 쓰라는 뜻이 아니다. status별 처리는 셋이다. `draft` 문서는 사용자가 `scale: full`과 `complexity` 선언으로 고친 뒤 plan gate를 다시 지난다(옛 light draft는 `review_contract: brief`(S38)와 완전한 task 본문도 갖춰야 gate를 지날 수 있다). `approved` 문서는 직접 고쳐 쓰지 않고 `/bouncer-plan`으로 다시 계획해 재승인을 받는다(승인 뒤 수정은 plan 승인 기록과 어긋난다). 그 밖의 닫히지 않은 status(`superseded`·`imported` 등)는 새 blueprint slug로 다시 계획한다.
  - 리뷰: 허용 밖 `complexity`는 plan 리뷰에서 S20이 먼저 막고, execute 리뷰는 `{ ok: false, error: 'blueprint complexity invalid: expected low or standard' }`를 돌려준다.
  - `light-mode-removed` 거절. 입력 조건은 둘이다.
    - 원장 `mode: 'light'`이다. 표식(`light_runner`) 유무, task 상태(모두 `integrated`여도), `promotion_stopped` 여부를 가리지 않는다.
    - blueprint `scale: 'light'`이다. `run preflight`는 status가 `closed`·`partial_closed`가 아닐 때만 이 reason을 내고(닫힌 light는 `blueprint-closed` 그대로), `coordinate bootstrap`은 신규 seed와 재개 모두 status와 관계없이 거절한다.
  - 거절 위치: `run preflight`(`delegable: false`), `coordinate bootstrap`(seed·재개), `openLedgerFenced`를 쓰는 모든 `coordinate` 변경(`repair` 포함), `coordinate next`·`advance`·`prepare`, `coordinate revise`. 모두 원장·worker·문서를 쓰기 전에 거절하며 거절 전후 바이트가 같다. 읽기 전용 경로(`coordinate status`, finalize digest, `drive_record` 집계)는 거절하지 않고 지금처럼 읽는다.
  - 복구 안내(`COORDINATE_FAILURE_HINTS['light-mode-removed']`의 `next`. 영어 한 상수로 두고 테스트가 그대로 비교한다. CLI는 안내만 하고 아무것도 지우지 않는다).
    1. 먼저: 업그레이드 전에 진행 중 drive를 이전 CLI로 `/bouncer-finalize`까지 끝내는 것이 정상 경로다(`finish the drive with the previous CLI and run /bouncer-finalize before upgrading`). blueprint `closed`는 finalize에서만 되므로 drive만 끝내면 문서가 `approved`로 남아 새 CLI의 S20이 계속 막는다. 이미 새 CLI라면 아래를 따른다.
    2. 보존: worktree 경로는 main checkout에서 `git worktree list`로 얻는다(integration은 `.worktrees/<epic>/<bp>/integration`, worker는 같은 디렉터리의 `workers/<ddd>`). `coordinate status`는 integration cwd에서만 돌고 응답에 `integrationPath`가 없으므로 출처가 아니다. worktree마다 worktree 밖 디렉터리 `<dir>`에 담는다. 커밋은 `git -C <path> bundle create <dir>/<name>.bundle <branch>`로(브랜치 이름은 `git -C <path> branch --show-current`), 미커밋은 `git -C <path> diff > <file>`, `git -C <path> diff --staged > <file>`, `git -C <path> ls-files --others --exclude-standard` 파일 복사로 담는다. integration에서는 gitignore된 원장 `<integration>/.bouncer/runtime/coordinator.json`도 `<dir>`로 복사한다. 자동 보존은 없다.
    3. 사용자 승인: 폐기는 되돌릴 수 없으므로 사용자가 명시적으로 승인(`explicit approval`)한 뒤에만 한다.
    4. 폐기: `<dir>`에 bundle과 `coordinator.json` 복사가 있는지 확인한 뒤 `git worktree remove --force <path>`(integration과 worker 각각), 이어 `git worktree prune`. 브랜치 삭제(`git branch -D <branch>`)는 사용자가 따로 승인한 경우만이고, bundle 없이 `branch -D`를 하지 않는다(브랜치의 커밋은 bundle로만 남는다).
    5. 재계획: `/bouncer-plan`으로 `complexity`를 선언해 다시 계획한다. 같은 blueprint 디렉터리로 다시 실행하려면 4단계에서 승인받아 integration·worker 브랜치까지 지운 상태여야 하며, 남아 있으면 bootstrap이 `branch-conflict`를 낸다. 브랜치를 지우지 않으려면 새 blueprint slug(new blueprint slug)로 재계획한다.
  - 제거된 호출은 CLI 핸들러의 첫 동작에서 거절한다(`--repo` 해석·플래그 값 검증·core 호출보다 앞). `coordinate promote-stop ...`은 exit 2와 `coordinate promote-stop was removed; replan with /bouncer-plan and declare complexity`, `coordinate bootstrap --promote-light`는 원장·worktree를 만들기 전에 exit 2와 `coordinate bootstrap --promote-light was removed; replan with /bouncer-plan`이다. 다른 인자가 틀려도 같은 안내가 나오고 파일은 쓰이지 않는다. 일반 bootstrap으로 떨어지지 않으며 core에 reason을 새로 만들지 않는다.
  - 거절 표.

    | 위치 | 입력 | 결과 |
    | --- | --- | --- |
    | `run preflight` | `mode: light` 원장(task 상태 무관) | `delegable: false`, `light-mode-removed` |
    | `run preflight` | `scale: light`, status `approved` | 같음 |
    | `run preflight` | `scale: light`, status `closed` | `blueprint-closed`(변경 없음) |
    | `coordinate bootstrap` | seed 시점 `scale: light`(status 무관) | `light-mode-removed`, 원장 미생성 |
    | `coordinate bootstrap` | 재개 시 `mode: light` 원장 | `light-mode-removed` |
    | `coordinate bootstrap` | 재개 시 `mode` 없는 full 원장 + blueprint `scale: light` | `light-mode-removed`(원장 바이트 불변) |
    | fenced 변경, `next`·`advance`·`prepare`, `revise`, `repair` | `mode: light` 원장(task 상태 무관) | `light-mode-removed` |
    | `coordinate status`, finalize digest | `mode: light` 원장 | 거절 없이 읽음 |
    | `coordinate promote-stop`, `bootstrap --promote-light` | 어떤 인자 조합이든 | exit 2와 제거 안내, 쓰기 없음 |
- 보존
  - `SCALE_ENUM` 값과 닫힌 light 문서 읽기. `scale: full`·부재는 S20이 통과시킨다. `complexity` 부재는 standard다.
  - full 본문 템플릿(`blueprint.md`·`tasks.md`·`review.md`), `epic`·`explain`·`context-review` scaffold 출력은 바이트 단위로 같다.
  - G3~G5, G16, G17과 G20의 나머지 규칙(구현 task `bouncer.verify` 필수, terminal 정확히 1개, terminal이 모든 commit에 의존), routing 판정 조건과 `reasons`.
  - `REVIEW_CONTRACT_INVALID` 거절, delta의 `single`/`['combined']` 접기(`reviewMode: 'delta'`), `EXECUTE_SMALL_MAX_FILES = 3`·`EXECUTE_SMALL_MAX_LINES = 200`, 옛 clustered·single plan payload 읽기 호환, plan·execute dispatch payload의 키 집합.
  - `scope.ts`·`commit-guard.ts`의 `mode: 'light'` 판정, `promoted_patch` payload와 `promoted_from`·`promotion` 읽기, `Ledger.status`의 `promotion_stopped` 리터럴, `PromotionRecord` 타입, `drive_record.mode`·`by_mode`·`promotions` 집계.

#### Interface

- 제공
  - `schema.COMPLEXITY_ENUM = ['low', 'standard']`, `DEFAULT_COMPLEXITY = 'standard'`, `SCALE_DECLARABLE_ENUM = ['full']`, `complexityOf(bouncer: unknown): 'low' | 'standard' | null`, `PLAN_LOW_PERSPECTIVES = ['verifiability']`, `planPerspectivesOf(complexity, hasReviewRisk: boolean): string[]`, `planDeltaPerspectiveOf(complexity): string`.
  - `hasReviewRisk` 출처: `review-dispatch.ts`는 이미 구한 `unionCommitReviewRisk`가 비어 있지 않은지로 정한다. `context-review-store.ts`는 `review-dispatch`를 가져오면 순환(`review-dispatch → context-review-state → context-review-store`)이 생기므로 가져오지 않고 현재 blueprint의 commit task `review_risk`를 `listTasksDocs`로 직접 읽는다.
  - `planSnapshotContract.normalizeStructure(kind, bouncer, complexity?: 'low' | 'standard')`: 세 번째 인자가 `'low'`일 때만 blueprint 구조에 `complexity: 'low'`, task 구조에 정렬된 `review_risk` 배열(부재는 빈 배열)을 싣는다. 인자 생략과 `'standard'`는 기존 구조 그대로다. 저장된 구조를 다시 정규화하는 `review-dispatch.ts`의 previous 검사는 저장된 blueprint 구조의 `complexity`를 넘겨 멱등(`isDeepStrictEqual`)을 유지한다.
  - `scaffoldBlueprint({ ..., scale?: 'full', complexity?: 'low' | 'standard' })`, CLI `scaffold blueprint ... [--complexity low|standard] [--scale full]`. `scaffoldTask`의 `scale` 인자는 없어진다.
  - `checkScopedTerminalPolicy(blueprintIndex, tasksList, failures, repoRoot?)`(`isLight` 인자 없음), `Routing.recommendation: 'low-candidate' | 'standard-candidate'`.
  - `decideReviewerTier({ repoRoot, agentName, baseDispatch, taskCount, riskFlags, complexity })`와 `computeReviewerTier({ taskCount, riskFlags, min, complexity })`. `complexity === 'low'`면 `taskCount` 원인을 만들지 않는다.
  - reason `light-mode-removed`와 hint 한 줄. `coordinatorLedger.isRemovedLightLedger(ledger): boolean`은 `ledger.mode === 'light'`이면 true인 순수 함수다(파일·git을 읽지 않는다. `isLegacyLightLedger`를 대체한다).
  - `PreflightOk['reason']` 유니온: `'light-ledger-legacy'`를 `'light-mode-removed'`로 바꾸고 `'promotion-stopped'`를 뺀다. `coordinate` 명령 집합에서 `promote-stop`이, bootstrap 플래그에서 `--promote-light`가 빠진다.
- 거부 (throw·exit 2·reason 오류 목록)
  - 허용 밖 scale·complexity 입력(scaffold), `light-mode-removed` 입력 전부, 제거된 두 승격 호출.
- fallback (miss 목록, 오류가 아님)
  - `complexity` 키 부재는 standard다. blueprint index를 읽지 못하면 지금처럼 `blueprint index unreadable`이다. status를 읽지 못한 blueprint는 닫히지 않은 것으로 본다(S20 거절 쪽). 원장 부재·손상·git 실패는 miss로 접고 문서 status 검사가 막는다.
- 없어지는 것(코드와 hint 모두): `light-ledger-legacy`, `light-requires-serial`, `light-inline-removed`, `light-implementer-record-missing`, `light-scope-revision-requires-promotion`, `ledger-mode-mismatch`, `promote-`·`promotion-`으로 시작하는 `COORDINATE_FAILURE_HINTS` 키 전부, `PLAN_LIGHT_PERSPECTIVES`.
- 용어: `complexity`는 문자열 `'low'` 또는 `'standard'`다(예: `complexity: low`). 닫히지 않은 blueprint는 status가 `closed`도 `partial_closed`도 아닌 것이다(예: `approved`). 리뷰 범위는 `taskId`가 있는 task 범위와 없는 blueprint(최종) 범위다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/schema.ts` | `COMPLEXITY_ENUM`·`complexityOf`·`SCALE_DECLARABLE_ENUM`, `PLAN_LIGHT_PERSPECTIVES`, `planDeltaPerspectiveOf`, `reviewContractOf` | Modify | scale enum, scale 기준 관점·계약 접기 | 선언 상수·해석기 추가, 관점을 complexity 기준으로, 계약 접기 삭제 | `schema.ts:62`·`:105`·`:117`·`:149` |
| `packages/cli/src/scaffold.ts` | `requireScale`, `templateNameFor`, `blueprintScale`, `scaffoldBlueprint`, `scaffoldTask` | Modify | scale 검사와 light 템플릿 선택 | light 거절, complexity 검사·기록, 단일 템플릿, scale 상속 삭제 | `scaffold.ts:129`·`:140`·`:155`·`:333`·`:519` |
| `packages/cli/src/templates.ts` | `blueprint-light.md`·`tasks-light.md`·`review-light.md` 항목 | Modify | light 전용 본문 | 세 항목과 주석 삭제 | `templates.ts:184`~`:213` |
| `packages/cli/src/cli-doc-commands.ts` | `scaffold blueprint` 핸들러 | Modify | `--scale` enum 검사 | `--scale`·`--complexity` 검사 | `cli-doc-commands.ts:172` |
| `packages/cli/src/cli-usage.ts` | `scaffold`·`plan`·`coordinate`·`bootstrap` 사용법 | Modify | `[--scale light\|full]`, routing, promote 안내 | `[--complexity low\|standard] [--scale full]`, promote 안내 삭제 | `cli-usage.ts:9`·`:15`·`:17`·`:40`·`:56` |
| `packages/cli/src/validate-structural.ts` | S20, S38 | Modify | scale enum, review_contract | complexity enum·brief 전제, 닫히지 않은 light 거절 | `validate-structural.ts:196`·`:222` |
| `packages/cli/src/plan-snapshot-contract.ts` | `normalizeStructure` | Modify | blueprint 구조에 scale·review_scope | `complexity: 'low'`일 때만 blueprint에 `complexity`, task에 정렬된 `review_risk` 추가(세 번째 인자) | `plan-snapshot-contract.ts:50`~`:67` |
| `packages/cli/src/plan-snapshot.ts` | `readPlanContent` | Modify | task 구조 정규화에 complexity를 넘기지 않음 | blueprint `complexity`를 먼저 읽어 `normalizeStructure` 세 번째 인자로 전달(low 계획의 digest만 달라지고 standard·기존 계획은 같음, RISK-004) | `plan-snapshot.ts:91` |
| `packages/cli/src/validate-gates-plan.ts` | `checkScopedTerminalPolicy`, `planScaleOf` | Modify | light면 commit task 1개 강제 | light 분기·`isLight`·`planScaleOf` 삭제, 호출 두 곳 정리 | `validate-gates-plan.ts:344`·`:465`·`:549`·`:578`·`:595`·`:797`·`:812` |
| `packages/cli/src/plan-approve.ts` | context review 요구 분기 | Modify | 표식 없는 light만 건너뜀 | 분기 삭제, 모두 요구 | `plan-approve.ts:196`~`:204` |
| `packages/cli/src/plan-inspect.ts` | `summarizeRouting`, `Routing` | Modify | `light-candidate`/`full-candidate` | 값 이름 교체, light 주석 정리 | `plan-inspect.ts:35`·`:89`·`:886`·`:913`~`:921` |
| `packages/cli/src/review-dispatch.ts` | `classifyPlanReview`, `classifyExecuteReview`, `computeReviewerTier`, `decideReviewerTier` | Modify | scale light로 skip·관점·단일 리뷰 선택 | complexity 읽기, skip 삭제, low 분기, 등급 인자, previous 재정규화에 complexity 전달 | `review-dispatch.ts:465`·`:588`·`:658`·`:754`·`:858`·`:873`·`:983`·`:1054`·`:1134` |
| `packages/cli/src/context-review-store.ts` | dispatch 대조 | Modify | scale light 관점 대조, skip dispatch 거절 | `planPerspectivesOf` 기준, 표식 없는 light 거절 삭제 | `context-review-store.ts:196`·`:259`·`:265`·`:293` |
| `packages/cli/src/context-review-state.ts` | `checkRoundPerspectives` | Modify | scale로 delta 관점 대조 | complexity 인자 | `context-review-state.ts:286`·`:411` |
| `packages/cli/src/cli-review-dispatch-command.ts` | 도움말 | Modify | "scale is light" 안내 | complexity 문구 | `cli-review-dispatch-command.ts:57`·`:130` |
| `packages/cli/src/cli-context-review-command.ts` | 도움말 | Modify | "verifiability (light)" | complexity 문구 | `cli-context-review-command.ts:124` |
| `packages/cli/src/run-preflight.ts` | reason 결정, `directEligible`, 원장 판정 | Modify | scale 읽기, legacy 가림, light 자격, 정지 원장 표시 | `light-mode-removed` 판정, scale 조건 삭제, `promotion-stopped` 삭제 | `run-preflight.ts:75`·`:76`·`:191`·`:239`·`:430`·`:455` |
| `packages/cli/src/coordinator-ledger.ts` | `isLegacyLightLedger`, `openLedgerFenced` | Modify | 옛 inline 판정과 fence 거절 | `isRemovedLightLedger`로 교체, 새 reason | `coordinator-ledger.ts:117`·`:430`·`:443` |
| `packages/cli/src/coordinator-prepare.ts` | `isLightEligible`, `coordinateBootstrap`, `prepareCoordinator`, `promoteLightBootstrap` 계열 | Modify | light seed·자격·재개 검사·baseline 생략·승격 bootstrap | 항상 full seed, 거절 추가, baseline 항상 적용, 승격 함수·분기 삭제 | `coordinator-prepare.ts:141`·`:188`~`:230`·`:271`~`:520`·`:902`·`:936`·`:1246`~`:1293` |
| `packages/cli/src/coordinate-next.ts` | fence 거절, 최종 리뷰 상한, `promotion-stopped` 분기 | Modify | light 거절·light 상한·정지 원장 막기 | 새 reason, light·정지 분기 삭제 | `coordinate-next.ts:590`·`:693`~`:700`·`:802`~`:815`·`:1037` |
| `packages/cli/src/coordinator-repair.ts` | `finalReviewGate`, review repair 분기, 지원 reason, `promotion-stopped` | Modify | light 리뷰 repair 분기 | light 분기·reason·정지 거절 삭제 | `coordinator-repair.ts:289`·`:315`~`:321`·`:435`·`:1515` |
| `packages/cli/src/coordinator-fanin.ts` | `scopedTestReportFailure` | Modify | `light` 인자로 보고 부재 허용 | 인자·분기 삭제 | `coordinator-fanin.ts:130`·`:140`·`:148`·`:575` |
| `packages/cli/src/coordinator-commands.ts` | `PROMOTE_STOP_REASONS`, `coordinatePromoteStop`, 명령 목록, light 전용 거절, hint 표 | Modify | 승격 정지 명령, light 거절·hint | 함수·상수·거절 삭제, hint 정리, `light-mode-removed` hint 추가 | `coordinator-commands.ts:87`·`:456`·`:778`·`:827`·`:1209`·`:1649`·`:1663`·`:1849`~`:2001` |
| `packages/cli/src/coordinator-command-contracts.ts` | `promoteLight` 필드 | Modify | bootstrap 입력 계약 | 필드 삭제 | `coordinator-command-contracts.ts:11` |
| `packages/cli/src/seed-worktree.ts` | `seedIntegration`의 `allowOverwrite` | Modify | 승격 seed가 계획 파일을 덮어씀 | 인자·주석 삭제 | `seed-worktree.ts:739`~`:749`·`:818` |
| `packages/cli/src/cli-git-commands.ts` | `coordinate revise`, `promote-stop` 핸들러, 명령 목록, `--promote-light` | Modify | legacy·marked light 거절, 승격 CLI 파싱 | `light-mode-removed` 한 갈래, 핸들러 삭제, 제거 거절을 첫 동작으로 | `cli-git-commands.ts:450`·`:572`·`:723`~`:731`·`:747`~`:781`·`:888`·`:940` |
| `packages/cli/src/execution-contracts.ts` | `Ledger.mode`·`light_runner` 주석 | Modify | light 원장 설명 | "읽기 전용 옛 값" 주석 | `execution-contracts.ts:115`~`:118` |
| `rules/cli.md` | `coordinate repair` 거절 표의 light 행 | Modify | `light-scope-revision-requires-promotion` 행 | 행 한 줄 삭제(표는 repair의 지원 reason과 대조된다) | `rules/cli.md:734`, `doc-shape-contracts.ts:137` |
| `test/scaffold.test.js` | scaffold·scale 분기 테스트 | Modify | light 5문서 단언 | 거절·complexity 단언 | scaffold 출력 소비자 |
| `test/schema.test.js` | `SCALE_ENUM`·관점 정본·`reviewContractOf` 단언 | Modify | scale light 접기 | `complexityOf`·관점·해시 단언 | `schema.ts` 소비자 |
| `test/validate-structural.test.js` | S20·S38·번들 테스트 | Modify | scale light 통과 | complexity·닫힘 단언, 저장소 순회 | S20 소비자 |
| `test/cli-help.test.js` | scaffold·coordinate usage | Modify | `--scale light\|full`·promote 문서화 | 새 usage, 제거 단언 | `cli-usage.ts` 소비자 |
| `test/migrate-context-slugs.test.js` | `scale: 'light'` scaffold fixture | Modify | light blueprint scaffold | `scale` 인자 삭제 | scaffold 소비자 |
| `test/migrate-merge-legacy-epics.test.js` | 같은 fixture | Modify | 같음 | 같음 | scaffold 소비자 |
| `test/validate-gates.test.js` | plan gate light 테스트군 | Modify | light G20 단언 | 직렬 여러 commit 통과 단언 | G20 소비자 |
| `test/plan-approve.test.js` | light context-review 테스트 | Modify | light 부재 → 성공 | 모두 요구 | `plan-approve.ts` 소비자 |
| `test/plan-inspect.test.js` | routing 단언 | Modify | `light-candidate` | 새 값 | routing 소비자 |
| `test/finalize.test.js` | light + context-review 부재 fixture | Modify | scale light fixture | light 의존 제거 | S20 소비자 |
| `test/review-dispatch.test.js` | plan/execute light·행렬·등급 테스트 | Modify | light skip·single combined | low/standard 대비 단언 | 리뷰 전략 소비자 |
| `test/context-review-state.test.js` | 표식 light dispatch·delta 테스트 | Modify | `scale: 'light'` fixture | `complexity: 'low'` | 관점 대조 소비자 |
| `test/run-preflight.test.js` | light 자격·legacy·정지 원장 테스트 | Modify | light reason | 새 reason·자격 | preflight 소비자 |
| `test/coordinate-next.test.js` | light 원장 next·최종 리뷰·정지 테스트 | Modify | light 상한·legacy reason | 거절·full 상한 단언 | next 소비자 |
| `test/coordinator.test.js` | light bootstrap·보고·inline·promote 테스트군, hint 커버 | Modify | light 원장·승격 계약 | full 원장·거절 단언, 승격 테스트 삭제 | 원장 소비자 |
| `test/coordinator-e2e.test.js` | light drive e2e | Modify | light drive 시나리오 | full drive·거절 | 원장 소비자 |
| `test/cli-coordinate.test.js` | revise·session-open·bootstrap light, `--promote-light` 테스트 | Modify | light 거절, 승격 단언 | `light-mode-removed`, exit 2 | CLI 소비자 |
| `test/commit-task.test.js` | scale light bootstrap fixture | Modify | light 원장을 bootstrap으로 생성 | 수동 `ledger.mode = 'light'` fixture | 원장 소비자 |
| `test/helpers/coordinator-fence.js` | fence 명령 목록 | Modify | `promote-stop` 포함 | 삭제 | `coordinator-fence.js:15` |
| `.bouncer/context/epics/drive-execution/blueprints/worker-lint-check/index.md` | `bouncer.status` | Modify | 승인 상태로 남은 scale light blueprint | `closed`로 한 줄 변경 | `worker-lint-check/index.md:14`·`:17`, PR #284 병합, 사용자 확인 |
| `scripts/verify-complexity-declaration.js` | 래퍼 | Create | 없음 | build → 관련 테스트 전체 → doc-shape → eslint → test-names | `scripts/verify-light-preflight.js`와 같은 모양 |

#### Constraints

- 테스트 수정 규칙: light·promote·`skip`을 전제한 테스트는 새 동작에 맞게 고치거나 지운다. 줄 번호로 범위를 고정하지 않는다. 먼저 재현 항목의 `rg`로 목록을 만들고, Touch의 테스트 파일 안에서만 고치며, 삭제한 테스트의 이름과 수, 기대값이 바뀐 테스트를 worker 보고에 적는다. 새 기대값은 아래 파일별 동작 단언이다.
  - `scaffold`·`schema`·`validate-structural`·`cli-help`·`migrate-*`: 새 blueprint는 `complexity: standard`/`low`를 쓰고 5문서로 시작한다. `--scale light`·허용 밖 `--complexity`는 exit 2이며 blueprint 디렉터리가 만들어지지 않는다. `complexityOf`는 부재·`low`·`standard`·`''`·`null` 케이스를 덮고, 구조 해시는 `low`에서만 달라진다(`standard`·부재는 기존 키 집합 `{ scale, review_scope }`이고 task 구조에 `review_risk` 키가 없다). low에서는 commit task의 `review_risk`를 바꾸면 digest가 달라지고(배열 순서만 바꾸면 같다) standard·부재에서는 바꿔도 같다. S20은 `{ status: 'approved', scale: 'light' }`에서 나며 메시지에 `/bouncer-plan`이 있고(status별 draft 수정·approved 재계획·그 밖 새 slug 재계획 세 갈래 안내는 문서와 같다) `closed`·`partial_closed`에서는 나지 않으며, `complexity: 'medium'`은 S20, `complexity: 'low'` + `review_contract` 부재는 S38이다. `.bouncer/context/epics/*/blueprints/*/index.md` 중 `scale: light`이고 `closed`·`partial_closed`인 문서를 실행 시점에 모두 모아 S20이 없음을 확인하고(개수 고정 없음, 1개 이상) `approved`인 light 문서가 0개임도 확인한다. `SCALE_ENUM` 단언은 유지한다. usage 단언은 `[--complexity low|standard] [--scale full]`와 승격 항목 부재로 바꾼다.
  - `validate-gates`·`plan-approve`·`plan-inspect`·`finalize`: `scoped_terminal` 직렬 commit 2개(두 번째가 첫 번째에 의존) + terminal이 `scale`과 무관하게 G20 없이 통과한다(빈 `affected_paths`의 G5 실패는 그대로). 표식 없는 blueprint + context-review 부재는 `plan-approve-context-review`, pending·부재도 같고 accepted면 전이 성공이다. routing 값은 `low-candidate`/`standard-candidate`다. finalize는 `context-review.md` 부재일 때 삭제를 만들지 않는다.
  - `review-dispatch`·`context-review-state`: 아래 Checklist의 리뷰 단언을 따른다. `skip` 단언과 skip payload 단언은 삭제하고, 표식 없는 blueprint는 index를 한 번만 읽고 `single`을 돌려준다. `review_contract: other`는 low에서도 `review-contract-invalid`로 거절된다(`reviewContractOf`가 scale로 접지 않는다). 표식 low는 `single`/`['combined']`, 표식 없는 큰 diff는 `parallel`로 갈린다. 행렬은 `complexity × {standard/legacy, standard/brief, low/brief}`이고 low 셀은 task·root discovery가 `single`/`['combined','security']`(`review_risk` 있을 때)이다.
  - `run-preflight`·`coordinate-next`·`coordinator`·`coordinator-e2e`·`cli-coordinate`·`commit-task`·`helpers/coordinator-fence`: bootstrap은 `scale: full`로 `mode` 키 없는 원장을 만들고 직렬·DAG 흐름(prepare, dispatch, integrate, 보고 검증, baseline)이 full 원장 기대값으로 돈다. 거절 표의 입력은 모두 `light-mode-removed`이고 원장 바이트가 같다. `direct_eligible`은 `scale: full`·`complexity` low·standard 각각에서 직렬 2개는 true, 상한 0·4개·독립 shape는 false이다. 승격 테스트(`promote-stop`·`--promote-light`·`promotion` 이름, 정지 원장, light 상한 분기, inline, baseline 생략)는 지운다. `scope.ts`를 읽는 수동 `ledger.mode = 'light'` fixture(`commit-task`·`commit-guard`)는 `out-of-scope` 기대값을 유지하고, bootstrap으로 light 원장을 만들던 fixture는 full bootstrap 뒤 수동 `ledger.mode = 'light'`로 바꾼다. `promoted_patch` payload 테스트는 그대로 둔다. fence 명령 목록에서 `promote-stop`을 뺀다.
- `computeReviewerTier`의 standard 결과(등급·reasons 문자열)는 한 글자도 바꾸지 않는다. standard 회귀 단언을 하나 이상 유지한다. low의 변화는 리뷰 강도뿐이다. `review_risk` 규칙(execute `security`, strong 등급, plan `risk_security`)과 `review.min_reviewer_tier`를 약하게 만들지 않는다.
- 이 task가 바꾸는 동작을 설명하던 낡는 주석은 같은 task에서 함께 고친다: `packages/cli/src/validate-structural.ts:218`, `packages/cli/src/scaffold.ts:527`~`:529`, `test/helpers/coordinator-fence.js:11`(줄 번호는 조사 시점 기준이고 Touch 파일 안에서만 고친다).
- plan 구조 정규화의 호출부는 `review-dispatch.ts:465`(Touch 안), `plan-snapshot.ts:91`의 `readPlanContent`(Touch 안, 사용자 확인 경로), `context-migration-rewrite.ts:219`다. `normalizeStructure`의 세 번째 인자 `complexity`는 blueprint를 먼저 읽는 `readPlanContent`가 task 호출에 넘겨야 digest가 low에서 달라진다. `readPlanContent`는 blueprint `complexity`를 먼저 읽고 `complexityOf`로 해석해 blueprint와 모든 task의 `normalizeStructure` 호출에 전달한다(`review_risk`는 low에서만 실린다). 그래야 review-dispatch의 previous 재정규화(`review-dispatch.ts:465`)가 멱등이다. `context-migration-rewrite.ts`(`planDigestOf` `:202`, 사용 `:423`)는 affected_paths 밖이고 인자를 넘기지 않는다. 이는 병합 시점에만 맞다(low 계획이 아직 없어 digest가 같다). 병합 뒤 low 계획을 slug 이주하면 기록된 target digest가 낡아 fail-closed로 막히며, 이는 기록해 둔 후속 과제다(경로는 추가하지 않는다). 이 둘 밖의 파일이 필요해지면 파일을 고치지 말고 worker 보고에 적어 경로 확인을 요청한다.
- 새 S 코드를 만들지 않는다. 기존 S20·S38 메시지만 늘린다. 닫힌 light 문서가 S20을 통과해야 한다.
- 거절은 원장·worker·문서를 쓰기 전에 끝난다. `reason` 우선순위는 `light-mode-removed` → 원장 상태 → 문서 status → no-open-task다.
- 코드와 hint를 같은 task에서 함께 지운다. 모든 reason 리터럴에 hint를 요구하는 `coordinator.test.js`의 커버 테스트가 통과해야 한다. `worktreeDiffSha`·`openPromoteTask`·`promoteFingerprintTarget`을 지우기 전에 `rg`로 승격 밖 호출이 없음을 확인한다. `salvageRevokedWorker`·`copyLatestReport`·`removeNode` 같은 revoke 공용 helper는 남긴다.
- `rules/cli.md`에서 이 task가 지우는 것은 거절 표 행 하나뿐이다. 본문 서술은 003 몫이다. 범위 밖 문서 때문에 `npm run ci`가 깨지면 문서를 고치지 말고 worker 보고에 적는다.
- 테스트 이름은 `<조건> → <결과>` 형식을 지킨다(`npm run lint:test-names`).

### plugin-surface-slimming/complexity-declaration/002 · `306f3684`

#### Goal & intent

plan 워크플로 문서가 001이 만든 동작과 같은 말을 하게 한다. `plan.light_scope` ACQ는 `plan.complexity`가 되고, `## Lightweight cycle`은 짧은 복잡도 규칙으로 바뀌며, 축약 문서 세트·task 3절·새 epic 금지·quiz 1문항·evidence 건너뛰기 안내는 사라진다. 완료 조건은 plan·schema 문서, finalize quiz 문서와 ACQ 카탈로그·벤치마크 정책에 `scale: light` 선언 안내가 없고 문서 형태 검사와 ACQ 테스트가 통과하는 것이다. 검증 명령은 `node scripts/verify-complexity-plan-docs.js`다.

#### Current behavior

- `rules/planning.md`의 `## Lightweight cycle`(`:50`~`:123`)이 선언 방법, 줄어드는 5가지(문서 100줄, task 3절, 새 epic 금지, 에이전트 왕복, quiz 크기), 되돌리는 법을 적는다. 문서 형태 검사는 이 제목을 필수로 요구한다(`packages/cli/src/doc-shape-contracts.ts:152`).
- `skills/bouncer-plan/SKILL.md`는 step 2의 `plan.light_scope` ACQ와 light 새 epic 금지(`:154`~`:160`), light scaffold(`--scale light`, 5문서, 100줄, `:179`~`:194`), light 선언·작성 범위(`:250`~`:258`), 표식 없는 light의 context review 건너뛰기(`:333`~`:342`), light 관점 `verifiability`(`:354`), gate 설명(`:385`), ACQ 색인(`:406`)을 담는다. step 번호와 ACQ 위치는 문서 형태 검사가 고정한다(`doc-shape-contracts.ts:190`~).
- `rules/acq-gates.json:5`가 `plan.light_scope`를 카탈로그에 둔다. `test/acq-gate-ids.test.js`는 카탈로그의 모든 gate가 SKILL 색인과 벤치마크 정책 5개(`benchmarks/configs/*-evaluator-policy.json`)에 있어야 한다고 단언한다(`:80`~).
- `references/spec-authoring/index.md:235`~`:256`이 light task 3절·100줄 예산을 적는다. `skills/bouncer-plan/references/context-review.md:1`·`:57`·`:122`, `roundtrip.md:3`·`:22`, `evidence-dispatch.md:4`, `references/context-review/index.md:3`·`:18`~`:26`·`:89`, `agents/bouncer-context-reviewer.md:32`·`:176`, `agents/bouncer-plan-coordinator.md:60`, `rules/document-schema.md:106`~`:112`, `docs/workflow.md:130`~`:150`이 light를 말한다.
- `references/minimality/index.md:34`~`:45`의 `## Intensity (`bouncer.scale`)` 절이 강도를 `light`|`full`로 매핑하고(light는 사다리 1–4단만), "`light` does not shrink it"으로 끝난다. `references/discovery/index.md:94`는 "light declaration versus approval"을 roundtrip 참조 설명에 쓰고, `:115`는 "For a light plan, pass `Evidence` as empty"라고 적는다. 둘 다 어떤 task도 고치지 않던 plan 쪽 안내라 이 task가 맡는다. 문서 형태 검사는 minimality의 일곱 단 번호와 discovery의 열한 단계를 고정한다(`doc-shape-contracts.ts:252`~`:259`).
- quiz: `references/explain-diff/index.md:59`가 light면 1문항으로 고정하고 `skills/bouncer-finalize/references/explain-quiz.md:21`이 같은 말을 한다.
- Codex 미러: `.codex/agents/bouncer-context-reviewer.toml:33`·`:177`, `.codex/agents/bouncer-plan-coordinator.toml:61`은 `agents/*.md`의 생성본이며 light 문구도 같다. `test/agents.test.js`가 두 파일의 일치를 본다.
- 재현: `node --test test/acq-gate-ids.test.js test/skill-bouncer-surface.test.js test/skill-spec-authoring.test.js test/skill-context-review.test.js test/agents.test.js test/doc-shape-cli.test.js`와 `node scripts/check-doc-shape.js`. 이번 조사는 문서를 읽어 확인했고 통과 여부는 구현 시점에 확인한다.

#### Target behavior

- 성공
  - `rules/planning.md`에 `## Complexity declaration` 절이 생기고 `## Lightweight cycle`은 없다. 절은 15줄 안팎이며 다음을 말한다. `bouncer.complexity`는 `low`|`standard`(부재는 standard)이고 plan이 discovery handoff와 `plan inspect` routing을 보고 추천하고 사용자가 `plan.complexity` ACQ에서 확정한다. 선언은 승인이 아니다. 경로·diff·task 수로 자동 선택하지 않는다. low는 plan 리뷰 관점(`verifiability`, 어느 commit task든 `review_risk`를 선언하면 `risk_security` 추가)과 execute 리뷰 `single`/`combined`, 리뷰어 등급의 task 수 문턱 면제만 바꾸고 선언된 `review_risk`의 보안 관점과 strong 등급은 low에서도 그대로 두며 문서 집합·task 절·epic 배정·quiz·실행 경로는 바꾸지 않는다. 기존 `scale: light` 문서는 닫힌 기록으로만 읽히고 새 선언은 구조 검사가 거절한다.
  - `doc-shape-contracts.ts`의 필수 제목이 `Complexity declaration`이다.
  - `plan.complexity` ACQ(step 2)가 같은 체크포인트에 놓인다. 추천 규칙은 "public interface, 보호 경로, 모듈 간 상태 변경이 없고 변경이 좁으면 low를 추천, 그 밖에는 standard를 추천"이며 근거는 discovery handoff와 routing이고 확정은 사용자다. scaffold 명령은 `--complexity <low|standard>`를 붙인다. scaffold 뒤 `index.md`에 `bouncer.complexity` 키가 있는지 확인하고, 없으면 `CLI is outdated`를 포함한 문장으로 CLI가 옛 버전이라고 알리고 멈춘다.
  - 표식 없는 blueprint의 context review 건너뛰기 단락, light 새 epic 금지, 5문서·100줄 안내, light task 3절 안내가 SKILL.md와 spec-authoring에서 사라진다. 모든 task는 같은 8개 절을 쓴다. terminal verification task 설명(모든 `scoped_terminal` blueprint에 필요)은 유지한다.
  - `evidence-dispatch.md`는 `execution_kind: verification` task만 건너뛴다(light 건너뛰기 삭제).
  - `rules/acq-gates.json`의 `plan.light_scope`가 `plan.complexity`가 되고, 벤치마크 정책 5개의 해당 항목이 `gate: plan.complexity`, `answer: standard`(기존 "full 선택과 같은 근거"를 유지하는 `when` 문장)로 바뀐다.
  - `rules/document-schema.md`가 `complexity` 필드(값, 부재=standard, S20·S38)와 `scale: light`가 닫힌 문서의 읽기 값임을 적는다. 닫히지 않은 `scale: light`에 대한 S20 안내는 status별 셋이다: `draft`는 사용자가 `scale: full`과 `complexity` 선언으로 고친 뒤 plan gate를 다시 지나고, `approved`는 직접 고치지 않고 `/bouncer-plan`으로 다시 계획해 재승인을 받으며, 그 밖의 닫히지 않은 status는 새 blueprint slug로 다시 계획한다.
  - context-review 관련 문서의 "light: verifiability only"가 "complexity low: verifiability (+ risk_security when any commit task declares review_risk)"가 된다. 대상은 `references/context-review/index.md`, `skills/bouncer-plan/references/context-review.md`, `agents/bouncer-context-reviewer.md`와 `.codex/agents/bouncer-context-reviewer.toml` 미러다. `.codex/agents/*.toml` 두 개는 `agents/*.md`와 같은 문구로 갱신해 일치를 유지한다.
  - `references/minimality/index.md`의 절 제목이 `## Intensity (`bouncer.complexity`)`가 되고 `low`|`standard`로 매핑한다(`low`는 사다리 1–4단만 적용하고 근거를 한 줄로 남기며, 부재 또는 `standard`는 7단 전부). "`light` does not shrink it" 문장은 "`low` does not shrink it"이 된다. 일곱 단 번호와 "Do NOT minimize these" 목록은 그대로다.
  - `references/discovery/index.md`는 `:94`의 "light declaration versus approval"을 "complexity declaration versus approval"로, `:115`의 "For a light plan, pass `Evidence` as empty."를 삭제한다(evidence 건너뛰기는 `execution_kind: verification` task만이며 `evidence-dispatch.md`가 정본이다). 열한 단계 번호는 그대로다.
  - quiz 문항 수 규칙에서 경량 예외가 사라지고 1–10 판단만 남는다.
  - `test/skill-bouncer-surface.test.js`에 두 종류의 단언이 있다.
    - 부재 단언: plan·schema 문서(`PLAN_DOCS`: `rules/planning.md`, `skills/bouncer-plan/SKILL.md`와 `skills/bouncer-plan/references/`의 Touch 파일 셋, `references/spec-authoring/index.md`, `references/context-review/index.md`, `references/minimality/index.md`, `references/discovery/index.md`, `agents/bouncer-context-reviewer.md`, `agents/bouncer-plan-coordinator.md`, `.codex/agents/*.toml` 두 개, `rules/document-schema.md`, `docs/workflow.md`) 전부에 `plan.light_scope`, `--scale light`, `Lightweight cycle`, `light plan`이 없다. `rules/planning.md`와 `rules/document-schema.md`를 뺀 나머지 모든 `PLAN_DOCS`에는 `scale: light`와 단어 `light`(대소문자 무시, `\blight`)도 없다. 이 문서들은 model tier `light`를 말하지 않으므로(`rg -iw light`로 확인) 단어 단위로 막아도 정당한 언급이 걸리지 않는다. 두 예외 파일은 닫힌 기록의 읽기 값으로 `scale: light`를 설명하므로 그 둘만 `scale: light`·단어 `light` 금지에서 뺀다. quiz 문서(`references/explain-diff/index.md`, `skills/bouncer-finalize/references/explain-quiz.md`)에 `exactly one question`·`경량 예외`가 없다.
    - 존재 단언: `rules/planning.md`에 `## Complexity declaration` 제목이 있다. `rules/acq-gates.json`의 `bouncer-plan`에 `plan.complexity`가 있고 `plan.light_scope`는 없다. 정책 5개 모두 `gate: plan.complexity`, `answer: standard` 항목을 가진다. `skills/bouncer-plan/SKILL.md`에 `AskUserQuestion — plan.complexity` 제목 줄, `--complexity` 인자, 옛 CLI 안전장치 문장(scaffold 뒤 `bouncer.complexity` 키 확인과 `CLI is outdated`)이 있다. complexity low 리뷰 문서(`references/context-review/index.md`, `skills/bouncer-plan/references/context-review.md`, `agents/bouncer-context-reviewer.md`, `.codex/agents/bouncer-context-reviewer.toml`)에 `complexity low: verifiability`가 있다. `rules/document-schema.md`에 `complexity` 필드 항목(`low`·`standard`·부재=standard·S38)이 있다. `references/minimality/index.md`에 `bouncer.complexity`가 있다.
- 실패
  - 위 문구가 하나라도 남으면 새 테스트가 실패한다.
- 보존
  - step 번호(1~8)와 ACQ 위치(1·2·3·4·6), ACQ 색인 형식, G 코드 설명, terminal verification 안내.
  - model tier `light`(`strong|standard|light`) 문구는 건드리지 않는다.

#### Interface

- 제공
  - ACQ gate id `plan.complexity`. 선택지는 standard·low·중단 세 가지이고 추천 표시는 추천 규칙을 따른다. 표시 형식은 `rules/acq.md` 골격(제목 다음 줄에 acq 판독 블록)을 따른다.
  - 문서 소유권: 복잡도 규칙 정본은 `rules/planning.md`, 필드 정의 정본은 `rules/document-schema.md`.
- 거부 (문서 계약 위반 목록)
  - 계획 문서에 `plan.light_scope`·`--scale light`·`## Lightweight cycle`·"light plan"을 남기지 않는다.
- fallback
  - 없음.
- 용어: `plan.complexity`는 `rules/acq-gates.json`의 `bouncer-plan` gate id로, 형식은 `<workflow>.<name>` 소문자 snake(예: `plan.complexity`)다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/planning.md` | `## Lightweight cycle`, `## Epic attribution` 앞 문구 | Modify | light 선언·축약 규칙 | 복잡도 규칙 절로 교체, `:174`의 "full or light" 정리 | `rules/planning.md:50`~`:123`·`:174` |
| `packages/cli/src/doc-shape-contracts.ts` | `PATH_CONTRACTS['rules/planning.md']` | Modify | 필수 제목 `Lightweight cycle` | `Complexity declaration` | `doc-shape-contracts.ts:152` |
| `skills/bouncer-plan/SKILL.md` | step 2 ACQ·scaffold·선언·context review 단락, 색인 | Modify | light 분기 안내 | `plan.complexity` 안내로 교체, 건너뛰기 단락 삭제 | `SKILL.md:114`·`:154`~`:194`·`:250`~`:258`·`:333`~`:342`·`:354`·`:385`·`:406` |
| `skills/bouncer-plan/references/context-review.md` | 첫 줄 조건, 관점 목록, delta 관점 | Modify | light 표식 설명 | complexity 표현 | `context-review.md:1`·`:57`·`:122` |
| `skills/bouncer-plan/references/roundtrip.md` | 선언·승인 분리 설명 | Modify | light 선언 | complexity 선언 | `roundtrip.md:3`·`:22` |
| `skills/bouncer-plan/references/evidence-dispatch.md` | 건너뛰기 조건 | Modify | light blueprint 건너뜀 | verification task만 건너뜀 | `evidence-dispatch.md:4` |
| `references/spec-authoring/index.md` | light task 3절 단락, terminal 설명 | Modify | light 작성 규칙 | 삭제, `complexity` 선언 한 문장 추가 | `index.md:235`~`:256` |
| `references/context-review/index.md` | 설명·적용 범위·delta 관점 | Modify | light 계획 리뷰 설명 | complexity 표현 | `index.md:3`·`:18`~`:26`·`:89` |
| `agents/bouncer-context-reviewer.md` | 관점 설명 | Modify | marked light 관점 | complexity low | `bouncer-context-reviewer.md:32`·`:176` |
| `agents/bouncer-plan-coordinator.md` | discovery 질문 목록 | Modify | "light or full" | "complexity low or standard" | `bouncer-plan-coordinator.md:60` |
| `rules/document-schema.md` | blueprint 필드 설명 | Modify | light 표식 설명 | complexity 필드와 legacy scale 설명 | `document-schema.md:62`·`:106`~`:112` |
| `rules/acq-gates.json` | `bouncer-plan` gate 목록 | Modify | `plan.light_scope` | `plan.complexity` | `acq-gates.json:5`, `test/acq-gate-ids.test.js` |
| `.codex/agents/bouncer-context-reviewer.toml` | 관점 설명 | Modify | `agents/*.md`의 Codex 생성본, light 문구 포함 | `.md`와 같은 문구로 갱신 | `bouncer-context-reviewer.toml:33`·`:177`, `test/agents.test.js` |
| `.codex/agents/bouncer-plan-coordinator.toml` | discovery 질문 목록 | Modify | 같음 | 같음 | `bouncer-plan-coordinator.toml:61` |
| `docs/workflow.md` | plan 설명 | Modify | light 선언 안내 | complexity 안내 | `workflow.md:130`~`:150` |
| `references/minimality/index.md` | `## Intensity` 절 | Modify | `bouncer.scale` light|full 강도 매핑 | `bouncer.complexity` low|standard 매핑, 문장 정리 | `minimality/index.md:34`~`:45`, `doc-shape-contracts.ts:252` |
| `references/discovery/index.md` | roundtrip 참조 설명, handoff Evidence 문장 | Modify | "light declaration", "For a light plan, pass Evidence as empty" | complexity 표현, Evidence 문장 삭제 | `discovery/index.md:94`·`:115`, `doc-shape-contracts.ts:256` |
| `references/explain-diff/index.md` | quiz 문항 수 | Modify | 경량 예외 1문항 | 예외 삭제 | `explain-diff/index.md:59` |
| `skills/bouncer-finalize/references/explain-quiz.md` | 문항 수 설명 | Modify | "exactly one on scale: light" | 예외 삭제 | `explain-quiz.md:21` |
| `benchmarks/configs/fastify-001-evaluator-policy.json` | `bouncer_decisions`의 `plan.light_scope` | Modify | full 선택 | `plan.complexity`/`standard` | `fastify-001-evaluator-policy.json:118` |
| `benchmarks/configs/deepswe-quill-001-evaluator-policy.json` | 같은 항목 | Modify | 같음 | 같음 | `deepswe-quill-001-evaluator-policy.json:110` |
| `benchmarks/configs/deepswe-expr-001-evaluator-policy.json` | 같은 항목 | Modify | 같음 | 같음 | `deepswe-expr-001-evaluator-policy.json:112` |
| `benchmarks/configs/deepswe-statemachine-001-evaluator-policy.json` | 같은 항목 | Modify | 같음 | 같음 | `deepswe-statemachine-001-evaluator-policy.json:112` |
| `benchmarks/configs/deepswe-oxvg-001-evaluator-policy.json` | 같은 항목 | Modify | 같음 | 같음 | `deepswe-oxvg-001-evaluator-policy.json:110` |
| `test/skill-bouncer-surface.test.js` | plan 문서 어휘 테스트 | Modify | reference 목록 고정 | light 어휘 부재 테스트 추가 | `skill-bouncer-surface.test.js` |
| `test/validate-gates.test.js` | 계획 문서·ACQ 관련 단언 | Modify | 문서 내용을 읽는 단언이 있으면 | 문서 갱신으로 깨지는 단언만 맞춤(현재 light 언급 없음, grep 확인) | 사용자 확인 경로, 001이 같은 파일을 먼저 바꾼다 |
| `test/init.test.js` | `.codex/agents/*.toml` 생성·일치 테스트 | Modify | toml 생성본을 읽는 단언 | toml 갱신으로 깨지는 단언만 맞춤(현재 light 언급 없음) | `init.test.js`, 사용자 확인 경로 |
| `test/subagents.test.js` | agent 설정 테스트 | Modify | agent 역할 해석 단언 | 갱신으로 깨지는 단언만 맞춤(현재 light 언급 없음) | 사용자 확인 경로 |
| `scripts/verify-complexity-plan-docs.js` | 래퍼 | Create | 없음 | task 전용 검증 | `scripts/verify-light-preflight.js`와 같은 모양 |

#### Constraints

- `.codex/agents/*.toml`은 `agents/*.md`의 생성본이다. 두 `.toml`은 `.md`의 변경과 같은 내용으로만 바꾸고 `test/agents.test.js`(일치 단언)가 통과해야 한다. 위 세 테스트는 문서 갱신으로 실제로 깨지는 단언이 있을 때만 고친다. 없으면 파일을 바꾸지 않고 worker 보고에 적는다.
- 벤치마크 정책 5개의 `policy_version`, `approval_state`, `approval_record`, 다른 `bouncer_decisions` 항목은 바꾸지 않는다(`acq-gate-ids.test.js` 단언). `fastify-001`은 승인된 정책이라 `gate`·`answer`·`when` 세 값만 바꾼다.
- 문서 형태 검사(`node scripts/check-doc-shape.js`)가 통과해야 한다. `SKILL.md`의 step 구조와 ACQ 색인(`acqIndex`)을 유지한다.
- 모든 AskUserQuestion 제목 다음 줄에 acq 블록이 있고 옵션 문자·추천이 표시와 같아야 한다(`acq-gate-ids.test.js` 판독 블록 검사).
- 한국어 규칙: 사용자에게 보이는 ACQ 문구는 `rules/acq.md` 골격을 따르고 코드·gate id는 그대로 둔다.
- 수정 가능 테스트와 실행만 하는 테스트를 구분한다. 수정 가능은 `skill-bouncer-surface`(새 테스트 추가), `validate-gates`·`init`·`subagents`(사용자가 확정한 경로이지만 문서·생성본 갱신으로 실제 단언이 깨질 때만 고친다. 깨지지 않으면 파일을 바꾸지 않고 worker 보고에 적는다)이다. `acq-gate-ids`·`skill-spec-authoring`·`skill-context-review`·`agents`·`doc-shape-cli`는 확정 경로가 아니므로 래퍼가 실행만 한다.
- `skill-bouncer-surface.test.js`는 plan 문서의 light 안내를 전제한 단언이 있으면 새 문서 상태에 맞게 고치거나 지우고 새 테스트를 추가한다. `light-run.md`와 run 문서에 관한 단언은 003 몫이라 이 task가 바꾸지 않는다.
- 테스트 이름은 `<조건> → <결과>` 형식을 지킨다.

### plugin-surface-slimming/complexity-declaration/003 · `2902f0a3`

#### Goal & intent

`/bouncer-run` 문서와 CLI 계약·설정 문서를 001·002가 만든 동작에 맞춘다. `light-run.md`와 이를 가리키던 포인터가 없어지고, 진행 중 light 원장을 만났을 때의 복구 안내(`light-mode-removed`)는 직접 실행·CLI 계약 문서에 한 곳씩 남는다. 완료 조건은 run·rules·설정 문서에 `light-run.md`, `promote-stop`, `--promote-light`, `scale: light` 실행 안내와 light 경로 서술이 없고 문서 형태 검사와 run 문서 테스트가 통과하는 것이다. 검증 명령은 `node scripts/verify-complexity-run-docs.js`다.

#### Current behavior

- `skills/bouncer-run/SKILL.md`는 light와 full 원장이 같은 경로를 쓰되 정책 차이는 `light-run.md`에 있다고 적고(`:25`~`:33`), 직접 실행 추천 근거를 "light or full"로 쓰며(`:112`~`:116`), `mode`·pointer `scale`이 light면 `light-run.md`를 적용하라고 적는다(`:149`~`:150`).
- `skills/bouncer-run/references/light-run.md`(81줄)가 승격 신호 표, `promote-stop`·`--promote-light` 절차, 구 CLI 감지를 담는다. `direct-run.md`는 light 원장의 승격 신호 표를 먼저 적용하라고 한다(`:3`~`:10`). `agent-dispatch.md`의 `## Lightweight and implement dispatch`(`:31`~`:43`)와 `:138`·`:299`·`:318`이 light 원장을 말한다.
- 문서 형태 검사는 `agent-dispatch.md`의 H2 제목 순서를 고정하며 첫 제목이 `Lightweight and implement dispatch`다(`doc-shape-contracts.ts:76`~`:79`).
- `rules/cli.md`는 light 원장·승격·직접 실행 자격을 길게 설명한다: `:57`(`run preflight` 거절 순서 (4)의 `promotion-stopped`), `:135`~`:136`(routing), `:222`(scaffold `--scale`), `:272`~`:276`(`promote-stop` 사용법), `:380`, `:407`~`:471`(light 원장 계약, `promote-stop`, `--promote-light`, `direct_eligible`), `:553`, `:622`~`:640`(review-dispatch Plan `skip`/light), `:723`(light 리뷰 repair). `rules/subagent-model.md:125`·`rules/commit-scope.md:74`도 light를 말한다.
- 같은 계열의 light 서술이 run·설정 문서에 더 있다. `skills/bouncer-run/references/review-round.md:69`는 brief 최종 리뷰를 "full blueprints only; light has no mark"로, `:123`은 "Task and light reviews, and the one delta"로 적는다. `verification-recovery.md:16`은 debugger dispatch가 "even on the light path" named라고 적는다. `docs/configuration.md`는 `:14`(baseline "light 원장에는 적용하지 않는다"), `:23`·`:51`(직접 실행 자격 "full·light"), `:33`(리뷰어 등급의 commit task 3개 문턱)에서 light 원장·scale을 전제한다. `docs/install.md:172`는 "light drive와 coordinator 없는 실행은 scope 밖 staged 파일을 deny"한다고 적는데, `scope.ts` 판정은 옛 원장 읽기용으로 남으므로 서술만 "옛 light 원장"으로 고친다(우선순위가 낮은 항목). `config.example.json:10`의 `_comment`는 "역할별 implementer 모델 분리는 full 주행 기준입니다. light 주행은 현재 세션에서 구현하므로 별도 implementer 모델이 적용되지 않습니다"라고 적는데, 모든 원장이 같은 named `bouncer-implementer` dispatch를 쓰므로 낡은 문장이다.
- `scripts/verify-light-{preflight,worker-path,promotion,final-review,drive-metrics,run-docs}.js` 여섯 개는 #301의 task 전용 검증 래퍼이고 어디서도 호출되지 않는다.
- 테스트: `skill-bouncer-surface.test.js`가 `light-run.md`를 reference 목록과 승격 표·세 reason 이름으로 고정하고, `coordinate-next.test.js`가 `agent-dispatch.md`의 "integration path on a light ledger" 문구를 정규식으로 본다.
- 재현: `node --test test/skill-bouncer-surface.test.js test/skill-bouncer-run.test.js test/coordinate-next.test.js`와 `node scripts/check-doc-shape.js`. 이번 조사는 문서와 테스트를 읽어 확인했고 통과 여부는 구현 시점에 확인한다.

#### Target behavior

- 성공
  - `light-run.md`와 여섯 개 `verify-light-*.js`가 없다. 어떤 문서도 `light-run.md`를 가리키지 않는다.
  - `SKILL.md`는 직접 실행(D)과 coordinator 실행(A)이 complexity와 무관하게 같은 경로이고, 직접 실행 자격은 preflight의 `direct_eligible`(위임 가능, 직렬, `1 <= commit_tasks <= coordinator.direct_max_commit_tasks`)이 정한다고 적는다. 옛 light 원장 안내는 `light-mode-removed` 복구 안내 한 곳에만 있다.
  - `direct-run.md`는 light 승격 신호 표 선행 문장을 지운다. 직접 실행 도중 범위·인터페이스 변경이 필요해지면 handoff 표(`coordinate revise` 또는 다시 계획)를 따른다는 기존 흐름만 남기고, `light-mode-removed`를 만나면 `rules/cli.md`의 복구 안내를 따르라는 한 문장(업그레이드 전에 진행 중 drive를 이전 CLI로 `/bouncer-finalize`까지 끝낸다는 말 포함)을 둔다.
  - `agent-dispatch.md`의 해당 절 제목이 `Implement dispatch`가 되고 내용은 "모든 원장이 같은 named `bouncer-implementer` dispatch를 쓴다"는 규칙만 남는다. `doc-shape-contracts.ts`의 `AGENT_DISPATCH_HEADINGS` 첫 항목이 같은 제목으로 바뀐다. `:318`의 "integration path on a light ledger" 문구가 사라지고 `coordinate-next.test.js`의 정규식이 새 문장에 맞는다.
  - `rules/cli.md`는 다음을 적는다. `run preflight` 거절 순서 (4)의 ledger status 목록에서 `promotion-stopped`를 빼고 `light-mode-removed`를 가장 앞에 둔다(`rules/cli.md:57`). `scaffold blueprint [--complexity low|standard]`와 `--scale light` 거절, routing `low-candidate`/`standard-candidate`, `coordinate bootstrap`은 항상 full 원장, `light-mode-removed`(두 조건과 거절 위치: `mode: light` 원장은 task 상태와 무관하게 거절하고 읽기 전용 `coordinate status`와 finalize digest는 읽는다, 그리고 복구 안내 5단계(001 상수와 같은 순서: 이전 CLI로 `/bouncer-finalize`까지 끝내기, `git worktree list`로 경로를 얻어 커밋 `git bundle`·diff·gitignore된 `coordinator.json` 복사로 보존, 사용자 승인, 폐기, 재계획). 이전 CLI로 drive를 `/bouncer-finalize`까지 끝낸 뒤 업그레이드하는 것이 정상 경로이고, 5단계의 같은 디렉터리 재실행 조건인 integration·worker 브랜치 삭제 승인 또는 새 blueprint slug와 `branch-conflict` 안내 포함), `promote-stop`·`--promote-light` 제거(exit 2), `direct_eligible` 정의에서 scale 삭제, review-dispatch Plan은 `single` 또는 표식 blueprint의 `perspectives`(low는 `verifiability`이고 어느 commit task든 `review_risk`를 선언하면 `risk_security`를 더한다, `skip` 없음), Execute는 low가 크기와 무관하게 `single` combined이고 standard는 지금 규칙, 리뷰어 등급에서 task 수 문턱은 standard에만 적용한다. 리뷰 repair 설명은 brief 한 갈래다.
  - `rules/commit-scope.md`와 `rules/subagent-model.md`의 light 원장 문구가 사라지거나 "옛 원장 읽기" 한 줄로 줄어든다.
  - `review-round.md`는 `complexity: low`의 최종 리뷰가 `review_contract: brief`여도 single combined 하나이고(brief 관점 `spec_scope`·`correctness_tests`는 standard에만 적용), repair 한 번과 delta 한 번은 brief 값 그대로 받는다고 적는다. `:69`의 "light has no mark"와 `:123`의 "and light"는 사라진다. `verification-recovery.md`의 "even on the light path"는 지운다.
  - `docs/configuration.md`는 baseline 설명에서 "light 원장에는 적용하지 않는다"를 지우고(baseline은 모든 원장에 적용), `direct_max_commit_tasks` 행과 `직접 실행` 문단의 "full·light"를 지우며, `review.min_reviewer_tier` 행에 "`complexity: low`는 commit task 수 문턱을 적용하지 않는다"를 더한다. 키 이름은 `coordinator.direct_max_commit_tasks`로 유지한다. `docs/install.md:172`는 "light drive"를 "옛 light 원장(읽기 전용)"으로 바꾸고, 새 CLI로 올리기 전에 진행 중인 drive를 이전 CLI로 `/bouncer-finalize`까지 끝내야 한다는 한 문장을 더한다.
  - `config.example.json`은 `_comment` 마지막 문장(`:10`)에서 light 주행 문장을 지우고 모든 주행이 같은 named `bouncer-implementer` dispatch를 쓴다는 뜻으로 고친다. 키·값과 다른 `_comment` 항목은 바꾸지 않고 JSON은 계속 유효해야 한다(`test/init.test.js`가 파싱한다).
  - `drive-metrics.md`는 `## Per root-direct session`의 "light or full" 한 문장(`:71`)만 단일 경로 표현으로 고치고 `by_mode`·`promotions` 집계 설명(`:75`)은 유지한다.
  - `skill-bouncer-surface.test.js`: 검사 대상 `RUN_DOCS`는 파일 이름으로 나열한다: `skills/bouncer-run/SKILL.md`, `skills/bouncer-run/references/direct-run.md`, `skills/bouncer-run/references/agent-dispatch.md`, `skills/bouncer-run/references/drive-metrics.md`, `skills/bouncer-run/references/review-round.md`, `skills/bouncer-run/references/verification-recovery.md`, `rules/subagent-model.md`, `rules/commit-scope.md`, `docs/configuration.md`, `docs/install.md`. `rules/planning.md`와 `rules/document-schema.md`는 닫힌 기록의 `scale: light` 읽기 값을 정당하게 설명하므로 `RUN_DOCS`에 넣지 않고 이 금지어 검사에서 뺀다. `rules/cli.md`는 `RUN_DOCS` 밖에서 별도 규칙(제거된 reason 금지와 새 어휘 존재 단언)으로 보고, `config.example.json`은 파일별 금지어(`LIGHT_LEFTOVERS`)로만 본다. reference 목록에서 `light-run.md`가 빠지고, 옛 `light-run.md` 어휘 테스트가 "run·rules 문서에 `light-run.md`·`promote-stop`·`--promote-light`·`scale: light` 실행 안내가 없다"는 테스트로 바뀐다. `light-mode-removed`가 `rules/cli.md`와 직접 실행 문서에 이름으로 있음을 확인한다.
- 실패
  - 위 어휘가 문서에 남으면 새 테스트가 실패한다.
- 보존
  - model tier `light` 문구(`subagent-model --tier`, `metrics end --tier`)와 `rules/cli.md`의 해당 줄.
  - `drive-metrics.md`의 `by_mode`·`promotions` 집계 설명(과거 기록 읽기용).
  - `references/coordinator-cards/implement.md:37`의 `promoted_patch` 안내(이미 승격된 full 원장용).
  - `coordinate repair` 거절 표의 나머지 행(001이 light 행을 이미 지웠다).

#### Interface

- 제공
  - 문서 소유권: `light-mode-removed` 복구 안내의 정본은 `rules/cli.md`이고 `direct-run.md`는 한 문장으로 그 위치를 가리킨다.
- 거부 (문서 계약 위반 목록)
  - `RUN_DOCS` 문서에 `light-run.md`·`promote-stop`·`--promote-light`·`scale: light` 실행 안내를 남기지 않는다. `rules/cli.md`는 제거·거절을 설명하는 줄에서만 `promote-stop`·`--promote-light`·`scale: light`를 쓴다.
- fallback
  - 없음.
- 용어: 복구 안내 5단계는 "이전 CLI로 `/bouncer-finalize`까지 끝내기 → 보존(커밋 `git bundle`, diff, 원장 복사) → 사용자 승인 → integration·worker worktree 폐기 → `/bouncer-plan` 재계획"이다(문구 정본은 001이 `COORDINATE_FAILURE_HINTS['light-mode-removed']`에 둔 상수).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/light-run.md` | 전체 | Delete | light 승격·호환 정책 | 삭제 | `light-run.md` 81줄, `skill-bouncer-surface.test.js` |
| `skills/bouncer-run/SKILL.md` | 시작 안내·직접 실행 추천·원장 mode 안내 | Modify | light 정책을 `light-run.md`로 위임 | complexity 무관 단일 경로 | `SKILL.md:25`~`:33`·`:112`~`:116`·`:149`~`:150` |
| `skills/bouncer-run/references/direct-run.md` | 머리말 | Modify | light 승격 신호 표 선행 | 문장 삭제, `light-mode-removed` 포인터 | `direct-run.md:3`~`:10` |
| `skills/bouncer-run/references/agent-dispatch.md` | `## Lightweight and implement dispatch`, `:138`·`:299`·`:318` | Modify | light 원장 dispatch 설명 | 제목 변경, light 문구 삭제 | `agent-dispatch.md:31`~`:43`·`:138`·`:299`·`:318` |
| `packages/cli/src/doc-shape-contracts.ts` | `AGENT_DISPATCH_HEADINGS` | Modify | 첫 제목 `Lightweight and implement dispatch` | `Implement dispatch` | `doc-shape-contracts.ts:76`~`:79`, 002가 같은 파일을 먼저 바꾼다 |
| `rules/cli.md` | scaffold·routing·bootstrap·preflight·review-dispatch 설명 | Modify | light 원장·승격·scale 서술 | 위 Target 목록대로 교체 | `rules/cli.md:57`·`:135`·`:222`·`:272`~`:276`·`:380`·`:407`~`:471`·`:553`·`:622`~`:640`·`:723` |
| `skills/bouncer-run/references/review-round.md` | brief 최종 리뷰 설명, certify 단계 | Modify | "full blueprints only; light has no mark", "Task and light reviews" | `complexity: low` 최종 리뷰는 brief여도 single combined, light 표현 삭제 | `review-round.md:69`·`:123` |
| `skills/bouncer-run/references/verification-recovery.md` | debugger dispatch 문장 | Modify | "even on the light path" | 구절 삭제 | `verification-recovery.md:16` |
| `docs/configuration.md` | baseline·직접 실행·리뷰어 등급 설명 | Modify | light 원장 제외, "full·light" | light 서술 삭제, low의 task 수 문턱 면제 추가 | `configuration.md:14`·`:23`·`:33`·`:51` |
| `docs/install.md` | commit guard 설명, 업그레이드 안내 | Modify | "light drive ... deny" | "옛 light 원장(읽기 전용)", 업그레이드 전 이전 CLI로 `/bouncer-finalize`까지 drive를 끝내라는 한 문장 | `install.md:172` |
| `config.example.json` | `_comment`의 implementer 모델 분리 문장 | Modify | "light 주행은 현재 세션에서 구현" 서술 | light 문장 삭제, 모든 주행이 named `bouncer-implementer`를 쓴다는 문장 | `config.example.json:10`, 사용자 동의 경로, `test/init.test.js`가 JSON을 파싱 |
| `skills/bouncer-run/references/drive-metrics.md` | `## Per root-direct session`의 "light or full" 문장 | Modify | direct 실행을 light 또는 full로 서술 | 문장만 "light or full" 구분 없이 고침, `:75`의 `by_mode`·`promotions` 집계 설명은 유지 | `drive-metrics.md:71` |
| `rules/subagent-model.md` | light 예외 문구 | Modify | light 예외를 run 문서로 위임 | 문구 삭제 | `rules/subagent-model.md:125`~`:126` |
| `rules/commit-scope.md` | 범위 정책 설명 | Modify | "light ledger and standalone keep out-of-scope" | standalone만 서술 | `rules/commit-scope.md:74` |
| `scripts/verify-light-preflight.js` | 전체 | Delete | #301 task 검증 래퍼 | 삭제 | `scripts/verify-light-preflight.js` (호출처 없음, grep 확인) |
| `scripts/verify-light-worker-path.js` | 전체 | Delete | 같음 | 삭제 | 같음 |
| `scripts/verify-light-promotion.js` | 전체 | Delete | 같음 | 삭제 | 같음 |
| `scripts/verify-light-final-review.js` | 전체 | Delete | 같음 | 삭제 | 같음 |
| `scripts/verify-light-drive-metrics.js` | 전체 | Delete | 같음 | 삭제 | 같음 |
| `scripts/verify-light-run-docs.js` | 전체 | Delete | 같음 | 삭제 | 같음 |
| `test/skill-bouncer-surface.test.js` | reference 목록, light-run 어휘 테스트 | Modify | `light-run.md` 고정 | 삭제된 파일 기준으로 교체 | reference 목록과 light-run 어휘 테스트, 002가 같은 파일을 먼저 바꾼다 |
| `test/coordinate-next.test.js` | agent-dispatch 문구 정규식 | Modify | light 원장 문구 단언 | 새 문장 단언 | agent-dispatch 정규식 단언, 001이 같은 파일을 먼저 바꾼다 |
| `test/skill-bouncer-run.test.js` | run 스킬 문서 단언 | Modify | run 문서 내용을 읽는 단언 | 문서 갱신으로 깨지는 단언만 맞춤(현재 light 문구 단언은 model tier 주석 `:268`뿐) | 사용자 확인 경로 |
| `test/subagents.test.js` | agent 설정 테스트 | Modify | agent 역할 해석 단언 | 깨지는 단언만 맞춤 | 사용자 확인 경로, 002가 같은 파일을 먼저 바꾼다 |
| `scripts/verify-complexity-run-docs.js` | 래퍼 | Create | 없음 | task 전용 검증 | `scripts/verify-light-preflight.js`와 같은 모양 |

#### Constraints

- 문서 형태 검사(`node scripts/check-doc-shape.js`)가 통과해야 한다. `review-round.md`·`verification-recovery.md`는 `RUN_OWNED_REFS`와 `runRefLink` 조건부 적재 계약(`doc-shape-contracts.ts:162`·`:168`)의 대상이므로 링크 문장과 trigger는 바꾸지 않는다. `agent-dispatch.md`의 나머지 H2 제목과 순서는 유지한다. `rules/cli.md` 거절 표의 필수 행(`final-review-single-round`, `final-review-repair-do-not-touch`)은 지우지 않는다.
- 삭제할 스크립트의 호출처가 없음을 `rg "verify-light-(preflight|worker-path|promotion|final-review|drive-metrics|run-docs)"`(여섯 이름만 쓴다. 넓은 `verify-light` 패턴은 쓰지 않는다)로 확인한 뒤 지운다(확인 결과를 worker 보고에 적는다).
- `rules/cli.md`의 model tier `light`(`--tier <strong|standard|light>`, `by_tier`) 줄은 바꾸지 않는다.
- `coordinate-next`·`skill-bouncer-run`·`subagents` 테스트는 확정 경로이지만 문서 갱신으로 실제 단언이 깨질 때만 고친다(`skill-bouncer-run.test.js`·`subagents.test.js`에는 현재 깨질 light 단언이 없다). 깨지지 않으면 파일을 바꾸지 않고 worker 보고에 적는다.
- 테스트 수정 규칙: light 문서를 전제한 단언은 새 문서 상태에 맞게 고치거나 지운다. `skill-bouncer-surface.test.js`는 `light-run.md` reference 목록과 light-run 어휘 테스트를 삭제된 파일 기준으로 바꾸고, `coordinate-next.test.js`는 agent-dispatch 문구 정규식을 새 문장에 맞춘다. 줄 번호로 범위를 고정하지 않고 바꾼 단언과 삭제한 테스트 이름을 worker 보고에 적는다.
- 테스트 이름은 `<조건> → <결과>` 형식을 지킨다.

### plugin-surface-slimming/complexity-declaration/004 · `aa502278`

#### Goal & intent

벤치마크 ACQ 응답기(`benchmarks/acp/responder.cjs`)가 `plan.complexity` 질문에 `standard` 선택지로 답하게 하고, 녹취된 `plan.light_scope` 질문(`fixtures/acq/cases.json`)은 지금처럼 재생하게 한다. 완료 조건은 새 gate의 응답 단언과 옛 gate의 재생 단언이 둘 다 통과하는 것이다. 검증 명령은 `node scripts/verify-complexity-acq-benchmark.js`다.

#### Current behavior

- 응답기의 plan 단계 정책 표는 `'plan.light_scope': ['full']`(`responder.cjs:95`)이고, 규칙 `plan.light_scope`가 선택지 중 `full|normal|일반|전체`를 고르고 `light|경량|--scale light`는 피한다(`responder.cjs:338`~`:343`). 게이트 식별은 `rules/acq-gates.json` 카탈로그로 하며(`responder.cjs:578`~`:586`) 카탈로그 밖 ID는 `unknown-gate` 위반이다(`:660`·`:683`).
- 002 뒤 카탈로그에는 `plan.light_scope`가 없고 `plan.complexity`가 있다. 응답기에는 `plan.complexity` 규칙이 없어 그 질문에서 멈춘다.
- 테스트 `responder.test.cjs`는 `plan.light_scope`로 순서 응답, 정책과 추천이 다른 응답, 블록 gate 식별, 카탈로그 밖 ID 위반을 단언한다. 과거 녹취 재생 테스트는 옛 ID(`plan.id_allocation`)를 재생 동안만 legacy gate로 카탈로그에 더하고 승인된 fastify-001 정책으로 답을 재생한다. 002가 이 정책의 `plan.light_scope` 항목을 `plan.complexity`로 바꾸므로, 손대지 않으면 `plan.light_scope` 질문을 담은 녹취 세 개(`plan-id-light-en.md`, `-2`, `-3`)가 정책 답을 찾지 못한다.
- 재현: `node --test benchmarks/acp/responder.test.cjs test/acq-gate-ids.test.js`. 이번 조사는 소스를 읽어 확인했고 통과 여부는 구현 시점에 확인한다.

#### Target behavior

- 성공
  - 정책 표에 `'plan.complexity': ['standard']`가 있고, 규칙 `plan.complexity`가 선택지 중 `standard|normal|일반|기본`을 고르며 `low|낮|경량`은 피한다. 정책 문서(002가 바꾼 `answer: standard`)와 같은 답을 낸다.
  - 옛 규칙 `plan.light_scope`와 정책 표 항목은 남는다(녹취 재생용). 주석이 "재생 전용"임을 적는다.
  - 테스트의 현재 gate 단언(순서 응답, 정책과 추천이 다른 응답, 블록 gate 식별)은 `plan.complexity`로 바뀐다. 카탈로그 밖 ID 위반 테스트는 바꾸지 않는다. 이 테스트는 제목 `Light scope`와 카탈로그 인자 `['plan.light_scope']`를 테스트 안에서 직접 넘겨(`responder.test.cjs:603`) 002의 `rules/acq-gates.json` 변경과 무관하게 `unknown-gate`가 나온다.
  - 녹취 재생 테스트는 `legacyIds`에 `plan.light_scope`를 `plan.id_allocation`과 함께 넣고, 재생에 쓰는 정책은 `fastifyPolicy`를 복사한 뒤 `bouncer_decisions`에 `{ gate: 'plan.light_scope', answer: 'full' }`을 더한 것이다(필요하면 `when` 한 줄을 붙인다). `plan-id-light-en.md`, `-2`, `-3` 세 case가 모두 reply `A / A`와 gate 목록 `['plan.id_allocation', 'plan.light_scope']`를 낸다. 승인된 정책 파일(`benchmarks/configs/*-evaluator-policy.json`)은 재생을 위해 바꾸지 않는다.
- 실패
  - `plan.complexity` 질문의 선택지에서 `standard`를 식별하지 못하면 `null`을 돌려 멈춘다(추측하지 않는다).
- 보존
  - 다른 gate의 규칙과 `fixtures/acq/cases.json`의 녹취 내용.
  - `benchmarks/configs/*-evaluator-policy.json`의 값(002가 바꿨다).

#### Interface

- 제공
  - 응답기 규칙 `{ gate: 'plan.complexity', phase: 'bouncer-plan', decide({ options }) }`와 정책 표 항목.
- 거부 (null 반환 목록)
  - `standard`로 식별되는 선택지가 없는 `plan.complexity` 질문은 응답하지 않는다.
- fallback
  - 없음.
- 용어: 선택지 식별은 선택지 label 문자열의 정규식 일치다(예: `Standard (Recommended)`는 `standard`에 일치).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/acp/responder.cjs` | 정책 표 `'plan.light_scope'`, 규칙 `plan.light_scope` | Modify | light_scope 질문에 full로 답함 | `plan.complexity` 항목과 규칙 추가, 옛 항목은 재생 전용 주석 | `responder.cjs:95`·`:338`~`:343` |
| `benchmarks/acp/responder.test.cjs` | plan.light_scope 단언들, 녹취 재생 테스트의 `legacyIds`·정책 | Modify | 옛 gate 응답 단언, 재생 정책 | 새 gate 단언, 재생에 `plan.light_scope` legacy gate와 복사 정책 추가 | 현재 gate 단언과 재생 테스트(`replays recorded ACQ` 루프) |
| `benchmarks/docker/README.md` | 응답기 설명의 "Light scope처럼" 문구 | Modify | 추천과 다를 수 있는 gate의 예로 Light scope를 듦 | `plan.complexity`로 바꿈(다른 서술은 유지) | `benchmarks/docker/README.md:128`, 사용자 동의 경로 |
| `scripts/verify-complexity-acq-benchmark.js` | 래퍼 | Create | 없음 | task 전용 검증 | `scripts/verify-light-preflight.js`와 같은 모양 |

#### Constraints

- 옛 `plan.light_scope` 규칙과 정책 표 항목을 지우지 않는다. 녹취 재생 테스트가 의존한다.
- 테스트 수정 규칙(파일 `benchmarks/acp/responder.test.cjs`): `plan.light_scope`를 현재 gate로 전제한 단언은 `plan.complexity`로 고치고, 재생 테스트는 위 Target대로 legacy gate와 복사 정책을 쓰게 바꾼다. 줄 번호로 범위를 고정하지 않는다. 새 기대값:
  - 순서 응답 테스트(`answers bundled discovery, light scope, and first ID blocks in order`): 이름 `answers bundled discovery, complexity, and first ID blocks in order`, 질문 `plan.complexity` 선택지 `['Low (Recommended)', 'Standard']`, 기대 reply `'A / B / A'`(Standard가 B), gate 목록 `['plan.discovery', 'plan.complexity', 'plan.id_allocation']`.
  - `keeps policy answers that differ from the recommendation`: 질문 `plan.complexity` 선택지 `['Low — narrow change (Recommended)', 'Standard — full review', '취소']`, 기대 reply `'B'`.
  - `a block gate selects the gate without wording hints`: 질문 `plan.complexity` 선택지 `['Standard plan (Recommended)', 'Low plan', '중단']`, 기대 reply `'A'`, `choices[0].gate`는 `'plan.complexity'`.
  - 카탈로그 밖 ID 위반(`unknown-gate`) 테스트의 `plan.light_scope` 단언은 바꾸지 않는다. 근거는 이 테스트가 제목 `Light scope`와 카탈로그 `['plan.light_scope']`를 직접 넘겨 002의 `plan.complexity` 변경과 무관하다는 점이다.
- 테스트 이름은 `<조건> → <결과>` 형식을 지킨다(`responder.test.cjs`는 기존 이름 형식을 따른다).

### plugin-surface-slimming/complexity-declaration/005

#### Goal & intent

네 구현 task가 모두 통합된 상태에서 저장소 CI와 같은 명령 `npm run ci`를 한 번 실행해 통과 증적을 남긴다. 증명하는 조건은 새 blueprint가 light를 선언할 수 없고, low와 standard의 리뷰 전략이 갈리며, 저장소 전체 검사(emit 일치, 버전 동기, 커버리지 포함 테스트, unit 계층, eslint, 문서 형태, 컨텍스트 주석, 타입, 테스트 이름, audit)가 통과하는 것이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령을 갖고 완료 전에 `npm run ci`도 통과시킨다. 이 task는 모든 구현 task가 통합된 뒤 한 번 더 실행하는 종단 증적이다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### plugin-surface-slimming/complexity-declaration/006 · `11ccb020`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- CT-001-CTX-RISK-DISPATCH (major, correctness_tests, must_fix) — test/context-review-state.test.js#표식 light blueprint의 dispatch 관점 목록 변조 — tasks/001 Checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/context-review-state.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.