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
    - task: '002'
      range_from: 12af5712dd666fff7505d2d0180ec9ce0199ebda
      range_to: d262579a4fe56de1e72589978b05f9d58b57f4cf
      diff_sha: 8e4a128702d1224550d15a7bb6cd79c11d64a5602b3c0380a6e9b6a6d09e1a81
      quiz_score: '3/3'
      disposition: 세 문항 모두 정답. 설치 순서(graphifyy)·실패 soft-ok·무승격 시 config 불변을 확인함.
      recorded_at: '2026-08-11T14:22:24+09:00'
    - task: '003'
      range_from: d262579a4fe56de1e72589978b05f9d58b57f4cf
      range_to: 6cedef55173b32e17411d245cc5f9990c0f2cd2f
      diff_sha: 8b962228e01886552db601b4bf9fa73e7411940dc56f00b85c8d31622fcaf5b5
      quiz_score: '2/2'
      disposition: 두 문항 모두 정답. graphify-bin 질의와 승격 C(무기록)를 확인함.
      recorded_at: '2026-08-11T14:35:45+09:00'
---
# Explain

## Background
그래프 호출이 PATH의 `graphify`만 보면 `.bouncer/.venv` 설치는 쓸모가 없다.
해석기(`resolveGraphifyBin`)가 config `bin` → venv → PATH 순으로 고르고,
`session-graph`와 CLI `graphify-bin`이 그 결과만 쓴다. `bouncer init`은
venv에 설치해 `config.graphify.bin`을 기록한다. python·pip 실패는 경고만
남기고 init은 성공한다. 이미 있는 config의 `enabled`는
`--promote-graphify`가 있을 때만 올린다. 이번 커밋은 스킬·문서·Distill이
그 경로를 그대로 가리키게 한다. `graphify-runner`는 `bouncer graphify-bin`으로
실행 파일을 찾고, `/bouncer-init`은 설치 결과·승격 ACQ·gitignore ACQ를
안내한다.

## Intuition
공구함 주소를 정하고(해석), 공구함을 사서 올리고(설치), 설명서와 안내판을
그 주소로 다시 쓴다(배선). 안내판은 손으로 config를 고치지 말고 깃발을
쓰라고 한다.

## Code
- `scripts/src/lib/graphify.ts` — `resolveGraphifyBin`, `setupGraphify`
- `scripts/src/lib/init.ts` / `cli.ts` — 설치·승격·`--write-gitignore`
- `scripts/src/lib/session-graph.ts` — 해석된 bin 소비
- `skills/graphify-runner/SKILL.md` — `bouncer graphify-bin` →
  `"$GRAPHIFY_BIN" query …`; 빈 bin은 graceful skip
- `skills/bouncer-init/SKILL.md` — 설치 보고, 승격 A/B/C, gitignore 동의 후
  쓰기
- 문서: `docs/install.md`, `docs/configuration.md`,
  `docs/troubleshooting.md`, `docs/ARCHITECTURE.md`
- `.bouncer/Distill.md` — 동의 없는 config 보존, 해석 순서 invariant
- 테스트: `test/skill-graphify-runner.test.js`,
  `test/skill-bouncer-init.test.js`

## Quiz
1. `graphify-runner`가 그래프를 질의할 때 실행 파일을 얻는 방법은?
   - A) PATH에서 `graphify`를 직접 호출한다
   - B) `bouncer graphify-bin`이 준 경로를 `"$GRAPHIFY_BIN" query …`로 쓴다
   - C) `config.graphify.bin`을 스킬이 읽어 절대 경로로 붙인다

2. 기존 프로젝트에서 `graphifyPromotion: 'candidate'`일 때 옵션 C(Leave as-is)는?
   - A) `bouncer init --promote-graphify --no-graphify`만 실행한다
   - B) `graphify.enabled`를 스킬이 `config.json`에 직접 쓴다
   - C) 아무것도 쓰지 않는다

## 이해 상태
- task 001: 정답 1-B·2-B / 응답 1-B·2-B / 2/2. disposition: 후보 순서와
  session-graph가 해석기 bin만 실행함을 확인함.
- task 002: 정답 1-A·2-C·3-B / 응답 1-A·2-C·3-B / 3/3. disposition: 설치
  순서(graphifyy)·실패 soft-ok·무승격 시 config 불변을 확인함.
- task 003: 정답 1-B·2-C / 응답 1-B·2-C / 2/2. disposition: graphify-bin
  질의와 승격 C(무기록)를 확인함.
