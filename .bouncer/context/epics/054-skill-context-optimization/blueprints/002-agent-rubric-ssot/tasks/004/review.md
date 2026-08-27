---
type: bouncer.review
title: 004 review
description: Review for 004
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/002-agent-rubric-ssot/tasks/004/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-27T09:25:43.569+09:00'
bouncer:
  id: REVIEW-004
  epic_id: '054'
  blueprint_id: '002'
  status: accepted
  review:
    required: true
    findings:
      - id: R-1
        severity: minor
        status: resolved
      - id: R-2
        severity: nit
        status: accepted
        note: Constraints의 「복사가 아니라 이동이다」가 Touch 항목의 절 열거보다 우선한다. 그 절을 남겼으면 이동이 아니라 복사가 되고 옮겨간 doesNotMatch 단언에도 걸린다. 규칙은 agent에 더 자세히 살아 있다.
      - id: R-3
        severity: nit
        status: accepted
        note: 루브릭이 이 파일을 떠났으므로 옛 문구는 가리킬 대상이 없어졌다. 새 문구는 판정과 기록 경로를 함께 덮어 규칙이 좁아진 것이 아니라 넓어졌고, trust-boundary 계약도 계속 만족한다.
      - id: R-4
        severity: nit
        status: resolved
---
# Review

## Findings

- **R-1** (minor, resolved) — 순환 포인터가 실행까지 살아남았다. `agents/bouncer-context-reviewer.md:12-14`가 「Judge that material against `skills/context-review/SKILL.md`」를 유지하는데, 같은 diff에서 스킬은 판정 본문이 agent 정본이며 두 번째 사본을 두지 않는다고 선언했다. 루브릭에 관한 한 양방향 고리다. 원인은 내가 task 004 브리프에 `## Rubric` 절 opener만 지우라고 좁게 쓴 것이다 — 계획 단계 컨텍스트 리뷰가 CR-7로 이미 지적했던 사안인데 브리프에 그 범위를 정확히 옮기지 못했다. task 001~003이 끝낸 형제 agent 셋은 모두 역참조를 버렸으므로 이 파일만 예외로 남았고, 그 일관성이 이 blueprint의 목적이다. 조치: intro 문장을 스킬이 실제로 소유한 것(호출 계약과 `## Findings` 필드 계약)만 가리키도록 다시 겨눴다.
- **R-2** (nit, accepted) — 위 note 참조.
- **R-3** (nit, accepted) — 위 note 참조.
- **R-4** (nit, resolved) — 옮겨온 「Severity is a label, not a filter」 문장에 이를 지키는 테스트가 없었다. 쌍둥이인 `agents/bouncer-reviewer.md`는 `test/agents.test.js`에 해당 케이스를 갖고 있어 비대칭이었다. 조치: 같은 쌍(agent 긍정 단언 + 스킬 `doesNotMatch`) 형태로 대칭 케이스를 더했다.

리뷰어가 통과로 확인한 항목: 삭제된 Step 3 블록을 `git show HEAD:agents/bouncer-context-reviewer.md`와 문장 단위로 대조한 결과 **소실 없음** — 네 scope 본문, 심각도 네 항목, Out of judgment가 모두 자리를 찾았고 기존 agent의 zoom 문장과 병합되면서 어느 쪽도 버려지지 않았다. `## When this applies` full-plan 게이트는 HEAD와 바이트 동일이라 리터럴 앵커 주변 산문이 얇아지지 않았다. Step 2의 Findings 필드 계약도 무수정이다. Mermaid는 다섯 번째 scope가 아니라 Cross-document 하위 항목으로 남았고 「not a fifth judgment scope」가 명시돼 있다. 스킬에 디스패치·fallback 산문을 새로 쓰지 않았다. 재생성한 세 케이스는 양쪽 다 본문 고유 문자열에 앵커해 판별력이 있다.
