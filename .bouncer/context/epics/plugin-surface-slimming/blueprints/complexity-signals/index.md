---
type: bouncer.blueprint
title: 복잡도 신호 계산 통합과 리뷰 문턱 재조정
description: Compute complexity signals (risk, module breadth, source size, serial shape) in one shared module from expected paths or the actual diff, retune the review and routing thresholds behind complexity config keys, and record review strategy and reviewer tier in drive_record.
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/complexity-signals/index.md
tags:
  - bouncer
  - blueprint
  - complexity
  - review-dispatch
  - plan-inspect
  - drive-record
timestamp: '2026-10-31T13:53:32.223+09:00'
bouncer:
  id: complexity-signals
  epic_id: plugin-surface-slimming
  blueprint_id: complexity-signals
  status: closed
  order: 5
  commit_type: feat
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  supersedes: []
---
# 복잡도 신호 계산 통합과 리뷰 문턱 재조정

Epic: [플러그인 표면 간소화](../../index.md)

## Intent
- 위험·모듈 폭·소스 크기·직렬 여부를 공용 모듈 하나가 계산하고, `plan inspect` routing과 `review-dispatch`가 그 결과만 소비하게 하며 문턱을 소스 파일 기준 값으로 `complexity.*` 설정에 둠.
- 리뷰 전략(single/parallel)과 리뷰어 등급을 `drive_record`에 남겨 이후 문턱 재조정의 근거로 삼게 함.

## Contract
- 신호와 정책(작업 사이 계약). 001이 정의하고 003~004가 읽는다.

```text
SignalFile       = { path: string, lines?: number }        # plan 시점은 lines 없음
ComplexitySignals = {
  totalFiles, sourceFiles: number, sourceLines: number | null,
  modules: string[],                                        # packages/<name>은 패키지별 모듈
  riskPaths: { path, kind: 'security'|'manifest'|'build'|'migration'|'repo' }[],
  serial: boolean | null,                                   # drive_shape가 'serial'이면 true, parallel|mixed면 false, 없음·unknown이면 null
}
ComplexityPolicy = { singleMaxSourceFiles: 2, singleMaxSourceLines: 200,   # 기본값, config.ts가 소유
  strongMinSourceFiles: 8, strongMinModules: 4, strongMinTotalFiles: 11,
  riskPaths: string[], generatedPaths: string[] }
computeComplexitySignals({ files, driveShape?, policy: ComplexityPolicy }) -> ComplexitySignals  # 순수, I/O 없음. policy.riskPaths·generatedPaths만 읽는다
```

- 모듈 경계: 정책 타입(`ComplexityPolicy`)·기본값·판독기(`readComplexityPolicy`)는 `config.ts`가 소유한다. `complexity-signals.ts`는 정책을 인자로 받고 그 타입을 `import type`으로만 가져오며(컴파일 때 지워지고 모듈 그래프 간선이 아니다) 런타임에는 `node:path` 외에 아무것도 require하지 않는다. `config.ts`는 `complexity-signals.ts`를 import하지 않는다(타입 포함). 정책 모양의 사본 타입은 만들지 않는다. 소비자(`plan-inspect.ts`, `review-dispatch.ts`)가 둘을 잇는다.

- 인터페이스:
  - 001 공용 모듈 `complexity-signals.ts`와 설정. 소스 판정·모듈 규칙·생성물 판정·위험 경로 규칙(일반 + 저장소 고유)을 한곳에 두고 `config.ts`가 정책 기본값과 `complexity.*` 판독기를 갖는다. 설정 키 일곱 개는 `complexity.single_max_source_files`(2), `single_max_source_lines`(200), `strong_min_source_files`(8), `strong_min_modules`(4), `strong_min_total_files`(11), `risk_paths`(bouncer 기본 목록), `generated_paths`(`scripts/lib/`, `.codex/agents/`, `packages/cli/dist/`)다. 001은 `plan-inspect.ts`의 위험 경로 분류만 옮기고 `summarizeRouting` 출력은 바꾸지 않는다.
  - 002 리뷰 snapshot이 파일별 변경 줄 수를 싣는다. 실제 diff에서 소스 줄 수를 구하는 유일한 입력이다.
  - 003 `plan inspect` routing이 `tasks >= 2`와 `dependencies > 0` 트리거 없이 `modules >= strong_min_modules`와 위험 경로만으로 `standard-candidate`를 낸다. `plan-inspect.ts`의 옛 모듈 계산(`collectModules`, `MODULE_EXCLUDED`)을 공용 신호로 갈아 끼우는 전환도 이 task에서 한다. `/bouncer-plan` 추천 문구가 이 기준을 가리킨다.
  - 004 `review-dispatch`가 신호 결과로 execute single/parallel과 plan·execute 리뷰어 등급을 정한다. `REVIEWER_STRONG_MIN_TASKS`와 `EXECUTE_SMALL_MAX_FILES`·`EXECUTE_SMALL_MAX_LINES`가 없어진다. 정책이 기본값과 다르면 payload `reasons`에 적용된 값을 싣는다. `review.min_reviewer_tier` 검증과 `complexity.*` 검증은 snapshot 수집 전에 끝난다.
  - 005 `coordinate worker-model`이 reviewer 기록에 `--strategy`와 `--reviewer-tier`를 받는다.
  - 006 `drive_record.reviewer`가 `strategies`와 `tiers`를 싣는다.
- 판정 규칙:
  - single 조건(standard): `sourceFiles <= 2`이고 `sourceLines <= 200`이며 위험 신호(`review_risk` 또는 위험 경로)가 없다. 하나라도 어긋나면 parallel이다. `complexity: low`는 크기와 무관하게 single이다.
  - `security` 관점: `review_risk`가 있거나 `kind 'security'` 위험 경로(`src/auth/…` 등)가 있으면 non-brief 리뷰에 붙는다. `manifest`·`build`·`migration`·`repo` 경로는 parallel·strong만 만들고 `security`를 붙이지 않는다. brief 최종 리뷰의 관점 규칙과 delta 접기는 그대로다.
  - strong 조건: `review_risk` 있음, 위험 경로 있음, `sourceFiles >= 8`, `modules >= 4`, `totalFiles >= 11`, `review.min_reviewer_tier: strong` 중 하나. `complexity: low`는 크기 세 조건을 평가하지 않고 위험 두 조건과 설정 하한은 그대로 평가한다.
  - routing `standard-candidate`: `modules >= strong_min_modules` 또는 위험 경로. `tasks`·`dependencies` 값은 출력에 남지만 판정과 `reasons`에서 빠진다.
- 데이터·상태:
  - 소스 파일은 확장자와 무관하게 다음이 아닌 파일이다. 저장소 루트 또는 `packages/<name>/` 바로 아래 `test/`·`tests/`·`docs/` 안의 파일, `.bouncer/context/` 아래 파일, 파일명이 `<이름>.test.<확장자>`·`<이름>.spec.<확장자>`인 파일, 파일명이 대소문자 무관하게 `README`·`CHANGELOG`이거나 `README.`·`CHANGELOG.`로 시작하는 파일. 더 깊은 `src/test/`·`src/docs/`와 `rules/*.md`·`package.json`은 소스다(경계 표는 001). `.bouncer/context/`의 계획 문서는 소스·모듈 수에 들어가지 않지만 `totalFiles`에는 들어간다.
  - 생성물은 `complexity.generated_paths`(저장소 루트 기준 디렉터리 접두, 기본 `scripts/lib/`, `.codex/agents/`, `packages/cli/dist/`) 아래 파일이다. 크기 수치(`totalFiles`, `sourceFiles`, `sourceLines`, `modules`)에서만 빼고 위험 경로 평가에는 포함한다.
  - 모듈은 소스이고 생성물이 아닌 파일의 첫 경로 조각이고 `packages/<name>/…`는 `packages/<name>`(`packages/foo.ts`는 `packages`)이다. `.bouncer`와 루트 파일은 모듈이 아니다.
  - 위험 경로는 소스 여부와 무관하게 모든 변경 파일에 적용한다. 테스트·설정만 바뀐 변경도 위험 신호를 평가해야 하기 때문이다.
  - 문턱 값에는 상한을 두지 않는다. 대신 정책이 기본값과 다르면 `review-dispatch` plan·execute payload의 `reasons`에 `complexity policy non-default: <키>=<값>; …`(`risk_paths`·`generated_paths`는 `<키>=custom(<개수>)`, 두 배열은 순서를 무시하고 기본 목록과 비교)를 싣고 테스트로 고정한다. 문턱을 올려 리뷰를 약하게 만든 설정이 payload에 드러나게 하기 위해서다.
  - 설정 `complexity.risk_paths`는 기본 목록을 대체하며 일반 위험 규칙(security·manifest·build·migration)에 더해진다. 기본 목록은 `commit-guard*`, `commit-hook*`, `hooks/`, `AGENTS.md`, `rules/acq-gates.json`, `validate-gates*`, `coordinator-ledger*`, `guards.ts`다. 패턴은 basename(`/` 없음, `*` 허용)·디렉터리(`/`로 끝남, 경로의 디렉터리 조각 안에 연속으로 나타나면 맞음)·정확 경로(`/` 포함, `*` 불가) 세 꼴이다.
  - 원장 reviewer `worker-model` 결정에 선택 키 `strategy`(`single`|`parallel`)와 `reviewer_tier`(`standard`|`strong`)가 생긴다. 키가 없는 옛 결정은 그대로 읽힌다.
  - `drive_record.reviewer`에 정렬·중복 제거된 `strategies`·`tiers` 문자열 배열이 생긴다. 키가 없는 옛 snapshot은 계속 `isDriveRecord`를 통과한다.
- 수용 기준(epic 기준 2의 "복잡도 판정" 조각):
  1. 같은 `computeComplexitySignals`가 plan 시점(예상 경로)과 실행 시점(diff 경로·줄 수)의 입력을 받는다. `rg -n "SECURITY_SEGMENTS|MANIFEST_EXACT|MODULE_EXCLUDED|classifyOnePath" packages/cli/src`가 `complexity-signals.ts`에서만 hit이고 `plan-inspect.ts`·`review-dispatch.ts`에는 0건이다. 001 뒤에는 `MODULE_EXCLUDED`만 `plan-inspect.ts`에 남고 003 뒤에는 `plan-inspect.ts`가 0건이며, 004 체크리스트가 최종 명령을 돌린다(001, 003, 004).
  2. 소스 파일 2개·소스 줄 200 이하이고 위험 신호가 없는 standard diff는 `single`이고, 소스 파일 3개나 소스 줄 201, 또는 위험 신호가 하나라도 있으면 `parallel`이다. 테스트·문서만 늘어난 diff는 소스 파일 수에 들어가지 않는다(002, 004).
  3. 리뷰어 등급은 commit task 수와 무관하다. 소스 파일 8개, 모듈 4개, 전체 파일 11개, 위험 경로, `review_risk` 각각이 단독으로 strong을 만들고 그 아래 값은 standard다(004).
  4. `packages/cli`와 `packages/web` 같은 workspace 패키지는 별도 모듈로 세고, 모듈 4개부터 routing이 `standard-candidate`를 낸다. 직렬 의존이 있는 두 task만으로는 `low-candidate`다(001, 003).
  5. `.bouncer/config.json`의 `complexity.*` 값이 문턱·위험 경로 목록·생성물 경로 목록을 바꾸고, 잘못된 값(범위 밖 문턱, 조용히 안 맞는 패턴 꼴 포함)은 `review-dispatch`가 snapshot 수집·git 호출 전에 `complexity-config-invalid`로 거절하며 `plan inspect`는 기본값으로 계속하고 `routing.reasons`에 같은 사유를 남긴다. 두 설정이 모두 틀리면 `review-min-reviewer-tier-invalid`가 먼저다(001, 003, 004).
  6. coordinator가 `--strategy`·`--reviewer-tier`를 기록하면 `drive_record.reviewer.strategies`·`tiers`에 나타나고, 기록이 없으면 빈 배열이다(005, 006).
  7. 다음 세 명령이 기대대로다(003, 004). `rg -n "REVIEWER_STRONG_MIN_TASKS|EXECUTE_SMALL_MAX" packages/cli/src test`는 0건, `rg -n "commit task count" packages/cli/src`는 `review-dispatch.ts`의 plan 전략 사유 `commit task count N — single combined reviewer`(plan `task_count`용, 등급 판정이 아님) 한 곳만 hit, `rg -n "task 수 문턱|task-count|commit task 3개|tasks >= 2|dependencies > 0" docs rules skills agents references`는 0건이다.
  8. 정책이 기본값과 다르면 plan·execute payload `reasons`의 등급 사유 바로 뒤에 `complexity policy non-default: …`가 실리고, 기본값(배열은 순서 무관)이면 실리지 않는다(004).
  9. 위험 경로만 있고 `review_risk`가 없는 diff는 parallel·strong이고, `kind 'security'` 경로면 `security` 관점이 붙으며 그 밖의 경로 종류에는 붙지 않는다. 생성물만 바꾼 diff는 크기 근거가 없고(`sourceFiles 0`) 생성물이 위험 경로에 해당하면 위험 근거만 남는다(004).
- 검증 명령: 001 `node scripts/verify-complexity-signals-core.js`, 002 `node scripts/verify-complexity-signals-snapshot.js`, 003 `node scripts/verify-complexity-signals-plan.js`, 004 `node scripts/verify-complexity-signals-review.js`, 005 `node scripts/verify-complexity-signals-worker-flags.js`, 006 `node scripts/verify-complexity-signals-drive-record.js`. 각 래퍼는 빌드 → typecheck → (문서를 바꾸는 task는 문서 형태 검사) → 해당 테스트 → eslint → 테스트 이름 규칙 → context-comments 검사 순으로 돈다. 종단 007은 `npm test`다.
- 실패 모드·엣지 케이스:
  - 소스이고 생성물이 아닌 파일 중 하나라도 `lines`가 없으면(plan 시점) `sourceLines`는 `null`이다(일부만 있어도 부분합을 내지 않는다). 소스 파일이 하나도 없으면 `lines` 유무와 무관하게 `0`이다. `lines`가 음수·비정수이면 없음이 아니라 0줄이다. single 조건은 줄 수를 모르면 만족하지 않고 plan 시점에는 쓰이지 않는다.
  - 파일의 줄 수는 추가+삭제 줄 합이다. 삭제된 소스 파일은 파일 수와 줄 수에 들어간다. binary 파일의 줄 수는 0이다.
  - 문턱 값이 정수가 아니거나 범위(`single_*`는 0 이상, `strong_min_*`는 1 이상) 밖이면 설정 오류다. 범위 안의 값은 아무리 커도 받는다(상한 없음, 적용 값은 `reasons`로 드러난다).
  - 위험 경로 패턴이 절대 경로·`..`·역슬래시·빈 문자열·`./` 시작·앞뒤 공백·`*`/`/`만의 값·빈 조각·`/`가 있는 패턴 안의 `*`이면 설정 오류다(안 맞는 패턴으로 조용히 남기지 않는다). `generated_paths` 항목은 `/`로 끝나는 `*` 없는 접두여야 한다. `risk_paths: []`는 저장소 고유 목록을 끄겠다는, `generated_paths: []`는 생성물 제외를 끄겠다는 명시적 선언으로 읽는다.
  - snapshot에 파일별 줄 수가 없는 옛 artifact는 `review-dispatch`가 쓰지 않는다. dispatch는 매번 새 snapshot을 만들기 때문이다.
  - `affected_paths`가 비어 있는 계획의 plan 시점 신호는 모두 0이다(`sourceLines`도 0). routing은 지금처럼 `affected-paths-empty` 근거만 남긴다(plan 리뷰어 등급 계산은 빈 `affected_paths`를 S7이 먼저 거절하므로 이 경우를 다루지 않는다).
  - `serial`은 참고 출력이다. 어떤 판정(routing 추천, 전략, 등급)도 `serial`을 읽지 않고 소비자는 사람이 읽는 `plan inspect` 출력뿐이다.
  - 알려진 잔여 위험(수용 후보): 문턱에 상한을 두지 않으므로 `.bouncer/config.json`을 고치는 변경이 `complexity.*`를 올려 리뷰를 약하게 만들 수 있다. 그 변경을 리뷰하는 같은 dispatch가 고친 값으로 판정한다. 완화는 적용된 비기본 정책을 payload `reasons`에 싣고 테스트로 고정하는 것(수용 기준 8)뿐이며, 설정 diff를 위험 경로로 다루거나 하한을 두는 처리는 하지 않는다.

## Out of scope
- 승격 정책. light가 #303에서 없어져 승격 대상이 없다.
- `coordinator.direct_max_commit_tasks`(3 유지)와 direct-run 자격 판정.
- 리뷰 효과 측정, 결합 경로(`coupledPaths`) 탐지 변경, 일반 위험 규칙(security·manifest·build·migration)의 목록 변경.
- 제안서 문서(`PLUGIN-SURFACE-SLIMMING-PROPOSAL.md`)의 커밋과 참조. 미커밋 파일이며 근거 수치는 이 blueprint와 task 본문에 옮겨 적었다.
- 문턱 값의 상한·하한 검증, `.bouncer/config.json` 변경을 위험 경로로 다루는 처리, `risk_paths` 기본 목록의 프로젝트별 분리. 기본 목록은 코드 기본값이며 다른 저장소는 `complexity.risk_paths`로 바꾼다.
- `brief` 최종 리뷰의 관점 고정 규칙, plan 리뷰 관점(`verifiability` 등) 선택, delta 접기.
- `packages/cli/dist`·`scripts/lib` 생성물 편집, 매니페스트 버전과 CHANGELOG 수정, 닫힌 blueprint 문서의 수정.

## One-commit justification
- 여섯 구현 task는 하나의 결정을 구현한다. "신호 계산을 한곳에 모으고 문턱을 소스 기준 설정값으로 바꾸며 그 결과를 기록한다"이고 한 PR에서 같은 근거로 리뷰한다.
- 공용 모듈(001)을 먼저 두는 이유는 003·004가 같은 함수를 소비해야 판정 기준 복사본이 다시 생기지 않기 때문이다. snapshot 줄 수(002)는 004의 유일한 입력이라 따로 떼어 001과 병렬로 둔다. 기록 쪽 005는 004가 정한 payload 값(`strategy`, `reviewer_tier`)을 그대로 옮기므로 004 뒤에 오고, 006은 005가 정한 결정 키를 집계하며 `rules/cli.md`를 003~005와 나눠 고치므로 마지막에 직렬이다. 001과 002는 경로가 겹치지 않아 한 wave에서 병렬이다.
- 각 task 뒤에 저장소 CI가 통과해야 하므로 판정 기준을 바꾸는 코드와 그 기준을 단언하는 테스트·문서 서술은 같은 task에 둔다. 003은 routing 코드·테스트·SKILL 문구를, 004는 review-dispatch 코드·테스트·설정 도움말·규칙 문서를 함께 바꾼다.
- 구현 task마다 `scripts/verify-complexity-signals-<part>.js` 래퍼를 둔다. task 전용 검증이 빌드(`packages/cli/dist`)를 먼저 만들고 테스트·typecheck·eslint·테스트 이름 규칙을 한 argv로 돌려야 하기 때문이며, 같은 convention이 `scripts/verify-complexity-*.js`에 있다.
