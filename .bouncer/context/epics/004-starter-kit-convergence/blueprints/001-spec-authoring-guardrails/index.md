---
type: bouncer.blueprint
title: 001 spec-authoring-guardrails
description: Blueprint 001
resource: .bouncer/context/epics/004-starter-kit-convergence/blueprints/001-spec-authoring-guardrails/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-02T23:44:42.280Z'
bouncer:
  id: '001'
  epic_id: '004'
  blueprint_id: '001'
  status: approved
---
# 001 spec-authoring-guardrails

Epic: [004](../../index.md)

## Intent
- 문제: 내장 blueprint 템플릿의 `## Contract`는 불릿 두 개(인터페이스, 데이터·상태)뿐이고
  tasks 템플릿에는 수용 기준에 해당하는 항목이 아예 없다. G10은 섹션이 비었는지와
  `<TODO:` 토큰이 남았는지만 보므로, 한 줄씩 채워 넣으면 얕은 문서도 plan 게이트를
  지난다. starter-kit은 같은 자리에서 금지 목록과 분량 예산으로 구현 상세 누출을
  막아왔고, 그 규율이 Bouncer에는 없다.
- 완료 조건: `scripts/lib/templates.js`의 `blueprint.md`·`tasks.md` 기본 본문에
  Contract-First 금지 목록과 분량 예산, 수용 기준·검증 명령 항목, 실패 모드·엣지 케이스
  항목이 들어간다. 섹션 헤딩 집합은 그대로다. untouched 템플릿은 여전히 plan 게이트에서
  막히고 `npm test`가 통과한다.

## Contract
<!-- 계약만. 구현 코드 금지 — 시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다. -->
- 인터페이스 (템플릿 본문 2개, 문자열 자체가 계약): `TEMPLATES['blueprint.md']`와
  `TEMPLATES['tasks.md']`. 섹션 헤딩(`## Intent` / `## Contract` / `## Out of scope` /
  `## One-commit justification` / `## Documents`, `## Goal & intent` / `## Interface` /
  `## Touch` / `## Do not touch` / `## Checklist`)은 **불변**이다. G10은 헤딩으로 섹션을
  가르고 G11·G12는 Touch·Do not touch 본문을 읽으므로 헤딩 변경은 게이트 변경이다.
- 인터페이스 (추가되는 안내 항목): Contract 섹션에 금지 목록(계약 클래스·메서드 본문,
  As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스, 실행 가능한 테스트 본문)과 본문 분량 예산,
  수용 기준·검증 명령 불릿, 실패 모드·엣지 케이스 불릿.
- 인터페이스 (안내문 표기 제약): 새 안내는 HTML 주석 또는 `<TODO:` 플레이스홀더로만
  적는다. G10은 주석을 걷어낸 뒤 섹션이 비었는지 판정하므로, 평문 안내는 그 섹션을
  "이미 채워진 것"으로 만들어 게이트를 무력화한다. 기존 회귀 테스트가 이 불변식을
  지킨다 — untouched tasks 템플릿은 정확히 `goal, interface, touch, doNotTouch,
  checklist` 다섯 자리에서 G10에 걸려야 한다.
- 데이터·상태: 게이트 판정 로직과 frontmatter 스키마 불변. 이 저장소의
  `.bouncer/templates/` 사본은 `init`이 써 둔 것이고 `readTemplate`에서 내장 기본값보다
  우선하므로, 도그푸딩 저장소가 새 규율을 실제로 쓰려면 같은 커밋에서 함께 갱신한다.

## Out of scope
- G10·G11·G12 판정 로직(`scripts/lib/validate.js`) 변경. 이 blueprint는 게이트가 이미
  요구하는 섹션 안의 안내문만 바꾼다.
- 섹션 헤딩 추가·삭제·개명.
- `epic.md`·`verification.md`·`review.md`·`distill.md`·`pr.md` 템플릿. 같은 규율이
  필요해지면 별도 blueprint로 분리한다.
- 블루프린트 단위 검증 명령 도입 — 003 소관. 여기서는 검증 명령을 **적으라고 안내만**
  하고, 그 값을 하네스가 읽어 실행하게 만들지 않는다.
- `skills/spec-authoring/SKILL.md` 본문 재작성. 스킬은 템플릿을 읽어 채우는 쪽이고,
  규율의 소재지는 템플릿이다.

## One-commit justification
<!-- .bouncer/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 변경의 실체는 템플릿 문자열 두 개다. 여기에 저장소 사본 두 개와 대응 테스트가 따라온다.
- 쪼갤 수 없다. blueprint는 계약을, tasks는 그 계약의 수용 기준을 담으므로 한쪽만 규율을
  갖춘 중간 커밋은 작성자에게 어긋난 지침을 준다.
- 판정 로직을 건드리지 않으므로 회귀 범위는 템플릿을 읽는 테스트로 한정되고 `npm test`가
  덮는다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
