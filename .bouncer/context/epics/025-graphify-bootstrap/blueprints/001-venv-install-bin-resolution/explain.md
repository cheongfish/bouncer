---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/025-graphify-bootstrap/blueprints/001-venv-install-bin-resolution/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-11T13:59:16.750+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '025'
  blueprint_id: '001'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 12af5712dd666fff7505d2d0180ec9ce0199ebda
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/2'
      disposition: 두 문항 모두 정답. 후보 순서(config→venv→PATH)와 session-graph가 해석기 bin만 실행함을 확인함.
      recorded_at: '2026-08-11T14:03:06+09:00'
---
# Explain

## Background
그래프 빌드는 PATH에서 `graphify`만 찾았다. `.bouncer/.venv`에 설치해도
호출부가 그 경로를 보지 않아 설치가 무용했다. 이 task는 후보를 고르는
곳을 `resolveGraphifyBin` 하나로 모은다. 순서는 config `bin` → venv 실행
파일 → PATH다. `session-graph`는 그 결과를 받아 쓰고, 새 init config의
`graphify.enabled` 기본값은 `true`다. venv 설치 자체는 다음 task다.

## Intuition
전화번호를 세 군데에 흩어 적지 말고 연락처 앱 하나에서 고른다.

## Code
- `scripts/src/lib/graphify.ts` — `venvBinRel`, `resolveGraphifyBin`. throw
  없이 `{ bin, source }`만 돌려준다.
- `scripts/src/lib/session-graph.ts` — `realHasGraphify`·`runGraphifyUpdate`·
  `defaultExecGraphify`가 해석된 `bin`을 쓴다. 루프마다 다시 해석하지 않는다.
- `scripts/src/lib/cli.ts` — `bouncer graphify-bin` (성공 stdout 한 줄 /
  실패 stderr + exit 1).
- `scripts/src/lib/init.ts`, `config.example.json` — `graphify.enabled`
  기본 `true`.
- `test/graphify.test.js` — 후보 순서·플랫폼·비throw.

## Quiz
1. `resolveGraphifyBin`이 실행 파일을 고르는 후순위는?
   - A) PATH → venv → `config.graphify.bin`
   - B) `config.graphify.bin` → venv → PATH
   - C) venv → `config.graphify.bin` → PATH

2. `session-graph.ts`가 graphify를 실행할 때 지켜야 할 규칙은?
   - A) 소스에 리터럴 `'graphify'`를 실행 대상으로 두고, PATH일 때만 해석기를
     부른다
   - B) 해석기가 준 `bin`만 실행 대상으로 쓰고, PATH 폴백 때의 `'graphify'`도
     해석기 반환값이다
   - C) part 루프마다 `resolveGraphifyBin`을 다시 호출해 최신 PATH를 반영한다

## 이해 상태
- task 001: 정답 1-B·2-B / 응답 1-B·2-B / 2/2. disposition: 후보 순서와
  session-graph가 해석기 bin만 실행함을 확인함.
