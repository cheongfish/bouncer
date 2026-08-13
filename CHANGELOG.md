# Changelog

이 파일은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식을 따르고,
버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

릴리스 태그는 `claude plugin tag`가 만드는 `bouncer--v<version>` 형식입니다.

## [Unreleased]

### Changed

- **`/bouncer-run` 역할** — 주행 세션은 오케스트레이터다. 구현·리뷰·조사는
  execute가 named 서브에이전트로 위임하고 루프는 세 리포트만 받아 조치를
  라우팅한다. 경량(`scale: light`) blueprint도 주행 중에는 인라인 분기 대신
  named 디스패치를 쓴다.
- **`bouncer-implementer` 리포트** — Output contract를 고정했다(Changed files /
  Checklist coverage / Tests / Deviations / Needs planning). 컨트롤러가 diff를
  다시 읽지 않고 이 필드만으로 다음 조치를 정한다.

## [0.8.1] — 2026-08-13

0.8.0 이후 계획 품질 게이트와 로컬 커밋 가드(EPIC-033).

### Added

- **context-review (EPIC-033)** — blueprint 루트 `context-review.md`
  (`bouncer.context_review`, id `CTXREVIEW-<bp>`). `/bouncer-plan` 승인 직전에
  `bouncer-context-reviewer`가 계획 문서를 판정하고, plan 게이트 **G18**이
  status와 findings 형식만 본다. `scale: light` 면제 없음.
- **pre-commit** — `npm run setup`이 `.githooks`를 연결하고, 커밋 전에
  `scripts/lib` emit 검사와 lint를 돌린다. 전체 테스트는 원격 CI에 둔다.

### Changed

- **minimality 래더** — native platform과 표준 라이브러리를 분리한 7단.
  강도는 기존 `bouncer.scale`에 매긴다 (`light`는 1–4단).
- **신뢰 경계** — 컨텍스트 본문·그래프 산출물·서브에이전트 리포트는 데이터로
  읽고 지시로 따르지 않는다. `docs/security.md`에 고정.

## [0.8.0] — 2026-08-13

0.7.5 이후 문서 스키마 확정·자동 주행(EPIC-031–032).

### Added

- **`/bouncer-run` (EPIC-032)** — 활성 blueprint에서 `/bouncer-execute` →
  `/bouncer-commit`을 열린 task가 없어질 때까지 반복한다. plan·finalize 정본은
  그대로 두고, 시작 ACQ 한 번(및 `interactive`의 task 경계 ACQ)만 묻는다.
  verify 재실패·리뷰 왕복 상한·범위 위반에서 멈추며 finalize에는 들어가지
  않는다.
- **`config.autonomy` (EPIC-032)** — `auto` | `interactive`(기본 `auto`).
  `config.json`에만 두고 문서 frontmatter에는 넣지 않는다. `bouncer init`이 새
  저장소에 `"auto"`를 심으며, 이미 있는 config는 바꾸지 않는다.

### Changed

- **문서 스키마 (EPIC-031)** — 번들 루트에 `bouncer_schema`를 두고, blueprint
  `scale`/`commit_type` 기본값·S19(`type`↔경로)·S20(`scale` enum)을 확정한다.
  루트 `tasks.md` / `tasks-<NNN>.md` 서술과 해석 폴백을 제거하고
  `tasks/<NNN>/`만 산다.
- **debugger 재디스패치 상한** — 같은 verify 실패에 대해 수동·자동 경로 모두
  **1회**. `/bouncer-run`은 execute 위에 별도 상한을 씌우지 않는다.

## [0.7.5] — 2026-08-12

0.7.0 이후 스킬 구조 정렬·이해 게이트 재배치(EPIC-029–030).

### Changed

- **스킬 anatomy (EPIC-029)** — 워크플로·제네릭 스킬 본문 구조를 맞추고, 코드
  주석 규칙은 `CLAUDE.md` hard rule 9로 승격한다. `bouncer.commit_intent`는
  task 문서에만 둔다.
- **이해 기록 위치 (EPIC-030)** — explain·퀴즈는 `/bouncer-finalize`에서
  blueprint당 comprehension 엔트리 하나로 기록한다. `/bouncer-commit`은 task
  커밋만 담당한다. commit 게이트는 G6/G7/G8 + **G17**(스테이징 스코프)이고,
  G15·G9는 결번이다. `makeAllowed` 등 허용 집합은 `scope.ts`로 옮겨
  validate↔finalize 순환을 끊는다.

## [0.7.0] — 2026-08-12

0.6.0 이후 task 묶음·커밋 단계·호스트 확장(EPIC-020–028).

### Added

- **task 단위 증적·리뷰 (EPIC-020)** — `tasks/<NNN>/{tasks,verification,review}.md`
  디렉터리 묶음. execute 게이트는 포인터 task 묶음만 판정한다.
- **`/bouncer-commit` (EPIC-021)** — task 하나를 닫는 단계. subject·의도는 대상
  task에서 오고, `explain.md` comprehension은 task별 엔트리 배열이다. commit
  게이트(G15)와 finalize의 G16(열린 task 없음)을 둔다.
- **blueprint `closed` (EPIC-022)** — finalize가 status를 `closed`로 잠그고,
  잠긴 blueprint에 task scaffold를 거절한다.
- **경량 경로 (EPIC-024)** — blueprint에 `bouncer.scale: light`를 남기면 plan이
  공용 epic 재사용·execute 왕복·퀴즈 규모를 줄인다. 게이트 판정은 분기하지
  않는다.
- **graphify init 설치 (EPIC-025)** — `bouncer init`이 `.bouncer/.venv`에
  설치하고 (`--promote-graphify` / `--write-gitignore`는 동의 후), 실행 파일은
  `config.graphify.bin` → venv → PATH 순으로 `bouncer graphify-bin`이 해석한다.
- **context 섹션 다이제스트 (EPIC-026)** — context 그래프는 의사결정 섹션만 담은
  파생 트리에서 빌드하고, 노드 `source_file`은 원본 경로를 유지한다.
- **`bouncer import` (EPIC-027)** — git 히스토리를 `imported` status 문서로
  전사한다. 임포트분은 게이트·다음 BP 후보 밖이다.
- **Antigravity 호스트 (EPIC-028)** — 루트 `plugin.json`과
  `subagents.provider: "antigravity"` 배선. Claude / Cursor / Codex에 이어 네
  번째 설치 표면.

### Changed

- **워크플로 순서** — `/bouncer-init` → `/bouncer-plan` → `/bouncer-execute` →
  `/bouncer-commit` → `/bouncer-finalize`. execute는 커밋하지 않고, finalize는
  blueprint 마감·PR·정리로 좁힌다.
- **execute worktree 경로 (EPIC-023)** — `.worktrees/<epic-id>/<bp-id>`로
  중첩해 epic이 보이고 blueprint id 충돌을 피한다.
- **루트 task 문서 레이아웃** — `tasks.md` / `tasks-<NNN>.md`는 마이그레이션
  대상. 신규 scaffold는 `tasks/<NNN>/`만 만든다.

## [0.6.0] — 2026-08-07

0.5.0 이후 task 단위 커밋 기반(EPIC-017–019).

### Added

- **plan 검증 명령 제안 (EPIC-017)** — `/bouncer-plan`이 compose·`Makefile`·
  `Taskfile`·`package.json` scripts를 감지하면 blueprint `verify` 지정 여부를
  묻고, 셸 체이닝 대신 래퍼 스크립트 패턴을 `docs/configuration.md`에 안내한다.
- **다중 task 문서 (EPIC-018)** — blueprint에 `tasks-001.md`, `tasks-002.md` …
  를 둘 수 있다. scaffold는 `tasks-001.md`를 만들고, plan 게이트는 발견된 모든
  task 문서에 G3·G4·G5·G10–G12를 각각 적용한다.
- **활성 포인터 `task` 필드 (EPIC-019)** — `bouncer current --set … --task <NNN>`
  으로 작업 중 task를 기록한다. `--task` 없이 `--set`하면 열린 task 중 번호 순
  첫 문서를 고른다. 포인터에 `task`가 있으면 verify·커밋 허용 경로가 그 문서만
  본다.

### Changed

- **하드룰 2 — one commit per task** — 커밋 단위는 task 문서, 리뷰/PR 단위는
  blueprint. `tasks.md`만 있는 기존 blueprint와 `task` 없는 포인터는 이전과
  같이 동작한다. `tasks.md`와 `tasks-{ddd}.md` 혼재는 검증이 거절한다.

## [0.5.0] — 2026-08-06

0.4.5 이후 숫자 context id 계약(EPIC-014, BP 001–003).

### Added

- **`bouncer migrate ids`** — 구형 `EPIC-`/`BP-` 경로·frontmatter를 숫자 id로
  옮기는 CLI. `migrate-ids` 스킬과 함께 제공.
- **SessionStart 구형 경고** — 레거시 디렉터리명이 남아 있으면 migrate를
  안내한다.

### Changed

- **epic/blueprint id 정본** — 경로와 frontmatter id를 접두 없는 zero-pad 세
  자리 숫자(`014`, `001`)로 통일. scaffold는 신형만 생성한다.

### Removed

- **validate·scaffold의 구형 `EPIC-`/`BP-` 명명 허용** — 소비자 저장소는 먼저
  `bouncer migrate ids --dry-run`으로 변경 목록을 확인한 뒤
  `bouncer migrate ids`를 적용해야 한다. 구형 명명이 남은 저장소는 migrate가
  끝날 때까지 validate가 거절한다.

## [0.4.5] — 2026-08-05

0.4.0 이후 컨텍스트 산문 규칙·Distill 런타임 경로 정리.

### Added

- **`stop-slop` 스킬** — `.bouncer/context/` 한국어 본문(epics·explain)의 AI 문체
  패턴을 걷어내는 advisory 스킬. plan(`spec-authoring` 뒤)·explain에 연결.
- **Context language** — epic/blueprint/tasks/explain 본문은 한국어. Distill은
  영어 에이전트 런타임. `CLAUDE.md` hard rule 8.

### Changed

- **Project Distill 경로** — `.bouncer/context/Distill.md` → `.bouncer/Distill.md`
  (`config.json`과 같은 런타임 루트). `bouncer init`이 레거시 경로를 새 경로로
  soft-migrate.
- **README Features** — Blueprint commits / Verified execute / Path guard /
  Worktree execute 네 키워드로 축약.

## [0.4.0] — 2026-08-05

0.3.0 이후 이해 게이트(explain)·finalize 인계·그래프 신호 개선.

0.3.0 대비 요약:

| 영역 | 0.3.0 | 0.4.0 |
| --- | --- | --- |
| BP 회고 문서 | `distill.md` + G9 상태 검사 | `explain.md` + G15(diff SHA·이해 기록) |
| Finalize 설명 | 별도 저술 단계 없음 | `explain-diff`로 설명·퀴즈·comprehension 기록 |
| Distill / PR | BP distill 승격·별도 PR 본문 | explain에서 승격·PR 본문 (`## 이해 상태` 제외) |
| Finalize 인계 | 포인터 수동 | 다음 BP 후보 통지 후 확인 시 `current --set` |
| 그래프 | 실패·경로 이슈가 무음으로 넘어갈 수 있음 | 미생성 신호 + 경로 계약 정정 |

### Added

- **`explain.md` 계약** — `bouncer scaffold explain`이 다섯 섹션 골격을 만들고,
  finalize가 빈 본문·누락된 comprehension·`diff_sha` 불일치를 G15로 거절.
- **`explain-diff` 스킬** — finalize가 diff 설명·퀴즈 채점·이해 기록을 이 스킬로 수행.
- **다음 블루프린트 인계** — 마감 뒤 후보를 계산·통지하고, 승낙 시
  `bouncer current --set`으로 포인터를 옮김.

### Changed

- **BP `distill.md` / G9 제거** — 마감 게이트가 이해 기록 검사(G15)로 교체.
  기존 에픽의 `distill.md`는 소급 마이그레이션하지 않음.
- **Distill 승격·PR 본문** — 소스가 `explain.md`. `## 이해 상태`는 전역 Distill과
  PR에 넣지 않음.
- **README** — Features에 Explain·이해 게이트를 반영하고 Documentation 표를
  `docs/README.md` 링크로 단순화.

### Fixed

- **그래프 미생성 무음 스킵** — 생성 실패를 신호로 드러냄.
- **그래프 경로 계약** — 실재 디렉터리와 격리된 산출 위치로 맞춤.

## [0.3.0] — 2026-08-04

0.2.0 이후 워크플로 CLI·검증 오버라이드·discovery·finalize 확인 흐름 개선.

0.2.0 대비 요약:

| 영역 | 0.2.0 | 0.3.0 |
| --- | --- | --- |
| Verify | `config.verify`만 | `tasks.bouncer.verify` 우선, 없으면 전역 폴백 (S12) |
| 활성 포인터 | 파일 직접 읽기/쓰기 | `bouncer current [--set\|--clear]` CLI |
| Discovery | Goal→Scope→Non-goals→Success→Confirm | pre-read · 엣지/실패 · Overlap · 6항 handoff |
| Execute 브랜치 | `bouncer/<BP-id>-…` 등 | `<commit_type>/<BP-id>-<slug>` |
| Finalize 후처리 | push·draft PR·worktree를 자동 시도 | 사용자 확인 후 PR / worktree 정리 |
| 커밋·PR 제목 | type + title 불릿 | `commit_intent` 2줄 + `[YYMMDD] (→ base) [Type] 요약` |
| 마스터 룰 | `CLAUDE.md`/`AGENTS.md` 바이트 동일 | `AGENTS.md` → `@CLAUDE.md` import |

### Added

- **블루프린트 단위 verify** — `tasks.bouncer.verify`가 있으면 그걸 쓰고, 없으면
  `config.verify`로 폴백. 비단일 셸 형식은 S12로 거절.
- **`bouncer current`** — 활성 포인터 읽기 / `--set` / `--clear`. 없으면 `ready`
  후보를 안내. plan·execute·finalize 스킬이 CLI로 배선.
- **Discovery 심화** — epic 인덱스·Distill pre-read, 엣지 케이스·실패 모드·Overlap
  질문, plan handoff 6항 계약. review는 테스트 없는 동작 변경을 지적할 수 있음.

### Changed

- **`AGENTS.md`가 `@CLAUDE.md`를 import** — 바이트 동일 복제 대신 Codex /
  Cursor 어댑터만 둔다. 마스터 룰 SSOT는 `CLAUDE.md`.
- **finalize draft PR 제목 형식** — `<type>(<bp-id>): …` 대신
  `[YYMMDD] (→ MergeTarget) [Type] 요약` (베이스 브랜치·날짜·커밋 대표 요약).
- **finalize 커밋 본문에 배경·의도 2줄** — blueprint `bouncer.commit_intent`
  (정확히 2개)를 조립하고, 없으면 finalize 스킬이 커밋 전에 채운다.
- **finalize PR·worktree 정리** — 커밋 후 push·draft PR과 execute worktree 제거를
  사용자에게 물은 뒤에만 수행(거절·원격/`gh` 없으면 건너뜀).
- **execute 브랜치명** — `bouncer.commit_type` 접두사로
  `<type>/<BP-id>-<slug>` 통일.
- **설치 안내** — Claude Code · Cursor에서 project / local(workspace) scope 권장.
- **README** — 제품 소개·스킬 흐름(mermaid) 중심으로 재구성. 게이트·CLI 상세는
  `docs/`로 유지.

## [0.2.0] — 2026-08-03

0.1.0 이후 파일럿·dogfood에서 쌓인 워크플로·멀티 에이전트·코어 개선 릴리스.

0.1.0 대비 요약:

| 영역 | 0.1.0 | 0.2.0 |
| --- | --- | --- |
| Execute | 같은 checkout에서 구현 | 저장소 루트 아래 worktree + plan 문서 seed |
| Distill | BP distill 시점·전역 Distill 없음 | 전역 `Distill.md` 런타임 + finalize에서 BP distill·승격 |
| 서브에이전트 | 일반 Task/서브에이전트 디스패치 | named `bouncer-implementer` / `bouncer-reviewer` + 모델 설정 |
| 구현·리뷰 | 최소성 스킬만 | 최소 변경 사다리·상세 주석·과설계 루브릭 |
| 규칙·템플릿 | init이 프로젝트에 템플릿·규칙 복사 | 플러그인 내장 + `CLAUDE.md`/`AGENTS.md` 마스터 룰 |
| 코어 | JS 런타임 | TypeScript 소스 → CJS 산출, CI 동기화 검사 |
| 그래프 | 소스 graphify | source·context 이중 그래프 동기화 |
| 커밋 메시지 | Epic/Blueprint trailer | `.gitmessage`형 `type: 제목` + 의도 2줄 + title 불릿 |
| 게이트 | G10 placeholder 일부 | `<TODO: …>`·안내 주석만 있는 섹션도 미작성으로 판정 |
| 에이전트 설치 | Claude Code 중심 | Cursor·Codex 매니페스트와 설치 안내 |

### Added

- **Project Distill** — `.bouncer/context/Distill.md`를 init이 만들고, plan/execute가
  읽은 뒤 맞는 Invariants / Gotchas / Decisions를 brief에 반영한다. finalize가
  BP distill을 쓰고 지속 가능한 항목을 전역 Distill로 승격한다.
- **Worktree execute + plan seed** — execute가 저장소 루트 아래 worktree를 만들고
  plan 산출물을 옮긴 뒤(`seed-worktree`) 구현·verify·review를 한다.
- **Named 서브에이전트 라우팅** — `bouncer-implementer` / `bouncer-reviewer`로
  디스패치하고, 서브에이전트 모델 설정 계약을 둔다.
- **Cursor · Codex 매니페스트** — 같은 저장소에서 Claude Code · Cursor · Codex
  설치. 워크플로 명령을 스킬로 통일(`commands-to-skills`).
- **플러그인 마스터 룰** — `CLAUDE.md` / `AGENTS.md`(바이트 동일). 소비 프로젝트에
  설치하지 않으며, `/bouncer-*` 스킬과 `spec-authoring`이 시작 시 Read 한다.
- **최소 변경 사다리·상세 주석·과설계 루브릭** — `implementation`이 코드 전
  재사용 → stdlib → 네이티브 → 설치된 의존성 → 한 줄 → 최소 신규 순서를 밟고,
  비자명한 변경에 **왜**를 남긴다. `review`가 과설계를 `minor`로 지적한다.
- **리뷰 깊이** — Spec/Quality 루브릭, `reviewer-prompt`, 제약·거부 계약 검사.
- **스펙 작성 가드** — 템플릿 섹션·게이트 안내, blueprint
  `One-commit justification`, 제약·성공 조건 섹션.
- **source·context 이중 그래프 동기화** — SessionStart 훅이 소스와
  `.bouncer/context` 그래프를 맞춘다.
- **하네스 타임스탬프 KST 통일**

### Changed

- **문서 템플릿·제품 규칙을 프로젝트에 설치하지 않음** — `bouncer init`이
  `.bouncer/templates/`와 `governance.md` / `workflow.md` / `okf.md`를 더 이상
  쓰지 않는다. 골격은 `scripts/lib/templates.js`, 규칙은 `docs/`에 플러그인
  내장으로만 둔다. 기존 사본이 남아 있어도 무시한다.
- **결정적 코어를 TypeScript → CJS로 이전** — `scripts/src`에서 빌드하고 CI가
  산출물 동기화를 검사한다.
- **BP distill 생성을 finalize 시점으로 이전** — execute가 아니라 사이클
  마무리에서 쓴다.
- **README를 제품 소개 중심으로 재구성** — 설치 세부·게이트 표·설정·위협 모델·
  기여 안내를 `docs/`로 옮기고 [docs/README.md](docs/README.md)로 라우팅한다.
- **finalize 커밋 메시지에서 trailer 제거** — Epic/Blueprint/Distill과
  `commit.trailers`를 붙이지 않는다. `.gitmessage`와 같이 `type: 제목` +
  tasks/verification `title` 불릿만 쓴다. 식별자는 PR 본문에 남긴다.
- **G10 확장** — plan 게이트가 `<TODO: …>` placeholder 잔존을 잡는다. 안내
  주석만 있는 섹션도 미작성으로 판정한다.
- **OKF v0.1 정렬(부분)** — 번들 루트 `.bouncer/context/index.md`가 §6 목록
  형식과 §11 `okf_version: "0.1"`을 갖는다. `config.json`의 `okf_version`은
  `schema_version`으로 개명했다. epic/blueprint 본체의 `index.md` §3.1 위반은
  이연 상태다.

### Fixed

- **graphify 호출을 실제 CLI 계약에 맞춤**

### Tooling

- CI에 `tsc` 산출물 동기화 검사 추가
- 에디터·에이전트 로컬 경로를 `.gitignore`에 추가

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
