---
type: bouncer.epic
title: 호스트별 플러그인 루트 선택
description: 호스트 캐시 후보에서 Bouncer 플러그인 루트를 안전하게 선택하는 계약을 정의한다
resource: .bouncer/context/epics/048-plugin-root-resolution/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-24T15:31:47.571+09:00'
bouncer:
  id: '048'
  epic_id: '048'
  status: approved
---
# 048 plugin-root-resolution

## Intent
- 문제: Cursor와 Antigravity 스킬 셸은 플러그인 루트를 제공하지 않아, 사용자가
  설치 경로를 셸 프로필에 영구 설정해야 한다. Codex와 Claude도 훅에서만 루트가
  보장될 수 있어, 같은 방식의 세션 환경 주입에 의존할 수 없다.
- 목표: PATH launcher가 Codex·Claude·Antigravity의 설치 후보를 검증·정렬하고
  대화형 또는 자동 정책으로 하나를 선택해, 워크플로가 일시적인 `BOUNCER_HOME`
  없이 CLI 위치를 얻도록 한다.

## Success criteria
1. `BOUNCER_HOME`이 설정되면 어떤 후보 탐색·선택보다 우선하며, provider 판별에는
   여전히 사용되지 않는다.
2. launcher는 Codex·Claude·Antigravity의 알려진 설치 위치에서
   `plugin.json` 또는 패키지 메타데이터와 `scripts/bouncer`를 모두 만족하는 후보만
   인정한다.
3. 자동 모드는 유효 후보를 semver 내림차순으로 결정적으로 고르고, 대화형 모드는
   같은 후보 목록을 번호로 표시해 사용자가 하나를 고를 수 있다.
4. TTY가 없는 대화형 요청, 후보 부재, 손상 메타데이터, 동률 처리의 결과와 다음
   조치를 사람이 읽을 수 있는 오류로 제공한다.
5. 모든 워크플로 스킬, 설치 문서, 규칙 문서 및 회귀 테스트가 launcher 계약과
   provider 명시 pin의 경계를 일관되게 설명한다.

## Out of scope
- `SessionStart`·`PreInvocation`·훅 출력을 공통 Agent Shell 환경 주입 계약으로
  만들거나 그렇게 문서화하는 일.
- 환경 변수나 실행 프로세스명으로 `subagents.provider`를 자동 추론하는 일.
- 사용자의 홈 디렉터리 전체를 탐색하거나 미문서 경로를 추측해 플러그인을 선택하는 일.
- Gemini CLI 확장 형식 또는 새 호스트 매니페스트 지원.

## Blueprints
* [001 host-candidate-launcher](blueprints/001-host-candidate-launcher/index.md) - PATH launcher와 워크플로 루트 해석을 `scripts/`, `skills/`, `rules/`, `docs/`, `test/`에서 호스트 후보 선택 계약으로 바꾼다
