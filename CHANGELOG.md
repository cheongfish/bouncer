# Changelog

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르고,
버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

릴리스 태그는 `claude plugin tag`가 만드는 `bouncer--v<version>` 형식입니다.

## [Unreleased]

### Changed

- **finalize 커밋 메시지에서 trailer 제거** — Epic/Blueprint/Distill과
  `commit.trailers` 설정을 더 이상 붙이지 않는다. 메시지는 `.gitmessage`와 같이
  `type: 제목` + tasks/verification `title` 본문 불릿만 쓴다. 식별자는 PR 본문에
  남긴다.
- **epic·blueprint·tasks 템플릿 개선** — 각 섹션에 무엇을 써야 하는지와 어떤
  게이트가 그것을 검사하는지를 한국어 안내로 실었다. blueprint에
  `One-commit justification` 섹션 추가 — 채우지 못하면 blueprint를 쪼개라는 신호.
- **G10 확장** — plan 게이트가 `<TODO: …>` placeholder 잔존을 잡는다. 안내
  주석만 있는 섹션도 미작성으로 판정한다(`parseSections`가 HTML 주석을 먼저
  제거하므로 G13·G14 판정도 함께 엄격해진다).
- **OKF v0.1 정렬(부분)** — 번들 루트 `.bouncer/context/index.md`가 §6 목록
  형식과 §11 `okf_version: "0.1"` frontmatter를 갖는다. 템플릿이 상대 링크로
  이웃 문서를 가리킨다(§5.2). `config.json`의 `okf_version`은 의미가 다른 값이라
  `schema_version`으로 개명했다(이 키를 읽는 코드는 없음).
  epic/blueprint 본체가 예약 파일명 `index.md`를 쓰는 §3.1 위반은 이연 상태다.

## [0.1.0] — 2026-07-27

팀 배포용 첫 릴리스.

### Added

- **4개 명령** — `/bouncer-init`, `/bouncer-plan`, `/bouncer-execute`,
  `/bouncer-finalize`. epic → blueprint → tasks를 하나의 리뷰 가능한 커밋으로 묶는
  워크플로.
- **결정적 게이트 G1–G14** — `bouncer validate --gate <plan|execute|finalize>`.
  문서 상태와 본문을 스크립트로 검사하며, 구조/스키마 위반은 S1–S9로 별도 보고.
- **실행되는 검증** — execute 게이트가 `config.verify`를 직접 실행하고 종료 코드와
  출력을 `verification.md`에 기록한다. 하네스가 기록한 메타데이터가 없거나 본문과
  어긋나면 G13 실패. 에이전트가 손으로 쓴 증적만으로는 통과할 수 없다.
- **커밋 안전 훅** — PreToolUse에서 `affected_paths` 밖 파일의 커밋을 차단한다.
  판단할 수 없는 명령은 커밋으로 간주한다(fail-closed): 중첩 셸(`bash -c "..."`)은
  내부를 파싱하고, 셸 확장(`git $FLAG commit`)은 판단 불가로 처리하며, 셸 별칭
  (`git ci`)은 `git config`로 확장해 해석한다. finalize의 범위 검사가 최후 방어선.
- **8개 스킬** — `discovery`, `spec-authoring`, `implementation`, `debugging`,
  `verification`, `review`, `minimality`, `graphify-runner`.
- **마켓플레이스 배포** — `.claude-plugin/marketplace.json`. 저장소 자체가
  카탈로그이며 플러그인 소스는 `"./"`.

### Changed

- **`js-yaml` 벤더링** — `scripts/vendor/js-yaml.js`로 옮기고 런타임
  `dependencies`를 제거했다. Claude Code는 플러그인을 클론만 하고 `npm install`을
  돌리지 않으므로, 이게 없으면 훅이 첫 호출에서 죽는다.
  `test/distribution.test.js`가 이 계약을 강제한다.
- **scaffold가 `.bouncer/templates/`를 사용** — 문서 본문을 런타임에 템플릿에서
  렌더링한다(`<EPIC-id>`/`<BP-id>`/`<name>` 치환, 템플릿 부재 시 내장 기본값 폴백).
  이전에는 init이 만든 템플릿과 scaffold 출력이 서로 달라, 갓 scaffold한 문서가
  G10·G13·G14의 요구 섹션을 갖추지 못했다.
- **`graph.basis` 기본값 제거** — scaffold가 `'scaffold-default'`를 미리 써넣어
  G4의 근거 검사가 무의미했다. 이제 빈 값으로 두어 `graphify-runner`(또는 사용자)가
  실제 근거를 기록해야 통과한다.

### Fixed

- **런타임 산출물로 finalize가 하드 중단되던 문제** — `.gitignore`가 없는 저장소에서
  `node_modules/`와 `graphify-out/`이 out-of-scope 위반으로 잡혔다. 이제 finalize와
  커밋 가드가 `node_modules/`, `graphify-out/`, `.worktrees/`를 무시 대상으로
  처리하고, finalize는 스테이징 대상에서도 제외한다.
- **존재하지 않는 blueprint 경로가 `G9`로 보고되던 문제** — 이제 `S11 blueprint
  documents not found`로 구분해 보고하고, 게이트 검사와 `verify` 명령 실행을
  건너뛴다. 경로 오타를 문서 문제로 오인하지 않게 된다.
- **`bouncer init`이 `.gitignore` 누락을 안내** — 결과의 `gitignoreSuggestions`로
  추가할 항목을 보고한다. 파일을 직접 수정하지는 않는다(안전 부트스트랩 정책).

### Tooling

- **CI** — GitHub Actions와 GitLab CI를 모두 추가. `main`/`develop` 푸시와 PR마다
  `npm test`와 `npm run lint`를 실행한다. 사설 저장소 과금을 고려해 `ubuntu-latest`
  단일 러너만 쓴다(Linux 1x, Windows 2x, macOS 10x).
- **ESLint** — 기존 코드 스타일을 그대로 규칙화(`eslint.config.js`, flat config).
  벤더링 코드는 제외. 도입 과정에서 죽은 인자 `init({ timestamp })`, 불필요한 초기
  할당 2건, 남은 eslint-disable 지시문 1건을 제거했다.

### Dogfooding (P3)

이 저장소를 Bouncer로 한 사이클 완주(EPIC-001/BP-001, 커밋 `a221b3b`)하며 확인한
것과 그 결과다.

- **finalize가 활성 포인터를 정리하지 않던 문제 (배포 차단급)** — 사이클을 끝낸 뒤
  `.bouncer/current`가 남아, 무관한 모든 커밋이 그 blueprint의 `affected_paths`에
  걸려 차단됐다. 커밋에 성공한 finalize가 이제 포인터를 지운다(`clearCurrent`).
  dry-run은 지우지 않는다.
- **기록된 증적이 저장소 이름 가드를 깨뜨리던 문제** — `verification.md`는 verify
  명령의 출력을 그대로 담는데, 이 저장소의 테스트 이름에는 레거시 프로토콜명이
  의도적으로 들어 있다. `.bouncer/context/`를 기록물로 보아 스캔에서 제외했다.
  이름 정책은 *작성한 표면*을 규율하지, 명령이 출력한 내용을 규율하지 않는다.
- 파일럿 안내(`docs/PILOT.md`)와 이슈 템플릿(GitHub·GitLab)을 추가했다.

### Conventions

- **커밋·PR 템플릿** — 한국어 Conventional Commits 규약을 `.gitmessage`에 명문화하고
  `npm run setup`으로 연결한다(클론마다 1회, git이 저장소의 로컬 설정 변경을 막기
  때문). PR 본문 템플릿을 GitHub·GitLab·Bouncer 세 경로에 같은 형식으로 배치했다.
  이전 PR 템플릿은 커밋 메시지 형식의 복사본이었다.

### Changed (커밋 산출물)

- **검증 증적을 성공과 실패에 따라 다르게 기록** — 통과한 실행은 종료 코드가 증거이므로
  본문에 출력 블록을 남기지 않고 꼬리도 짧게(20줄) 남긴다. 실패한 실행은 출력이
  증거이므로 본문에 코드블록으로 남기고 꼬리도 길게(100줄) 유지한다. 같은 출력을
  frontmatter와 본문에 두 번 쓰던 것을 없앴다. 이 저장소 기준 229줄 → 47줄.
- **생성 커밋 메시지를 팀 규약에 맞춤** — 제목에서 스코프를 빼고, `Epic`/`Blueprint`/
  `Distill`을 본문이 아닌 trailer로 옮겼다. 본문은 tasks와 verification의 `title`을
  불릿으로 쓴다. 언어는 문서 `title`에서 오므로 하드코딩하지 않는다 — 다른 팀이
  설치해도 그 팀의 언어와 규약을 따른다.
- **`commit.trailers` 설정 추가** — 커밋 메시지 말미에 그대로 덧붙일 trailer 목록.
  기본값은 빈 배열이다. trailer는 팀 규약이지 Bouncer가 가정할 것이 아니다.

### Known limitations

- 커밋 가드는 셸을 거치지 않는 경로(스크립트 파일, `make`, `subprocess`)와 plumbing
  우회(`git commit-tree` + `git update-ref`)를 탐지하지 못한다. 실수 방지 장치이지
  악의적 우회 방어가 아니다. README의 "위협 모델" 참고.
- LICENSE가 아직 없다(사내 정책 확인 대기).
- 생성되는 커밋 메시지의 품질이 문서 `title`에 전적으로 좌우된다. `title`을 커밋
  제목·본문 줄로 그대로 쓸 수 있게 작성해야 한다.
- `graphify`가 꺼져 있을 때 `graph.basis`를 사람이 직접 적어야 한다.
