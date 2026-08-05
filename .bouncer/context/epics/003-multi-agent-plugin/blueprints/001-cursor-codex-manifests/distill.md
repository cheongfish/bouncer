---
type: bouncer.distill
title: 001 distill
description: Distill for 001
resource: .bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-07-27T16:58:12.166+09:00'
bouncer:
  id: DISTILL-BP-001
  epic_id: '003'
  blueprint_id: '001'
  status: published
---
# Distill

## 설치된 실물이 문서보다 정확했다
Cursor의 플러그인 루트 환경변수명은 공개 문서에 없었다. 답은 검색이 아니라
`~/.cursor/plugins/cache/`에 이미 설치돼 있던 플러그인에 있었다 — 훅 커맨드가
`./hooks/session-start`, 즉 **상대 경로**였다. 같은 저장소에서 Claude용
`hooks.json`과 Cursor용 `hooks-cursor.json`을 매니페스트로 가르는 패턴도 거기서
얻었다.

교훈: 에이전트 생태계 스펙을 조사할 때는 **로컬에 설치된 다른 플러그인을 먼저
읽는다.** 검색 결과보다 버전이 정확하고, 실제로 동작하는 구성을 보여준다.

## 이식성 주장은 "무엇이 치환하는가"를 따져야 한다
`${CLAUDE_PLUGIN_ROOT}`는 셸 변수처럼 보이지만 Claude Code가 **명령 마크다운을
읽는 시점에 텍스트로 치환**한다. 이 차이를 놓치고 `${BOUNCER_ROOT}`라는 진짜 셸
변수로만 바꿨더니, 각 셸 블록이 새 프로세스라 값이 사라져 Claude Code에서도
깨졌다. 리뷰에서야 잡혔다.

교훈: 토큰을 옮길 때는 **누가 언제 치환하는가**를 먼저 답한다. 로드 시점 텍스트
치환과 실행 시점 셸 확장은 수명이 다르다. "블록마다 새 셸"은 fenced 블록을
순회해 "읽으면 반드시 대입한다"는 회귀 테스트로 고정할 수 있다. 최종 표현은
`BOUNCER_HOME` → `CLAUDE_PLUGIN_ROOT` → `PLUGIN_ROOT` 순이다.

## 검증기가 거부하는 키 ≠ 런타임이 거부하는 기능
초기에는 Codex `validate_plugin.py`의 `allowed_keys`에 `hooks`/`commands`가
없다고 해서 Codex 전체를 002로 미뤘다. 다시 문서를 보면 `hooks/hooks.json`은
매니페스트 선언 없이 **기본 탐색**되고, Codex는 `CLAUDE_PLUGIN_ROOT` 호환 별칭과
`PreToolUse`/`Bash`/exit `2`까지 Claude와 맞춘다. 매니페스트에 `hooks` 키만 넣지
않으면 검증은 통과하고 커밋 가드는 기존 `commit-safety.js`를 그대로 탄다.

교훈: 지원 여부를 **키 목록만으로 단정하지 말고**, 기본 탐색·호환 별칭·이벤트
스키마를 같이 본다. 검증기가 막는 것은 "선언"이지 "파일 존재"가 아닐 수 있다.
`commands/`는 여전히 Codex 표면이 아니므로 워크플로 진입점 이관은 002에
남긴다.

## 어댑터는 얇게, 판정은 한 곳에
Cursor 훅은 stdout JSON(`permission`)으로, Claude·Codex 훅은 종료 코드로 판정을
전달한다. 프로토콜만 다르고 "이 커밋이 범위 안인가"는 같은 질문이라, 어댑터는
`evaluateCommit`만 호출한다. `scripts/lib/`를 Do not touch로 못 박아 둔 것이 이
구조를 강제했다.

## 남은 것
- 실제 Cursor·Codex 클라이언트 설치 검증 — 단위 테스트와 `validate_plugin.py`로
  계약은 고정했지만 통합 수준 위험은 남는다. Codex는 플러그인 훅을 trust하기
  전까지 가드가 동작하지 않는다.
- 002 — `commands/` 네 진입점을 `skills/`로 옮겨 Codex에서도 같은 워크플로
  표면을 쓰게 한다.
