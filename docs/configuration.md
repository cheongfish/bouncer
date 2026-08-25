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
| `base_branch` | 브랜치 이름 | `/bouncer-execute` worktree 기준, `/bouncer-finalize` PR 기준 | `"develop"` · `"main"` |
| `autonomy` | `"auto"` \| `"interactive"` | `/bouncer-run`이 물어보는 횟수 | `"auto"` (시작 확인 1회) · `"interactive"` (task 경계마다 추가) |
| `graphify.enabled` | `true` \| `false` | `/bouncer-init`, `graphify-runner`, SessionStart 훅 | `true` — 끄면 `affected_paths`를 수동으로 채웁니다 |
| `graphify.bin` | 실행 파일 경로 (저장소 상대) | `bouncer graphify-bin` 해석 1순위 | `".bouncer/.venv/bin/graphify"` |
| `distill.routing_enabled` | `true` \| `false` | `bouncer distill --for` 선택 소비 | `true` — 구조 preflight 통과 후 활성화 |
| `distill.max_bytes` | 양의 정수 바이트 값 | Distill 구조 validator의 경고 기준 | `6144` — 본문을 자르지 않음 |
| `pr.draft` | `true` \| `false` | `/bouncer-finalize` | `true` |
| `pr.base` | 브랜치 이름 | `/bouncer-finalize` | `"develop"` |
| `pr.labels` | 문자열 배열 | `/bouncer-finalize` | `["bouncer"]` |
| `subagents.provider` | `"claude"` \| `"cursor"` \| `"codex"` \| `"antigravity"` | 호스트 판별 — Cursor·Antigravity는 **직접 지정 필수** | `"cursor"` |
| `subagents.<provider>.<agent>` | `"inherit"` \| 호스트 모델 slug | `/bouncer-execute`·`/bouncer-plan`의 named 서브에이전트 디스패치 | `"inherit"` (부모 세션 모델 상속) |

`<agent>`는 `bouncer-implementer` · `bouncer-reviewer` · `bouncer-debugger` ·
`bouncer-context-reviewer` 넷입니다.

## Project Distill 선택 라우팅

이 저장소는 전량 모드(`bouncer distill --all`)로 인덱스와 모든 shard를 먼저
관찰한 뒤 `distill.routing_enabled: true`를 명시한다. 활성화 전에는 구조
validator가 고아 shard, 경로가 없는 비항상 shard, 잘못된 `pulls`, 순환,
`source_dirs`의 routing 구멍을 모두 경고 없이 통과하는지 확인해야 한다.

`bouncer distill --for <path>`는 파일, 디렉터리, 복수 경로를 받아 `always`와
매칭 shard 및 `pulls` 전이 폐쇄만 선택한다. 매칭이 없거나 경로·메타데이터를
확정할 수 없으면 전체 shard를 사용한다. 이 fail-open 진단은 본문을 오염시키지
않고 stderr로만 전달하며, stdout은 본문 또는 JSON으로 유지한다. 구조
validator의 경고는 활성화 가능 여부를 판정하는 구조화된 결과이고, 운영자가
사람에게 보여 주는 진단으로 변환할 때도 본문과 섞지 않는다.

`distill.max_bytes`는 선택 결과의 하드 상한이 아니다. validator가 shard의
UTF-8 byte 수가 기준을 넘었다는 경고(S26)를 내는 관찰 기준일 뿐이며, 결과를
잘라내거나 shard를 버리지 않는다. 기본값은 6KB(6144)다 — 대략 7.1 바이트/
단어 환산으로 ≈865 단어이며, 이 저장소 분포에서 8KB·13KB급 샤드는 경고하고
5.8KB급은 통과시킨다. `bouncer distill --all`은 같은 기준으로 샤드별·총합
바이트를 stderr에만 남긴다. 그 초과 요약은 `/bouncer-finalize` 승격 ACQ와
`/bouncer-plan` 프리플라이트 한 줄 보고에만 보이며 게이트가 아니다. 활성화된
저장소에서 구조 경고가 남아 있으면 validator가 활성화를 거부하므로, 먼저
경고를 해소한 뒤 true로 전환한다.

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
