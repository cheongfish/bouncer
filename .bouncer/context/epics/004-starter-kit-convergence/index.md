---
type: bouncer.epic
title: 004 starter-kit-convergence
description: Epic 004
resource: .bouncer/context/epics/004-starter-kit-convergence/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-02T23:44:38.453Z'
bouncer:
  id: '004'
  epic_id: '004'
  status: approved
---
# 004 starter-kit-convergence

## Intent
- 문제: Bouncer의 게이트는 섹션이 채워졌는지는 판정하지만 무엇을 채워야 하는지는
  거의 안내하지 않는다. 내장 템플릿 본문이 게이트가 요구하는 최소 골격이라, 형식만
  갖추고 내용은 얕은 문서가 게이트를 통과한다. 자매 프로젝트
  `sdd-agent-starter-kit`은 같은 문제를 겪으며 작성 규율(Contract-First 금지 목록,
  분량 예산, 수용 기준·검증 명령 명시, 세션 규칙 파일)을 축적해 두었다.
- 목표: starter-kit이 축적한 작성 규율을 Bouncer의 섹션 골격 안으로 옮긴다. 템플릿
  파일을 이식하는 것이 아니라 내용을 번역한다. 문서 스키마와 게이트 판정의 SSOT는
  Bouncer에 남고, starter-kit은 내용 출처로만 참조한다.

## Success criteria
<!-- discovery가 정리한 성공 조건. 판정 가능한 것만 번호를 붙이고, blueprint의
     수용 기준과 리뷰가 이 번호를 참조한다. -->
1. blueprint / tasks 템플릿 본문이 Contract-First 금지 목록과 수용 기준·검증 명령
   칸을 포함한다.
2. 블루프린트가 자신의 검증 명령을 `tasks.md`에 선언할 수 있고, 선언이 없는 기존
   블루프린트는 전역 `config.verify`로 이전과 동일하게 동작한다.
3. 선언된 검증 명령이 단일 실행 가능 형식이 아니면 문서 검사가 거부한다.
4. execute 증적(`verification.md`)에 **실제 실행된** 명령이 기록된다.
5. `discovery`가 한 패스에서 목표·범위·비목표·성공 조건에 더해 기존 epic·Distill과의
   중복 여부까지 점검하고, 그 산출을 plan에 넘기는 출력 계약을 명시한다.
6. 위 전부를 새 게이트 코드·새 런타임 상태 파일·외부 방법론 플러그인 의존 없이
   달성한다.

## Out of scope
- starter-kit의 문서 세트와 경로 체계 채택. `blueprint.md` + `status.json` +
  `lineage.json`, 루트 `context/epics/` 구조는 가져오지 않는다. `.bouncer/context/`의
  다섯 문서 체계를 유지한다.
- 본문 상태 필드와 승인 체크박스 도입. starter-kit 블루프린트 템플릿은 본문에
  `**Status**`와 `- [ ] Approved by User`를 두고 스스로 "Markdown `approved` 필드는
  신뢰하지 않음"이라 경고한다. Bouncer는 상태를 하네스 소유 frontmatter에 두어 이미
  해결했으므로 되돌리지 않는다.
- Bun / TypeScript 런타임, `SkillUtil.renderContent()`, `{{PLACEHOLDER}}` 문법 도입.
  Node 표준 라이브러리 + 벤더링 `js-yaml` 제약과 기존 `<TODO:>` 치환을 유지한다.
- `.sdd/` 런타임 상태 디렉터리(approvals, lineage, permissions) 도입.
- `SKILL.md` 포맷과 `{{PREAMBLE}}` 주입 빌드 단계. 003 002가 `skills/`를
  재배치하는 중이라 선행 의존이 있다. 후속 에픽으로 분리한다.
- `sdd-agent-starter-kit` 저장소 자체 변경. 이식은 단방향이다.

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (.bouncer/governance.md). -->
* [001 spec-authoring-guardrails](blueprints/001-spec-authoring-guardrails/index.md) - blueprint·tasks 템플릿 본문에 Contract-First 가드레일과 수용 기준·검증 항목을 추가한다
* [002 init-rules-scaffold](blueprints/002-init-rules-scaffold/index.md) - `bouncer init`이 게이트 밖 구간을 안내하는 규칙 파일을 함께 스캐폴딩한다
* [003 per-task-verify-command](blueprints/003-per-task-verify-command/index.md) - 전역 `config.verify` 하나 대신 블루프린트 단위 검증 명령을 선언·실행하고 증적에 남긴다
* [004 discovery-depth](blueprints/004-discovery-depth/index.md) - `discovery`가 엣지·실패 모드·기존 스트림 중복까지 한 패스에서 묻고 그 산출을 plan에 넘기게 한다
