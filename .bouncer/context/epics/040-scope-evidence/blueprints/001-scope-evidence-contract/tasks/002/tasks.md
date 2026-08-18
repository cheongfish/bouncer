---
type: bouncer.tasks
title: 범위 판단 근거 문서를 전환함
description: Tasks for 002
resource: .bouncer/context/epics/040-scope-evidence/blueprints/001-scope-evidence-contract/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-18T08:59:21.200+09:00'
bouncer:
  id: TASKS-002
  epic_id: '040'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - rules/okf.md
    - docs/ARCHITECTURE.md
    - docs/gates.md
    - docs/troubleshooting.md
    - docs/PILOT.md
    - skills/bouncer-plan/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/context-review/SKILL.md
    - skills/implementation/SKILL.md
    - skills/spec-authoring/references/tasks.md
    - test/skill-graphify-runner.test.js
    - test/skill-context-review.test.js
  verify: npm test
  commit_intent:
    - 범위 판단 근거와 승인 범위의 역할을 문서에 분리함
    - Graphify를 evidence producer로 일관되게 설명함
  graph:
    generated_at: '2026-08-18T09:01:54.000+09:00'
    command: graphify query "scope evidence graph basis validation gate scaffold compatibility" --graph source+context
    suggested_paths:
      - docs
      - rules
      - skills
      - test
    basis:
      - graph: source
        status: updated
        query: scope evidence graph basis validation gate scaffold compatibility
        result: 87 nodes; 문서 계약을 검증하는 public-contract 및 session-graph 테스트를 확인함
      - graph: context
        status: updated
        query: Graphify suggested_paths graph basis scope evidence
        result: 8 nodes; graph basis 기록을 도입한 epic 015와 Graphify bootstrap epic 025를 확인함
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
규칙, planning·Graphify 스킬, 템플릿, 사용자 문서를 `scope_evidence` 계약에 맞춘다. 어느 문서도 Graphify 후보 경로를 승인된 변경 범위로 표현하지 않게 한다.

## Interface
- 제공: 새 frontmatter 예시와, Graphify가 `scope_evidence`를 쓰되 `affected_paths`는 사용자가 확정한다는 일관된 안내.
- 거부: `bouncer.graph`를 새 작성 형식으로 안내하는 문서, Graphify가 범위를 승인하거나 새 producer를 이미 지원한다고 암시하는 설명.

## Touch
- Modify `rules/okf.md` — evidence의 소유·의미와 legacy 읽기 호환 경계를 정한다.
- Modify `docs/ARCHITECTURE.md` — 범위 판단 흐름과 정본 evidence 명칭을 바꾼다.
- Modify `docs/gates.md` — G4의 새 입력과 legacy 호환을 설명한다.
- Modify `docs/troubleshooting.md` — S9/G4 실패 시 확인할 `scope_evidence` 필드를 안내한다.
- Modify `docs/PILOT.md` — Graphify 비활성 시 기록할 evidence 명칭을 갱신한다.
- Modify `skills/bouncer-plan/SKILL.md` — 계획 단계의 Graphify 기록과 G4 안내를 새 형식으로 바꾼다.
- Modify `skills/graphify-runner/SKILL.md` — Graphify runner의 write 대상과 handoff를 바꾼다.
- Modify `skills/context-review/SKILL.md` — 후보 경로와 승인 범위의 대조 대상을 바꾼다.
- Modify `skills/implementation/SKILL.md` — 구현 예시의 검증 helper와 설명을 새 계약으로 갱신한다.
- Modify `skills/spec-authoring/references/tasks.md` — 새 scaffold frontmatter 예시를 제공한다.
- Modify `test/skill-graphify-runner.test.js` — runner 안내가 새 정본 필드를 가리키는지 검증한다.
- Modify `test/skill-context-review.test.js` — review 안내가 새 evidence 필드를 가리키는지 검증한다.

## Do not touch
- `README.md` — 제품 소개와 설치 흐름은 evidence 필드 명칭을 설명하지 않는다.
- `docs/configuration.md` — Graphify의 설정 계약은 그대로 둔다.

## Constraints
- 사람용 `.bouncer/context` 본문은 한국어로 쓰고, 코드·경로·필드명은 그대로 둔다.
- 규칙과 스킬은 새 작성 형식만 권장하며 구 `graph`는 읽기 호환이라는 사실만 남긴다.
- 후보 경로는 advisory이며, `affected_paths`는 사용자 승인 뒤에만 기록된다는 경계를 반복해 보존한다.

## Checklist
- [ ] 스킬 테스트에 새 field name을 요구하는 assertion을 추가하고 구현 전 실패를 확인한다.

```bash
node --test test/skill-graphify-runner.test.js test/skill-context-review.test.js
```

- [ ] 규칙, 문서, planning·Graphify·review 스킬, task 예시를 `scope_evidence`로 전환하고 legacy `graph`가 새 문서에 쓰이지 않게 한다.
- [ ] 아래 명령으로 스킬 문서 회귀와 전체 lint를 확인한다.

```bash
node --test test/skill-graphify-runner.test.js test/skill-context-review.test.js && npm run lint
```
