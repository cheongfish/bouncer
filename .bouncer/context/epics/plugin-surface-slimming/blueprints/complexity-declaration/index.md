---
type: bouncer.blueprint
title: light 선언 제거와 복잡도 선언 통합
description: Remove the light scale and its dedicated path, and let the plan declare a complexity (low or standard) that only tunes review intensity on the one shared document and execution path.
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/complexity-declaration/index.md
tags:
  - bouncer
  - blueprint
  - complexity
  - light-removal
  - plan-gate
  - review-dispatch
  - coordinator-ledger
timestamp: '2026-10-30T14:09:24.550+09:00'
bouncer:
  id: complexity-declaration
  epic_id: plugin-surface-slimming
  blueprint_id: complexity-declaration
  status: closed
  order: 4
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  supersedes: []
---
# light 선언 제거와 복잡도 선언 통합

Epic: [플러그인 표면 간소화](../../index.md)

## Intent
- `scale: light`와 그 전용 경로(축약 문서 세트, 새 epic 금지, quiz 축소, promote-stop, light 원장)를 없애고 plan이 `complexity`(low|standard)를 선언해 리뷰 강도만 조절하게 바꿈.
- 신규 light 선언과 light 원장은 명시적인 거절 코드와 복구 안내로 막고, 닫힌 light 문서는 수정 없이 계속 읽히게 함.

## Contract
- 선언(작업 사이 계약). 001이 정의하고 002~004가 읽는다.

```text
bouncer.complexity?: 'low' | 'standard'     # 부재 = standard. scaffold는 standard를 명시해 쓴다 (001)
bouncer.scale: 'full'                        # 새 선언이 받는 유일한 값. 'light'는 닫힌 문서의 읽기 값 (001)
Ledger.mode / light_runner / promotion       # 새 원장은 쓰지 않는다. 옛 mode: light 원장은 거절하고 promotion 기록은 읽기만 (001)
```

- 인터페이스:
  - 001 CLI 전체(한 commit). 선언·구조 검사, plan gate·routing, 리뷰 강도, light 원장·승격 제거가 한 task다.
    - `scaffold blueprint`는 `--complexity low|standard`를 받는다(생략은 standard). `--scale full`은 옛 plugin 호환을 위해 받고, `--scale light`는 파일을 쓰기 전에 exit 2로 거절하며 `--complexity low`를 안내한다. light 전용 템플릿 세 개가 없어지고 모든 blueprint가 같은 5개 문서로 시작한다.
    - 구조 검사: 허용 밖 `complexity`는 S20, `complexity`가 `review_contract: brief` 없이 있으면 S38이다. `scale: light`가 닫히지 않은 blueprint(`closed`·`partial_closed` 외)에 있으면 S20이 거절하고 `/bouncer-plan` 재계획과 `complexity: low` 선언을 안내한다(status별 처리는 셋이다: `draft` 문서는 사용자가 `scale: full`과 `complexity` 선언으로 고친 뒤 plan gate를 다시 지난다(옛 light draft는 `review_contract: brief`(S38)와 완전한 task 본문도 갖춰야 gate를 지날 수 있다). `approved` 문서는 직접 고쳐 쓰지 않고 `/bouncer-plan`으로 다시 계획해 재승인을 받는다. 그 밖의 닫히지 않은 status(`superseded`·`imported` 등)는 새 blueprint slug로 다시 계획한다.). 닫힌 문서는 통과한다. plan 구조 해시는 `complexity: low`일 때만 blueprint 구조에 `complexity`를, 각 task 구조에 정렬된 `review_risk`를 싣는다(standard·부재와 기존 계획의 해시는 같다).
    - plan gate: G20의 light 분기와 `planScaleOf`가 없어지고 직렬 여러 commit task의 모양 제약은 두지 않는다. `plan approve`는 context review를 모든 blueprint에 요구한다. `plan inspect` routing의 `recommendation`은 `low-candidate`|`standard-candidate`이고 판정 조건(tasks>=2, dependencies>0, modules>=3, riskPaths)과 reasons는 그대로다.
    - plan 리뷰(표식 blueprint): low는 `verifiability` 한 관점이고 어느 commit task든 `review_risk`가 비어 있지 않으면 `risk_security`를 더한다(A1: 선언된 위험은 low에서도 지우지 않는다). standard는 4관점이다. delta 관점은 low `verifiability`, standard `combined`다(low의 delta는 `review_risk`가 있어도 `verifiability` 고정이 의도다. delta는 지난 지적의 해소 확인이고 `risk_security`는 전체 라운드가 맡는다). 표식 없는 blueprint의 `skip` 전략은 없어진다.
    - execute 리뷰: low는 diff 크기·task/최종 범위와 관계없이 `single`/`['combined']`이고 brief 최종 리뷰 관점(`spec_scope`·`correctness_tests`)을 쓰지 않는다. standard는 지금과 같다. 리뷰어 등급의 `REVIEWER_STRONG_MIN_TASKS`(commit task 3개 이상 → strong)는 standard에만 적용하고 `review_risk`·`review.min_reviewer_tier` 규칙은 그대로다. `reviewContractOf`는 scale로 접지 않아 low 최종 리뷰도 `review_contract` 값대로 repair 1회와 delta 1회를 받는다.
    - 원장: 새 `coordinate bootstrap`은 항상 full 원장(`mode`·`light_runner` 키 없음)을 만든다. `isLightEligible`과 `light-requires-serial`이 없어진다. `direct_eligible`은 scale을 보지 않고 `coordinator.direct_max_commit_tasks`(기본 3)를 그대로 쓴다. 최종 리뷰 상한은 `review_contract`로만 갈린다.
    - `light-mode-removed`: 원장 `mode: 'light'`는 task 상태(모두 integrated 포함)와 관계없이, blueprint `scale: 'light'`는 `run preflight`에서 닫히지 않은 경우만, `coordinate bootstrap`에서는 status와 무관하게 거절한다. 거절 위치는 `run preflight`, `coordinate bootstrap`, fence를 쓰는 모든 `coordinate` 변경(`repair` 포함), `coordinate next`·`advance`·`prepare`, `coordinate revise`이며 원장은 쓰기 전에 읽는다. 읽기 전용 `coordinate status`·finalize digest는 옛 원장을 지금처럼 읽는다. 복구 안내는 이전 CLI로 drive를 `/bouncer-finalize`까지 끝내기(drive만 끝내면 blueprint가 `approved`로 남는다) → 보존(`git worktree list`로 경로 확인, 커밋은 `git bundle`, 미커밋은 diff, gitignore된 `coordinator.json`은 복사) → 사용자 승인 → integration·worker worktree 폐기 → 재계획이며 재계획에는 조건이 붙는다. 같은 blueprint 디렉터리를 다시 실행하려면 승인을 받아 integration·worker 브랜치까지 지워야 하고(남아 있으면 bootstrap이 `branch-conflict`), 그렇지 않으면 새 blueprint slug로 재계획한다.
    - `light-ledger-legacy`·`light-inline-removed`·`light-implementer-record-missing`·`light-scope-revision-requires-promotion`·`ledger-mode-mismatch`가 없어진다. `coordinate promote-stop`과 `bootstrap --promote-light`는 호출하면 exit 2로 제거를 알리고 `/bouncer-plan`을 안내한다. `promotion-stopped` 거절과 승격 hint(`promote-*`·`promotion-*`)가 없어지고 원장·snapshot의 `promotion`·`promoted_from` 읽기는 유지한다.
  - 002 plan 문서: `plan.light_scope` ACQ가 `plan.complexity`로 바뀌고(카탈로그 `rules/acq-gates.json`과 벤치마크 평가 정책 5개의 gate 항목 포함), 추천은 discovery handoff와 `plan inspect` routing, 확정은 사용자다. `## Lightweight cycle`이 짧은 복잡도 절로 바뀌고 문서 100줄 예산·task 3절·새 epic 금지·quiz 1문항이 없어진다. `references/minimality/index.md`의 강도 매핑과 `references/discovery/index.md`의 light 안내도 complexity 기준으로 바뀐다.
  - 003 run 문서: `light-run.md`와 `scripts/verify-light-{preflight,worker-path,promotion,final-review,drive-metrics,run-docs}.js` 여섯 개가 없어지고(`agent-dispatch.md`의 H2 제목은 `Implement dispatch`로 바뀐다) `direct-run.md`·`agent-dispatch.md`·`rules/cli.md`가 complexity 기준으로 바뀐다. `review-round.md`(low 최종 리뷰는 `review_contract: brief`여도 single combined), `verification-recovery.md`, `docs/configuration.md`, `docs/install.md`, `config.example.json`의 light 서술도 정리하고 `drive-metrics.md`는 "light or full" 한 문장만 고치고(집계 설명은 유지), 문서와 복구 안내가 "새 CLI로 올리기 전에 진행 중 drive를 이전 CLI로 `/bouncer-finalize`까지 끝낸다"를 적는다.
  - 004 벤치마크 응답기(`benchmarks/acp/responder.cjs`)가 `plan.complexity`를 `standard`로 답한다. `benchmarks/docker/README.md`의 "Light scope" 예시도 `plan.complexity`로 고친다. 옛 gate id의 녹화 fixture는 승인된 정책 파일을 바꾸지 않고 재생 테스트의 legacy gate와 복사 정책으로 계속 재생한다.
- 데이터·상태:
  - 원장 `version`은 1이다. `mode`·`light_runner`·`promotion`·`promoted_from`은 옛 원장을 읽기 위한 선택 키로만 남는다. `mode: light` 원장은 새 CLI가 실행하지 않고 읽기 전용 경로(status, finalize digest)만 읽는다.
  - `scope.ts`·`commit-guard.ts`의 light 판정은 옛 원장을 읽는 경로라 그대로 둔다.
  - `drive_record.mode`·`promotion`과 `by_mode`·`promotions` 집계는 과거 기록을 위해 유지한다.
- 수용 기준(epic 기준 2의 "light 실행 통합" 조각 중 plan 선언·routing·문서 규칙):
  1. 새로 scaffold한 blueprint는 `complexity: standard`로 시작하고 `--complexity low`가 low를 쓴다. `--scale light`·허용 밖 `--complexity`는 파일을 쓰기 전에 exit 2다(001).
  2. 닫히지 않은 `scale: light` blueprint와 허용 밖 `complexity`는 구조 검사가 거절하고, 닫힌 light 문서는 수정 없이 구조 검사를 통과한다. 근거는 fixture 단언과 저장소의 닫힌 `scale: light` 문서를 실행 시점에 모두 순회하는 구조 검사 테스트다(개수 고정 없음, 001).
  3. 같은 입력에서 low와 standard의 리뷰 전략이 결정적으로 갈린다. plan 리뷰 관점 수 1(`review_risk` 선언 시 2) 대 4, execute 리뷰 `single` 대 크기 문턱(3 파일·200줄)에 따른 `single`/`parallel`, 리뷰어 등급의 task 수 문턱 유무, low의 plan digest가 commit task `review_risk` 변경에 따라 달라지고 standard는 같음(001).
  4. 직렬 commit task 2~3개 blueprint가 plan gate를 통과하고, complexity와 무관하게 `direct_eligible: true`가 나온다(001).
  5. `mode: light` 원장은 task 상태와 관계없이 위 위치마다 `light-mode-removed`와 복구 안내(이전 CLI로 finalize까지 끝내기 → 커밋·원장 보존 → 승인 뒤 worktree 폐기 → 재계획)를 내고, 읽기 전용 경로는 옛 원장을 읽는다(001, 003).
  6. `promote-stop`·`--promote-light`를 호출하면 exit 2다. 승격을 쓰는 코드와 `promote-*`·`promotion-*` hint가 남지 않는다. 이미 기록된 `promotion`·`promoted_from`을 읽는 타입과 집계는 남는다(001).
  7. 계획·실행·finalize 문서에 `scale: light`·`plan.light_scope`·`light-run.md` 안내가 남지 않는다(minimality·discovery·review-round·verification-recovery·설정·설치 문서와 `config.example.json` 포함. 닫힌 기록의 읽기 값을 설명하는 `rules/planning.md`·`rules/document-schema.md`는 예외). model tier `light`(`strong|standard|light`)는 영향이 없다(002, 003).
- 검증 명령: 001 `node scripts/verify-complexity-declaration.js`(CLI 변경 전체의 관련 테스트 파일 전체 실행), 002 `node scripts/verify-complexity-plan-docs.js`, 003 `node scripts/verify-complexity-run-docs.js`, 004 `node scripts/verify-complexity-acq-benchmark.js`. 종단 005는 저장소 CI와 같은 `npm run ci`다(`.github/workflows/test.yml`이 실행하는 유일한 명령). 구현 task는 각자 전용 명령 뒤에 `npm run ci`도 통과시킨다.
- 실패 모드·엣지 케이스:
  - 닫히지 않았지만 승인된 light blueprint가 하나 있다. `drive-execution/worker-lint-check`가 `status: approved`, `scale: light`다. 001의 구조 검사는 이를 거절하므로 001이 이 문서의 status를 `closed`로 한 줄 바꿔 거절 대상에서 뺀다(PR #284 병합 문서, 사용자 확인). `scale: light` 값은 그대로 읽힌다.
  - 옛 plugin과 새 CLI: 옛 plan 문서가 `scaffold --scale light`를 부르면 exit 2와 안내가 나온다. 옛 run 문서가 light 원장을 다루면 `light-mode-removed`가 나오고, 없어진 `promote-stop`은 exit 2다. 새 CLI로 올리기 전에 진행 중 drive는 이전 CLI로 `/bouncer-finalize`까지 끝낸다(drive만 끝내면 blueprint가 `approved`로 남아 S20이 막는다).
  - 새 plugin과 옛 CLI: 옛 CLI는 알 수 없는 `--complexity`를 조용히 무시하므로 scaffold 뒤 `index.md`에 `complexity` 키가 있는지 plan 문서가 확인하고, 없으면 CLI 갱신을 안내하며 멈춘다. 옛 CLI는 알 수 없는 키를 standard 동작으로 읽으므로 low 선언이 더 약한 리뷰로 번지지 않는다.
  - `complexity: low`인 계획에 `review_risk`가 있으면 plan 리뷰의 `risk_security` 관점, execute 리뷰의 `security` 관점, strong 등급이 그대로 붙는다. 001이 low + `review_risk: [credential]` + 큰 diff가 task·최종 범위 모두 `single`, `['combined','security']`, strong 등급임을 단언한다(delta는 `combined`로 접혀 `security`가 붙지 않는다).
  - 경로 수·task 수로 complexity를 추론하지 않는다. 추천은 참고이고 선언은 사용자 몫이다.

## Out of scope
- 복잡도 자동 신호와 문턱 재조정(공통 신호 계산, 위험 경로·크기·모듈 기준, `complexity.*` 설정). 복잡도 판정 클러스터의 몫이다. routing 조건 값은 바꾸지 않는다.
- 후속(복잡도 판정 클러스터): `complexity: low` 계획에서 `review-risk-missing` 경고가 있거나 `riskPaths>0`이어도 `risk_security` 관점이 자동으로 붙지 않는다(`review_risk`를 선언했을 때만 붙는다). 자동 신호는 이 BP 범위 밖이고 사용자 결정으로 disposition은 accepted다. 이 BP는 plan 리뷰·gate·task를 이 때문에 바꾸지 않는다.
- full 리뷰의 task 수 문턱 제거, 모듈·위험 경로 기준 변경
- light 범위 정책("금지선만 block") 시험. `scope.ts`·`commit-guard.ts`는 바꾸지 않는다.
- 끝난 옛 light 원장을 새 CLI로 계속 실행하는 호환(이전 CLI로 끝내는 것이 정상 경로다), `coordinate repair`가 옛 원장의 `mode`를 지워 잇는 변환
- `drive_record`·`by_mode`·`promotions` 집계와 `scripts/measure-drive-records.js`, finalize digest의 light 생략. 과거 기록을 읽는 경로라 유지한다.
- 닫힌 blueprint 문서와 `.bouncer/context` 과거 기록의 수정. 예외는 하나다: 001이 `drive-execution/worker-lint-check/index.md`의 `status: approved`를 `closed`로 바꾸는 한 줄(PR #284 병합 완료, 사용자 확인). 이 문서의 다른 줄과 explain.md는 바꾸지 않는다.
- 승인된 벤치마크 평가 정책 파일의 재생용 수정. 002가 gate id를 `plan.complexity`로 바꾸는 한 번뿐이다.
- 매니페스트 `runtimeCompatibility`·버전 필드·CHANGELOG 수정, 제안서 문서 커밋, `packages/cli/dist`·`scripts/lib` 생성물 편집. 새 plugin이 새 CLI(`--complexity`)를 요구하게 되는 `runtimeCompatibility`는 바꾸지 않고 PR handoff 본문에 메모로 남긴다.
- model tier `light`(`subagent-model --tier`, `metrics end --tier`)

## One-commit justification
- 구현 task마다 `scripts/verify-<name>.js` 래퍼를 둔다. task 전용 검증이 빌드(`packages/cli/dist`)를 먼저 만들고 해당 테스트·eslint·테스트 이름 규칙을 한 argv로 돌려야 하는데, 직접 `node --test`만 쓰면 빌드가 빠지기 때문이다. 이 convention은 #301의 `scripts/verify-light-*.js`와 같다. 001의 래퍼는 CLI 변경 전체를 덮으며 이름은 선언 task의 것을 유지한다.
- 네 commit task는 제안서 7장의 두 번째 결론 하나를 구현한다. 결론은 "light 선언과 전용 경로를 없애고 같은 문서·실행 경로 위에서 복잡도 선언이 리뷰 강도만 조절한다"이다. 한 PR에서 같은 근거로 리뷰한다.
- CLI 변경을 001 한 commit으로 합친 이유는 각 task 뒤에 `npm run ci`가 통과해야 하기 때문이다. 구조 검사 S20이 닫히지 않은 `scale: light`를 거절하면 light fixture를 쓰는 `review-dispatch`·`plan-approve`·`finalize` 테스트가 같이 바뀌어야 하고, bootstrap이 light를 거절하면 light 원장을 bootstrap으로 만들던 `coordinator`·`run-preflight`·`cli-coordinate`·`commit-task` 테스트가 같이 바뀌어야 한다. 모든 reason 리터럴에 hint를 요구하는 테스트 때문에 코드 제거와 hint 제거도 한 commit이고, `schema.ts`·`validate-structural.ts`·`cli-usage.ts`·`cli-help.test.js`처럼 여러 조각이 같은 파일을 나눠 고친다. 따로 두면 두 task 사이에 깨진 테스트가 남는다.
- 002는 001이 정한 동작을, 003은 001·002가 정한 동작을 문서로 맞춘다. 두 task가 `doc-shape-contracts.ts`와 `skill-bouncer-surface.test.js`를 나눠 쓰므로 직렬이다. 004는 002가 정한 ACQ id를 따르며 003과 경로가 겹치지 않는다.
