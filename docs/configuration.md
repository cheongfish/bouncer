# 설정 (`.bouncer/config.json`)

`/bouncer-init`이 기본값을 만들어 줍니다. 프로젝트에 맞게 `verify`와
`source_dirs`부터 고치세요. 전체 기본 형태는 저장소 루트
[`config.example.json`](../config.example.json)에 있습니다.

## 필드

| 필드 | 설정할 수 있는 값 | 쓰는 곳 | 예시 |
| --- | --- | --- | --- |
| `verify` | 단일 실행 문자열 (`&&`·`;`·파이프·리디렉션·`cd` 불가 → `S12`). 실행 시 argv로 파싱되며 `shell: false` | **execute 게이트(G13)**, `/bouncer-plan`이 blueprint별 `tasks.bouncer.verify` 제안 | `"npm test"` · `"make test"` · `"npm run test:e2e"` |
| `verify_allowlist` | argv0 실행 파일명 문자열 배열. Windows에서는 `npm.cmd`·`node.exe`처럼 관용 확장자를 벗긴 뒤 비교 | 런타임 검증 실행 직전 허용 목록. 없거나 배열이 아니면 기본값(`npm`·`node`·`make` 등). plan/S12의 `tasks.bouncer.verify` 검사는 이 키가 아니라 기본 목록만 사용 | `["npm", "node", "make"]` |
| `source_dirs` | 저장소 상대 디렉터리 배열 | `/bouncer-init`(자동 채움), `graphify-runner` 소스 그래프 입력 | `["src", "scripts"]` |
| `context_dirs` | 저장소 상대 디렉터리 배열 | `graphify-runner` 컨텍스트 그래프 입력 | `[".bouncer/context"]` |
| `graphify.test_dirs` | 저장소 상대 디렉터리 배열 (선택) | 테스트 그래프 입력 → `graphify-out/test` | `["test"]` · `["tests"]` |
| `graphify.exclude_dirs` | 저장소 상대 prefix 배열 (선택) | source 병합 뒤 제거할 경로 prefix | `["scripts/lib"]` |
| `base_branch` | 브랜치 이름 | `/bouncer-execute` worktree 기준, `/bouncer-finalize` PR 기준 | `"main"` · `"develop"` |
| `autonomy` | `"auto"` \| `"interactive"` | `/bouncer-run` 위임 주행의 **보고 주기** | `"auto"` (마감 보고에 모아서) · `"interactive"` (task 경계마다 진행 한 줄) |
| `graphify.enabled` | `true` \| `false` | `/bouncer-init`, `graphify-runner`, SessionStart 훅 | `true` — 끄면 `affected_paths`를 수동으로 채웁니다 |
| `graphify.bin` | 실행 파일 경로 (절대 또는 저장소 상대) | `bouncer graphify-bin` 해석 1순위 | git common dir 아래 절대 경로 · `".bouncer/.venv/bin/graphify"` |
| `pr.draft` | `true` \| `false` | `/bouncer-finalize` | `true` |
| `pr.base` | 브랜치 이름 | `/bouncer-finalize` | `"main"` |
| `subagents.provider` | `"claude"` \| `"cursor"` \| `"codex"` \| `"antigravity"` | 호스트 판별 — Cursor·Antigravity는 **직접 지정 필수** | `"cursor"` |
| `subagents.<provider>.<agent>` | `"inherit"` \| 호스트 모델 slug | `/bouncer-execute`·`/bouncer-plan`·`/bouncer-run`의 named 서브에이전트 디스패치 | `"inherit"` (부모 세션 모델 상속) |

`<agent>`는 `bouncer-implementer` · `bouncer-reviewer` · `bouncer-debugger` ·
`bouncer-context-reviewer` · `bouncer-coordinator` 다섯입니다.

`bouncer-coordinator`는 `/bouncer-run`이 시작 ACQ 뒤 한 번 부르는 주행
컨트롤러입니다. drive 전체를 끌고 가는 역할이라 worker와 다른 모델을 고르고
싶을 수 있어 슬롯을 따로 둡니다. 값의 의미는 나머지 넷과 같고
(`"inherit"`이면 부모 세션 모델), 호스트가 named agent를 로드하지 못하면 같은
coordinator 역할 전체를 실은 generic 서브에이전트 하나로 폴백합니다 — 축약한
brief로 대신하지 않습니다. 이미 `bouncer init`을 돌린 config에는 이 키가
없을 수 있는데, 없어도 부모 모델을 상속하므로 동작은 같습니다.

**`autonomy`의 역할이 달라졌습니다.** 예전에는 `/bouncer-run`이 얼마나 자주
물어보는지를 정했지만, 위임 주행에서 승인은 시작 ACQ 하나뿐입니다. 두 값 모두
task별 ACQ를 열지 않고 보고 주기만 가릅니다 — `interactive`는 task 경계마다
진행 한 줄, `auto`는 마감 보고에 모아서. finalize의 동의 단계(
explain 퀴즈, remainder 커밋, PR, 다음 blueprint)는 어느 값에서도 사용자에게
남고, coordinator는 첫 동의 단계에서 멈춰 그 이름을 보고합니다.

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

## Canonical context retrieval

저장소 지식은 `.bouncer/context/**`만 정본이다. plan은 scaffold 전에 decision
mode, 경로 확정 뒤 implementation mode를 쓰며 과거 설명은 history mode로
찾는다. handoff는 query id, status, 선택 경로, graph version을 함께 보존한다.
version mismatch, broad query, zero hit은 진단으로 남기며 후보를 추측하지 않는다.

## verify 래퍼 패턴

`verify`는 **단일 실행 문자열**입니다. 런타임은 인용·공백을 보존한 argv로
파싱한 뒤 `shell: false`로만 돌립니다. `&&`·`;`·파이프·리디렉션·`cd` 접두나
미종료 인용이 들어가면 plan 게이트 `S12`와 런타임 `VERIFY_COMMAND_INVALID`에
걸립니다. argv0 실행 파일명이 허용 목록 밖이면 프로세스를 시작하기 전에 같은
코드로 거절합니다. **plan/S12**는 `tasks.bouncer.verify`를 기본 허용 목록만으로
검사하고, **런타임**(`config.verify`·`executeVerify`)은 저장소
`verify_allowlist`(없으면 기본 목록)를 씁니다. 컨테이너를 띄운 뒤 테스트를
돌리는 작업은 한 줄로 이을 수 없으니, 프로젝트 스크립트 하나로 감싸고 그
스크립트만 검증 명령으로 둡니다. 허용 목록에 없는 바이너리도 같은 방식으로
`npm run …`에 맡기세요. Windows에서는 PATH가 `npm.cmd`를 골라도 목록의 `npm`과
같습니다.

```json
{ "verify": "npm run test:e2e", "verify_allowlist": ["npm", "node"] }
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
`bouncer init`은 네 프로바이더 × 다섯 에이전트를 모두 `"inherit"`로 채워,
편집할 자리를 보여 줍니다.

```json
{
  "subagents": {
    "provider": "cursor",
    "claude": {
      "bouncer-reviewer": "inherit",
      "bouncer-implementer": "inherit",
      "bouncer-coordinator": "inherit"
    }
  }
}
```

- `"inherit"`(또는 빈 값·문자열 아닌 값)이면 부모 세션 모델을 그대로 씁니다.
- **Cursor와 Antigravity는 자동 판별되지 않습니다.** `subagents.provider`를 직접
  적으세요. `BOUNCER_HOME`은 플러그인 루트 오버라이드일 뿐 프로바이더 신호가
  아닙니다.
- 이미 `bouncer init`을 돌린 저장소는 `antigravity` 블록과
  `bouncer-coordinator` 키를 직접 추가해야 합니다. 없어도 부모 모델을
  상속하므로 깨지지는 않습니다.

## 컨텍스트 그래프

`context_dirs`의 빌드는 화이트리스트 섹션만 뽑은 파생 트리
`graphify-out/context-src/`를 스캔하고, `map.json`으로 결과 경로를 원본으로
되돌립니다. 화이트리스트는 다음과 같습니다.

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
