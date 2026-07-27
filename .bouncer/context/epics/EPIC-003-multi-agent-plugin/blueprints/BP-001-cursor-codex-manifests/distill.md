---
type: bouncer.distill
title: BP-001 distill
description: Distill for BP-001
resource: .bouncer/context/epics/EPIC-003-multi-agent-plugin/blueprints/BP-001-cursor-codex-manifests/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-07-27T16:58:12.166+09:00'
bouncer:
  id: DISTILL-BP-001
  epic_id: EPIC-003
  blueprint_id: BP-001
  status: published
---
# Distill

## 설치된 실물이 문서보다 정확했다
Cursor의 플러그인 루트 환경변수명은 공개 문서에 없어서 계획 단계에서 "스파이크로
확정"하고 넘어간 항목이었다. 답은 검색이 아니라 `~/.cursor/plugins/cache/`에 이미
설치돼 있던 플러그인에 있었다 — 훅 커맨드가 `./hooks/session-start`, 즉 **상대
경로**였다. 환경변수가 필요 없다는 것이 답이었고, 같은 파일에서 Claude용
`hooks.json`과 Cursor용 `hooks-cursor.json`을 매니페스트로 분리하는 방식까지 함께
얻었다.

교훈: 에이전트 생태계 스펙을 조사할 때는 **로컬에 설치된 다른 플러그인을 먼저
읽는다.** 검색 결과보다 버전이 정확하고, 실제로 동작하는 구성을 보여준다.

## 이식성 주장은 "무엇이 치환하는가"를 따져야 한다
`${CLAUDE_PLUGIN_ROOT}`는 셸 변수처럼 보이지만 Claude Code가 **명령 마크다운을
읽는 시점에 텍스트로 치환**한다. 이 차이를 놓치고 `${BOUNCER_ROOT}`라는 진짜 셸
변수로 바꿨더니, 각 셸 블록이 새 프로세스라 값이 사라져 Claude Code에서도 깨졌다.
리뷰에서야 잡혔다.

교훈: 토큰을 옮길 때는 **누가 언제 치환하는가**를 먼저 답한다. 로드 시점 텍스트
치환과 실행 시점 셸 확장은 수명이 다르다. 그리고 "블록마다 새 셸"이라는 성질은
회귀 테스트로 고정할 수 있다 — fenced 블록을 순회해 "읽으면 반드시 대입한다"를
검사하면 같은 실수가 다시 들어오지 못한다.

## 계획의 전제가 틀리면 스코프를 줄이는 게 정답일 때가 있다
계획은 Codex 매니페스트가 명령과 훅을 노출한다고 가정했지만, Codex가 함께 배포하는
공식 검증기(`plugin-creator/scripts/validate_plugin.py`)의 `allowed_keys`에 둘 다
없었다. 스킬만 실어 "지원한다"고 말할 수도 있었지만, 진입점 없는 반쪽 설치는
사용자를 속이는 쪽에 가깝다. 이번 blueprint를 Cursor 전용으로 줄이고 Codex를
BP-002로 미뤘다.

교훈: 지원 여부를 **매니페스트가 받는 키 목록**으로 판단한다. 벤더가 검증기를 함께
배포한다면 그게 스펙 문서보다 정확한 계약이다.

## 어댑터는 얇게, 판정은 한 곳에
Cursor 훅은 stdout JSON(`permission`)으로, Claude 훅은 종료 코드로 판정을 전달한다.
프로토콜만 다르고 "이 커밋이 범위 안인가"는 같은 질문이라, 두 어댑터 모두
`scripts/lib/commit-hook.js`의 `evaluateCommit`만 호출한다. 판정 로직이 있는
`scripts/lib/`을 Do not touch로 못 박아 둔 것이 이 구조를 강제했다.

## 남은 것
- 실제 Cursor 클라이언트 설치 검증 — 이 환경에 워크스페이스가 없어 통합 수준 위험이
  남아 있다. `/add-plugin` 한 번이면 마켓플레이스 매니페스트의 추가 필드 수용 여부도
  같이 확인된다.
- Codex 지원 (BP-002) — 스킬만 받는 제약 아래 4단계 워크플로를 어떻게 노출할지가
  설계의 핵심 질문이다.
