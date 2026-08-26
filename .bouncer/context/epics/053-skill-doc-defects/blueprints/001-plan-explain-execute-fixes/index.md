---
type: bouncer.blueprint
title: 스킬 문서를 게이트·CLI 실제 동작에 맞춤
description: plan 다중 task 절차·graphify 안내·explain-diff 모순·경량 리뷰 정책·코드펜스 정렬을 고친다
resource: .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-26T13:09:29.899+09:00'
bouncer:
  id: '001'
  epic_id: '053'
  blueprint_id: '001'
  status: closed
  commit_type: docs
  scale: full
  supersedes: []
---

# 001 plan·explain·execute 문서 결함 수정

Epic: [053](../../index.md)

## Intent
- 문제: `/bouncer-plan`이 다중 task blueprint를 저작할 절차를 주지 않고, graphify 활성화를 손편집으로 안내하며, `explain-diff`는 파일 부재 시 행동이 두 갈래고, 경량 경로는 같은 세션이 자기 diff를 리뷰한다.
- 완료 조건: 다섯 결함이 문서에서 사라지고 각각을 고정하는 테스트가 생겨 `npm test`가 통과한다.

## Contract
- 인터페이스: 변경되는 것은 스킬 절차문과 규칙 문서의 서술이다. CLI 플래그, 게이트 코드(G4·G5·G10–G12·G18), 문서 스키마, frontmatter 필드는 하나도 바뀌지 않는다.
- 데이터·상태: 없음. `scripts/lib/**`와 `.bouncer/config.json`은 열지 않는다.
- 수용 기준: epic Success criteria 1–6이 모두 참.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 경량 리뷰 정책을 바꾸면 `test/skill-bouncer-execute.test.js`와 `test/lightweight-cycle.test.js`가 기존 인라인 문구를 요구하며 깨진다. 정책 변경과 테스트 갱신은 같은 커밋에 들어가야 한다.
  - `test/lightweight-cycle.test.js:13-28`이 `rules/governance.md`에서 `inline`·`its own diff|self-review`·`named agents are unavailable` 세 문구의 존재를 요구한다. 규칙 4를 다시 쓰면서 이 문구들을 통째로 없애면 깨진다. 같은 파일 91-108줄의 docs assert는 경량 **계획 문서 세트**만 보므로 리뷰 정책과 무관하다 — `docs/**`는 이 blueprint의 범위가 아니다.
  - `tasks/<NNN>` 순회 표현이 task 하나뿐인 경량 blueprint를 배제하면 안 된다.
  - `verify`가 `npm test` 전량이므로, green에 필요한 파일이 하나라도 `affected_paths` 밖이면 execute 게이트가 아니라 commit 단계에서 막힌다.

## Out of scope
- 스킬 절차문 영어 재작성 (BP-002)
- `scripts/lib/**` 게이트·CLI 구현
- 같은 id `024` 디렉터리 둘의 정리

## One-commit justification
한 커밋이 아니라 **task 다섯 개, 커밋 다섯 개**다. 각 결함이 서로 다른 파일과 서로 다른 테스트를 건드리고 독립적으로 되돌릴 수 있어, 하나로 묶으면 리뷰가 diff를 결함별로 가를 수 없다. blueprint는 그대로 한 PR 단위로 남는다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - plan 다중 task 절차 일반화
* [Tasks 002](tasks/002/tasks.md) - graphify 활성화 안내 통일
* [Tasks 003](tasks/003/tasks.md) - explain-diff 파일 부재 행동 단일화
* [Tasks 004](tasks/004/tasks.md) - 경량 경로 리뷰를 named로 되돌림
* [Tasks 005](tasks/005/tasks.md) - 코드펜스 BOUNCER_ROOT 정렬
* [Context review](context-review.md) - 계획 문서 정합성 판정
