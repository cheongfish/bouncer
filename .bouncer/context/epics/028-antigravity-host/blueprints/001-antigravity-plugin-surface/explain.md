---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/028-antigravity-host/blueprints/001-antigravity-plugin-surface/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-12T08:25:08.448+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '028'
  blueprint_id: '001'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 358f12284380f2e86aec556463a7f453a82e2c1b
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/2'
      disposition: 첫 task 커밋 전 브랜치 범위(develop..HEAD)는 코드 diff 없음. 퀴즈는 워킹트리 매니페스트·provider 계약을 기준으로 했고 2/2.
      recorded_at: '2026-08-12T08:25:59+09:00'
---
# Explain

## Background
Antigravity는 플러그인 루트의 `plugin.json`과 관례 경로(`skills/` · `agents/` ·
`hooks/`)로 배포 표면을 잡는다. 이 저장소에는 `.claude-plugin` /
`.cursor-plugin` / `.codex-plugin` 매니페스트만 있어 `agy plugin validate`가
매니페스트 부재로 멈춘다. 설치가 되더라도 `subagents`에 Antigravity 블록이
없으면 named agent 모델 오버라이드를 적을 자리가 없다.

호스트는 플러그인 루트 환경 변수를 내보내지 않는다. env로 provider를 추정하면
Cursor와 Antigravity가 서로의 model slug로 조용히 섞인다. 그래서
`subagents.provider: "antigravity"` 명시 pin만 허용하고, `resolveProvider`의
env 표는 그대로 둔다. `BOUNCER_HOME`은 수동 plugin-root override일 뿐
provider 신호가 아니다.

## Intuition
네 번째 호스트용 명패를 루트에 걸고, 모델 선반은 호스트마다 칸을 나눈다.
명패에 경로를 다시 적으면 관례 탐색과 싸우고, 선반 칸은 pin으로만 고른다.

## Code
- `plugin.json` — Antigravity 매니페스트. `name`/`version`/`author`는 다른 세
  매니페스트와 맞춘다. `skills`/`agents`/`hooks`/`commands` 키는 넣지 않는다
- `scripts/src/lib/init.ts` — `defaultConfig().subagents.antigravity`에
  reviewer/implementer/debugger 모두 `"inherit"`
- `scripts/src/lib/subagents.ts` — `resolveProvider` 주석만. env 분기 추가 없음
- 회귀: `test/cursor-plugin.test.js`(넷 매니페스트·관례 경로),
  `test/init.test.js`, `test/subagents.test.js`(pin / `BOUNCER_HOME`)

## Quiz
1. 루트 `plugin.json`에 `skills` 경로 키를 넣으면?
   - A) Antigravity가 관례 탐색 대신 그 경로만 쓰고 정상 설치된다
   - B) 관례 탐색과 충돌해 호스트가 플러그인을 거부할 수 있다
   - C) Bouncer CLI가 `S12`로 설치를 막는다

2. `BOUNCER_HOME`만 설정하고 `subagents.provider` pin이 없으면
   `resolveSubagentModel` 결과는?
   - A) `{ model: null, provider: 'antigravity' }`
   - B) `{ model: 'inherit', provider: 'antigravity' }`
   - C) `{ model: null, provider: null }`

## 이해 상태
- task `001` · score `2/2` · disposition: 첫 task 커밋 전 브랜치 범위는 코드 diff 없음. 워킹트리 매니페스트·provider 계약 기준 퀴즈 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 C / 응답 C → 맞음
