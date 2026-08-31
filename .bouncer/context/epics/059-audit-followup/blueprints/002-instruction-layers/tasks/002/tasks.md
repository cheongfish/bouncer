---
type: bouncer.tasks
title: Distill 승격 제안에 상위 층 재진술 제외 단계를 넣음
description: /bouncer-finalize의 승격 제안이 마스터 룰·rules·스킬이 이미 진술하는 후보를 제외한 목록으로 나오고 제외 항목과 근거를 함께 보이게 한다
resource: .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T08:39:18.950+09:00'
bouncer:
  id: TASKS-002
  epic_id: '059'
  blueprint_id: '002'
  status: ready
  verify: npm run ci
  commit_intent:
    - 승격이 동의를 한 번 받을 뿐 상위 층이 이미 말하는지 묻지 않아 재진술이 사이클마다 Distill로 흘러듦
    - 제안 목록을 만들기 전에 재진술을 걸러내고 제외 항목과 근거를 함께 보여 사용자가 되돌릴 수 있게 함
  affected_paths:
    - skills/bouncer-finalize/references/distill-promotion.md
    - references/spec-authoring/index.md
    - test/master-rules.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T08:39:18.950+09:00'
    suggested_paths:
      - scripts/lib
      - scripts/src/lib
      - test
    basis:
      - graph: source
        status: reused
        query: distill promotion finalize proposal consent spec-authoring
        result: distill 관련 scripts/lib·scripts/src/lib과 test/ 군집 — 스킬 계약 변경이라 scripts는 참고만
      - graph: context
        status: updated
        query: distill promotion finalize proposal consent spec-authoring
        result: .bouncer/context/epics/059-audit-followup/blueprints/002-instruction-layers/tasks/<NNN>/tasks.md 신규 문서만 히트 — 계획 문서 자체이므로 경로 후보로 쓰지 않음
---

# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`/bouncer-finalize`의 Distill 승격이 지금은 `drop` → `replace` → `add` 목록을 만들어 동의를 **한 번** 받는 것이 전부다. "이 문장을 상위 층이 이미 말하고 있는가"를 묻는 자리가 없어서, 사이클마다 마스터 룰·`rules/`·스킬의 재진술이 Distill로 흘러들 수 있다. `.bouncer/distill/core.md`의 중복 네 문장이 그 결과물이고, `always: true` 샤드라 모든 라우트에 무조건 실린다.

이 task는 제안 목록을 만드는 단계에 **재진술 제외**를 넣는다. 후보마다 상위 층이 이미 같은 계약을 말하는지 판정하고, 말한다면 `add`/`replace` 목록에서 빼되 **버리지 않고** 제외 목록으로 보여준다 — 제외 항목과 그 근거(어느 파일이 이미 말하는가)를 같은 ACQ에 싣는다. 사용자가 그 판정을 뒤집을 수 있어야 하므로 필터는 게이트가 아니다. 하드룰 3·4가 정한 판정 주체(게이트와 사용자)는 바뀌지 않는다.

이 task는 task 001 다음에 온다. task 001이 `skills/bouncer-finalize/references/distill-promotion.md`로 옮겨 놓은 계약 앵커(`audit.shards`, `# <id>`, id 집합 불일치, 상대 경로)를 이 task의 편집이 깨뜨리면 안 된다 — 문장을 더할 뿐 옮겨온 문장을 다시 쓰지 않는다.

task 001이 세운 `## Instruction layers` 헌장이 이 판정의 기준이다. 헌장이 "이 문장은 절차 층에 산다"고 말하면, 같은 문장이 Distill(이 저장소에서만 참인 것) 층에 앉을 이유가 없다.

## Interface
- 제공:
  - `skills/bouncer-finalize/references/distill-promotion.md`의 제안 계약에 재진술 제외 단계. 후보를 `add`/`replace`로 올리기 전에 상위 층(하드룰 `CLAUDE.md` / 절차 `skills/*/SKILL.md` / 계약 `rules/*.md`·`references/*/index.md`)이 이미 같은 계약을 진술하는지 판정한다.
  - 제외 결과의 표시 의무: 하나의 ACQ에 제안 목록과 **제외 목록**을 함께 싣고, 제외 항목마다 그렇게 판정한 근거 파일 경로를 붙인다. 제외가 0건이면 그 사실을 한 줄로 보고한다.
  - `references/spec-authoring/index.md`의 Distill 승격 절이 같은 제외 단계를 반영한다 — 승격 본문을 쓰는 쪽과 제안을 만드는 쪽의 계약이 어긋나지 않아야 한다.
- 거부:
  - 제외를 자동 적용해 후보를 조용히 버리는 것. 제외는 목록에서 빼는 것이지 삭제가 아니며, 근거 없이 제외하지 않는다.
  - 제외를 게이트로 만드는 것. 실패 코드(G/S)를 새로 만들거나 기존 게이트가 제외 결과를 읽게 하지 않는다.
  - 후보마다 따로 묻는 것. 현행 계약은 "한 번의 ACQ, 목록 전체 승인/수정/건너뛰기"이고 그대로 유지한다.
  - `drop` 판정에 제외를 적용하는 것. `drop`은 이미 Distill에 있는 낡은 문장을 지우는 방향이라 재진술 판정의 대상이 아니다.
  - `auto`·`light`에서 동의를 건너뛰는 것. 현행 계약대로 두 경우 모두 동의가 필요하다.

## Touch
- Modify `skills/bouncer-finalize/references/distill-promotion.md` — 제안 목록 생성에 재진술 제외 단계와 제외 목록 표시 의무를 넣는다.
- Modify `references/spec-authoring/index.md` — 승격 절의 계약을 같은 제외 단계에 맞춘다.
- Modify `test/master-rules.test.js` — 두 문서가 제외 단계와 근거 표시를 담는지 단언한다(이 파일이 이미 `finalize`/`spec` 쌍을 함께 읽는 승격 계약 테스트를 가진다).

## Do not touch
- `scripts/` — 승격은 스킬 계약이고 CLI 판정이 아니다. 게이트 코드·`bouncer distill` 계약을 바꾸지 않는다.
- `.bouncer/distill/core.md` — 중복 네 문장의 실제 삭제는 task 003 몫이다. 이 task는 재유입 경로를 막을 뿐이다.
- `CLAUDE.md` — 헌장은 task 001이 세운다. 하드룰 7의 finalize 후반은 이 task에서 다시 손대지 않는다.
- `skills/bouncer-finalize/SKILL.md`의 단계 순서와 G16·remainder·퀴즈 계약.

## Constraints
- 제안·동의 계약의 기존 문장을 유지한다 — `drop` → `replace` → `add` 순서, 한 번의 ACQ, 승인/수정/건너뛰기 세 갈래, 거절 시 아무것도 쓰지 않고 다음 단계로 계속.
- 이 두 문서는 영어 지시문이다. 하드룰 8의 한국어 대상이 아니다.
- `references/spec-authoring/index.md`는 `BOUNCER_ROOT`를 해석하거나 `scripts/bouncer`를 호출하지 않는다 — 현행 단언이 이를 막고 있으므로 추가 문장도 CLI 호출을 지시하지 않는다.
- 재진술 판정의 근거 층 목록은 task 001의 `## Instruction layers` 표와 같은 네 층이어야 한다.

## Checklist
- [ ] `skills/bouncer-finalize/references/distill-promotion.md`의 현행 제안·동의 계약 문장을 읽고, 제외 단계가 들어갈 자리(제안 목록 생성 직전)를 정한다.
- [ ] 실패 테스트를 먼저 쓴다 — `test/master-rules.test.js`에 두 문서가 제외 단계와 근거 표시를 담는지 단언하는 테스트를 추가하고, `node --test test/master-rules.test.js`로 실패를 확인한다.
- [ ] `distill-promotion.md`에 제외 단계를 쓴다. 최소한 이 셋을 명시한다: 판정 기준(상위 세 층이 같은 계약을 이미 진술하는가), 제외의 결과(목록에서 빼되 근거와 함께 보인다), 제외가 0건일 때의 보고.
- [ ] `references/spec-authoring/index.md`의 승격 절을 같은 계약으로 맞춘다.
- [ ] 기존 승격 계약 단언이 그대로 통과하는지 확인한다 — `replace`/`append` 금지, `full search`, `aggregate`·개별 샤드 금지, 단일 파일 폴백.
- [ ] `npm run ci`를 실행해 그린을 확인한다.
