---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T14:33:19.871+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '061'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: ccab569a8c779bcc29a9d46e9c2b82f5683f2098
      diff_sha: c2e5523a146c0444d9e213ab5386a87a6c48fa8deaa6048c2cc4094f80f4704a
      quiz_score: '1/2'
      disposition: 핵심 정본·파생값 계약은 이해했으나 S13의 실패 동작을 재확인할 필요가 있음
      recorded_at: '2026-08-31T14:34:10+09:00'
---
# Explain

## Background

에픽 문서의 `description`과 번들 색인 행을 각각 저술하면서 플레이스홀더와 요약 불일치가 누적되었다. 이번 변경은 frontmatter description을 정본으로 고정하고 scaffold 재진입, S13 구조 검사, 기존 62개 에픽 데이터 보정을 같은 규칙으로 묶어 drift가 다시 생기지 않게 한다.

## Intuition

에픽 description을 원장으로 두고 색인 행은 그 원장에서 다시 인쇄하는 파생 영수증처럼 다룬다.

## Code

핵심 생성·검사 로직은 `scripts/src/lib/epic-index.ts`, `scripts/src/lib/scaffold.ts`, `scripts/src/lib/cli-doc-commands.ts`에 있고 CommonJS 소비본은 `scripts/lib/`에서 빌드로 재생성한다. `ensureEpicIndexEntry`는 canonical epic의 description을 읽어 색인 행을 append·replace·no-op으로 처리하며, S13은 같은 정본과 행 요약의 일치를 검사한다. `test/scaffold.test.js`와 `test/validate-structural.test.js`가 거부·재진입·불일치 회귀를 검증하고, 관련 문서와 기존 epic index들은 새 단방향 계약에 맞춰졌다.

## Quiz

1. 기존 canonical epic에 `scaffold epic`을 같은 경로로 다시 실행할 때 정본으로 사용되는 값은 무엇인가?
   - A) 새 CLI 인자의 description
   - B) 기존 epic frontmatter의 description
   - C) 색인 행에 이미 적힌 요약

2. S13이 description과 색인 행의 요약이 다르다고 판단하면 어떻게 되는가?
   - A) 색인 행을 조용히 고친다
   - B) 해당 불일치를 구조 검증 실패로 보고한다
   - C) epic frontmatter를 색인 행에 맞춘다

## 이해 상태

1번: B — 정답. 기존 epic frontmatter의 description이 재생성의 정본임.
2번: C — 오답. 정답은 B이며, S13은 description과 색인 요약 불일치를 구조 검증 실패로 보고함.
결과: 1/2. disposition: 핵심 정본·파생값 계약은 이해했으나 S13의 실패 동작을 재확인할 필요가 있음.
