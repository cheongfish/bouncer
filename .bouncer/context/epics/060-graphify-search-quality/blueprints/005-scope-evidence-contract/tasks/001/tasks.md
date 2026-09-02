---
type: bouncer.tasks
title: 범위 판단 근거 스키마를 정규화함
description: Tasks for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/005-scope-evidence-contract/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-18T08:58:48.535+09:00'
bouncer:
  id: TASKS-001
  epic_id: '060'
  blueprint_id: '005'
  status: verified
  affected_paths:
    - scripts/src/lib/validate-structural.ts
    - scripts/lib/validate-structural.js
    - scripts/src/lib/validate-gates.ts
    - scripts/lib/validate-gates.js
    - scripts/src/lib/scaffold.ts
    - scripts/lib/scaffold.js
    - test/validate-structural.test.js
    - test/validate-gates.test.js
    - test/scaffold.test.js
  verify: npm test
  commit_intent:
    - Graphify 구현 이름과 범위 판단 근거의 정본을 분리함
    - 구 계획 문서의 읽기 호환을 유지함
  graph:
    generated_at: '2026-08-18T09:01:54.000+09:00'
    command: graphify query "isValidGraphBasis validate-gates validate-structural scaffold bouncer graph" --graph source+context
    suggested_paths:
      - scripts/lib
      - scripts/src/lib
      - test
    basis:
      - graph: source
        status: updated
        query: isValidGraphBasis validate-gates validate-structural scaffold bouncer graph
        result: 83 nodes; validate-structural, validate-gates, scaffold 및 대응 JavaScript 산출물을 확인함
      - graph: context
        status: updated
        query: Graphify suggested_paths graph basis scope evidence
        result: 8 nodes; graph basis 기록을 도입한 epic 015와 Graphify bootstrap epic 025를 확인함
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer.scope_evidence`를 task 범위 판단의 정본으로 도입한다. 새 문서는 이 구조를 쓰고, 기존 `bouncer.graph` 문서는 읽기 시에만 같은 내부 형태로 정규화하여 기존 계획을 계속 검증한다.

## Interface
- 제공: `scope_evidence`의 `producer: graphify`, `generated_at`, `suggested_paths`, `basis`를 검사하는 단일 helper와 Graphify 결과를 이 구조에 쓰는 scaffold 경로.
- 거부: `scope_evidence`와 `graph`를 한 문서에 함께 쓰는 모호한 입력, 비어 있거나 형식이 틀린 evidence, 승인 없이 `affected_paths`를 evidence 후보로 교체하는 동작.

## Touch
- Modify `scripts/src/lib/validate-structural.ts` — 새·구 evidence를 정규화하고 S9의 구조 검증을 한 helper에 둔다.
- Modify `scripts/lib/validate-structural.js` — TypeScript source와 동기화된 실행 산출물을 반영한다.
- Modify `scripts/src/lib/validate-gates.ts` — G4가 정규화 결과의 후보 경로와 basis를 검사하게 한다.
- Modify `scripts/lib/validate-gates.js` — TypeScript source와 동기화된 실행 산출물을 반영한다.
- Modify `scripts/src/lib/scaffold.ts` — 새 task scaffold가 `scope_evidence` 빈 구조를 만든다.
- Modify `scripts/lib/scaffold.js` — TypeScript source와 동기화된 실행 산출물을 반영한다.
- Modify `test/validate-structural.test.js` — 새 형식, 구 형식 호환, 혼합 형식 거절을 검증한다.
- Modify `test/validate-gates.test.js` — G4가 새 정본과 구 형식 정규화를 같은 규칙으로 판단함을 검증한다.
- Modify `test/scaffold.test.js` — scaffold의 새 frontmatter 출력과 빈 evidence 상태를 검증한다.

## Do not touch
- `scripts/src/lib/graph-exec.ts` — Graphify 실행·질의 알고리즘은 유지한다.
- `scripts/lib/graph-exec.js` — 실행 산출물도 같은 이유로 변경하지 않는다.
- `.bouncer/config.json` — evidence 모델 전환을 새 설정으로 만들지 않는다.

## Constraints
- S9와 G4는 별도 검사 구현을 만들지 않고 같은 정규화·검증 helper를 공유한다.
- 새 문서의 쓰기 형식은 `scope_evidence` 하나이며, `graph`는 기존 문서 읽기 호환에만 쓴다.
- legacy 정규화는 의미를 보존해야 하며, 두 형식 동시 존재를 묵인하면 안 된다.
- 새 의존성이나 config key를 추가하지 않는다.

## Checklist
- [ ] `test/validate-structural.test.js`와 `test/validate-gates.test.js`에 새 `scope_evidence`가 통과하고, 기존 `graph`가 호환되며, 두 필드 동시 존재와 잘못된 producer가 실패하는 사례를 먼저 추가한다.
- [ ] 아래 명령으로 새 회귀 사례가 구현 전 실패하는지 확인한다.

```bash
node --test test/validate-structural.test.js test/validate-gates.test.js test/scaffold.test.js
```

- [ ] `validate-structural`에 한 정규화·검증 helper를 구현하고 `validate-gates` G4가 그 결과만 소비하도록 바꾼다.
- [ ] scaffold 기본값을 `scope_evidence`로 전환하고 TypeScript emit 산출물을 갱신한다.
- [ ] 아래 명령으로 구조·게이트·scaffold 회귀와 emit 동기화를 확인한다.

```bash
npm run check:emit && node --test test/validate-structural.test.js test/validate-gates.test.js test/scaffold.test.js
```
