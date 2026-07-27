---
type: bouncer.blueprint
title: BP-001 cursor-codex-manifests
description: Blueprint BP-001
resource: .bouncer/context/epics/EPIC-003-multi-agent-plugin/blueprints/BP-001-cursor-codex-manifests/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-07-27T16:58:12.166+09:00'
bouncer:
  id: BP-001
  epic_id: EPIC-003
  blueprint_id: BP-001
  status: approved
---
# BP-001 cursor-codex-manifests

Epic: [EPIC-003](../../index.md)

## Intent
- 문제: 저장소에 `.claude-plugin/` 매니페스트만 있어 Cursor와 Codex는 이 저장소를
  플러그인으로 인식하지 못한다. 인식시키더라도 `commands/*.md`와 `hooks/hooks.json`이
  Claude Code 전용 토큰 `${CLAUDE_PLUGIN_ROOT}`와 Claude 전용 훅 이벤트명에 묶여 있어
  그대로는 동작하지 않는다.
- 완료 조건: 세 에이전트가 각자의 설치 명령으로 Bouncer를 설치해 네 개 명령을
  띄우고, Claude Code와 Cursor에서는 `affected_paths` 밖 커밋이 차단된다.

## Contract
- 인터페이스 (신규 매니페스트, 파일 자체가 계약):
  - `.cursor-plugin/plugin.json` — `name: bouncer`, 훅 경로를 Cursor 전용 파일로
    명시 지정(경로를 명시하면 `hooks/hooks.json` 자동 탐색이 대체된다).
    `commands/`·`skills/`는 기본 탐색 경로가 현 레이아웃과 일치하므로 선언하지 않는다.
  - `.cursor-plugin/marketplace.json` — 단일 엔트리 `bouncer`, `source: "./"`.
  - `.codex-plugin/plugin.json` — Codex 매니페스트.
  - `.agents/plugins/marketplace.json` — 레포 마켓플레이스 카탈로그.
- 인터페이스 (플러그인 루트 해석):
  - 명령 본문과 훅 커맨드가 쓰는 단일 토큰으로 통일한다. 해석 순서는
    `BOUNCER_HOME` → 에이전트별 플러그인 루트 변수 → 실패 시 사람이 읽을 수 있는
    오류. 정확한 에이전트별 변수명은 체크리스트 1번 스파이크에서 확정한다.
- 데이터·상태: 저장소 상태 변화 없음. `.bouncer/` 문서 스키마, 게이트 판정, 커밋
  가드 판정 로직은 그대로다. 새 훅 어댑터는 기존 `evaluateCommit`을 그대로 호출한다.

## Out of scope
- `scripts/lib/` 게이트·가드 판정 로직 수정.
- `skills/*/SKILL.md` 본문 수정.
- `session-graph` (SessionStart) 훅의 Cursor·Codex 이식 — 커밋 가드가 우선이고,
  그래프 훅은 없어도 워크플로가 성립한다.
- Codex에서 셸 실행 시점 차단. Codex 훅 이벤트에 셸 가로채기가 없으면 이번엔
  강제하지 않고 문서에 한계로 명시한다.

## One-commit justification
- 변경의 실체는 매니페스트 4개 추가와, 그것들이 가리키는 공유 자산의 경로 토큰
  정리다. 매니페스트만 넣고 경로 토큰을 그대로 두면 Cursor·Codex에서 명령이
  깨진 채로 설치되므로 두 변경을 나누면 중간 커밋이 동작하지 않는다.
- 기존 파일 수정은 `commands/*.md` 4개의 동일한 토큰 치환과 `hooks/hooks.json`
  한 줄 계열이라 diff가 반복적이고 리뷰 부담이 낮다.
- 판정 로직을 건드리지 않으므로 회귀 위험이 `npm test`로 덮인다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
