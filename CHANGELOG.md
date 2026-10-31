# Changelog

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르고,
버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

릴리스 태그는 `claude plugin tag`가 만드는 `bouncer--v<version>` 형식입니다.

이전 내부 버전(1.x 이하) 이력은 npm 공개를 앞두고 버전을 0.1.x로 다시 시작하면서 이 파일에서
정리했습니다. 필요하면 git 이력에서 확인하세요.

## [Unreleased]

## [0.1.17]

Runtime and plugin release. Plugin `0.1.14` requires this runtime through
`runtimeCompatibility: ">=0.1.17 <0.2.0"`.

### Added

- `coordinate worker-tokens`가 이미 채워진 키의 두 번째 기록을 `worker-tokens-duplicate`로 거절하고,
  정정은 `--replace`로 가장 나중 기록을 바꾸는 한 경로로만 받습니다 (#305).
- `coordinate advance`가 `--task` 없이 불려도 모든 task의 구현자 `worker-tokens` 누락을 거절합니다 (#306).
- 복잡도 신호 계산을 공용 모듈로 모으고, plan routing과 리뷰 전략·리뷰어 등급 판정이 같은 기준을 쓰게 합니다.
  `drive_record`가 리뷰 전략과 리뷰어 등급을 집계합니다 (#304).
- 작업자 토큰 기록 누락을 기록과 진행 단계에서 거절하고, 미보고 기록(`unreported`)을 허용합니다 (#300).
- full drive의 예상 경로 이탈 기록과 금지선 차단, 병렬 충돌 회복 계약을 추가합니다 (#299).
- 검증 실패 증적에 마지막 100줄 밖에 있는 실패한 테스트 이름을 모아 붙입니다.
- 코딩 표준에 `Test review` 질문과 작업 유형별 실행 증거를 추가하고, planner·reviewer·plan 문서
  리뷰어가 같은 테스트 기준을 따르게 연결합니다.

### Changed

- `light` 선언을 없애고 복잡도 선언(`bouncer.complexity`)으로 통합합니다. light 실행 경로와
  직접 실행 경로를 단일 run 절차로 합칩니다 (#301, #303).
- 범위 개정이 기본으로 직전 범위에 더하도록 바꾸고, repair 검증 명령 정책과 PR 초안 필수 절을
  보강합니다 (#296, #302).
- 회고 절차를 finalize reference로 옮기고, 결합 경로 탐지와 계획 초안·경로 확인 단계를 분리합니다
  (#295, #297, #298).
- 구현자 `## Tests` 낱말 제약, 구현자 `worker-model` 기록 값, `metrics end`의 중간 알림 금지를 문서로
  명시합니다 (#306).
- 계약 검사를 제외한 테스트를 삭제하고 `test:coverage`의 줄·분기·함수 임계값을 제거합니다.

### Fixed

- `sync:versions`와 `check:versions`가 루트 `plugin.json`의 `runtimeCompatibility`를 host manifest
  세 곳(`.claude-plugin`, `.codex-plugin`, `.cursor-plugin`)과 맞춥니다. plugin `0.1.13`은 이 값이
  `>=0.1.14`로 게시됐고, plugin `0.1.14`부터 `>=0.1.17`로 바로잡힙니다.
- 역할 모델 안내와 provider 검증, Codex 역할 effort 동기화, 빈 metrics blueprint 거절을 바로잡습니다 (#294).
- `cli-coordinate` 테스트가 플러그인 설치본 없이도 계약 카드를 읽도록 자산 루트를 고정합니다.

## [0.1.16]

Runtime and plugin release. Plugin `0.1.13` requires this runtime through
`runtimeCompatibility: ">=0.1.16 <0.2.0"`.

### Added

- 역할 모델 등급(strong/standard/light)과 effort 해석을 추가합니다 (#281).
- 적대적 리뷰와 리뷰어 등급 자동 상향을 추가합니다 (#283).
- implementer가 보고 전에 변경 파일에 eslint를 실행하는 절차를 추가합니다 (#284).
- plan 세션을 등급별로 측정하는 기반과 plan coordinator·planner 위임 구조를 추가합니다 (#286, #287).
- 신규 테스트 tier 등록을 확인하는 plan gate와 task 검사 래퍼를 추가합니다 (#288).
- 무트레일러 worker 커밋을 차단하고 `coordinate uncommit`으로 복구합니다 (#290).

### Changed

- run의 진행 판별을 완료 task 개수가 아니라 task id 집합 비교로 바꾸고, coordinator 판정 규칙과
  implementer fixture 고정 안내를 보강합니다 (#291).
- 계획 승인 전에 root가 finding ID·처분·note와 accepted-risk 근거를 보여 주고 ID별 동의를 받습니다.
  `nesting-unavailable` fallback 절차를 구체화합니다 (#292).

### Fixed

- 훅 실행 비트에 의존하지 않도록 고치고 plan 버전 문서를 보호합니다 (#282).
- resume 시 이전 세대 worker report를 보존합니다 (#285).
- strong 매핑이 `inherit`일 때 리뷰어 등급이 적용되지 않음을 보고합니다 (#289).
- 리뷰 오류 코드·timeout·보고서 보존 실패 경로의 테스트와 복구 안내 문서를 보강합니다 (#292).

## [0.1.15]

Runtime-only release. Plugin `0.1.12` supports this runtime through
`runtimeCompatibility: ">=0.1.14 <0.2.0"`.

### Fixed

- `release` 브랜치에서 `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.agents/`가
  빠져 Claude marketplace 등록이 실패하던 문제를 고칩니다. release workflow가 숨김 파일을
  artifact에 포함하고, 게시 전에 `.claude-plugin/marketplace.json`을 확인합니다.

## [0.1.14]

### Added

- Runtime `0.1.14`의 plan·execute 성공 payload에 `agent_dispatch` 설정 메타데이터를 기록합니다.
- Claude Agent 훅이 Bouncer의 다섯 named 역할에 설정 모델을 적용하고, 변경 사항을 사용자에게 알립니다.

### Changed

- Plugin `0.1.12`은 runtime 호환 하한을 `0.1.14`로 올리고, 호환 범위 기준으로
  plugin과 runtime version을 판정합니다.
- 명시 모델을 호스트가 거절하면 상속 모델로 재시도하지 않고 해당 호출을 중단합니다.
- Review finding은 revise 전에 기록해 수정 결정의 근거를 보존합니다.

## [0.1.13]

Runtime-only release. Plugin `0.1.11` supports this runtime through
`runtimeCompatibility: ">=0.1.11 <0.2.0"`.

### Added

- Global npm installation registers the npm executable directory in the user PATH.

## [0.1.10]

npm 첫 공개 버전입니다. plugin 버전도 같은 `0.1.10`으로 시작합니다.

### Added

- **npm runtime 패키지 `@cheongfish/bouncer`** — `bouncer`와 `bouncer-root` 실행 파일을 제공합니다.
  plugin 저장소는 skills, rules, subagents 같은 asset만 담고 CLI는 담지 않습니다. 같은 버전의 runtime과
  plugin을 설치해야 합니다.
- **드라이브 토큰·시간 표 보고 제어** — `bouncer metrics summary`가 `report` 필드를 내고,
  `BOUNCER_METRICS_REPORT=1`일 때만 run·finalize가 표를 사용자에게 보고합니다. 기록은 항상 남습니다.

### Fixed

- context index 템플릿 주석의 예시 링크를 `validate`가 없는 epic으로 읽던 문제.
- `graph-sync --repo .`처럼 상대 경로 repo에서 graphify 그래프가 만들어지지 않던 문제.
- Windows에서 graphify venv를 만들 때 `python`, `py -3`, `python3` 순서로 후보를 시도하도록 수정.
- Windows에서 `npm.cmd`를 spawn하다 `EINVAL`로 실패하던 문제.
- 배포 plugin 문서에 남은 소스 경로 언급과 개발용 `package.json` 필드를 제거.
