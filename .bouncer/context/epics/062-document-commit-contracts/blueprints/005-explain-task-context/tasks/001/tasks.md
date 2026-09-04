---
type: bouncer.tasks
title: explain task 맥락 이관
description: Copies durable task design context into optional finalized explain sections.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/005-explain-task-context/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-04T13:25:50.664+09:00'
bouncer:
  id: TASKS-001
  epic_id: '062'
  blueprint_id: '005'
  status: verified
  verify: npm test
  affected_paths:
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - scripts/src/lib/finalize.ts
    - scripts/lib/finalize.js
    - scripts/src/lib/validate-sections.ts
    - scripts/lib/validate-sections.js
    - scripts/src/lib/validate-gates.ts
    - scripts/lib/validate-gates.js
    - references/explain-diff/index.md
    - test/finalize-pure.test.js
    - test/finalize.test.js
    - test/validate-gates.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T13:33:00.000+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    basis:
      - { graph: source, status: reused, query: document commit lifecycle task context staging message, result: source graph fresh; ranking produced 621 candidates }
      - { graph: test, status: reused, query: document commit lifecycle task context staging message, result: test graph fresh; ranking produced 621 candidates }
      - { graph: context, status: updated, query: document commit lifecycle task context staging message, result: context graph rebuilt; ranking produced 621 candidates }
    quality: { status: low-confidence, confidence: low, reasons: [source omissions, context seed volume, relation filter, result explosion] }
    candidates: { implementation: [], test: [], context: [] }
  commit_intent:
    - 종료 뒤에도 task 설계 판단을 읽을 수 있게 보존함
    - 기존 explain 문서의 필수 계약은 바꾸지 않음
---
# explain task 맥락 이관

Blueprint: [005](../../index.md)

## Goal & intent
finalize가 task 문서를 삭제하기 전에 task별 의도·인터페이스·미변경 범위를 `explain.md`로 이관한다. `## Tasks`는 선택적 보존 섹션으로 추가하고 기존 G16 필수 목록은 유지한다.

## Interface
- 제공: task ID 소제목과 세 설계 섹션을 가진 선택적 `## Tasks` 출력, 작성자 제어의 semantic line breaks를 제공한다.
- 거부: 자동 문장 분할, 실행 증거 이관, `## Tasks` 부재를 G16 실패로 만드는 변경은 하지 않는다.

## Touch
- Modify `scripts/src/lib/templates.ts` — explain 템플릿과 task 맥락 출력을 추가한다.
- Modify `scripts/lib/templates.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/finalize.ts` — task commit 수집과 같은 스냅샷에서 영구 설계 맥락을 수집한다.
- Modify `scripts/lib/finalize.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/validate-sections.ts` — `## Tasks`를 인식하되 필수 목록과 분리한다.
- Modify `scripts/lib/validate-sections.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/validate-gates.ts` — G16의 기존 필수 섹션 계약을 유지한다.
- Modify `scripts/lib/validate-gates.js` — 컴파일 산출물을 맞춘다.
- Modify `references/explain-diff/index.md` — Tasks와 semantic line breaks 작성 규칙을 문서화한다.
- Modify `test/finalize-pure.test.js` — explain 본문 수집·형식을 단언한다.
- Modify `test/finalize.test.js` — finalize 전후 task 수명주기와 호환성을 단언한다.
- Modify `test/validate-gates.test.js` — 선택적 섹션과 G16 호환성을 단언한다.

## Do not touch
- `scripts/src/lib/commit.ts` — task 커밋 스테이징 정책은 다음 BP에서 다룬다.

## Constraints
- 새 의존성을 추가하지 않는다. `Background`와 `Intuition`은 템플릿이 마침표로 분할하지 않고 작성자 입력을 보존한다.

## Checklist
- [ ] 기존 explain과 `## Tasks`가 없는 explain을 통과시키는 테스트를 먼저 작성한다.
- [ ] task 스냅샷에서 세 설계 섹션만 선택적으로 출력하도록 구현한다.
- [ ] 섹션 파서와 G16 필수 목록을 분리하고 작성 규칙을 갱신한다.
- [ ] `npm test`를 실행한다.
