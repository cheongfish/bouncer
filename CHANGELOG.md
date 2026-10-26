# Changelog

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르고,
버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

릴리스 태그는 `claude plugin tag`가 만드는 `bouncer--v<version>` 형식입니다.

이전 내부 버전(1.x 이하) 이력은 npm 공개를 앞두고 버전을 0.1.x로 다시 시작하면서 이 파일에서
정리했습니다. 필요하면 git 이력에서 확인하세요.

## [Unreleased]

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
