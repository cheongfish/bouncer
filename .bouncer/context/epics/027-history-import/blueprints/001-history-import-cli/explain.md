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
---
# Explain

## Background
Bouncer를 나중에 붙인 저장소는 과거 작업이 커밋 메시지에만 남고 `.bouncer/context/`는 도입 시점부터 비어 있다. 그 히스토리를 문서 트리로 옮기려면 새 경로가 필요한데, 과거 커밋에는 verify 흔적이 없다. 임포트분을 일반 `approved`로 두면 게이트가 통과한 것처럼 읽힌다. 이번 커밋은 그 전에 어휘와 거절 분기만 깐다. epic·blueprint status에 `imported`를 넣고, `validateBlueprint`가 그 blueprint를 만나면 게이트를 돌리지 않은 채 `S18` 하나로 거절한다. `bouncer current --set`은 plan 게이트 통과에 묶여 있으므로, 같은 실패가 포인터 설정도 막는다.

## Intuition
박물관 유물은 전시하되 시험 점수는 매기지 않는다. `imported`는 전시용 status이고, `S18`은 「채점 대상 아님」이다.

## Code
- `scripts/src/lib/schema.ts` — `STATUS_ENUM`의 epic·blueprint 배열 끝에 `imported`
- `scripts/src/lib/validate.ts` — `loadBlueprintDocs`·구조 검사·`checkEpicIndexConsistency` 이후, `checkGate` 직전. blueprint status가 `imported`이면 `S18`을 넣고 즉시 `{ ok: false, failures }`로 반환한다. epic만 `imported`인 경우는 이 분기를 타지 않는다.
- 회귀: `test/schema.test.js`, `test/validate-structural.test.js`(plan·gate 미지정), `test/current.test.js`(`listReadyBlueprints`가 `imported`를 빼는지)
- 문서: `docs/gates.md`, `docs/ARCHITECTURE.md`, `docs/troubleshooting.md`에 `S18` 범위·대응

## Quiz
1. `validateBlueprint`가 blueprint status `imported`를 만났을 때 올바른 동작은?
   - A) 게이트를 건너뛰고 `{ ok: true }`를 돌려준다
   - B) 구조 검사와 epic 목록 검사는 유지한 채 `S18`을 더하고 `checkGate`를 호출하지 않는다
   - C) G1·G2를 모아 기존처럼 게이트 실패 목록을 만든다

2. epic status만 `imported`이고 blueprint는 `approved`일 때 S18 분기는?
   - A) blueprint status만 보므로 이 분기를 타지 않는다
   - B) epic status를 보고 S18을 낸다
   - C) S6 스키마 위반으로 거절한다

## 이해 상태
- task `001` · score `2/2` · disposition: 첫 task 커밋 전 브랜치 범위는 코드 diff 없음. 워킹트리 S18 기준 퀴즈 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 A / 응답 A → 맞음
