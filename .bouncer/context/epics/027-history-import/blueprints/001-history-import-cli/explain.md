---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-11T16:32:50.546+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '027'
  blueprint_id: '001'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 310aa4a965487e9050e5bae6a54c684e86a705f5
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/2'
      disposition: 첫 task 커밋 전 브랜치 범위(develop..HEAD)는 코드 diff 없음. 퀴즈는 워킹트리 S18 분기를 기준으로 했고 2/2.
      recorded_at: '2026-08-11T16:34:03+09:00'
    - task: '002'
      range_from: 310aa4a965487e9050e5bae6a54c684e86a705f5
      range_to: 7d22ff78e0f801f1ebd9cd5ad132b8f2b7fd2efe
      diff_sha: 6c5c1c379091d229f68c201cbeba5de96424da689745d25621df1e8e579e814f
      quiz_score: '2/2'
      disposition: range_from..HEAD는 task 001 커밋 범위. 퀴즈는 이번 커밋 단위 planImport(워킹트리) 기준 2/2.
      recorded_at: '2026-08-11T16:48:42+09:00'
---
# Explain

## Background
나중에 Bouncer를 붙인 저장소는 과거 작업이 커밋 메시지에만 남고 `.bouncer/context/`는 도입 시점부터 비어 있다. 그 기록을 문서 트리로 옮기려면 새 경로가 필요한데, 과거 커밋에는 verify 흔적이 없다. 임포트분을 일반 `approved`로 두면 게이트가 통과한 것처럼 읽힌다.

그래서 status 어휘에 `imported`를 넣고, `validateBlueprint`가 그 blueprint를 만나면 구조·epic 목록 검사만 한 뒤 `S18`으로 게이트를 건너뛴다. 그 위에 `planImport`가 git 히스토리를 읽어 생성 예정 트리만 계산한다. 파일은 쓰지 않는다. 머지를 우선 모으고 없으면 일반 커밋으로 폴백하되, `source`를 명시하면 폴백하지 않는다. 상한 초과는 여기서 끊고, 더티 워크트리·활성 포인터·epic 디렉터리 선점·context index 부재는 `refusals`에만 담아 둔다.

## Intuition
박물관 유물은 전시하되 시험 점수는 매기지 않는다. `imported`는 전시용 status이고, `S18`은 「채점 대상 아님」이다. `planImport`는 이사 전에 짐 목록만 뽑는 단계다. 상자를 열거나 옮기지는 않는다.

## Code
- `scripts/src/lib/schema.ts` — epic·blueprint `STATUS_ENUM` 끝에 `imported`
- `scripts/src/lib/validate.ts` — 구조·epic 목록 검사 뒤, `checkGate` 직전. blueprint status가 `imported`이면 `S18`을 넣고 즉시 반환한다
- `scripts/src/lib/import-history.ts` — `planImport`. `deps.execFileSync`로 `git log`/`diff`/`show`를 주입한다. 기본은 머지 우선, `limit` 기본 200, `epicName` 기본 `imported-history`, `epicId`는 epics 스캔 후 다음 빈 `\d{3}`
- 수집: `git log --merges --reverse --format=…` → 0건이면 `git log --reverse …`. 파일 목록은 머지면 `git diff --name-only <sha>^1 <sha>`, 일반이면 `git show --name-only --format= <sha>`
- 회귀: `test/schema.test.js`, `test/validate-structural.test.js`, `test/current.test.js`, `test/import-history.test.js`
- 문서: `docs/gates.md`, `docs/ARCHITECTURE.md`, `docs/troubleshooting.md`의 `S18`

## Quiz
1. `planImport`에서 `source`를 생략했고 머지 커밋이 0건일 때 올바른 결과는?
   - A) `ok: false`, `error.code = 'IMPORT_SOURCE_INVALID'`
   - B) `source === 'commits'`, `fellBack === true`로 일반 커밋을 모은다
   - C) `source === 'merges'`, `fellBack === false`, `entries: []`로 끝낸다

2. 후보가 `limit`을 넘을 때 `planImport`가 하는 일은?
   - A) 앞에서 `limit`개만 잘라 `ok: true`로 돌려준다
   - B) `ok: false`, `error.code = 'IMPORT_LIMIT_EXCEEDED'`, `entries`는 비운다
   - C) `refusals`에만 담고 `ok: true`로 계속 진행한다

## 이해 상태
- task `001` · score `2/2` · disposition: 첫 task 커밋 전 브랜치 범위는 코드 diff 없음. 워킹트리 S18 기준 퀴즈 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 A / 응답 A → 맞음
- task `002` · score `2/2` · disposition: range_from..HEAD는 task 001 커밋 범위. 퀴즈는 이번 커밋 단위 planImport(워킹트리) 기준 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 B / 응답 B → 맞음
