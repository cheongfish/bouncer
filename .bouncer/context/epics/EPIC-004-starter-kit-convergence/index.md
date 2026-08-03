---
type: bouncer.epic
title: EPIC-004 starter-kit-convergence
description: Epic EPIC-004
resource: .bouncer/context/epics/EPIC-004-starter-kit-convergence/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-02T23:44:38.453Z'
bouncer:
  id: EPIC-004
  epic_id: EPIC-004
  status: approved
---
# EPIC-004 starter-kit-convergence

## Intent
- 문제: Bouncer의 게이트는 섹션이 채워졌는지는 판정하지만 무엇을 채워야 하는지는
  거의 안내하지 않는다. 내장 템플릿 본문이 게이트가 요구하는 최소 골격이라, 형식만
  갖추고 내용은 얕은 문서가 게이트를 통과한다. 자매 프로젝트
  `sdd-agent-starter-kit`은 같은 문제를 겪으며 작성 규율(Contract-First 금지 목록,
  분량 예산, 수용 기준·검증 명령 명시, 세션 규칙 파일)을 축적해 두었다.
- 목표: starter-kit이 축적한 작성 규율을 Bouncer의 섹션 골격 안으로 옮긴다. 템플릿
  파일을 이식하는 것이 아니라 내용을 번역한다. 문서 스키마와 게이트 판정의 SSOT는
  Bouncer에 남고, starter-kit은 내용 출처로만 참조한다.

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
- `SKILL.md` 포맷과 `{{PREAMBLE}}` 주입 빌드 단계. EPIC-003 BP-002가 `skills/`를
  재배치하는 중이라 선행 의존이 있다. 후속 에픽으로 분리한다.
- `sdd-agent-starter-kit` 저장소 자체 변경. 이식은 단방향이다.

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (.bouncer/governance.md). -->
* [BP-001 spec-authoring-guardrails](blueprints/BP-001-spec-authoring-guardrails/index.md) - blueprint·tasks 템플릿 본문에 Contract-First 가드레일과 수용 기준·검증 항목을 추가한다
* [BP-002 init-rules-scaffold](blueprints/BP-002-init-rules-scaffold/index.md) - `bouncer init`이 게이트 밖 구간을 안내하는 규칙 파일을 함께 스캐폴딩한다
* [BP-003 per-task-verify-command](blueprints/BP-003-per-task-verify-command/index.md) - 전역 `config.verify` 하나 대신 블루프린트 단위 검증 명령을 선언·실행하고 증적에 남긴다
