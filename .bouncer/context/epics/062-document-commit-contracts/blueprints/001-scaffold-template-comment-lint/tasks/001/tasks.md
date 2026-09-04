---
type: bouncer.tasks
title: 컨텍스트 템플릿 주석 검사
description: Adds focused comment linting while keeping CI independent of ignored local config.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/001-scaffold-template-comment-lint/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-04T10:45:54.503+09:00'
bouncer:
  id: TASKS-001
  epic_id: '062'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 작성 완료 문서에 일회성 스캐폴드 안내가 남는 문제를 방지함
    - 기존 컨텍스트 코퍼스를 일괄 수정하지 않고 새 변경만 검증함
  verify: npm run ci
  affected_paths:
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - scripts/check-context-comments.js
    - package.json
    - test/ci-contract.test.js
    - test/context-comments.test.js
    - test/distill.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T11:30:00+09:00'
    suggested_paths:
      - references/spec-authoring/blueprint.md
    quality:
      status: ranked
      confidence: medium
      reasons:
        - 'source omissions: skipped unknown relation: rationale_for'
        - 'context seeds: 2 labels, 4 paths'
        - 'relation filter: calls, imports, imports_from (depth ≤ 2); contains ownership only'
    candidates:
      implementation:
        - path: references/spec-authoring/blueprint.md
          score: 5
          confidence: medium
          basis:
            - 'defines unique seed documents'
            - 'implementation path'
            - 'contains-only reach'
      test: []
      context:
        - path: .bouncer/context/epics/004-planning-quality-governance/blueprints/001-spec-authoring-guardrails/tasks/001/tasks.md
          score: 4
          confidence: medium
          basis:
            - 'context graph hit'
    basis:
      - graph: source
        status: reused
        query: 'remove scaffold comment and placeholder tokens from active bouncer plan documents'
        result: 'source graph was fresh; references/spec-authoring/blueprint.md ranked as implementation candidate'
      - graph: test
        status: reused
        query: 'remove scaffold comment and placeholder tokens from active bouncer plan documents'
        result: 'test graph was fresh; no linked test candidate ranked'
      - graph: context
        status: updated
        query: 'remove scaffold comment and placeholder tokens from active bouncer plan documents'
        result: 'context graph was fresh; four context candidates ranked'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
변경된 `.bouncer/context/**/*.md`에 스캐폴드가 넣은 안내 주석 또는 TODO 플레이스홀더가 남으면 CI에서 실패하게 한다. Git-ignored `.bouncer/config.json`이 없는 execute worktree에서도 CI가 통과하도록 해당 파일을 직접 읽는 Distill 테스트는 제거한다. 기존 미수정 문서와 저자가 의도적으로 쓴 일반 HTML 주석은 검사 대상에서 제외한다.

## Interface
- 제공: `scripts/check-context-comments.js`와 `npm run lint:context-comments`가 명시 파일 또는 `--base <ref>` 기준 변경 파일을 검사한다.
- 거부: 템플릿에 없는 HTML 주석을 오류로 취급하지 않으며, 삭제 파일과 변경되지 않은 기존 파일을 검사하지 않는다.

## Touch
- Modify `scripts/src/lib/templates.ts` — 스캐폴드가 소유한 안내 주석 본문을 검사기가 재사용할 수 있게 노출한다.
- Modify `scripts/lib/templates.js` — TypeScript 변경에 대응하는 컴파일 산출물을 갱신한다.
- Create `scripts/check-context-comments.js` — 명시 파일과 Git diff 기반 변경 파일에서 템플릿 주석 및 TODO 플레이스홀더를 검사한다.
- Modify `package.json` — `lint:context-comments` 명령과 `ci` 실행 순서를 등록한다.
- Modify `test/ci-contract.test.js` — 새 npm 명령과 CI 순서를 계약으로 고정한다.
- Create `test/context-comments.test.js` — 변경·미추적·기존 미수정·삭제 파일 및 사용자 주석의 동작을 고정한다.
- Modify `test/distill.test.js` — 저장소의 Git-ignored `.bouncer/config.json`을 직접 읽는 테스트 코드를 제거한다.

## Do not touch
- `scripts/check-doc-shape.js` — skills·agents·references 구조 계약만 계속 담당한다.
- `.bouncer/context/epics/**`의 기존 문서 — 이번 task는 검사기만 추가하며 기존 코퍼스를 고치지 않는다.

## Constraints
- 검사 대상 선택은 shell 문자열 조합이 아닌 Git argv 호출로 구현한다.
- `--base`의 기본값은 `HEAD`이며, CI가 전달한 merge-base를 그대로 사용할 수 있어야 한다.
- 검사 실패는 CI lint 실패로만 표현하고 Bouncer gate 코드나 JSON stdout 형식을 바꾸지 않는다.
- 새 검사기는 명시적으로 받은 파일 외에 임의의 기존 문서를 읽거나 수정하지 않는다.
- Distill 테스트는 fixture에서 만든 설정 또는 설정 부재 폴백만 검증하고, 실제 저장소의 Git-ignored 설정 파일을 요구하지 않는다.

## Checklist
- [ ] `test/context-comments.test.js`에 템플릿 주석·TODO 플레이스홀더가 있는 변경/미추적 컨텍스트 문서는 실패하고, 기존 미수정 문서·삭제 파일·사용자 HTML 주석은 통과하는 실패 테스트를 작성한다.
- [ ] 아래 명령으로 새 테스트가 검사기 부재 상태에서 실패함을 확인한다.
  ```sh
  node --test test/context-comments.test.js
  ```
- [ ] 템플릿 안내 주석을 정규화해 비교하고, 명시 파일 및 `--base` diff와 working tree 변경 파일을 선택하는 검사기를 구현한다.
- [ ] `package.json`의 `lint:context-comments`와 `ci` 순서를 추가하고 `test/ci-contract.test.js`의 계약을 갱신한다.
- [ ] `test/distill.test.js`에서 실제 `.bouncer/config.json`을 읽고 값을 단정하는 테스트 코드를 삭제한 뒤, 설정 파일이 없는 worktree에서 해당 파일의 테스트가 통과하는지 확인한다.
- [ ] 아래 명령이 모두 통과하는지 확인한다.
  ```sh
  npm test
  npm run lint:context-comments -- --base HEAD
  npm run ci
  ```
