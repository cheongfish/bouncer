---
type: bouncer.review
title: 001 review
description: Review for 001
resource: .bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-06T10:35:22.949+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '016'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: major
        status: accepted
        note: '`.bouncer/context/index.md` 변경은 implementer Extra가 아니라 plan scaffold·seed-worktree가 옮긴 에픽 목록 항목이다. finalize makeAllowed도 context index를 허용한다. 되돌리면 016 카탈로그가 빠지므로 유지한다.'
      - id: F2
        severity: minor
        status: accepted
        note: '`subagents`의 `advisor.readConfig` 주석은 Do not touch라 이 BP에서 고칠 수 없다. 런타임 참조는 없고 후속 정리 후보로 둔다.'
---
# Review

## Findings

### F1 — Extra로 보인 context index 수정 (major → accepted)
- 요약: `.bouncer/context/index.md`가 Touch/`affected_paths` 밖인데 worktree에 수정됨.
- 근거: `git diff develop -- .bouncer/context/index.md` (Epic 016 링크 추가).
- 처분: accepted — plan seed 산출물이며 구현 범위 일탈이 아님. 위 frontmatter note 참고.

### F2 — Do not touch `subagents`에 남은 advisor 주석 (minor → accepted)
- 요약: residual grep이 `scripts/src/lib/subagents.ts:6` / `scripts/lib/subagents.js:6`의 `advisor.readConfig…` 주석에 걸림.
- 처분: accepted — Do not touch 준수; 후속 한 줄 정리 후보.
