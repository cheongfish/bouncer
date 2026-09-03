---
type: bouncer.blueprint
title: 스킬 경로와 모듈 타입 계약 정비
description: Makes skill reference bases and ACQ timing explicit while restoring TypeScript checks across CommonJS module boundaries.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/003-correctness-contracts/index.md
tags:
  - bouncer
  - blueprint
  - skill-contract
  - acq
  - typescript
  - commonjs
timestamp: '2026-09-03T14:41:58.786+09:00'
bouncer:
  id: '003'
  epic_id: '061'
  blueprint_id: '003'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 스킬 경로와 모듈 타입 계약 정비

Epic: [061](../../index.md)

## Intent
- 문제: 스킬 안의 `references/`가 루트와 스킬 디렉터리 중 어느 기준인지 드러나지 않고, ACQ 목록은 절차 끝에서야 읽힌다. CommonJS 모듈 소비자는 공급자 시그니처를 캐스트로 복제해 TypeScript 검사를 우회한다.
- 완료 조건: 참조 기준과 질문 시점이 문서 구조에 드러나며, CommonJS 공개 표면을 유지한 채 모듈 간 타입 불일치를 컴파일 단계에서 발견한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: 플러그인 루트 보조 문서는 `${BOUNCER_ROOT}/references/...`, 스킬 로컬 보조 문서는 `./references/...`로 적는다. ACQ는 질문 직전 절차 단계에 두고 마지막 H2는 단계별 색인만 제공한다. TypeScript CommonJS 모듈은 `export =`와 `import = require()`로 서로의 선언을 소비한다.
- 데이터·상태: OKF 필드, `bouncer.*` 상태 전이, ACQ의 질문 내용과 답변 결과, CLI 공개 `require()` 표면은 바뀌지 않는다.
- 수용 기준: 여섯 workflow skill과 `rules/skill-shape.md`가 경로·ACQ 배치 규약을 일관되게 표현한다. 모듈 간 의도적인 시그니처 불일치는 `tsc --noEmit`에서 실패하며, 빌드 결과와 `npm test`가 기존 CJS 동작을 유지함을 보인다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 같은 이름의 루트/로컬 참조를 혼동하는 경우, 색인과 인라인 ACQ의 단계 번호가 어긋나는 경우, `paths`와 `tasks-docs`의 순환 require, `__esModule` 추가로 인한 공개 require 표면 변화를 다룬다.

## Out of scope
- `rules/governance.md`와 `rules/okf.md`의 조건부 적재 분리
- verify·commit 보안 경계 또는 호스트 매니페스트 변경
- 산문 정규식 테스트, 배포 매니페스트, 버전 관리 방식 변경
- CommonJS에서 ESM으로의 런타임 전환 또는 새 빌드 도구 도입

## One-commit justification
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 문서 계약 변경과 TypeScript 경계 전환은 서로 다른 회귀 위험과 검증 증거를 가지므로 두 task commit으로 분리한다. 각 task는 독립적으로 `npm test`와 `npm run typecheck`를 통과해야 한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 스킬 참조와 ACQ 배치 계약
* [Verification 001](tasks/001/verification.md) - 문서 계약 회귀 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - CommonJS 모듈 경계 타입 전환
* [Verification 002](tasks/002/verification.md) - 타입·방출 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
