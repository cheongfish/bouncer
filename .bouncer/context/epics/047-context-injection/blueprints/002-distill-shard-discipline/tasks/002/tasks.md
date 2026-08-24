---
type: bouncer.tasks
title: 승격 ACQ와 plan 프리플라이트에 샤드 상한 초과를 노출함
description: S26 초과 샤드를 승격 결정 화면에 올리고 plan이 프리플라이트 총량을 한 줄 보고한다
resource: .bouncer/context/epics/047-context-injection/blueprints/002-distill-shard-discipline/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T13:32:35.034+09:00'
bouncer:
  id: TASKS-002
  epic_id: '047'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_type: docs
  commit_intent:
    - 상한 초과가 어디에도 보이지 않아 샤드가 조용히 커지던 것을 막음
    - 절삭을 자동화하지 않고 승격 ACQ와 plan 보고에서 사람이 보게 함
  affected_paths:
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - test/skill-bouncer-finalize.test.js
    - test/skill-bouncer-plan.test.js
    - docs/configuration.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T13:45:00.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: fail-skip
        query: finalize promotion ACQ shard limit plan preflight total report
        result: 0 usable hits — every returned node resolves to a deleted path (commands/sdd-*.md, .superpowers/, skills/sdd-minimality, skills/okf-authoring); graphify skill 0.9.41 vs package 0.8.22 skew
      - graph: context
        status: fail-skip
        query: finalize promotion ACQ shard limit plan preflight total report
        result: 0 usable hits — context graph returns the same stale source nodes; paths seeded by hand instead
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
task 001이 만든 관측값을 사람이 결정하는 두 지점에 붙인다. `/bouncer-finalize` step 1의 승격 ACQ가 상한 초과 샤드를 목록에 함께 보여주고(입력은 같은 step이 이미 돌리는 `distill --all --json` 호출의 stderr 요약이다), `/bouncer-plan`이 프리플라이트 직후 총량을 한 줄로 보고한다.

자동 절삭을 하지 않는 이유는 명시한다 — 샤드를 줄이는 판단이 잘못되면 다음 사이클이 그 규칙을 재발견해야 하므로, 초과는 정보이지 강제가 아니다. 승격 시 `add`보다 `replace`/`drop`을 먼저 검토하라는 규율도 같은 자리에 적는다. `spec-authoring`은 이미 「Decisions는 current 유효 선택이며 타임라인을 덧붙이지 않는다」를 규정하고 있으므로 새 규칙이 아니라 집행 강화다.

## Interface
- 제공: ACQ에 올릴 초과 정보의 출처는 task 001이 `bouncer distill --all`의 **stderr**에 내는 요약이다. step 1은 이미 `distill --all --json`을 돌리므로 같은 호출의 stderr를 읽으면 되고, `audit.shards` 페이로드에는 바이트 크기가 없다(`id`·`path`·`always`·`pathsKnown`·`pullsKnown`·`paths`·`pulls`만 투영된다).
- 제공: `skills/bouncer-finalize/SKILL.md` step 1의 단일 ACQ 목록에 상한 초과 샤드가 표시되고, 초과 샤드를 대상으로 하는 제안은 `add`보다 `replace`/`drop`을 먼저 검토한다는 문장이 붙는다.
- 제공: `skills/bouncer-plan/SKILL.md`의 Project Distill 프리플라이트 절에, `--all` 직후 총량을 한 줄로 사용자에게 보고한다는 지시가 생긴다.
- 거부: ACQ 선택지 구조(approve / 일부 / 거절 세 가지)와 「한 번만, 목록 전체에 대해」 계약을 바꾸지 않는다.
- 거부: 초과를 게이트로 만들지 않는다. 초과 샤드가 있어도 plan·finalize 게이트는 통과한다.
- 거부: 초과를 이유로 승격을 자동 거절하거나 샤드를 자동 분할하지 않는다.

## Touch
- Modify `skills/bouncer-finalize/SKILL.md` — step 1 승격 ACQ에 초과 노출과 `replace`/`drop` 우선 검토 문장을 넣는다
- Modify `skills/bouncer-plan/SKILL.md` — Project Distill 절에 총량 한 줄 보고 지시를 넣는다
- Modify `test/skill-bouncer-finalize.test.js` — 초과 노출과 우선 검토 문구를 계약으로 고정한다
- Modify `test/skill-bouncer-plan.test.js` — 총량 보고 지시를 계약으로 고정한다
- Modify `docs/configuration.md` — `max_bytes` 초과가 어디에 보이는지 한 문장 덧붙인다

## Do not touch
- `scripts/src/lib/finalize.ts` — 승격 판정과 `makeAllowed` 계약은 그대로다
- `scripts/src/lib/validate-structural.ts` — S26 판정 자체는 task 001에서도 바꾸지 않았다
- `skills/spec-authoring/SKILL.md` — 승격 본문 작성 규칙은 이미 있고 중복 기술하지 않는다
- `CLAUDE.md` · `rules/` — 마스터 규칙에 Distill 본문 규율을 넣지 않는다 (하드룰 7)
- `.bouncer/distill/` · `.bouncer/Distill.md` — 샤드 본문과 인덱스는 그대로다

## Constraints
- 규칙 본문은 각 워크플로 스킬 한 곳에만 둔다. 마스터 규칙에 복제하지 않는다.
- `/bouncer-plan`의 보고는 한 줄이다. 샤드별 표를 세션에 출력하지 않는다 — 그 자체가 주입이 된다.
- 계약 테스트는 긍정 매치로 고정한다.
- 공개 문자열은 한국어를 유지한다.

## Checklist
- [ ] `test/skill-bouncer-finalize.test.js`와 `test/skill-bouncer-plan.test.js`에 실패 테스트를 추가한다.
  ```js
  // finalize
  assert.match(body, /상한[\s\S]{0,80}초과[\s\S]{0,120}ACQ|ACQ[\s\S]{0,160}초과/);
  assert.match(body, /`add`[\s\S]{0,60}`replace`[\s\S]{0,20}`drop`/);
  // plan
  assert.match(body, /프리플라이트[\s\S]{0,80}총량[\s\S]{0,40}한 줄/);
  ```
- [ ] `node --test test/skill-bouncer-finalize.test.js test/skill-bouncer-plan.test.js`로 실패를 확인한다.
- [ ] `skills/bouncer-finalize/SKILL.md` step 1을 고친다.
- [ ] `skills/bouncer-plan/SKILL.md` Project Distill 절을 고친다.
- [ ] `docs/configuration.md`에 한 문장을 덧붙인다.
- [ ] `npm run ci`가 통과한다.
