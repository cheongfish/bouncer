# 설정 (`.bouncer/config.json`)

`/bouncer-init`이 기본값을 만들어 줍니다. 프로젝트에 맞게 `verify`와
`source_dirs`부터 고치세요. 전체 기본 형태는 저장소 루트
[`config.example.json`](../config.example.json)에 있습니다.

## 필드

| 필드 | 설정할 수 있는 값 | 쓰는 곳 | 예시 |
| --- | --- | --- | --- |
| `verify` | 단일 실행 문자열 (`&&`·`;`·파이프·리디렉션·`cd` 불가 → `S12`) | **execute 게이트(G13)**, `/bouncer-plan`이 blueprint별 `tasks.bouncer.verify` 제안 | `"npm test"` · `"make test"` · `"npm run test:e2e"` |
| `source_dirs` | 저장소 상대 디렉터리 배열 | `/bouncer-init`(자동 채움), `graphify-runner` 소스 그래프 입력 | `["src", "scripts"]` |
| `context_dirs` | 저장소 상대 디렉터리 배열 | `graphify-runner` 컨텍스트 그래프 입력 | `[".bouncer/context"]` |
| `graphify.test_dirs` | 저장소 상대 디렉터리 배열 (선택) | 테스트 그래프 입력 → `graphify-out/test` | `["test"]` · `["tests"]` |
| `graphify.exclude_dirs` | 저장소 상대 prefix 배열 (선택) | source 병합 뒤 제거할 경로 prefix | `["scripts/lib"]` |
| `base_branch` | 브랜치 이름 | `/bouncer-execute` worktree 기준, `/bouncer-finalize` PR 기준 | `"main"` · `"develop"` |
| `autonomy` | `"auto"` \| `"interactive"` | `/bouncer-run`이 물어보는 횟수 | `"auto"` (시작 확인 1회) · `"interactive"` (task 경계마다 추가) |
| `graphify.enabled` | `true` \| `false` | `/bouncer-init`, `graphify-runner`, SessionStart 훅 | `true` — 끄면 `affected_paths`를 수동으로 채웁니다 |
| `graphify.bin` | 실행 파일 경로 (절대 또는 저장소 상대) | `bouncer graphify-bin` 해석 1순위 | git common dir 아래 절대 경로 · `".bouncer/.venv/bin/graphify"` |
| `distill.routing_enabled` | `true` \| `false` | `bouncer distill --for` 선택 소비 | `true` — 구조 preflight 통과 후 활성화 |
| `distill.max_bytes` | 양의 정수 바이트 값 | Distill 구조 validator의 경고 기준 | `6144` — 본문을 자르지 않음 |
| `pr.draft` | `true` \| `false` | `/bouncer-finalize` | `true` |
| `pr.base` | 브랜치 이름 | `/bouncer-finalize` | `"main"` |
| `subagents.provider` | `"claude"` \| `"cursor"` \| `"codex"` \| `"antigravity"` | 호스트 판별 — Cursor·Antigravity는 **직접 지정 필수** | `"cursor"` |
| `subagents.<provider>.<agent>` | `"inherit"` \| 호스트 모델 slug | `/bouncer-execute`·`/bouncer-plan`의 named 서브에이전트 디스패치 | `"inherit"` (부모 세션 모델 상속) |

`<agent>`는 `bouncer-implementer` · `bouncer-reviewer` · `bouncer-debugger` ·
`bouncer-context-reviewer` 넷입니다.

신규 `graphify.bin`은 git common directory 아래 `bouncer/venv`의 실행 파일
절대 경로입니다. 저장소 상대 값(`.bouncer/.venv/bin/graphify` 등)도 파일이
있으면 그대로 씁니다.

`graphify.test_dirs`와 `graphify.exclude_dirs`는 선택 필드입니다. `test_dirs`가
없어도 `graph-sync`의 `graphs[]`는 언제나 source·test·context 세 항목을
보고합니다 — 미설정·무효 test 항목은 `action: skip-unconfigured`로 남고
빌드·`missing`·SessionStart 경고 대상이 아닙니다. 빌드되는 그래프 수와
보고되는 스코프 수가 다를 수 있습니다. 키가 있으면 문자열 배열이어야 하고,
절대 경로나 `..` 탈출이 있으면 그 값을 적용하지 않으며 `graph-sync` 결과의
`skips`에 사유가 실립니다. `exclude_dirs`가 비어 있거나 없으면 JavaScript
경로를 생성물로 추측해 지우지 않습니다 — `scripts/lib` 같은 생성 경로는
프로젝트가 명시한 경우에만 source 그래프에서 빠집니다. `/bouncer-init`은
신규 저장소에서 실재하는 `test`·`tests`만 `graphify.test_dirs`로 넣고
`source_dirs`에서는 빼며, 이미 있는 config에는 이 키를 추가하지 않습니다.

신규 config의 `pr`에는 항상 `draft`가 있고, 브랜치 탐지가 성공했을 때만
`base`가 붙습니다. `labels` 기본값은 두지 않습니다. 예전 설정에 남아 있는
`pr.labels`는 읽기 오류를 내지 않지만 `/bouncer-finalize`가 `gh pr create`에
라벨을 붙이지도 않습니다.

`bouncer init`은 `base_branch`와 `pr.base`에 같은 값을 씁니다. 순서는
`git symbolic-ref --short refs/remotes/origin/HEAD`에서 `origin/` 접두사를
뗀 값, 그다음 `git symbolic-ref --short HEAD`입니다. 둘 다 실패하면 두 키를
쓰지 않고 반환 JSON에 `baseBranchUnresolved`를 실어 `/bouncer-init`이
기본 브랜치를 묻습니다. `develop`이나 `main`으로 채우지 않습니다. 이미
`base_branch`가 있는 config는 다시 쓰지 않습니다.

`bouncer current --set`은 `--base`가 없으면 `config.base_branch`를 쓰고,
그 키가 없으면 현재 체크아웃 브랜치를 씁니다.

## Project Distill 선택 라우팅

이 저장소는 전량 모드(`bouncer distill --all`)로 인덱스와 모든 shard를 먼저
관찰한 뒤 `distill.routing_enabled: true`를 명시한다. 현재 dogfood 인덱스는
8개 shard(`core`, `validate-gates`, `context-layout`, `git-worktree`, `graph`,
`plugin-skills`, `plugin-benchmark`, `build-ts`)다. `core`는 `always`만
쓰고 경로 glob이 없으며, `plugin-skills`와 `plugin-benchmark`는 겹치지 않는
양의 경로로 나뉜다. 활성화 전에는 구조 validator가 고아 shard, 경로가 없는
비항상 shard, 잘못된 `pulls`, 순환, `source_dirs`의 routing 구멍을 모두 경고
없이 통과하는지 확인해야 한다.

`bouncer distill --for <path>`는 파일, 디렉터리, 복수 경로를 받아 `always`와
매칭 shard 및 `pulls` 전이 폐쇄만 선택한다. 매칭이 없거나 경로·메타데이터를
확정할 수 없으면 전체 shard를 사용한다. 이 fail-open 진단은 본문을 오염시키지
않고 stderr로만 전달하며, stdout은 본문 또는 JSON으로 유지한다. 구조
validator의 경고는 활성화 가능 여부를 판정하는 구조화된 결과이고, 운영자가
사람에게 보여 주는 진단으로 변환할 때도 본문과 섞지 않는다.

`distill.max_bytes`는 선택 결과의 하드 상한이 아니다. validator가 shard의
UTF-8 byte 수가 기준을 넘었다는 경고(S26)를 내는 관찰 기준일 뿐이며, 결과를
잘라내거나 shard를 버리지 않는다. 기본값과 이 저장소 dogfood 설정은 모두
6KB(6144)다 — 대략 7.1 바이트/단어 환산으로 ≈865 단어이며, 샤드별 상한과
전체 합계(31,176)를 테스트가 고정한다. `bouncer distill --all`은 같은
기준으로 샤드별·총합 바이트를 stderr에만 남긴다. 그 초과 요약은
`/bouncer-finalize` 승격 ACQ와 `/bouncer-plan` 프리플라이트 한 줄 보고에만
보이며 게이트가 아니다. 활성화된 저장소에서 구조 경고가 남아 있으면
validator가 활성화를 거부하므로, 먼저 경고를 해소한 뒤 true로 전환한다.

## verify 래퍼 패턴

`verify`는 **단일 실행 문자열**입니다. `&&`·`;`·파이프·리디렉션·`cd` 접두가 들어가면
plan 게이트 `S12`와 런타임 `VERIFY_COMMAND_INVALID`에 걸립니다. 컨테이너를 띄운 뒤
테스트를 돌리는 작업은 한 줄로 이을 수 없으니, 프로젝트 스크립트 하나로 감싸고 그
스크립트만 검증 명령으로 둡니다.

```json
{ "verify": "npm run test:e2e" }
```

```jsonc
// package.json — compose up과 테스트를 이 안에서 묶는다
"scripts": { "test:e2e": "docker compose up -d && vitest run" }
```

- worktree에서 compose를 쓸 때는 `-p` 또는 `COMPOSE_PROJECT_NAME`으로 프로젝트
  이름을 worktree마다 다르게 두세요. 원본 체크아웃과 포트·볼륨이 겹칩니다.
- docker가 없는 환경(CI 호스트, 데몬 없는 로컬)에서는 래퍼가 스스로 건너뛰고 0으로
  끝나게 하세요. 없는 바이너리 때문에 execute 게이트가 실패하면 안 됩니다.

## `subagents`

호스트마다 모델 ID 네임스페이스가 달라서 프로바이더별 블록이 필요합니다.
`bouncer init`은 네 프로바이더 × 네 에이전트를 모두 `"inherit"`로 채워, 편집할
자리를 보여 줍니다.

```json
{
  "subagents": {
    "provider": "cursor",
    "claude": { "bouncer-reviewer": "inherit", "bouncer-implementer": "inherit" }
  }
}
```

- `"inherit"`(또는 빈 값·문자열 아닌 값)이면 부모 세션 모델을 그대로 씁니다.
- **Cursor와 Antigravity는 자동 판별되지 않습니다.** `subagents.provider`를 직접
  적으세요. `BOUNCER_HOME`은 플러그인 루트 오버라이드일 뿐 프로바이더 신호가
  아닙니다.
- 이미 `bouncer init`을 돌린 저장소는 `antigravity` 블록을 직접 추가해야 합니다.
  없어도 부모 모델을 상속하므로 깨지지는 않습니다.

## 컨텍스트 그래프

`context_dirs`의 빌드는 화이트리스트 섹션만 뽑은 파생 트리
`graphify-out/context-src/`를 스캔하고, `map.json`으로 결과 경로를 원본으로
되돌립니다. 화이트리스트는 다음과 같습니다.

- `.bouncer/Distill.md`의 `## Decisions`
- epic `index.md`의 `## Success criteria`
- BP `explain.md`의 `## Background` / `## Intuition` / `## Code`
- BP `index.md`의 `## Intent` / `## Contract`
- `tasks/<NNN>/tasks.md`의 `## Goal & intent` / `## Interface`

Graphify 설치와 오프라인 폴백은 [install.md](install.md#선택-graphify-경로-추천)에
있습니다.

---

프로젝트 설정은 `.bouncer/config.json`에 둡니다. blueprint 크기·OKF 정렬 같은 제품
규칙은 플러그인의 [`rules/`](../rules/)에 있고 프로젝트로 복사되지 않습니다. 제품
설계 결정은 [ARCHITECTURE.md](ARCHITECTURE.md)를 보세요.
