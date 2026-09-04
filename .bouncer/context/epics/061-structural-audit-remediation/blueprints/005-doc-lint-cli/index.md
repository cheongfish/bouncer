---
type: bouncer.blueprint
title: 문서 검사 스크립트 분리와 린트 파이프라인 정비
description: Provides an executable CLI for document shape checks and integrates lint:docs into the repository test and CI pipeline.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/005-doc-lint-cli/index.md
tags:
  - bouncer
  - blueprint
  - lint
  - documentation
  - test-pipeline
timestamp: '2026-09-04T09:08:37.412+09:00'
bouncer:
  id: '005'
  epic_id: '061'
  blueprint_id: '005'
  status: approved
  commit_type: chore
  scale: full
  supersedes: []
---
# 문서 검사 스크립트 분리와 린트 파이프라인 정비

Epic: [061](../../index.md)

## Intent
- 문제: 문서 구조 검사기(`scripts/check-doc-shape.js`)가 단위 테스트(`test/master-rules.test.js`)의 보조 모듈로만 호출되어, 개발자가 문서 계약만 독립적으로 빠르게 검사하기 어렵고 CI 파이프라인에서 문서 린트가 분리된 게이트로 실행되지 않는다.
- 완료 조건: `check-doc-shape.js`를 독립 실행 가능한 CLI 런처로 확장하고, `package.json`에 `lint:docs` 스크립트를 추가하여 단일 명령 및 CI 단계에서 문서 구조 계약을 직접 검증한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: `node scripts/check-doc-shape.js [files...]`는 지정된 파일 또는 기본 검사 대상 문서군(`skills/**/*.md`, `agents/*.md`, `references/**/*.md`)의 구조를 검사하고, 성공 시 0, 위반 시 1을 반환한다. 위반 내용과 에러는 stderr로 출력한다. `npm run lint:docs`는 이 CLI를 구동한다. `npm run ci`는 `lint` 직후 순서(`npm run check:emit && npm run test:coverage && npm run lint && npm run lint:docs && npm run typecheck && npm audit --audit-level=high`)로 `lint:docs`를 실행한다.
- 데이터·상태: `package.json`의 `scripts.lint:docs` 추가, `ci` 파이프라인 스크립트 순서 갱신, CI 계약 테스트(`test/ci-contract.test.js`) 갱신.
- 수용 기준: 정상 문서 검사 시 exit code 0, 결함 있는 문서나 누락된 섹션 탐지 시 exit code 1 및 위반 내용 stderr 보고, `npm run lint:docs` 및 `npm test`가 통과한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 존재하지 않는 파일 인자 전달 시 명확한 오류 보고와 exit code 1 반환, 인자 없이 호출 시 기본 문서군(`skills`, `agents`, `references`) 자동 탐색, 외부 패키지 require 없이 Node 내장 모듈로만 동작.

## Out of scope
- 외부 마크다운 린터/파서 라이브러리(remark, markdownlint 등) 신규 설치
- 기존 `test/*.test.js`에 존재하는 기능적 assertion 정규식의 전면적인 재작성
- `scripts/lib/**` 및 `scripts/src/lib/**` Bouncer 코어 로직의 변경

## One-commit justification
- CLI 런처 추가, `package.json` 스크립트 신설, CI 파이프라인 연계 및 전용 테스트 추가는 문서 린트 독립화라는 단일 목적의 변경으로 한 커밋 단위로 검토 가능하다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
