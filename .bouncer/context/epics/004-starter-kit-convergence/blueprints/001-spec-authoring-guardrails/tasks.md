---
type: bouncer.tasks
title: 001 tasks
description: Tasks for 001
resource: .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-02T23:44:42.280Z'
bouncer:
  id: TASKS-001
  epic_id: '004'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/lib/templates.js
    - test
    - .bouncer/templates
  graph:
    generated_at: '2026-08-02T23:55:00.000Z'
    command: graphify-unavailable
    suggested_paths: []
    basis: 'graceful fallback: config.graphify.enabled is false and graphify-out/ is not required for this template-string change. Paths proposed from blueprint Contract (scripts/lib/templates.js, .bouncer/templates copies, template regression tests) for user confirmation.'
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게. -->
Bouncer의 내장 템플릿은 게이트가 요구하는 섹션 골격만 갖추고 있다. blueprint의
`## Contract`는 불릿 두 개뿐이고, tasks에는 수용 기준·검증 명령에 해당하는 안내가
없다. G10은 섹션이 비었는지와 `<TODO:` 잔존만 보므로, 한 줄씩만 채운 얕은 문서도
plan 게이트를 지난다.

완료 후에는 `scripts/lib/templates.js`의 `TEMPLATES['blueprint.md']`와
`TEMPLATES['tasks.md']` 본문에 Contract-First 금지 목록, 본문 분량 예산, 수용
기준·검증 명령 항목, 실패 모드·엣지 케이스 항목이 들어 있다. 섹션 헤딩 집합은
그대로다. `bouncer init`이 쓰는 `.bouncer/templates/` 사본과 이 저장소의 도그푸딩
사본도 같은 본문으로 맞춰져 있다. untouched tasks 템플릿은 여전히 G10에 걸리고
`npm test`가 통과한다.

## Interface
- `TEMPLATES['blueprint.md']` / `TEMPLATES['tasks.md']` (문자열 계약): 섹션 헤딩
  집합은 **불변**. `## Intent` / `## Contract` / `## Out of scope` /
  `## One-commit justification` / `## Documents`, `## Goal & intent` /
  `## Interface` / `## Touch` / `## Do not touch` / `## Checklist`.
- 추가 안내는 HTML 주석 또는 `<TODO:` 플레이스홀더로만 적는다. 평문 안내는 G10이
  섹션을 "채워진 것"으로 판정해 게이트를 무력화한다.
- blueprint `## Contract`에 넣을 안내 (주석·플레이스홀더):
  - 금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
    실행 가능한 테스트 본문 → `tasks.md`로 이연.
  - 시그니처·타입·의사코드는 블록당 20줄 이하 (기존 주석과 정합).
  - 본문 분량 예산(~250줄)과 초과 시 쪼개기·이연 신호.
  - 수용 기준·검증 명령 불릿 (`<TODO:`).
  - 실패 모드·엣지 케이스 불릿 (`<TODO:`).
- tasks에 넣을 안내: Checklist 또는 Goal & intent 주석에 수용 기준·검증 명령을
  적으라는 지침. 섹션 헤딩을 새로 만들지 않는다.
- `readTemplate` 우선순위·`renderTemplate` 치환·게이트 판정 시그니처 불변.
- 이 저장소 `.bouncer/templates/{blueprint,tasks}.md`는 내장 기본값과 동일 본문.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     경로는 백틱으로 감쌉니다. -->
- `scripts/lib/templates.js` — `TEMPLATES['blueprint.md']`·
  `TEMPLATES['tasks.md']`가 배포 SSOT. 안내 문구는 여기만 바꾸면 `init`·`scaffold`
  폴백이 따라온다.
- `.bouncer/templates` — `init`이 써 둔 프로젝트 사본. `readTemplate`이 내장
  기본값보다 우선하므로, 도그푸딩 저장소가 새 규율을 쓰려면 같은 커밋에서
  `blueprint.md`·`tasks.md`를 함께 갱신한다.
- `test` — `test/init.test.js`·`test/validate-gates.test.js`가 템플릿 섹션·
  untouched G10 회귀를 고정한다. 새 안내가 평문으로 섹션을 채우지 않는지,
  금지 목록·분량 예산·수용 기준 안내가 들어갔는지 어서션을 보강한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/lib/validate.js` — G10·G11·G12 판정. 이 blueprint는 안내문만 바꾼다.
- `scripts/lib/schema.js` — frontmatter 스키마. 필드 추가 없음.
- `scripts/lib/verification.js` — 검증 실행. 003 소관.
- `scripts/lib/init.js` — 규칙 파일 스캐폴딩은 002 소관.
- `skills` · `commands` — 003 002가 재배치 중. 템플릿 규율과 무관.
- `hooks` · `.claude-plugin` · `.cursor-plugin` · `.codex-plugin` — 플러그인 배선.
- `.bouncer/config.json` · `.bouncer/governance.md` · `.bouncer/workflow.md` ·
  `.bouncer/okf.md` — 거버넌스 정책 문서. 템플릿 본문과 분리한다.
- `epic.md` · `verification.md` · `review.md` · `distill.md` · `pr.md` 템플릿 —
  blueprint Out of scope. 같은 규율이 필요하면 후속 blueprint.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다. -->
- [ ] `scripts/lib/templates.js`의 `TEMPLATES['blueprint.md']` `## Contract`에
      금지 목록·분량 예산·수용 기준·검증 명령·실패 모드/엣지 케이스 안내를
      HTML 주석과 `<TODO:` 플레이스홀더로만 추가한다. 섹션 헤딩은 바꾸지 않는다.
- [ ] 같은 파일의 `TEMPLATES['tasks.md']`에 수용 기준·검증 명령을 Checklist 또는
      Goal & intent 주석으로 안내한다. 새 `##` 헤딩을 만들지 않는다.
- [ ] 이 저장소 `.bouncer/templates/blueprint.md`와 `.bouncer/templates/tasks.md`를
      내장 `TEMPLATES`와 동일 본문으로 맞춘다.
- [ ] `test/validate-gates.test.js`의 untouched tasks → G10 회귀가 그대로
      통과하는지 확인한다. 실패하면 평문 안내가 섹션을 채운 것이므로 주석/
      `<TODO:`로 되돌린다.
- [ ] `test/init.test.js`에 새 규율 존재 어서션을 보강한다 (금지 목록·분량 예산·
      수용 기준 안내 중 식별 가능한 문구). 다섯 섹션 헤딩 어서션은 유지한다.
- [ ] `npm test` 전체 통과.
