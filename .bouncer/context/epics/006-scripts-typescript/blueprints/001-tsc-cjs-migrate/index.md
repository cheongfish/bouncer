---
type: bouncer.blueprint
title: 결정적 코어를 정적 타입 소스와 CJS 산출로 이전
description: Blueprint 001
resource: .bouncer/context/epics/006-scripts-typescript/blueprints/001-tsc-cjs-migrate/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-03T04:04:55.505Z'
bouncer:
  id: '001'
  epic_id: '006'
  blueprint_id: '001'
  status: approved
  commit_type: refactor
---
# 001 tsc-cjs-migrate

Epic: [006](../../index.md)

## Intent
- 문제: `scripts/lib` 결정적 코어가 타입 없는 CJS라 모듈·스키마 계약이 리뷰와
  리팩터에서 쉽게 깨진다. 플러그인 소비자는 빌드 없이 `node scripts/bouncer`로
  실행해야 한다.
- 완료 조건: 구현 소스는 TypeScript, `tsc`가 CommonJS를 `scripts/lib/`에 내며,
  bin·훅·테스트의 기존 `require` 경로와 CLI·게이트 동작이 유지되고 `npm test`가
  통과한다.

## Contract
- 레이아웃: TypeScript 소스는 `scripts/src/lib/*.ts`(및 필요 시 타입 선언).
  `tsc` 산출은 기존 소비 경로인 `scripts/lib/*.js`(CommonJS)다. 진입점
  `scripts/bouncer`는 Node shebang + `./lib/cli` require를 유지한다.
  `scripts/vendor/`는 재작성하지 않는다.
- 모듈: CommonJS만. ESM·`"type":"module"`·TS 직접 실행 로더(`tsx` 등) 금지.
- 툴체인: `typescript`와 `@types/node`를 devDependency로 추가. `tsconfig.json`은
  `commonjs` 모듈, `scripts/src` → `scripts/lib` emit. `package.json`에
  `build` / `typecheck` 스크립트. 테스트 전에 빌드가 돌아가도록 해
  `npm test`(config.verify)가 산출물을 전제로 통과한다.
- 공개 계약: CLI 서브커맨드·exit code·게이트 코드(G/S)·문서 스키마·
  `require('…/scripts/lib/<name>')` export 이름은 동작·이름을 바꾸지 않는다.
  타입만 보강한다.
- 배포: 플러그인이 설치 직후 Node만으로 동작하도록 **산출 `.js`를 커밋**한다.
  소스만 커밋하고 런타임에 `tsc`/`tsx`를 요구하지 않는다.
- 수용 기준: epic Success criteria 1–4. 검증: `npm test` 및 `npm run typecheck`.
- 실패 모드: `scripts/src`만 고치고 빌드·커밋을 빠뜨리면 소비자가 구 산출을
  실행한다 → Checklist에 build→test→산출 동기화를 명시. vendor는 타입 선언으로만
  감싼다.

## Out of scope
- `hooks/`, `test/`, `skills/` TS 전환 또는 ESM 전환.
- Bun / `tsx` / 기타 TS 런타임 로더.
- 게이트·CLI 동작·공개 문자열 변경.
- `scripts/vendor/js-yaml.js` 본문 재작성.
- `docs/` 전면 개편(필요 시 contributing 한 줄은 tasks Constraints로만).

## One-commit justification
- 툴체인만 넣으면 소스가 그대로고, 소스만 옮기면 빌드·require 경로가 없다.
  TS 소스 + `tsc` CJS 산출 + package 스크립트가 한 커밋이어야 플러그인이
  중간에 깨지지 않는다. ~1.8kLOC·모듈 18개로 리뷰 가능한 단일 이전 단위다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
