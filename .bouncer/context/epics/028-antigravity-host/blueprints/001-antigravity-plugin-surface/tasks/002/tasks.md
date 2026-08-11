---
type: bouncer.tasks
title: Antigravity 설치·설정 문서와 수동 확인 체크리스트
description: install/configuration/ARCHITECTURE/README에 Antigravity 호스트를 추가하고 릴리스 전 수동 확인 항목을 남긴다
resource: .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-11T18:00:54.377+09:00'
bouncer:
  id: TASKS-002
  epic_id: '028'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 설치 표면만으로는 플러그인 루트를 어디로 잡아야 하는지 알 길이 없는 상태임
    - CI에서 호스트를 띄울 수 없어 자동 검증 밖 항목을 수동 확인 목록으로 남김
  affected_paths:
    - docs/install.md
    - docs/configuration.md
    - docs/ARCHITECTURE.md
    - docs/contributing.md
    - README.md
  graph:
    generated_at: '2026-08-11T18:10:00.000+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - docs
    basis:
      - graph: source
        status: reused
        query: Antigravity host provider install documentation README ARCHITECTURE
        result: 구현 경로만 반환. config.source_dirs가 scripts/hooks/test라 docs·README는 그래프 밖 — 문서 경로는 수동으로 넣음
      - graph: context
        status: updated
        query: Antigravity host provider plugin manifest install docs
        result: 2 hits, 모두 .bouncer/context 문서. 이 태스크의 대상 문서(docs/, README.md)와 겹치지 않음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent

Antigravity 사용자가 문서만 보고 설치부터 첫 `/bouncer-plan`까지 갈 수 있다.
설치 명령, `BOUNCER_HOME` 설정, provider 명시, 그리고 CI가 판정할 수 없는
항목의 수동 확인 목록이 문서에 있다.

001이 만든 것(루트 `plugin.json`, `antigravity` provider 블록)을 전제로 한다.

## Interface

- 제공:
  - `docs/install.md`의 `## Antigravity` 절 — 설치 명령, `BOUNCER_HOME` export 예시, 릴리스 전 수동 확인 체크리스트.
  - `docs/configuration.md` `subagents` 절 — `subagents.provider: "antigravity"` 명시 요구와, 이미 `bouncer init`을 돌린 저장소는 블록을 직접 추가해야 한다는 안내.
  - `README.md`·`docs/ARCHITECTURE.md`의 호스트 열거에 Antigravity 추가.
  - `docs/contributing.md` 릴리스 절 — 버전이 일치해야 하는 매니페스트가 넷임을 반영.
- 거부:
  - 호스트가 `${CLAUDE_PLUGIN_ROOT}`를 치환한다고 단정해 적지 않는다. 확인되지 않았으므로 수동 확인 항목으로 적고, 실패 시 대체 경로를 함께 적는다.
  - provider 자동 감지가 되는 것처럼 적지 않는다. Antigravity는 Cursor와 같은 명시 pin 대상이다.
  - `agy plugin validate`를 필수 절차로 적지 않는다. `agy`가 없는 환경도 설치가 가능하다.

## Touch

- Modify `docs/install.md` — 첫 문단 호스트 열거에 Antigravity 추가, Codex 절 뒤에 `## Antigravity` 절 신설, `## 플러그인 루트 (BOUNCER_HOME)` 절에 이 호스트도 루트 변수가 없음을 반영.
- Modify `docs/configuration.md` — `subagents` 절의 호스트 열거와 "세 프로바이더" 서술을 넷으로 고치고, 같은 문장의 "두 에이전트"를 실제 `defaultConfig()`와 맞춰 셋으로 정정하며, `provider` 명시 대상에 Antigravity 추가. 기존 저장소의 config 갱신 안내도 여기에 둔다.
- Modify `docs/ARCHITECTURE.md` — 문서 목적을 밝히는 첫 문단(11행)의 호스트 열거에만 Antigravity를 추가한다.
- Modify `docs/contributing.md` — `## CI와 배포 계약`의 릴리스 문단에 매니페스트가 넷이 되었고 `claude plugin tag`의 검증 범위는 `.claude-plugin`까지임을 적는다.
- Modify `README.md` — 상단 호스트 링크 줄, Install 절의 `### Antigravity` 항목, 사전 요구사항 문장의 호스트 열거.

## Do not touch

- `docs/governance.md`, `docs/workflow.md`, `docs/okf.md` — 호스트 중립 문서다.
- `CLAUDE.md` — 플러그인 루트 해석 순서는 바뀌지 않는다.
- `hooks/hooks.json` — 훅 정의는 이 blueprint에서 바뀌지 않는다.

## Constraints

- 코드 표면(`plugin.json`, `scripts/**`, `test/**`)은 이 태스크에서 손대지 않는다. 001의 대상이므로 경로 금지가 아니라 분업 규칙으로 지킨다.
- `docs/ARCHITECTURE.md`의 §A.5(`Codex는 named agent 라우팅에서 제외한다`)는 그대로 둔다. Codex에 대한 서술이며 이번 호스트와 무관하게 참이다.
- `docs/ARCHITECTURE.md`에서 호스트를 열거하는 나머지 두 곳은 손대지 않는다. 19행은 계층 다이어그램이고, 106행은 Graphify가 지원하는 호스트 서술이다 — Graphify의 Antigravity 지원 여부는 확인되지 않았으므로 추가하면 거짓이 된다.
- 문서 본문은 한국어를 유지한다 (경로·식별자·코드 펜스 제외).
- 이미 확인된 사실과 확인되지 않은 사실을 섞어 적지 않는다. 미확인 항목은 수동 확인 체크리스트에만 둔다.
- 기존 절 구조와 표현 관례를 따른다. Cursor 절의 서술 순서(설치 → 스킬 탐색 → 훅 → `BOUNCER_HOME`)를 그대로 가져다 쓴다.
- 링크와 앵커가 깨지지 않게 한다. README의 호스트 링크는 `docs/install.md`의 새 앵커를 가리켜야 한다.

## Checklist

- [ ] `docs/install.md` 첫 문단의 `Claude Code · Cursor · Codex`를 네 호스트로 고친다.
- [ ] `docs/install.md`의 Codex 절 뒤에 `## Antigravity` 절을 추가한다. 다음을 담는다.
  - 같은 저장소가 Antigravity 플러그인이며 매니페스트는 **루트 `plugin.json`**이라는 사실. 카탈로그는 Codex와 공유하는 `.agents/plugins/marketplace.json`이다.
  - 설치 명령:

    ```
    agy plugin install <사내-git-url>
    ```

  - 스킬(`skills/*/SKILL.md`)과 named agent(`agents/*.md`)가 관례 경로로 그대로 잡힌다는 것. Codex와 달리 named agent가 지원되므로 fallback 경로로 내려가지 않는다.
  - `subagents.provider: "antigravity"`를 명시해야 한다는 것과 그 이유(플러그인 루트 환경 변수가 없어 자동 판별 신호가 없음).
  - `BOUNCER_HOME` export 예시:

    ```bash
    # scripts/bouncer 가 있는 디렉터리 — 실제 설치 경로로 바꾸세요
    export BOUNCER_HOME=~/.gemini/antigravity-ide/plugins/bouncer
    ```

- [ ] 같은 절에 릴리스 전 수동 확인 체크리스트를 넣는다. CI가 호스트를 띄울 수 없어 자동 검증 밖인 항목만 적는다.
  - `agy plugin validate <repo>`가 skills / agents / hooks를 processed로 보고하는가
  - 설치 후 `/bouncer-init`·`/bouncer-plan`이 스킬로 잡히는가
  - named agent(`bouncer-reviewer` 등)가 호출되는가
  - SessionStart 훅이 실제로 실행되는가 — 훅 command의 `${CLAUDE_PLUGIN_ROOT}` 치환 여부는 확인되지 않았다. 실행되지 않으면 graph sync와 legacy-id 경고를 CLI로 대신한다고 적는다.
  - 루트 `plugin.json`이 생긴 뒤에도 Claude Code와 Codex 설치가 그대로인가 — 두 카탈로그(`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`)가 저장소 루트를 가리키므로 로더가 새 매니페스트를 집어갈 여지가 있다. 두 호스트의 테스트는 `.claude-plugin/plugin.json`을 경로로 직접 읽어 이 회귀를 잡지 못한다.
- [ ] `docs/install.md`의 `## 플러그인 루트 (BOUNCER_HOME)` 절에서 루트 변수가 없는 호스트로 Cursor와 함께 Antigravity를 적는다. 해석 순서(`BOUNCER_HOME` → `CLAUDE_PLUGIN_ROOT` → `PLUGIN_ROOT`) 자체는 바뀌지 않는다.
- [ ] `docs/configuration.md` `subagents` 절의 `(Claude / Cursor / Codex)`와 "세 프로바이더" 서술을 넷으로 고치고, provider 명시 안내에 Antigravity를 Cursor와 같은 이유로 추가한다.
- [ ] 같은 문장의 "두 에이전트 (`bouncer-reviewer`, `bouncer-implementer`)"를 세 에이전트로 정정한다. `defaultConfig()`는 `bouncer-debugger`까지 채우므로 현재 서술이 틀렸다.
- [ ] 같은 절에 이미 `bouncer init`을 돌린 저장소는 `.bouncer/config.json`의 `subagents`에 `antigravity` 블록을 직접 추가해야 한다고 적는다. 블록이 없어도 `resolveSubagentModel`은 `{ model: null }`로 수렴해 부모 모델을 상속하므로 깨지지는 않는다는 것까지 함께 적는다.
- [ ] `docs/ARCHITECTURE.md` 첫 문단(11행)의 호스트 열거에 Antigravity를 추가한다. 19행 다이어그램과 106행 Graphify 서술은 건드리지 않는다.
- [ ] `docs/contributing.md`의 `## CI와 배포 계약` 릴리스 문단을 고친다. 버전이 일치해야 하는 매니페스트가 넷(`.claude-plugin` / `.cursor-plugin` / `.codex-plugin` / 루트)이고 `package.json`도 같은 값이며, `claude plugin tag`가 검증하는 범위는 `.claude-plugin`과 `marketplace.json`까지라는 것, 나머지는 `test/cursor-plugin.test.js`가 잡는다는 것을 적는다.
- [ ] `README.md` 상단 호스트 링크 줄에 Antigravity를 추가하고 `docs/install.md`의 새 앵커로 링크한다.
- [ ] `README.md` Install 절에 `### Antigravity`를 추가한다. 설치 명령과 `BOUNCER_HOME`·provider 설정은 `docs/install.md`로 링크한다.
- [ ] `README.md`의 사전 요구사항 문장(`Claude Code, Cursor, 또는 Codex`)에 Antigravity를 추가한다.
- [ ] `npm test`가 통과한다.
