---
type: bouncer.tasks
title: 나머지 스킬 11개 구조 정렬
description: Tasks for 002
resource: .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T09:53:14.670+09:00'
bouncer:
  id: TASKS-002
  epic_id: '029'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 스킬마다 설명 어조가 제각각이고 리뷰어 호출 템플릿이 스킬 최상위에 놓여 있음
    - 설명을 3인칭으로 통일하고 템플릿을 정해진 하위 위치로 옮겨 배치를 맞춤
  affected_paths:
    - skills/discovery/SKILL.md
    - skills/spec-authoring/SKILL.md
    - skills/implementation/SKILL.md
    - skills/verification/SKILL.md
    - skills/minimality/SKILL.md
    - skills/debugging/SKILL.md
    - skills/stop-slop/SKILL.md
    - skills/explain-diff/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/migrate-ids/SKILL.md
    - skills/review/SKILL.md
    - skills/review/reviewer-prompt.md
    - skills/review/assets/reviewer-prompt.md
    - skills/bouncer-execute/SKILL.md
    - agents/bouncer-reviewer.md
    - test/skill-review.test.js
    - test/skill-bouncer-execute.test.js
  graph:
    generated_at: '2026-08-12T09:53:14.670+09:00'
    command: mcp:graphify
    suggested_paths:
      - skills/review/SKILL.md
      - skills/review/reviewer-prompt.md
      - skills/bouncer-execute/SKILL.md
      - agents/bouncer-reviewer.md
      - test/skill-review.test.js
      - test/skill-bouncer-execute.test.js
    basis:
      - graph: source
        status: reused
        query: reviewer prompt dispatch skill anatomy assets
        result: >-
          graph-sync reported skip-fresh but the returned nodes name deleted
          paths (skills/sdd-minimality, skills/okf-authoring); results
          discarded and paths seeded manually from the reviewer commit unit
          recorded in .bouncer/Distill.md
      - graph: context
        status: updated
        query: 리뷰어 프롬프트 커밋 단위 스킬 구조
        result: >-
          rebuilt this run, but the query returned the same stale node set as
          the source graph; no usable context hits
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
워크플로 밖 스킬 11개를 skill anatomy에 맞춘다. 두 가지다.

1. `description`을 3인칭 서술로 통일한다. 지금은 스킬마다 어조가 다르다.
2. `skills/review/reviewer-prompt.md`를 스킬 루트에서 `assets/` 아래로 옮긴다.
   anatomy에서 스킬 루트에는 `SKILL.md`만 두고, 채워 넣어 출력으로 쓰는 템플릿은
   `assets/`에 둔다. `skills/stop-slop/references/`가 이미 같은 형태의 선례다.

11개 스킬은 모두 100줄 안팎이라 `SKILL.md` 분량 문제는 없다 — 분할은 하지 않는다.

## Interface
- 제공: 11개 스킬의 `SKILL.md`(3인칭 `description`)와
  `skills/review/assets/reviewer-prompt.md`.
- 거부: 스킬 `name`, 절차 단계의 순서·내용, 루브릭 문구는 바꾸지 않는다.
  `description`의 발동 조건(어떤 상황에서 이 스킬이 쓰이는가)은 어조만 바꾸고
  의미는 그대로 둔다.

## Touch
- Modify `skills/discovery/SKILL.md` — description 3인칭화
- Modify `skills/spec-authoring/SKILL.md` — description 3인칭화
- Modify `skills/implementation/SKILL.md` — description 3인칭화
- Modify `skills/verification/SKILL.md` — description 3인칭화
- Modify `skills/minimality/SKILL.md` — description 3인칭화
- Modify `skills/debugging/SKILL.md` — description 3인칭화
- Modify `skills/stop-slop/SKILL.md` — description 3인칭화
- Modify `skills/explain-diff/SKILL.md` — description 3인칭화 (`/bouncer-commit` 언급 유지)
- Modify `skills/graphify-runner/SKILL.md` — description 3인칭화
- Modify `skills/migrate-ids/SKILL.md` — description 3인칭화
- Modify `skills/review/SKILL.md` — description 3인칭화, `reviewer-prompt.md` 링크 2곳 경로 갱신
- Rename `skills/review/reviewer-prompt.md` → `skills/review/assets/reviewer-prompt.md` — anatomy상 템플릿 위치
- Modify `skills/bouncer-execute/SKILL.md` — 5단계의 `reviewer-prompt.md` 경로 2곳 갱신
- Modify `agents/bouncer-reviewer.md` — 경로를 언급한다면 갱신 (Distill: 리뷰어 문서는 한 커밋 단위)
- Modify `test/skill-review.test.js` — `reviewer-prompt.md` 읽기 경로 갱신
- Modify `test/skill-bouncer-execute.test.js` — 경로 단정 갱신

## Do not touch
- `skills/bouncer-init/SKILL.md`, `skills/bouncer-plan/SKILL.md`,
  `skills/bouncer-commit/SKILL.md`, `skills/bouncer-finalize/SKILL.md` —
  TASKS-001이 맡는다. `bouncer-execute`만 경로 갱신 때문에 예외로 열려 있다.
- `CLAUDE.md` — TASKS-003이 맡는다.
- `skills/stop-slop/references/`, `skills/stop-slop/LICENSE` — 이미 anatomy를
  따르고 있으므로 건드릴 이유가 없다.
- `scripts/`, `.bouncer/context/` — 이 blueprint는 문서 배치만 바꾼다.

## Constraints
- 리뷰어 루브릭 문구 자체는 바꾸지 않는다. Distill은 루브릭 · `reviewer-prompt.md` ·
  `agents/bouncer-reviewer.md` · execute 디스패치를 한 커밋 단위로 묶는데,
  이 task에서 함께 움직이는 것은 **경로뿐**이고 판정 내용은 아니다.
- `skills/explain-diff/SKILL.md`의 `description`은 `/bouncer-commit` 문자열을
  유지한다 (`test/skill-explain-diff.test.js:16`).
- 스킬 YAML `description`에 따옴표 없는 `##`를 넣지 않는다.
- 파일 이동은 `git mv`로 해서 이력이 rename으로 남게 한다.
- `skills/` 아래에 `SKILL.md` 없는 디렉터리가 새로 생기지만, `assets/`는
  `stop-slop/references/`와 같은 하위 디렉터리 형태이므로 스킬 탐색 대상이
  아니다. 스킬과 같은 계층에 새 디렉터리를 만들지는 않는다.

## Checklist
- [ ] `npm test`로 기준선이 green인지 확인한다.
- [ ] 11개 스킬의 `description`을 3인칭으로 고친다. 발동 조건 문구의 의미는 유지한다.
- [ ] `git mv skills/review/reviewer-prompt.md skills/review/assets/reviewer-prompt.md`
- [ ] `skills/review/SKILL.md`의 링크 2곳(11행, 28행 부근)을 새 경로로 고친다.
- [ ] `skills/bouncer-execute/SKILL.md`의 경로 2곳(187행, 189행 부근)을 고친다.
- [ ] `agents/bouncer-reviewer.md`에 경로 언급이 있으면 함께 고친다. 없으면 건너뛴다.
- [ ] `test/skill-review.test.js:11`의 읽기 경로와
      `test/skill-bouncer-execute.test.js:70`의 경로 단정을 갱신한다.
- [ ] 저장소 전체에서 옛 경로가 남지 않았는지 확인한다:
      ```
      grep -rn "review/reviewer-prompt.md" --include=*.md --include=*.js . | grep -v node_modules | grep -v .bouncer/context
      ```
      `CHANGELOG.md`와 과거 컨텍스트 문서의 언급은 이력이므로 고치지 않는다.
- [ ] `npm test` 통과를 확인한다.
