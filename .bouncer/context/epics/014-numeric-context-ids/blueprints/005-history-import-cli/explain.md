---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/005-history-import-cli/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-11T16:32:50.546+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '014'
  blueprint_id: '005'
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
    - task: '003'
      range_from: 7d22ff78e0f801f1ebd9cd5ad132b8f2b7fd2efe
      range_to: 713dca20964b6f904e55e2173aae7eaf4f72a77a
      diff_sha: 7a9cdc548edaa04a90ade6052835ea6e2e21ef5964102b8c04d7d6f326539723
      quiz_score: '2/2'
      disposition: range_from..HEAD는 task 002 커밋 범위. 퀴즈는 이번 커밋 단위 applyImport/CLI(워킹트리) 기준 2/2.
      recorded_at: '2026-08-11T17:06:04+09:00'
---
# Explain

## Background
나중에 Bouncer를 붙인 저장소는 과거 작업이 커밋 메시지에만 남고 `.bouncer/context/`는 도입 시점부터 비어 있다. 그 기록을 문서 트리로 옮기려면 새 경로가 필요한데, 과거 커밋에는 verify 흔적이 없다. 임포트분을 일반 `approved`로 두면 게이트가 통과한 것처럼 읽힌다.

그래서 status 어휘에 `imported`를 넣고, `validateBlueprint`가 그 blueprint를 만나면 구조·epic 목록 검사만 한 뒤 `S18`으로 게이트를 건너뛴다. `planImport`가 git 히스토리를 읽어 생성 예정 트리만 계산하고, `applyImport`가 그 계획을 `imported` 문서 트리로 쓴 뒤 커밋 하나로 남긴다. `bouncer import`는 기본 dry-run이고 `--yes --message`일 때만 적용한다.

차단 사유는 첫 파일 쓰기 전에 모두 확인한다. 중간에 멈추면 epic 디렉터리만 있고 목록 등록이 빠진 상태가 남고, 그때부터 저장소 전체 `validate`가 S13으로 깨진다.

## Intuition
박물관 유물은 전시하되 시험 점수는 매기지 않는다. `imported`는 전시용 status이고, `S18`은 「채점 대상 아님」이다. `planImport`는 짐 목록, `applyImport`는 이사와 영수증(단일 커밋)이다. dry-run은 목록만 보여주고, `--yes --message`가 이사 허가증이다.

## Code
- `scripts/src/lib/schema.ts` — epic·blueprint `STATUS_ENUM` 끝에 `imported`
- `scripts/src/lib/validate.ts` — 구조·epic 목록 검사 뒤, `checkGate` 직전. blueprint status가 `imported`이면 `S18`을 넣고 즉시 반환한다
- `scripts/src/lib/import-history.ts` — `planImport`와 `applyImport`. git은 `deps.execFileSync` 한 경로. 적용 순서: 차단 → 렌더 → 쓰기 → `ensureEpicIndexEntry` → 생성 경로만 `git add` → `--message` 그대로 커밋
- 임포트 epic 본문은 `## Intent`·`## Blueprints`만. `## Success criteria`는 쓰지 않는다(context digest 화이트리스트)
- `scripts/src/lib/cli.ts` — `cmdImport`. `--yes` 없으면 계획 JSON만 stdout. `--message`만 있어도 dry-run
- 회귀: `test/schema.test.js`, `test/validate-structural.test.js`, `test/import-history.test.js`, `test/cli-help.test.js`
- 문서: `docs/gates.md`, `docs/cli.md`, `docs/ARCHITECTURE.md`, `docs/troubleshooting.md`

## Quiz
1. `applyImport`에 `entries`가 비어 있는 계획을 넘기면?
   - A) `ok: false`, `error.code = 'IMPORT_PLAN_EMPTY'`
   - B) `ok: true`, `committed: false`, `created: []` — 파일도 커밋도 없다
   - C) epic `index.md`만 만들고 `committed: true`로 끝낸다

2. CLI에서 `--yes` 없이 `--message`만 주면?
   - A) `IMPORT_MESSAGE_REQUIRED`로 exit 2
   - B) 메시지를 커밋 메시지로 써서 바로 적용한다
   - C) dry-run으로 취급해 계획 JSON만 내고 파일은 쓰지 않는다

## 이해 상태
- task `001` · score `2/2` · disposition: 첫 task 커밋 전 브랜치 범위는 코드 diff 없음. 워킹트리 S18 기준 퀴즈 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 A / 응답 A → 맞음
- task `002` · score `2/2` · disposition: range_from..HEAD는 task 001 커밋 범위. 퀴즈는 이번 커밋 단위 planImport(워킹트리) 기준 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 B / 응답 B → 맞음
- task `003` · score `2/2` · disposition: range_from..HEAD는 task 002 커밋 범위. 퀴즈는 이번 커밋 단위 applyImport/CLI(워킹트리) 기준 2/2.
- Q1 정답 B / 응답 B → 맞음
- Q2 정답 C / 응답 C → 맞음
