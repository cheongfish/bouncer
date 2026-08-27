---
type: bouncer.review
title: 002 review
description: Review for 002
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/002-agent-rubric-ssot/tasks/002/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-27T09:25:43.486+09:00'
bouncer:
  id: REVIEW-002
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
        note: 인라인 fallback 문구는 task Interface가 호출 계약 (a)·(e)로 고정한 자리라 손대면 범위를 넘는다. 채워진 reviewer-prompt 슬롯이 루브릭 요약을 계속 실어 그 경로가 끊기지도 않는다.
      - id: R-3
        severity: nit
        status: accepted
        note: 옮기기 전에도 같은 강도였던 단언이고, Constraints가 심각도 어휘와 정의 문장의 수정을 금지한다. 이 diff가 약화시킨 것이 아니라 원래 얇았다.
---
# Review

## Findings

- **R-1** (minor, resolved) — `test/skill-review.test.js:45`의 새 가드가 절 이름 언급을 「루브릭을 다시 적었다」의 대리 지표로 써서 실제 불변식을 지키지 못했다. 직접 확인했다 — `agents/bouncer-reviewer.md`의 루브릭 제목은 넷(`Rubric — Spec compliance`, `Rubric — Code quality`, `Rubric — Over-engineering`, `Calibration (severity)`)인데 가드는 `Code quality`와 `Calibration`을 빠뜨려, `### Code quality` 블록을 스킬에 통째로 다시 붙여넣어도 통과한다. 동시에 과잉이기도 해서 정당한 상호 참조 산문을 막고, 실제로 구현 중 포인터 문구를 한 번 고치게 만들었다. 조치: 제목에 앵커한 형태로 바꿔 네 절을 모두 덮되 산문 언급은 허용하게 했고, `### Code quality` 제목을 임시로 넣어 테스트가 실패하는 것을 확인한 뒤 되돌렸다.
- **R-2** (nit, accepted) — 위 note 참조.
- **R-3** (nit, accepted) — 위 note 참조.

리뷰어가 통과로 확인한 항목(이 task의 최대 리스크): 삭제된 문장을 `git show HEAD:agents/bouncer-reviewer.md`와 한 줄씩 대조한 결과 **소실된 문장이 없다**. 스킬 -56줄 / agent +5줄의 비대칭은 네 루브릭 절 중 셋이 이미 agent에 같은 문장으로 있었기 때문이고, 스킬에만 있던 텍스트는 Calibration의 「Severity is a label, not a filter」 문단 하나뿐이며 그것은 `agents/bouncer-reviewer.md:70-73`으로 옮겨졌다. 호출 계약(Load, Findings 필드 계약, 디스패치 네 단계, `resolveSubagentModel`, `inherit` retry, fresh-generic fallback, 브리프 슬롯 포인터, 컨트롤러 소유권)이 모두 스킬에 남았고 `skills/review/assets/reviewer-prompt.md`는 손대지 않았다. 테스트 케이스 세 개를 삭제 대신 개명한 것(구현자 신고 이탈 1)은 `reviewerPrompt` 단언이 살아 있어 비지 않으므로 옳은 판단이다.
