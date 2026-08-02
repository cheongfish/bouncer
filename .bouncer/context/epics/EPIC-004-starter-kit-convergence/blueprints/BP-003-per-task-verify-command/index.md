---
type: bouncer.blueprint
title: BP-003 per-task-verify-command
description: Blueprint BP-003
resource: .bouncer/context/epics/EPIC-004-starter-kit-convergence/blueprints/BP-003-per-task-verify-command/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-02T23:44:42.331Z'
bouncer:
  id: BP-003
  epic_id: EPIC-004
  blueprint_id: BP-003
  status: draft
---
# BP-003 per-task-verify-command

Epic: [EPIC-004](../../index.md)

## Intent
- 문제: `readVerifyCommand`는 `config.json`의 `verify` 하나만 읽으므로 모든 블루프린트가
  같은 전역 명령으로 검증된다. 어떤 명령이 이 변경을 실제로 덮는지가 계획 단계에서
  선언되지 않고, execute 게이트의 증적에는 전역 명령만 남는다. 저장소가 커질수록 문서
  한 줄 수정에도 전체 스위트가 돌고, 검증 범위와 변경 범위의 관계를 리뷰어가 확인할
  방법이 없다. starter-kit은 태스크마다 검증 명령을 적게 하고 형식까지 제약해 이 연결을
  유지한다.
- 완료 조건: 블루프린트 단위 검증 명령을 계획 단계에서 선언할 수 있고, `bouncer verify`가
  그것을 우선 실행하며, 선언이 없으면 `config.verify`로 폴백한다. 실제 실행된 명령이
  `verification.md` 증적에 남고 G13이 그것을 확인한다. `npm test` 통과.

## Contract
<!-- 계약만. 구현 코드 금지 — 시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다. -->
- 인터페이스 (선언 위치): 선언은 `tasks.md`의 `bouncer.verify`에 둔다. `verification.md`는
  frontmatter와 본문 전체가 `recordVerificationResult`에 의해 재작성되는 하네스 소유
  문서라 작성자의 선언을 담을 수 없다. `tasks.md`는 이미 작성자가 `affected_paths`를
  확정하는 문서이므로 검증 범위 선언도 같은 자리에 온다.
- 인터페이스 (명령 형식 제약): 선언된 명령은 단일 실행 가능 명령이어야 한다. `cd`, 셸 제어
  연산자(`&&`, `||`, `;`, 파이프), 래퍼 스크립트를 금지한다 — 증적에 남은 문자열이 그대로
  재현 가능해야 하고, 실행 디렉터리는 항상 저장소 루트로 고정되어야 한다.
- 인터페이스 (해석 순서): `tasks.md`의 `bouncer.verify`가 있으면 그것을, 없으면
  `config.verify`를 쓴다. 둘 다 없으면 기존 `VERIFY_CONFIG_INVALID` 계약을 유지한다.
  선언은 선택 사항이며, 기존 프로젝트는 아무것도 바꾸지 않아도 동작이 같다.
- 인터페이스 (증적): `verification.md`의 `bouncer.verification.command`와 본문
  `## Command`에는 **실제 실행된** 명령이 기록된다. G13은 지금처럼 그 메타데이터의 존재를
  확인하며, 선언 유무에 따라 판정을 달리하지 않는다.
- 데이터·상태: `scripts/lib/schema.js`의 tasks 문서 스키마에 선택 필드 하나가 늘어난다.
  기존 문서는 필드가 없어도 유효하다.

## Out of scope
- 블루프린트 하위 태스크 계층 도입. `.bouncer/governance.md`는 blueprint를 한 커밋 단위로
  쪼개고 하위 계층을 만들지 않는다고 못 박는다. 여기서 말하는 "태스크별"은 `tasks.md`
  문서 하나당 하나이지 태스크 항목마다가 아니다.
- 변경 파일로부터 검증 명령을 자동 유추하는 기능.
- 여러 명령의 선언과 병렬·순차 실행. 형식 제약과 정면으로 충돌하므로 단일 명령만 받는다.
- `config.verify` 폐기. 폴백 기본값으로 남는다.
- `commit-hook.js`·`finalize.js`의 스코프 판정 변경.
- 검증 명령이 `affected_paths`를 실제로 덮는지 검사하는 게이트. 유혹적이지만 판정 근거를
  만들 수 없다. 필요해지면 별도 blueprint에서 다룬다.

## One-commit justification
<!-- .bouncer/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 변경의 실체는 검증 명령의 출처를 한 곳에서 두 곳(폴백 포함)으로 넓히는 것 하나다.
  스키마 필드 추가와 `readVerifyCommand` 시그니처 변경, 그리고 그 둘을 덮는 테스트가
  따라온다.
- 쪼갤 수 없다. 필드만 추가한 커밋은 아무도 읽지 않는 죽은 스키마를 남기고, 실행 경로만
  바꾼 커밋은 읽을 필드가 없다.
- 게이트 판정은 G13의 기존 확인을 그대로 두므로 회귀 범위가 검증 실행 경로로 한정된다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
