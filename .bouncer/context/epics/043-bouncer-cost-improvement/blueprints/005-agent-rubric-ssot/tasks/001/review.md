---
type: bouncer.review
title: 001 review
description: Review for 001
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/005-agent-rubric-ssot/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-26T14:53:09.139+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '043'
  blueprint_id: '005'
  status: accepted
  review:
    required: true
    findings:
      - id: R-1
        severity: major
        status: resolved
      - id: R-2
        severity: minor
        status: resolved
      - id: R-3
        severity: minor
        status: resolved
      - id: R-4
        severity: nit
        status: accepted
        note: 호출 계약 여섯 항목 안에 있는 문장이고, 게이트가 증적 권위라는 규칙은 한 파일 안에서 두 번 나와도 규칙이 갈라지지 않는다. 다음 스킬 정리에서 자연히 흡수된다.
      - id: R-5
        severity: nit
        status: accepted
        note: 두 파일 도입부의 유사 문장은 이 diff가 만들지 않았고 Touch 밖이다. 수용 기준 2는 옮김 대상 rubric 문단을 대상으로 하며 도입 문장은 그 대상이 아니다.
---
# Review

## Findings

- **R-1** (major, resolved) — 이동 중 규칙이 소실됐다. 기존 Step 6의 「사다리가 승인된 checklist 항목을 버리라고 하면 계획으로 에스컬레이션한다」가 스킬에서 지워지고 agent에 추가되지 않았다. 직접 확인했다 — `escalate to planning`·`shrink the brief` grep이 `agents/bouncer-implementer.md:46`만 반환하는데 그것은 이 diff 이전부터 있던 `## Scope` 문장이고 모호성·모순에 걸리는 것이지 사다리↔checklist 상호작용에는 걸리지 않는다. 더구나 옮겨간 `test/agents.test.js`의 `assert.match(md, /escalat|plann?ing/i)`가 agent의 기존 `Needs planning` 문구에 걸려, 사다리를 통째로 지워도 통과하는 무력한 단언이 됐다. 조치: 그 문장을 agent로 옮기고 단언을 checklist 폐기 트리거에 다시 앵커했다.
- **R-2** (minor, resolved) — `skills/implementation/SKILL.md:158`의 「Finish every checklist item」은 구현자 측 규율인데 스킬에 남았다. task Interface는 스킬 `## Guardrails`가 호출 측 규율만 갖는다고 규정한다. 조치: agent `## Guardrails`로 옮겼다.
- **R-3** (minor, resolved) — 스킬이 본문에 없는 절차를 광고하고 있었다. frontmatter `description`과 `## When this applies`가 「climbs the minimality ladder before writing code」를 유지하는데 본문 30행은 사다리가 agent에 있다고 말한다. description은 이 epic이 줄이려는 상시 주입 표면이라 방치하면 안 된다. 조치: 두 곳에서 그 절을 뺐다.
- **R-4** (nit, accepted) — 위 note 참조.
- **R-5** (nit, accepted) — 위 note 참조.

리뷰어가 통과로 확인한 항목: 복사가 아니라 이동이다(코드펜스를 제외한 문장 교집합 0). 주석 루브릭은 세 쌍의 Bad/Good 예시까지 스킬에 그대로 남았고 agent로 새지 않았다. 두 문서의 절 순서가 `rules/skill-shape.md`를 만족한다. 테스트 슬라이스 앵커 변경(구현자 신고 이탈 1)은 H2 승격이 강제한 것이고 단언을 약화하지 않았다.
