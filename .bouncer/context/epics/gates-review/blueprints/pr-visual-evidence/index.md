---
type: bouncer.blueprint
title: PR 변경 그림과 판단 자료
description: Require a change diagram in every finalize PR and add before-after evidence and revert-impact sections to the PR rules and templates without changing the digest schema.
resource: .bouncer/context/epics/gates-review/blueprints/pr-visual-evidence/index.md
tags:
  - bouncer
  - blueprint
  - pull-request
  - finalize
  - mermaid
timestamp: '2026-10-12T10:47:02.956+09:00'
bouncer:
  id: pr-visual-evidence
  epic_id: gates-review
  blueprint_id: pr-visual-evidence
  status: closed
  order: 11
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 003 PR 변경 그림과 판단 자료

Epic: [095](../../../coding-standards-pr-retro/index.md)

## Intent
finalize PR은 문서·설정·테스트 변경이면 그림 없이 나가고, 변경 전후 동작과 되돌리기 방법을 적는 자리가 없어 사람이 PR만 보고 판단하기 어려움.
모든 PR에 실제 diff에 근거한 변경 그림, 변경 전후 근거, 되돌리기·영향 범위 절을 필수로 넣게 함.

## Diagram
```mermaid
flowchart LR
  F[finalize · PR 그림·판단 자료]
```

## Contract
- 인터페이스: PR 본문 절 순서가 아래처럼 바뀐다.
  1. `관련 이슈`
  2. `배경 · 변경 의도`
  3. `주요 변경 내용`
  4. `변경 그림`(필수)
  5. `변경 전후`(필수)
  6. `리뷰 포인트`
  7. `되돌리기 · 영향 범위`(필수)
  8. `확인 방법`

  `로직 흐름` 절은 없어진다. 필수 세 절은 "빈 절 삭제" 규칙의 예외다.
- 데이터·상태: finalize digest `pr.sections`(`related`, `background`, `changes`, `flow`, `review_points`, `verification`)의 필드와 값은 바뀌지 않는다. `flow`는 계속 `null`이다.
- 수용 기준: epic Success criteria 5와 BP 범위의 10이 참이다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 아주 작은 변경도 대상과 영향 관계를 노드 두 개 이상으로 그린다.
  - diff·Explain에 없는 컴포넌트나 흐름은 그리지 않는다.
  - 변경 전 결과를 관측하지 못했으면 `변경 전 결과 미관측`이라고 적고, 실행 증거처럼 꾸미지 않는다.
  - 되돌리기로 복구되지 않는 영향이 없으면 "커밋 되돌리기로 모두 복구됨"이라고 근거와 함께 적는다.
  - 위험 분류는 사람 판단 자료이며 승인·병합 근거가 아니다.

## Out of scope
- digest 스키마와 `scripts/src/lib/finalize-pr.ts` 변경
- Mermaid 렌더링 검사 도구, 이미지 첨부
- `finalize.pr` ACQ 선택지·push·PR 생성 순서 변경
- retro 안내(BP 004)

## One-commit justification
- PR 규칙 문서와 그 규칙을 비추는 템플릿 세 개, 순서 테스트가 한 계약(절 목록)을 공유하므로 한 커밋이다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
