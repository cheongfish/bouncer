---
type: bouncer.epic
title: 003 multi-agent-plugin
description: Epic 003
resource: .bouncer/context/epics/003-multi-agent-plugin/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-07-27T16:58:10.208+09:00'
bouncer:
  id: '003'
  epic_id: '003'
  status: approved
---
# 003 multi-agent-plugin

## Intent
- 문제: Bouncer는 Claude Code 전용 매니페스트(`.claude-plugin/`)로만 배포된다.
  Cursor와 Codex도 자체 플러그인 매니페스트 체계를 갖췄지만 Bouncer는 그 경로로
  설치되지 않아, 다른 에이전트를 쓰는 팀원은 게이트를 쓸 수 없다.
- 목표: 한 저장소가 세 에이전트의 네이티브 설치 경로를 모두 제공한다. 자산
  (`skills/`, `scripts/`)은 공유하고 에이전트별로는 매니페스트와 훅 배선만
  갈라진다. 워크플로 진입점은 세 에이전트가 모두 읽는 `skills/*/SKILL.md` 하나로
  모은다 (002).

## Out of scope
- Cursor·Codex 공식 마켓플레이스 제출 — 사내 GitLab / 개인 GitHub 저장소 직접
  설치만 지원한다.
- `skills/*/SKILL.md` 본문 재작성 — 세 에이전트 모두 `SKILL.md`를 그대로 읽는다.
- 게이트 판정 로직(`scripts/lib/validate.js`, `scripts/lib/commit-guard.js`)
  변경 — 이미 에이전트 중립이고 이 에픽은 표면 배선만 다룬다.
- 에이전트 간 동작 차이를 흡수하는 추상화 계층 도입.

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (.bouncer/governance.md). -->
* [001 cursor-codex-manifests](blueprints/001-cursor-codex-manifests/index.md) - Cursor·Codex 플러그인 매니페스트를 추가하고 명령·훅 경로를 에이전트 중립으로 만든다
* [002 commands-to-skills](blueprints/002-commands-to-skills/index.md) - 워크플로 진입점 네 개를 `commands/`에서 `skills/`로 이관해 Codex도 읽는 공통 표면에 올린다
