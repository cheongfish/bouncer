---
type: bouncer.blueprint
title: digest PR 입력 정리
description: Stop finalize digest and PR draft from carrying later blueprint sections, duplicate findings, repeated verification lines, and local symbols.
resource: .bouncer/context/epics/091-drive-observation-cleanup/blueprints/001-digest-pr-input/index.md
tags:
  - bouncer
  - blueprint
  - finalize
  - digest
  - pr
timestamp: '2026-10-10T21:36:43.666+09:00'
bouncer:
  id: '001'
  epic_id: '091'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 digest PR 입력 정리

Epic: [091](../../index.md)

## Intent
finalize digest와 PR draft가 blueprint의 뒤쪽 절, 중복 finding, 반복 검증 줄, 지역 변수 이름을 담지 않게 함.

## Contract
- 인터페이스: `prepareFinalizeDigest` 결과 JSON의 필드 이름과 타입은 바꾸지 않는다. `out_of_scope`, `symbols`, `pr.sections.review_points`, `pr.sections.verification`의 값 집합만 좁아진다.
- 데이터·상태: `out_of_scope`는 `## Out of scope` 제목 다음 줄부터 다음 `## ` 제목 직전까지만 읽는다. 공유 `parseSections`의 의미는 바꾸지 않는다.
- 데이터·상태: `review_points`는 같은 finding 메모(없으면 id) 문자열을 task review·blueprint review를 통틀어 처음 나온 순서로 한 번만 담고, `unverified`의 `finding-accepted`·`finding-deferred` 행은 `review_points`로 옮기지 않는다. digest `unverified`에는 그 행이 그대로 남는다.
- 데이터·상태: `pr.sections.verification`은 같은 문자열을 처음 나온 순서로 한 번만 담는다.
- 데이터·상태: `symbols`는 들여쓰기 없는 `+` 줄과, 앞 공백 한 칸을 뗀 hunk header 문맥이 들여쓰기 없이 시작할 때만 이름을 뽑는다. 파일당·전체 상한은 유지한다.
- 실패 모드·엣지 케이스: Out of scope 절이 본문 마지막이거나 없을 때, 같은 메모의 finding이 task review와 blueprint review에 함께 있을 때, verification 명령이 같은데 상태가 다를 때(`passed`/`failed` 문자열이 다르면 둘 다 남김), `export`·`async` 접두 선언.
- 수용 기준: 에픽 수용 기준 1·2·3·4·13.
- 검증: `npm run ci`로 최종 검증하고 execute gate가 성공 증거를 기록한다.

## Out of scope
- PR `background`·`changes`·`flow` 채움, digest 버전 변경, terminal-missing 조건(BP 002).
- `parseSections`와 다른 호출자의 절 해석.

## One-commit justification
TASKS-001 하나가 digest와 PR draft의 네 가지 정리를 회귀 테스트·생성 JS·CHANGELOG와 함께 반영한다. 두 파일이 같은 digest 결과를 만들고 소비하므로 하나의 리뷰로 판단한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - execute가 작성하는 검증 증거
* [Review](review.md) - 실행 결과 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
