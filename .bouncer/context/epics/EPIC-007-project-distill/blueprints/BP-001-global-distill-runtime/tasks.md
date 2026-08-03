---
type: bouncer.tasks
title: 전역 Distill을 init·finalize·스킬 런타임에 연결함
description: Tasks for BP-001
resource: .bouncer/context/epics/EPIC-007-project-distill/blueprints/BP-001-global-distill-runtime/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-03T04:59:09.997Z'
bouncer:
  id: TASKS-BP-001
  epic_id: EPIC-007
  blueprint_id: BP-001
  status: verified
  affected_paths:
    - scripts/src/lib/layout.ts
    - scripts/src/lib/init.ts
    - scripts/src/lib/finalize.ts
    - scripts/src/lib/templates.ts
    - scripts/lib/layout.js
    - scripts/lib/init.js
    - scripts/lib/finalize.js
    - scripts/lib/templates.js
    - CLAUDE.md
    - AGENTS.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-init/SKILL.md
    - skills/spec-authoring/SKILL.md
    - test/init.test.js
    - test/finalize.test.js
    - test/master-rules.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-execute.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-spec-authoring.test.js
    - docs/workflow.md
    - docs/gates.md
    - docs/troubleshooting.md
    - docs/ARCHITECTURE.md
    - docs/context-versioning.md
    - README.md
    - .bouncer/context/Distill.md
    - .bouncer/context/index.md
    - .bouncer/templates/distill.md
    - .bouncer/templates/pr.md
  graph:
    generated_at: '2026-08-03T05:00:00.000Z'
    command: graphify query
    suggested_paths:
      - scripts/
    basis: >-
      graphify query "distill finalize init templates master rules bouncer-plan
      bouncer-execute"; BFS hit finalize()/init()/TEMPLATES under scripts/lib —
      rolled up to scripts/. Skills, docs, CLAUDE/AGENTS, test, .bouncer/context
      Distill seed are outside the graph; seed manually into affected_paths.
---
# Tasks

Blueprint: [BP-001](index.md)

## Goal & intent
프로젝트 공용 `.bouncer/context/Distill.md`를 init으로 두고, 마스터 룰은 경로만
가리키며, plan/execute가 읽고 finalize가 BP distill에서 승격·커밋할 수 있게
한다. G9·BP distill status는 유지. 검증: `npm test`.

## Interface
- 제공: `layout.PROJECT_DISTILL` (`.bouncer/context/Distill.md`); init 골격
  (`## Invariants` / `## Gotchas` / `## Decisions`); `makeAllowed` 항상 허용;
  마스터 룰 Hard rule; plan/execute/finalize/spec-authoring 절차; 계약 테스트;
  이 저장소 시드 Distill; context index에 EPIC-007 한 줄.
- 거부: 기존 Distill 덮어쓰기; 마스터 룰에 Distill 본문 적재; G9/스키마 변경;
  Decisions를 변동 타임라인으로 append; BP `distill.md` 삭제.
- 유지: BP distill draft→published와 G9; `inspectBootstrap`은 config 기준;
  CLAUDE.md ≡ AGENTS.md; `scripts/src` 수정 후 `npm run build`로 `scripts/lib`
  emit.

## Touch
- Modify `scripts/src/lib/layout.ts` — `PROJECT_DISTILL` 상수 export
- Modify `scripts/src/lib/init.ts` — 최초·미존재 시 Distill 골격 생성, 기존
  비덮어쓰기
- Modify `scripts/src/lib/finalize.ts` — `makeAllowed`에 전역 Distill 허용
- Modify `scripts/src/lib/templates.ts` — BP distill/PR 안내를 전역 Distill
  승격 모델에 맞춤; 골격 문자열은 init과 공유 가능하면 templates/layout에서
  단일 정의
- Modify `scripts/lib/layout.js` — emit
- Modify `scripts/lib/init.js` — emit
- Modify `scripts/lib/finalize.js` — emit
- Modify `scripts/lib/templates.js` — emit
- Modify `CLAUDE.md` — 전역 Distill 경로·읽기 의무 Hard rule (본문 금지)
- Modify `AGENTS.md` — CLAUDE.md와 byte-identical
- Modify `skills/bouncer-plan/SKILL.md` — preflight에서 전역 Distill Read
- Modify `skills/bouncer-execute/SKILL.md` — preflight에서 전역 Distill Read
- Modify `skills/bouncer-finalize/SKILL.md` — BP distill 작성 후 전역 승격
- Modify `skills/spec-authoring/SKILL.md` — 전역 vs BP distill 작성 규칙
- Modify `skills/bouncer-init/SKILL.md` — Distill 산출물 안내(한 줄)
- Modify `test/init.test.js` — Distill 생성·비덮어쓰기·already-initialized 시드
- Modify `test/finalize.test.js` — Distill 경로 out-of-scope 아님
- Modify `test/master-rules.test.js` — Distill 경로 Hard rule 어서션
- Modify `test/skill-bouncer-plan.test.js` — Distill Read 계약
- Modify `test/skill-bouncer-execute.test.js` — Distill Read 계약
- Modify `test/skill-bouncer-finalize.test.js` — 승격 절차 계약
- Modify `test/skill-spec-authoring.test.js` — 전역 Distill 작성 규칙 언급
- Modify `docs/workflow.md` — finalize가 전역 Distill 갱신
- Modify `docs/gates.md` — G9는 BP distill; 전역은 스킬/allowed-set
- Modify `docs/troubleshooting.md` — Distill 관련 안내 보강
- Modify `docs/ARCHITECTURE.md` — 전역 Distill 한 줄
- Modify `docs/context-versioning.md` — Distill.md 커밋 대상
- Modify `README.md` — finalize/Distill 한 줄
- Create `.bouncer/context/Distill.md` — 골격 + 기존 BP distill에서 durable 시드
- Modify `.bouncer/context/index.md` — EPIC-007 인덱스 줄
- Modify `.bouncer/templates/distill.md` — 도그푸딩 BP distill 안내(있다면)
- Modify `.bouncer/templates/pr.md` — Distill 링크를 전역 경로로

## Do not touch
- `scripts/src/lib/validate.ts` — G9/게이트 로직 불변
- `scripts/src/lib/schema.ts` — 새 kind 없음
- `scripts/src/lib/advisor.ts` — phase는 BP distill status로 충분
- `hooks/` — 훅 배선 변경 없음
- `.bouncer/context/epics/EPIC-001-*` … `EPIC-006-*` — 과거 BP distill 일괄 수정 없음
- `package.json` — 의존성/스크립트 불변(빌드 스크립트 재사용)

## Constraints
- 전역 Distill은 현행 주의 목록이다. Decisions는 현재 유효 결정만 두고, 바뀌면
  문장을 교체하며 변동 로그를 append하지 않는다.
- 승격 기준: 재발 가능한 함정·프로젝트 불변식·현재 결정만. 사이클 회고·다음 BP
  후보·“잘 됐다” 확인은 BP distill에만 둔다.
- `PROJECT_DISTILL` 문자열은 한 곳에서 export하고 마스터 룰/스킬/문서가 같은
  경로를 가리킨다 (`Distill.md` 대소문자 유지).
- TypeScript 소스 변경 후 커밋 전 `npm run build`로 CJS emit을 맞춘다.
- 새 런타임 의존성·OKF kind·게이트 코드 추가 금지(minimality).

## Checklist
- [ ] 실패 테스트 추가: `finalize`가 `.bouncer/context/Distill.md`만 변경돼도
      out-of-scope가 아님; `init`이 Distill을 만들고 두 번째 호출에서 본문을
      보존; 마스터 룰/스킬이 경로·Read·승격을 언급
- [ ] 위 테스트가 현재 코드에서 실패함을 확인
- [ ] `layout.PROJECT_DISTILL` 추가 후 init/finalize/templates에서 사용
- [ ] init: 최초 생성 + ready인데 파일 없을 때 시드; 있으면 skip
- [ ] finalize `makeAllowed`: `f === PROJECT_DISTILL` 허용
- [ ] 전역 골격 섹션 `Invariants` / `Gotchas` / `Decisions` + 짧은 사용 안내
- [ ] CLAUDE.md / AGENTS.md Hard rule (경로 + plan/execute 전 Read; 본문 금지)
- [ ] plan / execute / finalize / spec-authoring / init 스킬 갱신
- [ ] `.bouncer/context/Distill.md` 시드(기존 durable만) + context index EPIC-007
- [ ] docs·README·도그푸딩 templates 갱신
- [ ] `npm run build` 후 `npm test` 통과
- [ ] 수용: Epic Success criteria 1–6이 테스트·문서로 판정 가능
