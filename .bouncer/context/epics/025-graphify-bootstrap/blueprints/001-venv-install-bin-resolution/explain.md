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
---
# Explain

## Background
그래프 빌드는 PATH의 `graphify`만 봤다. venv에 설치해도 호출부가 그 경로를
모르면 설치가 소용없다. 해석기(`resolveGraphifyBin`)가 config `bin` → venv →
PATH 순으로 고르고, `session-graph`는 그 결과만 실행한다. 이번 커밋은
`bouncer init`이 `.bouncer/.venv`에 설치하고 `config.graphify.bin`을 기록하는
쪽이다. python·pip 실패는 경고만 남기고 init은 성공한다. 이미 있는 config의
`enabled`는 `--promote-graphify`가 있을 때만 올린다. `.gitignore` 마커 블록은
`--write-gitignore`가 있을 때만 쓴다.

## Intuition
공구함 주소록(해석기)을 만든 다음, 공구함을 실제로 사서 선반에 올리는
일(설치)이다. 선반에 못 올려도 가게 문은 닫지 않는다.

## Code
- `scripts/src/lib/graphify.ts` — `resolveGraphifyBin`, `setupGraphify`
  (venv → `pip install graphifyy` → `graphify install`. 이미 bin 있으면
  reuse, 실패해도 throw 없음).
- `scripts/src/lib/init.ts` — `graphify.install` / `promote` /
  `writeGitignore`. 라이브러리 기본은 설치 안 함. 승격은 `graphify` 키만
  만진다. `# bouncer`…`# /bouncer` 전체 줄 마커만 갱신.
- `scripts/src/lib/cli.ts` — `cmdInit` 기본 `install: true`. 플래그
  `--no-graphify`, `--promote-graphify`, `--write-gitignore`.
- `scripts/src/lib/finalize.ts` — `RUNTIME_ARTIFACTS`에 `.bouncer/.venv/`.
- `scripts/src/lib/session-graph.ts` — 해석된 bin 소비(이전 task).
- 테스트: `test/graphify.test.js`, `test/init.test.js`,
  `test/cli-init.test.js`, `test/finalize.test.js`.

## Quiz
1. `setupGraphify`가 새 venv에 설치할 때 호출 순서는?
   - A) `python3 -m venv` → `pip install graphifyy` → `graphify install`
   - B) `pip install graphify` → `python3 -m venv` → `graphify install`
   - C) `python3 -m venv` → `pip install graphify` → `graphify install`

2. 신규 부트스트랩에서 `setup`이 `failed`를 돌려주면 init 결과는?
   - A) `ok: false`이고 process exit code가 0이 아니다
   - B) config에 `graphify.enabled: true`를 쓰고 `graphifyInstall.reason`만
     남긴다
   - C) `ok: true`를 유지하고 config는 `graphify: { enabled: false }`이며
     `graphifyInstall.reason`이 비어 있지 않다

3. 이미 초기화된 프로젝트에서 `--promote-graphify` 없이 `bouncer init`을
   다시 돌리면?
   - A) `graphify.enabled`를 `true`로 올리고 bin을 새로 쓴다
   - B) 기존 config 파일은 바이트 단위로 그대로이고
     `graphifyPromotion: 'candidate'`만 보고한다
   - C) `.gitignore` 마커 블록을 기본으로 다시 쓴다

## 이해 상태
- task 001: 정답 1-B·2-B / 응답 1-B·2-B / 2/2. disposition: 후보 순서와
  session-graph가 해석기 bin만 실행함을 확인함.
- task 002: 정답 1-A·2-C·3-B / 응답 1-A·2-C·3-B / 3/3. disposition: 설치
  순서(graphifyy)·실패 soft-ok·무승격 시 config 불변을 확인함.
