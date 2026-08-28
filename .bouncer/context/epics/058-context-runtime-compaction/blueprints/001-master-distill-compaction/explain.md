---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/058-context-runtime-compaction/blueprints/001-master-distill-compaction/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T14:29:40.422+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '058'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: f701e18fdd16cc8b137b8d63cbcb1f3cf6710f6f
      diff_sha: c120fd1016a355c40f82aa80729aa53b327025d558e48e95be5e563cb81586d1
      quiz_score: '3/4'
      disposition: >-
        Q4는 always-only로 미분류 fail-open을 지키는 이유인데 core 주입 중단으로 읽음.
        바이트·fail-open·benchmark 라우팅은 맞음. 기록만 하고 마감 진행.
      recorded_at: '2026-08-28T14:31:00+09:00'
---
# Explain

## Background
매 세션이 읽는 `CLAUDE.md`와 Project Distill 전량이 스킬 절차·회차 수치·넓은 glob을 함께 품고 고정 입력 비용이 커졌다. 기준선은 마스터 규칙 8,765바이트, Distill 합계 47,964바이트였다. 이번 PR은 11개 hard rule·fail-open·신뢰 경계는 유지한 채 본문만 줄이고, `plugin-skills`에 섞여 있던 벤치마크 런북을 별도 샤드로 나눈다. 저장소 `distill.max_bytes`는 압축이 끝난 뒤 6,144로 맞춘다.

## Intuition
항상 읽는 문장은 짧게, 경로별로 필요한 문장만 붙이고, 벤치마크 길은 일반 플러그인 길과 겹치지 않게 갈라 둔다.

## Code
- `CLAUDE.md`, `test/master-rules.test.js` — 마스터 규칙 ≤6,135바이트와 계약 단언
- `.bouncer/distill/{core,validate-gates,context-layout,git-worktree,graph,build-ts}.md` — 기술 샤드 예산
- `.bouncer/Distill.md`, `.bouncer/distill/plugin-skills.md`, `.bouncer/distill/plugin-benchmark.md` — 8샤드 등록·경로 분리·`core` always-only
- `.bouncer/config.json`, `docs/configuration.md`, `test/distill.test.js` — `max_bytes=6144`와 선택·합계 예산

## Quiz
1. `CLAUDE.md` 압축 후 바이트 상한과 판정 기준은?
   - A) 6,135바이트, UTF-8 `Buffer.byteLength`
   - B) 4,096바이트, 줄 수
   - C) 8,765바이트, 단어 수
2. 미분류 경로(`unclassified.xyz`)의 Distill 선택은?
   - A) `core`만
   - B) 등록된 8개 샤드 전량(fail-open)
   - C) `plugin-skills`만
3. `docs/benchmark/history.md`를 `--for`로 넘기면 비항상 샤드는?
   - A) `plugin-skills`
   - B) `validate-gates`
   - C) `plugin-benchmark`
4. task 003이 `core`의 `paths: ["**"]`를 제거한 이유는?
   - A) `pulls`로 always를 다시 연결하기 위해
   - B) always만 남기고 미분류가 `core` 단독으로 위장되지 않게 하기 위해
   - C) `core`를 더 이상 주입하지 않기 위해

## 이해 상태
- 정답: 1A, 2B, 3C, 4B
- 응답: 1A, 2B, 3C, 4C
- 채점: 1✓ 2✓ 3✓ 4✗ → quiz_score 3/4
- disposition: Q4는 always-only로 미분류 fail-open을 지키는 이유인데 core 주입 중단으로 읽음. 바이트·fail-open·benchmark 라우팅은 맞음. 기록만 하고 마감 진행.
- diff_sha: c120fd1016a355c40f82aa80729aa53b327025d558e48e95be5e563cb81586d1
