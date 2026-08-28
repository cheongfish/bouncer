---
type: bouncer.tasks
title: 보조 스킬을 references/로 옮기고 카탈로그 테스트를 맞춘다
description: 11개 보조 트리를 플러그인 루트 references/로 옮기고 진입 스킬·CLAUDE.md·계약 테스트가 그 경로만 읽게 한다.
resource: .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-28T11:43:50.455+09:00'
bouncer:
  id: TASKS-001
  epic_id: '056'
  blueprint_id: '001'
  status: verified
  verify: npm run ci
  commit_intent:
    - 보조 스킬이 호스 목록에 남아 암묵 매칭되는 문제를 끊음
    - 본문은 references/에서 워크플로가 경로로만 읽게 함
  affected_paths:
    - skills/discovery/SKILL.md
    - references/discovery/index.md
    - skills/spec-authoring/SKILL.md
    - references/spec-authoring/index.md
    - skills/spec-authoring/references/epic.md
    - references/spec-authoring/epic.md
    - skills/spec-authoring/references/blueprint.md
    - references/spec-authoring/blueprint.md
    - skills/spec-authoring/references/tasks.md
    - references/spec-authoring/tasks.md
    - skills/spec-authoring/references/review.md
    - references/spec-authoring/review.md
    - skills/stop-slop/SKILL.md
    - references/stop-slop/index.md
    - skills/stop-slop/references/phrases.md
    - references/stop-slop/phrases.md
    - skills/stop-slop/references/structures.md
    - references/stop-slop/structures.md
    - skills/stop-slop/references/examples.md
    - references/stop-slop/examples.md
    - skills/stop-slop/LICENSE
    - references/stop-slop/LICENSE
    - skills/graphify-runner/SKILL.md
    - references/graphify-runner/index.md
    - skills/minimality/SKILL.md
    - references/minimality/index.md
    - skills/context-review/SKILL.md
    - references/context-review/index.md
    - skills/implementation/SKILL.md
    - references/implementation/index.md
    - skills/verification/SKILL.md
    - references/verification/index.md
    - skills/debugging/SKILL.md
    - references/debugging/index.md
    - skills/review/SKILL.md
    - references/review/index.md
    - skills/review/assets/reviewer-prompt.md
    - references/review/assets/reviewer-prompt.md
    - skills/explain-diff/SKILL.md
    - references/explain-diff/index.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-plan/references/context-review.md
    - skills/bouncer-plan/references/graphify-suggestions.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-finalize/references/explain-quiz.md
    - skills/bouncer-finalize/references/distill-promotion.md
    - CLAUDE.md
    - rules/skill-shape.md
    - rules/governance.md
    - agents/bouncer-implementer.md
    - agents/bouncer-reviewer.md
    - agents/bouncer-context-reviewer.md
    - test/helpers/read-skill.js
    - test/skill-bouncer-surface.test.js
    - test/skill-discovery.test.js
    - test/skill-spec-authoring.test.js
    - test/skill-implementation.test.js
    - test/skill-verification.test.js
    - test/skill-review.test.js
    - test/skill-minimality.test.js
    - test/skill-debugging.test.js
    - test/skill-graphify-runner.test.js
    - test/skill-explain-diff.test.js
    - test/skill-stop-slop.test.js
    - test/skill-context-review.test.js
    - test/master-rules.test.js
    - test/lightweight-cycle.test.js
    - test/trust-boundary.test.js
    - test/agents.test.js
    - test/open-source-readiness.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-finalize.test.js
    - test/cursor-plugin.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T11:51:01+09:00'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: updated
        query: unpublished helper skills catalog hide references index.md CLAUDE When to invoke skill-bouncer-surface readSkill stop-slop LICENSE
        result: '3 nodes; top paths: test/plugin-root.test.js, test/open-source-readiness.test.js, test/master-rules.test.js (skills/ is outside source_dirs)'
      - graph: context
        status: updated
        query: unpublished helper skills catalog hide references index.md CLAUDE When to invoke skill-bouncer-surface readSkill stop-slop LICENSE
        result: '3 nodes; this blueprint index.md and tasks/001–002 tasks.md'
---
# Tasks

Blueprint: [001](../../index.md)

```mermaid
flowchart LR
  W["bouncer-plan/execute/finalize"] --> R["references/name/index.md"]
```

## Goal & intent
11개 보조 스킬 트리를 `skills/<name>/`에서 플러그인 루트 `references/<name>/`로 옮기고, 호스가 스캔하는 `skills/*/SKILL.md`에는 공개 8개만 남긴다. 진입 스킬과 `CLAUDE.md`는 `references/<name>/index.md`를 읽는다. 검증은 `npm run ci`.

## Interface
- 제공: `references/<name>/index.md`가 옛 `SKILL.md` 본문이다. 하위 자료는 같은 디렉터리에 파일명을 유지한다 (`epic.md`, `phrases.md`, `assets/reviewer-prompt.md`, `LICENSE`). `test/helpers/read-skill.js`의 `readSkill`은 보조 이름을 이 경로에서 읽는다. `listCanonicalSkillNames`는 `skills/`의 `SKILL.md`만 세고 `EXPECTED_SKILL_COUNT`는 8이다. description 예산은 그 8개에만 적용한다. 역할 rubric 금지어 검사는 `references/{implementation,review,debugging,context-review}/index.md`를 읽는다.
- 거부: `references/` 아래 `SKILL.md` 파일명. 보조 본문을 `skills/bouncer-*/references/`에 복제. `migrate-ids`와 `agentic-code-benchmark` 이동. 비공개 11개 `index.md`에 `when the user asks for this skill by name`을 남기기. `migrate-ids`를 `UNPUBLISHED`나 references 이동 목록에 넣기. 절차 문장 재작성.

## Touch
- Rename `skills/discovery/SKILL.md` → `references/discovery/index.md` — 카탈로그에서 제거
- Rename `skills/spec-authoring/SKILL.md` → `references/spec-authoring/index.md` — 카탈로그에서 제거
- Rename `skills/spec-authoring/references/epic.md` → `references/spec-authoring/epic.md` — 하위 자료 동반
- Rename `skills/spec-authoring/references/blueprint.md` → `references/spec-authoring/blueprint.md` — 하위 자료 동반
- Rename `skills/spec-authoring/references/tasks.md` → `references/spec-authoring/tasks.md` — 하위 자료 동반
- Rename `skills/spec-authoring/references/review.md` → `references/spec-authoring/review.md` — 하위 자료 동반
- Rename `skills/stop-slop/SKILL.md` → `references/stop-slop/index.md` — 카탈로그에서 제거
- Rename `skills/stop-slop/references/phrases.md` → `references/stop-slop/phrases.md` — 하위 자료 동반
- Rename `skills/stop-slop/references/structures.md` → `references/stop-slop/structures.md` — 하위 자료 동반
- Rename `skills/stop-slop/references/examples.md` → `references/stop-slop/examples.md` — 하위 자료 동반
- Rename `skills/stop-slop/LICENSE` → `references/stop-slop/LICENSE` — 제3자 고지 동반
- Rename `skills/graphify-runner/SKILL.md` → `references/graphify-runner/index.md` — 카탈로그에서 제거
- Rename `skills/minimality/SKILL.md` → `references/minimality/index.md` — 카탈로그에서 제거
- Rename `skills/context-review/SKILL.md` → `references/context-review/index.md` — 카탈로그에서 제거
- Rename `skills/implementation/SKILL.md` → `references/implementation/index.md` — 카탈로그에서 제거
- Rename `skills/verification/SKILL.md` → `references/verification/index.md` — 카탈로그에서 제거
- Rename `skills/debugging/SKILL.md` → `references/debugging/index.md` — 카탈로그에서 제거
- Rename `skills/review/SKILL.md` → `references/review/index.md` — 카탈로그에서 제거
- Rename `skills/review/assets/reviewer-prompt.md` → `references/review/assets/reviewer-prompt.md` — 콜 브리프 동반
- Rename `skills/explain-diff/SKILL.md` → `references/explain-diff/index.md` — 카탈로그에서 제거
- Modify `references/spec-authoring/index.md` — `references/epic.md` 등 상대 링크를 같은 디렉터리 파일명으로 고친다
- Modify `references/stop-slop/index.md` — `references/phrases.md` 링크를 같은 디렉터리 파일명으로 고친다
- Modify `skills/bouncer-plan/SKILL.md` — 보조 호출 경로를 `references/<name>/index.md`로 바꾼다
- Modify `skills/bouncer-plan/references/context-review.md` — context-review 경로
- Modify `skills/bouncer-plan/references/graphify-suggestions.md` — graphify-runner 경로
- Modify `skills/bouncer-execute/SKILL.md` — implementation·verification·review·debugging·minimality 경로
- Modify `skills/bouncer-finalize/SKILL.md` — spec-authoring·explain-diff 경로
- Modify `skills/bouncer-finalize/references/explain-quiz.md` — explain-diff 경로
- Modify `skills/bouncer-finalize/references/distill-promotion.md` — spec-authoring 경로
- Modify `CLAUDE.md` — When to invoke에서 보조 이름 행을 빼고 주석 정본 링크를 `references/implementation/index.md`로 바꾼다
- Modify `rules/skill-shape.md` — 서브스킬 정본 경로를 `references/<name>/index.md`로 적고 카탈로그와 구분한다
- Modify `rules/governance.md` — `skills/explain-diff/SKILL.md` 인용을 `references/explain-diff/index.md`로 바꾼다
- Modify `agents/bouncer-implementer.md` — 주석 정본 경로
- Modify `agents/bouncer-reviewer.md` — reviewer-prompt 경로
- Modify `agents/bouncer-context-reviewer.md` — 호출 계약 경로
- Modify `test/helpers/read-skill.js` — 보조는 `references/<name>/index.md`, 공개는 기존 `skills/`
- Modify `test/skill-bouncer-surface.test.js` — 정본 8개. 비공개 11개는 `references/<name>/index.md`로 읽고, `migrate-ids`만 `skills/migrate-ids/SKILL.md`에 남긴다. `SUB_PATHS`를 통째로 references로 옮기지 않는다.
- Modify `test/skill-discovery.test.js` — readSkill 경로 계약
- Modify `test/skill-spec-authoring.test.js` — 하위 파일 위치 단언
- Modify `test/skill-implementation.test.js` — readSkill 경로 계약
- Modify `test/skill-verification.test.js` — readSkill 경로 계약
- Modify `test/skill-review.test.js` — 스킬·assets 경로
- Modify `test/skill-minimality.test.js` — readSkill 경로 계약
- Modify `test/skill-debugging.test.js` — readSkill 경로 계약
- Modify `test/skill-graphify-runner.test.js` — readSkill 경로 계약
- Modify `test/skill-explain-diff.test.js` — 경로 계약
- Modify `test/skill-stop-slop.test.js` — 경로 계약
- Modify `test/skill-context-review.test.js` — 경로 계약
- Modify `test/master-rules.test.js` — discovery·spec-authoring·CLAUDE When to invoke
- Modify `test/lightweight-cycle.test.js` — spec-authoring 경로
- Modify `test/trust-boundary.test.js` — implementation 경로
- Modify `test/agents.test.js` — 스킬 경로
- Modify `test/open-source-readiness.test.js` — stop-slop LICENSE 경로 (해시 값은 바이트 그대로)
- Modify `test/skill-bouncer-plan.test.js` — 보조 경로 문자열이 있으면 갱신
- Modify `test/skill-bouncer-execute.test.js` — 보조 경로 문자열이 있으면 갱신
- Modify `test/skill-bouncer-finalize.test.js` — spec-authoring·explain-diff 경로
- Modify `test/cursor-plugin.test.js` — `LAUNCHER_SKILLS` 중 이동한 `explain-diff`·`graphify-runner`·`review`는 `references/<name>/index.md`를 읽고, `migrate-ids`와 워크플로 스킬은 `skills/<name>/SKILL.md`를 유지한다

## Do not touch
- `skills/bouncer-init/SKILL.md` — 보조를 부르지 않음
- `skills/bouncer-commit/SKILL.md` — 보조를 부르지 않음
- `skills/bouncer-run/SKILL.md` — 실행 루프만, 보조 본문 호출 없음
- `skills/agentic-code-benchmark/SKILL.md` — 공개 유지
- `skills/migrate-ids/SKILL.md` — 공개 유지
- `scripts/` — 런타임이 스킬 트리를 스캔하지 않음
- `.bouncer/context/epics/` — 과거 계획 소급 금지 (056 문서는 이 task의 작성 대상이 아님)

## Constraints
- 본문 절차·게이트 문장은 옮기기만 한다. 상대 링크와 경로 문자열만 새 트리에 맞춘다.
- `git mv`로 이력을 유지한다.
- 빈 `skills/<name>/` 디렉터리를 남기지 않는다.
- `references/` 아래 `SKILL.md`를 만들지 않는다.
- description 예산 상한 3,000·개별 100–180은 카탈로그 8개에만 적용한다. 보조 `index.md` description을 이 예산에 넣지 않는다.
- `docs/ARCHITECTURE.md` §4 표 이름 집합은 task 002가 위치를 설명한다. 이 task에서 표를 지우지 않는다.

## Checklist
- [ ] `test/skill-bouncer-surface.test.js`의 `EXPECTED_SKILL_COUNT`를 8로 바꾸고, `listCanonicalSkillNames`가 11개 보조 이름을 포함하면 실패하게 둔다.
  ```js
  const EXPECTED_SKILL_COUNT = 8;
  const UNPUBLISHED = [
    'discovery', 'spec-authoring', 'stop-slop', 'graphify-runner', 'minimality',
    'context-review', 'implementation', 'verification', 'debugging', 'review',
    'explain-diff',
  ];
  for (const name of UNPUBLISHED) {
    assert.equal(skillNames.includes(name), false);
    assert.equal(fs.existsSync(path.join(root, 'references', name, 'SKILL.md')), false);
    assert.ok(fs.existsSync(path.join(root, 'references', name, 'index.md')));
  }
  ```
- [ ] `node --test test/skill-bouncer-surface.test.js`로 이동 전 실패를 확인한다.
- [ ] `git mv`로 Touch의 Rename을 적용하고 진입 스킬·에이전트·`CLAUDE.md`·`rules/skill-shape.md` 경로를 고친다.
- [ ] `readSkill`이 보조는 `references/<name>/index.md`를 읽게 하고 나머지 계약 테스트를 맞춘다.
- [ ] `CLAUDE.md` When to invoke에서 보조 11개 행이 없는지, 비공개 11개 `index.md`에 `when the user asks for this skill by name`이 0건인지 `test/master-rules.test.js`로 단언한다. `skills/migrate-ids/SKILL.md`는 그 단언에서 제외한다.
- [ ] `npm run ci`가 통과한다.
