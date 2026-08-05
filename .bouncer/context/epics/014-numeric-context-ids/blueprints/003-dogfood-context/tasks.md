---
type: bouncer.tasks
title: 플러그인 context를 숫자 id로 옮기고 레거시 경로 허용을 제거함
description: migrate dogfood, 하드 컷, Distill·잔여 하드코딩
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-05T16:54:53.820+09:00'
bouncer:
  id: TASKS-003
  epic_id: '014'
  blueprint_id: '003'
  status: verified
  affected_paths:
    - .bouncer/context
    - .bouncer/Distill.md
    - scripts/src/lib/paths.ts
    - scripts/src/lib/layout.ts
    - scripts/src/lib/epic-index.ts
    - scripts/src/lib/validate.ts
    - scripts/src/lib/scaffold.ts
    - scripts/lib/paths.js
    - scripts/lib/layout.js
    - scripts/lib/epic-index.js
    - scripts/lib/validate.js
    - scripts/lib/scaffold.js
    - test
    - docs/PILOT.md
    - docs/context-versioning.md
    - skills/bouncer-plan/SKILL.md
    - README.md
    - CHANGELOG.md
  graph:
    generated_at: '2026-08-06T08:29:16+09:00'
    command: graphify query (graphify-out/source + graphify-out/context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - .bouncer/context
      - docs
    basis: 'graph-sync skip-fresh (source, context 모두 최신; built/failed 없음). 질의 "EPIC_DIR BLUEPRINT_DIR regex parsePathIds canonicalBlueprintPaths epicIndex directory prefix"가 paths/layout/epic-index/validate를 TS 원본과 CJS 산출 양쪽에서 집었고, "numeric context id migration dogfood: remove legacy EPIC- BP- prefix allowance" 질의가 test/paths·validate-structural 계열을 집었다. context 그래프는 Distill·에픽 문서를 집어 dogfood 대상 트리를 확인시켜 준다. docs는 그래프 밖(문서 전용)이라 수동으로 더했다.'
---
# Tasks

Blueprint: [003](index.md)

## Goal & intent
이 레포에서 `migrate-ids` 스킬(또는 `bouncer migrate ids`)을 실행해
`.bouncer/context/`를 숫자 명명으로 맞춘다. 그다음 layout/`parsePathIds`의 구형 접두
허용과 001이 넣은 S5 구형 접두 정규화를 제거하고 Distill·남은 문서 하드코딩을
고친다. 순서는 migrate 먼저, 허용 제거 나중이다. 검증은 `npm test`.

## Interface
- 제공: 적용 후 epic/bp 디렉터리·메타·index가 신형. SessionStart 구형 경고 없음.
- 제공: 구형 접두 경로만 있으면 canonical/S13 실패.
- 제공: 구형 접두 frontmatter(`014`/`TASKS-001`)는 S5 실패.
- 거부: migrate 없이 손수 일부만 rename. 외부 소비자 레포 대리 적용.

## Touch
- Modify `.bouncer/context` — `bouncer migrate ids` 적용 결과(rename·rewrite).
  38개 rename(epic 14 + blueprint 24)과 그 아래 문서 frontmatter·`resource`·본문
  링크·번들 index가 함께 바뀐다. `affected_paths`는 이 디렉터리 한 항목으로
  잡는다 — 130개 남짓한 파일을 나열해도 G11 판정이 달라지지 않는다.
- Modify `scripts/src/lib/paths.ts` — `EPIC_SEG_RE`/`BP_SEG_RE`의 optional 접두 제거.
  `normalizeContextId` 함수 자체는 migrate가 쓰므로 남긴다.
- Modify `scripts/src/lib/layout.ts` — 구형 canonical 대안 제거.
- Modify `scripts/src/lib/epic-index.ts` — 구형 dir 정규식 제거.
- Modify `scripts/src/lib/validate.ts` — S4/S5가 `normalizeContextId`를 거치지 않고
  정본 형태만 보게 한다.
- Modify `scripts/src/lib/scaffold.ts` — `epicIdFromDir`의 `(?:EPIC-)?`를 없앤다.
  구형 디렉터리에서 scaffold하는 경로는 migrate 이후 존재하지 않는다.
- Modify `scripts/lib/paths.js` — build 산출.
- Modify `scripts/lib/layout.js` — build 산출.
- Modify `scripts/lib/epic-index.js` — build 산출.
- Modify `scripts/lib/validate.js` — build 산출.
- Modify `scripts/lib/scaffold.js` — build 산출.
- Modify `test` — 구형 id fixture가 17개 파일에 흩어져 있다. 디렉터리 경로 형태
  (`epics/EPIC-…`, `blueprints/BP-…`)와 frontmatter 값(`014`,
  `TASKS-001`) 양쪽을 신형으로 바꾸고, 001이 넣은 구형 통과 단언은 실패
  단언으로 뒤집는다. `test/migrate-ids.test.js`는 예외 — 구형 트리를 만들어야
  하는 테스트이므로 fixture를 그대로 두고 기대값만 맞춘다.
- Modify `.bouncer/Distill.md` — worktree `<BP-id>` 문구를 숫자 id로.
- Modify `docs/PILOT.md` — 남은 `EPIC-` 서술이 있으면 정리.
- Modify `docs/context-versioning.md` — 구형 경로 예시를 신형으로.
- Modify `skills/bouncer-plan/SKILL.md` — 2단계 id 예시(`002` after
  `001`)를 숫자 정본으로.
- Modify `README.md` — 경로 예시가 구형이면 신형으로.
- Modify `CHANGELOG.md` — `[Unreleased]`에 014 한 항목. 001~003을 묶어
  Changed(숫자 id 정본)·Added(`bouncer migrate ids`)·Removed(구형 명명 허용)로 쓰고,
  소비자 업그레이드 절차(`bouncer migrate ids --dry-run` → apply)를 포함한다.
  구형 명명 레포는 이 릴리스에서 migrate 전까지 validate가 거절된다고 명시한다.

## Do not touch
- `scripts/src/lib/migrate-ids.ts` 알고리즘 — 002.
- `skills/migrate-ids/SKILL.md` — 전혀 만지지 않는다. 문구 수정이 필요하면 002로
  되돌린다(Touch와 겹치면 G12).
- `config.verify` / 게이트 G 번호 재배치.

## Constraints
- **자기 자신을 옮긴다.** migrate 대상에 이 BP의 문서가 포함되어, 실행 도중
  `epics/014-numeric-context-ids/blueprints/003-dogfood-context/`가
  `epics/014-numeric-context-ids/blueprints/003-dogfood-context/`가 된다. 적용 이후의
  모든 `bouncer validate --blueprint …` 인자와 문서 편집은 **새 경로**를 쓴다.
  구 경로로 게이트를 돌리면 문서 없음으로 실패한다.
- rename은 `git mv` 상당으로 스테이지해 이 커밋에 포함한다. 구 경로 삭제와 신 경로
  추가가 갈라지면 리뷰가 rename을 못 읽는다.
- `bouncer/current` 포인터는 git common dir에 있어 커밋 대상이 아니다. migrate가
  rewrite하며, 적용 후 `bouncer current`가 새 경로를 내는지만 확인한다.
- worktree 디렉터리·브랜치 이름은 rename하지 않는다. 이미 만들어진 이름이 구형 id를
  담고 있어도 그대로 두고 finalize까지 간다(에픽 Out of scope).
- dogfood는 002 CLI를 호출해 수행한다. 동일 rewrite를 에디터로 복제하지 않는다.
- 레거시 허용 제거 후 구형 fixture 테스트가 남아 있으면 함께 삭제·전환한다.
- Project Distill은 영어.
- `affected_paths` 확정 전에 `migrate ids --dry-run` 목록을 사용자와 확인한다.
- `.bouncer/context`와 `test`는 파일이 아니라 디렉터리 한 항목으로 잡는다. 이
  BP는 두 트리 전체가 대상이고, Do not touch에 그 아래 경로가 없어 G12 충돌이
  없다.

## Checklist
- [ ] `bouncer migrate ids --dry-run` 출력을 사용자에게 보여 확인받는다.
- [ ] apply 후 `.bouncer/context/epics/014-numeric-context-ids` 등이 존재하는지 확인한다.
- [ ] apply 후 이 BP 문서의 새 경로(`…/blueprints/003-dogfood-context/`)로
  `bouncer validate --gate plan`을 한 번 돌려 게이트가 새 경로에서 붙는지 확인하고,
  이후 작업을 그 경로에서 이어간다.
- [ ] rename이 한 커밋 안에서 rename으로 보이게 스테이지되었는지 확인한다.
- [ ] `bouncer current`가 새 blueprint 경로를 가리키는지 확인한다.
- [ ] migrate 적용을 끝낸 뒤에 구형 접두 허용 코드(`paths`·`layout`·`epic-index`
  ·`scaffold` 경로 정규식 + `validate` S4/S5 정규화)를 제거한다.
- [ ] `grep -rn "epics/EPIC-\|blueprints/BP-" test/`가 `test/migrate-ids.test.js`
  외에는 걸리지 않을 때까지 fixture를 신형으로 옮기고, 구형 통과 단언은 실패
  단언으로 뒤집는다.
- [ ] `docs/`·`README.md`·`skills/bouncer-plan/SKILL.md`의 구형 경로 예시를
  신형으로 바꾼다.
- [ ] Distill Decisions worktree 문장을 갱신한다.
- [ ] SessionStart가 구형 경고를 내지 않음을 확인한다.
- [ ] `npm test` 통과.
- [ ] `affected_paths`를 dry-run/apply가 만진 파일 목록으로 고정한다.
- [ ] `CHANGELOG.md` `[Unreleased]`에 014 항목과 소비자 업그레이드 절차를 쓴다.
