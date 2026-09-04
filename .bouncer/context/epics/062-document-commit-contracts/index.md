---
type: bouncer.epic
title: Document and Commit Contracts
description: Organizes durable document and commit contracts so future workflow improvements remain consistent.
resource: .bouncer/context/epics/062-document-commit-contracts/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-09-04T10:45:54.414+09:00'
bouncer:
  id: '062'
  epic_id: '062'
  status: approved
  supersedes: []
---
# 062 Document and Commit Contracts

## Intent
- 문제: 스캐폴드·실행·종료 단계가 만드는 문서와 커밋의 계약이 여러 위치에 흩어져 있어, 임시 안내가 산출물에 남거나 수명주기 경계가 흐려질 수 있음.
- 목표: 문서 품질과 task 커밋의 계약을 명시적 검사와 일관된 작성 규칙으로 정비함.

## Success criteria
1. 새로 추가하거나 수정한 컨텍스트 문서에 스캐폴드 안내 주석이나 TODO 플레이스홀더가 남으면 CI가 실패한다.
2. 기존에 변경되지 않은 컨텍스트 문서는 새 검사 때문에 실패하지 않는다.
3. 각 블루프린트는 문서·커밋 계약을 바꾸는 범위와 비대상 범위를 검증 가능한 형태로 기록한다.

## Out of scope
- 기존 `.bouncer/context/epics/**` 코퍼스의 일괄 주석 제거
- Bouncer G/S 게이트의 판정 기준 변경
- `check-doc-shape.js`에 컨텍스트 변경 파일 탐색 책임 추가

## Blueprints
* [템플릿 주석 lint](blueprints/001-scaffold-template-comment-lint/index.md) - 스캐폴드 템플릿과 CI에 변경 컨텍스트 문서의 안내 주석 검사를 추가한다.
