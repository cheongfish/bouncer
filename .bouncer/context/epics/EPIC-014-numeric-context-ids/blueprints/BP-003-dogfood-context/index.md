---
type: bouncer.blueprint
title: 플러그인 context 숫자 id dogfood
description: 이 레포 migrate 적용, 레거시 경로 허용 제거, Distill·하드코딩 정리
resource: .bouncer/context/epics/EPIC-014-numeric-context-ids/blueprints/BP-003-dogfood-context/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-05T16:54:53.820+09:00'
bouncer:
  id: BP-003
  epic_id: EPIC-014
  blueprint_id: BP-003
  status: approved
  commit_type: chore
  commit_intent:
    - 플러그인 context를 숫자 id로 맞춤
    - 전이용 레거시 경로 허용을 거둠
---
# BP-003 dogfood-context

Epic: [EPIC-014](../../index.md)

## Intent
- 문제: BP-001/002만으로는 이 레포가 구형 경로에 남고, 레거시 경로·메타 허용이 남으면 하드 컷이 끝나지 않는다.
- 완료 조건: `migrate-ids` 스킬(또는 동등 CLI)로 `.bouncer/context/`를 숫자 명명으로 옮기고, layout/`parsePathIds`의 구형 접두 허용과 S5·S13의 구형 정규화를 함께 제거하며 Distill·문서 하드코딩을 맞춘다. EPIC-014 성공 조건 5·6.

## Contract
- 인터페이스: 이 레포에서 `bouncer migrate ids` 적용 결과 epic dir가 `014-numeric-context-ids` 형태이고 번들 index·포인터가 새 경로를 가리킨다.
- 인터페이스: `EPIC_DIR`/`BLUEPRINT_DIR`(및 동등 정규식)에서 `EPIC-`/`BP-` 선택 접두를 삭제한다. 구형 경로만 있으면 canonical 판정·S13 목록이 실패한다.
- 인터페이스: BP-001이 넣은 S5 구형 접두 정규화를 제거한다. 정규화 제거 후 구형 frontmatter(`EPIC-014`, `TASKS-BP-001`)는 S5로 실패한다. migrate 적용이 이 제거보다 먼저다 — 순서가 뒤바뀌면 이 커밋 안에서 게이트가 자기 문서로 실패한다.
- 데이터·상태: Distill Decisions의 worktree 문구를 `<BP-id>`에서 숫자 id 표현으로 갱신한다.
- 데이터·상태: `CHANGELOG.md` `[Unreleased]`에 EPIC-014 전체를 한 항목으로 쓰고 소비자 업그레이드 절차를 담는다. 버전 범프·태그는 에픽 밖이다.
- 수용 기준: EPIC-014 성공 조건 5, 6. `npm test` 통과.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: migrate 중 충돌 시 커밋하지 않고 중단. SessionStart가 적용 후 구형 경고를 내지 않아야 한다. 이 BP의 문서 자신이 migrate 대상이라 실행 중 경로가 바뀐다 — 적용 이후 게이트·편집은 새 경로를 쓰고, 구 경로로 돌리면 문서 없음으로 실패한다.

## Out of scope
- 외부 소비자 레포 대리 이주
- migrate 알고리즘 신규(BP-002)

## One-commit justification
실트리 dogfood와 레거시 허용 제거·Distill 한 줄이 “전이 종료” 한 커밋이다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
