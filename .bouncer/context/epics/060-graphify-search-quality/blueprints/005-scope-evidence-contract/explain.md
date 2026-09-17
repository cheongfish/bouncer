---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/005-scope-evidence-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-18T09:51:01.667+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '060'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: 34ebaf2ba1c5d564ada4d9d3d973e6c3447ee0ba
      diff_sha: 94b2927d3b591ae5fbdac5b7c6b85ccc8466cb5f44461f6428cb36ffc0cc6ad6
      quiz_score: 3/3
      disposition: 범위 근거와 승인 범위의 경계, 새·구 형식의 충돌 처리, 공통 정규화의 목적을 정확히 설명함
      recorded_at: '2026-08-18T09:55:00.000+09:00'
---
# Explain

## Background
`bouncer.graph`라는 이름이 Graphify 구현과 범위 승인 근거를 한 덩어리로 보이게 했다. 이번 변경은 task frontmatter의 정본을 `bouncer.scope_evidence`로 바꾸고, Graphify 결과가 제안한 후보와 사람이 확정한 `affected_paths`를 분리한다.

기존 계획 문서가 바로 깨지지 않도록 읽을 때만 `graph`를 같은 내부 표현으로 정규화한다. 새 문서에 두 필드가 함께 있으면 모호하므로 S9와 G4가 거절한다.

## Intuition
`scope_evidence`는 지도에서 찾은 후보 표시이고, `affected_paths`는 검토자가 서명한 실제 공사 구간이다.

## Code
- `scripts/src/lib/validate-structural.ts`: `normalizeScopeEvidence`가 새 형식과 구 `graph`를 한 번만 읽고 producer·시각·후보·basis를 검사한다.
- `scripts/src/lib/validate-gates.ts`: G4가 위 정규화 결과를 소비하므로 구조 검사 S9와 계획 게이트가 다른 결론을 내지 않는다.
- `scripts/src/lib/scaffold.ts`: 새 task scaffold는 `scope_evidence` 빈 구조를 만든다.
- `skills/graphify-runner/SKILL.md`, `skills/bouncer-plan/SKILL.md`, `docs/ARCHITECTURE.md`: Graphify는 후보 근거를 기록하고, 사용자가 `affected_paths`를 확정한다는 경계를 같은 표현으로 설명한다.

## Quiz
1. 새 task 문서에 `scope_evidence`와 기존 `graph`가 함께 있으면 어떻게 처리해야 할까?
   - A) `scope_evidence`를 우선해 계속 진행한다.
   - B) 모호한 입력으로 보고 S9/G4에서 거절한다.
   - C) 두 객체의 후보 경로를 합친다.

2. `scope_evidence.suggested_paths`의 역할은 무엇일까?
   - A) Graphify가 제안한 후보이며, 사용자가 별도로 `affected_paths`를 확정한다.
   - B) 승인된 `affected_paths`를 자동으로 덮어쓴다.
   - C) 검증 실행 명령을 저장한다.

3. S9와 G4가 같은 `normalizeScopeEvidence` helper를 쓰는 이유는 무엇일까?
   - A) Graphify 질의를 한 번만 실행하기 위해서다.
   - B) 새 문서의 생성 시각을 자동 보정하기 위해서다.
   - C) 구조 검사와 계획 게이트가 새·구 형식에 대해 같은 판단을 하게 하기 위해서다.

## 이해 상태
정답은 1-B, 2-A, 3-C이며 응답도 모두 일치했다. `scope_evidence`와 `graph`의 동시 작성은 거절하고, 후보 경로는 승인 범위를 자동 변경하지 않으며, S9/G4는 공통 정규화 결과로 같은 계약을 판단한다. 결과: 3/3.

## Tasks

### Task 001

#### Goal & intent

`bouncer.scope_evidence`를 task 범위 판단의 정본으로 도입한다. 새 문서는 이 구조를 쓰고, 기존 `bouncer.graph` 문서는 읽기 시에만 같은 내부 형태로 정규화하여 기존 계획을 계속 검증한다.

#### Interface

- 제공: `scope_evidence`의 `producer: graphify`, `generated_at`, `suggested_paths`, `basis`를 검사하는 단일 helper와 Graphify 결과를 이 구조에 쓰는 scaffold 경로.
- 거부: `scope_evidence`와 `graph`를 한 문서에 함께 쓰는 모호한 입력, 비어 있거나 형식이 틀린 evidence, 승인 없이 `affected_paths`를 evidence 후보로 교체하는 동작.

#### Touch

- Modify `scripts/src/lib/validate-structural.ts` — 새·구 evidence를 정규화하고 S9의 구조 검증을 한 helper에 둔다.
- Modify `scripts/lib/validate-structural.js` — TypeScript source와 동기화된 실행 산출물을 반영한다.
- Modify `scripts/src/lib/validate-gates.ts` — G4가 정규화 결과의 후보 경로와 basis를 검사하게 한다.
- Modify `scripts/lib/validate-gates.js` — TypeScript source와 동기화된 실행 산출물을 반영한다.
- Modify `scripts/src/lib/scaffold.ts` — 새 task scaffold가 `scope_evidence` 빈 구조를 만든다.
- Modify `scripts/lib/scaffold.js` — TypeScript source와 동기화된 실행 산출물을 반영한다.
- Modify `test/validate-structural.test.js` — 새 형식, 구 형식 호환, 혼합 형식 거절을 검증한다.
- Modify `test/validate-gates.test.js` — G4가 새 정본과 구 형식 정규화를 같은 규칙으로 판단함을 검증한다.
- Modify `test/scaffold.test.js` — scaffold의 새 frontmatter 출력과 빈 evidence 상태를 검증한다.

#### Constraints

- S9와 G4는 별도 검사 구현을 만들지 않고 같은 정규화·검증 helper를 공유한다.
- 새 문서의 쓰기 형식은 `scope_evidence` 하나이며, `graph`는 기존 문서 읽기 호환에만 쓴다.
- legacy 정규화는 의미를 보존해야 하며, 두 형식 동시 존재를 묵인하면 안 된다.
- 새 의존성이나 config key를 추가하지 않는다.

### Task 002

#### Goal & intent

규칙, planning·Graphify 스킬, 템플릿, 사용자 문서를 `scope_evidence` 계약에 맞춘다. 어느 문서도 Graphify 후보 경로를 승인된 변경 범위로 표현하지 않게 한다.

#### Interface

- 제공: 새 frontmatter 예시와, Graphify가 `scope_evidence`를 쓰되 `affected_paths`는 사용자가 확정한다는 일관된 안내.
- 거부: `bouncer.graph`를 새 작성 형식으로 안내하는 문서, Graphify가 범위를 승인하거나 새 producer를 이미 지원한다고 암시하는 설명.

#### Touch

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

#### Constraints

- 사람용 `.bouncer/context` 본문은 한국어로 쓰고, 코드·경로·필드명은 그대로 둔다.
- 규칙과 스킬은 새 작성 형식만 권장하며 구 `graph`는 읽기 호환이라는 사실만 남긴다.
- 후보 경로는 advisory이며, `affected_paths`는 사용자 승인 뒤에만 기록된다는 경계를 반복해 보존한다.
