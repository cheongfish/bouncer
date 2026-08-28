---
type: bouncer.tasks
title: Codex 에이전트 파일 생성의 호스트 조건화
description: init이 Codex 신호가 없는 저장소에 .codex/agents/*.toml을 만들지 않게 하고 기존 저장소 동작은 유지한다
resource: .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-28T15:37:35.990+09:00'
bouncer:
  id: TASKS-003
  epic_id: '059'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - Claude만 쓰는 팀의 저장소에도 정체불명의 `.codex/` 디렉터리가 생김
    - 호스트 신호나 명시적 opt-in이 있을 때만 심도록 조건을 좁힘
  verify: npm run ci
  affected_paths:
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/codex-agents.ts
    - scripts/lib/codex-agents.js
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - test/init.test.js
    - test/cli-init.test.js
    - test/public-name-regression.test.js
    - skills/bouncer-init/SKILL.md
    - docs/ARCHITECTURE.md
    - docs/install.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T15:43:07.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/001
      - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/002
      - .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/tasks/003
    basis:
      - graph: source
        status: reused
        query: bouncer init base_branch default graphify venv install codex agents toml bootstrap commit scope gitignore
        result: 93 nodes, 3 files - test/init.test.js, test/public-name-regression.test.js, test/agents.test.js
      - graph: context
        status: updated
        query: init base_branch graphify venv codex agents bootstrap commit scope
        result: 3 files under epic 025 venv-install-bin-resolution tasks 001-003
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer init`이 호스트와 무관하게 `.codex/agents/*.toml` 네 개를 만드는 것을 멈춘다. Codex 신호(기존 `.codex/` 디렉터리)가 있거나 사용자가 명시적으로 opt-in했을 때만 심는다. `docs/ARCHITECTURE.md` A.5의 "Codex는 `agents/*.md`를 읽지 못하므로"라는 근거는 Codex 사용자에게만 해당하는 이유이므로, 그 문단도 조건화된 계약으로 다시 적는다. 이미 `.codex/`를 가진 저장소의 동작은 바뀌지 않는다.

## Interface
- 제공: `ensureCodexAgents` 호출이 조건부가 된다. 조건은 저장소에 `.codex/` 디렉터리가 이미 있거나 `init`이 opt-in 플래그를 받았을 때다.
- 제공: 조건을 만족하지 않으면 `init` 결과 `created[]`에 `.codex/` 경로가 들어가지 않고, 보고 문구도 `codex-agents-seeded`를 말하지 않는다.
- 거부: 이미 있는 `.codex/agents/*.toml`을 지우거나 옮기지 않는다. `# bouncer-generated` 표시가 없는 파일은 계속 사용자 소유다.
- 거부: 호스트를 추측해서 심지 않는다. 환경 변수나 실행 중인 CLI 이름으로 판정하지 않는다.

## Touch
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

## Do not touch
- `agents/` — 페르소나 원본은 하나로 유지한다는 결정을 바꾸지 않는다
- `.claude-plugin/`, `.cursor-plugin/`, `.codex-plugin/` — 호스트 매니페스트 분리는 그대로다
- `CLAUDE.md`
- `rules/`

## Constraints
- 기존 소비자 저장소에서 `init`을 다시 돌렸을 때 이미 있는 `.codex/agents/*.toml`이 사라지거나 내용이 바뀌지 않는다.
- 신호 판정은 파일시스템 사실만 본다. 환경 변수나 호스트 이름 추측을 넣지 않는다.
- `# bouncer-generated` 표시 규약을 그대로 유지한다.
- `scripts/src/lib/codex-agents.ts`의 기존 export(`mdToCodexToml`, `GENERATED_MARKER`) 시그니처를 바꾸지 않는다. `test/agents.test.js:210`이 그 둘을 직접 부르고, 그 파일은 이 task의 범위 밖이다.
- TS를 고치면 `npm run build` 산출물을 같은 커밋에 포함한다.

## Checklist
- [ ] `test/init.test.js`에 실패 테스트를 먼저 쓴다 — 신호 없는 빈 저장소에서:
      ```js
      assert.equal(result.created.filter((p) => p.startsWith('.codex/')).length, 0);
      ```
- [ ] `.codex/` 디렉터리를 미리 만든 픽스처에서 네 TOML이 그대로 생성되는지 단언한다
- [ ] 이미 `# bouncer-generated` 없는 TOML이 있는 픽스처에서 그 파일이 바뀌지 않는지 단언한다
- [ ] 위 테스트들이 실패하는 것을 확인한다
- [ ] `scripts/src/lib/codex-agents.ts`에 신호 판정을 두고 `init.ts` 호출 두 곳을 조건부로 바꾼다
- [ ] `scripts/src/lib/cli-project-commands.ts`의 `cmdInit`에서 opt-in 플래그를 읽어 `init()`에 넘긴다 (`--no-graphify` 등 기존 플래그와 같은 자리)
- [ ] `npm run build`로 산출물을 갱신한다
- [ ] `test/cli-init.test.js`에 opt-in 플래그 경로 단언을 더한다
- [ ] `skills/bouncer-init/SKILL.md`의 보고 문구를 조건부로 고친다
- [ ] `docs/ARCHITECTURE.md` A.5와 `docs/install.md`를 조건화된 계약으로 다시 적는다
- [ ] `test/public-name-regression.test.js`가 A.5 개정 문구로도 통과하는지 확인하고, 문구 단언이 깨지면 식별자 단언으로 좁혀 고친다
- [ ] `npm run ci`가 통과한다
