---
type: bouncer.tasks
title: 파싱 실패와 문서 부재 진단 분리
description: 존재하는 context-review 문서의 frontmatter 파싱 실패를 부재와 구분해 복구 지침을 정확히 제공한다
resource: .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T10:42:21.253+09:00'
bouncer:
  id: TASKS-003
  epic_id: '059'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - 존재하는 context-review 문서를 missing으로 오인하는 연쇄 오류를 막음
    - S0 원인과 G18 복구 안내가 같은 파일 상태를 정확히 설명하게 함
  affected_paths:
    - scripts/src/lib/validate.ts
    - scripts/src/lib/validate-gates.ts
    - scripts/lib/validate.js
    - scripts/lib/validate-gates.js
    - test/validate-structural.test.js
    - test/validate-gates.test.js
    - docs/troubleshooting.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T10:55:16+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/002
      - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/003
      - .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: validate YAML parse failure distinguish missing context review diagnostic G18
        result: 18 hits; validate-gates test was the relevant diagnostic path
      - graph: context
        status: reused
        query: parse failure missing document diagnostic audit debt BP004
        result: 9 hits; current BP004 task briefs were the only relevant context paths
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
full blueprint의 `context-review.md`가 존재하지만 frontmatter 파싱에 실패하면 S0과 파싱 오류용 G18을 함께 보고한다. 실제 부재일 때만 scaffold 안내를 유지하며 게이트 통과 조건과 코드 집합은 바꾸지 않는다.

## Interface
- 제공: plan gate가 loader의 `parseErrors`를 받아 `rels.contextReview`의 S0 존재 여부를 판별한다. 해당 오류가 있으면 G18은 invalid frontmatter와 S0 수정 지침을 보고한다.
- 거부: 파일이 실제로 없을 때는 기존 `context-review.md missing ... scaffold context-review` 메시지를 유지한다. 파싱 실패를 통과시키거나 G18을 생략하지 않는다.

## Touch
- Modify `scripts/src/lib/validate.ts` — loader의 parse error 목록을 gate context에 전달한다.
- Modify `scripts/src/lib/validate-gates.ts` — context-review 파싱 실패와 실제 부재의 G18 메시지를 분기한다.
- Modify `scripts/lib/validate.js` — TypeScript 변경의 커밋 대상 런타임 산출물을 갱신한다.
- Modify `scripts/lib/validate-gates.js` — gate 진단 변경의 런타임 산출물을 갱신한다.
- Modify `test/validate-structural.test.js` — 잘못된 백틱 scalar가 S0과 invalid-frontmatter G18을 내는 통합 재현을 추가한다.
- Modify `test/validate-gates.test.js` — parseErrors가 있는 문서와 실제 missing 문서의 메시지 분기를 단언한다.
- Modify `docs/troubleshooting.md` — S0+G18 파싱 실패와 실제 missing의 서로 다른 복구 절차를 안내한다.

## Do not touch
- `scripts/src/lib/frontmatter.ts` — 파서 문법과 오류 원문은 그대로 사용한다.
- `scripts/src/lib/validate-docs.ts` — loader가 이미 S0과 실패 파일 경로를 제공한다.
- `scripts/src/lib/schema.ts` — G/S 코드와 문서 스키마 변경이 아니다.

## Constraints
- 결과는 계속 실패여야 하며 S0·G18 코드를 새 코드로 교체하지 않는다.
- light blueprint는 context-review가 없으므로 기존 G18 면제를 유지한다.
- 다른 optional 문서의 파싱 실패 메시지를 이번 task에서 일반화하지 않는다.
- 생성 JavaScript는 `npm run build`로 TypeScript와 일치시킨다.

## Checklist
- [ ] 존재하는 `context-review.md`에 백틱 선두 평문 scalar를 넣은 통합 fixture를 추가한다.
  ```yaml
  note: `context-review.md`가 존재함
  ```
- [ ] 테스트가 현재 S0과 `context-review.md missing`을 함께 내는지 확인한다.
- [ ] gate context에 parseErrors를 전달하고 `rels.contextReview`의 S0이면 G18 메시지를 `context-review.md has invalid frontmatter; fix the S0 parse error`로 분기한다.
- [ ] 실제 파일 부재 fixture는 기존 missing·scaffold 안내를 계속 단언한다.
- [ ] troubleshooting에 두 증상과 서로 다른 복구 명령을 기록한다.
- [ ] `npm run build`와 `npm run ci`가 통과한다.
