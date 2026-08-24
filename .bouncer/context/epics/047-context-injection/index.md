---
type: bouncer.epic
title: 컨텍스트 주입량 절감
description: 포인터·브리프·Distill 프리플라이트에서 한 사이클 주입량을 줄이고 게이트 계약은 그대로 둔다
resource: .bouncer/context/epics/047-context-injection/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-24T13:32:34.968+09:00'
bouncer:
  id: '047'
  epic_id: '047'
  status: approved
---
# 047 컨텍스트 주입량 절감

## Intent
- 문제: 한 사이클 주입량을 실측하니 execute는 `bouncer.scale` 한 필드를 읽으려고 평균 451 단어짜리 blueprint `index.md`를 두 지점에서 열고, 745 단어짜리 task 브리프에는 구현자의 행동을 바꾸지 않는 `scope_evidence`와 같은 변경을 다섯 번 되풀이한 진술이 섞여 있다. plan 프리플라이트는 샤드 7개 전량 5,992 단어이고 승격마다 단조 증가한다.
- 목표: 문서와 포인터 쪽에서 걷어낼 수 있는 주입만 걷어낸다. 게이트 계약(G3–G5·G10–G12·G18), 승인 범위 증적, 감사 기록은 하나도 줄이지 않는다.

## Success criteria
1. `bouncer current` 페이로드가 `scale`을 싣고, `skills/bouncer-execute/SKILL.md`의 두 경량 분기가 blueprint `index.md` 대신 포인터에서 그 값을 읽는다.
2. `skills/bouncer-execute/SKILL.md`가 브리프를 읽을 때 `bouncer.scope_evidence`를 주입 대상에서 제외한다고 명시하고, 그 문서는 그대로 남아 G4 입력과 감사 기록으로 계속 쓰인다.
3. `spec-authoring`이 `description`·`commit_intent`·`Checklist`의 역할 경계를 적어 같은 내용을 다시 쓰지 않게 하고, `## Goal & intent`가 브리프 서술의 SSOT가 된다.
4. Distill 승격 ACQ가 기존 `S26` 샤드 상한 초과를 사람이 보는 항목으로 노출하고, `/bouncer-plan`이 프리플라이트 총량을 한 줄로 보고한다.
5. 각 task의 `npm run ci`가 통과한다.

## Out of scope
- **지시문 감축.** 고정 주입 ≈5,470 단어(`bouncer-execute`·`implementation`·마스터 규칙·`rules/`)가 가장 큰 단일 비용이지만 스킬·규칙 문서 개편은 별개 주제다.
  이 epic의 task 002·003과 blueprint 002 task 002는 그 지시문 표면에 문장을 **더한다**. 의도한 교환이다 — 더하는 양은 각 스킬 몇 문장으로 한정되고, 그 대가로 execute마다 ≈451 단어(blueprint 읽기)와 task마다 ≈160–210 단어(`scope_evidence` + 중복 진술)가 빠진다. 지시문을 줄이는 작업이 뒤에 오면 이 문장들도 그 대상에 포함된다.
- **epic 본문.** execute 경로에 주입되지 않으므로 주입 과잉이 아니다.
- **`verification.md` / `review.md`.** 하드룰 3의 증거이고 평균 146 / 119 단어다.
- **라우팅 시점 앞당기기.** `--all` 프리플라이트 → `affected_paths` 확정 → `--for` 재접지 순서는 route 결과가 규칙을 조용히 빠뜨리지 못하게 하는 하드룰 7의 안전장치다. 총량은 샤드 본문 규율로만 누른다.
- **자동 절삭.** 샤드를 줄이는 판단은 승격 ACQ에서 사람이 한다.
- 인접 스트림 epic 043 `bouncer-cost-improvement`는 scaffold 고정비를 다뤘고 두 blueprint 모두 닫혔다. 이번 epic은 주입 경로만 다루며 043의 `scale: light` 계약을 바꾸지 않는다.

## Blueprints
* [001 브리프 주입 축소](blueprints/001-brief-injection-slim/index.md) - 포인터에 `scale`을 실어 execute에서 blueprint 읽기를 없애고, `scope_evidence` 주입 제외와 `tasks.md` 중복 축소를 적는다 (`scripts/src/lib/current.ts`, `skills/bouncer-execute`, `skills/spec-authoring`)
* [002 Distill 샤드 규율](blueprints/002-distill-shard-discipline/index.md) - 기존 `S26` 샤드 상한을 승격 ACQ에 노출하고 plan 프리플라이트 총량을 한 줄로 보고한다 (`skills/bouncer-finalize`, `skills/bouncer-plan`, `scripts/src/lib/config.ts`)
