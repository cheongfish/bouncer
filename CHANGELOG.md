# Changelog

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르고,
버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

릴리스 태그는 `claude plugin tag`가 만드는 `bouncer--v<version>` 형식입니다.

이전 내부 버전(1.x 이하) 이력은 npm 공개를 앞두고 버전을 0.1.x로 다시 시작하면서 이 파일에서
정리했습니다. 필요하면 git 이력에서 확인하세요.

## [Unreleased]

## [0.1.12]

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
