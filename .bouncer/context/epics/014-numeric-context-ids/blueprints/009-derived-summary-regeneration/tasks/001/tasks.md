---
type: bouncer.tasks
title: 에픽 색인 파생 요약 정합성 복구
description: Tasks for blueprint 009.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/009-derived-summary-regeneration/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - validation
timestamp: '2026-08-31T13:35:31.411+09:00'
bouncer:
  id: TASKS-001
  epic_id: '014'
  blueprint_id: '009'
  status: verified
  verify: npm run ci
  commit_intent:
    - 에픽 요약을 두 곳에서 따로 저술해 drift가 누적되는 구조를 제거함
    - description 정본의 재생성과 S13 lint로 플레이스홀더 재발을 차단함
  affected_paths:
    - scripts/src/lib/epic-index.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/cli-doc-commands.ts
    - scripts/lib/epic-index.js
    - scripts/lib/scaffold.js
    - scripts/lib/cli-doc-commands.js
    - test/scaffold.test.js
    - test/validate-structural.test.js
    - test/cli-validate.test.js
    - test/validate-gates.test.js
    - skills/agentic-code-benchmark/scripts/run_deepswe.py
    - skills/bouncer-plan/SKILL.md
    - references/spec-authoring/index.md
    - references/spec-authoring/epic.md
    - rules/okf.md
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - docs/cli.md
    - docs/gates.md
    - docs/compatibility.md
    - docs/troubleshooting.md
    - .bouncer/context/index.md
    - .bouncer/context/epics/001-cli-usability/index.md
    - .bouncer/context/epics/002-commit-artifacts/index.md
    - .bouncer/context/epics/003-multi-agent-plugin/index.md
    - .bouncer/context/epics/004-starter-kit-convergence/index.md
    - .bouncer/context/epics/005-review-depth/index.md
    - .bouncer/context/epics/006-scripts-typescript/index.md
    - .bouncer/context/epics/007-project-distill/index.md
    - .bouncer/context/epics/008-worktree-seed/index.md
    - .bouncer/context/epics/010-active-pointer-cli/index.md
    - .bouncer/context/epics/011-graphify-signal/index.md
    - .bouncer/context/epics/012-finalize-handoff/index.md
    - .bouncer/context/epics/039-open-source-one-zero/index.md
    - .bouncer/context/epics/016-advisor-removal/index.md
    - .bouncer/context/epics/017-verify-wrapper-guidance/index.md
    - .bouncer/context/epics/018-task-unit-commits/index.md
    - .bouncer/context/epics/019-task-pointer/index.md
    - .bouncer/context/epics/020-task-unit-artifacts/index.md
    - .bouncer/context/epics/021-task-commit-stage/index.md
    - .bouncer/context/epics/022-blueprint-closure/index.md
    - .bouncer/context/epics/023-worktree-layout/index.md
    - .bouncer/context/epics/024-light-path/index.md
    - .bouncer/context/epics/038-distill-worktree-base/index.md
    - .bouncer/context/epics/040-scope-evidence/index.md
    - .bouncer/context/epics/041-plan-mermaid-zoom/index.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T13:45:35.199+09:00'
    suggested_paths: []
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - 'test graph missing: missing graphify-out/test/graph.json'
        - 'context seeds: 473 labels, 426 paths'
        - 'relation filter: calls, imports, imports_from (depth <= 2); contains ownership only'
        - 'result explosion: 483 candidates (>= 50)'
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: epic description index regeneration ensureEpicIndexEntry formatEpicIndexLine S13 scaffold fixtures
        result: source graph was fresh; ranking expanded to 483 candidates and produced no reliable file list
      - graph: test
        status: missing
        query: test graph is not configured
        result: graphify-out/test/graph.json is absent
      - graph: context
        status: updated
        query: epic description index regeneration ensureEpicIndexEntry formatEpicIndexLine S13 scaffold fixtures
        result: context graph rebuilt with 473 labels and 426 paths; result explosion prevented ranking
---
# Tasks

Blueprint: [009](../../index.md)

## Goal & intent
에픽 frontmatter `description`만 사람이 저술하고 번들 색인 행은 그 값에서 재생성한다. 신규 scaffold·기존 행 갱신·S13·61개 기존 데이터가 같은 계약을 사용하며, 플레이스홀더와 실제 요약 불일치가 0개인 상태에서 저장소 검증이 통과해야 한다.

## Interface
- 제공: `bouncer scaffold epic`은 신규 에픽에 비어 있지 않고 `Epic NNN`이 아닌 `--description`을 요구한다. 같은 canonical epic 경로에 재실행하면 기존 epic 파일은 바이트 단위로 보존하고 `.bouncer/context/index.md`의 해당 행만 현재 frontmatter에 맞춰 append·replace·no-op한다.
- 제공: `formatEpicIndexLine`은 신규 행을 만들 때 canonical id·slug와 frontmatter description을 사용한다. 기존 행에서 `ensureEpicIndexEntry`와 S13이 비교·교체하는 대상은 description 부분이며 link label·경로는 보존한다.
- 거부: 신규 scaffold의 description 누락·공백·`Epic <동일 id>` 값, 에픽 frontmatter의 읽기 실패·파싱 실패·비문자열 또는 빈 description은 조용히 fallback하지 않는다. CLI scaffold는 파일을 쓰기 전에 exit 2로 거절하고, 구조 검사는 S13으로 해당 파일과 원인을 보고한다.
- 거부: 재생성은 색인 frontmatter·`# Epics` 헤딩·다른 행·기존 행 순서를 바꾸거나 같은 epic 행을 중복 생성하지 않는다. 서로 다른 slug가 같은 id를 쓰는 기존 `024` 두 경로는 합치지 않는다.

## Touch
- Modify `scripts/src/lib/epic-index.ts` — frontmatter 정본에서 기대 행을 만들고 기존 행 replace·S13 요약 비교를 구현한다.
- Modify `scripts/src/lib/scaffold.ts` — 신규 description 입력과 기존 epic 무덮어쓰기 재진입 계약을 적용한다.
- Modify `scripts/src/lib/cli-doc-commands.ts` — `scaffold epic --description` 검증·usage를 공개한다.
- Modify `scripts/lib/epic-index.js` — TypeScript 빌드 산출물을 재생성한다.
- Modify `scripts/lib/scaffold.js` — TypeScript 빌드 산출물을 재생성한다.
- Modify `scripts/lib/cli-doc-commands.js` — TypeScript 빌드 산출물을 재생성한다.
- Modify `test/scaffold.test.js` — description 필수 입력, 최초 행, 안전한 재실행, replace·no-op·거부를 검증한다.
- Modify `test/validate-structural.test.js` — S13 요약 mismatch와 frontmatter 오류를 검증하고 공용 fixture 행을 description과 맞춘다.
- Modify `test/cli-validate.test.js` — plan gate fixture의 epic description과 파생 행을 새 계약으로 맞춘다.
- Modify `test/validate-gates.test.js` — G gate fixture 세 곳의 literal 행을 epic description과 맞춘다.
- Modify `skills/agentic-code-benchmark/scripts/run_deepswe.py` — benchmark scaffold 호출에 유효한 epic description을 전달한다.
- Modify `skills/bouncer-plan/SKILL.md` — discovery description을 최초 scaffold에 넘기고 authoring 뒤 같은 epic을 재실행해 파생 행을 맞추도록 절차를 바꾼다.
- Modify `references/spec-authoring/index.md` — epic description만 저술하고 번들 행에는 저술 권한을 두지 않는 경계를 명시한다.
- Modify `references/spec-authoring/epic.md` — 완성 예시의 `Epic 077` description을 실제 한 문장으로 바꾼다.
- Modify `rules/okf.md` — frontmatter description 정본과 번들 색인 파생값의 소유권을 기록한다.
- Modify `scripts/src/lib/init.ts` — 초기 번들 색인 안내를 description 정본·append/replace·S13 요약 검사 계약으로 맞춘다.
- Modify `scripts/lib/init.js` — TypeScript 빌드로 초기 번들 색인 안내 산출물을 재생성한다.
- Modify `docs/cli.md` — `scaffold epic --description` 필수 입력과 안전한 재실행 동작을 공개한다.
- Modify `docs/gates.md` — S13의 요약 정합성 판정을 공개 계약에 추가한다.
- Modify `docs/compatibility.md` — S13 호환성 표를 경로·요약 검사로 갱신한다.
- Modify `docs/troubleshooting.md` — S13 요약 mismatch의 재생성 복구 절차를 추가한다.
- Modify `.bouncer/context/index.md` — 61개 기존 에픽과 061 행을 각 frontmatter description에서 재생성한다.
- Modify `.bouncer/context/epics/001-cli-usability/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/002-commit-artifacts/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/003-multi-agent-plugin/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/004-starter-kit-convergence/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/005-review-depth/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/006-scripts-typescript/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/007-project-distill/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/008-worktree-seed/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/010-active-pointer-cli/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/011-graphify-signal/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/012-finalize-handoff/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/index.md` — 현재 실제 색인 행을 description으로 역방향 backfill한다.
- Modify `.bouncer/context/epics/016-advisor-removal/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/017-verify-wrapper-guidance/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/018-task-unit-commits/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/019-task-pointer/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/020-task-unit-artifacts/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/021-task-commit-stage/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/022-blueprint-closure/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/023-worktree-layout/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/024-light-path/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/038-distill-worktree-base/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/040-scope-evidence/index.md` — Intent 목표에서 description을 저술한다.
- Modify `.bouncer/context/epics/041-plan-mermaid-zoom/index.md` — Intent 목표에서 description을 저술한다.

## Do not touch
- `llm-wiki-prework.md` — 계획 입력이며 구현 산출물이 아니다.
- `llm-wiki-ssot.md` — P0의 근거 문서이며 이번 코드 커밋에서 다시 저술하지 않는다.
- `.bouncer/context/epics/024-lightweight-cycle/index.md` — description이 이미 실제 값이므로 파생 행만 재생성한다.
- `.bouncer/context/epics/009-subagent-model-config/index.md` — 실제 값끼리의 불일치는 frontmatter를 정본으로 삼아 파생 행만 바꾼다.
- `.bouncer/context/epics/013-comprehension-gate/index.md` — 실제 값끼리의 불일치는 frontmatter를 정본으로 삼아 파생 행만 바꾼다.
- `.bouncer/context/epics/014-numeric-context-ids/index.md` — 실제 값끼리의 불일치는 frontmatter를 정본으로 삼아 파생 행만 바꾼다.
- `.bouncer/context/epics/042-gate-integrity/index.md` — description과 행이 이미 같아 수정하지 않는다.
- `.bouncer/context/epics/044-finalize-evidence/index.md` — description과 행이 이미 같아 수정하지 않는다.
- `.bouncer/context/epics/047-context-injection/index.md` — description과 행이 이미 같아 수정하지 않는다.
- `.bouncer/context/epics/*/blueprints/` — 과거 blueprint·task·증적 본문은 보정 근거로 읽기만 한다.

## Constraints
- 사람은 epic frontmatter `description`만 수정하고 색인 행은 그 값에서 재생성한다.
- 강화된 S13과 기존 데이터 보정은 같은 커밋에 둔다. 어느 중간 상태에서도 새 검사가 저장소 자체를 실패시키는 커밋을 만들지 않는다.
- `type`, `resource`, `timestamp`, `bouncer.id`, `epic_id`, status와 기존 epic 본문은 바꾸지 않는다. backfill은 `description`만 수정한다.
- 기존 `024` 중복 id는 경로 문자열 전체로 구분한다. 이번 작업에서 번호를 재할당하거나 둘 중 하나를 supersede하지 않는다.
- `scripts/lib/*.js`는 손으로 편집하지 않고 `npm run build`로만 재생성한다.
- 색인 행 label과 순서는 기존 값을 보존하고 description 부분만 정본에 맞춘다. 경로 누락·초과·legacy prefix에 대한 기존 S13 메시지와 판단은 유지한다.
- Goal과 Interface에서 다루는 모든 파일은 Touch와 최종 `affected_paths`의 닫힌 집합 안에 있어야 한다.
- 새 명령·의존성·파일은 만들지 않는다. 기존 `scaffold epic`, frontmatter parser, `ensureEpicIndexEntry`를 재사용하는 것이 재생성 계약을 충족하는 가장 짧은 표면이다.

## Checklist
- [ ] 재생성·lint 계약의 실패 테스트를 먼저 추가한다.
  ```js
  assert.strictEqual(existingEpicBytesAfter, existingEpicBytesBefore);
  assert.strictEqual(countLinesFor(dirName), 1);
  assert.match(updatedLine, / - 현재 frontmatter 설명$/);
  assert.ok(failures.some((f) => f.code === 'S13' && /summary mismatch/.test(f.message)));
  ```
- [ ] 신규 scaffold의 description 누락·공백·`Epic 061`, 기존 행 mismatch, malformed epic frontmatter, 중복 id `024` 두 경로 fixture를 추가하고 관련 Node test가 구현 전 실패하는지 확인한다.
- [ ] 저장소의 benchmark scaffold caller도 description 계약을 전달하도록 갱신해 `npm run ci`의 contract blast를 닫는다.
- [ ] `formatEpicIndexLine`·`ensureEpicIndexEntry`·S13이 같은 frontmatter description 정본을 읽도록 구현한다. 기존 행은 링크의 `dirName`으로 정확히 한 줄만 찾아 description 부분만 제자리 교체하고, 현재 요약과 같으면 파일을 쓰지 않는다.
- [ ] `scaffold epic` 최초 호출에 `--description`을 연결하고, 기존 canonical epic 재호출은 epic 문서를 덮어쓰지 않은 채 색인 동기화만 수행하도록 바꾼다. 다른 slug의 같은 id 거절은 첫 쓰기 전에 유지한다.
- [ ] plan·spec-authoring·OKF·CLI·게이트·호환성·troubleshooting 문서와 `scripts/src/lib/init.ts`의 초기 번들 색인 안내가 description 정본 → 파생 행 재생성 → S13 lint의 단일 방향만 설명하도록 맞춘다.
- [ ] 다음 12개 description은 현재 실제 색인 행을 그대로 backfill한다. 001·002에 `## Intent`가 없어도 색인 행이라는 명시적 provenance가 있으므로 별도 요약을 창작하지 않는다.
  ```text
  001 002 003 004 005 006 007 008 010 011 012 039
  ```
- [ ] 다음 12개 description은 각 epic의 현재 `## Intent` 목표를 한 문장으로 축약해 저술한다. title·본문·status는 바꾸지 않는다.
  ```text
  016 017 018 019 020 021 022 023 024-light-path 038 040 041
  ```
- [ ] 재생성 경로를 실행해 row-placeholder/description-real 31개, both-real-mismatch 3개, 위 backfill·저술 24개, 이미 일치한 3개와 신규 061을 모두 frontmatter 정본에 수렴시킨다.
  ```text
  existing epic dirs = 61
  existing unique ids = 60
  Epic NNN descriptions = 0
  Epic NNN index summaries = 0
  description/index mismatches = 0
  duplicate index rows per dir = 0
  ```
- [ ] `npm run build`로 네 CommonJS 산출물(`epic-index.js`, `scaffold.js`, `cli-doc-commands.js`, `init.js`)을 갱신하고 contract blast fixture를 모두 맞춘다.
- [ ] 관련 Node test와 사용자가 확정한 단일 verify 명령을 실행한다. 실패가 Touch 밖 fixture를 요구하면 구현을 넓히지 말고 `/bouncer-plan`으로 돌아와 범위를 다시 승인받는다.
- [ ] 게이트 추가 뒤 같은 scaffold 경로에서 플레이스홀더가 재발하는 회귀 테스트가 실패한다면 새 계층을 만들지 않고 description 전달·재생성 호출 시점을 재진단한다.
