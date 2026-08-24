---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/048-plugin-root-resolution/blueprints/001-host-candidate-launcher/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T16:01:31.770+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '048'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 5a3142932e1e886a49c7627d20db1d04a2fed5cd
      range_to: 74a21f8b9e77b1ce96c0d16c22516754f4c65da7
      diff_sha: cc5021b092021099cf1a331702d216e6d62de8ea7933302756de221769c9efbf
      quiz_score: '2/3'
      disposition: 핵심 실행 경계는 이해했고, 수동 override 우선순위만 보완함.
      recorded_at: '2026-08-24T16:02:46.000+09:00'
---
# Explain

## Background
호스트가 플러그인 루트 환경변수를 주입하지 않으면 workflow skill은 자신의
`scripts/bouncer` 위치를 알 수 없었다. `bouncer-root`는 수동 override를 먼저
검증하고, 알려진 Codex·Claude·Antigravity 설치 후보 중 재현 가능한 하나를 고른다.
그 결과를 모든 workflow의 독립 Shell block이 같은 방식으로 소비하게 했다.

## Intuition
각 workflow가 길을 추측하지 않고, 공통 안내원이 검증한 플러그인 루트만 받아 출발하는 구조다.

## Code
- `scripts/src/lib/plugin-root.ts`는 후보 검증, strict semver 정렬, host 필터와
  `BOUNCER_HOME` 우선순위를 담당한다.
- `scripts/src/lib/bouncer-root.ts`와 `scripts/bouncer-root`는 PATH 명령의 argv·TTY
  선택을 얇게 연결한다. 소비 환경을 위해 CJS emit도 `scripts/lib/`에 함께 둔다.
- `rules/plugin-root.md`, workflow skill 문서, `docs/install.md`는
  `bouncer-root --auto` 호출과 수동 override·provider pin의 경계를 같은 계약으로
  설명한다.
- `test/plugin-root.test.js`와 workflow surface 회귀 테스트는 후보 선택과 문서화된
  호출 표면이 함께 유지되는지 확인한다.

## Quiz
1. `BOUNCER_HOME`이 유효한 플러그인 루트를 가리킬 때 launcher의 동작은 무엇인가?
   - A) host 후보보다 먼저 그 경로를 사용한다.
   - B) 항상 가장 높은 semver 후보를 사용한다.
   - C) provider pin 값으로 경로를 바꾼다.

2. `--select`를 TTY가 없는 환경에서 실행하면 어떻게 해야 하는가?
   - A) 첫 번째 후보를 조용히 선택한다.
   - B) `--auto` 또는 `BOUNCER_HOME`을 쓰라는 오류로 종료한다.
   - C) 현재 작업 디렉터리를 플러그인 루트로 쓴다.

3. Cursor 사용자가 workflow Shell에서 플러그인 루트를 제공해야 할 때 맞는 설명은 무엇인가?
   - A) `bouncer-root --auto`가 Cursor 설치를 자동 탐색한다.
   - B) `subagents.provider`가 launcher의 경로를 자동 설정한다.
   - C) 절대 경로를 담은 일회성 `BOUNCER_HOME` override를 제공하고 provider pin은 별도로 둔다.

## 이해 상태
정답은 1-A, 2-B, 3-C이며 응답은 1-B, 2-B, 3-C였다. 1번은 오답, 2번과 3번은
정답으로 2/3을 기록했다. 수동 `BOUNCER_HOME` override가 유효하면 host 후보보다 먼저
사용한다는 경계를 보완했다.
