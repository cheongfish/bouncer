---
type: bouncer.distill
title: 001 distill
description: Distill for 001
resource: .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-02T23:44:42.280Z'
bouncer:
  id: DISTILL-BP-001
  epic_id: '004'
  blueprint_id: '001'
  status: published
---
# Distill

001에서 배운 것. starter-kit 작성 규율을 Bouncer 섹션 골격 안으로 번역한
첫 커밋이다.

## 구현에서

- 규율의 SSOT는 `scripts/lib/templates.js`의 `TEMPLATES` 문자열이다. 도그푸딩
  `.bouncer/templates/` 사본은 `readTemplate`이 내장 기본값보다 우선하므로 같은
  커밋에서 맞춰야 한다.
- 새 안내는 HTML 주석 또는 `<TODO:`만 허용한다. 평문 안내는 G10이 섹션을
  "채워진 것"으로 판정해 untouched 회귀를 깨뜨린다. 이 불변식은
  `validate-gates.test.js`가 지킨다.
- 섹션 헤딩은 불변이다. 수용 기준·검증 명령 항목은 Contract 불릿과 Goal/Checklist
  주석에 넣고, 새 `##` 헤딩을 만들지 않았다.

## 사이클에서 관찰한 것

- **`affected_paths`를 디렉터리(`scripts`)로 두면 G12에 걸린다.** Do not touch에
  `scripts/lib/validate.js` 등 형제 파일이 백틱으로 있으면 `pathsOverlap`이
  부모 경로와 교차한다. 이 저장소 관례처럼 `scripts/lib/templates.js`로
  좁히는 편이 안전하다.
- starter-kit 템플릿을 통째로 이식하지 않고 Contract-First 금지 목록·분량 예산·
  수용 기준·검증·실패 모드만 번역해도 목적에 충분했다. Bun/TS·`{{PLACEHOLDER}}`·
  승인 체크박스는 불필요했다.

## 다음 blueprint

1. 002 — `bouncer init`이 게이트 밖 구간을 안내하는 규칙 파일 스캐폴드.
2. 003 — 블루프린트 단위 검증 명령 선언·실행 (여기서는 안내만 넣었음).
