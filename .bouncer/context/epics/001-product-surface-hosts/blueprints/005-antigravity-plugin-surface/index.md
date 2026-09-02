---
type: bouncer.blueprint
title: Antigravity 플러그인 표면과 provider 배선
description: 루트 plugin.json으로 Antigravity 배포 표면을 열고 antigravity provider와 설치 문서를 추가한다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/005-antigravity-plugin-surface/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-11T18:00:54.377+09:00'
bouncer:
  id: '005'
  epic_id: '001'
  blueprint_id: '005'
  status: approved
  commit_type: feat
  commit_intent:
    - 네 번째 호스트의 배포 표면이 없어 같은 저장소를 붙일 방법이 없는 상태임
    - 호스트가 플러그인 루트 환경 변수를 주지 않아 provider를 명시 설정으로만 고정함
---
# 005 antigravity-plugin-surface

Epic: [001](../../index.md)

## Intent
- 문제: Antigravity는 플러그인 루트에서 `plugin.json`을 찾는다. 이 저장소에는 호스트별 매니페스트가 `.claude-plugin` / `.cursor-plugin` / `.codex-plugin`에만 있어 `agy plugin validate`가 매니페스트 부재로 즉시 멈춘다. 설치가 되더라도 `subagents`에 그 호스트의 블록이 없어 named agent 모델 오버라이드를 적을 자리가 없다.
- 완료 조건: 루트 `plugin.json`이 생겨 skills / agents / hooks가 모두 인식되고, `subagents.provider: "antigravity"`가 해석되며, 설치·설정 문서가 그 경로를 설명한다.

## Contract
- 인터페이스:
  - 루트 `plugin.json` — `{ name, version, description, author }`. `name`은 `bouncer`, `version`은 나머지 세 매니페스트와 동일.
  - `defaultConfig().subagents.antigravity` — `bouncer-reviewer` / `bouncer-implementer` / `bouncer-debugger` 각각 `"inherit"`.
  - `resolveSubagentModel({ provider: 'antigravity' })` 및 `config.subagents.provider: "antigravity"` — 기존 pin 경로를 그대로 탄다. 새 분기 없음.
- 데이터·상태: `.bouncer/config.json`의 `subagents`에 provider 블록이 하나 늘어난다. 문서 스키마와 게이트 코드는 변하지 않는다.
- 수용 기준: epic Success criteria 1–6.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 호스트가 훅 command의 `${CLAUDE_PLUGIN_ROOT}`를 치환하지 않으면 `hooks/hooks.json`이 로드되어도 실행 경로가 깨진다. 훅은 그대로 싣고, 동작 여부는 릴리스 전 수동 확인 항목으로 남기며 실패 시 CLI 대체를 문서에 적는다.
  - `BOUNCER_HOME`이 없으면 스킬 셸의 `BOUNCER_ROOT`가 빈 문자열이 되어 `node /scripts/bouncer`로 실패한다. 설치 문서가 결정적 설치 경로를 예시로 준다.
  - 루트 `plugin.json`의 `version`이 다른 매니페스트와 어긋나면 실물과 다른 버전을 주장하는 아티팩트가 나간다. 네 매니페스트 동기화를 테스트가 잡는다.
  - `plugin.json`에 `skills` / `agents` 경로를 다시 선언하면 관례 탐색과 충돌한다. 관례 경로에 맡기고 재선언하지 않는다.
  - 선행 조사에서 관측된 매니페스트 키는 `name` / `description` / `disabled`뿐이다. `version`과 `author`는 관측되지 않은 키이고, 호스트가 미지 키에 엄격하면 설치가 거부된다. `version`은 Success criteria 2가 요구하므로 뺄 수 없다 — 실물 `agy plugin validate`로 확인하고, 거부되면 매니페스트에서 두 키를 빼고 버전 동기화 테스트 대상을 기존 세 매니페스트로 되돌린다.
  - 저장소 루트에 매니페스트가 생기면 같은 루트를 가리키는 기존 카탈로그(`.claude-plugin/marketplace.json`의 `source: "./"`, `.agents/plugins/marketplace.json`의 `source.path: "./"`)를 통해 Claude Code·Codex 로더가 이 파일을 집어갈 수 있다. 두 호스트의 테스트는 `.claude-plugin/plugin.json` 경로를 명시적으로 읽으므로 이 회귀를 잡지 못한다. 수동 확인 항목으로 남긴다.
  - 환경 변수로 provider를 추정하면 Cursor와 Antigravity가 서로의 model slug로 조용히 라우팅된다. env 감지 표는 건드리지 않는다.

## Out of scope
- Gemini CLI 확장 형식(`gemini-extension.json`) 지원.
- `commands/` 디렉터리 신설과 `global_workflows` 이식.
- provider 자동 감지 규칙 변경.
- `hooks/hooks.json`의 이벤트·명령 수정.

## One-commit justification
- 배포 표면(루트 `plugin.json`)과 그 표면을 설명하는 문서는 각각 하나의 리뷰 단위다. 태스크 두 개로 나누되 리뷰·PR 단위는 이 blueprint 하나다. 어느 한쪽만 나가면 설치되지만 설명이 없거나, 설명만 있고 설치가 안 되는 상태가 남는다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 배포 표면과 provider 배선
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 설치·설정 문서와 수동 확인 체크리스트
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
