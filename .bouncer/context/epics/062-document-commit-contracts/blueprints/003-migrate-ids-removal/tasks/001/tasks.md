---
type: bouncer.tasks
title: 레거시 ID 이관 표면 제거
description: Removes legacy-ID migration commands, hooks, references, and obsolete tests.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/003-migrate-ids-removal/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-04T13:25:50.478+09:00'
bouncer:
  id: TASKS-001
  epic_id: '062'
  blueprint_id: '003'
  status: verified
  verify: npm test
  affected_paths:
    - skills/migrate-ids/SKILL.md
    - scripts/src/lib/migrate-ids.ts
    - scripts/lib/migrate-ids.js
    - hooks/session-legacy-ids.js
    - hooks/hooks.json
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - scripts/src/lib/import-history.ts
    - scripts/lib/import-history.js
    - scripts/src/lib/migrate-task-layout.ts
    - scripts/lib/migrate-task-layout.js
    - scripts/src/lib/paths.ts
    - scripts/lib/paths.js
    - scripts/check-doc-shape.js
    - scripts/src/lib/runtime-state.ts
    - scripts/lib/runtime-state.js
    - test/migrate-ids.test.js
    - test/legacy-ids-warn.test.js
    - test/cursor-plugin.test.js
    - test/master-rules.test.js
    - test/plugin-wiring.test.js
    - test/skill-bouncer-surface.test.js
    - test/trust-boundary.test.js
    - test/paths.test.js
    - rules/skill-shape.md
    - docs/troubleshooting.md
    - docs/context-versioning.md
    - docs/install.md
    - docs/ARCHITECTURE.md
    - docs/cli.md
    - docs/compatibility.md
    - .bouncer/distill/plugin-skills.md
    - .bouncer/distill/context-layout.md
    - CHANGELOG.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-04T13:37:00.000+09:00'
    suggested_paths:
      - scripts/src/lib/cli-flags.ts
      - scripts/src/lib/cli-project-commands.ts
      - scripts/src/lib/codex-agents.ts
      - scripts/src/lib/commit.ts
      - scripts/src/lib/context-digest.ts
      - scripts/src/lib/current.ts
      - scripts/src/lib/distill.ts
      - scripts/src/lib/finalize.ts
      - scripts/src/lib/frontmatter.ts
      - scripts/src/lib/import-history.ts
      - scripts/src/lib/import-render.ts
      - scripts/src/lib/migrate-task-layout.ts
      - scripts/src/lib/paths.ts
      - scripts/src/lib/render.ts
      - scripts/src/lib/runtime-state.ts
      - scripts/src/lib/scaffold.ts
      - scripts/src/lib/validate-structural.ts
      - scripts/src/lib/verification.ts
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    basis:
      - graph: source
        status: reused
        query: legacy id migration
        result: source graph fresh; ranked 19 implementation candidates
      - graph: test
        status: reused
        query: legacy id migration
        result: test graph fresh; ranked one test candidate
      - graph: context
        status: updated
        query: legacy id migration
        result: context graph rebuilt; ranked four context candidates
    quality: { status: ranked, confidence: medium, reasons: [source omissions, context seeds, relation filter] }
    candidates:
      implementation:
        - { path: scripts/src/lib/cli-project-commands.ts, score: 5, confidence: medium, basis: [calls relation, implementation path] }
        - { path: scripts/src/lib/import-history.ts, score: 5, confidence: medium, basis: [calls relation, implementation path] }
        - { path: scripts/src/lib/migrate-task-layout.ts, score: 5, confidence: medium, basis: [calls relation, implementation path] }
        - { path: scripts/src/lib/paths.ts, score: 5, confidence: medium, basis: [calls relation, implementation path] }
        - { path: scripts/src/lib/runtime-state.ts, score: 5, confidence: medium, basis: [calls relation, implementation path] }
        - { path: scripts/src/lib/migrate-ids.ts, score: 3, confidence: low, basis: [path seed scripts/src/lib/migrate-ids.ts, implementation path] }
      test:
        - { path: test/validate-structural.test.js, score: -8, confidence: low, basis: [seed match legacy, test-only without implementation link, contains-only reach] }
      context:
        - { path: .bouncer/context/epics/014-numeric-context-ids/blueprints/002-migrate-ids-cli/tasks/001/tasks.md, score: 4, confidence: medium, basis: [context graph hit] }
        - { path: .bouncer/context/epics/018-task-unit-commits/blueprints/010-task-dir-layout/tasks/004/tasks.md, score: 4, confidence: medium, basis: [context graph hit] }
        - { path: .bouncer/context/epics/062-document-commit-contracts/blueprints/003-migrate-ids-removal/index.md, score: 4, confidence: medium, basis: [context graph hit] }
        - { path: .bouncer/context/epics/062-document-commit-contracts/blueprints/003-migrate-ids-removal/tasks/001/tasks.md, score: 4, confidence: medium, basis: [context graph hit] }
  commit_intent:
    - 숫자 ID 전환 뒤에도 남은 공개 이관 경로를 없앰
    - 유지되는 이관 명령의 dirty-worktree 안전성은 보존함
---
# 레거시 ID 이관 표면 제거

Blueprint: [003](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
레거시 ID 자동 이관 기능을 코드와 공개 표면에서 제거한다. 다른 이관 명령이 공유하는 dirty-worktree 판정은 공용 모듈로 옮겨 동작을 유지한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `migrate task-layout`, `import-history`의 dirty-worktree 거부 동작을 유지한다.
- 거부: `bouncer migrate ids`와 레거시 ID SessionStart 경고는 호출하거나 등록할 수 없다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Delete `skills/migrate-ids/SKILL.md` — 폐기한 공개 스킬을 제거한다.
- Delete `scripts/src/lib/migrate-ids.ts` — 레거시 이관 구현을 제거한다.
- Delete `scripts/lib/migrate-ids.js` — 컴파일 산출물을 함께 제거한다.
- Delete `hooks/session-legacy-ids.js` — 폐기 기능의 SessionStart 경고를 제거한다.
- Modify `hooks/hooks.json` — 삭제한 훅 배선을 제거한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — `migrate ids` 명령 배선을 제거한다.
- Modify `scripts/lib/cli-project-commands.js` — 컴파일 명령 배선을 맞춘다.
- Modify `scripts/src/lib/import-history.ts` — 공용 dirty-worktree helper를 사용한다.
- Modify `scripts/lib/import-history.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/migrate-task-layout.ts` — 공용 dirty-worktree helper를 사용한다.
- Modify `scripts/lib/migrate-task-layout.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/src/lib/paths.ts` — 레거시 prefix 전용 경로 처리를 제거한다.
- Modify `scripts/lib/paths.js` — 컴파일 산출물을 맞춘다.
- Modify `scripts/check-doc-shape.js` — migrate-ids 특례를 제거한다.
- Modify `scripts/src/lib/runtime-state.ts` — 재사용되는 dirty-worktree helper를 소유한다.
- Modify `scripts/lib/runtime-state.js` — 컴파일 산출물을 맞춘다.
- Delete `test/migrate-ids.test.js` — 삭제 기능의 전용 테스트를 제거한다.
- Delete `test/legacy-ids-warn.test.js` — 삭제 훅의 전용 테스트를 제거한다.
- Modify `test/cursor-plugin.test.js` — 카탈로그 단언을 현재 표면으로 갱신한다.
- Modify `test/master-rules.test.js` — 제거된 기능 참조 단언을 갱신한다.
- Modify `test/plugin-wiring.test.js` — 훅 배선 단언을 갱신한다.
- Modify `test/skill-bouncer-surface.test.js` — 공개 스킬 표면 단언을 갱신한다.
- Modify `test/trust-boundary.test.js` — 제거된 스킬 참조를 갱신한다.
- Modify `test/paths.test.js` — 제거된 `normalizeContextId` 단언을 갱신한다.
- Modify `rules/skill-shape.md` — migrate-ids 예외 조항을 제거한다.
- Modify `docs/troubleshooting.md` — 폐기 명령 안내를 제거한다.
- Modify `docs/context-versioning.md` — 자동 이관 설명을 제거한다.
- Modify `docs/install.md` — 설치 뒤 이관 안내를 제거한다.
- Modify `docs/ARCHITECTURE.md` — 레거시 이관 구조 설명을 제거한다.
- Modify `docs/cli.md` — 삭제된 CLI를 제거한다.
- Modify `docs/compatibility.md` — 호환성 변경을 기록한다.
- Modify `.bouncer/distill/plugin-skills.md` — 실행 시 참조할 스킬 목록을 갱신한다.
- Modify `.bouncer/distill/context-layout.md` — 레거시 ID 이관 설명을 제거한다.
- Modify `CHANGELOG.md` — 공개 기능 제거를 기록한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/validate-structural.ts` — 숫자 ID 구조 검증 자체는 바꾸지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 새 대체 CLI·별칭·경고 훅을 남기지 않는다. `migrate-task-layout.ts`는 helper import만 바꾸고 task layout 변환 의미는 유지한다. 삭제 전후 `npm test`에서 레거시 표면 참조가 남지 않아야 한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] migrate-ids와 legacy-id를 찾는 회귀 테스트를 먼저 갱신하고, 삭제된 명령·훅·스킬이 더는 노출되지 않음을 확인한다.
- [ ] `isWorktreeDirty`의 기존 거부 사례가 task-layout과 history import에서 계속 실패하는지 확인한다.
- [ ] 구현·컴파일 산출물·훅·문서·Distill을 같은 제거 계약으로 갱신한다.
- [ ] `npm test`를 실행한다.
