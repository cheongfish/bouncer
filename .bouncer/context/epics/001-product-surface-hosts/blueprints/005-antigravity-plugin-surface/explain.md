---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/005-antigravity-plugin-surface/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-12T08:25:08.448+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '001'
  blueprint_id: '005'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 358f12284380f2e86aec556463a7f453a82e2c1b
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/2'
      disposition: 첫 task 커밋 전 브랜치 범위(develop..HEAD)는 코드 diff 없음. 퀴즈는 워킹트리 매니페스트·provider 계약을 기준으로 했고 2/2.
      recorded_at: '2026-08-12T08:25:59+09:00'
    - task: '002'
      range_from: 358f12284380f2e86aec556463a7f453a82e2c1b
      range_to: e25ed658eae3c7fe95b59df578b51adee61f9357
      diff_sha: 130934553510516d13a44eee52d1cecb4c6019df0bcdb4db78b3da4bae60799d
      quiz_score: '2/2'
      disposition: range_from..HEAD는 001 커밋 범위. 퀴즈는 이번 task 문서 WIP(설치 검증 위치·기존 init 저장소 antigravity 블록) 기준 2/2.
      recorded_at: '2026-08-12T08:35:40+09:00'
---
# Explain

## Background
Antigravity는 루트 `plugin.json`과 관례 경로로 플러그인을 읽는다. 이 저장소에는
호스트별 매니페스트만 있어서 `agy plugin validate`가 매니페스트 부재로 멈췄고,
`subagents`에도 Antigravity 칸이 없었다. 001에서 루트 명패와 provider 블록을
올렸다.

호스트가 플러그인 루트 환경 변수를 주지 않으므로 provider는
`subagents.provider: "antigravity"`로만 고른다. env 추정 표는 건드리지 않았다.
문서 태스크는 설치 명령, `BOUNCER_HOME`, pin 이유, CI가 못 돌리는 수동 확인
목록을 `docs/install.md` 등에 적는다. `${CLAUDE_PLUGIN_ROOT}` 치환 여부는
확인되지 않았고, 체크리스트에만 남긴다.

## Intuition
루트에 네 번째 호스트 명패를 걸고, 모델 선반은 pin으로만 고른다. 설치 안내는
그 명패를 어디 두었는지와 pin·`BOUNCER_HOME`을 어디에 적는지까지 한 장에 모은다.

## Code
- `plugin.json` — Antigravity 매니페스트. version은 다른 세 매니페스트와 동기.
  `skills`/`agents`/`hooks` 키는 선언하지 않음
- `scripts/src/lib/init.ts` — `defaultConfig().subagents.antigravity`에 세
  에이전트 `"inherit"`
- `scripts/src/lib/subagents.ts` — pin 경로 재사용. env 분기 추가 없음
- `docs/install.md` — `## Antigravity`(설치·pin·`BOUNCER_HOME`·수동 확인),
  `BOUNCER_HOME` 절에 Cursor와 함께 루트 변수 없는 호스트로 기록
- `docs/configuration.md` — 네 provider × 세 에이전트, 기존 init 저장소의
  `antigravity` 블록 추가 안내
- `README.md` · `docs/ARCHITECTURE.md`(첫 문단) · `docs/contributing.md`(넷
  매니페스트·`claude plugin tag` 범위)

## Quiz
1. Antigravity 설치 문서에서 `agy plugin validate`의 위치는?
   - A) 필수 설치 절차의 첫 단계로 적는다
   - B) 릴리스 전 수동 확인 항목으로만 두고, 필수 절차로는 적지 않는다
   - C) Claude Code 설치 절에만 공통 검증으로 적는다

2. 이미 `bouncer init`을 돌린 저장소에 Antigravity를 쓰려면?
   - A) `subagents.provider`만 바꾸면 `defaultConfig`가 블록을 자동으로 채운다
   - B) `.bouncer/config.json`의 `subagents`에 `antigravity` 블록을 직접 추가한다
   - C) `BOUNCER_HOME`만 export하면 provider 블록이 생긴다

## 이해 상태
- task `001` · score `2/2` · disposition: 첫 task 커밋 전 브랜치 범위는 코드 diff 없음. 워킹트리 매니페스트·provider 계약 기준 퀴즈 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 C / 응답 C → 맞음
- task `002` · score `2/2` · disposition: range_from..HEAD는 001 커밋 범위. 퀴즈는 문서 WIP(설치 검증 위치·기존 init antigravity 블록) 기준 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 B / 응답 B → 맞음
