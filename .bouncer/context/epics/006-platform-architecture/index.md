---
type: bouncer.epic
title: 006 platform-architecture
description: TypeScript 전환, 스킬 구조, 코어 모듈 분해, 스킬 본문 골격, 구현 주석 지침 및 카탈로그 숨김을 통합 관리
resource: .bouncer/context/epics/006-platform-architecture/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-03T04:04:55.484Z'
bouncer:
  id: '006'
  epic_id: '006'
  status: approved
---
# 006 platform-architecture

scripts TypeScript 전환, 공통 스킬 구조 정렬, 코어 모듈 책임 분해, 스킬 본문 골격 표준화, 한국어 docstring 주석 계약 및 보조 스킬 비공개 역사를 하나의 플랫폼 아키텍처 계층으로 통합 관리한다.

## Blueprints
* [001 tsc-cjs-migrate](blueprints/001-tsc-cjs-migrate/index.md) - TS 툴체인·소스 이전·CJS 산출을 한 커밋으로 넣는다
* [002 skill-structure](blueprints/002-skill-structure/index.md) - 16개 `SKILL.md`를 공통 anatomy로 정렬하고 워크플로 스킬의 플러그인 루트 산문을 `docs/install.md` 참조로 대체, 코드 주석 규칙을 `CLAUDE.md` 하드룰로 승격, 커밋 의도 작성 위치를 task 문서로 일원화(`finalize` 해석 경로 포함)
* [003 core-module-split](blueprints/003-core-module-split/index.md) - 설정 리더 통합과 `cli.ts`·`validate.ts`·`session-graph.ts`·`import-history.ts` 분해 (`scripts/src/lib/**`, `scripts/lib/**` emit)
* [004 skill-body-shape](blueprints/004-skill-body-shape/index.md) - 본문 골격을 `rules/skill-shape.md`로 못박고 워크플로 6개·서브스킬 12개·에이전트 4개를 그 골격에 맞춘다 (`rules/`, `skills/`, `agents/`, `docs/ARCHITECTURE.md`, `test/`)
* [005 implementation-doc-comments](blueprints/005-implementation-doc-comments/index.md) - `skills/implementation`에 한국어 docstring 계약(요약·Args·Returns)과 단계 주석 지침을 넣어 구현 산출물의 주석 밀도를 규정한다 — 같은 파일의 절 이름을 바꾸는 001 뒤에 실행한다 (`skills/implementation/SKILL.md`, `test/skill-implementation.test.js`)
* [006 catalog-hide](blueprints/006-catalog-hide/index.md) - 11개 보조 트리를 `references/`로 옮기고 진입 스킬·테스트·문서 경로를 맞춘다
