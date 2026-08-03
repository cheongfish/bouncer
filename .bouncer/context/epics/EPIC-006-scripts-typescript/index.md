---
type: bouncer.epic
title: EPIC-006 scripts-typescript
description: Epic EPIC-006
resource: .bouncer/context/epics/EPIC-006-scripts-typescript/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-03T04:04:55.484Z'
bouncer:
  id: EPIC-006
  epic_id: EPIC-006
  status: approved
---
# EPIC-006 scripts-typescript

## Intent
- 문제: `scripts/` 결정적 코어가 타입 없는 CommonJS라, 모듈 경계·설정 스키마·게이트
  계약이 리팩터와 리뷰에서 깨지기 쉽다.
- 목표: `scripts/` 구현을 TypeScript 소스로 옮기고 `tsc`로 CommonJS 산출을 내어,
  기존 bin·`require('…/scripts/lib/…')` 소비 경로와 CLI·게이트 동작을 유지한다.

## Success criteria
1. `scripts/` 구현 소스가 TypeScript이며, `node scripts/bouncer …`(또는 동일 bin)로
   CLI가 기존과 같이 동작한다.
2. `npm test`가 통과한다(필요 시 빌드가 테스트 앞에 끼워진 형태 포함).
3. 테스트·훅·스킬이 쓰는 `scripts/lib/*.js` CommonJS `require` 경로가 깨지지 않는다.
4. `tsc --noEmit`(또는 동등 typecheck 스크립트)로 타입 검사가 가능하다.

## Out of scope
- `hooks/`, `skills/`, `test/` 본문의 TypeScript 전환.
- Bun 런타임, `tsx` 등 TS 직접 실행 로더 도입.
- ESM(`import`/`"type":"module"`) 전환.
- 게이트 판정 로직·CLI 서브커맨드 계약·공개 출력 문자열 변경.
- `scripts/vendor/js-yaml.js` 재작성(필요 시 타입 선언만).
- 문서(`docs/`)·매니페스트 전면 개편.

## Blueprints
<!-- OKF §6 인덱스 형식. 새 blueprint를 만드는 기준은 하나 — 한 커밋으로
     리뷰 가능한 단위인가. 더 크면 blueprint를 쪼갠다. 하위 태스크 계층은
     만들지 않는다 (docs/governance.md). -->
* [BP-001 tsc-cjs-migrate](blueprints/BP-001-tsc-cjs-migrate/index.md) - TS 툴체인·소스 이전·CJS 산출을 한 커밋으로 넣는다
