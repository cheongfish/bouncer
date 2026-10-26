# 설정 (`.bouncer/config.json`)

`/bouncer-init`이 기본값을 만들어 줍니다. 프로젝트에 맞게 `verify`와
`source_dirs`부터 고치세요. 전체 기본 형태는 저장소 루트
[`config.example.json`](../config.example.json)에 있습니다.

## 필드

| 필드 | 설정할 수 있는 값 | 쓰는 곳 | 예시 |
| --- | --- | --- | --- |
| `verify` | 단일 실행 문자열 (`&&`·`;`·파이프·리디렉션·`cd` 불가 → `S12`). 실행 시 argv로 파싱되며 `shell: false` | **execute 게이트(G13)**, `/bouncer-plan`이 blueprint별 `tasks.bouncer.verify` 제안 | `"npm test"` · `"make test"` · `"npm run test:e2e"` |
| `verify_allowlist` | argv0 실행 파일명 문자열 배열. Windows에서는 `npm.cmd`·`node.exe`처럼 관용 확장자를 벗긴 뒤 비교 | 런타임 검증 실행 직전 허용 목록. 없거나 배열이 아니면 기본값(`npm`·`node`·`make` 등). plan/S12의 `tasks.bouncer.verify` 검사는 이 키가 아니라 기본 목록만 사용 | `["npm", "node", "make"]` |
| `worktree.setup` | 단일 실행 문자열 (선택). `verify`와 같은 argv 규칙(`&&`·`;`·파이프·리디렉션 불가)과 `verify_allowlist`를 적용 | worktree 의존성 준비(`seed-worktree`·finalize) 끝에 worktree에서 한 번 실행. **main checkout의 config**에서 읽는다. 허용 목록 밖·형식 오류·실행 실패는 `dependency-install-failed`(message가 `worktree.setup`으로 시작) | `"npm run build"` |
| `source_dirs` | 저장소 상대 디렉터리 배열 | `/bouncer-init`(자동 채움), `graphify-runner` 소스 그래프 입력 | `["src", "scripts"]` |
| `graphify.test_dirs` | 저장소 상대 디렉터리 배열 (선택) | 테스트 그래프 입력 → `graphify-out/test` | `["test"]` · `["tests"]` |
| `graphify.exclude_dirs` | 저장소 상대 prefix 배열 (선택) | source 병합 뒤 제거할 경로 prefix | `["scripts/lib"]` |
| `base_branch` | 브랜치 이름 | `/bouncer-run` worktree 기준. `/bouncer-finalize` PR는 `pr.base`가 없으면 이 값, 없으면 `origin/HEAD`, 없으면 사용자에게 묻기 | `"main"` · `"develop"` |
| `autonomy` | `"auto"` \| `"interactive"` | `/bouncer-run` 위임 주행의 **보고 주기** | `"auto"` (마감 보고에 모아서) · `"interactive"` (task 경계마다 진행 한 줄) |
| `coordinator.max_parallel` | 정수 `>= 1` (선택). 부재 시 `2` | `bouncer coordinate prepare`가 한 wave에서 여는 lease 수 상한. 잘못된 값이면 prepare가 `coordinator-config-invalid`로 거절 | `2` · `1` |
| `coordinator.waves_per_session` | `"auto"` \| 정수 `1`–`8` (선택). 부재 시 `"auto"`(상한 4) | 한 coordinator 세션이 처리할 직렬·무예외 wave 수 상한. `coordinate next`가 상한에 닿았거나 예외·병렬 wave가 끼면 `yield`로 세션을 끊도록 알린다. 그 밖의 값이면 prepare가 `coordinator-config-invalid`로 거절하고 읽기 전용 `next`는 상한 1로 접는다 | `"auto"` · `1` (wave마다 새 세션) |
| `metrics.pricing` | `{ "<모델 slug>": { "input_per_mtok": 수, "output_per_mtok": 수 } }` (선택). 단가는 0 이상 유한 수 | `bouncer metrics end`가 `--model`과 입력·출력 토큰이 모두 있을 때만 비용을 계산하는 단가표(100만 토큰당). 없으면 비용은 `null`과 `no-pricing` 사유로 남고, 모양이 틀리면 `invalid-pricing` | `{"claude-sonnet-4": {"input_per_mtok": 3, "output_per_mtok": 15}}` |
| `coordinator.direct_max_commit_tasks` | 정수 `>= 0` (선택). 부재 시 `3` | 시작 ACQ가 "직접 실행(coordinator 없음)"을 보이는 직렬 full 드라이브의 열린 commit task 수 상한. `0`이면 끄고, 정수가 아니거나 음수면 preflight가 `0`으로 접어 꺼진 것으로 본다(드라이브는 실패하지 않음) | `3` · `0` |
| `graphify.enabled` | `true` \| `false` | `/bouncer-init`, `graphify-runner`, SessionStart 훅 | `true` — 끄면 `affected_paths`를 수동으로 채웁니다 |
| `graphify.bin` | 실행 파일 경로 (절대 또는 저장소 상대) | `bouncer graphify-bin` 해석 1순위 | git common dir 아래 절대 경로 · `".bouncer/.venv/bin/graphify"` |
| `pr.draft` | `true` \| `false` | `/bouncer-finalize` | `true` |
| `pr.base` | 브랜치 이름 | `/bouncer-finalize` PR 기준. 없으면 `base_branch` → `origin/HEAD` → 사용자에게 묻기 | `"main"` |
| `subagents.provider` | `"claude"` \| `"cursor"` \| `"codex"` \| `"antigravity"` | 호스트 판별 — Cursor·Antigravity는 **직접 지정 필수** | `"cursor"` |
| `subagents.<provider>.<agent>` | `"inherit"` \| 호스트 모델 slug | `/bouncer-plan`·`/bouncer-run`의 named 서브에이전트 디스패치 | `"inherit"` (부모 세션 모델 상속) |
| `subagents.dispatch` | `"print"` \| 없음 | Cursor 전용 opt-in — 모든 서브에이전트를 `agent --print` 프로세스로 띄움 | 없음 (호스트 Task 서브에이전트) |

`bouncer init`은 새 config를 만들 때 `package.json`에 `scripts.build`가 있으면 `worktree.setup`을 `"npm run build"`로 넣습니다. 이미 있는 config에는 자동으로 들어가지 않으니 필요하면 직접 추가하세요.

`<agent>`는 `bouncer-implementer` · `bouncer-reviewer` · `bouncer-debugger` ·
`bouncer-context-reviewer` · `bouncer-coordinator` 다섯입니다.

`bouncer-coordinator`는 `/bouncer-run`이 시작 ACQ 뒤 한 번 부르는 주행
컨트롤러입니다. drive 전체를 끌고 가는 역할이라 worker와 다른 모델을 고르고
싶을 수 있어 슬롯을 따로 둡니다. 값의 의미는 나머지 넷과 같고
(`"inherit"`이면 부모 세션 모델), 호스트가 named agent를 로드하지 못하면 같은
coordinator 역할 전체를 실은 generic 서브에이전트 하나로 폴백합니다 — 축약한
brief로 대신하지 않습니다. 모델 거절은 named-agent 부재가 아니므로 중단하고
거절 사유와 설정 위치를 사용자에게 알려야 합니다. 이미 `bouncer init`을 돌린 config에는 이 키가
없을 수 있는데, 없어도 부모 모델을 상속하므로 동작은 같습니다.

**직접 실행(선택).** `direct_eligible`(위임 가능한 full 직렬 체인이고 commit task 수가
`coordinator.direct_max_commit_tasks` 이하)일 때 시작 ACQ는 D를 권장하고,
그렇지 않으면 D 없이 A를 권장합니다. D를 고르면 root가 coordinator 없이
`coordinate advance`를 돌리고 worker는 서브에이전트로 띄웁니다.
direct 실행은 attempt 1의 `rework`와 `must_fix` 없는 최종 리뷰까지 처리한다.
그 뒤의 재작업,
수정이 필요한 리뷰, 기타 지원하지 않는 정지는 coordinator에 넘깁니다.

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
없어도 `graph-sync`의 `graphs[]`는 언제나 source·test 두 항목을
보고합니다 — 미설정·무효 test 항목은 `action: skip-unconfigured`로 남고
빌드·`missing`·SessionStart 경고 대상이 아닙니다. 빌드되는 그래프 수와
보고되는 스코프 수가 다를 수 있습니다. SessionStart 훅이 stderr에 쓰는 경고는 `bouncer graph-sync` JSON의
`warnings` 필드(문자열 배열, 끝 개행 포함)와 같은 문구입니다. 키가 있으면 문자열 배열이어야 하고,
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

### 드라이브 토큰·시간 보고

`bouncer metrics`는 드라이브 중 세션별 토큰과 시간을 항상 `.bouncer/runtime/drive-metrics.json`
(gitignore)에 기록합니다. 마감 보고에 그 표를 보일지는 설정 파일이 아니라 환경 변수가 정합니다.
`BOUNCER_METRICS_REPORT=1`인 셸에서만 `bouncer metrics summary`가 `report: true`를 내고
`/bouncer-run`·`/bouncer-finalize`가 표를 사용자에게 보고합니다. 변수가 없으면 `report: false`이고
토큰·시간·비용 수치를 출력하지 않습니다. 비용 계산에는 위 `metrics.pricing`이 필요합니다.

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

키 이름·허용값·기본값의 원본은 `bouncer config --help` 출력이고, 위 표는 테스트가
그 출력과 맞는지 확인합니다.

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
- Plan·execute 기록의 모델명은 설정에서 읽은 관찰값이며 호스트가 실제로 실행한
  모델의 증거가 아닙니다. 호스트가 설정 모델을 거절하면 자동으로 `inherit`, 부모
  모델, 별칭 또는 generic fallback으로 우회하지 말고 중단하세요. 사용자에게
  프로바이더, 역할, 설정 모델명, 호스트가 돌려준 거절 사유와 수정할 설정 위치를
  알립니다. 호스트가 지원 모델명을 직접 반환한 경우에만 그 원문을 안내합니다.
- Claude Code hook의 `additionalContext`가 모델·프로바이더 등 디스패치 사실을
  바꾸면 해당 변경을 사용자에게 알리세요. 설정 모델 거절과 구분해 추가 지시가
  디스패치에 미친 사실을 그대로 전달합니다.
- **Cursor와 Antigravity는 자동 판별되지 않습니다.** `subagents.provider`를 직접
  적으세요. `BOUNCER_HOME`은 플러그인 루트 오버라이드일 뿐 프로바이더 신호가
  아닙니다.
- **`subagents.dispatch: "print"` (Cursor 전용, 선택).** Cursor는 Task
  서브에이전트의 토큰 사용량을 어디에도 남기지 않습니다. 이 값을 켜면 coordinator와
  모든 worker·reviewer를 Task 대신 각각 별도의 `agent --print` 프로세스로 띄워,
  에이전트마다 세션 로그에 사용량이 남습니다. 디스패치는
  `bouncer dispatch print`가 맡습니다. `agent` CLI가 설치되어 있고
  `agent status`가 로그인 상태여야 합니다. 대신 IDE의 서브에이전트 화면에는
  나타나지 않고, 각 프로세스의 출력은 파일로만 남습니다. `provider`가 `cursor`가
  아니면 무시됩니다. 자세한 실행 방식은
  [`rules/cursor-print-dispatch.md`](../rules/cursor-print-dispatch.md)에 있습니다.
- 이미 `bouncer init`을 돌린 저장소는 `antigravity` 블록과
  `bouncer-coordinator` 키를 직접 추가해야 합니다. 없어도 부모 모델을
  상속하므로 깨지지는 않습니다.

Graphify 설치와 오프라인 폴백은 [install.md](install.md#선택-graphify-경로-추천)에
있습니다.

## epic 등록부 `.bouncer/epics.json`

config 키가 아니라 별도 파일입니다. `bouncer init`이 `.bouncer/epics.json`이 없을 때
프로필에 맞춰 만들고, 이미 있으면 건드리지 않습니다.

- `standard`(기본): 공통 epic 8개(`foundation`, `core`, `data`, `integration`,
  `identity-access`, `interface`, `features`, `quality-ops`)를 `draft` 상태로 scaffold합니다.
- `domain-only`: 공통 epic을 만들지 않습니다. 기존 epic은 모두 `legacy`로 등록합니다.
- `--domain-epic-limit <n>`: 도메인 epic 상한(0 이상 정수, 기본 0).
- 이미 초기화된 저장소에서 다시 실행하면 기존 epic 디렉터리를 등록합니다. 공통 slug와
  같은 epic은 그 ID를 재사용하고 나머지는 `legacy`로 두며, 기존 파일 내용은 바꾸지 않습니다.
  같은 공통 slug의 디렉터리가 둘 이상이면 등록부를 쓰지 않고 실패합니다.

---

프로젝트 설정은 `.bouncer/config.json`에 둡니다. blueprint 크기·OKF 정렬 같은 제품
규칙은 플러그인의 [`rules/`](../rules/)에 있고 프로젝트로 복사되지 않습니다. 제품
게이트와 CLI 사용 규칙은
[`rules/cli.md`](../rules/cli.md)에 있습니다.
