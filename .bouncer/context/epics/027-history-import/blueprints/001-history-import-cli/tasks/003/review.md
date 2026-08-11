---
type: bouncer.review
title: 003 review
description: Review for 003
resource: .bouncer/context/epics/027-history-import/blueprints/001-history-import-cli/tasks/003/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-11T16:09:53.970+09:00'
bouncer:
  id: REVIEW-003
  epic_id: '027'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: minor
        status: resolved
        summary: '--message without --yes dry-run lacked a test'
        note: >-
          captureCli with --message only asserts exit 0, plan JSON on stdout,
          and no epic directory written.
      - id: F2
        severity: minor
        status: accepted
        summary: git add/commit failures throw instead of ImportResult exit 2
        note: >-
          planImport already throws on git exec failure; wrapping after files
          are written would return ok:false while leaving partial docs (S13
          risk). Interface exit-2 list is plan/refusal/message only — keep throw.
      - id: F3
        severity: nit
        status: resolved
        summary: Source heading asserted without sha/date/author field values
        note: >-
          applyImport product test now asserts entry.sha, date, author, and
          subject appear in the blueprint body.
---
# Review

## Findings

1. **minor** (resolved) — Interface「`--yes` 없이 `--message`만 주면 dry-run」구현은
   있었으나 테스트가 없었다. `--message should-ignore` CLI 케이스를 추가했다.

2. **minor** (accepted) — `git add`/`commit` 실패 시 `execFileSync` 예외를 그대로
   던진다. `planImport`와 같은 패턴이고, 쓰기 이후 실패를 `ImportResult`로
   감추면 부분 문서가 남는다. Interface exit 2 목록은 계획·차단·메시지 누락이다.

3. **nit** (resolved) — blueprint `## Source` 필드 값 assert를 제품 테스트에 넣었다.
