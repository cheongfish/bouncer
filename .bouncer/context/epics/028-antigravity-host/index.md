---
type: bouncer.epic
title: Antigravity 호스트 지원
description: Bouncer를 Antigravity에서 설치·구동 가능한 네 번째 호스트로 넓힌다
resource: .bouncer/context/epics/028-antigravity-host/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-11T18:00:54.314+09:00'
bouncer:
  id: '028'
  epic_id: '028'
  status: approved
---
# 028 antigravity-host

## Intent
- 문제: Bouncer는 Claude Code / Cursor / Codex 셋에서만 설치된다. Antigravity 사용자는 같은 저장소를 붙일 표면이 없고, `subagents`는 그 호스트의 model 이름을 담을 자리조차 없다.
- 목표: 같은 저장소가 Antigravity 플러그인으로도 설치되고, named agent 라우팅이 살아 있는 상태로 `/bouncer-init` → `/bouncer-plan`이 돈다.

## Success criteria
1. `agy plugin validate <repo>`가 skills / agents / hooks를 모두 processed로 보고한다.
2. `.claude-plugin` / `.cursor-plugin` / `.codex-plugin`의 매니페스트와 루트 `plugin.json`이 같은 `name`·`version`을 갖는다.
3. `subagents.provider: "antigravity"`가 `resolveSubagentModel`에서 `antigravity` 블록으로 해석되고, 환경 변수만으로는 provider가 `antigravity`가 되지 않는다.
4. `bouncer init`이 쓰는 기본 config의 `subagents`에 `antigravity` 블록이 있다.
5. `docs/install.md`에 설치 명령, `BOUNCER_HOME` export, 릴리스 전 수동 확인 체크리스트가 있고 README·`docs/ARCHITECTURE.md`의 호스트 목록에 Antigravity가 들어간다.
6. `npm test`가 통과한다.

## Out of scope
- Gemini CLI(`~/.gemini/extensions`, `gemini-extension.json`) 지원 — 호스트가 다르고 매니페스트 형식도 다르다.
- `commands/` 디렉터리와 `global_workflows` 이식 — 스킬 자동 발견으로 워크플로가 이미 닿는다.
- 환경 변수 기반 provider 자동 감지 — Antigravity는 플러그인 루트 env를 내보내지 않고, 추측 감지는 조용한 오라우팅을 만든다.
- CI에서 실제 Antigravity 세션 실행 — 자동 검증은 매니페스트와 경로까지다.

## Blueprints
* [001 antigravity-plugin-surface](blueprints/001-antigravity-plugin-surface/index.md) - 루트 `plugin.json` 배포 표면과 `antigravity` provider 배선을 만들고(`scripts/src/lib/init.ts`, 테스트), 설치·설정 문서(`docs/install.md`, `README.md`)에 호스트를 추가한다
