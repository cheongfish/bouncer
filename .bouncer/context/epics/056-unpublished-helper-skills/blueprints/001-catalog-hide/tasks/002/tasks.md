---
type: bouncer.tasks
title: 문서와 Distill에 비공개 보조 경로를 반영한다
description: ARCHITECTURE·install·측정 문서와 Distill plugin-skills 샤드가 보조 본문을 references/로 적게 한다.
resource: .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-28T11:43:57.412+09:00'
bouncer:
  id: TASKS-002
  epic_id: '056'
  blueprint_id: '001'
  status: ready
  verify: npm run ci
  commit_intent:
    - 사람용 문서가 옛 skills/보조/SKILL.md 경로를 가리키면 설치·측정이 어긋남
    - 카탈로그와 워크플로 Read 경로를 문서에 고정함
  affected_paths:
    - docs/ARCHITECTURE.md
    - docs/install.md
    - docs/contributing.md
    - docs/benchmark/context-cost.md
    - .bouncer/distill/plugin-skills.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T11:51:01+09:00'
    suggested_paths:
      - test
      - docs
    basis:
      - graph: source
        status: updated
        query: ARCHITECTURE install contributing context-cost plugin-skills Distill generic workflow skills table
        result: '3 nodes; top paths: test/public-name-regression.test.js, test/open-source-readiness.test.js, test/trust-boundary.test.js (docs/ is outside source_dirs)'
      - graph: context
        status: updated
        query: ARCHITECTURE install contributing context-cost plugin-skills Distill generic workflow skills table
        result: '3 nodes; .bouncer/distill/plugin-skills.md and past epic 003 commands-to-skills docs'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
공개 문서와 Distill `plugin-skills` 샤드가 보조 11개를 호스 카탈로그가 아니라 `references/<name>/index.md`로 적는다. §4 일반 스킬 표의 이름 여덟 개는 유지한다. 검증은 `npm run ci`.

## Interface
- 제공: `docs/ARCHITECTURE.md`가 표의 스킬이 `references/<name>/index.md`에 있고 `skills/*/SKILL.md` 목록이 아님을 한 절로 적는다. `docs/install.md`는 관례 스캔을 `skills/*/SKILL.md` 공개 집합으로 한정하고 보조는 `references/`라고 적는다. `docs/benchmark/context-cost.md`의 `wc`/`awk`/`ls`는 카탈로그 8개와 보조 `references/*/index.md`를 분리한다. `docs/contributing.md`의 stop-slop LICENSE 경로를 `references/stop-slop/LICENSE`로 바꾼다. `.bouncer/distill/plugin-skills.md` frontmatter `paths`에 `references/**`를 더하고 Gotcha의 `skills/review/assets/`·서브스킬 `SKILL.md` 경로를 새 위치로 고친다.
- 거부: §4 `APPROVED_GENERIC_SKILLS` 이름 집합 변경. 과거 epic 본문 소급. 보조를 다시 `skills/` 카탈로그 안내로 적기.

## Touch
- Modify `docs/ARCHITECTURE.md` — §4 위치 설명, `explain-diff`·`graphify-runner`·`context-review` 경로
- Modify `docs/install.md` — 호스 스캔 범위와 보조 `references/`
- Modify `docs/contributing.md` — stop-slop LICENSE 경로
- Modify `docs/benchmark/context-cost.md` — 측정 명령을 카탈로그와 보조로 분리
- Modify `.bouncer/distill/plugin-skills.md` — reviewer-prompt·서브스킬 경로 Gotcha

## Do not touch
- `test/public-name-regression.test.js` — §4 표 이름 여덟 개는 유지. 본문만 위치가 바뀜
- `docs/compatibility.md` — 공개 계약은 `skills/bouncer-*` 여섯 이름. 보조는 이미 계약 아님
- `skills/` — task 001이 카탈로그를 닫음
- `references/` — task 001이 본문을 둠
- `.bouncer/context/epics/` — 소급 금지

## Constraints
- Distill 본문은 영어를 유지한다.
- 측정 문서에 배수나 새 회차 숫자를 넣지 않는다. 명령만 고친다.
- `test/public-name-regression.test.js`가 기대하는 §4 백틱 이름 순서를 깨지 않는다.

## Checklist
- [ ] `docs/ARCHITECTURE.md`에 `references/<name>/index.md`와 카탈로그 제외를 명시한 뒤 `node --test test/public-name-regression.test.js`가 통과하는지 확인한다. 표 이름이 바뀌면 실패가 맞다.
- [ ] `docs/install.md`·`docs/contributing.md`·`docs/benchmark/context-cost.md`에서 `skills/discovery/SKILL.md` 형태의 안내가 0건인지 검색한다.
- [ ] `.bouncer/distill/plugin-skills.md` YAML `paths`에 `references/**`를 넣고, `skills/review/assets/`와 서브스킬 `SKILL.md` 경로를 `references/`로 고친다.
- [ ] `npm run ci`가 통과한다.
