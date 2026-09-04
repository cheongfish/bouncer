---
type: bouncer.tasks
title: 저작 커밋 메시지 필드 도입
description: Builds task and finalize messages from validated authored fields and blueprint intent.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/005-explain-task-context/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - commit_message
  - finalize
timestamp: '2026-09-04T13:25:50.839+09:00'
bouncer:
  id: TASKS-003
  epic_id: '062'
  blueprint_id: '005'
  status: ready
  verify: npm test
  affected_paths:
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - scripts/src/lib/commit.ts
    - scripts/lib/commit.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - .gitmessage
    - references/spec-authoring/index.md
    - references/spec-authoring/tasks.md
    - rules/okf.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - test/commit-task.test.js
    - test/finalize-pure.test.js
    - test/finalize.test.js
    - test/skill-spec-authoring.test.js
    - test/skill-bouncer-plan.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T13:33:00.000+09:00'
    suggested_paths: []
    basis:
      - { graph: source, status: reused, query: document commit lifecycle task context staging message, result: source graph fresh; ranking produced 621 candidates }
      - { graph: test, status: reused, query: document commit lifecycle task context staging message, result: test graph fresh; ranking produced 621 candidates }
      - { graph: context, status: updated, query: document commit lifecycle task context staging message, result: context graph rebuilt; ranking produced 621 candidates }
    quality: { status: low-confidence, confidence: low, reasons: [source omissions, context seed volume, relation filter, result explosion] }
    candidates: { implementation: [], test: [], context: [] }
  commit_intent:
    - 커밋 메시지의 배경과 변경 요약을 저작자가 소유하게 함
    - 임시 verification 제목에 의존하지 않게 함
---
# 저작 커밋 메시지 필드 도입

Blueprint: [005](../../index.md)

## Goal & intent
task 커밋은 `commit_intent`와 새 `commit_summary`에서, finalize 커밋은 blueprint Intent에서 본문을 만든다. 각 필드가 존재하면 1~2개의 한국어 종결 문장을 요구하고 전체 본문은 네 줄을 넘지 않는다.

## Interface
- 제공: task `bouncer.commit_summary`와 1~2줄 `commit_intent`, Intent 기반 finalize 메시지 생성을 제공한다.
- 거부: 잘못된 authored 필드·파싱 불가 Intent는 부분 생략하지 않고 메시지 생성 오류가 된다. 필드가 없는 기존 task는 읽을 수 있다.

## Touch
- Modify `scripts/src/lib/templates.ts` — task summary 자리와 Intent 종결 규칙을 제공한다.
- Modify `scripts/lib/templates.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/commit.ts` — intent와 summary를 순서대로 검증·조립한다.
- Modify `scripts/lib/commit.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/finalize.ts` — blueprint Intent에서 finalize 메시지를 조립한다.
- Modify `scripts/lib/finalize.js` — 컴파일 산출물을 맞춘다.
- Modify `.gitmessage` — 각 1~2줄, 총 네 줄의 메시지 형식을 명시한다.
- Modify `references/spec-authoring/index.md` — 필드 소유권과 작성 형식을 갱신한다.
- Modify `references/spec-authoring/tasks.md` — task frontmatter 작성 규칙을 갱신한다.
- Modify `rules/okf.md` — `commit_summary`와 호환성 계약을 기록한다.
- Modify `skills/bouncer-plan/SKILL.md` — 새 task 필드와 1~2줄 intent 작성 계약을 반영한다.
- Modify `skills/bouncer-commit/SKILL.md` — verification 제목 대신 authored summary를 쓰는 계약을 반영한다.
- Modify `skills/bouncer-finalize/SKILL.md` — blueprint Intent 기반 remainder 메시지 계약을 반영한다.
- Modify `test/commit-task.test.js` — task 메시지 순서·형식 오류·기존 task 호환성을 단언한다.
- Modify `test/finalize-pure.test.js` — Intent 파싱과 finalize 메시지 오류를 단언한다.
- Modify `test/finalize.test.js` — 실제 finalize 메시지 계약을 단언한다.
- Modify `test/skill-spec-authoring.test.js` — 작성 규칙 계약을 단언한다.
- Modify `test/skill-bouncer-plan.test.js` — plan 작성 계약을 단언한다.

## Do not touch
- `scripts/src/lib/scope.ts` — task 스테이징 정책은 task 002 계약을 유지한다.

## Constraints
- 파일·모듈·패키지 이름을 authored intent·summary에 넣지 않는다. 새 의존성이나 trailer를 추가하지 않는다.

## Checklist
- [ ] 1~2줄 종결 규칙, 네 줄 예산, 기존 필드 부재의 호환성을 먼저 테스트한다.
- [ ] task message 조립을 verification title에서 분리하고 intent·summary 순서로 구현한다.
- [ ] finalize가 blueprint Intent만 파싱하도록 바꾸고 템플릿·규칙을 갱신한다.
- [ ] `npm test`를 실행한다.
