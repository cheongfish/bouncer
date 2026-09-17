---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/007-install-first-five-minutes/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T16:46:19.040+09:00'
bouncer:
  id: EXPLAIN-007
  epic_id: '001'
  blueprint_id: '007'
  status: published
  comprehension:
    - range_from: develop
      range_to: 4d40f1dc7db521618fda390f9c4424df83d49f23
      diff_sha: 939e69a511863c9de7c1a99ba00a382acf8e714e551a634f33d74c66eae131c3
      quiz_score: 3/4
      disposition: 4문항 중 3정답. venv 신규 위치를 레거시 .bouncer/.venv로 골랐음.
      recorded_at: '2026-08-28T16:49:08+09:00'
---
# Explain

## Background
`bouncer init`이 빈 저장소에 네 가지를 남겼다. `base_branch`와 `pr.base`가 `develop` 리터럴이고, graphify venv가 `.bouncer/.venv/`에 생기며, Claude만 쓰는 저장소에도 `.codex/agents/*.toml`이 생기고, README가 `git add .bouncer`를 가르쳤다. 파일럿이 첫 5분에 만나는 부작용이라 한 PR에서 네 커밋으로 끊었다.

## Intuition
설치는 소비자 작업 트리에 추정값과 호스트 파일을 심지 않고, 커밋 안내도 필요한 경로만 적는다.

## Code
- `scripts/src/lib/init.ts` — `detectDefaultBranch`: `origin/HEAD` 다음 `HEAD`. 실패하면 두 키를 쓰지 않고 `baseBranchUnresolved`를 싣는다. `inspectBootstrap`은 `base_branch` 부재를 `partial`로 보지 않는다.
- `scripts/src/lib/cli-current-command.ts` — `--set` base는 `config.base_branch` 다음 체크아웃 브랜치. HEAD가 아니면 빈 문자열을 쓰지 않고 exit 1.
- `scripts/src/lib/graphify.ts` — 신규 venv는 `<git-common-dir>/bouncer/venv`. 이미 `.bouncer/.venv/`가 있으면 그대로 쓴다. 비-git은 레거시 폴백. 이번 실행이 만든 디렉터리만 실패 시 지운다.
- `scripts/src/lib/codex-agents.ts` — `shouldEnsureCodexAgents`: `.codex/` 존재 또는 `seedCodexAgents`. CLI 플래그는 `--seed-codex-agents`.
- 안내: `README.md`, `docs/context-versioning.md`, `skills/bouncer-init/SKILL.md`가 `git add .bouncer/config.json .bouncer/context .bouncer/Distill.md`를 쓴다. `.codex/agents`는 스킬에서만 조건부.

## Quiz
1. `init`이 기본 브랜치를 탐지하지 못하면 `config.json`에 무엇을 쓰는가?
   - A) `base_branch`와 `pr.base`에 `main`
   - B) 두 키를 쓰지 않고 반환 JSON에 `baseBranchUnresolved`
   - C) `base_branch`만 `develop`, `pr.base`는 비움
2. 신규 graphify venv 후보는 어디에 놓이는가?
   - A) `<git-common-dir>/bouncer/venv`
   - B) 저장소 루트의 `.bouncer/.venv`
   - C) `node_modules/.graphify`
3. `.codex/agents/*.toml`을 심는 조건은?
   - A) 실행 중인 CLI 이름이 `codex`이면
   - B) 항상 네 파일을 만든다
   - C) `.codex/`가 이미 있거나 `--seed-codex-agents`
4. 부트스트랩 커밋 안내가 스테이징하는 경로는?
   - A) `git add .bouncer`
   - B) `.bouncer/config.json`, `.bouncer/context`, `.bouncer/Distill.md`
   - C) `git add -A`

## 이해 상태
퀴즈 3/4. 정답 B / A / C / B. 응답 B / B / C / B. 문항 2만 오답(신규 venv를 `.bouncer/.venv`로 봄). disposition: venv 신규 위치를 레거시 경로로 골랐음.

## Tasks

### Task 001

#### Goal & intent

`bouncer init`이 `config.json`의 `base_branch`와 `pr.base`를 저장소에서 탐지해 쓴다. `git init -b main` 저장소에서 `init`을 돌리면 두 값이 `main`이어야 하고, 탐지할 수 없는 저장소에서는 값을 추측하지 않고 `/bouncer-init`이 사용자에게 묻는다. 지금은 `scripts/src/lib/init.ts:72`와 `pr.base`가 `'develop'` 리터럴이라, 사용자는 첫 `/bouncer-finalize`에서 draft PR이 없는 base를 향할 때까지 이 사실을 모른다.

#### Interface

- 제공: `init.ts`에 기본 브랜치 탐지를 더한다. 순서는 `git symbolic-ref --short refs/remotes/origin/HEAD`의 `origin/` 접두사를 뗀 값 → `git symbolic-ref --short HEAD`. 첫 성공값을 `base_branch`와 `pr.base`에 함께 쓴다.
- 제공: 둘 다 실패하면 `config.json`에 두 키를 쓰지 않고, `init` 반환 JSON에 미해결 신호를 실어 `/bouncer-init`이 브랜치 ACQ를 띄운다.
- 거부: 탐지 실패를 `develop`이나 `main`으로 대체하지 않는다. 예외를 밖으로 던지지 않고 미해결로 수렴한다.
- 제공: `bouncer current --set`의 base 결정에서도 `'develop'` 리터럴을 없앤다. 순서는 `config.base_branch` → 현재 체크아웃 브랜치. 지금은 `scripts/src/lib/cli-current-command.ts:126`이 config에 키가 없으면 `'develop'`으로 떨어지는데, 이 task가 탐지 실패 시 키를 비우기로 하면서 그 경로가 오히려 더 자주 밟힌다.
- 거부: 이미 `base_branch`가 있는 소비자 `config.json`을 다시 쓰지 않는다 — 기존 멱등 계약 그대로다.
- 거부: `config.example.json`의 `base_branch`·`pr.base` **키를 지우지 않는다**. 바꾸는 것은 값뿐이다. `test/public-contract.test.js`가 예시 config의 최상위 키 집합과 `docs/compatibility.md` 「설정 키」 표를 대조하므로, 키를 없애면 두 파일이 함께 열려야 한다.

#### Touch

- Modify `scripts/src/lib/init.ts` — 기본 브랜치 탐지와 미해결 신호를 더하고 `'develop'` 리터럴 두 곳을 없앤다
- Modify `scripts/lib/init.js` — 위 변경의 `tsc` 산출물. `check:emit`이 대조한다
- Modify `scripts/src/lib/cli-current-command.ts` — base 결정의 `'develop'` 리터럴을 현재 브랜치 폴백으로 바꾼다
- Modify `scripts/lib/cli-current-command.js` — 위 변경의 `tsc` 산출물
- Modify `test/cli-current.test.js` — config에 `base_branch`가 없을 때 base가 `'develop'`이 아니라 현재 브랜치인지 단언한다
- Modify `test/init.test.js` — `main` 탐지·`origin/HEAD` 탐지·탐지 실패 미해결·기존 config 보존 네 경로를 단언한다
- Modify `test/cli-init.test.js` — CLI 반환 JSON에 미해결 신호가 실리는지 단언한다
- Modify `config.example.json` — `base_branch`·`pr.base`의 **값**만 중립적인 예시로 바꾼다. 키는 유지한다
- Modify `docs/configuration.md` — `base_branch`·`pr.base`의 결정 방식을 탐지 순서와 미해결 동작으로 다시 적는다
- Modify `skills/bouncer-init/SKILL.md` — 미해결 신호가 왔을 때의 브랜치 ACQ를 step 3 동의 게이트에 더하고 게이트 목록에 반영한다

#### Constraints

- `git` 호출 실패는 예외로 밖에 나가지 않고 미해결로 수렴한다. detached HEAD와 원격 없는 저장소가 같은 경로를 탄다.
- `base_branch`와 `pr.base`는 항상 같은 탐지 결과를 쓴다. 두 값이 갈라지는 경로를 만들지 않는다.
- 공개 문자열과 문서 본문은 한국어를 유지한다.
- `config.example.json`의 최상위 키 집합을 바꾸지 않는다. 바꾸면 `test/public-contract.test.js`와 `docs/compatibility.md`가 같은 커밋에 들어와야 하고, 그것은 이 task의 범위가 아니다.
- TS를 고치면 `npm run build` 산출물 `scripts/lib/*.js`를 같은 커밋에 포함한다. 빠지면 `npm run ci`의 `check:emit`이 막는다.

### Task 002

#### Goal & intent

graphify venv를 `.bouncer/.venv/`에서 git common directory 아래(`<git-common-dir>/bouncer/venv`)로 옮긴다. 그러면 venv가 작업 트리 밖에 있으므로 `git add`로 스테이징될 수 없고, `.gitignore` 동의 여부와 무관하게 B1의 재현이 사라진다. 함께, 설치가 중간에 실패하면 만들다 만 venv 디렉터리를 지우고 `graphify.enabled`를 `false`로 내린다. 위치 결정은 `runtime-state.ts`가 이미 쓰는 common directory 규약을 재사용한다 — 새 경로 개념을 만들지 않는다.

#### Interface

- 제공: `graphify.ts`의 venv 실행 파일·pip 경로가 저장소 상대 경로 대신 common directory 기준 절대 경로를 쓴다. Windows(`Scripts/graphify.exe`, `Scripts/pip.exe`)도 같은 기준을 따른다.
- 제공: 설치 실패 시 이번 실행이 만든 venv 디렉터리를 지운 뒤 실패 결과를 반환한다.
- 거부: `init`을 실패시키지 않는다. graphify 설치 실패는 지금처럼 soft-fail이고 종료 코드는 0이다.
- 거부: 이미 `.bouncer/.venv/`를 가진 저장소를 강제로 이전하거나 지우지 않는다. 그 경로가 존재하면 후보 탐색이 계속 그것을 찾아 쓴다.
- 제공: git 저장소가 아닌 디렉터리에서는 common directory가 없으므로 기존 `.bouncer/.venv` 위치로 폴백한다. `init`은 비-git 디렉터리에서도 지원되고 현재 픽스처가 그렇다(`test/cli-init.test.js:44`).
- 제공: 같은 실행 안에서 설치를 시도했는지와 `config.graphify.enabled`에 기록되는 값이 어긋나지 않는다 — 감사 B4가 지적한 config 모순의 나머지 절반이다.
- 거부: 이번 실행이 만들지 않은 디렉터리를 지우지 않는다.
- 하위 호환: epic 025 blueprint 001이 `config.graphify.bin`을 저장소 루트 기준 상대 경로로 정했다. 이 task는 새로 기록하는 값만 새 위치의 절대 경로로 바꾸고, 기존 상대 경로 값은 계속 유효하게 해석한다. 소비자 config를 다시 쓰지 않는다.

#### Touch

- Modify `scripts/src/lib/graphify.ts` — venv 실행 파일·pip 경로 결정을 common directory 기준으로 바꾸고, 실패 시 이번 실행 산출물만 정리한다
- Modify `scripts/lib/graphify.js` — 위 변경의 `tsc` 산출물
- Modify `scripts/src/lib/init.ts` — `SUGGESTED_IGNORES`에서 `.bouncer/.venv/`의 처지를 새 위치에 맞게 정리하고, 설치 호출부가 새 경로 결과를 그대로 기록하게 한다
- Modify `scripts/lib/init.js` — 위 변경의 `tsc` 산출물
- Modify `test/graphify.test.js` — 새 위치 결정, Windows 분기, 실패 시 정리, 기존 `.bouncer/.venv/` 재사용 네 경로를 단언한다
- Modify `test/init.test.js` — `init` 뒤 작업 트리에 venv 경로가 생기지 않는지, 설치 시도와 기록된 `enabled`가 일치하는지 단언한다
- Modify `test/cli-init.test.js` — `.gitignore` 마커 블록 단언(`:52`)이 `SUGGESTED_IGNORES` 변경과 어긋나지 않게 맞춘다
- Modify `docs/configuration.md` — `graphify.bin`이 가리키는 위치를 새 규약으로 적는다
- Modify `docs/troubleshooting.md` — venv 위치를 찾는 안내를 새 경로로 고친다
- Modify `docs/install.md` — 설치 산출물이 저장소 밖에 놓인다는 사실을 적는다

#### Constraints

- 후보 탐색 순서 `config.graphify.bin` → venv → PATH를 바꾸지 않는다. 바뀌는 것은 venv 후보가 가리키는 위치뿐이다.
- 기존 소비자 저장소의 `config.graphify.bin` 값은 유효한 한 그대로 쓴다. 경로 이전 마이그레이션을 넣지 않는다.
- 정리는 이번 실행이 만든 디렉터리에 한정한다. 존재하던 디렉터리를 재사용한 경우 실패해도 지우지 않는다.
- TS를 고치면 `npm run build` 산출물을 같은 커밋에 포함한다.
- `scripts/src/lib/scope.ts`의 `RUNTIME_ARTIFACTS`에 있는 `.bouncer/.venv/`는 그대로 둔다. 레거시 저장소와 비-git 폴백이 여전히 그 경로를 쓴다.
- epic 025 blueprint 001의 venv 위치 결정(``.bouncer/.venv``)을 이 task가 대체한다. 그 blueprint 문서는 닫혀 있으므로 소급 수정하지 않고, 새 결정은 이 task와 `docs/`에만 적는다.

### Task 003

#### Goal & intent

`bouncer init`이 호스트와 무관하게 `.codex/agents/*.toml` 네 개를 만드는 것을 멈춘다. Codex 신호(기존 `.codex/` 디렉터리)가 있거나 사용자가 명시적으로 opt-in했을 때만 심는다. `docs/ARCHITECTURE.md` A.5의 "Codex는 `agents/*.md`를 읽지 못하므로"라는 근거는 Codex 사용자에게만 해당하는 이유이므로, 그 문단도 조건화된 계약으로 다시 적는다. 이미 `.codex/`를 가진 저장소의 동작은 바뀌지 않는다.

#### Interface

- 제공: `ensureCodexAgents` 호출이 조건부가 된다. 조건은 저장소에 `.codex/` 디렉터리가 이미 있거나 `init`이 opt-in 플래그를 받았을 때다.
- 제공: 조건을 만족하지 않으면 `init` 결과 `created[]`에 `.codex/` 경로가 들어가지 않고, 보고 문구도 `codex-agents-seeded`를 말하지 않는다.
- 거부: 이미 있는 `.codex/agents/*.toml`을 지우거나 옮기지 않는다. `# bouncer-generated` 표시가 없는 파일은 계속 사용자 소유다.
- 거부: 호스트를 추측해서 심지 않는다. 환경 변수나 실행 중인 CLI 이름으로 판정하지 않는다.

#### Touch

- Modify `scripts/src/lib/init.ts` — `ensureCodexAgents` 호출 두 곳을 조건부로 바꾸고 opt-in 플래그를 받는다
- Modify `scripts/lib/init.js` — 위 변경의 `tsc` 산출물
- Modify `scripts/src/lib/codex-agents.ts` — 조건 판정에 필요한 신호 확인을 이 모듈에 둔다
- Modify `scripts/lib/codex-agents.js` — 위 변경의 `tsc` 산출물
- Modify `scripts/src/lib/cli-project-commands.ts` — `cmdInit`에서 opt-in 플래그를 읽어 `init()` 인자로 넘긴다. `cli-flags.ts`는 범용 토크나이저라 손대지 않는다
- Modify `scripts/lib/cli-project-commands.js` — 위 변경의 `tsc` 산출물
- Modify `test/init.test.js` — 신호 없는 저장소에서 `.codex/` 미생성, 신호 있는 저장소에서 기존 동작 유지 두 경로를 단언한다
- Modify `test/cli-init.test.js` — opt-in 플래그가 생성을 켜는지 단언한다
- Modify `skills/bouncer-init/SKILL.md` — `codex-agents-seeded` 보고 조건과 opt-in 안내를 고친다
- Modify `test/public-name-regression.test.js` — `docs/ARCHITECTURE.md`·`docs/install.md`의 문구를 읽는 단언이 있어 A.5 개정과 같은 커밋에서 맞춘다
- Modify `docs/ARCHITECTURE.md` — A.5의 근거를 "Codex 사용자에게만 적용된다"는 조건부 계약으로 다시 적는다
- Modify `docs/install.md` — Codex 사용자가 opt-in하는 방법을 적는다

#### Constraints

- 기존 소비자 저장소에서 `init`을 다시 돌렸을 때 이미 있는 `.codex/agents/*.toml`이 사라지거나 내용이 바뀌지 않는다.
- 신호 판정은 파일시스템 사실만 본다. 환경 변수나 호스트 이름 추측을 넣지 않는다.
- `# bouncer-generated` 표시 규약을 그대로 유지한다.
- `scripts/src/lib/codex-agents.ts`의 기존 export(`mdToCodexToml`, `GENERATED_MARKER`) 시그니처를 바꾸지 않는다. `test/agents.test.js:210`이 그 둘을 직접 부르고, 그 파일은 이 task의 범위 밖이다.
- TS를 고치면 `npm run build` 산출물을 같은 커밋에 포함한다.

### Task 004

#### Goal & intent

README·문서·`/bouncer-init`이 안내하는 부트스트랩 커밋 명령을 `git add .bouncer`에서 명시적 경로 목록으로 좁힌다. task 002가 venv를 작업 트리 밖으로 옮겨 재현은 이미 끊기지만, 안내 자체가 "디렉터리 통째로 담기"를 가르치는 한 다음 설치 산출물이 생기면 같은 일이 반복된다. 커밋해야 하는 것은 `config.json`·`context/`·`Distill.md` 셋이고, Codex 파일은 task 003 이후 조건부이므로 안내도 조건부여야 한다.

#### Interface

- 제공: 세 곳(`README.md`, `docs/context-versioning.md`, `skills/bouncer-init/SKILL.md`)의 커밋 명령이 같은 명시적 경로 목록을 쓴다.
- 제공: `.codex/agents`는 그 디렉터리가 실제로 생성됐을 때만 안내에 포함된다.
- 거부: `git add .bouncer` 또는 `git add -A` 형태를 안내에 남기지 않는다.
- 거부: 커밋을 대신 실행하지 않는다. 부트스트랩 기록은 사용자의 결정이라는 기존 문장을 유지한다.

#### Touch

- Modify `README.md` — Quickstart의 `git add .bouncer`를 경로 목록으로 바꾼다
- Modify `docs/context-versioning.md` — 같은 명령을 같은 목록으로 맞춘다
- Modify `skills/bouncer-init/SKILL.md` — step 4의 명령과 그 아래 두 이유 문장을 새 목록에 맞춘다. `.codex/agents`는 조건부로 적는다
- Modify `docs/install.md` — 부트스트랩 커밋 절이 있으면 같은 목록으로 맞춘다

#### Constraints

- 세 곳의 명령 문자열이 서로 어긋나지 않는다. 한 곳을 고치면 나머지도 같은 커밋에서 고친다.
- 한국어 본문을 유지한다.
- 문서 문구를 단언하는 테스트를 새로 추가하지 않는다 — ADR G절의 "식별자만 단언한다" 방침을 따른다.
- 커밋 명령은 `.gitmessage` 규약의 `chore:` 타입을 유지한다.
