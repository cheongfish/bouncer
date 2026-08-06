---
type: bouncer.review
title: 001 review
description: Review for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/001-tasks-doc-resolver/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-06T17:29:57.449+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '018'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: minor
        status: accepted
        note: >-
          templates.ts Documents 링크가 여전히 tasks.md를 가리키지만
          affected_paths 밖이라 이번 blueprint에서 고치지 않음.
          후속 /bouncer-plan에서 templates.ts를 Touch에 넣어 고친다.
      - id: F2
        severity: minor
        status: resolved
        note: >-
          skills/bouncer-plan/SKILL.md Scaffold 단계에 tasks-001.md 생성과
          레거시 tasks.md 호환을 명시함.
      - id: F3
        severity: minor
        status: resolved
        note: >-
          agent/skill Authority·description에 tasks-001.md 또는 레거시
          tasks.md 문구를 넣음 (implementer/reviewer/debugger/execute/
          implementation/review/reviewer-prompt/graphify-runner).
---
# Review

## Findings

### F1 — scaffold Documents 링크가 tasks.md (minor → accepted)
- 요약: `scaffold blueprint`는 `tasks-001.md`를 쓰는데 템플릿 Documents는
  여전히 `[Tasks](tasks.md)`라 새 blueprint index에 깨진 링크가 생긴다.
- 근거: `scripts/src/lib/templates.ts` Documents; `scaffold.ts`는
  `tasks-001.md` 출력.
- 처분: accepted — `templates.ts`는 `affected_paths` 밖. 후속 plan에서
  Touch에 넣고 고친다.

### F2 — plan Scaffold 단계가 새 파일 이름을 빠뜨림 (minor → resolved)
- 요약: Touch는 `bouncer-plan`이 scaffold 결과 `tasks-001.md`를 반영해야
  한다고 했는데 Author만 이름을 쓰고 Scaffold는 말하지 않았다.
- 근거: `skills/bouncer-plan/SKILL.md` step 3 vs step 4.
- 처분: resolved — Scaffold에 `tasks-001.md` 생성과 레거시 `tasks.md` 호환
  문장을 넣음.

### F3 — 브리프 이름이 신규만 말해 레거시 구멍을 냄 (minor → resolved)
- 요약: Goal/Constraints는 레거시 `tasks.md`를 유지하는데 agent/skill이
  `tasks-001.md`만 Authority로 적으면 레거시 blueprint에서 가드·권한이
  어긋난다.
- 근거: 초기 `agents/bouncer-debugger.md` Hard guards; 재검에서 Authority·
  `bouncer-execute` description/Implement 권한도 동일.
- 처분: resolved — `tasks-001.md` 또는 레거시 `tasks.md`로 통일.
