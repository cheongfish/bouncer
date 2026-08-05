---
type: bouncer.tasks
title: migrate ids CLI·스킬·SessionStart 구형 경고를 넣음
description: 구형 context를 숫자 id로 옮기는 명령과 세션 시작 안내
resource: .bouncer/context/epics/EPIC-014-numeric-context-ids/blueprints/BP-002-migrate-ids-cli/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-05T16:54:53.780+09:00'
bouncer:
  id: TASKS-BP-002
  epic_id: EPIC-014
  blueprint_id: BP-002
  status: verified
  affected_paths:
    - scripts/src/lib/migrate-ids.ts
    - scripts/lib/migrate-ids.js
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - skills/migrate-ids/SKILL.md
    - hooks/session-legacy-ids.js
    - hooks/hooks.json
    - test/migrate-ids.test.js
    - test/legacy-ids-warn.test.js
    - test/plugin-wiring.test.js
    - docs/cli.md
    - docs/troubleshooting.md
    - docs/context-versioning.md
  graph:
    generated_at: '2026-08-05T18:08:10+09:00'
    command: graphify query (source + context graphs)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - hooks
      - test
      - skills/migrate-ids
      - docs
    basis: >-
      graph-sync rebuilt both source and context graphs (built: source,
      context; failed: none). Source query "cli subcommand parsePathIds
      normalizeContextId scaffold validate paths layout epic-index migrate
      rename" returned scripts/src/lib + scripts/lib (cli, paths, layout,
      scaffold, validate, current); a second query on "SessionStart hook skill
      legacy warning" returned hooks/hooks.json and test/session-graph.test.js.
      Context query returned the EPIC-014 epic index. skills/migrate-ids and
      docs were added by hand because config.source_dirs is scripts/hooks/test
      and never returns skill or doc paths.
---
# Tasks

Blueprint: [BP-002](index.md)

## Goal & intent
구형 `EPIC-`/`BP-` context를 `bouncer migrate ids`로 숫자 명명에 맞춘다. dry-run으로
계획을 보고, apply는 frontmatter·`resource`·본문·index·포인터까지 바꾼다. 에이전트는
`migrate-ids` 스킬로 같은 절차를 따른다. SessionStart는 구형 디렉터리가 있으면
스킬/CLI를 안내하고 세션을 막지 않는다. 검증은 `npm test`.

## Interface
- 제공: `bouncer migrate ids [--dry-run]` — plan/apply JSON 또는 사람이 읽을 목록.
- 제공: 본문 포함 `EPIC-\d+`/`BP-\d+`/`TASKS-BP-` 등 구형 토큰 rewrite.
- 제공: `skills/migrate-ids/SKILL.md` — dry-run → 사용자 확인 → apply.
- 제공: SessionStart 경로에서 구형 epic/bp dir 탐지 → stderr 안내, `exit 0`.
  탐지는 `migrate-ids`의 discover를 재사용한다 — layout/`parsePathIds`의 전이
  허용에 기대지 않는다(BP-003이 그걸 제거해도 훅이 살아 있어야 한다).
- 거부: 혼재 트리·충돌·dirty(기본)에서 apply. 훅이 migrate를 자동 실행하거나
  스킬 파일을 디스크에 생성하지 않음.

## Touch
- Create `scripts/src/lib/migrate-ids.ts` — discover/plan/validate/apply.
- Create `scripts/lib/migrate-ids.js` — build 산출.
- Modify `scripts/src/lib/cli.ts` — `migrate ids` 서브커맨드·help.
- Modify `scripts/lib/cli.js` — build 산출.
- Create `skills/migrate-ids/SKILL.md` — 절차·가드레일.
- Create `hooks/session-legacy-ids.js` — SessionStart 훅. `migrate-ids`의
  `discoverLegacyIds`·`legacyIdsWarnings`를 불러 stderr에 쓰고 `exit 0`.
- Modify `hooks/hooks.json` — SessionStart 배열에 훅 추가.
- Create `test/migrate-ids.test.js` — dry-run/apply/거절 fixture.
- Create `test/legacy-ids-warn.test.js` — 탐지·경고 문자열·exit 0.
- Modify `test/plugin-wiring.test.js` — SessionStart 항목 2개 등록 확인.
- Modify `docs/cli.md` — 명령 표에 `bouncer migrate ids` 행 추가.
- Modify `docs/troubleshooting.md` — 구형 명명 경고를 봤을 때의 조치.
- Modify `docs/context-versioning.md` — 구형 명명 업그레이드 경로 한 문단.

## Do not touch
- `scripts/src/lib/paths.ts` 정본 계약 — BP-001. migrate는 그 파생 API를 소비.
- `.bouncer/context/epics/**` 실트리 일괄 rename — BP-003이 CLI로 수행.
- `.bouncer/Distill.md` — BP-003.
- `scripts/src/lib/validate.ts` S4/S5 공식 — BP-001.
- `CHANGELOG.md` — 에픽 전체를 BP-003이 한 항목으로 쓴다.

## Constraints
- apply는 부분 성공 상태를 남기지 않는다(계획 검증 후 일괄, 실패 시 중단).
- SessionStart는 항상 `exit 0`, 예외를 삼켜 세션을 막지 않는다(기존 graph 훅과 동일).
- Cursor는 SessionStart 상당 이벤트가 없다(`cursor-hooks.json`은
  `beforeShellExecution`뿐). Cursor 배선은 하지 않고, Cursor 사용자는 CLI·스킬로만
  안내받는다. 매 프롬프트마다 도는 이벤트에 얹지 않는다.
- 경고를 `session-graph.js`에 합치지 않는다. 그 훅은 `config.graphify.enabled`에
  묶여 있고 예외를 통째로 삼켜서, 그래프 빌드가 실패하면 이관 안내까지 사라진다.
- 새 generic skill이면 `docs/ARCHITECTURE.md` 표와
  `test/public-name-regression.test.js` `APPROVED_GENERIC_SKILLS`를 함께 갱신한다.
- `scripts/lib` 손편집 금지.

## Checklist
- [ ] 임시 레포 fixture로 dry-run 목록·apply 후 S5 샘플·거절(충돌/혼재) 테스트를
  실패 → 구현 순으로 넣는다.
- [ ] 본문에 `EPIC-001`/`BP-002` 문자열이 apply 후 숫자로 바뀌는지 단언한다.
- [ ] 포인터 rewrite 테스트를 넣는다.
- [ ] SessionStart 훅이 구형 dir에서 안내 문구를 내고 exit 0인지, 구형이 없으면
  아무것도 쓰지 않는지 확인한다.
- [ ] `hooks.json` SessionStart에 graph 훅과 legacy 훅이 **둘 다** 남아 있는지
  `plugin-wiring` 테스트로 고정한다.
- [ ] `skills/migrate-ids`가 dry-run 확인 없이 apply하지 않는다고 명시한다.
- [ ] `npm test` 통과.
