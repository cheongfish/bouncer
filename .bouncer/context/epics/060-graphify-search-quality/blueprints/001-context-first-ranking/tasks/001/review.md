---
type: bouncer.review
title: 구현·테스트 그래프 입력 분리 리뷰
description: 그래프 scope 분리와 제외 필터의 정확성 및 호환성을 판정한다
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-31T12:01:12.954+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '060'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: major
        status: resolved
      - id: F2
        severity: minor
        status: resolved
      - id: F3
        severity: minor
        status: resolved
      - id: F4
        severity: minor
        status: accepted
        note: seed-worktree가 옮긴 epic 060 context index 줄이며 이 task 커밋 범위 밖 스캐폴딩임
      - id: F5
        severity: minor
        status: accepted
        note: Interface·Touch는 exclude_dirs만 source 필터로 두고 test_dirs는 별도 scope이며 init이 source에서 test를 분리함
      - id: F6
        severity: nit
        status: resolved
      - id: F7
        severity: nit
        status: accepted
        note: 기존 Distill 스코프 테스트 fixture 문구 정리로 계약 변경 없음
      - id: F8
        severity: nit
        status: accepted
        note: prefix 경계는 주석으로 명시됐고 핵심 exclude 경로는 이미 테스트됨
---
# Review

## Findings
- F1 (major, resolved): `exclude_dirs` 변경이 source freshness에 반영되지 않던 문제 — source `watchFiles`에 `.bouncer/config.json` 포함으로 수정
- F2 (minor, resolved): `decision.skips`가 `graphSyncWarnings`에 안 나오던 문제 — warning emit 추가
- F3 (minor, resolved): `defaultExecGraphify`/`writeFilteredGraph` source exclude 경로 테스트 부재 — 회귀 테스트 추가
- F4 (minor, accepted): `.bouncer/context/index.md`가 Touch 밖 — seed-worktree 스캐폴딩; 이 task 커밋 범위 밖
- F5 (minor, accepted): Goal의 test_dirs 제거 표현 vs Interface의 exclude_dirs-only 필터 — Interface·Touch가 계약
- F6 (nit, resolved): `init.ts` `nextGraphify` 들여쓰기 수정
- F7 (nit, accepted): Distill fixture 문구 변경 — 계약 영향 없음
- F8 (nit, accepted): prefix 경계 테스트 부재 — 주석·핵심 경로 커버로 충분
