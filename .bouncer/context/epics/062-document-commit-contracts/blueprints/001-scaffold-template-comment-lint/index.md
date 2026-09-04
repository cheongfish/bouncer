---
type: bouncer.blueprint
title: 스캐폴드 템플릿 주석 lint
description: Detects scaffold-authored comments and TODO placeholders in changed context documents.
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/001-scaffold-template-comment-lint/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-09-04T10:45:54.503+09:00'
bouncer:
  id: '001'
  epic_id: '062'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 스캐폴드 템플릿 주석 lint

Epic: [062](../../index.md)

## Intent
- 문제: 저작을 마친 컨텍스트 문서에 스캐폴드의 일회성 안내 주석이 남아도 현재 CI가 이를 구분해 잡지 못함.
- 완료 조건: 변경된 컨텍스트 문서만 대상으로 스캐폴드 주석과 TODO 플레이스홀더를 검사하고, 위반 시 CI lint가 실패함.

## Contract
- 인터페이스: `npm run lint:context-comments [--base <ref>] [<file>...]`를 제공한다. 명시 파일은 그 파일만 검사하고, 인자가 없으면 기준 ref와 working tree에서 추가·수정된 `.bouncer/context/**/*.md`를 합쳐 검사한다.
- 데이터·상태: 검사기는 `templates.ts`가 제공하는 HTML 안내 주석 본문을 정규화하여 대조하며, TODO 플레이스홀더도 같은 대상에서 금지한다. Git 상태나 문서를 변경하지 않는다.
- 수용 기준: 위반한 변경 파일과 미추적 파일은 비영 종료 상태가 되고, 삭제 파일·기존 미수정 파일·스캐폴드가 만들지 않은 HTML 주석은 통과한다. Git-ignored `.bouncer/config.json`이 없는 execute worktree에서도 `npm run ci`가 통과한다. `npm run ci`는 새 lint를 정해진 순서로 실행한다.
- 검증 명령: `npm test`, `npm run lint:context-comments -- --base HEAD`, `npm run ci`
- 실패 모드·엣지 케이스: 기준 ref가 해석되지 않으면 명확한 오류로 실패한다. diff에 삭제된 파일만 있거나 검사 대상이 없으면 성공한다. 주석 본문이 템플릿과 정확히 대응하지 않으면 저자 주석으로 보고 허용한다.

## Out of scope
- 기존 143개 문서의 템플릿 주석을 제거하지 않는다.
- Bouncer plan/execute/commit 게이트 또는 `scripts/check-doc-shape.js`의 책임을 바꾸지 않는다.
- 모든 HTML 주석을 금지하는 일반 Markdown lint를 만들지 않는다.

## One-commit justification
- 템플릿에서 검사 표식을 읽고, 변경 파일 선택·CI 배선·회귀 테스트를 하나의 닫힌 lint 계약으로 추가하므로 한 커밋에서 함께 검토할 수 있다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
