---
type: bouncer.review
title: 003 review
description: Review for 003
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-05T16:54:53.798+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '014'
  blueprint_id: '003'
  status: accepted
  review:
    required: true
    findings:
      - id: R1
        severity: major
        status: resolved
        summary: S13이 구형 EPIC- 디렉터리·index 링크를 조용히 무시해 구형만 남은 트리가 통과할 수 있었음
        note: epic-index가 legacy dir/link를 S13으로 거절하도록 고치고, 구형 전용·혼재 fixture 테스트를 추가함
      - id: R2
        severity: major
        status: accepted
        summary: migrate rewrite로 유사도가 50% 미만인 8개 파일이 git status에서 A/D로 보임
        note: git diff --find-renames=20%에서는 8개 모두 R로 짝지어짐. migrate가 id를 본문 전역 rewrite하므로 기본 50% 임계를 넘는 동일 blob rename은 불가. 커밋 단위 rename 의도는 유지.
      - id: R3
        severity: minor
        status: resolved
        summary: normalizeContextId 주석이 여전히 S5 정규화를 암시함
        note: migrate-ids 전용이며 S4/S5는 정본만 본다고 주석을 고침
---
# Review

## Findings

1. **major (resolved)** — S13이 구형 `EPIC-` 디렉터리·index 링크를 건너뛰어
   구형만 남은 트리가 빈 dirs로 통과할 수 있었다. `epic-index`가 legacy를
   S13으로 거절하도록 고치고 테스트를 추가했다.

2. **major (accepted)** — migrate rewrite로 유사도 <50%인 8개 문서가
   `git status`에서 A/D로 보인다. `--find-renames=20%`에서는 모두 rename.
   blob 동일 rename은 migrate 전역 rewrite와 양립하지 않아 수용.

3. **minor (resolved)** — `normalizeContextId` 주석이 S5 정규화를 암시하던
   문구를 migrate-ids 전용으로 고쳤다.
